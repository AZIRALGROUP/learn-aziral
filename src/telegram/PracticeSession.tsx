import { useCallback, useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { ArrowLeft, ArrowRight, Check, Cloud, Loader2 } from 'lucide-react';
import { telegramApi as api } from './api';
import type { Answer, Attempt, Result } from './api';
import { QuestionChoices } from './QuestionChoices';

type Draft = { answers: Answer[]; questionIndex: number };
type Props = { attempt: Attempt; onLeave: () => void; onResult: (result: Result) => void; exitRef: MutableRefObject<(() => void) | null> };

export function PracticeSession({ attempt, onLeave, onResult, exitRef }: Props) {
  const [draft, setDraft] = useState<Draft>({ answers: attempt.answers, questionIndex: attempt.questionIndex });
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmFinish, setConfirmFinish] = useState(false);
  const revision = useRef(attempt.revision);
  const lastSaved = useRef(JSON.stringify(draft));
  const queue = useRef(Promise.resolve());
  const latest = useRef(draft);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const save = useCallback((value: Draft) => {
    const serialized = JSON.stringify(value);
    const job = queue.current.catch(() => {}).then(async () => {
      if (lastSaved.current === serialized) return;
      if (mounted.current) setSaving(true);
      try {
        const saved = await api<{ revision: number }>(`/attempts/${attempt.id}/save`, 'PUT', { ...value, revision: revision.current });
        revision.current = saved.revision; lastSaved.current = serialized;
        if (mounted.current) setError('');
      } catch (e) {
        if (mounted.current) setError(e instanceof Error ? e.message : 'Ответы пока не сохранены. Проверь соединение и повтори.');
        throw e;
      } finally { if (mounted.current) setSaving(false); }
    });
    queue.current = job;
    return job;
  }, [attempt.id]);
  const leave = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try { await save(latest.current); onLeave(); } catch { /* Keep the current answers visible for retry. */ }
    finally { if (mounted.current) setBusy(false); }
  }, [busy, save, onLeave]);
  useEffect(() => { exitRef.current = () => { void leave(); }; return () => { exitRef.current = null; }; }, [exitRef, leave]);
  function change(next: Draft) {
    latest.current = next; setDraft(next); setConfirmFinish(false);
    void save(next).catch(() => {});
  }
  async function finish() {
    if (busy) return;
    setBusy(true); setError('');
    try { await save(latest.current); onResult(await api<Result>(`/attempts/${attempt.id}/submit`, 'POST', { answers: latest.current.answers })); }
    catch (e) { setError(e instanceof Error ? e.message : 'Не удалось проверить тест. Попробуй снова.'); }
    finally { if (mounted.current) setBusy(false); }
  }
  const { answers, questionIndex } = draft;
  const answered = answers.filter(a => a !== null && (!Array.isArray(a) || a.length > 0)).length;
  const remaining = answers.length - answered;
  return <>
    <button className="tg-back" disabled={busy} onClick={() => void leave()}><ArrowLeft size={18} aria-hidden="true" />Сохранить и выйти</button>
    <div className="tg-eyebrow">ТРЕНИРОВКА / {questionIndex + 1} ИЗ {attempt.questions.length}</div>
    <h1 className="tg-quiz-title">{attempt.title}</h1>
    <p className="tg-save-status" role="status">{saving ? <Loader2 size={16} className="tg-spin" aria-hidden="true" /> : <Cloud size={16} aria-hidden="true" />}{error ? 'Есть несохранённые изменения' : saving ? 'Сохраняем ответы…' : 'Ответы сохранены'}</p>
    {error && <div className="tg-error" role="alert"><span>{error}</span><button className="tg-secondary" disabled={busy || saving} onClick={() => void save(latest.current).catch(() => {})}>Повторить</button></div>}
    <progress max={attempt.questions.length} value={answered} aria-label="Количество отвеченных вопросов" />
    <nav className="tg-question-map" aria-label="Перейти к вопросу">{attempt.questions.map((_, i) => <button key={i} disabled={busy} aria-current={i === questionIndex ? 'step' : undefined} aria-label={`Вопрос ${i + 1}${answers[i] !== null && (!Array.isArray(answers[i]) || answers[i].length > 0) ? ', ответ выбран' : ', без ответа'}`} onClick={() => change({ ...draft, questionIndex: i })}>{i + 1}{answers[i] !== null && (!Array.isArray(answers[i]) || answers[i].length > 0) && <Check size={12} aria-hidden="true" />}</button>)}</nav>
    <section className="tg-quiz"><h2>{attempt.questions[questionIndex].question}</h2><QuestionChoices question={attempt.questions[questionIndex]} value={answers[questionIndex]} disabled={busy} onChange={answer => {
      change({ ...draft, answers: answers.map((a, j) => j === questionIndex ? answer : a) });
      window.Telegram?.WebApp.HapticFeedback?.selectionChanged();
    }} /></section>
    <div className="tg-actions"><button className="tg-secondary" disabled={questionIndex === 0 || busy} onClick={() => change({ ...draft, questionIndex: questionIndex - 1 })}>Назад</button>{questionIndex < attempt.questions.length - 1 ? <button className="tg-primary" disabled={busy} onClick={() => change({ ...draft, questionIndex: questionIndex + 1 })}>Дальше<ArrowRight size={18} aria-hidden="true" /></button> : <button className="tg-primary" disabled={busy} onClick={() => remaining ? setConfirmFinish(true) : void finish()}>{busy ? 'Проверяем…' : 'Завершить тест'}</button>}</div>
    {confirmFinish && <section className="tg-notice" aria-label="Подтверждение завершения"><strong>Без ответа: {remaining} из {answers.length}</strong><p>Вернись к пропущенным вопросам или заверши без них.</p><div className="tg-actions"><button className="tg-secondary" disabled={busy} onClick={() => change({ ...draft, questionIndex: answers.findIndex(a => a === null || (Array.isArray(a) && !a.length)) })}>К пропущенным</button><button className="tg-primary" disabled={busy} onClick={() => void finish()}>Завершить сейчас</button></div></section>}
  </>;
}
