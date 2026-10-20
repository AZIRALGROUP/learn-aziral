import { createHash } from 'node:crypto';
import { ApiError } from './auth.mjs';
import { duelView } from './store.mjs';

export function createLearningSync(db,site,clock=Date.now) {
  const transfers=new Map();
  async function ensureAttempt(userId,id) {
    const key=userId+':'+id;
    if(transfers.has(key))return transfers.get(key);
    const promise=(async()=>{
      let transfer=db.prepare('SELECT * FROM learning_transfers WHERE attempt_id=? AND user_id=?').get(id,userId);
      if(transfer?.shared_id)return transfer.shared_id;
      if(!transfer) {
        const a=db.prepare('SELECT a.*,d.title,d.created,d.updated,d.answers,d.question_index,d.revision FROM attempts a LEFT JOIN attempt_details d ON d.attempt_id=a.id WHERE a.id=? AND a.user_id=?').get(id,userId);
        if(!a)throw new ApiError(404,'Попытка не найдена');
        const oldResult=a.result?JSON.parse(a.result):null;
        const questions=JSON.parse(a.snapshot);
        const mapped=db.prepare('SELECT site_id FROM site_test_links WHERE local_id=?').get(a.test_id)?.site_id;
        const testId=mapped||(/^(site|lesson)-/.test(a.test_id)?a.test_id:'bot-'+a.test_id);
        const title=a.title||db.prepare('SELECT title FROM tests WHERE id=?').get(a.test_id)?.title||'Тренировка';
        const answers=oldResult?.review?.map(q=>q.answer) || (a.answers?JSON.parse(a.answers):questions.map(()=>null));
        const payload=JSON.stringify({id,testId,title,questions,answers,finished:!!a.result,created:a.created||0,updated:a.updated||0,questionIndex:a.question_index||0,revision:a.revision||0});
        // Freeze the local draft before the first network request. An uncertain
        // import is retried with exactly this payload, never over newer shared data.
        db.prepare('INSERT OR IGNORE INTO learning_transfers VALUES (?,?,?,NULL)').run(id,userId,payload);
        transfer=db.prepare('SELECT * FROM learning_transfers WHERE attempt_id=? AND user_id=?').get(id,userId);
      }
      const result=await site.learning(userId,'/import','POST',JSON.parse(transfer.payload));
      if(result.id!=='shared-'+id)throw new ApiError(502,'Сайт вернул другую попытку');
      db.prepare('UPDATE learning_transfers SET shared_id=? WHERE attempt_id=? AND user_id=?').run(result.id,id,userId);
      return result.id;
    })();
    transfers.set(key,promise);
    try{return await promise;}finally{transfers.delete(key);}
  }
  async function ensureCourse(userId,row,read=true) {
    const completed=db.prepare('SELECT lesson FROM progress WHERE user_id=? AND course_id=? ORDER BY lesson').all(userId,row.id).map(r=>r.lesson);
    const payload={id:'bot-'+row.id,title:row.title,description:row.description||'',lessons:JSON.parse(row.lessons),completed};
    const digest=createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    const old=db.prepare('SELECT digest FROM learning_course_exports WHERE user_id=? AND course_id=?').get(userId,row.id);
    const changed=old?.digest!==digest;
    if(changed) {
      await site.learning(userId,'/courses/import','POST',payload);
      db.prepare('INSERT INTO learning_course_exports VALUES (?,?,?) ON CONFLICT(user_id,course_id) DO UPDATE SET digest=excluded.digest').run(userId,row.id,digest);
    }
    return read?site.learning(userId,'/courses/bot-'+row.id):changed;
  }
  const syncing=new Map();
  async function syncUser(userId,limit=25) {
    if(syncing.has(userId))return syncing.get(userId);
    const promise=(async()=>{
      const attempts=db.prepare('SELECT a.id FROM attempts a LEFT JOIN learning_transfers t ON t.attempt_id=a.id WHERE a.user_id=? AND t.shared_id IS NULL ORDER BY a.rowid LIMIT ?').all(userId,limit);
      for(const a of attempts)await ensureAttempt(userId,a.id);
      const progress=db.prepare('SELECT p.* FROM progress p LEFT JOIN learning_progress_exports e ON e.user_id=p.user_id AND e.course_id=p.course_id AND e.lesson=p.lesson WHERE p.user_id=? AND p.course_id LIKE \'site-%\' AND e.user_id IS NULL').all(userId);
      let blocked=0;let exported=0;
      const siteCourses=new Map();
      for(const p of progress) {
        try {
          if(!siteCourses.has(p.course_id))siteCourses.set(p.course_id,await site.course(userId,p.course_id));
          const c=siteCourses.get(p.course_id);const index=c.lessons.findIndex(l=>l.id===p.lesson);
          if(index<0)throw new ApiError(404,'Урок больше недоступен');
          if(c.locked&&!c.completed.includes(index))throw new ApiError(403,'Доступ к уроку закрыт');
          if(!c.completed.includes(index))await site.complete(userId,p.course_id,p.lesson);
          db.prepare('INSERT OR IGNORE INTO learning_progress_exports VALUES (?,?,?)').run(userId,p.course_id,p.lesson);
          if(++exported>=limit)break;
        } catch(e) {if(e instanceof ApiError&&[403,404].includes(e.status))blocked++;else throw e;}
      }
      const courses=db.prepare('SELECT DISTINCT c.* FROM courses c JOIN progress p ON p.course_id=c.id WHERE p.user_id=?').all(userId);
      let changedCourses=0;
      for(const c of courses) {if(await ensureCourse(userId,c,false))changedCourses++;if(changedCourses>=limit)break;}
      const duels=db.prepare('SELECT d.id FROM duels d LEFT JOIN learning_duel_exports e ON e.duel_id=d.id AND e.user_id=? WHERE (d.host=? OR d.guest=?) AND d.start_at IS NOT NULL AND d.start_at+json_array_length(d.snapshot)*15000<=? AND e.duel_id IS NULL LIMIT ?').all(userId,userId,userId,clock(),limit);
      for(const row of duels) {
        const d=duelView(db,row.id,userId,clock());const own=d.results.find(p=>p.id===userId);const opponent=d.results.find(p=>p.id!==userId);
        await site.learning(userId,'/duels/import','POST',{id:d.id,title:d.title,opponent:opponent.name,score:own.score,correct:own.correct,total:d.total,updated:d.startAt+d.total*15000});
        db.prepare('INSERT OR IGNORE INTO learning_duel_exports VALUES (?,?)').run(userId,d.id);
      }
      return {more:attempts.length===limit||exported===limit||duels.length===limit||changedCourses===limit,blocked};
    })();
    syncing.set(userId,promise);try{return await promise;}finally{syncing.delete(userId);}
  }
  let cursor=0;let running=false;
  async function background() {
    if(running||!site)return;running=true;
    try {
      const users=db.prepare('SELECT DISTINCT user_id AS id FROM attempts UNION SELECT DISTINCT user_id AS id FROM progress UNION SELECT host AS id FROM duels UNION SELECT guest AS id FROM duels WHERE guest IS NOT NULL').all().filter(u=>/^[1-9]\d{0,15}$/.test(u.id));
      for(let i=0;i<Math.min(10,users.length);i++) {
        const u=users[cursor++%users.length];
        try{if((await site.account(u.id)).linked)await syncUser(u.id,5);}catch{/* Local data and pending transfers remain available for a later retry. */}
      }
    }finally{running=false;}
  }
  return {ensureAttempt,ensureCourse,syncUser,background};
}
