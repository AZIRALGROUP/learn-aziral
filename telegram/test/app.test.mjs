import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createServer } from 'node:http';
import { openStore } from '../store.mjs';
import { verifyInitData } from '../auth.mjs';
import { createApp } from '../server.mjs';
import { processUpdate, telegramCall } from '../bot.mjs';

const token = '123456789:test-token-for-local-tests';
function signed(id, now, extra = {}) {
  const p = new URLSearchParams({ auth_date: String(Math.floor(now / 1000)), user: JSON.stringify({ id, first_name: `Player ${id}` }), ...extra });
  const data = [...p].sort(([a], [b]) => a.localeCompare(b)).map(([k,v]) => `${k}=${v}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  p.set('hash', createHmac('sha256', secret).update(data).digest('hex'));
  return p.toString();
}
const q = { question: 'Два плюс два?', options: ['4','5','6','7'], correct: 0, explanation: '2 + 2 = 4' };

test('Telegram authentication rejects tampering, stale dates, duplicate keys and future dates', () => {
  const now = Date.now();
  assert.equal(verifyInitData(signed(10, now), token, now).id, '10');
  assert.throws(() => verifyInitData(signed(10, now).replace('Player', 'Hacker'), token, now), /подпись/);
  assert.throws(() => verifyInitData(signed(10, now - 3601000), token, now), /истекла/);
  assert.throws(() => verifyInitData(signed(10, now + 60000), token, now), /истекла/);
  assert.throws(() => verifyInitData(signed(10, now) + '&auth_date=1', token, now), /подпись/);
  assert.throws(() => verifyInitData('', token, now), /подпись/);
});

async function fixture(t, options = {}) {
  let now = Date.now();
  const db = openStore(':memory:');
  const env = { TELEGRAM_BOT_TOKEN: token, TELEGRAM_BOT_USERNAME: 'TestLearnBot', MINI_APP_URL: 'https://example.com/telegram', TELEGRAM_WEBHOOK_SECRET: 'a'.repeat(40), ...options.env };
  const server = createServer(createApp({ db, env, clock: () => now, fetcher: options.fetcher }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); db.close(); });
  async function req(id, path, method = 'GET', body, headerOverride) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/telegram${path}`, {
      method, headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': signed(id, now), ...headerOverride },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() };
  }
  return { db, req, base: `http://127.0.0.1:${server.address().port}`, advance: ms => { now += ms; }, env, clock: () => now };
}

test('unauthenticated requests and wrong webhook secrets are denied', async t => {
  const { req } = await fixture(t);
  assert.equal((await req(1, '/me', 'GET', undefined, { 'X-Telegram-Init-Data': '' })).status, 401);
  assert.equal((await req(1, '/webhook', 'POST', { update_id: 1 })).status, 401);
  assert.equal((await req(1, '/tests', 'POST', null)).status, 400);
});

test('drafts are private; publishing exposes questions without answer keys; only author can edit', async t => {
  const { req } = await fixture(t);
  const created = await req(1, '/tests', 'POST', { title: 'Арифметика', questions: [q] });
  assert.equal(created.status, 200);
  const id = created.body.id;
  assert.equal((await req(2, `/tests/${id}`)).status, 404);
  assert.deepEqual((await req(2, '/tests')).body, []);
  assert.equal((await req(1, `/tests/${id}/publish`, 'PATCH', { published: true })).status, 200);
  const publicTest = await req(2, `/tests/${id}`);
  assert.equal(publicTest.status, 200);
  assert.equal(publicTest.body.questions[0].correct, undefined);
  assert.equal(publicTest.body.questions[0].explanation, undefined);
  assert.equal((await req(2, `/tests/${id}/edit`)).status, 403);
  assert.equal((await req(2, `/tests/${id}/publish`, 'PATCH', { published: false })).status, 403);
});

test('practice is graded from an immutable snapshot and submission cannot be changed', async t => {
  const { req } = await fixture(t);
  const { body: { id } } = await req(1, '/tests', 'POST', { title: 'Арифметика', questions: [q] });
  const a = await req(1, `/tests/${id}/attempts`, 'POST');
  assert.equal(a.body.questions[0].correct, undefined);
  await req(1, `/tests/${id}`, 'PUT', { title: 'Изменённый тест', questions: [{ ...q, correct: 1 }] });
  assert.equal((await req(2, `/attempts/${a.body.id}/submit`, 'POST', { answers: [0] })).status, 404);
  const result = await req(1, `/attempts/${a.body.id}/submit`, 'POST', { answers: [0] });
  assert.equal(result.body.correct, 1);
  assert.equal(result.body.review[0].explanation, q.explanation);
  assert.deepEqual((await req(1, `/attempts/${a.body.id}/submit`, 'POST', { answers: [1] })).body, result.body);
});

test('courses keep progress per user and reject nonexistent lessons', async t => {
  const { req } = await fixture(t);
  const c = await req(1, '/courses', 'POST', { title: 'Мой курс', lessons: [{ title: 'Урок один', content: 'Учебный материал' }] });
  const id = c.body.id;
  await req(1, `/courses/${id}/publish`, 'PATCH', { published: true });
  assert.equal((await req(2, `/courses/${id}/complete`, 'POST', { lesson: 1 })).status, 400);
  assert.equal((await req(2, `/courses/${id}/complete`, 'POST', { lesson: 0 })).status, 200);
  assert.deepEqual((await req(2, `/courses/${id}`)).body.completed, [0]);
  assert.deepEqual((await req(1, `/courses/${id}`)).body.completed, []);
});

test('duel enforces two players, server time, one answer, no answer leakage, and speed bonus', async t => {
  const { req, advance } = await fixture(t);
  const { body: { id } } = await req(1, '/tests', 'POST', { title: 'Дуэль знаний', questions: [q, q] });
  const duel = await req(1, '/duels', 'POST', { testId: id });
  const path = `/duels/${duel.body.id}`;
  assert.match(duel.body.inviteUrl, /TestLearnBot\?start=duel_/);
  assert.equal((await req(2, path)).body.question, undefined);
  assert.equal((await req(2, path + '/join', 'POST')).body.state, 'countdown');
  assert.equal((await req(3, path + '/join', 'POST')).status, 409);
  assert.equal((await req(1, path + '/answer', 'POST', { round: 0, choice: 0 })).status, 409);
  advance(3000);
  const v = (await req(1, path)).body;
  assert.equal(v.state, 'playing');
  assert.equal(v.question.correct, undefined);
  assert.equal(v.results, undefined);
  assert.equal((await req(3, path)).body.question, undefined);
  assert.equal((await req(3, path + '/answer', 'POST', { round: 0, choice: 0 })).status, 403);
  assert.equal((await req(1, path + '/answer', 'POST', { round: 0, choice: 0 })).status, 200);
  assert.equal((await req(1, path + '/answer', 'POST', { round: 0, choice: 1 })).status, 409);
  advance(2000);
  await req(2, path + '/answer', 'POST', { round: 0, choice: 0 });
  advance(13000);
  assert.equal((await req(1, path + '/answer', 'POST', { round: 0, choice: 0 })).status, 409);
  await req(1, path + '/answer', 'POST', { round: 1, choice: 0 });
  await req(2, path + '/answer', 'POST', { round: 1, choice: 0 });
  advance(15000);
  const finished = (await req(1, path)).body;
  assert.equal(finished.state, 'finished');
  assert.equal(finished.results[0].id, '1');
  assert.equal(finished.results[0].correct, 2);
  assert.ok(finished.results[0].score > finished.results[1].score);
  assert.equal((await req(3, path)).body.results, undefined);
});

test('duel snapshot survives test edits and expired lobbies cannot be joined', async t => {
  const { req, advance } = await fixture(t);
  const { body: { id } } = await req(1, '/tests', 'POST', { title: 'Дуэль знаний', questions: [q] });
  const { body: d } = await req(1, '/duels', 'POST', { testId: id });
  await req(1, `/tests/${id}`, 'PUT', { title: 'Обновлённый тест', questions: [{ ...q, question: 'Новый вопрос', correct: 1 }] });
  await req(2, `/duels/${d.id}/join`, 'POST');
  advance(3000);
  assert.equal((await req(1, `/duels/${d.id}`)).body.question.question, q.question);
  await req(1, `/duels/${d.id}/answer`, 'POST', { round: 0, choice: 0 });
  advance(15000);
  assert.equal((await req(1, `/duels/${d.id}`)).body.results[0].correct, 1);
  const { body: lobby } = await req(1, '/duels', 'POST', { testId: id });
  advance(900001);
  assert.equal((await req(2, `/duels/${lobby.id}`)).body.state, 'expired');
  assert.equal((await req(2, `/duels/${lobby.id}/join`, 'POST')).status, 410);
});

test('question validation rejects duplicate options and invalid correct indices', async t => {
  const { req } = await fixture(t);
  assert.equal((await req(1, '/tests', 'POST', { title: 'Плохой тест', questions: [{ ...q, correct: 4 }] })).status, 400);
  assert.equal((await req(1, '/tests', 'POST', { title: 'Плохой тест', questions: [{ ...q, options: ['A', 'a'] }] })).status, 400);
});

test('group commands use bot links, private commands use web_app, and updates are deduplicated', async () => {
  const db = openStore(':memory:');
  try {
    const env = { TELEGRAM_BOT_USERNAME: 'TestLearnBot', MINI_APP_URL: 'https://example.com/telegram' };
    const sent = [];
    const call = async (e, method, payload) => sent.push(payload);
    const update = { update_id: 1, message: { from: { id: 1, first_name: 'Test' }, chat: { id: -100, type: 'supergroup' }, text: '/learn@TestLearnBot' } };
    await processUpdate(db, env, update, Date.now(), call);
    await processUpdate(db, env, update, Date.now(), call);
    assert.equal(sent.length, 1);
    assert.match(sent[0].reply_markup.inline_keyboard[0][0].url, /^https:\/\/t.me/);
    await processUpdate(db, env, { ...update, update_id: 2, message: { ...update.message, chat: { id: 1, type: 'private' }, text: '/start duel_abc' } }, Date.now(), call);
    assert.equal(sent[1].reply_markup.inline_keyboard[0][0].web_app.url, 'https://example.com/telegram?start=duel_abc');
    await processUpdate(db, env, { ...update, update_id: 3, message: { ...update.message, text: '/learn@OtherBot' } }, Date.now(), call);
    assert.equal(sent.length, 2);
  } finally { db.close(); }
});

test('production refuses the development auth bypass', () => {
  const db = openStore(':memory:');
  try { assert.throws(() => createApp({ db, env: { NODE_ENV: 'production', TELEGRAM_DEV_MODE: 'true' } }), /forbidden/); }
  finally { db.close(); }
});

test('website lesson progress follows stable lesson IDs when the author reorders lessons', async t => {
  let reversed = false;
  const { req } = await fixture(t, {
    env: { SITE_API_URL: 'http://aziral-api:3001', LEARN_BRIDGE_SECRET: 'test'.repeat(12) },
    fetcher: async () => {
      const lessons = [{ id: 101, title: 'Первый', content: 'А' }, { id: 202, title: 'Второй', content: 'Б' }];
      return Response.json({ id: 1, title: 'Курс сайта', lessons: reversed ? lessons.reverse() : lessons, completed: [], linked: false, locked: false });
    },
  });
  assert.equal((await req(1, '/courses/site-1/complete', 'POST', { lesson: 0 })).status, 200);
  reversed = true;
  assert.deepEqual((await req(1, '/courses/site-1')).body.completed, [1]);
});

test('duels preserve multiple selected answers through SQLite and grade them on the server', async t => {
  const { req, advance } = await fixture(t, {
    env: { SITE_API_URL: 'http://aziral-api:3001', LEARN_BRIDGE_SECRET: 'test'.repeat(12) },
    fetcher: async () => Response.json({ title: 'Несколько ответов', questions: [{ question: 'Выберите два', type: 'multi', options: '["A","B","C"]', correct: '[0,2]' }] }),
  });
  const { body: d } = await req(1, '/duels', 'POST', { testId: 'site-1' });
  await req(2, `/duels/${d.id}/join`, 'POST'); advance(3000);
  const accepted = await req(1, `/duels/${d.id}/answer`, 'POST', { round: 0, choice: [2,0] });
  assert.equal(accepted.status, 200);assert.deepEqual(accepted.body.answer, [2,0]);
  assert.equal((await req(2, `/duels/${d.id}/answer`, 'POST', { round: 0, choice: [0,0] })).status, 400);
  await req(2, `/duels/${d.id}/answer`, 'POST', { round: 0, choice: [0] });advance(15000);
  const finished = (await req(1, `/duels/${d.id}`)).body;
  assert.equal(finished.results[0].id, '1');assert.equal(finished.results[0].correct, 1);assert.equal(finished.results[1].correct, 0);
});

test('an invitation to a paid lesson duel cannot bypass the guest course entitlement', async t => {
  const { req } = await fixture(t, {
    env: { SITE_API_URL: 'http://aziral-api:3001', LEARN_BRIDGE_SECRET: 'test'.repeat(12) },
    fetcher: async (url, options) => options.headers['x-learn-telegram-id'] === '1'
      ? Response.json({ title: 'Платный урок', questions: [{ question: 'Проверка', options: '["A","B"]', correct_index: 0 }] })
      : Response.json({ error: 'Доступ к платному курсу не подтверждён' }, { status: 403 }),
  });
  const { body: d } = await req(1, '/duels', 'POST', { testId: 'lesson-21' });
  assert.ok(d.id);
  assert.equal((await req(2, `/duels/${d.id}`)).status, 403);
  assert.equal((await req(2, `/duels/${d.id}/join`, 'POST')).status, 403);
});

test('saved practice resumes across requests, rejects stale writes, isolates users and keeps history immutable', async t => {
  const { req, advance } = await fixture(t);
  const { body: { id } } = await req(1, '/tests', 'POST', { title: 'Сохранённый тест', questions: [q, q] });
  const { body: a } = await req(1, `/tests/${id}/attempts`, 'POST');
  assert.deepEqual(a.answers, [null, null]);
  const path = `/attempts/${a.id}`;
  assert.equal((await req(2, path)).status, 404);
  assert.equal((await req(2, path + '/save', 'PUT', { answers: [0,1], questionIndex: 1, revision: 0 })).status, 404);
  assert.equal((await req(1, path + '/save', 'PUT', { answers: [0,9], questionIndex: 1, revision: 0 })).status, 400);
  advance(1000);
  assert.deepEqual((await req(1, path + '/save', 'PUT', { answers: [0,null], questionIndex: 1, revision: 0 })).body, { revision: 1 });
  assert.equal((await req(1, path + '/save', 'PUT', { answers: [1,null], questionIndex: 0, revision: 0 })).status, 409);
  const resumed = (await req(1, path)).body;
  assert.deepEqual(resumed.answers, [0,null]); assert.equal(resumed.questionIndex, 1); assert.equal(resumed.revision, 1);
  assert.equal(resumed.questions[0].correct, undefined);
  assert.equal((await req(1, '/learning')).body.active[0].answered, 1);
  assert.equal((await req(2, '/learning')).body.active.length, 0);
  const result = await req(1, path + '/submit', 'POST', { answers: [0,1] });
  assert.equal(result.body.correct, 1);
  assert.deepEqual((await req(1, path)).body.result, result.body);
  assert.equal((await req(1, path + '/save', 'PUT', { answers: [0,0], questionIndex: 0, revision: 1 })).status, 409);
  const learning = (await req(1, '/learning')).body;
  assert.equal(learning.active.length, 0); assert.equal(learning.stats.completed, 1);
  assert.equal(learning.stats.correct, 1); assert.equal(learning.stats.total, 2);
  assert.equal(learning.recent[0].title, 'Сохранённый тест');
  const retry = (await req(1, path + '/retry', 'POST', { mode: 'errors' })).body;
  assert.equal(retry.questions.length, 1); assert.deepEqual(retry.answers, [null]);
  assert.equal(retry.questions[0].correct, undefined);
  assert.notEqual(retry.id, a.id);
  assert.equal((await req(1, `/attempts/${retry.id}/submit`, 'POST', { answers: [0] })).body.correct, 1);
  assert.deepEqual((await req(1, path + '/submit', 'POST', { answers: [0,0] })).body, result.body);
});

test('saved paid lesson snapshots and answer reviews recheck entitlement on resume and retry', async t => {
  let allowed = true;
  const { req } = await fixture(t, {
    env: { SITE_API_URL: 'http://aziral-api:3001', LEARN_BRIDGE_SECRET: 'test'.repeat(12) },
    fetcher: async () => allowed
      ? Response.json({ title: 'Платный урок', questions: [{ question: 'Проверка', options: '["A","B"]', correct_index: 0 }] })
      : Response.json({ error: 'Доступ к курсу закрыт' }, { status: 403 }),
  });
  const { body: a } = await req(1, '/tests/lesson-21/attempts', 'POST');
  allowed = false;
  for (const [suffix, method, body] of [['', 'GET'], ['/save','PUT',{ answers: [0], questionIndex: 0, revision: 0 }], ['/submit','POST',{ answers: [0] }]]) {
    assert.equal((await req(1, `/attempts/${a.id}${suffix}`, method, body)).status, 403);
  }
  allowed = true;
  await req(1, `/attempts/${a.id}/submit`, 'POST', { answers: [0] });
  allowed = false;
  assert.equal((await req(1, `/attempts/${a.id}`)).status, 403);
  assert.equal((await req(1, `/attempts/${a.id}/retry`, 'POST', { mode: 'all' })).status, 403);
});

test('bot keeps one main action, preserves section links and shows group setup only in private help', async () => {
  const db = openStore(':memory:');
  try {
    const env = { TELEGRAM_BOT_USERNAME: 'TestLearnBot', MINI_APP_URL: 'https://example.com/telegram' };
    const sent = []; const call = async (e, method, payload) => sent.push(payload);
    const message = { from: { id: 1, first_name: 'Test' }, chat: { id: 1, type: 'private' }, text: '/progress' };
    await processUpdate(db, env, { update_id: 20, message }, Date.now(), call);
    assert.equal(sent[0].reply_markup.inline_keyboard[0][0].web_app.url, 'https://example.com/telegram?start=profile');
    const buttons = sent[0].reply_markup.inline_keyboard.flat();
    assert.equal(buttons.length, 1);
    await processUpdate(db, env, { update_id: 21, message: { ...message, text: 'Как учиться?' } }, Date.now(), call);
    assert.match(sent[1].text, /Как пользоваться/);
    assert.equal(sent[1].reply_markup.inline_keyboard.flat().length, 2);
    assert.equal(sent[1].reply_markup.inline_keyboard[1][0].url, 'https://t.me/TestLearnBot?startgroup=learn');
    await processUpdate(db, env, { update_id: 22, message: { ...message, chat: { id: -100, type: 'supergroup' }, text: 'Привет всем!' } }, Date.now(), call);
    assert.equal(sent.length, 2);
    await processUpdate(db, env, { update_id: 23, message: { ...message, text: '/start' } }, Date.now(), call);
    const menu = sent[2].reply_markup.inline_keyboard;
    assert.equal(menu.length, 1); assert.equal(menu.flat().length, 1);
    assert.ok(sent[2].text.length < 100);
    assert.equal(menu[0][0].web_app.url, env.MINI_APP_URL);
    for (const [i, [command, destination]] of [['tests', 'tests'], ['courses', 'courses'], ['newtest', 'newtest'], ['duel', 'duels'], ['start newtest', 'newtest']].entries()) {
      await processUpdate(db, env, { update_id: 24 + i, message: { ...message, text: '/' + command } }, Date.now(), call);
      const actions = sent.at(-1).reply_markup.inline_keyboard.flat();
      assert.equal(actions.length, 1);
      assert.equal(actions[0].web_app.url, env.MINI_APP_URL + '?start=' + destination);
    }
    await processUpdate(db, env, { update_id: 30, message: { ...message, chat: { id: -100, type: 'supergroup' }, text: '/help@TestLearnBot' } }, Date.now(), call);
    const groupActions = sent.at(-1).reply_markup.inline_keyboard.flat();
    assert.equal(groupActions.length, 1);
    assert.equal(groupActions[0].url, 'https://t.me/TestLearnBot?start=home');
  } finally { db.close(); }
});


test('profile photo upload preserves multipart attachment and automatic boundary headers', async () => {
  const payload = new FormData();
  payload.set('photo', JSON.stringify({ type: 'static', photo: 'attach://avatar' }));
  payload.set('avatar', new Blob(['image fixture'], { type: 'image/jpeg' }), 'avatar.jpg');
  const result = await telegramCall({ TELEGRAM_BOT_TOKEN: token }, 'setMyProfilePhoto', payload, async (url, request) => {
    assert.ok(url.endsWith('/setMyProfilePhoto'));
    assert.equal(request.body, payload);
    assert.equal(request.headers['Content-Type'], undefined);
    assert.equal(request.body.get('avatar').type, 'image/jpeg');
    return Response.json({ ok: true, result: true });
  });
  assert.equal(result, true);
});

test('browser account connection requires an expiring one-time link, verified website cookie and same-origin confirmation',async t=>{
  let linked=0;
  const {req,base,db,advance}=await fixture(t,{env:{SITE_API_URL:'http://aziral-api:3001',LEARN_BRIDGE_SECRET:'test'.repeat(12)},fetcher:async(url,options)=>{
    const path=new URL(url).pathname;
    if(path==='/api/auth/me') {
      assert.equal(options.headers.cookie,'auth_token=valid.token');
      return Response.json({id:7,name:'Account <A>'});
    }
    if(path==='/api/learn-bridge/account/link') {
      assert.equal(JSON.parse(options.body).siteUserId,7);
      assert.equal(options.headers['x-learn-telegram-id'],'1');linked++;
      return Response.json({linked:true,user:{id:7,name:'Account <A>'}});
    }
    throw new Error('Unexpected request');
  }});
  const link=(await req(1,'/account/link','POST',{siteUserId:999})).body.url;
  const path=new URL(link).pathname+new URL(link).search;
  assert.equal(db.prepare('SELECT hash FROM account_links').get().hash.includes(new URL(link).searchParams.get('code')),false);
  const login=await fetch(base+path); assert.match(await login.text(),/Войти на сайте/);assert.equal(linked,0);
  const confirm=await fetch(base+path,{headers:{cookie:'tracking=no; auth_token=valid.token'}});
  assert.match(await confirm.text(),/Account &lt;A&gt;/);assert.equal(linked,0);
  assert.equal((await fetch(base+path,{method:'POST',headers:{cookie:'auth_token=valid.token',origin:'https://evil.example'}})).status,403);
  const success=await fetch(base+path,{method:'POST',headers:{cookie:'auth_token=valid.token',origin:'https://example.com'}});
  assert.equal(success.status,200);assert.equal(linked,1);
  assert.equal((await fetch(base+path)).status,410);
  const another=(await req(2,'/account/link','POST')).body.url;advance(600001);
  assert.equal((await fetch(base+new URL(another).pathname+new URL(another).search)).status,410);
});

test('duel chat cards are bound to the host, contain a join button and are cached until expiry',async t=>{
  let calls=0;
  const {req,advance,clock}=await fixture(t,{fetcher:async(url,options)=>{
    assert.ok(url.endsWith('/savePreparedInlineMessage'));calls++;
    const payload=JSON.parse(options.body);
    assert.equal(payload.user_id,1);assert.equal(payload.allow_group_chats,true);
    assert.match(payload.result.reply_markup.inline_keyboard[0][0].url,/start=duel_/);
    assert.ok(!JSON.stringify(payload).includes('correct'));
    return Response.json({ok:true,result:{id:'prepared-card',expiration_date:Math.floor(clock()/1000)+600}});
  }});
  const test=(await req(1,'/tests','POST',{title:'Карточка дуэли',questions:[q]})).body.id;
  const duel=(await req(1,'/duels','POST',{testId:test})).body.id;
  assert.equal((await req(2,`/duels/${duel}/share`,'POST')).status,403);
  assert.equal((await req(1,`/duels/${duel}/share`,'POST')).body.id,'prepared-card');
  assert.equal((await req(1,`/duels/${duel}/share`,'POST')).body.id,'prepared-card');assert.equal(calls,1);
  advance(900001);assert.equal((await req(1,`/duels/${duel}/share`,'POST')).status,410);
});

test('test category persists across edits and invalid categories cannot create a test',async t=>{
  const {req}=await fixture(t);
  assert.equal((await req(1,'/tests','POST',{title:'Категория',category:'unknown',questions:[q]})).status,400);
  const id=(await req(1,'/tests','POST',{title:'Игровой тест',category:'games',questions:[q]})).body.id;
  assert.equal((await req(1,'/tests?mine=true')).body[0].category,'games');
  await req(1,`/tests/${id}`,'PUT',{title:'Научный тест',category:'science',questions:[q]});
  assert.equal((await req(1,`/tests/${id}/edit`)).body.category,'science');
});
