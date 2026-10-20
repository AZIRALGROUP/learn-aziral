// Installed in the existing Aziral API. Uses its libSQL connection so writes
// follow the same Turso primary as the website. No credentials are returned.
const { timingSafeEqual } = require('node:crypto');

module.exports = function createLearnBridge({ db, secret = process.env.LEARN_BRIDGE_SECRET }) {
  db.exec(`CREATE TABLE IF NOT EXISTS learn_test_categories (test_id INTEGER PRIMARY KEY REFERENCES tests(id) ON DELETE CASCADE, category TEXT NOT NULL DEFAULT 'study');
    CREATE TABLE IF NOT EXISTS learn_test_imports (telegram_id TEXT NOT NULL, source_id TEXT NOT NULL, test_id INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE, PRIMARY KEY(telegram_id,source_id));
    CREATE TABLE IF NOT EXISTS learn_question_explanations (question_id INTEGER PRIMARY KEY REFERENCES test_questions(id) ON DELETE CASCADE, explanation TEXT NOT NULL);`);
  function fail(status, message) { const e = new Error(message); e.status = status; throw e; }
  function userFor(id) {
    const u = db.prepare('SELECT id,name,role,banned FROM users WHERE telegram_id = ?').get(id);
    if (u?.banned) fail(403, 'Аккаунт сайта заблокирован');
    return u || null;
  }
  function courseFor(id, user) {
    const c = db.prepare('SELECT id,instructor_id,title,description,price,category,status FROM courses WHERE id = ?').get(id);
    if (!c || (c.status !== 'approved' && c.instructor_id !== user?.id && user?.role !== 'admin')) fail(404, 'Курс не найден');
    const privileged = user && (user.role === 'admin' || c.instructor_id === user.id);
    const enrollment = user && db.prepare("SELECT id FROM course_enrollments WHERE course_id=? AND user_id=? AND payment_status IN ('free','confirmed')").get(c.id, user.id);
    return { course: c, allowed: Number(c.price || 0) === 0 || !!privileged || !!enrollment };
  }
  function requireCourse(id, user) {
    const access = courseFor(id, user);
    if (!access.allowed) fail(403, 'Доступ к платному курсу проверяется по аккаунту сайта. Привяжите Telegram в профиле сайта');
    return access.course;
  }
  async function body(req) {
    if (req.body !== undefined) return req.body;
    let text = '';
    for await (const chunk of req) { text += chunk; if (text.length > 256000) fail(413, 'Слишком большой запрос'); }
    try { return JSON.parse(text || '{}'); } catch { fail(400, 'Некорректный JSON'); }
  }
  return async function learnBridge(req, res) {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    try {
      const supplied = req.headers['x-learn-bridge-secret'];
      if (!secret || secret.length < 32 || typeof supplied !== 'string' || Buffer.byteLength(supplied) !== Buffer.byteLength(secret) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(secret))) fail(404, 'Не найдено');
      const tgId = req.headers['x-learn-telegram-id'];
      if (typeof tgId !== 'string' || !/^[1-9]\d{0,15}$/.test(tgId)) fail(400, 'Некорректный Telegram ID');
      const user = userFor(tgId);
      const url = new URL(req.url, 'http://localhost');
      const path = url.pathname;
      let result;
      if (req.method === 'GET' && path === '/account') {
        result = { linked: !!user, user: user ? { id: user.id, name: user.name } : null };
      } else if (req.method === 'POST' && path === '/account/link') {
        const input = await body(req);
        if (!Number.isSafeInteger(input.siteUserId) || input.siteUserId < 1) fail(400, 'Некорректный аккаунт');
        result = db.transaction(() => {
          const target = db.prepare('SELECT id,name,banned,telegram_id FROM users WHERE id=?').get(input.siteUserId);
          if (!target || target.banned) fail(403, 'Аккаунт недоступен');
          if ((user && user.id !== target.id) || (target.telegram_id && String(target.telegram_id) !== tgId)) fail(409, 'Аккаунт уже связан с другим Telegram. Изменить привязку можно в профиле сайта');
          db.prepare('UPDATE users SET telegram_id=? WHERE id=?').run(tgId, target.id);
          return { linked: true, user: { id: target.id, name: target.name } };
        })();
      } else if (req.method === 'GET' && path === '/catalog') {
        const mine = url.searchParams.get('mine') === 'true';
        result = {
          tests: db.prepare(`SELECT t.id,t.title,t.category AS subject,COALESCE(l.category,'study') AS category,t.instructor_id,t.status,(SELECT COUNT(*) FROM test_questions WHERE test_id=t.id) AS count FROM tests t LEFT JOIN learn_test_categories l ON l.test_id=t.id WHERE ${mine ? 't.instructor_id=?' : "(t.status='published' OR t.instructor_id=?)"} ORDER BY t.updated_at DESC`).all(user?.id || -1).map(t => ({ ...t, mine: t.instructor_id === user?.id, published: t.status === 'published' })),
          courses: db.prepare(`SELECT c.id,c.title,c.description,c.price,c.category AS subject,c.instructor_id,c.status,(SELECT COUNT(*) FROM course_lessons WHERE course_id=c.id) AS count FROM courses c WHERE ${mine ? 'c.instructor_id=?' : "(c.status='approved' OR c.instructor_id=?)"} ORDER BY c.created_at DESC`).all(user?.id || -1).map(c => ({ ...c, mine: c.instructor_id === user?.id, published: c.status === 'approved' })),
        };
      } else if ((req.method === 'POST' && path === '/tests') || (['PUT','PATCH'].includes(req.method) && /^\/tests\/[1-9]\d*(?:\/publish)?$/.test(path))) {
        if (!user) fail(409, 'Сначала подключите аккаунт сайта');
        const input = await body(req);
        const id = path === '/tests' ? null : Number(path.split('/')[2]);
        if (id && db.prepare('SELECT instructor_id FROM tests WHERE id=?').get(id)?.instructor_id !== user.id) fail(403, 'Редактировать может только автор');
        if (path.endsWith('/publish')) {
          if (typeof input.published !== 'boolean') fail(400, 'Укажите статус публикации');
          db.prepare('UPDATE tests SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(input.published ? 'published' : 'draft',id);
          result = { id, published: input.published };
        } else {
          const category = input.category || 'study';
          if (!['study','games','movies','science','world','music','sport','mixed'].includes(category) || typeof input.title !== 'string' || input.title.trim().length < 3 || input.title.length > 160 || typeof input.subject !== 'string' || input.subject.length > 80 || !Array.isArray(input.questions) || !input.questions.length || input.questions.length > 30) fail(400, 'Некорректный тест');
          for (const q of input.questions) {
            if (!q || typeof q.question !== 'string' || !q.question.trim() || q.question.length > 1500 || !Array.isArray(q.options) || q.options.length < 2 || q.options.length > 6 || q.options.some(o => typeof o !== 'string' || !o.trim() || o.length > 500) || new Set(q.options.map(o => o.trim().toLowerCase())).size !== q.options.length || !Number.isInteger(q.correct) || q.correct < 0 || q.correct >= q.options.length) fail(400, 'Некорректные вопросы');
          }
          result = db.transaction(() => {
            if (input.sourceId) {
              if (!/^[a-f0-9]{32}$/.test(input.sourceId)) fail(400, 'Некорректный источник');
              const imported = db.prepare('SELECT test_id FROM learn_test_imports WHERE telegram_id=? AND source_id=?').get(tgId,input.sourceId);
              if (imported) return { id: imported.test_id };
            }
            if (!id && db.prepare('SELECT COUNT(*) AS n FROM tests WHERE instructor_id=?').get(user.id).n >= 200) fail(400, 'Достигнут лимит: 200 материалов');
            const testId = id || Number(db.prepare("INSERT INTO tests(instructor_id,title,category,status) VALUES (?,?,?,'draft')").run(user.id,input.title.trim(),input.subject.trim()).lastInsertRowid);
            if (id) {
              db.prepare('UPDATE tests SET title=?,category=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(input.title.trim(),input.subject.trim(),id);
              db.prepare('DELETE FROM learn_question_explanations WHERE question_id IN (SELECT id FROM test_questions WHERE test_id=?)').run(id);
              db.prepare('DELETE FROM test_questions WHERE test_id=?').run(id);
            }
            input.questions.forEach((q,i) => {
              const questionId = Number(db.prepare("INSERT INTO test_questions(test_id,question,type,options,correct,order_num) VALUES (?,?,'single',?,?,?)").run(testId,q.question.trim(),JSON.stringify(q.options.map(o=>o.trim())),JSON.stringify([q.correct]),i).lastInsertRowid);
              const explanation = typeof q.explanation === 'string' ? q.explanation.slice(0,2000) : '';
              if (explanation) db.prepare('INSERT INTO learn_question_explanations VALUES (?,?)').run(questionId,explanation);
            });
            db.prepare('INSERT INTO learn_test_categories VALUES (?,?) ON CONFLICT(test_id) DO UPDATE SET category=excluded.category').run(testId,category);
            if (input.sourceId) db.prepare('INSERT INTO learn_test_imports VALUES (?,?,?)').run(tgId,input.sourceId,testId);
            return { id: testId };
          })();
        }
      } else if (req.method === 'GET' && /^\/tests\/[1-9]\d*$/.test(path)) {
        const id = Number(path.split('/')[2]);
        const test = db.prepare("SELECT t.id,t.title,t.category AS subject,COALESCE(l.category,'study') AS category,t.instructor_id,t.status FROM tests t LEFT JOIN learn_test_categories l ON l.test_id=t.id WHERE t.id=? AND (t.status='published' OR t.instructor_id=?)").get(id,user?.id || -1);
        if (!test) fail(404, 'Тест не найден');
        result = { ...test, mine: test.instructor_id === user?.id, published: test.status === 'published', questions: db.prepare('SELECT q.id,q.question,q.type,q.options,q.items,q.correct,COALESCE(e.explanation,\'\') AS explanation FROM test_questions q LEFT JOIN learn_question_explanations e ON e.question_id=q.id WHERE q.test_id=? ORDER BY q.order_num,q.id').all(id) };
      } else if (req.method === 'GET' && /^\/courses\/[1-9]\d*$/.test(path)) {
        const { course, allowed } = courseFor(Number(path.split('/')[2]), user);
        const lessons = db.prepare(`SELECT id,title,type,${allowed ? 'content,video_url,task_description,task_starter_code,' : ''} (SELECT COUNT(*) FROM course_quizzes WHERE lesson_id=course_lessons.id) AS quizCount FROM course_lessons WHERE course_id=? ORDER BY order_num,id`).all(course.id);
        const done = user ? new Set(db.prepare('SELECT lesson_id FROM lesson_progress WHERE user_id=? AND lesson_id IN (SELECT id FROM course_lessons WHERE course_id=?)').all(user.id, course.id).map(r => r.lesson_id)) : new Set();
        result = { ...course, locked: !allowed, linked: !!user, lessons, completed: lessons.map((l, i) => done.has(l.id) ? i : -1).filter(i => i >= 0) };
      } else if (req.method === 'GET' && /^\/lessons\/[1-9]\d*\/quiz$/.test(path)) {
        const lesson = db.prepare('SELECT id,course_id,title FROM course_lessons WHERE id=?').get(Number(path.split('/')[2]));
        if (!lesson) fail(404, 'Урок не найден');
        requireCourse(lesson.course_id, user);
        result = { id: lesson.id, title: lesson.title, questions: db.prepare('SELECT id,question,options,correct_index FROM course_quizzes WHERE lesson_id=? ORDER BY order_num,id').all(lesson.id) };
      } else if (req.method === 'POST' && /^\/courses\/[1-9]\d*\/complete$/.test(path)) {
        if (!user) fail(409, 'Привяжите Telegram в профиле сайта для общего прогресса');
        const course = requireCourse(Number(path.split('/')[2]), user);
        const input = await body(req);
        const lesson = db.prepare('SELECT id,xp_reward FROM course_lessons WHERE id=? AND course_id=?').get(input?.lessonId, course.id);
        if (!lesson) fail(404, 'Урок не найден');
        const save = db.transaction(() => {
          if (!Number(course.price)) {
            const e = db.prepare("INSERT OR IGNORE INTO course_enrollments (course_id,user_id,amount_paid,payment_status) VALUES (?,?,0,'free')").run(course.id, user.id);
            if (e.changes) db.prepare('UPDATE courses SET students_count=students_count+1 WHERE id=?').run(course.id);
          }
          const saved = db.prepare('INSERT OR IGNORE INTO lesson_progress (user_id,lesson_id) VALUES (?,?)').run(user.id, lesson.id);
          const xp = saved.changes ? Number(lesson.xp_reward || 0) : 0;
          if (xp) db.prepare('INSERT INTO user_xp (user_id,total_xp) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET total_xp=total_xp+?,updated_at=CURRENT_TIMESTAMP').run(user.id, xp, xp);
          return { ok: true, xp };
        });
        result = save();
      } else fail(404, 'Маршрут не найден');
      res.end(JSON.stringify(result));
    } catch (e) { res.statusCode = e.status || 500; res.end(JSON.stringify({ error: e.status ? e.message : 'Ошибка подключения к сайту' })); }
  };
};
