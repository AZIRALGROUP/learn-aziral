import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createServer } from 'node:http';
import createBridge from '../site-bridge.cjs';
import { createSiteClient, normalizeSiteQuestion } from '../site.mjs';
import { grade, prepareQuestions, publicQuestions, validAnswer } from '../store.mjs';

async function fixture(t) {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE users(id INTEGER PRIMARY KEY,name TEXT,role TEXT,banned INTEGER,telegram_id TEXT,password TEXT);
    CREATE TABLE courses(id INTEGER PRIMARY KEY,instructor_id INTEGER,title TEXT,description TEXT,price INTEGER,category TEXT,status TEXT,created_at TEXT,students_count INTEGER DEFAULT 0);
    CREATE TABLE course_lessons(id INTEGER PRIMARY KEY,course_id INTEGER,title TEXT,content TEXT,type TEXT,video_url TEXT,task_description TEXT,task_starter_code TEXT,order_num INTEGER,xp_reward INTEGER);
    CREATE TABLE course_enrollments(id INTEGER PRIMARY KEY,course_id INTEGER,user_id INTEGER,amount_paid INTEGER,payment_status TEXT,UNIQUE(course_id,user_id));
    CREATE TABLE lesson_progress(id INTEGER PRIMARY KEY,user_id INTEGER,lesson_id INTEGER,UNIQUE(user_id,lesson_id));
    CREATE TABLE user_xp(user_id INTEGER PRIMARY KEY,total_xp INTEGER,updated_at TEXT);
    CREATE TABLE course_quizzes(id INTEGER PRIMARY KEY,lesson_id INTEGER,question TEXT,options TEXT,correct_index INTEGER,order_num INTEGER);
    CREATE TABLE tests(id INTEGER PRIMARY KEY,title TEXT,category TEXT,status TEXT,updated_at TEXT,instructor_id INTEGER DEFAULT 99);
    CREATE TABLE test_questions(id INTEGER PRIMARY KEY,test_id INTEGER,question TEXT,type TEXT,options TEXT,items TEXT,correct TEXT,order_num INTEGER);
    INSERT INTO users VALUES(1,'Paid student','user',0,'111','PRIVATE_PASSWORD'),(2,'Pending student','user',0,'222','PRIVATE_PASSWORD'),(3,'Blocked','user',1,'333','PRIVATE_PASSWORD'),(99,'Teacher','instructor',0,'999','PRIVATE_PASSWORD');
    INSERT INTO courses(id,instructor_id,title,description,price,category,status) VALUES(1,99,'Free course','Free',0,'math','approved'),(2,99,'Paid course','Paid',10000,'math','approved'),(3,99,'Private draft','Draft',0,'math','pending');
    INSERT INTO course_lessons VALUES(11,1,'Free lesson','FREE_CONTENT','text',NULL,NULL,NULL,0,10),(21,2,'Paid lesson','PAID_SECRET_CONTENT','text',NULL,NULL,NULL,0,15),(31,3,'Private lesson','DRAFT_CONTENT','text',NULL,NULL,NULL,0,20);
    INSERT INTO course_enrollments(course_id,user_id,amount_paid,payment_status) VALUES(2,1,10000,'confirmed'),(2,2,0,'pending');
    INSERT INTO course_quizzes VALUES(1,21,'Paid quiz','["A","B"]',1,0);
    INSERT INTO tests VALUES(1,'Published test','math','published','2026-10-21',99),(2,'Draft test','math','draft','2026-10-21',99);
    INSERT INTO test_questions VALUES(1,1,'Pick two','multi','["A","B","C"]','[]','[0,2]',0);
    INSERT INTO test_questions VALUES(2,2,'Draft question','single','["A","B"]','[]','[1]',0);
  `);
  db.transaction = fn => () => { db.exec('BEGIN'); try { const result = fn(); db.exec('COMMIT'); return result; } catch(e) { db.exec('ROLLBACK'); throw e; } };
  const secret = 'test-bridge-secret-'.repeat(3);
  const server = createServer(createBridge({ db, secret }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); db.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const site = createSiteClient({ SITE_API_URL: base, LEARN_BRIDGE_SECRET: secret }, (url, options) => {
    // Express strips the mount prefix before calling the bridge.
    const incoming = new URL(url);
    return fetch(new URL(incoming.pathname.replace('/api/learn-bridge', '') + incoming.search, base), options);
  });
  return { db, site, base, secret };
}

test('website bridge requires its own secret and never exposes passwords or draft catalog entries', async t => {
  const { base, site } = await fixture(t);
  assert.equal((await fetch(base + '/catalog')).status, 404);
  const catalog = await site.catalog('444', 'courses');
  assert.deepEqual(catalog.map(c => c.id).sort(), ['site-1', 'site-2']);
  assert.ok(!JSON.stringify(catalog).includes('PRIVATE_PASSWORD'));
  assert.deepEqual((await site.catalog('444', 'tests')).map(t => t.id), ['site-1']);
  await assert.rejects(site.test('444', 'site-2'), /не найден/);
});

test('paid course content and quizzes require confirmed access; unlinked and pending users get no content', async t => {
  const { site } = await fixture(t);
  for (const user of ['444', '222']) {
    const course = await site.course(user, 'site-2');
    assert.equal(course.locked, true);
    assert.equal(course.lessons[0].content, undefined);
    assert.ok(!JSON.stringify(course).includes('PAID_SECRET_CONTENT'));
    await assert.rejects(site.test(user, 'lesson-21'), /платному/);
  }
  assert.equal((await site.course('111', 'site-2')).lessons[0].content, 'PAID_SECRET_CONTENT');
  assert.equal((await site.course('999', 'site-2')).locked, false);
  assert.equal(JSON.parse((await site.test('111', 'lesson-21')).questions)[0].correct, 1);
  await assert.rejects(site.course('111', 'site-3'), /не найден/);
});

test('website account binding uses the verified numeric Telegram ID and honors bans', async t => {
  const { site } = await fixture(t);
  assert.equal((await site.account('111')).user.id, 1);
  assert.equal((await site.account('444')).linked, false);
  await assert.rejects(site.account('333'), /заблокирован/);
  await assert.rejects(site.account('dev-1'), /входа/);
});

test('lesson completion synchronizes progress and XP exactly once and does not bypass paid access', async t => {
  const { site, db } = await fixture(t);
  await assert.rejects(site.complete('444', 'site-1', 11), /Привяжите/);
  await assert.rejects(site.complete('222', 'site-2', 21), /платному/);
  assert.equal((await site.complete('111', 'site-2', 21)).xp, 15);
  assert.equal((await site.complete('111', 'site-2', 21)).xp, 0);
  assert.equal(db.prepare('SELECT total_xp FROM user_xp WHERE user_id=1').get().total_xp, 15);
  assert.deepEqual((await site.course('111', 'site-2')).completed, [0]);
  await assert.rejects(site.complete('111', 'site-2', 11), /не найден/);
  await site.complete('222', 'site-1', 11);
  await site.complete('222', 'site-1', 11);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM course_enrollments WHERE user_id=2 AND course_id=1 AND payment_status='free'").get().n, 1);
  assert.equal(db.prepare('SELECT students_count FROM courses WHERE id=1').get().students_count, 1);
});

test('site multi-answer, true/false and ordering questions retain their grading semantics', () => {
  const multi = normalizeSiteQuestion({ question: 'Pick two', type: 'multi', options: '["A","B","C"]', correct: '[0,2]' });
  const tf = normalizeSiteQuestion({ question: 'True?', type: 'tf', options: '[]', correct: '[1]' });
  const order = normalizeSiteQuestion({ question: 'Sort', type: 'order', items: '[{"text":"Second","order":2},{"text":"First","order":1}]' });
  assert.equal(grade([multi, tf, order], [[2,0], 1, [1,0]]).correct, 3);
  assert.equal(grade([multi], [[0]]).correct, 0);
  assert.throws(() => grade([multi], [[0,0,2]]), /Некорректные/);
  assert.equal(validAnswer(order, [0]), false);
  const prepared = prepareQuestions([order])[0];
  assert.deepEqual(prepared.correct.map(i => prepared.options[i]), ['First', 'Second']);
  assert.equal(publicQuestions([prepared])[0].correct, undefined);
  assert.equal(publicQuestions([multi])[0].type, 'multi');
});

test('shared account identifies own website drafts and edits stay limited to the owner', async t => {
  const { site,db } = await fixture(t);
  assert.equal((await site.catalog('999','tests',true)).length,2);
  assert.equal((await site.catalog('111','tests',true)).length,0);
  const mine = await site.test('999','site-2');
  assert.equal(mine.owner,'999'); assert.equal(mine.published,0);
  await assert.rejects(site.test('111','site-2'), /не найден/);
  const input = { title: 'Игровой тест',subject: 'Игра',category: 'games',questions: [{ question: 'Один плюс один?',options: ['2','3','4','5'],correct:0,explanation:'Складываем две единицы.' }] };
  const saved = await site.saveTest('111',input);
  assert.equal((await site.test('111',saved.id)).category,'games');
  assert.equal(JSON.parse((await site.test('111',saved.id)).questions)[0].explanation,input.questions[0].explanation);
  await assert.rejects(site.test('222',saved.id), /не найден/);
  await assert.rejects(site.saveTest('222',input,saved.id), /только автор/);
  await assert.rejects(site.publishTest('222',saved.id,true), /только автор/);
  await site.publishTest('111',saved.id,true);
  assert.ok((await site.catalog('222','tests')).some(t => t.id===saved.id && !t.mine && t.category==='games'));
  await site.saveTest('111',{...input,title:'Изменённый тест'},saved.id);
  assert.equal((await site.test('111',saved.id)).title,'Изменённый тест');
  const row = db.prepare('SELECT instructor_id FROM tests WHERE id=?').get(Number(saved.id.slice(5)));
  assert.equal(row.instructor_id,1);
});

test('legacy test import is idempotent and account links cannot replace an existing identity', async t => {
  const { site,db } = await fixture(t);
  const input = { title: 'Импорт',subject:'',category:'mixed',sourceId:'a'.repeat(32),questions:[{question:'Два плюс два?',options:['4','5'],correct:0}] };
  const first=await site.saveTest('111',input);
  assert.deepEqual(await site.saveTest('111',input),first);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM tests WHERE instructor_id=1').get().n,1);
  await assert.rejects(site.saveTest('444',input), /подключите/);
  await assert.rejects(site.linkAccount('111',2), /другим/);
  await assert.rejects(site.linkAccount('444',1), /другим/);
  await assert.rejects(site.linkAccount('444',3), /недоступен/);
  db.prepare('INSERT INTO users VALUES (?,?,?,?,?,?)').run(10,'New account','user',0,null,'PASSWORD');
  assert.equal((await site.linkAccount('444',10)).user.id,10);
  assert.equal((await site.account('444')).user.name,'New account');
  assert.equal((await site.linkAccount('444',10)).linked,true);
});

test('overlapping connection requests cannot bind the same Telegram to two website accounts',async t=>{
  const {db,base,secret}=await fixture(t);
  db.prepare('INSERT INTO users VALUES (?,?,?,?,?,?)').run(10,'One','user',0,null,'PASSWORD');
  db.prepare('INSERT INTO users VALUES (?,?,?,?,?,?)').run(11,'Two','user',0,null,'PASSWORD');
  const prepare=db.prepare.bind(db);let observed;
  const lookup=new Promise(resolve=>{observed=resolve;});
  db.prepare=sql=>{
    const statement=prepare(sql);
    if(sql==='SELECT id,name,role,banned FROM users WHERE telegram_id = ?') {
      const get=statement.get.bind(statement);
      statement.get=(...args)=>{const row=get(...args);observed();return row;};
    }
    return statement;
  };
  let writer;
  const body=new ReadableStream({start(controller){writer=controller;controller.enqueue(new TextEncoder().encode('{"siteUserId":'));}});
  const headers={'x-learn-bridge-secret':secret,'x-learn-telegram-id':'444','content-type':'application/json'};
  const delayed=fetch(base+'/account/link',{method:'POST',headers,body,duplex:'half'});
  await lookup;
  assert.equal((await fetch(base+'/account/link',{method:'POST',headers,body:JSON.stringify({siteUserId:11})})).status,200);
  writer.enqueue(new TextEncoder().encode('10}'));writer.close();
  assert.equal((await delayed).status,409);
  assert.deepEqual(db.prepare('SELECT id FROM users WHERE telegram_id=?').all('444').map(r=>r.id),[11]);
});
