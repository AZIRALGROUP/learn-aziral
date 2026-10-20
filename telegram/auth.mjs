import { createHmac, timingSafeEqual } from 'node:crypto';

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function verifyInitData(raw, token, now = Date.now()) {
  if (!token) throw new ApiError(503, 'Telegram ещё не настроен');
  if (typeof raw !== 'string' || raw.length > 16384) throw new ApiError(401, 'Откройте приложение через Telegram');
  const params = new URLSearchParams(raw);
  if (new Set(params.keys()).size !== [...params.keys()].length) throw new ApiError(401, 'Некорректная подпись Telegram');
  const hash = params.get('hash') || '';
  params.delete('hash');
  const data = [...params].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  const expected = createHmac('sha256', secret).update(data).digest();
  if (!/^[a-f0-9]{64}$/i.test(hash) || !timingSafeEqual(expected, Buffer.from(hash, 'hex'))) {
    throw new ApiError(401, 'Некорректная подпись Telegram');
  }
  const date = Number(params.get('auth_date'));
  if (!Number.isSafeInteger(date) || date <= 0 || now / 1000 - date > 3600 || date > now / 1000 + 30) {
    throw new ApiError(401, 'Сессия истекла. Закройте и снова откройте Mini App');
  }
  let user;
  try { user = JSON.parse(params.get('user') || 'null'); } catch { /* handled below */ }
  if (!user || !Number.isSafeInteger(user.id) || user.id <= 0 || typeof user.first_name !== 'string') {
    throw new ApiError(401, 'Не удалось определить пользователя Telegram');
  }
  return { id: String(user.id), name: user.first_name.slice(0, 80), username: typeof user.username === 'string' ? user.username.slice(0, 64) : null };
}

export function sameSecret(a, b) {
  if (!a || !b) return false;
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
