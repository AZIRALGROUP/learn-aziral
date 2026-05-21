import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { usePageTitle } from "../hooks/usePageTitle";
import { testsApi } from "../../api/client";
import type { TestWithQuestions, TestQuestion } from "../../api/client";
import {
  BookOpen, CheckCircle2, ClipboardList, ChevronLeft, ChevronRight,
  RotateCcw, Zap, Shuffle, ArrowLeft, XCircle, Clock, Flag,
  Keyboard, Trophy, Target, AlertCircle, Sparkles,
} from "lucide-react";

type Mode = "instant" | "batch";

/* ── helpers ────────────────────────────────────────────── */
function arrEq(a: number[], b: number[]) {
  if (a.length !== b.length) return false;
  const sa = [...a].sort(), sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/* ── ModeSelector ───────────────────────────────────────── */
function ModeSelector({ test, onStart }: {
  test: TestWithQuestions;
  onStart: (m: Mode, shuffle: boolean) => void;
}) {
  const [selected, setSelected] = useState<Mode>("instant");
  const [shuffle, setShuffle] = useState(false);

  const multiCount = test.questions.filter(q => q.type === "multi").length;
  const tfCount = test.questions.filter(q => q.type === "tf").length;
  const orderCount = test.questions.filter(q => q.type === "order").length;
  const singleCount = test.questions.filter(q => q.type === "single").length;
  const estimatedMin = Math.max(1, Math.ceil(test.questions.length * 0.5));

  return (
    <div className="space-y-6">
      {/* stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-white border border-[#E8E5DF] rounded-xl p-3 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-[#0047FF]/10 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4 text-[#0047FF]" />
          </div>
          <div className="min-w-0">
            <div className="text-lg font-bold text-[#1A1A1A] leading-tight">{test.questions.length}</div>
            <div className="text-[11px] text-[#6B6B6B] leading-tight">всего вопросов</div>
          </div>
        </div>
        <div className="bg-white border border-[#E8E5DF] rounded-xl p-3 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="min-w-0">
            <div className="text-lg font-bold text-[#1A1A1A] leading-tight">~{estimatedMin}</div>
            <div className="text-[11px] text-[#6B6B6B] leading-tight">минут</div>
          </div>
        </div>
        {(singleCount > 0 || multiCount > 0) && (
          <div className="bg-white border border-[#E8E5DF] rounded-xl p-3 flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
              <Target className="w-4 h-4 text-purple-600" />
            </div>
            <div className="min-w-0">
              <div className="text-lg font-bold text-[#1A1A1A] leading-tight">{singleCount + multiCount}</div>
              <div className="text-[11px] text-[#6B6B6B] leading-tight">
                {multiCount > 0 ? `с ответами (${multiCount} мульти)` : "с ответами"}
              </div>
            </div>
          </div>
        )}
        {(tfCount > 0 || orderCount > 0) && (
          <div className="bg-white border border-[#E8E5DF] rounded-xl p-3 flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-amber-600" />
            </div>
            <div className="min-w-0">
              <div className="text-lg font-bold text-[#1A1A1A] leading-tight">{tfCount + orderCount}</div>
              <div className="text-[11px] text-[#6B6B6B] leading-tight">
                {tfCount > 0 && orderCount > 0 ? "Правда/Ложь + порядок" : tfCount > 0 ? "Правда/Ложь" : "Хронолог. порядок"}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* mode cards */}
      <div className="bg-white border border-[#E8E5DF] rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="text-center space-y-1">
          <div className="w-14 h-14 mx-auto bg-gradient-to-br from-[#0047FF] to-[#3366FF] rounded-2xl flex items-center justify-center mb-3 shadow-lg shadow-[#0047FF]/20">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-xl font-bold text-[#0A0A0A]">{test.title}</h2>
          <p className="text-sm text-[#6B6B6B]">Выберите режим прохождения</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <button onClick={() => setSelected("instant")}
            className={`text-left p-5 rounded-xl border-2 transition-all ${
              selected === "instant"
                ? "border-[#0047FF] bg-[#0047FF]/5 shadow-sm shadow-[#0047FF]/10"
                : "border-[#E8E5DF] hover:border-[#0047FF]/40"
            }`}>
            <div className="flex items-start justify-between mb-3">
              <div className="w-9 h-9 rounded-lg bg-[#0047FF]/10 flex items-center justify-center">
                <Zap className="w-4 h-4 text-[#0047FF]" />
              </div>
              {selected === "instant" && (
                <span className="text-[10px] font-bold text-[#0047FF] uppercase tracking-wide">Выбрано</span>
              )}
            </div>
            <div className="font-semibold text-[#0A0A0A] text-sm">Проверять по ходу</div>
            <div className="text-xs text-[#6B6B6B] mt-1 leading-relaxed">Сразу видите ответ — правильный или нет. Идеально для обучения.</div>
          </button>
          <button onClick={() => setSelected("batch")}
            className={`text-left p-5 rounded-xl border-2 transition-all ${
              selected === "batch"
                ? "border-[#0047FF] bg-[#0047FF]/5 shadow-sm shadow-[#0047FF]/10"
                : "border-[#E8E5DF] hover:border-[#0047FF]/40"
            }`}>
            <div className="flex items-start justify-between mb-3">
              <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <ClipboardList className="w-4 h-4 text-purple-600" />
              </div>
              {selected === "batch" && (
                <span className="text-[10px] font-bold text-[#0047FF] uppercase tracking-wide">Выбрано</span>
              )}
            </div>
            <div className="font-semibold text-[#0A0A0A] text-sm">Экзамен</div>
            <div className="text-xs text-[#6B6B6B] mt-1 leading-relaxed">Ответьте на все вопросы, затем увидите итоговый результат.</div>
          </button>
        </div>

        {/* shuffle */}
        <button onClick={() => setShuffle(v => !v)}
          className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-all ${
            shuffle ? "border-[#0047FF]/30 bg-[#0047FF]/5" : "border-[#E8E5DF]"
          }`}>
          <div className="w-9 h-9 rounded-lg bg-[#6B6B6B]/10 flex items-center justify-center shrink-0">
            <Shuffle className="w-4 h-4 text-[#6B6B6B]" />
          </div>
          <div className="text-left flex-1">
            <div className="font-semibold text-sm text-[#0A0A0A]">Перемешать вопросы</div>
            <div className="text-xs text-[#6B6B6B]">Вопросы будут в случайном порядке каждый раз</div>
          </div>
          <div className={`w-10 h-6 rounded-full relative transition-colors ${shuffle ? "bg-[#0047FF]" : "bg-[#D1D1D1]"}`}>
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${shuffle ? "left-5" : "left-1"}`} />
          </div>
        </button>

        <button onClick={() => onStart(selected, shuffle)}
          className="w-full py-3.5 rounded-xl bg-[#0047FF] text-white font-semibold text-sm hover:bg-[#0038CC] active:scale-[0.98] transition-all shadow-sm shadow-[#0047FF]/20 inline-flex items-center justify-center gap-2">
          <Zap className="w-4 h-4" />
          Начать тест
        </button>

        {/* keyboard hint */}
        <div className="flex items-center justify-center gap-2 text-xs text-[#8A8A8A]">
          <Keyboard className="w-3.5 h-3.5" />
          <span>Поддерживаются горячие клавиши: 1-9, Enter, ← →, M</span>
        </div>
      </div>
    </div>
  );
}

/* ── Quiz ───────────────────────────────────────────────── */
function Quiz({ questions, mode, onFinish }: {
  questions: TestQuestion[];
  mode: Mode;
  onFinish: () => void;
}) {
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<(number[] | null)[]>(() => questions.map(() => null));
  const [checked, setChecked] = useState<boolean[]>(() => questions.map(() => false));
  const [marked, setMarked] = useState<boolean[]>(() => questions.map(() => false));
  const [showResults, setShowResults] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showNavigator, setShowNavigator] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(Date.now());

  /* timer */
  useEffect(() => {
    if (showResults) return;
    const tick = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt.current) / 1000));
    }, 1000);
    return () => clearInterval(tick);
  }, [showResults]);

  const q = questions[current];
  const total = questions.length;
  const userAns = answers[current] || [];
  const isChecked = checked[current];

  const select = useCallback((idx: number) => {
    if (isChecked) return;
    setAnswers(prev => {
      const next = [...prev];
      const cur = next[current] ? [...next[current]!] : [];
      if (q.type === "single" || q.type === "tf") {
        next[current] = [idx];
      } else {
        const pos = cur.indexOf(idx);
        if (pos >= 0) cur.splice(pos, 1);
        else if (cur.length < (q.count || 99)) cur.push(idx);
        next[current] = cur;
      }
      return next;
    });
  }, [current, isChecked, q]);

  const check = useCallback(() => {
    if (!answers[current]?.length) return;
    setChecked(prev => { const n = [...prev]; n[current] = true; return n; });
  }, [answers, current]);

  const next = useCallback(() => {
    if (mode === "batch" && current === total - 1) { setCurrent(0); return; }
    if (mode === "instant" && current === total - 1) { setShowResults(true); return; }
    setCurrent(c => c + 1);
  }, [mode, current, total]);

  const prev = useCallback(() => { if (current > 0) setCurrent(c => c - 1); }, [current]);

  const toggleMark = useCallback(() => {
    setMarked(prev => { const n = [...prev]; n[current] = !n[current]; return n; });
  }, [current]);

  const submitAll = () => {
    setChecked(questions.map((qq) => qq.type !== "order"));
    setShowResults(true);
  };

  /* keyboard shortcuts */
  useEffect(() => {
    if (showResults) return;
    function handleKey(e: KeyboardEvent) {
      // Ignore if focus is in an input field
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      // Number keys 1-9 -> select option
      if (q.type !== "order" && /^[1-9]$/.test(e.key)) {
        const idx = parseInt(e.key, 10) - 1;
        const maxIdx = q.type === "tf" ? 1 : q.options.length - 1;
        if (idx <= maxIdx) {
          e.preventDefault();
          select(idx);
        }
        return;
      }
      // Enter -> check or next
      if (e.key === "Enter") {
        e.preventDefault();
        if (mode === "instant" && !isChecked && q.type !== "order" && userAns.length > 0) {
          check();
        } else if (isChecked || q.type === "order" || mode === "batch") {
          next();
        }
        return;
      }
      // Arrow Left -> prev
      if (e.key === "ArrowLeft") { e.preventDefault(); prev(); return; }
      // Arrow Right -> next (only if can move forward)
      if (e.key === "ArrowRight") {
        e.preventDefault();
        if (mode === "batch" || isChecked || q.type === "order") next();
        return;
      }
      // M -> mark for review
      if (e.key === "m" || e.key === "M" || e.key === "ь") { e.preventDefault(); toggleMark(); return; }
      // ? -> toggle shortcuts
      if (e.key === "?" || (e.key === "/" && e.shiftKey)) { e.preventDefault(); setShowShortcuts(v => !v); return; }
      // N -> navigator
      if (e.key === "n" || e.key === "N" || e.key === "т") { e.preventDefault(); setShowNavigator(v => !v); return; }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [q, select, check, next, prev, toggleMark, isChecked, userAns.length, mode, showResults]);

  const answeredCount = answers.filter((a, i) => a && a.length > 0 && questions[i].type !== "order").length;
  const scorableCount = questions.filter(qq => qq.type !== "order").length;
  const markedCount = marked.filter(Boolean).length;

  /* ── Results ─────── */
  if (showResults) {
    let correctCount = 0, wrongCount = 0, unanswered = 0;
    questions.forEach((qq, i) => {
      if (qq.type === "order") return;
      const a = answers[i] || [];
      if (a.length === 0) { unanswered++; return; }
      if (arrEq(a, qq.correct)) correctCount++; else wrongCount++;
    });
    const pct = scorableCount ? Math.round((correctCount / scorableCount) * 100) : 0;
    const grade = pct >= 90 ? { emoji: "🏆", label: "Отлично! Вы готовы!", color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" }
                : pct >= 75 ? { emoji: "👍", label: "Хороший результат!", color: "text-[#0047FF]", bg: "bg-blue-50", border: "border-blue-200" }
                : pct >= 60 ? { emoji: "📖", label: "Можно лучше!", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" }
                : { emoji: "💪", label: "Нужно больше практики", color: "text-red-600", bg: "bg-red-50", border: "border-red-200" };

    return (
      <div className="space-y-6">
        {/* Hero card with score */}
        <div className={`relative overflow-hidden ${grade.bg} border ${grade.border} rounded-2xl p-8`}>
          <div className="relative text-center space-y-4">
            <div className="text-6xl">{grade.emoji}</div>
            <div className="space-y-1">
              <div className={`text-6xl font-extrabold ${grade.color}`}>{pct}%</div>
              <div className={`text-lg font-semibold ${grade.color}`}>{grade.label}</div>
            </div>
            <div className="flex gap-2 justify-center flex-wrap pt-2">
              <div className="bg-white/80 backdrop-blur rounded-xl px-4 py-2.5 min-w-[100px]">
                <div className="text-xl font-bold text-emerald-600">{correctCount}</div>
                <div className="text-[11px] text-[#6B6B6B] uppercase tracking-wide">Верно</div>
              </div>
              <div className="bg-white/80 backdrop-blur rounded-xl px-4 py-2.5 min-w-[100px]">
                <div className="text-xl font-bold text-red-500">{wrongCount}</div>
                <div className="text-[11px] text-[#6B6B6B] uppercase tracking-wide">Неверно</div>
              </div>
              {unanswered > 0 && (
                <div className="bg-white/80 backdrop-blur rounded-xl px-4 py-2.5 min-w-[100px]">
                  <div className="text-xl font-bold text-amber-500">{unanswered}</div>
                  <div className="text-[11px] text-[#6B6B6B] uppercase tracking-wide">Пропущ.</div>
                </div>
              )}
              <div className="bg-white/80 backdrop-blur rounded-xl px-4 py-2.5 min-w-[100px]">
                <div className="text-xl font-bold text-[#1A1A1A]">{formatTime(elapsed)}</div>
                <div className="text-[11px] text-[#6B6B6B] uppercase tracking-wide">Время</div>
              </div>
            </div>
            <div className="flex gap-3 justify-center pt-3 flex-wrap">
              <button onClick={onFinish} className="px-5 py-2.5 rounded-xl bg-[#0047FF] text-white text-sm font-medium hover:bg-[#0038CC] transition-colors inline-flex items-center gap-2 shadow-sm shadow-[#0047FF]/20">
                <RotateCcw className="w-4 h-4" /> Пройти ещё раз
              </button>
              <Link to="/study" className="px-5 py-2.5 rounded-xl bg-white border border-[#E8E5DF] text-sm font-medium text-[#3A3A3A] hover:bg-[#F0EEE9] transition-colors inline-flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" /> К тестам
              </Link>
            </div>
          </div>
        </div>

        {/* Performance breakdown */}
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="bg-white border border-[#E8E5DF] rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <div className="text-sm font-semibold text-[#1A1A1A]">{Math.round((correctCount / Math.max(1, scorableCount)) * 100)}% точность</div>
              <div className="text-xs text-[#6B6B6B]">из {scorableCount} вопросов</div>
            </div>
          </div>
          <div className="bg-white border border-[#E8E5DF] rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#0047FF]/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-[#0047FF]" />
            </div>
            <div>
              <div className="text-sm font-semibold text-[#1A1A1A]">{formatTime(elapsed)}</div>
              <div className="text-xs text-[#6B6B6B]">{Math.round(elapsed / Math.max(1, scorableCount))} сек/вопрос</div>
            </div>
          </div>
          <div className="bg-white border border-[#E8E5DF] rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Flag className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <div className="text-sm font-semibold text-[#1A1A1A]">{markedCount} помечено</div>
              <div className="text-xs text-[#6B6B6B]">для повторения</div>
            </div>
          </div>
        </div>

        {/* review */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-[#0A0A0A]">Разбор ответов</h3>
          <span className="text-xs text-[#8A8A8A]">{questions.length} {questions.length === 1 ? "вопрос" : "вопросов"}</span>
        </div>
        <div className="space-y-3">
          {questions.map((qq, i) => {
            if (qq.type === "order") {
              return (
                <div key={i} className="bg-white border border-[#0047FF]/10 rounded-xl p-4">
                  <div className="flex items-start gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-[#0047FF]/10 text-[#0047FF]">ПОРЯДОК</span>
                    <span className="font-semibold text-sm text-[#0A0A0A]">В{i + 1}</span>
                  </div>
                  <p className="text-sm text-[#3A3A3A] mb-2">{qq.question}</p>
                  <div className="text-sm text-[#0047FF]">
                    {qq.items.map(it => <div key={it.order}>{it.order}. {it.text}</div>)}
                  </div>
                </div>
              );
            }
            const a = answers[i] || [];
            const ok = a.length > 0 && arrEq(a, qq.correct);
            const skipped = a.length === 0;
            const labels = qq.type === "tf" ? ["Верно", "Неверно"] : qq.options;
            const yourText = a.length ? a.map(x => labels[x]).join(", ") : "(нет ответа)";
            const correctText = qq.correct.map(x => labels[x]).join(", ");
            return (
              <div key={i} className={`bg-white border rounded-xl p-4 ${ok ? "border-emerald-200" : skipped ? "border-amber-200" : "border-red-200"}`}>
                <div className="flex items-start gap-2 mb-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${ok ? "bg-emerald-100 text-emerald-700" : skipped ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                    {ok ? "✓" : skipped ? "—" : "✗"}
                  </span>
                  <span className="font-semibold text-sm text-[#0A0A0A]">В{i + 1}</span>
                  {marked[i] && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-medium">
                      <Flag className="w-3 h-3" /> Отмечен
                    </span>
                  )}
                </div>
                <p className="text-sm text-[#3A3A3A] mb-2">{qq.question}</p>
                {!ok && !skipped && <p className="text-xs text-red-500">Ваш ответ: {yourText}</p>}
                {skipped && <p className="text-xs text-amber-600">Вы пропустили этот вопрос</p>}
                <p className="text-xs text-emerald-600">Правильно: {correctText}</p>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  /* ── optionClass ──── */
  function optClass(idx: number) {
    if (isChecked) {
      if (q.correct.includes(idx)) return userAns.includes(idx) ? "border-emerald-500 bg-emerald-50" : "border-emerald-300 bg-emerald-50/50";
      if (userAns.includes(idx)) return "border-red-500 bg-red-50";
      return "border-[#E8E5DF]";
    }
    return userAns.includes(idx) ? "border-[#0047FF] bg-[#0047FF]/5" : "border-[#E8E5DF] hover:border-[#0047FF]/40";
  }

  const isCorrect = isChecked && arrEq(userAns, q.correct);
  const isMarked = marked[current];
  const remaining = q.type === "multi" ? Math.max(0, (q.count || 0) - userAns.length) : 0;

  return (
    <div className="space-y-4">
      {/* progress + timer + nav button */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 bg-[#E8E5DF] rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[#0047FF] to-[#3366FF] rounded-full transition-all" style={{ width: `${((current + 1) / total) * 100}%` }} />
        </div>
        <span className="text-xs text-[#6B6B6B] shrink-0 font-medium">{current + 1} / {total}</span>
        <button
          onClick={() => setShowNavigator(v => !v)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-[#E8E5DF] text-xs text-[#3A3A3A] hover:border-[#0047FF]/40 transition-colors"
          title="Навигатор вопросов (N)"
        >
          <ClipboardList className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Навигатор</span>
        </button>
        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-[#E8E5DF] text-xs text-[#3A3A3A] font-mono tabular-nums">
          <Clock className="w-3 h-3 text-[#8A8A8A]" />
          {formatTime(elapsed)}
        </div>
      </div>

      {/* Question navigator panel */}
      {showNavigator && (
        <div className="bg-white border border-[#E8E5DF] rounded-2xl p-3 sm:p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="text-sm font-semibold text-[#1A1A1A]">Все вопросы</div>
            <div className="flex items-center gap-x-3 gap-y-1 text-[11px] text-[#6B6B6B] flex-wrap">
              <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500" /> Верно</span>
              <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500" /> Неверно</span>
              <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#0047FF]" /> Сейчас</span>
              <span className="inline-flex items-center gap-1"><Flag className="w-2.5 h-2.5 text-amber-500" /> Отмечен</span>
            </div>
          </div>
          {/* Grid: 6 на узком mobile, 10 на больших mobile, 12 sm+, 16 md+, 20 lg+ */}
          <div className="grid grid-cols-6 min-[400px]:grid-cols-8 sm:grid-cols-10 md:grid-cols-12 lg:grid-cols-16 xl:grid-cols-20 gap-1.5">
            {questions.map((qq, i) => {
              const isAnswered = !!(answers[i] && answers[i]!.length > 0);
              const isQChecked = checked[i];
              const isCurrent = i === current;
              const isMarkedQ = marked[i];
              const isCorrectQ = isQChecked && qq.type !== "order" && isAnswered && arrEq(answers[i]!, qq.correct);
              const isWrongQ = isQChecked && qq.type !== "order" && isAnswered && !arrEq(answers[i]!, qq.correct);

              let bgClass = "bg-[#F5F3EE] text-[#6B6B6B] border-[#E8E5DF]";
              if (isCurrent) bgClass = "bg-[#0047FF] text-white border-[#0047FF] ring-2 ring-[#0047FF]/30";
              else if (isCorrectQ) bgClass = "bg-emerald-500 text-white border-emerald-500";
              else if (isWrongQ) bgClass = "bg-red-500 text-white border-red-500";
              else if (isAnswered) bgClass = "bg-[#0047FF]/20 text-[#0047FF] border-[#0047FF]/30";

              return (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className={`relative aspect-square min-h-[40px] rounded-lg border text-xs font-bold transition-all hover:scale-105 active:scale-95 ${bgClass}`}
                  title={`Вопрос ${i + 1}`}
                >
                  {i + 1}
                  {isMarkedQ && (
                    <Flag className="absolute -top-1 -right-1 w-3 h-3 text-amber-500 fill-amber-500" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* batch banner */}
      {mode === "batch" && (
        <div className="flex items-center justify-between bg-white border border-[#E8E5DF] rounded-xl px-4 py-3 flex-wrap gap-3">
          <div>
            <div className="font-semibold text-sm text-[#0A0A0A] inline-flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-purple-600" />
              Режим экзамена
            </div>
            <div className="text-xs text-[#0047FF]">Отвечено: {answeredCount} / {scorableCount}{markedCount > 0 ? ` · Отмечено: ${markedCount}` : ""}</div>
          </div>
          <button onClick={submitAll} className="px-4 py-2 rounded-lg bg-[#0047FF] text-white text-sm font-medium hover:bg-[#0038CC] transition-colors inline-flex items-center gap-2">
            <Trophy className="w-4 h-4" />
            Завершить тест
          </button>
        </div>
      )}

      {/* question card */}
      <div className="bg-white border border-[#E8E5DF] rounded-2xl p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="px-2.5 py-1 rounded-lg bg-[#0047FF] text-white text-xs font-bold">В{current + 1}</span>
          {q.type === "multi" && <span className="px-2.5 py-1 rounded-lg bg-purple-100 text-purple-700 text-xs font-semibold inline-flex items-center gap-1">
            <Target className="w-3 h-3" /> Выберите {q.count || "несколько"}
          </span>}
          {q.type === "tf" && <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-700 text-xs font-semibold">Правда/Ложь</span>}
          {q.type === "order" && <span className="px-2.5 py-1 rounded-lg bg-blue-100 text-blue-700 text-xs font-semibold">Хронолог. порядок</span>}
          {q.type === "multi" && !isChecked && remaining > 0 && (
            <span className="px-2.5 py-1 rounded-lg bg-[#0047FF]/10 text-[#0047FF] text-xs font-medium">
              Осталось выбрать: {remaining}
            </span>
          )}
          <div className="flex-1" />
          <button
            onClick={toggleMark}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors min-h-[32px] ${
              isMarked
                ? "bg-amber-100 text-amber-700"
                : "bg-[#F0EEE9] text-[#8A8A8A] hover:bg-amber-50 hover:text-amber-600"
            }`}
            title="Отметить для повторения (M)"
          >
            <Flag className={`w-3.5 h-3.5 ${isMarked ? "fill-amber-500" : ""}`} />
            <span className="hidden sm:inline">{isMarked ? "Отмечено" : "Отметить"}</span>
          </button>
        </div>
        <p className="text-[15px] font-semibold text-[#0A0A0A] leading-relaxed mb-5">{q.question}</p>

        {/* options */}
        {q.type === "order" ? (
          <div className="bg-gradient-to-br from-[#F5F3EE] to-[#F0EEE9] rounded-xl p-4 space-y-2">
            <div className="text-sm font-semibold text-[#0047FF] mb-2 inline-flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Правильный хронологический порядок:
            </div>
            {q.items.map(it => (
              <div key={it.order} className="flex items-center gap-3 py-1.5">
                <span className="w-7 h-7 rounded-md bg-[#0047FF] text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-sm shadow-[#0047FF]/20">{it.order}</span>
                <span className="text-sm text-[#3A3A3A]">{it.text}</span>
              </div>
            ))}
          </div>
        ) : q.type === "tf" ? (
          <div className="grid grid-cols-2 gap-3">
            {["✓ Верно", "✗ Неверно"].map((label, idx) => (
              <button key={idx} onClick={() => !isChecked && select(idx)}
                className={`relative py-4 rounded-xl border-2 text-sm font-semibold transition-all ${optClass(idx)} ${isChecked ? "cursor-default" : "cursor-pointer active:scale-[0.98]"}`}>
                {!isChecked && (
                  <span className="absolute top-2 left-2 text-[10px] font-bold text-[#A0A0A0]">{idx + 1}</span>
                )}
                {label}
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-2.5">
            {q.options.map((opt, idx) => {
              const letters = "АБВГДЕЖЗИ";
              return (
                <button key={idx} onClick={() => !isChecked && select(idx)}
                  className={`group/opt w-full flex items-start gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${optClass(idx)} ${isChecked ? "cursor-default" : "cursor-pointer active:scale-[0.99]"}`}>
                  <span className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                    userAns.includes(idx) ? (isChecked ? (q.correct.includes(idx) ? "bg-emerald-500 text-white" : "bg-red-500 text-white") : "bg-[#0047FF] text-white") : "bg-[#F0EEE9] text-[#6B6B6B]"
                  }`}>{letters[idx]}</span>
                  <span className="flex-1 text-sm text-[#3A3A3A] leading-snug">{opt}</span>
                  {!isChecked && (
                    <span className="text-[10px] font-bold text-[#A0A0A0] opacity-0 group-hover/opt:opacity-100 transition-opacity">
                      {idx + 1}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* feedback */}
        {isChecked && q.type !== "order" && (
          <div className={`mt-4 px-4 py-3 rounded-xl text-sm font-medium flex items-start gap-2 ${isCorrect ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
            {isCorrect ? (
              <>
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                <span>Правильно! Отличная работа.</span>
              </>
            ) : (
              <>
                <XCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <span>
                  Неверно. Правильный ответ: <strong>{(q.type === "tf" ? ["Верно", "Неверно"] : q.options).filter((_, i) => q.correct.includes(i)).join(", ")}</strong>
                </span>
              </>
            )}
          </div>
        )}
        {q.type === "order" && (
          <div className="mt-4 px-4 py-3 rounded-xl text-sm font-medium bg-blue-50 border border-blue-200 text-blue-700 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>Запомните этот хронологический порядок.</span>
          </div>
        )}
      </div>

      {/* nav buttons */}
      <div className="flex items-center justify-between gap-3">
        <button onClick={prev} disabled={current === 0}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-[#E8E5DF] bg-white text-sm text-[#3A3A3A] hover:bg-[#F0EEE9] transition-colors disabled:opacity-40">
          <ChevronLeft className="w-4 h-4" /> Назад
        </button>

        <button
          onClick={() => setShowShortcuts(v => !v)}
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-[#8A8A8A] hover:text-[#0047FF] hover:bg-[#0047FF]/5 transition-colors"
          title="Горячие клавиши (?)"
        >
          <Keyboard className="w-3.5 h-3.5" />
          Клавиши
        </button>

        {mode === "instant" ? (
          isChecked || q.type === "order" ? (
            <button onClick={next}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#0047FF] text-white text-sm font-medium hover:bg-[#0038CC] transition-colors shadow-sm shadow-[#0047FF]/20">
              {current === total - 1 ? <><Trophy className="w-4 h-4" /> Результаты</> : <>Далее <ChevronRight className="w-4 h-4" /></>}
            </button>
          ) : (
            <button onClick={check} disabled={!userAns.length}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#0047FF] text-white text-sm font-medium hover:bg-[#0038CC] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm shadow-[#0047FF]/20">
              <CheckCircle2 className="w-4 h-4" /> Проверить
            </button>
          )
        ) : (
          <button onClick={next}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#0047FF] text-white text-sm font-medium hover:bg-[#0038CC] transition-colors shadow-sm shadow-[#0047FF]/20">
            {current === total - 1 ? <>К началу ↑</> : <>Далее <ChevronRight className="w-4 h-4" /></>}
          </button>
        )}
      </div>

      {/* Shortcuts modal */}
      {showShortcuts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setShowShortcuts(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[#1A1A1A] inline-flex items-center gap-2">
                <Keyboard className="w-5 h-5 text-[#0047FF]" />
                Горячие клавиши
              </h3>
              <button onClick={() => setShowShortcuts(false)} className="p-1 rounded-md hover:bg-[#F0EEE9] transition-colors">
                <XCircle className="w-5 h-5 text-[#8A8A8A]" />
              </button>
            </div>
            <div className="space-y-2">
              {[
                { keys: ["1", "2", "...", "9"], desc: "Выбрать вариант ответа" },
                { keys: ["Enter"], desc: "Проверить ответ / Следующий вопрос" },
                { keys: ["←"], desc: "Предыдущий вопрос" },
                { keys: ["→"], desc: "Следующий вопрос" },
                { keys: ["M"], desc: "Отметить вопрос для повторения" },
                { keys: ["N"], desc: "Открыть/закрыть навигатор" },
                { keys: ["?"], desc: "Показать эту справку" },
              ].map((s, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-[#F0EEE9] last:border-0">
                  <div className="flex items-center gap-1">
                    {s.keys.map((k, ki) => (
                      <kbd key={ki} className="px-2 py-1 bg-[#F5F3EE] border border-[#E8E5DF] rounded text-xs font-mono text-[#3A3A3A] shadow-sm">{k}</kbd>
                    ))}
                  </div>
                  <span className="text-sm text-[#6B6B6B]">{s.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   TestTakingPage
══════════════════════════════════════════════════════════ */
export function TestTakingPage() {
  const { id } = useParams<{ id: string }>();
  const [test, setTest] = useState<TestWithQuestions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<{ mode: Mode; shuffle: boolean } | null>(null);

  usePageTitle(test ? `${test.title} — AZIRAL Learn` : "Тест — AZIRAL Learn");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    testsApi.get(id)
      .then(setTest)
      .catch(e => setError(e instanceof Error ? e.message : "Не удалось загрузить тест"))
      .finally(() => setLoading(false));
  }, [id]);

  const shuffledQuestions = useMemo(() => {
    if (!test || !config) return [];
    if (!config.shuffle) return test.questions;
    return [...test.questions].sort(() => Math.random() - 0.5);
  }, [test, config]);

  const handleStart = (m: Mode, shuffle: boolean) => setConfig({ mode: m, shuffle });
  const handleFinish = () => setConfig(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F3EE] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#0047FF] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !test) {
    return (
      <div className="min-h-screen bg-[#F5F3EE] flex items-center justify-center">
        <div className="text-center space-y-4">
          <XCircle className="w-12 h-12 text-red-400 mx-auto" />
          <p className="text-[#6B6B6B]">{error || "Тест не найден"}</p>
          <Link to="/study" className="inline-flex items-center gap-2 text-sm text-[#0047FF] hover:underline">
            <ArrowLeft className="w-4 h-4" /> К тестам
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F3EE]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-20 sm:pt-28 pb-16">
        {/* breadcrumb */}
        <div className="mb-6">
          <Link to="/study" className="inline-flex items-center gap-1.5 text-sm text-[#6B6B6B] hover:text-[#0047FF] transition-colors">
            <ArrowLeft className="w-4 h-4" /> К тестам
          </Link>
        </div>

        {/* header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-[#8A8A8A] text-sm mb-2">
            <BookOpen className="w-4 h-4" />
            <span>Тесты</span>
          </div>
          <h1 className="text-2xl font-bold text-[#0A0A0A]">{test.title}</h1>
          {test.description && <p className="text-[#6B6B6B] text-sm mt-1">{test.description}</p>}
          {test.instructor_name && <p className="text-xs text-[#8A8A8A] mt-1">Автор: {test.instructor_name}</p>}
        </div>

        {!config ? (
          <ModeSelector test={test} onStart={handleStart} />
        ) : (
          <Quiz questions={shuffledQuestions} mode={config.mode} onFinish={handleFinish} />
        )}
      </div>
    </div>
  );
}
