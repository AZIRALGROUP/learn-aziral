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
    CREATE TABLE quiz_attempts(id INTEGER PRIMARY KEY,user_id INTEGER,quiz_id INTEGER,answer_index INTEGER,correct INTEGER,xp_earned INTEGER,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
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

test('shared history resumes between browser and Telegram, rejects stale saves and keeps immutable results',async t=>{
  const {db,site}=await fixture(t);
  const store=(await import('../learnLearningStore.cjs')).default({db});
  const a=store.handle(1,'POST','/tests/site-1/attempts');
  assert.equal(a.questions[0].correct,undefined);
  assert.equal((await site.learning('111','/tests/site-1/attempts','POST')).id,a.id);
  await site.learning('111','/attempts/'+a.id+'/save','PUT',{answers:[[2,0]],questionIndex:0,revision:0});
  const resumed=store.handle(1,'GET','/attempts/'+a.id);
  assert.deepEqual(resumed.answers,[[2,0]]);assert.equal(resumed.revision,1);
  assert.throws(()=>store.handle(1,'PUT','/attempts/'+a.id+'/save',{answers:[[1]],questionIndex:0,revision:0}),e=>e.status===409);
  await assert.rejects(site.learning('222','/attempts/'+a.id),e=>e.status===404);
  const result=store.handle(1,'POST','/attempts/'+a.id+'/submit',{answers:[[0,2]],revision:1,correct:999});
  assert.equal(result.correct,1);
  assert.deepEqual(await site.learning('111','/attempts/'+a.id+'/submit','POST',{answers:[[1]],revision:0}),result);
  assert.throws(()=>store.handle(1,'PUT','/attempts/'+a.id+'/save',{answers:[[1]],questionIndex:0,revision:2}),e=>e.status===409);
  assert.deepEqual(await site.learning('111','/summary'),JSON.parse(JSON.stringify(store.handle(1,'GET','/summary'))));
  assert.equal(store.handle(1,'GET','/summary').stats.completed,1);
  assert.throws(()=>store.handle(1,'POST','/attempts/'+a.id+'/retry',{mode:'errors'}),e=>e.status===400);
  assert.notEqual(store.handle(1,'POST','/attempts/'+a.id+'/retry',{mode:'all'}).id,a.id);
});

test('imports preserve history and retries cannot overwrite newer shared answers',async t=>{
  const {db,site}=await fixture(t);
  const store=(await import('../learnLearningStore.cjs')).default({db});
  const payload={id:'b'.repeat(32),testId:'bot-'+'c'.repeat(32),title:'Saved test',questions:[{question:'Q',options:['A','B'],correct:1,type:'single'}],answers:[0],created:123,updated:456,revision:3,questionIndex:0};
  assert.throws(()=>store.handle(1,'POST','/import',payload),e=>e.status===404);
  const a=await site.learning('111','/import','POST',payload);
  store.handle(1,'PUT','/attempts/'+a.id+'/save',{answers:[1],questionIndex:0,revision:3});
  assert.equal((await site.learning('111','/import','POST',payload)).revision,4);
  assert.deepEqual(store.handle(1,'GET','/attempts/'+a.id).answers,[1]);
  const done=await site.learning('111','/import','POST',{...payload,id:'d'.repeat(32),finished:true,answers:[1],correct:999});
  assert.equal(done.result.correct,1);
  const summary=store.handle(1,'GET','/summary');assert.equal(summary.recent[0].updated,456);assert.equal(summary.stats.completed,1);
});

test('course XP and quiz rewards are shared and awarded once; revoked paid access blocks snapshots',async t=>{
  const {db,site}=await fixture(t);db.exec('ALTER TABLE course_quizzes ADD COLUMN xp_reward INTEGER DEFAULT 5');
  const store=(await import('../learnLearningStore.cjs')).default({db});
  assert.equal(store.completeLesson(1,21).xp,15);
  assert.equal((await site.complete('111','site-2',21)).xp,0);
  const requestId='f'.repeat(32);
  const first=store.legacyQuiz(1,21,{answers:{1:1},requestId});
  const second=store.legacyQuiz(1,21,{answers:{1:0},requestId});
  assert.equal(first.attemptId,second.attemptId);assert.equal(first.totalXp,5);assert.equal(second.totalXp,0);assert.equal(second.allCorrect,true);
  const a=await site.learning('111','/tests/lesson-21/attempts','POST');
  await site.learning('111','/attempts/'+a.id+'/submit','POST',{answers:[1],revision:0});
  assert.equal(store.handle(1,'GET','/summary').stats.xp,20);
  assert.equal(store.handle(1,'GET','/summary').stats.completed,2);
  db.exec("UPDATE course_enrollments SET payment_status='revoked' WHERE user_id=1 AND course_id=2");
  await assert.rejects(site.learning('111','/attempts/'+a.id),e=>e.status===403);
  assert.throws(()=>store.handle(1,'POST','/attempts/'+a.id+'/retry',{mode:'all'}),e=>e.status===403);
});

test('legacy grades stay historical after edits and personal course progress and duels share one summary',async t=>{
  const {db,site}=await fixture(t);
  db.exec('INSERT INTO quiz_attempts(user_id,quiz_id,answer_index,correct,xp_earned) VALUES(1,1,1,1,5)');
  db.exec('UPDATE course_quizzes SET correct_index=0');
  const store=(await import('../learnLearningStore.cjs')).default({db});
  const first=store.handle(1,'GET','/summary');assert.equal(first.stats.completed,1);assert.equal(first.stats.correct,1);
  const old=await site.learning('111','/attempts/'+first.recent[0].id);assert.equal(old.result.canRetry,false);assert.deepEqual(old.result.review,[]);
  assert.throws(()=>store.handle(1,'POST','/attempts/'+old.id+'/retry',{mode:'all'}),e=>e.status===400);
  const key='bot-'+'a'.repeat(32);const course={id:key,title:'Personal',description:'',lessons:[{title:'One',content:'Read'},{title:'Two',content:'Read'}],completed:[0]};
  await site.learning('111','/courses/import','POST',course);
  store.handle(1,'POST','/courses/'+key+'/complete',{lesson:1});
  await site.learning('111','/courses/import','POST',course);
  assert.deepEqual((await site.learning('111','/courses/'+key)).completed,[0,1]);
  assert.throws(()=>store.handle(2,'GET','/courses/'+key),e=>e.status===404);
  const duel={id:'e'.repeat(32),title:'Duel',opponent:'Friend',score:900,correct:1,total:2,updated:123};
  await site.learning('111','/duels/import','POST',duel);await site.learning('111','/duels/import','POST',duel);
  const summary=store.handle(1,'GET','/summary');assert.equal(summary.stats.lessons,2);assert.equal(summary.stats.duels,1);assert.equal(summary.stats.completed,1);
});

test('browser shared API verifies account and origin and exposes the same Telegram attempt',async t=>{
  const {db,site}=await fixture(t);
  const routes=(await import('../learnLearning.cjs')).default({db,jwtAuth:(req,res,next)=>{if(req.headers['x-qa-user']){req.user={id:Number(req.headers['x-qa-user'])};next();}else{res.statusCode=401;res.end('{}');}}});
  const server=createServer(async(req,res)=>{const chunks=[];for await(const c of req)chunks.push(c);req.body=chunks.length?JSON.parse(Buffer.concat(chunks)):{};routes(req,res);});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>{server.closeAllConnections();server.close();});
  const base=`http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(base+'/summary')).status,401);
  const options={method:'POST',headers:{'x-qa-user':'1',origin:'https://evil.example'}};
  assert.equal((await fetch(base+'/tests/site-1/attempts',options)).status,403);
  const response=await fetch(base+'/tests/site-1/attempts',{...options,headers:{...options.headers,origin:'https://learn.aziral.com'}});
  assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);
  const a=await response.json();assert.equal((await site.learning('111','/attempts/'+a.id)).id,a.id);
  assert.equal((await fetch(base+'/attempts/'+a.id,{headers:{'x-qa-user':'2'}})).status,404);
});

test('lost migration acknowledgement retries the frozen payload without overwriting shared progress',async t=>{
  const {site}=await fixture(t);
  const {openStore}=await import('../store.mjs');const {createLearningSync}=await import('../sync-learning.mjs');
  const local=openStore(':memory:');t.after(()=>local.close());
  const id='7'.repeat(32),key='8'.repeat(32);
  local.prepare('INSERT INTO users(id,name) VALUES (?,?)').run('111','Learner');
  local.prepare('INSERT INTO tests(id,owner,title,subject,questions,published,created) VALUES (?,?,?,?,?,?,?)').run(key,'111','Local','','[{"question":"Q","options":["A","B"],"correct":1}]',0,1);
  local.prepare('INSERT INTO attempts(id,user_id,test_id,snapshot) VALUES (?,?,?,?)').run(id,'111',key,'[{"question":"Q","options":["A","B"],"correct":1}]');
  local.prepare('INSERT INTO attempt_details(attempt_id,title,created,updated,answers,question_index,revision) VALUES (?,?,?,?,?,?,?)').run(id,'Local',1,2,'[0]',0,0);
  let lose=true;const sync=createLearningSync(local,{...site,learning:async(...args)=>{const value=await site.learning(...args);if(lose){lose=false;throw new Error('Connection lost after commit');}return value;}});
  await assert.rejects(sync.ensureAttempt('111',id),/Connection lost/);
  assert.ok(local.prepare('SELECT payload FROM learning_transfers WHERE attempt_id=?').get(id));
  await site.learning('111','/attempts/shared-'+id+'/save','PUT',{answers:[1],questionIndex:0,revision:0});
  assert.equal(await sync.ensureAttempt('111',id),'shared-'+id);
  assert.deepEqual((await site.learning('111','/attempts/shared-'+id)).answers,[1]);
});
