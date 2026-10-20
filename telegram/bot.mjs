import { ApiError } from './auth.mjs';
import { createDuel } from './store.mjs';
import { createSiteClient, isSiteId, isLessonId } from './site.mjs';
import { botMessages } from './branding.mjs';

export async function telegramCall(env, method, payload, fetcher = fetch) {
  let response;
  try {
    const multipart = payload instanceof FormData;
    response = await fetcher(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
      method: 'POST', headers: multipart ? {} : { 'Content-Type': 'application/json' }, body: multipart ? payload : JSON.stringify(payload), signal: AbortSignal.timeout(12000),
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error('Telegram rejected request');
    return data.result;
  } catch { throw new ApiError(502, 'Telegram временно недоступен'); }
}

export function miniLink(env, param = '') {
  if (!env.TELEGRAM_BOT_USERNAME) return `${env.MINI_APP_URL}${param ? `?start=${encodeURIComponent(param)}` : ''}`;
  // start links work before BotFather's optional "Main Mini App" is configured.
  return `https://t.me/${env.TELEGRAM_BOT_USERNAME}?start=${encodeURIComponent(param || 'home')}`;
}

export async function processUpdate(db, env, update, now = Date.now(), call = telegramCall) {
  if (!Number.isSafeInteger(update.update_id)) return;
  let stored = db.prepare('SELECT * FROM bot_updates WHERE id = ?').get(update.update_id);
  if (stored?.sent) return;
  if (!stored) {
    const m = update.message;
    if (!m?.from || m.from.is_bot || !m.chat || !Number.isSafeInteger(m.from.id) || !Number.isSafeInteger(m.chat.id) || typeof m.text !== 'string') return;
    const command = m.text.match(/^\/(start|help|learn|tests|courses|duel|progress|newtest)(?:@([\w]+))?(?:\s+(\S+))?\s*$/);
    if ((!command && m.chat.type !== 'private') || (command?.[2] && command[2].toLowerCase() !== env.TELEGRAM_BOT_USERNAME?.toLowerCase())) return;
    const userId = String(m.from.id);
    db.prepare('INSERT INTO users VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,username=excluded.username').run(userId, String(m.from.first_name || 'Участник').slice(0, 80), m.from.username || null);
    const name = command?.[1] || 'help';
    const argument = command?.[3];
    let param = name === 'start' ? argument || '' : name === 'progress' ? 'profile' : name;
    const messages = botMessages(env.TELEGRAM_BOT_USERNAME);
    const copyName = name === 'start' ? ({ profile: 'progress', tests: 'tests', courses: 'courses', newtest: 'newtest' }[param] || 'start') : name;
    let message = messages[copyName] || messages.start;
    if (param.startsWith('duel_')) message = 'Тебя ждут в дуэли.\nВходи: до 10 вопросов, по 15 секунд.';
    if (name === 'duel') {
      if (argument) {
        try {
          const site = createSiteClient(env);
          const sourceTest = site && (isSiteId(argument) || isLessonId(argument)) ? await site.test(userId, argument) : null;
          param = 'duel_' + createDuel(db, argument, userId, now, sourceTest);
          message = 'Дуэль готова.\nОтправь приглашение другу. Старт — когда вас двое; до 10 вопросов по 15 секунд.';
        }
        catch (e) { message = e instanceof ApiError ? e.message : 'Не удалось создать дуэль'; param = 'duels'; }
      } else { message = 'Выбери тест → «Создать дуэль» → отправь ссылку другу.'; param = 'duels'; }
    }
    const button = (text, destination) => {
      const url = new URL(env.MINI_APP_URL);
      if (destination) url.searchParams.set('start', destination);
      return m.chat.type === 'private' ? { text, web_app: { url: url.href } } : { text, url: miniLink(env, destination) };
    };
    const labels = { tests: 'Выбрать тест', courses: 'Открыть курсы', duels: 'Создать дуэль', profile: 'Мой прогресс', newtest: 'Создать с ИИ' };
    let keyboard;
    const groupButton = { text: 'В группу', url: `https://t.me/${env.TELEGRAM_BOT_USERNAME}?startgroup=learn` };
    if (param.startsWith('duel_')) keyboard = [[button('Войти в дуэль', param)]];
    else if (labels[param]) {
      const shortcuts = param === 'tests' ? [['Создать с ИИ','newtest'],['Дуэль','duels']] : param === 'newtest' ? [['Тесты','tests'],['Курсы','courses']] : [['Тесты','tests'],['Создать с ИИ','newtest']];
      keyboard = [[button(labels[param], param)], shortcuts.map(([label, destination]) => button(label, destination)), [button(param === 'profile' ? 'Дуэль' : 'Мой прогресс', param === 'profile' ? 'duels' : 'profile')]];
      if (m.chat.type === 'private') keyboard[2].push(groupButton);
    } else {
      keyboard = [
        [button('Тесты','tests'),button('Курсы','courses')],
        [button('Создать с ИИ','newtest'),button('Дуэль','duels')],
        [button('Мой прогресс','profile')],
      ];
      if (m.chat.type === 'private') keyboard[2].push(groupButton);
    }
    const payload = JSON.stringify({ chat_id: m.chat.id, text: message, reply_markup: { inline_keyboard: keyboard } });
    db.prepare('INSERT OR IGNORE INTO bot_updates (id,payload) VALUES (?,?)').run(update.update_id, payload);
    stored = db.prepare('SELECT * FROM bot_updates WHERE id = ?').get(update.update_id);
  }
  await call(env, 'sendMessage', JSON.parse(stored.payload));
  db.prepare('UPDATE bot_updates SET sent=1 WHERE id=?').run(update.update_id);
}
