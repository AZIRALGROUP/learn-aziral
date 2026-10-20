import { ApiError } from './auth.mjs';

export const isSiteId = id => /^site-[1-9]\d{0,9}$/.test(id);
export const isLessonId = id => /^lesson-[1-9]\d{0,9}$/.test(id);
const parsed = value => typeof value === 'string' ? JSON.parse(value) : value;

export function normalizeSiteQuestion(q) {
  if (q.correct_index !== undefined) return { question: q.question, options: parsed(q.options), correct: Number(q.correct_index), type: 'single', explanation: '' };
  const type = q.type || 'single';
  if (type === 'order') {
    const items = parsed(q.items || '[]');
    if (!items.length) throw new ApiError(422, 'В тесте сайта есть пустой вопрос на порядок');
    return { question: q.question, options: items.map(i => i.text), type, correct: items.map((_, i) => i).sort((a, b) => items[a].order - items[b].order), explanation: '' };
  }
  const options = parsed(q.options || '[]');
  const correct = parsed(q.correct || '[]');
  const labels = type === 'tf' && options.length < 2 ? ['Правда', 'Ложь'] : options;
  if (!['single', 'multi', 'tf'].includes(type) || !Array.isArray(correct) || !correct.length || correct.some(i => !Number.isInteger(i) || i < 0 || i >= labels.length)) throw new ApiError(422, 'В тесте сайта есть вопрос без корректного ответа. Автору нужно исправить его на сайте');
  return { question: q.question, options: labels, correct: type === 'multi' ? correct : correct[0], type: type === 'multi' ? type : 'single', explanation: q.explanation || '' };
}

export function createSiteClient(env, fetcher = fetch) {
  if (!env.SITE_API_URL || !env.LEARN_BRIDGE_SECRET) return null;
  const base = new URL(env.SITE_API_URL);
  if (!['https:', 'http:'].includes(base.protocol) || (base.protocol === 'http:' && !['aziral-api', '127.0.0.1', 'localhost'].includes(base.hostname))) throw new Error('Untrusted site API URL');
  async function call(userId, path, method = 'GET', body) {
    if (!/^[1-9]\d{0,15}$/.test(userId)) throw new ApiError(403, 'Материалы сайта доступны после входа через Telegram');
    try {
      const response = await fetcher(new URL('/api/learn-bridge' + path, base), {
        method, headers: { 'Content-Type': 'application/json', 'x-learn-bridge-secret': env.LEARN_BRIDGE_SECRET, 'x-learn-telegram-id': userId },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000), redirect: 'error',
      });
      const data = await response.json();
      if (!response.ok) throw new ApiError(response.status, data.error || 'Сайт временно недоступен');
      return data;
    } catch (e) { if (e instanceof ApiError) throw e; throw new ApiError(503, 'Не удалось загрузить материалы сайта. Попробуйте позже'); }
  }
  return {
    account: userId => call(userId, '/account'),
    async catalog(userId, kind, mine = false) {
      const data = await call(userId, '/catalog?mine=' + mine);
      return data[kind].map(row => ({ ...row, id: 'site-' + row.id, source: 'website', mine: !!row.mine, published: row.published !== false, websiteUrl: `https://learn.aziral.com/${kind === 'courses' ? 'courses' : 'study'}/${row.id}` }));
    },
    async test(userId, id) {
      const lesson = isLessonId(id);
      if (!isSiteId(id) && !lesson) throw new ApiError(404, 'Тест не найден');
      const data = await call(userId, lesson ? `/lessons/${id.slice(7)}/quiz` : `/tests/${id.slice(5)}`);
      const questions = data.questions.map(normalizeSiteQuestion);
      if (!questions.length) throw new ApiError(422, 'В тесте пока нет вопросов');
      return { id, title: data.title, subject: data.subject || '', category: data.category || 'study', owner: data.mine ? userId : 'website', source: 'website', published: data.published !== false ? 1 : 0, questions: JSON.stringify(questions) };
    },
    async saveTest(userId, body, id) {
      const result = await call(userId, id ? '/tests/' + id.slice(5) : '/tests', id ? 'PUT' : 'POST', body);
      return { id: 'site-' + result.id };
    },
    publishTest: (userId, id, published) => call(userId, '/tests/' + id.slice(5) + '/publish', 'PATCH', { published }),
    linkAccount: (userId, siteUserId) => call(userId, '/account/link', 'POST', { siteUserId }),
    async browserAccount(cookie) {
      const token = String(cookie || '').split(';').map(s => s.trim()).find(s => /^auth_token=[A-Za-z0-9_.-]{1,4096}$/.test(s));
      if (!token) return null;
      try {
        const r = await fetcher(new URL('/api/auth/me', base), { headers: { cookie: token }, signal: AbortSignal.timeout(10000), redirect: 'error' });
        if (r.status === 401 || r.status === 403) return null;
        if (!r.ok) throw new Error('Site unavailable');
        const data = await r.json();
        if (!Number.isSafeInteger(data.id) || data.id < 1 || typeof data.name !== 'string') throw new Error('Invalid account');
        return { id: data.id, name: data.name };
      } catch { throw new ApiError(503, 'Сайт временно недоступен. Попробуйте позже'); }
    },
    async course(userId, id) {
      const data = await call(userId, `/courses/${id.slice(5)}`);
      return { ...data, id, source: 'website', mine: false, published: true, websiteUrl: `https://learn.aziral.com/courses/${data.id}` };
    },
    complete: (userId, id, lessonId) => call(userId, `/courses/${id.slice(5)}/complete`, 'POST', { lessonId }),
  };
}
