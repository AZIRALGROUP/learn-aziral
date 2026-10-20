export type Answer = number | number[] | null;
export type Question = { question: string; options: string[]; correct: number | number[]; explanation: string; type?: 'single' | 'multi' | 'order' };
export type PublicQuestion = Pick<Question, 'question' | 'options' | 'type'>;
export type Summary = { id: string; title: string; subject?: string; category?: string; description?: string; mine: boolean; published: boolean; count: number; source?: 'website'; price?: number; websiteUrl?: string };
export type Me = { user: { id: string; name: string }; dev: boolean; botUsername: string; aiAvailable: boolean; siteConnected?: boolean; siteAccount?: { linked: boolean; user: { id: number; name: string } | null }; siteError?: string };
export type Review = Question & { answer: Answer; isCorrect: boolean };
export type Result = { correct: number; total: number; review: Review[] };
export type Attempt = { id: string; testId: string; title: string; questions: PublicQuestion[]; answers: Answer[]; questionIndex: number; revision: number; result?: Result };
export type LearningEntry = { id: string; testId: string; title: string; updated: number | null; total: number; correct?: number; answered?: number };
export type Learning = { stats: { completed: number; correct: number; total: number; lessons: number; duels: number }; active: LearningEntry[]; recent: LearningEntry[] };
export type Course = Summary & { lessons: { id?: number; title: string; content: string; type?: string; video_url?: string; task_description?: string; task_starter_code?: string; quizCount?: number }[]; completed: number[]; locked?: boolean; linked?: boolean };
export type Duel = {
  id: string; title: string; state: 'waiting' | 'countdown' | 'playing' | 'finished' | 'expired';
  member: boolean; players: { id: string; name: string }[]; total: number; round: number;
  startAt: number | null; endsAt: number | null; serverNow: number; inviteUrl: string;
  question?: PublicQuestion; answer?: Answer;
  results?: { id: string; name: string; score: number; correct: number }[];
};

export interface TelegramWebApp {
  initData: string;
  ready: () => void; expand: () => void;
  openTelegramLink: (url: string) => void;
  openLink?: (url: string) => void;
  shareMessage?: (id: string, callback?: (sent: boolean) => void) => void;
  isVersionAtLeast?: (version: string) => boolean;
  BackButton: { show: () => void; hide: () => void; onClick: (fn: () => void) => void; offClick: (fn: () => void) => void };
  HapticFeedback?: { selectionChanged: () => void };
  enableClosingConfirmation?: () => void; disableClosingConfirmation?: () => void;
}
declare global { interface Window { Telegram?: { WebApp: TelegramWebApp } } }

let sdkPromise: Promise<void> | undefined;
export function loadTelegram(): Promise<void> {
  if (window.Telegram?.WebApp) return Promise.resolve();
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise(resolve => {
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-web-app.js';
    script.async = true;
    const timer = setTimeout(resolve, 6000);
    const done = () => { clearTimeout(timer); resolve(); };
    script.onload = done;
    script.onerror = done;
    document.head.appendChild(script);
  });
  return sdkPromise;
}

export async function telegramApi<T>(path: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/telegram${path}`, {
    method, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(path === '/ai/generate' ? 50000 : 20000)]) : AbortSignal.timeout(path === '/ai/generate' ? 50000 : 20000),
    headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': window.Telegram?.WebApp.initData || '' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Не удалось выполнить запрос');
  return data as T;
}

export function shareDuel(url: string) {
  const link = 'https://t.me/share/url?' + new URLSearchParams({ url, text: 'Проверим знания? Присоединяйся к моей дуэли в Learn × Aziral!' });
  if (window.Telegram?.WebApp.initData) window.Telegram.WebApp.openTelegramLink(link);
  else window.open(link, '_blank', 'noopener,noreferrer');
}

export async function inviteToDuel(duel: Pick<Duel, 'id' | 'inviteUrl'>, onSent: () => void) {
  const tg = window.Telegram?.WebApp;
  if (tg?.initData && tg.shareMessage && tg.isVersionAtLeast?.('8.0')) {
    const prepared = await telegramApi<{ id: string }>(`/duels/${duel.id}/share`, 'POST');
    tg.shareMessage(prepared.id, sent => { if (sent) onSent(); });
  } else shareDuel(duel.inviteUrl);
}

export function openAccountLink(url: string) {
  if (window.Telegram?.WebApp.openLink) window.Telegram.WebApp.openLink(url);
  else window.open(url, '_blank', 'noopener,noreferrer');
}

export function choiceText(question: PublicQuestion, value: Answer) {
  if (value === null || (Array.isArray(value) && value.length === 0)) return 'Без ответа';
  return Array.isArray(value) ? value.map(i => question.options[i]).join(question.type === 'order' ? ' → ' : ', ') : question.options[value];
}
