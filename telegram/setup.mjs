import { telegramCall } from './bot.mjs';
import { readFile } from 'node:fs/promises';
import { botProfile } from './branding.mjs';

const env = process.env;
if (!env.TELEGRAM_BOT_TOKEN || !env.MINI_APP_URL) throw new Error('Configure TELEGRAM_BOT_TOKEN and MINI_APP_URL');
const url = new URL(env.MINI_APP_URL);
if (url.protocol !== 'https:' || /^(localhost|127\.|0\.)/.test(url.hostname)) throw new Error('MINI_APP_URL must be a public HTTPS URL');
const me = await telegramCall(env, 'getMe', {});
if (env.TELEGRAM_BOT_USERNAME && env.TELEGRAM_BOT_USERNAME.toLowerCase() !== me.username.toLowerCase()) throw new Error('Bot username does not match the token');
for (const language_code of ['', 'ru']) {
  await telegramCall(env, 'setMyName', { name: botProfile.name, language_code });
  await telegramCall(env, 'setMyDescription', { description: botProfile.description, language_code });
  await telegramCall(env, 'setMyShortDescription', { short_description: botProfile.shortDescription, language_code });
}
if (process.argv.includes('--profile-photo')) {
  const bytes = await readFile(new URL('../dist/telegram/avatar.jpg', import.meta.url));
  const payload = new FormData();
  payload.set('photo', JSON.stringify({ type: 'static', photo: 'attach://avatar' }));
  payload.set('avatar', new Blob([bytes], { type: 'image/jpeg' }), 'aziral-learn.jpg');
  await telegramCall(env, 'setMyProfilePhoto', payload);
}
await telegramCall(env, 'setMyCommands', { commands: [
  { command: 'start', description: 'Главное меню' },
  { command: 'learn', description: 'Открыть приложение' },
  { command: 'tests', description: 'Пройти тест' },
  { command: 'courses', description: 'Курсы и уроки' },
  { command: 'duel', description: 'Дуэль с другом' },
  { command: 'newtest', description: 'Создать тест с ИИ' },
  { command: 'progress', description: 'Мой прогресс' },
  { command: 'help', description: 'Как пользоваться ботом' },
] });
await telegramCall(env, 'setChatMenuButton', { menu_button: { type: 'web_app', text: 'Учиться', web_app: { url: url.href } } });
if (process.argv.includes('--webhook')) {
  if (!env.TELEGRAM_WEBHOOK_SECRET || env.TELEGRAM_WEBHOOK_SECRET.length < 32) throw new Error('Configure a random TELEGRAM_WEBHOOK_SECRET of at least 32 characters');
  const current = await telegramCall(env, 'getWebhookInfo', {});
  const webhook = new URL('/api/telegram/webhook', url).href;
  if (current.url && current.url !== webhook) throw new Error('A different webhook exists. It was not overwritten.');
  await telegramCall(env, 'setWebhook', { url: webhook, secret_token: env.TELEGRAM_WEBHOOK_SECRET, allowed_updates: ['message'], max_connections: 1 });
}
console.log('Bot @' + me.username + ': profile, commands and Mini App menu configured.');
