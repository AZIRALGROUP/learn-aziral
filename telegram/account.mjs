import { createHash, randomBytes } from 'node:crypto';
import { ApiError } from './auth.mjs';

const digest = code => createHash('sha256').update(code).digest('hex');
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function accountLink(db, env, userId, now) {
  const code = randomBytes(24).toString('hex');
  db.prepare('DELETE FROM account_links WHERE user_id=? OR expires<?').run(userId,now);
  db.prepare('INSERT INTO account_links(hash,user_id,expires) VALUES (?,?,?)').run(digest(code),userId,now+600000);
  return { url: new URL('/connect-account?code='+code,env.MINI_APP_URL).href };
}

export async function serveAccountLink(req, res, { db, site, env, now }) {
  res.setHeader('Cache-Control','private, no-store');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
  const base = new URL(env.MINI_APP_URL).origin;
  const code = new URL(req.url,base).searchParams.get('code') || '';
  let title = 'Подключить аккаунт'; let content = '';
  try {
    if (!site) throw new ApiError(503,'Сайт пока не подключён');
    if (!['GET','POST'].includes(req.method)) throw new ApiError(405,'Метод недоступен');
    if (!/^[a-f0-9]{48}$/.test(code)) throw new ApiError(410,'Создай новую ссылку в профиле Learn');
    const link = db.prepare('SELECT * FROM account_links WHERE hash=? AND expires>? AND used=0').get(digest(code),now);
    if (!link) throw new ApiError(410,'Ссылка истекла или уже использована. Создай новую в профиле Learn');
    const account = await site.browserAccount(req.headers.cookie);
    if (!account) {
      content = `<p>Войди в существующий аккаунт Aziral в новой вкладке. Затем вернись сюда и продолжи.</p><a class="button" href="https://aziral.com/login" target="_blank" rel="noopener noreferrer">1. Войти на сайте</a><p><a class="button" href="/connect-account?code=${code}">2. Я вошёл — продолжить</a></p>`;
    } else if (req.method === 'POST') {
      if (req.headers.origin !== base) throw new ApiError(403,'Открой ссылку подключения заново');
      if (!db.prepare('UPDATE account_links SET used=1 WHERE hash=? AND used=0 AND expires>?').run(digest(code),now).changes) throw new ApiError(410,'Ссылка уже использована');
      try { await site.linkAccount(link.user_id,account.id); }
      catch(e) { db.prepare('UPDATE account_links SET used=0 WHERE hash=?').run(digest(code)); throw e; }
      title = 'Аккаунт подключён';
      content = `<p>${escape(account.name)}, теперь Learn видит твои тесты и курсы сайта.</p><p>Вернись в приложение и обнови профиль.</p><a class="button" href="https://t.me/${escape(env.TELEGRAM_BOT_USERNAME)}?start=profile">Вернуться в Learn</a>`;
    } else {
      const name = db.prepare('SELECT name FROM users WHERE id=?').get(link.user_id)?.name || 'участник';
      content = `<p>Объединить аккаунт сайта <strong>${escape(account.name)}</strong> и Telegram-профиль <strong>${escape(name)}</strong>?</p><p>Тесты и купленные курсы станут доступны в Learn.</p><form method="post" action="/connect-account?code=${code}"><button class="button" type="submit">Подключить аккаунт</button></form><a href="https://aziral.com/profile">Это другой аккаунт? Открыть профиль сайта</a>`;
    }
  } catch(e) {
    res.statusCode = e instanceof ApiError ? e.status : 500;
    title = 'Не удалось подключить';
    content = `<p>${escape(e instanceof ApiError ? e.message : 'Попробуй ещё раз позже')}</p>`;
  }
  res.end(`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · Learn × Aziral</title><style>body{margin:0;padding:24px;background:#0d101a;color:#edf0ff;font:16px/1.55 system-ui,sans-serif}main{max-width:400px;margin:12vh auto;padding:24px;background:#171c2b;border:1px solid #303749;border-radius:20px}small{color:#b6a5ff}h1{font-size:24px;line-height:1.2}p{color:#c9cde0}a{color:#c1afff}form{margin:20px 0}.button{display:block;box-sizing:border-box;width:100%;padding:13px 16px;border:0;border-radius:12px;background:#b4a0ff;color:#16102b;text-align:center;text-decoration:none;font:600 16px system-ui;cursor:pointer}</style></head><body><main><small>LEARN × AZIRAL</small><h1>${title}</h1>${content}</main></body></html>`);
}
