// Installed in the existing Aziral API. Uses its libSQL connection so writes
// follow the same Turso primary as the website. No credentials are returned.
const { timingSafeEqual } = require('node:crypto');

module.exports = function createLearnBridge({ db, secret = process.env.LEARN_BRIDGE_SECRET }) {
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
    for await (const chunk of req) { text += chunk; if (text.length > 16384) fail(413, 'Слишком большой запрос'); }
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
      const path = new URL(req.url, 'http://localhost').pathname;
      let result;
      if (req.method === 'GET' && path === '/account') {
        result = { linked: !!user, user: user ? { id: user.id, name: user.name } : null };
      } else if (req.method === 'GET' && path === '/catalog') {
        result = {
          tests: db.prepare("SELECT t.id,t.title,t.category AS subject,(SELECT COUNT(*) FROM test_questions WHERE test_id=t.id) AS count FROM tests t WHERE status='published' ORDER BY updated_at DESC").all(),
          courses: db.prepare("SELECT c.id,c.title,c.description,c.price,c.category AS subject,(SELECT COUNT(*) FROM course_lessons WHERE course_id=c.id) AS count FROM courses c WHERE status='approved' ORDER BY created_at DESC").all(),
        };
      } else if (req.method === 'GET' && /^\/tests\/[1-9]\d*$/.test(path)) {
        const id = Number(path.split('/')[2]);
        const test = db.prepare("SELECT id,title,category AS subject FROM tests WHERE id=? AND status='published'").get(id);
        if (!test) fail(404, 'Тест не найден');
        result = { ...test, questions: db.prepare('SELECT id,question,type,options,items,correct FROM test_questions WHERE test_id=? ORDER BY order_num,id').all(id) };
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
