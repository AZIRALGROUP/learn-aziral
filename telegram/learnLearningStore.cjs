const { randomUUID, randomInt, createHash } = require('node:crypto');
const parse = value => typeof value === 'string' ? JSON.parse(value) : value;
const fail = (status,message) => { const e=new Error(message);e.status=status;throw e; };
const publicQuestions = rows => rows.map(({question,options,type})=>({question,options,type:type||'single'}));
function normalize(q) {
  if (q.correct_index !== undefined) return {question:q.question,options:parse(q.options),correct:Number(q.correct_index),explanation:'',type:'single',quizId:q.id};
  if (q.type==='order') {
    const items=parse(q.items||'[]');
    return {question:q.question,options:items.map(i=>i.text),correct:items.map((_,i)=>i).sort((a,b)=>items[a].order-items[b].order),type:'order',explanation:''};
  }
  const correct=parse(q.correct||'[]');const options=q.type==='tf'&&parse(q.options||'[]').length<2?['Правда','Ложь']:parse(q.options||'[]');
  return {question:q.question,options,correct:q.type==='multi'?correct:correct[0],type:q.type==='multi'?'multi':'single',explanation:q.explanation||''};
}
function valid(q,a) {
  if(a===null)return true;
  if(q.type==='multi'||q.type==='order')return Array.isArray(a)&&new Set(a).size===a.length&&a.every(i=>Number.isInteger(i)&&i>=0&&i<q.options.length)&&(q.type!=='order'||a.length===q.options.length);
  return Number.isInteger(a)&&a>=0&&a<q.options.length;
}
function matches(q,a) {
  if(a===null)return false;
  if(q.type==='multi')return [...a].sort((a,b)=>a-b).join(',')===[...q.correct].sort((a,b)=>a-b).join(',');
  return q.type==='order'?a.join(',')===q.correct.join(','):a===q.correct;
}
function validateSnapshot(rows) {
  if(!Array.isArray(rows)||!rows.length||rows.length>2000)fail(400,'В тесте нужно от 1 до 2000 вопросов');
  for(const q of rows) {
    if(!q||typeof q.question!=='string'||!q.question.trim()||q.question.length>15000||!Array.isArray(q.options)||q.options.length<2||q.options.length>100||q.options.some(o=>typeof o!=='string'||!o.trim()||o.length>15000)||!valid(q,q.correct)||q.correct===null||(Array.isArray(q.correct)&&!q.correct.length))fail(422,'В тесте есть некорректный вопрос');
  }
  return rows;
}
function grade(rows,answers) {
  if(!Array.isArray(answers)||answers.length!==rows.length||answers.some((a,i)=>!valid(rows[i],a)))fail(400,'Некорректные ответы');
  const review=rows.map((q,i)=>({...q,answer:answers[i],isCorrect:matches(q,answers[i])}));
  return {correct:review.filter(q=>q.isCorrect).length,total:rows.length,review};
}
function prepared(rows) {
  return structuredClone(rows).map(q=>{
    if(q.type!=='order')return q;
    const order=q.options.map((_,i)=>i);
    for(let i=order.length-1;i>0;i--){const j=randomInt(i+1);[order[i],order[j]]=[order[j],order[i]];}
    return {...q,options:order.map(i=>q.options[i]),correct:q.correct.map(i=>order.indexOf(i))};
  });
}
module.exports=function createLearningStore({db,clock=Date.now}) {
  db.exec(`CREATE TABLE IF NOT EXISTS learn_attempts (
    id TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),test_id TEXT NOT NULL,title TEXT NOT NULL,snapshot TEXT NOT NULL,answers TEXT NOT NULL,
    question_index INTEGER NOT NULL DEFAULT 0,revision INTEGER NOT NULL DEFAULT 0,result TEXT,created INTEGER NOT NULL,updated INTEGER NOT NULL,origin TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS learn_attempts_user ON learn_attempts(user_id,updated);
    CREATE TABLE IF NOT EXISTS learn_quiz_rewards(user_id INTEGER NOT NULL,quiz_id INTEGER NOT NULL,xp INTEGER NOT NULL,PRIMARY KEY(user_id,quiz_id));
    CREATE TABLE IF NOT EXISTS learn_legacy_quiz_links(legacy_id INTEGER PRIMARY KEY,attempt_id TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS learn_personal_courses(user_id INTEGER NOT NULL,course_key TEXT NOT NULL,title TEXT NOT NULL,description TEXT NOT NULL,lessons TEXT NOT NULL,PRIMARY KEY(user_id,course_key));
    CREATE TABLE IF NOT EXISTS learn_personal_progress(user_id INTEGER NOT NULL,course_key TEXT NOT NULL,lesson INTEGER NOT NULL,PRIMARY KEY(user_id,course_key,lesson));
    CREATE TABLE IF NOT EXISTS learn_duel_history(user_id INTEGER NOT NULL,duel_id TEXT NOT NULL,title TEXT NOT NULL,opponent TEXT NOT NULL,score INTEGER NOT NULL,correct INTEGER NOT NULL,total INTEGER NOT NULL,finished INTEGER NOT NULL,PRIMARY KEY(user_id,duel_id));
    INSERT OR IGNORE INTO learn_quiz_rewards(user_id,quiz_id,xp) SELECT user_id,quiz_id,MAX(xp_earned) FROM quiz_attempts WHERE xp_earned>0 GROUP BY user_id,quiz_id;`);
  function user(id) {
    const u=db.prepare('SELECT id,name,role,banned,telegram_id FROM users WHERE id=?').get(id);
    if(!u)fail(401,'Войдите в аккаунт сайта');if(u.banned)fail(403,'Аккаунт сайта заблокирован');return u;
  }
  function courseAccess(id,u) {
    const c=db.prepare('SELECT * FROM courses WHERE id=?').get(id);
    if(!c||(c.status!=='approved'&&c.instructor_id!==u.id&&u.role!=='admin'))fail(404,'Курс не найден');
    const paid=db.prepare("SELECT id FROM course_enrollments WHERE user_id=? AND course_id=? AND payment_status IN ('free','confirmed')").get(u.id,id);
    if(Number(c.price)>0&&!paid&&c.instructor_id!==u.id&&u.role!=='admin')fail(403,'Для курса нужен подтверждённый доступ');return c;
  }
  function source(key,u) {
    if(/^site-[1-9]\d{0,9}$/.test(key)) {
      const t=db.prepare("SELECT id,title FROM tests WHERE id=? AND (status='published' OR instructor_id=?)").get(Number(key.slice(5)),u.id);
      if(!t)fail(404,'Тест не найден или не опубликован');
      const rows=db.prepare("SELECT q.*,COALESCE(e.explanation,'') AS explanation FROM test_questions q LEFT JOIN learn_question_explanations e ON e.question_id=q.id WHERE q.test_id=? ORDER BY q.order_num,q.id").all(t.id);
      return {title:t.title,questions:validateSnapshot(rows.map(normalize))};
    }
    if(/^lesson-[1-9]\d{0,9}$/.test(key)) {
      const l=db.prepare('SELECT id,title,course_id FROM course_lessons WHERE id=?').get(Number(key.slice(7)));
      if(!l)fail(404,'Урок не найден');courseAccess(l.course_id,u);
      return {title:l.title,questions:validateSnapshot(db.prepare('SELECT * FROM course_quizzes WHERE lesson_id=? ORDER BY order_num,id').all(l.id).map(normalize))};
    }
    fail(404,'Тест не найден');
  }
  function permission(row,u) {
    // A personal snapshot of a free bot test belongs to its learner. Paid site
    // lessons are always rechecked, including review/retry of old snapshots.
    if(row.test_id.startsWith('site-')||row.test_id.startsWith('lesson-'))source(row.test_id,u);
  }
  const wireId=id=>'shared-'+id;
  function rowFor(id,u) {
    const raw=String(id).replace(/^shared-/,'');
    if(!/^[a-z0-9-]{1,64}$/.test(raw))fail(404,'Попытка не найдена');
    const row=db.prepare('SELECT * FROM learn_attempts WHERE id=? AND user_id=?').get(raw,u.id);
    if(!row)fail(404,'Попытка не найдена');permission(row,u);return row;
  }
  function view(row) {
    return {id:wireId(row.id),testId:row.test_id.startsWith('bot-')?row.test_id.slice(4):row.test_id,title:row.title,questions:publicQuestions(parse(row.snapshot)),answers:parse(row.answers),questionIndex:row.question_index,revision:row.revision,...(row.result?{result:parse(row.result)}:{})};
  }
  function insertAttempt(u,key,title,questions,{id=randomUUID().replaceAll('-',''),answers,questionIndex=0,revision=0,result=null,created=clock(),updated=clock(),origin='website'}={}) {
    validateSnapshot(questions);answers=answers||questions.map(q=>q.type==='order'?q.options.map((_,i)=>i):null);
    grade(questions,answers);
    if(!Number.isSafeInteger(questionIndex)||questionIndex<0||questionIndex>=questions.length||!Number.isSafeInteger(revision)||revision<0||!Number.isSafeInteger(created)||created<0||!Number.isSafeInteger(updated)||updated<0)fail(400,'Некорректный прогресс');
    db.prepare('INSERT OR IGNORE INTO learn_attempts VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(id,u.id,key,title,JSON.stringify(questions),JSON.stringify(answers),questionIndex,revision,result?JSON.stringify(result):null,created,updated,origin);
    const saved=db.prepare('SELECT * FROM learn_attempts WHERE id=? AND user_id=?').get(id,u.id);
    if(!saved)fail(409,'Не удалось перенести попытку');return view(saved);
  }
  function create(u,key,input={},trusted=false) {
    let s;
    if(/^bot-[a-f0-9]{32}$/.test(key)&&trusted) {
      if(typeof input.title!=='string'||!input.title.trim()||input.title.length>160)fail(400,'Некорректное название');
      s={title:input.title,questions:validateSnapshot(input.questions)};
    } else s=source(key,u);
    const existing=db.prepare('SELECT * FROM learn_attempts WHERE user_id=? AND test_id=? AND result IS NULL ORDER BY updated DESC LIMIT 1').get(u.id,key);
    if(existing)return view(existing);
    return insertAttempt(u,key,s.title,prepared(s.questions),{origin:trusted?'telegram':'website'});
  }
  function rewardQuiz(u,q,answer,attemptId) {
    if(!q.quizId||!Number.isInteger(answer))return 0;
    const quiz=db.prepare('SELECT * FROM course_quizzes WHERE id=?').get(q.quizId);
    if(!quiz)return 0;
    // A changed question must never award XP based on an obsolete answer key.
    const current=normalize(quiz);const same=current.question===q.question&&JSON.stringify(current.options)===JSON.stringify(q.options)&&current.correct===q.correct;
    const correct=same&&answer===current.correct;
    let xp=0;
    if(correct) {
      const saved=db.prepare('INSERT OR IGNORE INTO learn_quiz_rewards VALUES (?,?,?)').run(u.id,quiz.id,Number(quiz.xp_reward||0));
      if(saved.changes)xp=Number(quiz.xp_reward||0);
    }
    const saved=db.prepare('INSERT INTO quiz_attempts(user_id,quiz_id,answer_index,correct,xp_earned) VALUES (?,?,?,?,?)').run(u.id,quiz.id,answer,correct?1:0,xp);
    db.prepare('INSERT INTO learn_legacy_quiz_links VALUES (?,?)').run(Number(saved.lastInsertRowid),attemptId);
    return xp;
  }
  function addXp(id,xp) {
    if(xp)db.prepare('INSERT INTO user_xp(user_id,total_xp) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET total_xp=total_xp+?,updated_at=CURRENT_TIMESTAMP').run(id,xp,xp);
  }
  function attempt(u,id,action,method,input={}) {
    const a=rowFor(id,u);const snapshot=parse(a.snapshot);
    if(!action&&method==='GET')return view(a);
    if(action==='save'&&method==='PUT') {
      if(a.result)fail(409,'Тренировка уже завершена');grade(snapshot,input.answers);
      if(!Number.isInteger(input.questionIndex)||input.questionIndex<0||input.questionIndex>=snapshot.length||!Number.isSafeInteger(input.revision)||input.revision<0)fail(400,'Некорректный прогресс');
      const saved=db.prepare('UPDATE learn_attempts SET answers=?,question_index=?,revision=revision+1,updated=? WHERE id=? AND user_id=? AND revision=? AND result IS NULL').run(JSON.stringify(input.answers),input.questionIndex,clock(),a.id,u.id,input.revision);
      if(!saved.changes)fail(409,'Тренировка изменена в другом окне. Загрузите общую версию');return {revision:input.revision+1};
    }
    if(action==='submit'&&method==='POST') {
      if(a.result)return parse(a.result);
      if(!Number.isSafeInteger(input.revision)||input.revision!==a.revision)fail(409,'Тренировка изменена в другом окне. Загрузите общую версию');
      const result=grade(snapshot,input.answers);
      return db.transaction(()=>{
        const saved=db.prepare('UPDATE learn_attempts SET result=?,answers=?,revision=revision+1,updated=? WHERE id=? AND user_id=? AND revision=? AND result IS NULL').run(JSON.stringify(result),JSON.stringify(input.answers),clock(),a.id,u.id,input.revision);
        if(!saved.changes) {
          const current=db.prepare('SELECT result FROM learn_attempts WHERE id=? AND user_id=?').get(a.id,u.id);
          if(current?.result)return parse(current.result);fail(409,'Тренировка изменена в другом окне. Загрузите общую версию');
        }
        if(a.test_id.startsWith('lesson-'))addXp(u.id,snapshot.reduce((xp,q,i)=>xp+rewardQuiz(u,q,input.answers[i],a.id),0));
        return result;
      })();
    }
    if(action==='retry'&&method==='POST') {
      if(!a.result||!['all','errors'].includes(input.mode))fail(400,'Сначала завершите тренировку');
      if(parse(a.result).canRetry===false)fail(400,'В старом результате нет исходных вопросов. Откройте тест урока');
      const rows=input.mode==='errors'?parse(a.result).review.filter(q=>!q.isCorrect).map(({answer,isCorrect,...q})=>q):snapshot;
      if(!rows.length)fail(400,'Ошибок для повторения нет');return insertAttempt(u,a.test_id,a.title,prepared(rows),{origin:a.origin});
    }
    fail(404,'Маршрут не найден');
  }
  function importAttempt(u,input) {
    if(!/^[a-f0-9]{32}$/.test(input.id)||!(/^(site|lesson)-[1-9]\d{0,9}$/.test(input.testId)||/^bot-[a-f0-9]{32}$/.test(input.testId))||typeof input.title!=='string'||input.title.length>160)fail(400,'Некорректная попытка');
    const questions=validateSnapshot(input.questions);const answers=input.answers;
    const result=input.finished?grade(questions,answers):null;
    return insertAttempt(u,input.testId,input.title,questions,{id:input.id,answers,questionIndex:input.questionIndex||0,revision:input.revision||0,result,created:input.created??0,updated:input.updated??0,origin:'telegram-import'});
  }
  function importLegacy(u) {
    const rows=db.prepare(`SELECT a.*,q.question,q.options,q.correct_index,q.lesson_id,l.title FROM quiz_attempts a JOIN course_quizzes q ON q.id=a.quiz_id JOIN course_lessons l ON l.id=q.lesson_id LEFT JOIN learn_legacy_quiz_links x ON x.legacy_id=a.id WHERE a.user_id=? AND x.legacy_id IS NULL ORDER BY a.id LIMIT 50`).all(u.id);
    db.transaction(()=>{for(const a of rows) {
      const q={question:'Исторический результат сайта',options:['Верно','Неверно'],correct:0,type:'single',explanation:''};const answers=[null];
      // Old website records contain a verdict without a question snapshot.
      const result={correct:a.correct?1:0,total:1,review:[],canRetry:false,note:'Сайт сохранил эту оценку без исходного снимка вопросов. Для новой тренировки откройте тест урока.'};
      const date=String(a.created_at||'');const time=Date.parse(date.endsWith('Z')?date:date.replace(' ','T')+'Z')||0;
      const id='legacyquiz-'+a.id;
      insertAttempt(u,'lesson-'+a.lesson_id,a.title+' · вопрос',[q],{id,answers,result,created:time,updated:time,origin:'website-legacy'});
      db.prepare('INSERT OR IGNORE INTO learn_legacy_quiz_links VALUES (?,?)').run(a.id,id);
    }})();
    return rows.length===50;
  }
  function personalCourse(u,key) {
    const c=db.prepare('SELECT * FROM learn_personal_courses WHERE user_id=? AND course_key=?').get(u.id,key);
    if(!c)fail(404,'Курс не найден');
    return {id:key,title:c.title,description:c.description,lessons:parse(c.lessons),completed:db.prepare('SELECT lesson FROM learn_personal_progress WHERE user_id=? AND course_key=? ORDER BY lesson').all(u.id,key).map(r=>r.lesson),mine:false,published:false,count:parse(c.lessons).length};
  }
  function importCourse(u,b) {
    if(!/^bot-[a-f0-9]{32}$/.test(b.id)||typeof b.title!=='string'||b.title.length>160||typeof b.description!=='string'||b.description.length>1000||!Array.isArray(b.lessons)||!b.lessons.length||b.lessons.length>30||b.lessons.some(l=>typeof l.title!=='string'||typeof l.content!=='string'||l.content.length>15000)||!Array.isArray(b.completed)||b.completed.some(i=>!Number.isInteger(i)||i<0||i>=b.lessons.length))fail(400,'Некорректный курс');
    db.transaction(()=>{
      db.prepare('INSERT OR IGNORE INTO learn_personal_courses VALUES (?,?,?,?,?)').run(u.id,b.id,b.title,b.description,JSON.stringify(b.lessons));
      for(const i of b.completed)db.prepare('INSERT OR IGNORE INTO learn_personal_progress VALUES (?,?,?)').run(u.id,b.id,i);
    })();return personalCourse(u,b.id);
  }
  function completeLesson(u,lessonId) {
    const l=db.prepare('SELECT id,course_id,xp_reward FROM course_lessons WHERE id=?').get(lessonId);
    if(!l)fail(404,'Урок не найден');const c=courseAccess(l.course_id,u);
    return db.transaction(()=>{
      if(!Number(c.price)) {
        const saved=db.prepare("INSERT OR IGNORE INTO course_enrollments(course_id,user_id,amount_paid,payment_status) VALUES (?,?,0,'free')").run(c.id,u.id);
        if(saved.changes)db.prepare('UPDATE courses SET students_count=students_count+1 WHERE id=?').run(c.id);
      }
      const done=db.prepare('INSERT OR IGNORE INTO lesson_progress(user_id,lesson_id) VALUES (?,?)').run(u.id,l.id);
      const xp=done.changes?Number(l.xp_reward||0):0;addXp(u.id,xp);return {ok:true,xp,already:!done.changes};
    })();
  }
  function legacyQuiz(u,lessonId,input) {
    const s=source('lesson-'+lessonId,u);if(!input.answers||typeof input.answers!=='object')fail(400,'Нет ответов');
    if(input.requestId!==undefined&&!/^[a-f0-9-]{32,36}$/.test(input.requestId))fail(400,'Некорректный идентификатор отправки');
    const id=input.requestId?createHash('sha256').update(`${u.id}:${lessonId}:${input.requestId}`).digest('hex').slice(0,32):undefined;
    const a=insertAttempt(u,'lesson-'+lessonId,s.title,s.questions,{id,origin:'website'});
    const answers=s.questions.map(q=>input.answers[q.quizId]??null);
    const before=db.prepare('SELECT total_xp FROM user_xp WHERE user_id=?').get(u.id)?.total_xp||0;
    const result=attempt(u,a.id,'submit','POST',{answers,revision:a.revision});
    const results={};for(const q of result.review)results[q.quizId]={correct:q.isCorrect,correctIndex:q.correct,xpEarned:0};
    const after=db.prepare('SELECT total_xp FROM user_xp WHERE user_id=?').get(u.id)?.total_xp||0;
    return {ok:true,results,totalXp:after-before,allCorrect:result.correct===result.total,attemptId:a.id};
  }
  function summary(u) {
    const migrationPending=importLegacy(u);
    const stats=db.prepare("SELECT COUNT(*) AS completed,COALESCE(SUM(json_extract(result,'$.correct')),0) AS correct,COALESCE(SUM(json_extract(result,'$.total')),0) AS total FROM learn_attempts WHERE user_id=? AND result IS NOT NULL").get(u.id);
    stats.lessons=db.prepare('SELECT COUNT(*) AS n FROM lesson_progress WHERE user_id=?').get(u.id).n+db.prepare('SELECT COUNT(*) AS n FROM learn_personal_progress WHERE user_id=?').get(u.id).n;
    stats.duels=db.prepare('SELECT COUNT(*) AS n FROM learn_duel_history WHERE user_id=?').get(u.id).n;
    stats.xp=db.prepare('SELECT total_xp FROM user_xp WHERE user_id=?').get(u.id)?.total_xp||0;
    const map=a=>({id:wireId(a.id),testId:a.test_id.startsWith('bot-')?a.test_id.slice(4):a.test_id,title:a.title,updated:a.updated||null,total:parse(a.snapshot).length,...(a.result?{correct:parse(a.result).correct}:{answered:parse(a.answers).filter(a=>a!==null&&(!Array.isArray(a)||a.length)).length})});
    const active=db.prepare('SELECT * FROM learn_attempts WHERE user_id=? AND result IS NULL ORDER BY updated DESC,id DESC LIMIT 20').all(u.id).map(map);
    const recent=db.prepare('SELECT * FROM learn_attempts WHERE user_id=? AND result IS NOT NULL ORDER BY updated DESC,id DESC LIMIT 50').all(u.id).map(map);
    const courses=db.prepare(`SELECT c.id,c.title,COUNT(DISTINCT p.lesson_id) AS completed,(SELECT COUNT(*) FROM course_lessons WHERE course_id=c.id) AS total FROM lesson_progress p JOIN course_lessons l ON l.id=p.lesson_id JOIN courses c ON c.id=l.course_id WHERE p.user_id=? GROUP BY c.id ORDER BY c.id DESC`).all(u.id).map(c=>({...c,id:'site-'+c.id}));
    for(const c of db.prepare('SELECT * FROM learn_personal_courses WHERE user_id=?').all(u.id))courses.push({id:c.course_key,title:c.title,completed:db.prepare('SELECT COUNT(*) AS n FROM learn_personal_progress WHERE user_id=? AND course_key=?').get(u.id,c.course_key).n,total:parse(c.lessons).length});
    const duels=db.prepare('SELECT duel_id AS id,title,opponent,score,correct,total,finished AS updated FROM learn_duel_history WHERE user_id=? ORDER BY finished DESC LIMIT 20').all(u.id);
    return {stats,active,recent,courses,duels,shared:true,migrationPending};
  }
  function handle(userId,method,path,input={},trusted=false) {
    const u=user(userId);
    if(method==='GET'&&path==='/summary')return summary(u);
    const preview=path.match(/^\/tests\/((?:site|lesson)-[1-9]\d{0,9})$/);
    if(preview&&method==='GET') {const s=source(preview[1],u);return {title:s.title,count:s.questions.length};}
    if(trusted&&method==='POST'&&path==='/import')return importAttempt(u,input);
    if(trusted&&method==='POST'&&path==='/courses/import')return importCourse(u,input);
    if(trusted&&method==='POST'&&path==='/duels/import') {
      if(!/^[a-f0-9]{32}$/.test(input.id)||typeof input.title!=='string'||typeof input.opponent!=='string'||!Number.isInteger(input.total)||input.total<1||input.total>10||!Number.isInteger(input.correct)||input.correct<0||input.correct>input.total||!Number.isInteger(input.score)||input.score<0||input.score>input.total*1150||!Number.isSafeInteger(input.updated)||input.updated<0||input.updated>clock()+30000)fail(400,'Некорректный результат дуэли');
      db.prepare('INSERT OR IGNORE INTO learn_duel_history VALUES (?,?,?,?,?,?,?,?)').run(u.id,input.id,input.title.slice(0,160),input.opponent.slice(0,80),input.score,input.correct,input.total,input.updated);return {ok:true};
    }
    const start=path.match(/^\/tests\/((?:site|lesson)-[1-9]\d{0,9}|bot-[a-f0-9]{32})\/attempts$/);
    if(start&&method==='POST')return create(u,start[1],input,trusted);
    const a=path.match(/^\/attempts\/(shared-[a-z0-9-]{1,64})(?:\/(save|submit|retry))?$/);
    if(a)return attempt(u,a[1],a[2],method,input);
    const course=path.match(/^\/courses\/(bot-[a-f0-9]{32})(?:\/(complete))?$/);
    if(course) {
      const c=personalCourse(u,course[1]);
      if(method==='GET'&&!course[2])return c;
      if(method==='POST'&&course[2]==='complete') {
        if(!Number.isInteger(input.lesson)||!c.lessons[input.lesson])fail(400,'Урок не найден');
        db.prepare('INSERT OR IGNORE INTO learn_personal_progress VALUES (?,?,?)').run(u.id,course[1],input.lesson);return {ok:true};
      }
    }
    fail(404,'Маршрут не найден');
  }
  return {handle,completeLesson:(id,lesson)=>completeLesson(user(id),lesson),legacyQuiz:(id,lesson,b)=>legacyQuiz(user(id),lesson,b)};
};
module.exports.normalize=normalize;
module.exports.grade=grade;
