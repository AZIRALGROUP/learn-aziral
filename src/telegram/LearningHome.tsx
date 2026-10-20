import { ArrowRight, BookOpen, CheckCircle2, GraduationCap, RefreshCw, Swords, Trophy } from 'lucide-react';
import type { Learning, LearningEntry, Me } from './api';

type Props = { me: Me; learning: Learning | null; error: string; busy: boolean; onOpen: (id: string) => void; onRetry: () => void; onBrowse: () => void; onRefreshAccount: () => void; onConnectAccount: () => void };
function when(timestamp: number | null) {
  return timestamp ? new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(timestamp) : '';
}
function Entry({ entry, active, busy, onOpen }: { entry: LearningEntry; active?: boolean; busy: boolean; onOpen: (id: string) => void }) {
  return <article className="tg-history-entry"><div><h3>{entry.title}</h3><p className="tg-muted">{active ? `${entry.answered} из ${entry.total} ответов` : `${entry.correct} из ${entry.total} верно`}{entry.updated ? ` · ${when(entry.updated)}` : ''}</p></div><button className={active ? 'tg-primary' : 'tg-secondary'} disabled={busy} onClick={() => onOpen(entry.id)}>{active ? 'Продолжить' : 'Разбор'}<ArrowRight size={16} aria-hidden="true" /></button></article>;
}
export function LearningHome({ me, learning, error, busy, onOpen, onRetry, onBrowse, onRefreshAccount, onConnectAccount }: Props) {
  return <>
    <h1>Профиль</h1><p className="tg-intro">{me.siteAccount?.user?.name || me.user.name}</p>
    {me.siteConnected && !me.dev && <section className="tg-card tg-account"><div className="tg-section-title"><h2>{me.siteAccount?.linked ? 'Единый аккаунт Aziral' : 'Подключить аккаунт сайта'}</h2><button className="tg-icon-button" aria-label="Обновить аккаунт и объединить тесты" disabled={busy} onClick={onRefreshAccount}><RefreshCw size={18} aria-hidden="true" /></button></div><p>{me.siteError || (me.siteAccount?.linked ? 'Твои тесты сайта — в разделе «Мои». Новые тесты сохраняются и на сайте. Курсы и прогресс уроков общие.' : 'Войди в свой аккаунт в браузере и подтверди подключение. Тесты и покупки появятся здесь.')}</p>{!me.siteAccount?.linked && <button className="tg-primary" disabled={busy} onClick={onConnectAccount}>Подключить через браузер<ArrowRight size={16} aria-hidden="true" /></button>}<details className="tg-fold"><summary>{me.siteAccount?.linked ? 'Тесты из прежней версии' : 'Уже подключил?'}</summary><p className="tg-small">Нажми обновление, чтобы проверить привязку и перенести прежние тесты Learn на сайт. Результаты тренировок и дуэлей остаются в Telegram.</p><button className="tg-secondary" disabled={busy} onClick={onRefreshAccount}>{busy ? 'Объединяем…' : 'Обновить и объединить тесты'}</button></details></section>}
    {error && <div className="tg-error" role="alert"><span>{error}</span><button className="tg-secondary" onClick={onRetry}>Повторить</button></div>}
    {!learning && !error && <p role="status">Загружаем прогресс…</p>}
    {learning && <>
      <div className="tg-stats">{[
        { label: 'Тестов', value: learning.stats.completed, icon: GraduationCap },
        { label: 'Верно', value: learning.stats.total ? `${Math.round(learning.stats.correct / learning.stats.total * 100)}%` : '—', icon: Trophy },
        { label: 'Уроков', value: learning.stats.lessons, icon: BookOpen },
        { label: 'Дуэлей', value: learning.stats.duels, icon: Swords },
      ].map(s => <div key={s.label}><s.icon size={20} aria-hidden="true" /><strong>{s.value}</strong><span>{s.label}</span></div>)}</div>
      {!!learning.active.length && <section aria-label="Незавершённые тренировки"><h2>Продолжить учёбу</h2>{learning.active.map(e => <Entry key={e.id} entry={e} active busy={busy} onOpen={onOpen} />)}</section>}
      <section aria-label="История результатов"><h2>Последние результаты</h2>{learning.recent.length ? learning.recent.map(e => <Entry key={e.id} entry={e} busy={busy} onOpen={onOpen} />) : <div className="tg-empty"><CheckCircle2 size={32} aria-hidden="true" /><h3>Пока нет результатов</h3><p>Пройди тест, чтобы увидеть разбор.</p><button className="tg-primary" onClick={onBrowse}>Выбрать тест<ArrowRight size={18} aria-hidden="true" /></button></div>}</section>
    </>}
  </>;
}
