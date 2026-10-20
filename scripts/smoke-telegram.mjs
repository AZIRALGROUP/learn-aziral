// Operator-only release smoke test. Creates two explicitly synthetic bot users.
// Uses the bot credential locally to sign fixtures; never prints credentials.
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { setTimeout } from 'node:timers/promises';

if (process.env.ALLOW_PRODUCTION_SMOKE !== 'true') throw new Error('Set ALLOW_PRODUCTION_SMOKE=true explicitly');
const base = new URL(process.env.MINI_APP_URL).origin;
const ids = [900000000000001, 900000000000002];
function initData(id) {
  const p = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify({ id, first_name: 'Deployment smoke fixture' }) });
  const text = [...p].sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => `${k}=${v}`).join('\n');
  const secret = createHmac('sha256','WebAppData').update(process.env.TELEGRAM_BOT_TOKEN).digest();
  p.set('hash',createHmac('sha256',secret).update(text).digest('hex'));
  return p.toString();
}
async function call(id, path, method = 'GET', body, expected = 200) {
  const response = await fetch(base + '/api/telegram' + path, { method, headers: { 'Content-Type':'application/json', 'X-Telegram-Init-Data':initData(id) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal:AbortSignal.timeout(25000) });
  const data = await response.json();
  assert.equal(response.status, expected, `${path}: ${data.error || response.status}`);
  return data;
}
const report = { users: ids.map(String), base, createdTest: null, createdDuel: null };
writeFileSync('telegram/data/live-smoke.json',JSON.stringify(report,null,2),{mode:0o600});
const session = await call(ids[0], '/me');
assert.equal(session.dev,false);assert.equal(session.siteConnected,true);assert.equal(session.siteAccount.linked,false);
const tests = await call(ids[0], '/tests');
const courses = await call(ids[0], '/courses');
const sourceTests = tests.filter(t=>t.source==='website');
const sourceCourses = courses.filter(c=>c.source==='website');
assert.ok(sourceTests.length > 0);assert.ok(sourceCourses.length > 0);
const practice = await call(ids[0],`/tests/${sourceTests[0].id}/attempts`,'POST');
assert.ok(practice.questions.length > 0);
assert.ok(practice.questions.every(q=>q.correct === undefined && q.explanation === undefined));
const savedAnswers = practice.answers.map((answer, i) => i === 0 && practice.questions[0].type !== 'multi' && practice.questions[0].type !== 'order' ? 0 : answer);
const saved = await call(ids[0], `/attempts/${practice.id}/save`, 'PUT', { answers: savedAnswers, questionIndex: Math.min(1, practice.questions.length - 1), revision: practice.revision });
assert.equal(saved.revision, 1);
const resumed = await call(ids[0], `/attempts/${practice.id}`);
assert.deepEqual(resumed.answers, savedAnswers); assert.equal(resumed.questionIndex, Math.min(1, practice.questions.length - 1));
assert.ok((await call(ids[0], '/learning')).active.some(a => a.id === practice.id));
await call(ids[1], `/attempts/${practice.id}`, 'GET', undefined, 404);
const result = await call(ids[0],`/attempts/${practice.id}/submit`,'POST',{answers:practice.questions.map(()=>null)});
assert.equal(result.total,practice.questions.length);
assert.ok((await call(ids[0], '/learning')).recent.some(a => a.id === practice.id));
const retry = await call(ids[0], `/attempts/${practice.id}/retry`, 'POST', { mode: 'errors' });
assert.equal(retry.questions.length, result.total); assert.ok(retry.questions.every(q => q.correct === undefined));
const paid = sourceCourses.find(c=>Number(c.price)>0);
if(paid){const c=await call(ids[0],`/courses/${paid.id}`);assert.equal(c.locked,true);assert.ok(c.lessons.every(l=>!l.content));}
const test = await call(ids[0],'/tests','POST',{title:'Deployment smoke fixture — delete after verification',questions:[{question:'2 + 2 = ?',options:['4','5'],correct:0,explanation:'Synthetic deployment test'}]});
report.createdTest=test.id;
const duel = await call(ids[0],'/duels','POST',{testId:test.id});report.createdDuel=duel.id;
writeFileSync('telegram/data/live-smoke.json',JSON.stringify(report,null,2),{mode:0o600});
await call(ids[1],`/duels/${duel.id}/join`,'POST');
await setTimeout(3300);
const round = await call(ids[0],`/duels/${duel.id}`);
assert.equal(round.state,'playing');assert.equal(round.question.correct,undefined);
await call(ids[0],`/duels/${duel.id}/answer`,'POST',{round:0,choice:0});
await call(ids[0],`/duels/${duel.id}/answer`,'POST',{round:0,choice:1},409);
await call(ids[1],`/duels/${duel.id}/answer`,'POST',{round:0,choice:1});
await setTimeout(Math.max(0, round.endsAt-round.serverNow)+250);
const finished=await call(ids[0],`/duels/${duel.id}`);
assert.equal(finished.state,'finished');assert.equal(finished.results[0].id,String(ids[0]));assert.equal(finished.results[0].correct,1);
const denied=await fetch(base+'/api/telegram/webhook',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
assert.equal(denied.status,401);
const webhook=await fetch(base+'/api/telegram/webhook',{method:'POST',headers:{'Content-Type':'application/json','X-Telegram-Bot-Api-Secret-Token':process.env.TELEGRAM_WEBHOOK_SECRET},body:JSON.stringify({update_id:900000000000001})});
assert.equal(webhook.status,200);
console.log(JSON.stringify({ok:true,publishedSiteTests:sourceTests.length,siteCourses:sourceCourses.length,practiceQuestions:practice.questions.length,resume:'passed',history:'passed',retry:'passed',duel:'passed',paidAccess:'protected',webhook:'protected'}));
