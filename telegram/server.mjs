import { createServer } from 'node:http';
import { existsSync, statSync, createReadStream } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ApiError, verifyInitData, sameSecret } from './auth.mjs';
import { openStore, newId, text, validateQuestions, accessible, publicQuestions, createDuel, duelView, validAnswer } from './store.mjs';
import { createGenerator } from './gemini.mjs';
import { miniLink, processUpdate, telegramCall } from './bot.mjs';
import { createSiteClient, isSiteId, isLessonId } from './site.mjs';
import { createAttempt, learningSummary, handleAttempt } from './learning.mjs';

export async function readJson(req) {
  let size = 0;
  const parts = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 256000) throw new ApiError(413, 'Слишком большой запрос');
    parts.push(chunk);
  }
  try {
    const parsed = JSON.parse(Buffer.concat(parts).toString('utf8') || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Not an object');
    return parsed;
  }
  catch { throw new ApiError(400, 'Некорректный JSON'); }
}

export function createApp({ env = process.env, db = openStore(env.TELEGRAM_DATABASE || undefined), clock = Date.now, fetcher = fetch } = {}) {
  if (env.TELEGRAM_DEV_MODE === 'true' && env.NODE_ENV === 'production') throw new Error('Dev mode is forbidden in production');
  const generate = createGenerator(db, env, fetcher, clock);
  const site = createSiteClient(env, fetcher);
  const rate = new Map();
  function upsert(user) { db.prepare('INSERT INTO users VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, username=excluded.username').run(user.id, user.name, user.username); }
  async function route(req, url) {
    const path = url.pathname.slice('/api/telegram'.length) || '/';
    const now = clock();
    if (path === '/health' && req.method === 'GET') return { ok: true };
    if (path === '/webhook' && req.method === 'POST') {
      if (!sameSecret(req.headers['x-telegram-bot-api-secret-token'], env.TELEGRAM_WEBHOOK_SECRET)) throw new ApiError(401, 'Неверная подпись webhook');
      await processUpdate(db, env, await readJson(req), now, (e, m, p) => telegramCall(e, m, p, fetcher));
      return { ok: true };
    }
    const loopback = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
    const dev = env.TELEGRAM_DEV_MODE === 'true' && loopback && !req.headers['x-telegram-init-data'];
    // Local preview identities are available only on a loopback-bound development server.
    const user = dev ? { id: 'dev-1', name: 'Локальный просмотр', username: null } : verifyInitData(req.headers['x-telegram-init-data'], env.TELEGRAM_BOT_TOKEN, now);
    upsert(user);
    const minute = Math.floor(now / 60000);
    const key = user.id;
    const usage = rate.get(key);
    const count = usage?.minute === minute ? usage.count + 1 : 1;
    rate.set(key, { minute, count });
    if (count > 180) throw new ApiError(429, 'Слишком много запросов. Подождите минуту');
    if (rate.size > 10000) for (const [id, v] of rate) if (v.minute < minute) rate.delete(id);
    if (path === '/me' && req.method === 'GET') {
      let account = null;
      let siteError = '';
      if (site && !dev) { try { account = await site.account(user.id); } catch (e) { siteError = e.message; } }
      return { user, dev, botUsername: env.TELEGRAM_BOT_USERNAME || '', aiAvailable: !!env.GEMINI_API_KEY && env.GEMINI_FREE_TIER_CONFIRMED === 'true', siteConnected: !!site, siteAccount: account, siteError };
    }
    if (path === '/ai/generate' && req.method === 'POST') return generate(user.id, await readJson(req));
    if (path === '/learning' && req.method === 'GET') return learningSummary(db, user.id, now);
    const attemptRoute = path.match(/^\/attempts\/([a-f0-9]{32})(?:\/(save|submit|retry))?$/);
    if (attemptRoute) return handleAttempt({ db, site, userId: user.id, id: attemptRoute[1], action: attemptRoute[2], method: req.method, body: req.method === 'GET' ? {} : await readJson(req), now });

    const collection = path.match(/^\/(tests|courses)$/);
    if (collection) {
      const table = collection[1];
      if (req.method === 'GET') {
        const mine = url.searchParams.get('mine') === 'true';
        const local = db.prepare(`SELECT * FROM ${table} WHERE ${mine ? 'owner = ?' : '(published = 1 OR owner = ?)'} ORDER BY created DESC LIMIT 200`).all(user.id).map(row => ({ id: row.id, title: row.title, subject: row.subject, description: row.description, mine: row.owner === user.id, published: !!row.published, count: JSON.parse(row.questions || row.lessons).length }));
        return site && !mine && !dev ? [...await site.catalog(user.id, table), ...local] : local;
      }
      if (req.method === 'POST') {
        const body = await readJson(req);
        const id = newId();
        const title = text(body.title, 'Название', 160, 3);
        const count = db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE owner=?`).get(user.id).n;
        if (count >= 200) throw new ApiError(400, 'Достигнут лимит: 200 материалов');
        if (table === 'tests') {
          const questions = validateQuestions(body.questions);
          db.prepare('INSERT INTO tests VALUES (?,?,?,?,?,?,?)').run(id, user.id, title, text(body.subject || '', 'Предмет', 80, 0), JSON.stringify(questions), 0, now);
        } else {
          const lessons = validateLessons(body.lessons);
          db.prepare('INSERT INTO courses VALUES (?,?,?,?,?,?,?)').run(id, user.id, title, text(body.description || '', 'Описание', 1000, 0), JSON.stringify(lessons), 0, now);
        }
        return { id };
      }
    }
    const material = path.match(/^\/(tests|courses)\/([a-f0-9]{32}|site-[1-9]\d{0,9}|lesson-[1-9]\d{0,9})(?:\/(edit|publish|complete|attempts))?$/);
    if (material) {
      const [, table, id, action] = material;
      const external = isSiteId(id) || isLessonId(id);
      if (external && !site) throw new ApiError(503, 'Сайт ещё не подключён');
      if (external && table === 'courses') {
        if (!isSiteId(id)) throw new ApiError(404, 'Курс не найден');
        const c = await site.course(user.id, id);
        if (req.method === 'GET' && !action) {
          const localIds = new Set(db.prepare('SELECT lesson FROM progress WHERE user_id=? AND course_id=?').all(user.id, id).map(r => r.lesson));
          const localDone = c.lessons.map((l, i) => localIds.has(l.id) ? i : -1).filter(i => i >= 0);
          return { ...c, completed: c.linked ? c.completed : localDone, lessons: c.lessons.map(l => ({ ...l, content: l.content || '' })) };
        }
        if (req.method === 'POST' && action === 'complete') {
          if (c.locked) throw new ApiError(403, 'Для этого курса нужен оплаченный доступ на сайте');
          const { lesson } = await readJson(req);
          if (!Number.isInteger(lesson) || !c.lessons[lesson]) throw new ApiError(400, 'Урок не найден');
          if (c.linked) await site.complete(user.id, id, c.lessons[lesson].id);
          db.prepare('INSERT OR IGNORE INTO progress VALUES (?,?,?)').run(user.id, id, c.lessons[lesson].id);
          return { ok: true, synced: c.linked };
        }
        throw new ApiError(403, 'Материалы сайта редактируются на сайте');
      }
      const row = external ? await site.test(user.id, id) : accessible(db, table, id, user.id);
      if (req.method === 'GET' && !action) {
        return table === 'tests'
          ? { id, title: row.title, subject: row.subject, mine: row.owner === user.id, published: !!row.published, questions: publicQuestions(JSON.parse(row.questions)) }
          : { id, title: row.title, description: row.description, mine: row.owner === user.id, published: !!row.published, lessons: JSON.parse(row.lessons), completed: db.prepare('SELECT lesson FROM progress WHERE user_id=? AND course_id=?').all(user.id, id).map(r => r.lesson) };
      }
      if (req.method === 'POST' && action === 'attempts' && table === 'tests') {
        return createAttempt(db, user.id, id, row.title, JSON.parse(row.questions), now);
      }
      if (req.method === 'POST' && action === 'complete' && table === 'courses') {
        const { lesson } = await readJson(req);
        if (!Number.isInteger(lesson) || lesson < 0 || lesson >= JSON.parse(row.lessons).length) throw new ApiError(400, 'Урок не найден');
        db.prepare('INSERT OR IGNORE INTO progress VALUES (?,?,?)').run(user.id, id, lesson);
        return { ok: true };
      }
      if (row.owner !== user.id) throw new ApiError(403, 'Редактировать может только автор');
      if (req.method === 'GET' && action === 'edit') return { ...row, questions: row.questions ? JSON.parse(row.questions) : undefined, lessons: row.lessons ? JSON.parse(row.lessons) : undefined };
      if (req.method === 'PATCH' && action === 'publish') {
        const { published } = await readJson(req);
        if (typeof published !== 'boolean') throw new ApiError(400, 'Укажите статус публикации');
        db.prepare(`UPDATE ${table} SET published=? WHERE id=?`).run(Number(published), id);
        return { ok: true, published };
      }
      if (req.method === 'PUT' && !action && table === 'tests') {
        const b = await readJson(req);
        db.prepare('UPDATE tests SET title=?,subject=?,questions=? WHERE id=?').run(text(b.title, 'Название', 160, 3), text(b.subject || '', 'Предмет', 80, 0), JSON.stringify(validateQuestions(b.questions)), id);
        return { id };
      }
    }
    if (path === '/duels' && req.method === 'POST') {
      const { testId } = await readJson(req);
      const sourceTest = site && (isSiteId(testId) || isLessonId(testId)) ? await site.test(user.id, testId) : null;
      const id = createDuel(db, testId, user.id, now, sourceTest);
      return { id, inviteUrl: miniLink(env, 'duel_' + id) };
    }
    const duel = path.match(/^\/duels\/([a-f0-9]{32})(?:\/(join|answer))?$/);
    if (duel) {
      const [, id, action] = duel;
      const d = db.prepare('SELECT * FROM duels WHERE id=?').get(id);
      if (!d) throw new ApiError(404, 'Дуэль не найдена');
      if (isLessonId(d.test_id)) {
        if (!site) throw new ApiError(503, 'Сайт временно недоступен');
        await site.test(user.id, d.test_id);
      }
      if (req.method === 'GET' && !action) return { ...duelView(db, id, user.id, now), inviteUrl: miniLink(env, 'duel_' + id) };
      if (req.method === 'POST' && action === 'join') {
        if (now - d.created >= 900000 && !d.start_at) throw new ApiError(410, 'Приглашение истекло. Создайте новую дуэль');
        if (d.host === user.id || d.guest === user.id) return duelView(db, id, user.id, now);
        const result = db.prepare('UPDATE duels SET guest=?,start_at=? WHERE id=? AND guest IS NULL AND start_at IS NULL').run(user.id, now + 3000, id);
        if (!result.changes) throw new ApiError(409, 'В дуэли уже два участника');
        return duelView(db, id, user.id, now);
      }
      if (req.method === 'POST' && action === 'answer') {
        if (d.host !== user.id && d.guest !== user.id) throw new ApiError(403, 'Вы не участвуете в дуэли');
        const b = await readJson(req);
        const round = d.start_at ? Math.floor((now - d.start_at) / 15000) : -1;
        const questions = JSON.parse(d.snapshot);
        if (round < 0 || round >= questions.length || b.round !== round) throw new ApiError(409, 'Время этого вопроса истекло');
        if (b.choice === null || !validAnswer(questions[round], b.choice)) throw new ApiError(400, 'Некорректный ответ');
        const saved = db.prepare('INSERT OR IGNORE INTO answers VALUES (?,?,?,?,?)').run(id, user.id, round, Array.isArray(b.choice) ? JSON.stringify(b.choice) : b.choice, now - d.start_at - round * 15000);
        if (!saved.changes) throw new ApiError(409, 'Ответ уже принят');
        return duelView(db, id, user.id, now);
      }
    }
    throw new ApiError(404, 'Маршрут не найден');
  }
  return async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    const url = new URL(req.url, 'http://localhost');
    if (!url.pathname.startsWith('/api/telegram/')) return serveStatic(req, res, url, env);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    try {
      const data = await route(req, url);
      res.end(JSON.stringify(data));
    } catch (e) {
      res.statusCode = e instanceof ApiError ? e.status : 500;
      res.end(JSON.stringify({ error: e instanceof ApiError ? e.message : 'Ошибка сервера' }));
    }
  };
}

function validateLessons(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 30) throw new ApiError(400, 'Добавьте от 1 до 30 уроков');
  return value.map(l => ({ title: text(l?.title, 'Название урока', 160), content: text(l?.content, 'Содержание урока', 15000) }));
}

function serveStatic(req, res, url, env) {
  if (!['GET', 'HEAD'].includes(req.method)) { res.statusCode = 405; return res.end(); }
  const root = resolve(env.TELEGRAM_STATIC_DIR || 'dist');
  let decoded;
  try { decoded = decodeURIComponent(url.pathname); } catch { res.statusCode = 400; return res.end(); }
  let file = resolve(root, '.' + decoded);
  if (!file.startsWith(root + sep)) { res.statusCode = 404; return res.end(); }
  if (!existsSync(file) || !statSync(file).isFile()) {
    if (extname(file)) { res.statusCode = 404; return res.end(); }
    file = resolve(root, 'index.html');
  }
  if (!existsSync(file)) { res.statusCode = 503; return res.end('Run npm run build first, or use Vite at localhost:5174/telegram'); }
  const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
  res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
  res.setHeader('Cache-Control', extname(file) === '.html' ? 'no-store' : 'public, max-age=3600');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'self' https://web.telegram.org https://*.telegram.org https://t.me");
  if (req.method === 'HEAD') return res.end();
  createReadStream(file).pipe(res);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const env = process.env;
  const dev = env.TELEGRAM_DEV_MODE === 'true';
  if (!dev && (!env.TELEGRAM_BOT_TOKEN || !env.MINI_APP_URL)) throw new Error('Configure TELEGRAM_BOT_TOKEN and MINI_APP_URL');
  const server = createServer(createApp());
  server.requestTimeout = 60000;
  server.headersTimeout = 10000;
  server.listen(Number(env.TELEGRAM_PORT || 3002), dev ? '127.0.0.1' : '0.0.0.0', () => console.log('Aziral Learn Telegram server started on port ' + (env.TELEGRAM_PORT || 3002)));
}
