import { ApiError } from './auth.mjs';
import { createDuel } from './store.mjs';
import { createSiteClient, isSiteId, isLessonId } from './site.mjs';

export async function telegramCall(env, method, payload, fetcher = fetch) {
  let response;
  try {
    response = await fetcher(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(12000),
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
    const messages = {
      start: 'Привет! Это Aziral Learn. Здесь можно готовиться к экзаменам одному и вместе с друзьями.\n\nВыбери тест или курс, создай свой тест с ИИ или вызови друга на дуэль. Незавершённую тренировку можно продолжить позже.',
      learn: 'Всё для учёбы — в одном приложении. Выбери, с чего начнём.',
      tests: 'Выбирай тест по предмету и тренируйся в своём темпе. Ответы сохраняются автоматически, после завершения можно разобрать и повторить ошибки.',
      courses: 'Курсы сайта и твои материалы. Открывай уроки, проходи тесты к ним и отмечай прогресс. Для купленных курсов привяжи Telegram в профиле aziral.com.',
      progress: 'Твои результаты и незавершённые тренировки. Продолжи с того же вопроса или повтори ошибки из прошлого теста.',
      newtest: 'Создай тест по своей теме или конспекту. ИИ предложит вопросы — проверь их и сохрани. Тест сначала будет личным черновиком.',
      help: 'Как пользоваться Aziral Learn\n\n• Тесты: выбери предмет и тренируйся. Ответы сохраняются, ошибки можно повторить.\n• Курсы: читай уроки и отмечай пройденное.\n• Создать с ИИ: укажи тему или вставь конспект, затем проверь вопросы.\n• Дуэли: выбери тест, создай приглашение и отправь другу. По 15 секунд на вопрос.\n• Прогресс: продолжение тренировок и разбор результатов.\n\nВ группе используй /learn@' + env.TELEGRAM_BOT_USERNAME + ' или /duel@' + env.TELEGRAM_BOT_USERNAME + '. Приглашение в дуэль можно отправить прямо в беседу.',
    };
    let message = messages[name] || messages.start;
    if (param.startsWith('duel_')) message = 'Тебя пригласили на дуэль! Открой приглашение. Игра начнётся после входа второго участника: до 10 вопросов, по 15 секунд на каждый.';
    if (name === 'duel') {
      if (argument) {
        try {
          const site = createSiteClient(env);
          const sourceTest = site && (isSiteId(argument) || isLessonId(argument)) ? await site.test(userId, argument) : null;
          param = 'duel_' + createDuel(db, argument, userId, now, sourceTest);
          message = 'Дуэль создана! Откройте её и отправьте ссылку другу. После входа второго участника начнётся отсчёт. На каждый вопрос — 15 секунд; в дуэли до 10 вопросов.';
        }
        catch (e) { message = e instanceof ApiError ? e.message : 'Не удалось создать дуэль'; param = 'duels'; }
      } else { message = 'Выберите тест в приложении и нажмите «Дуэль». Отправьте приглашение другу или в группу.'; param = 'duels'; }
    }
    const button = (text, destination) => {
      const url = new URL(env.MINI_APP_URL);
      if (destination) url.searchParams.set('start', destination);
      return m.chat.type === 'private' ? { text, web_app: { url: url.href } } : { text, url: miniLink(env, destination) };
    };
    const labels = { tests: 'Выбрать тест', courses: 'Открыть курсы', duels: 'Создать дуэль', profile: 'Мой прогресс', newtest: 'Создать тест с ИИ' };
    const primary = button(param.startsWith('duel_') ? 'Войти в дуэль' : labels[param] || 'Открыть Aziral Learn', param === 'help' ? '' : param);
    const keyboard = [[primary]];
    if (!param.startsWith('duel_')) {
      keyboard.push([button('Тесты', 'tests'), button('Курсы', 'courses')]);
      keyboard.push([button('Создать с ИИ', 'newtest'), button('Мой прогресс', 'profile')]);
      if (param !== 'duels') keyboard.push([button('Дуэль с другом', 'duels')]);
      if (m.chat.type === 'private') keyboard.push([{ text: 'Добавить в группу', url: `https://t.me/${env.TELEGRAM_BOT_USERNAME}?startgroup=learn` }]);
    }
    const payload = JSON.stringify({ chat_id: m.chat.id, text: message, reply_markup: { inline_keyboard: keyboard } });
    db.prepare('INSERT OR IGNORE INTO bot_updates (id,payload) VALUES (?,?)').run(update.update_id, payload);
    stored = db.prepare('SELECT * FROM bot_updates WHERE id = ?').get(update.update_id);
  }
  await call(env, 'sendMessage', JSON.parse(stored.payload));
  db.prepare('UPDATE bot_updates SET sent=1 WHERE id=?').run(update.update_id);
}
