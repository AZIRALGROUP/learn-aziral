import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, CheckCircle2, Clock3, Copy, GraduationCap, Loader2, Plus, Search, Send, Sparkles, Swords, Trash2, Trophy, UserRound, X } from 'lucide-react';
import { choiceText, loadTelegram, shareDuel, telegramApi as api } from './api';
import type { Attempt, Answer, Course, Duel, Learning, Me, Question, Result, Summary } from './api';
import { QuestionChoices } from './QuestionChoices';
import { PracticeSession } from './PracticeSession';
import { LearningHome } from './LearningHome';
import './telegram.css';

const blankQuestion = (): Question => ({ question: '', options: ['', '', '', ''], correct: 0, explanation: '' });
type Screen = 'tests' | 'courses' | 'duels' | 'profile' | 'create-test' | 'create-course' | 'practice' | 'result' | 'course' | 'duel';

export default function TelegramApp() {
  const [me, setMe] = useState<Me | null>(null);
  const [bootError, setBootError] = useState('');
  const [error, setError] = useState('');
  const [screen, setScreen] = useState<Screen>('tests');
  const [items, setItems] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mine, setMine] = useState(false);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [questions, setQuestions] = useState<Question[]>([blankQuestion()]);
  const [source, setSource] = useState('');
  const [aiCount, setAiCount] = useState(5);
  const [showAi, setShowAi] = useState(false);
  const [aiConsent, setAiConsent] = useState(false);
  const [lessons, setLessons] = useState([{ title: '', content: '' }]);
  const [course, setCourse] = useState<Course | null>(null);
  const [lesson, setLesson] = useState(0);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const practiceExit = useRef<(() => void) | null>(null);
  const navigation = useRef<Screen[]>([]);
  const [learning, setLearning] = useState<Learning | null>(null);
  const [learningError, setLearningError] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [visibleCount, setVisibleCount] = useState(12);
  const [result, setResult] = useState<Result | null>(null);
  const [duelId, setDuelId] = useState<string | null>(null);
  const [duel, setDuel] = useState<Duel | null>(null);
  const [tick, setTick] = useState(Date.now());
  const [clockOffset, setClockOffset] = useState(0);
  const [copyNotice, setCopyNotice] = useState(false);
  const [duelDraft, setDuelDraft] = useState<{ key: string; value: Answer }>({ key: '', value: null });

  const go = useCallback((next: Screen) => {
    if (['tests', 'courses', 'duels', 'profile'].includes(next)) navigation.current = [];
    else navigation.current.push(screen);
    setError(''); setScreen(next); window.scrollTo({ top: 0 });
  }, [screen]);
  const back = useCallback(() => {
    if (screen === 'practice') { practiceExit.current?.(); return; }
    setError(''); setScreen(navigation.current.pop() || (screen === 'course' || screen === 'create-course' ? 'courses' : 'tests')); window.scrollTo({ top: 0 });
  }, [screen]);
  const boot = useCallback(async () => {
    setBootError('');
    try {
      await loadTelegram();
      const tg = window.Telegram?.WebApp;
      tg?.ready(); tg?.expand();
      const session = await api<Me>('/me');
      setMe(session);
      const params = new URLSearchParams(window.location.search);
      const start = params.get('tgWebAppStartParam') || params.get('start') || '';
      if (/^duel_[a-f0-9]{32}$/.test(start)) { setDuelId(start.slice(5)); setScreen('duel'); }
      else if (['courses', 'duels', 'tests', 'profile'].includes(start)) setScreen(start as Screen);
      else if (start === 'newtest') { setShowAi(true); setScreen('create-test'); }
    } catch (e) { setBootError(message(e)); }
  }, []);
  useEffect(() => { void boot(); }, [boot]);
  useEffect(() => {
    const title = document.title;
    document.title = 'Learn × Aziral — Telegram';
    return () => { document.title = title; };
  }, []);
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg) return;
    if (['tests', 'courses', 'duels', 'profile'].includes(screen)) tg.BackButton.hide(); else tg.BackButton.show();
    tg.BackButton.onClick(back);
    return () => { tg.BackButton.offClick(back); tg.BackButton.hide(); };
  }, [screen, back, me]);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (['practice', 'create-test', 'create-course'].includes(screen)) tg?.enableClosingConfirmation?.(); else tg?.disableClosingConfirmation?.();
    return () => tg?.disableClosingConfirmation?.();
  }, [screen, me]);
  const refreshLearning = useCallback(async (signal?: AbortSignal) => {
    try { setLearning(await api<Learning>('/learning', 'GET', undefined, signal)); setLearningError(''); }
    catch (e) { if (!signal?.aborted) setLearningError(message(e)); }
  }, []);
  useEffect(() => {
    if (!me || !['tests', 'courses', 'duels', 'profile'].includes(screen)) return;
    const c = new AbortController(); void refreshLearning(c.signal); return () => c.abort();
  }, [me, screen, refreshLearning]);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (!['tests', 'courses', 'duels'].includes(screen) || !me) return;
    setLoading(true);
    try { setItems(await api<Summary[]>(`/${screen === 'courses' ? 'courses' : 'tests'}?mine=${mine}`, 'GET', undefined, signal)); }
    catch (e) { if (!signal?.aborted) setError(message(e)); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [screen, mine, me]);
  useEffect(() => { const c = new AbortController(); void refresh(c.signal); return () => c.abort(); }, [refresh]);
  useEffect(() => {
    if (screen !== 'duel' || !duelId || !me) return;
    const c = new AbortController();
    let timeout: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const d = await api<Duel>(`/duels/${duelId}`, 'GET', undefined, c.signal);
        if (c.signal.aborted) return;
        setDuel(d); setClockOffset(d.serverNow - Date.now()); setError('');
        if (d.state === 'finished' || d.state === 'expired') return;
      } catch (e) { if (!c.signal.aborted) setError(message(e)); }
      if (!c.signal.aborted) timeout = setTimeout(poll, 1500);
    }
    void poll();
    const timer = setInterval(() => setTick(Date.now()), 200);
    return () => { c.abort(); clearTimeout(timeout); clearInterval(timer); };
  }, [screen, duelId, me]);

  async function action(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError('');
    try { await fn(); } catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  function newTest() {
    setEditing(null); setTitle(''); setSubject(''); setQuestions([blankQuestion()]); setSource(''); setShowAi(false); setAiConsent(false); go('create-test');
  }
  async function startPractice(id: string) {
    const active = learning?.active.find(a => a.testId === id);
    if (active) { await openAttempt(active.id); return; }
    const a = await api<Attempt>(`/tests/${id}/attempts`, 'POST');
    setAttempt(a); go('practice');
  }
  async function startDuel(id: string) {
    const d = await api<{ id: string }>('/duels', 'POST', { testId: id });
    setDuel(null); setDuelId(d.id); setCopyNotice(false); go('duel');
  }
  async function publish(item: Summary, table: string) {
    await api(`/${table}/${item.id}/publish`, 'PATCH', { published: !item.published });
    await refresh();
  }
  async function editTest(id: string) {
    const t = await api<{ title: string; subject: string; questions: Question[] }>(`/tests/${id}/edit`);
    setEditing(id); setTitle(t.title); setSubject(t.subject); setQuestions(t.questions); setSource(''); setAiConsent(false); setShowAi(false); go('create-test');
  }
  async function openAttempt(id: string) {
    const a = await api<Attempt>(`/attempts/${id}`); setAttempt(a);
    if (a.result) { setResult(a.result); go('result'); } else go('practice');
  }
  async function retryPractice(mode: 'all' | 'errors') {
    if (!attempt) return;
    setAttempt(await api<Attempt>(`/attempts/${attempt.id}/retry`, 'POST', { mode })); setScreen('practice'); window.scrollTo({ top: 0 });
  }
  const library = ['tests', 'courses', 'duels'].includes(screen);
  const home = library || screen === 'profile';
  const subjects = [...new Set(items.map(i => i.subject).filter((s): s is string => !!s))].sort();
  const filtered = items.filter(i => (i.title + ' ' + (i.subject || '')).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()) && (!subjectFilter || i.subject === subjectFilter));
  const seconds = duel ? Math.max(0, Math.ceil(((duel.state === 'countdown' ? duel.startAt : duel.endsAt) || 0) - (tick + clockOffset)) / 1000) : 0;

  if (!me) return <main className="tg-app tg-boot"><GraduationCap size={40} aria-hidden="true" /><h1>Learn × Aziral</h1>{bootError ? <><p role="alert">{bootError}</p><button onClick={() => void boot()}>Попробовать снова</button><a href="https://t.me/Learn_Aziral_bot">Открыть бота в Telegram</a></> : <p role="status">Подключаем приложение…</p>}</main>;

  return <div className="tg-app">
    <header className="tg-header"><button onClick={home ? () => go('tests') : back} className="tg-brand" aria-label="Learn × Aziral — главная"><span className="tg-brand-icon"><img src="/telegram/learn-aziral-logo.webp" alt="" width={44} height={44} /></span><span>LEARN<span className="tg-brand-sub">× AZIRAL</span></span></button><button className="tg-avatar tg-profile-button" disabled={!home} aria-label="Мой прогресс" onClick={() => go('profile')}>{me.user.name.slice(0, 1)}</button></header>
    <main className="tg-main">
      {me.dev && <p className="tg-notice">Локальный просмотр · вход через Telegram на рабочем сервере</p>}
      {!home && screen !== 'practice' && <button className="tg-back" onClick={back}><ArrowLeft size={18} aria-hidden="true" />Назад</button>}
      {error && <div className="tg-error" role="alert"><span>{error}</span><button className="tg-icon-button" aria-label="Закрыть сообщение" onClick={() => setError('')}><X size={18} aria-hidden="true" /></button></div>}

      {screen === 'profile' && <LearningHome me={me} learning={learning} error={learningError} busy={busy} onRetry={() => void refreshLearning()} onOpen={id => void action(() => openAttempt(id))} onBrowse={() => go('tests')} onRefreshAccount={() => void action(async () => { setMe(await api<Me>('/me')); })} />}
      {library && <>
        <div className="tg-eyebrow">ТВОЙ УЧЕБНЫЙ РИТМ</div>
        <h1>{screen === 'courses' ? <>Большие темы.<br /><em>Маленькие шаги.</em></> : screen === 'duels' ? <>Знания сильнее,<br /><em>когда вместе.</em></> : <>Готовься к большему.<br /><em>По одному вопросу.</em></>}</h1>
        <p className="tg-intro">{screen === 'courses' ? 'Собирай материал в курсы и отмечай пройденные уроки.' : screen === 'duels' ? 'Выбери тест, отправь другу приглашение и сразитесь на знания и скорость.' : 'Создавай свои тесты, разбирай ошибки и вызывай друзей на дуэль.'}</p>
        <div className="tg-actions"><button className="tg-primary" onClick={screen === 'courses' ? () => { setTitle(''); setSubject(''); setLessons([{ title: '', content: '' }]); go('create-course'); } : newTest}><Plus size={20} aria-hidden="true" />{screen === 'courses' ? 'Создать курс' : 'Создать тест'}</button>{screen === 'tests' && <button className="tg-secondary" onClick={() => go('duels')}><Swords size={20} aria-hidden="true" />Дуэль</button>}</div>
        {screen === 'tests' && learning?.active[0] && <section className="tg-resume"><div><span className="tg-eyebrow">ПРОДОЛЖИ С ТОГО ЖЕ МЕСТА</span><h2>{learning.active[0].title}</h2><p className="tg-muted">Ответов: {learning.active[0].answered} из {learning.active[0].total} · сохранено в аккаунте</p></div><button className="tg-primary" disabled={busy} onClick={() => void action(() => openAttempt(learning.active[0].id))}>Продолжить<ArrowRight size={18} aria-hidden="true" /></button></section>}
        <section className="tg-tip"><span className="tg-tip-icon">{screen === 'duels' ? <Clock3 size={24} aria-hidden="true" /> : <Sparkles size={24} aria-hidden="true" />}</span><div><strong>{screen === 'duels' ? '15 секунд. Один ответ. Твой ход.' : 'От темы до теста — с ИИ'}</strong><p>{screen === 'duels' ? 'Одинаковые вопросы для двоих. Правильный ответ важнее скорости; быстрый ответ даёт бонус.' : 'Укажи тему или вставь конспект. Проверь предложенные вопросы перед сохранением.'}</p></div></section>
        <section aria-label="Библиотека"><div className="tg-section-title"><h2>{screen === 'courses' ? 'Курсы' : screen === 'duels' ? 'Выбери тест для дуэли' : 'Библиотека тестов'}</h2><span>{items.length}</span></div>
          <div className="tg-filter"><label className="tg-search"><Search size={18} aria-hidden="true" /><input aria-label="Поиск по названию или предмету" placeholder="Найти свою тему" value={query} onChange={e => { setQuery(e.target.value); setVisibleCount(12); }} /></label>{query && <button className="tg-icon-button" aria-label="Очистить поиск" onClick={() => { setQuery(''); setVisibleCount(12); }}><X size={18} aria-hidden="true" /></button>}<button className={mine ? 'tg-filter-active' : 'tg-secondary'} aria-pressed={mine} onClick={() => { setMine(!mine); setVisibleCount(12); setSubjectFilter(''); }}>Мои</button></div>
          {subjects.length > 1 && <label className="tg-subject-filter">Предмет<select value={subjectFilter} onChange={e => { setSubjectFilter(e.target.value); setVisibleCount(12); }}><option value="">Все предметы</option>{subjects.map(s => <option key={s} value={s}>{s}</option>)}</select></label>}
          {!loading && <p className="tg-small" role="status">Найдено: {filtered.length}{mine ? ' · твои материалы' : ''}</p>}
          {loading ? <p className="tg-muted" role="status">Загружаем материалы…</p> : filtered.length ? <div className="tg-list">{filtered.slice(0, visibleCount).map(item => <article className="tg-card" key={item.id}><div className="tg-card-top"><span className="tg-tag">{screen === 'courses' ? 'КУРС' : item.subject || 'ПРАКТИКА'}</span>{item.mine && <span className="tg-muted">{item.published ? 'Опубликован' : 'Черновик'}</span>}</div><h3>{item.title}</h3><p className="tg-muted">{item.source && <span className="tg-tag">С сайта{item.price ? ` · ${item.price} ₸` : ''}</span>} {item.count} {countNoun(item.count, screen === 'courses' ? ['урок', 'урока', 'уроков'] : ['вопрос', 'вопроса', 'вопросов'])}{item.mine ? ' · твой материал' : ''}</p><div className="tg-card-actions"><button className="tg-primary" disabled={busy} onClick={() => void action(async () => {
            if (screen === 'courses') { const c = await api<Course>(`/courses/${item.id}`); setCourse(c); setLesson(Math.max(0, c.lessons.findIndex((_, i) => !c.completed.includes(i)))); go('course'); }
            else if (screen === 'duels') await startDuel(item.id); else await startPractice(item.id);
          })}>{screen === 'courses' ? 'Учиться' : screen === 'duels' ? 'Создать дуэль' : learning?.active.some(a => a.testId === item.id) ? 'Продолжить' : 'Тренироваться'}<ArrowRight size={17} aria-hidden="true" /></button>{screen === 'tests' && <button className="tg-icon-button" disabled={busy} aria-label={`Дуэль по тесту ${item.title}`} onClick={() => void action(() => startDuel(item.id))}><Swords size={20} aria-hidden="true" /></button>}</div>{item.websiteUrl && <a className="tg-source-link" href={item.websiteUrl} target="_blank" rel="noopener noreferrer">Открыть на сайте</a>}{item.mine && <div className="tg-owner-actions">{screen !== 'courses' && <button disabled={busy} onClick={() => void action(() => editTest(item.id))}>Редактировать</button>}<button disabled={busy} onClick={() => void action(() => publish(item, screen === 'courses' ? 'courses' : 'tests'))}>{item.published ? 'Снять с публикации' : 'Опубликовать для всех'}</button></div>}</article>)}</div> : <div className="tg-empty"><BookOpen size={32} aria-hidden="true" /><h3>{query ? 'Пока ничего не нашлось' : 'Здесь начинается твоя коллекция'}</h3><p>{query ? 'Попробуй другое название или предмет.' : 'Создай первый материал вручную или начни с темы для ИИ.'}</p></div>}
          {!loading && filtered.length > visibleCount && <button className="tg-secondary tg-wide" onClick={() => setVisibleCount(visibleCount + 12)}>Показать ещё · осталось {filtered.length - visibleCount}</button>}
        </section>
      </>}

      {screen === 'create-test' && <form onSubmit={e => { e.preventDefault(); void action(async () => {
        await api(editing ? `/tests/${editing}` : '/tests', editing ? 'PUT' : 'POST', { title, subject, questions }); setMine(true); go('tests');
      }); }}>
        <div className="tg-eyebrow">ТВОИ ЗНАНИЯ — ТВОИ ПРАВИЛА</div><h1>{editing ? 'Редактор теста' : 'Собери свой тест'}</h1><p className="tg-intro">Начни с темы. Добавь вопросы сам или попроси ИИ помочь.</p>
        <label className="tg-field">Название теста<input required minLength={3} maxLength={160} value={title} onChange={e => setTitle(e.target.value)} placeholder="Например, биология: строение клетки" /></label>
        <label className="tg-field">Предмет<input maxLength={80} value={subject} onChange={e => setSubject(e.target.value)} placeholder="Биология, история, английский…" /></label>
        <button type="button" className="tg-ai-toggle" aria-expanded={showAi} onClick={() => setShowAi(!showAi)}><Sparkles size={20} aria-hidden="true" />{showAi ? 'Скрыть помощника' : 'Помочь с вопросами'}</button>
        {showAi && <section className="tg-ai-panel"><h2>Дай ИИ отправную точку</h2><p>Темой станет название теста. Можно добавить свой учебный материал.</p><label className="tg-field">Конспект — необязательно<textarea rows={5} maxLength={12000} value={source} onChange={e => setSource(e.target.value)} placeholder="Вставь учебный текст без личных данных" /></label><label className="tg-field">Количество вопросов<select value={aiCount} onChange={e => setAiCount(Number(e.target.value))}>{[3, 5, 10].map(n => <option key={n} value={n}>{n} {countNoun(n, ['вопрос', 'вопроса', 'вопросов'])}</option>)}</select></label><p className="tg-small">Тема и конспект будут отправлены Google Gemini. На бесплатном тарифе Google может использовать их для улучшения сервисов.</p><label className="tg-check"><input type="checkbox" checked={aiConsent} onChange={e => setAiConsent(e.target.checked)} />Разрешаю отправить этот учебный материал в Gemini</label><button className="tg-primary" type="button" disabled={busy || !me.aiAvailable || !aiConsent || title.trim().length < 3} onClick={() => void action(async () => {
          const generated = await api<{ questions: Question[] }>('/ai/generate', 'POST', { topic: title, source, count: aiCount });
          setQuestions(prev => [...prev.filter(q => q.question.trim()), ...generated.questions].slice(0, 30)); setShowAi(false);
        })}>{busy ? <Loader2 className="tg-spin" size={18} aria-hidden="true" /> : <Sparkles size={18} aria-hidden="true" />}Сгенерировать вопросы</button>{!me.aiAvailable && <p className="tg-muted">ИИ ещё не подключён на сервере. Ручное создание доступно.</p>}</section>}
        <div className="tg-section-title"><h2>Вопросы</h2><span>{questions.length}/30</span></div>
        {questions.map((q, i) => <fieldset className="tg-question-editor" key={i}><legend>Вопрос {i + 1}</legend><div className="tg-editor-tools"><span className="tg-muted">Один правильный ответ</span><button type="button" className="tg-icon-button" disabled={questions.length === 1 || busy} aria-label={`Удалить вопрос ${i + 1}`} onClick={() => setQuestions(questions.filter((_, j) => i !== j))}><Trash2 size={18} aria-hidden="true" /></button></div><label className="tg-field">Текст вопроса<textarea required rows={2} maxLength={1500} value={q.question} onChange={e => setQuestions(questions.map((v, j) => j === i ? { ...v, question: e.target.value } : v))} /></label><p className="tg-small">Выбери правильный вариант переключателем.</p>{q.options.map((option, n) => <div className="tg-option-editor" key={n}><label className="tg-radio"><input type="radio" name={`correct-${i}`} aria-label={`Вариант ${n + 1} — правильный для вопроса ${i + 1}`} checked={q.correct === n} onChange={() => setQuestions(questions.map((v, j) => j === i ? { ...v, correct: n } : v))} /></label><input required aria-label={`Вариант ${n + 1} вопроса ${i + 1}`} maxLength={500} placeholder={`Вариант ${n + 1}`} value={option} onChange={e => setQuestions(questions.map((v, j) => j === i ? { ...v, options: v.options.map((o, k) => k === n ? e.target.value : o) } : v))} /></div>)}<label className="tg-field">Объяснение ответа<textarea rows={2} maxLength={2000} value={q.explanation} onChange={e => setQuestions(questions.map((v, j) => j === i ? { ...v, explanation: e.target.value } : v))} /></label></fieldset>)}
        <button type="button" className="tg-secondary tg-wide" disabled={questions.length >= 30 || busy} onClick={() => setQuestions([...questions, blankQuestion()])}><Plus size={18} aria-hidden="true" />Добавить вопрос</button><p className="tg-small">Проверь факты и ответы, особенно после генерации ИИ. Тест сохранится как личный черновик.</p><button className="tg-primary tg-wide" type="submit" disabled={busy}>{busy ? 'Сохраняем…' : 'Сохранить тест'}<Check size={18} aria-hidden="true" /></button>
      </form>}

      {screen === 'create-course' && <form onSubmit={e => { e.preventDefault(); void action(async () => { await api('/courses', 'POST', { title, description: subject, lessons }); setMine(true); go('courses'); }); }}><div className="tg-eyebrow">ОТ КОНСПЕКТА К КУРСУ</div><h1>Разложи тему по полочкам</h1><label className="tg-field">Название курса<input required minLength={3} maxLength={160} value={title} onChange={e => setTitle(e.target.value)} /></label><label className="tg-field">Короткое описание<textarea maxLength={1000} value={subject} onChange={e => setSubject(e.target.value)} /></label>{lessons.map((l, i) => <fieldset className="tg-question-editor" key={i}><legend>Урок {i + 1}</legend><label className="tg-field">Название урока<input required maxLength={160} value={l.title} onChange={e => setLessons(lessons.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} /></label><label className="tg-field">Материал<textarea required rows={8} maxLength={15000} value={l.content} onChange={e => setLessons(lessons.map((x, j) => j === i ? { ...x, content: e.target.value } : x))} /></label>{lessons.length > 1 && <button type="button" className="tg-secondary" onClick={() => setLessons(lessons.filter((_, j) => j !== i))}>Удалить урок</button>}</fieldset>)}<button type="button" className="tg-secondary tg-wide" disabled={lessons.length >= 30} onClick={() => setLessons([...lessons, { title: '', content: '' }])}><Plus size={18} aria-hidden="true" />Добавить урок</button><p className="tg-small">Курс сохранится как личный черновик. Его можно опубликовать в библиотеке.</p><button className="tg-primary tg-wide" disabled={busy}>Сохранить курс</button></form>}

      {screen === 'course' && course && <><div className="tg-eyebrow">{course.completed.length}/{course.lessons.length} УРОКОВ ПРОЙДЕНО</div><h1>{course.title}</h1><p className="tg-intro">{course.description}</p>{course.locked ? <div className="tg-notice"><p>Это платный курс сайта. Привяжи Telegram в профиле сайта; приложение проверит оплаченный доступ.</p><a href={course.websiteUrl} target="_blank" rel="noopener noreferrer">Открыть курс на сайте</a></div> : course.lessons.length ? <><div className="tg-lesson-tabs" aria-label="Уроки">{course.lessons.map((l, i) => <button key={i} aria-pressed={i === lesson} className={i === lesson ? 'tg-filter-active' : 'tg-secondary'} onClick={() => setLesson(i)}>{course.completed.includes(i) && <Check size={14} aria-hidden="true" />}{l.title}</button>)}</div><article className="tg-card tg-lesson"><h2>{course.lessons[lesson].title}</h2><p>{course.lessons[lesson].content}</p>{safeLink(course.lessons[lesson].video_url) && <a className="tg-source-link" href={safeLink(course.lessons[lesson].video_url)} target="_blank" rel="noopener noreferrer">Открыть видеоурок</a>}{course.lessons[lesson].task_description && <p>{course.lessons[lesson].task_description}</p>}{course.lessons[lesson].task_starter_code && <pre><code>{course.lessons[lesson].task_starter_code}</code></pre>}</article>{!!course.lessons[lesson].quizCount && <button className="tg-secondary tg-wide" disabled={busy} onClick={() => void action(() => startPractice(`lesson-${course.lessons[lesson].id}`))}>Тест к этому уроку<GraduationCap size={18} aria-hidden="true" /></button>}<button className="tg-primary tg-wide" disabled={busy || course.completed.includes(lesson)} onClick={() => void action(async () => { await api(`/courses/${course.id}/complete`, 'POST', { lesson }); setCourse({ ...course, completed: [...course.completed, lesson] }); })}><CheckCircle2 size={18} aria-hidden="true" />{course.completed.includes(lesson) ? 'Урок пройден' : 'Отметить пройденным'}</button>{lesson < course.lessons.length - 1 && <button className="tg-secondary tg-wide" onClick={() => setLesson(lesson + 1)}>Следующий урок<ArrowRight size={18} aria-hidden="true" /></button>}</> : <p className="tg-notice">Уроки этого курса пока не опубликованы.</p>}{course.websiteUrl && <a className="tg-source-link" href={course.websiteUrl} target="_blank" rel="noopener noreferrer">Курс на сайте</a>}</>}

      {screen === 'practice' && attempt && <PracticeSession key={attempt.id} attempt={attempt} exitRef={practiceExit} onLeave={() => { setScreen(navigation.current.pop() || 'tests'); void refreshLearning(); window.scrollTo({ top: 0 }); }} onResult={value => { setResult(value); setScreen('result'); window.scrollTo({ top: 0 }); }} />}

      {screen === 'result' && result && <><div className="tg-result-hero"><Trophy size={48} aria-hidden="true" /><div className="tg-eyebrow">ЕЩЁ ОДИН ШАГ ВПЕРЁД</div><h1>{result.correct}<span> / {result.total}</span></h1><p>{result.correct === result.total ? 'Отлично! Все ответы верные.' : 'Разберём ошибки и закрепим знания.'}</p></div><div className="tg-actions">{result.correct < result.total && <button className="tg-primary" disabled={busy} onClick={() => void action(() => retryPractice('errors'))}>Повторить ошибки · {result.total - result.correct}</button>}<button className="tg-secondary" disabled={busy} onClick={() => void action(() => retryPractice('all'))}>Пройти ещё раз</button><button className="tg-secondary" onClick={back}>{navigation.current.at(-1) === 'course' ? 'Вернуться к уроку' : navigation.current.at(-1) === 'profile' ? 'К прогрессу' : 'В библиотеку'}<ArrowRight size={18} aria-hidden="true" /></button></div><h2 className="tg-review-heading">Разбор ответов</h2>{result.review.map((q, i) => <article key={i} className="tg-card"><span className={q.isCorrect ? 'tg-correct' : 'tg-incorrect'}>{q.isCorrect ? 'Верно' : q.answer === null ? 'Без ответа' : 'Нужно повторить'}</span><h3>{i + 1}. {q.question}</h3>{!q.isCorrect && q.answer !== null && <p>Твой ответ: {choiceText(q, q.answer)}</p>}<p><strong>Правильный ответ:</strong> {choiceText(q, q.correct)}</p>{q.explanation && <p className="tg-muted">{q.explanation}</p>}</article>)}</>}

      {screen === 'duel' && <>{!duel ? <p role="status">Загружаем дуэль…</p> : <>
        <div className="tg-eyebrow">ДУЭЛЬ / {duel.total} ВОПРОСОВ</div><h1 className="tg-quiz-title">{duel.title}</h1><div className="tg-players">{duel.players.map(p => <span key={p.id}><span className="tg-avatar">{p.name.slice(0, 1)}</span>{p.name}{p.id === me.user.id ? ' (ты)' : ''}</span>)}{duel.players.length === 1 && <span className="tg-muted">Друг ещё не вошёл</span>}</div>
        {duel.state === 'waiting' && <section className="tg-duel-lobby"><Swords size={48} aria-hidden="true" /><h2>{duel.member ? 'Осталось позвать друга' : 'Тебя вызывают на дуэль'}</h2><p>После входа второго участника — 3 секунды на подготовку. Затем по 15 секунд на вопрос. Приглашение действует 15 минут.</p>{!duel.member ? <button className="tg-primary" disabled={busy} onClick={() => void action(async () => { setDuel(await api<Duel>(`/duels/${duel.id}/join`, 'POST')); })}>Принять вызов<ArrowRight size={18} aria-hidden="true" /></button> : <><button className="tg-primary" onClick={() => shareDuel(duel.inviteUrl)}><Send size={18} aria-hidden="true" />Пригласить друга</button><button className="tg-secondary" onClick={() => void action(async () => { await navigator.clipboard.writeText(duel.inviteUrl); setCopyNotice(true); })}><Copy size={18} aria-hidden="true" />{copyNotice ? 'Ссылка скопирована' : 'Копировать ссылку'}</button><label className="tg-field">Ссылка приглашения<input readOnly aria-label="Ссылка приглашения" value={duel.inviteUrl} onFocus={e => e.currentTarget.select()} /></label></>}</section>}
        {duel.state === 'countdown' && <div className="tg-countdown" role="status"><p>Приготовься!</p><strong>{Math.ceil(seconds)}</strong></div>}
        {duel.state === 'playing' && duel.question && <><div className="tg-section-title"><span>Вопрос {duel.round + 1}/{duel.total}</span><span className="tg-timer"><Clock3 size={18} aria-hidden="true" />{Math.ceil(seconds)} с</span></div><section className="tg-quiz"><h2>{duel.question.question}</h2><QuestionChoices question={duel.question} value={duel.answer ?? (duelDraft.key === `${duel.id}:${duel.round}` ? duelDraft.value : null)} disabled={busy || duel.answer != null || seconds <= 0} onChange={answer => {
          if (duel.question?.type === 'multi' || duel.question?.type === 'order') setDuelDraft({ key: `${duel.id}:${duel.round}`, value: answer });
          else void action(async () => { const updated = await api<Duel>(`/duels/${duel.id}/answer`, 'POST', { round: duel.round, choice: answer }); setDuel({ ...updated, inviteUrl: duel.inviteUrl }); });
        }} />{(duel.question.type === 'multi' || duel.question.type === 'order') && duel.answer == null && <button className="tg-primary tg-wide" disabled={busy || seconds <= 0 || (duel.question.type === 'multi' && !(duelDraft.key === `${duel.id}:${duel.round}` && Array.isArray(duelDraft.value) && duelDraft.value.length))} onClick={() => void action(async () => {
          const choice = duelDraft.key === `${duel.id}:${duel.round}` ? duelDraft.value : duel.question?.options.map((_, i) => i);
          const updated = await api<Duel>(`/duels/${duel.id}/answer`, 'POST', { round: duel.round, choice }); setDuel({ ...updated, inviteUrl: duel.inviteUrl });
        })}>Отправить ответ</button>}{duel.answer != null && <p className="tg-notice" role="status">Ответ принят. Следующий вопрос после таймера.</p>}</section></>}
        {duel.state === 'playing' && !duel.member && <p className="tg-notice">В этой дуэли уже есть два участника. Создай свою в разделе «Дуэли».</p>}
        {duel.state === 'expired' && <p className="tg-notice">Время приглашения истекло. Создай новую дуэль из библиотеки тестов.</p>}
        {duel.state === 'finished' && duel.results && <section className="tg-result-hero"><Trophy size={48} aria-hidden="true" /><h2>{duel.results[0].score === duel.results[1].score ? 'Ничья!' : duel.results[0].id === me.user.id ? 'Твоя победа!' : `Победил ${duel.results[0].name}`}</h2>{duel.results.map((p, i) => <div key={p.id} className="tg-score"><strong>{i + 1}. {p.name}</strong><span>{p.correct}/{duel.total} верно · {p.score} очков</span></div>)}<p>За верный ответ — 1000 очков, за скорость — до 150 дополнительных.</p><button className="tg-primary" onClick={() => go('duels')}>Ещё одну дуэль<Swords size={18} aria-hidden="true" /></button></section>}
      </>}</>}
    </main>
    {home && <nav className="tg-bottom-nav" aria-label="Разделы приложения">{([{ id: 'tests', label: 'Тесты', icon: GraduationCap }, { id: 'courses', label: 'Курсы', icon: BookOpen }, { id: 'duels', label: 'Дуэли', icon: Swords }, { id: 'profile', label: 'Прогресс', icon: UserRound }] as const).map(tab => <button key={tab.id} aria-current={screen === tab.id ? 'page' : undefined} onClick={() => { setQuery(''); setSubjectFilter(''); setVisibleCount(12); go(tab.id); }}><tab.icon size={22} aria-hidden="true" /><span>{tab.label}</span></button>)}</nav>}
  </div>;
}

function message(e: unknown) { return e instanceof Error ? e.message : 'Не удалось выполнить действие'; }

function countNoun(n: number, forms: [string, string, string]) {
  const tail = n % 100;
  return forms[tail >= 11 && tail <= 14 ? 2 : n % 10 === 1 ? 0 : n % 10 >= 2 && n % 10 <= 4 ? 1 : 2];
}

function safeLink(value?: string) {
  try { const url = new URL(value || ''); return ['http:', 'https:'].includes(url.protocol) ? url.href : undefined; } catch { return undefined; }
}
