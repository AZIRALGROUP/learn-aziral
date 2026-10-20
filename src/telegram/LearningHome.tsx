import { ArrowRight, BookOpen, CheckCircle2, GraduationCap, RefreshCw, Swords, Trophy } from 'lucide-react';
import type { Learning, LearningEntry, Me } from './api';

type Props = { me: Me; learning: Learning | null; error: string; busy: boolean; onOpen: (id: string) => void; onRetry: () => void; onBrowse: () => void; onRefreshAccount: () => void };
function when(timestamp: number | null) {
  return timestamp ? new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(timestamp) : '';
}
function Entry({ entry, active, busy, onOpen }: { entry: LearningEntry; active?: boolean; busy: boolean; onOpen: (id: string) => void }) {
  return <article className="tg-history-entry"><div><h3>{entry.title}</h3><p className="tg-muted">{active ? `${entry.answered} из ${entry.total} ответов` : `${entry.correct} из ${entry.total} верно`}{entry.updated ? ` · ${when(entry.updated)}` : ''}</p></div><button className={active ? 'tg-primary' : 'tg-secondary'} disabled={busy} onClick={() => onOpen(entry.id)}>{active ? 'Продолжить' : 'Разбор'}<ArrowRight size={16} aria-hidden="true" /></button></article>;
}
export function LearningHome({ me, learning, error, busy, onOpen, onRetry, onBrowse, onRefreshAccount }: Props) {
  return <>
    <div className="tg-eyebrow">ТВОЙ ПРОГРЕСС</div><h1>{me.user.name},<br /><em>шаг за шагом.</em></h1><p className="tg-intro">Твои тренировки и результаты в одном месте. Продолжай на любом устройстве через этого бота.</p>
    {error && <div className="tg-error" role="alert"><span>{error}</span><button className="tg-secondary" onClick={onRetry}>Повторить</button></div>}
    {!learning && !error && <p role="status">Загружаем прогресс…</p>}
    {learning && <>
      <div className="tg-stats">{[
        { label: 'Тренировок', value: learning.stats.completed, icon: GraduationCap },
        { label: 'Верных ответов', value: learning.stats.total ? `${Math.round(learning.stats.correct / learning.stats.total * 100)}%` : '—', icon: Trophy },
        { label: 'Уроков пройдено', value: learning.stats.lessons, icon: BookOpen },
        { label: 'Дуэлей сыграно', value: learning.stats.duels, icon: Swords },
      ].map(s => <div key={s.label}><s.icon size={20} aria-hidden="true" /><strong>{s.value}</strong><span>{s.label}</span></div>)}</div>
      {!!learning.active.length && <section aria-label="Незавершённые тренировки"><h2>Продолжить учёбу</h2>{learning.active.map(e => <Entry key={e.id} entry={e} active busy={busy} onOpen={onOpen} />)}</section>}
      <section aria-label="История результатов"><h2>Последние результаты</h2>{learning.recent.length ? learning.recent.map(e => <Entry key={e.id} entry={e} busy={busy} onOpen={onOpen} />) : <div className="tg-empty"><CheckCircle2 size={32} aria-hidden="true" /><h3>Твоя первая победа впереди</h3><p>Пройди тест — здесь появится результат и разбор ответов.</p><button className="tg-primary" onClick={onBrowse}>Выбрать тест<ArrowRight size={18} aria-hidden="true" /></button></div>}</section>
    </>}
    {me.siteConnected && !me.dev && <section className="tg-card tg-account"><div className="tg-section-title"><h2>Аккаунт сайта</h2><button className="tg-icon-button" aria-label="Проверить привязку Telegram" disabled={busy} onClick={onRefreshAccount}><RefreshCw size={18} aria-hidden="true" /></button></div><p>{me.siteError || (me.siteAccount?.linked ? `Подключён: ${me.siteAccount.user?.name}. Оплаченные курсы доступны, прогресс уроков сохраняется и на сайте.` : 'Привяжи Telegram в профиле сайта, чтобы открыть купленные курсы и синхронизировать уроки.')}</p><a className="tg-secondary" href="https://aziral.com/profile" target="_blank" rel="noopener noreferrer">Открыть профиль сайта<ArrowRight size={16} aria-hidden="true" /></a></section>}
  </>;
}
