import { openStore } from './store.mjs';
import { telegramCall, processUpdate } from './bot.mjs';
import { setTimeout } from 'node:timers/promises';

const env = process.env;
if (!env.TELEGRAM_BOT_TOKEN || !env.MINI_APP_URL || !env.TELEGRAM_BOT_USERNAME) throw new Error('Configure Telegram token, username and MINI_APP_URL');
const info = await telegramCall(env, 'getWebhookInfo', {});
if (info.url) throw new Error('A webhook is already configured. Polling will not change it.');
const db = openStore(env.TELEGRAM_DATABASE || undefined);
db.exec('CREATE TABLE IF NOT EXISTS poll_state (id INTEGER PRIMARY KEY, offset INTEGER NOT NULL)');
let offset = db.prepare('SELECT offset FROM poll_state WHERE id=1').get()?.offset || 0;
let running = true;
process.on('SIGINT', () => { running = false; });
process.on('SIGTERM', () => { running = false; });
console.log('Polling started for @' + env.TELEGRAM_BOT_USERNAME);
while (running) {
  try {
    const updates = await telegramCall(env, 'getUpdates', { offset, timeout: 10, allowed_updates: ['message'] });
    for (const u of updates) {
      await processUpdate(db, env, u);
      offset = u.update_id + 1;
      db.prepare('INSERT INTO poll_state VALUES (1,?) ON CONFLICT(id) DO UPDATE SET offset=excluded.offset').run(offset);
    }
  } catch { if (running) { console.error('Telegram polling unavailable; retrying after 10 seconds'); await setTimeout(10000); } }
}
db.close();
