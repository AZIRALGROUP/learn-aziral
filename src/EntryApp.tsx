import { lazy, Suspense } from 'react';
import App from './app/App';

const TelegramApp = lazy(() => import('./telegram/TelegramApp'));

export function EntryApp() {
  if (/^\/telegram(?:\/|$)/.test(window.location.pathname)) {
    return <Suspense fallback={<p role="status">Загружаем Aziral Learn…</p>}><TelegramApp /></Suspense>;
  }
  return <App />;
}
