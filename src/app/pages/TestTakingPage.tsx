import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { usePageTitle } from "../hooks/usePageTitle";
import { testsApi } from "../../api/client";
import type { TestWithQuestions, TestQuestion } from "../../api/client";
import {
  BookOpen, CheckCircle2, ClipboardList, ChevronLeft, ChevronRight,
  RotateCcw, Zap, Shuffle, ArrowLeft, XCircle,
} from "lucide-react";

type Mode = "instant" | "batch";

/* ── helpers ────────────────────────────────────────────── */
function arrEq(a: number[], b: number[]) {
  if (a.length !== b.length) return false;
  const sa = [...a].sort(), sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
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

  return (
    <div className="space-y-6">
      {/* stats */}
      <div className="flex flex-wrap gap-3">
        <span className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-[#E8E5DF] rounded-xl text-sm">
          <CheckCircle2 className="w-4 h-4 text-[#0047FF]" />
          <strong>{test.questions.length}</strong> Questions
        </span>
        {multiCount > 0 && (
          <span className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-[#E8E5DF] rounded-xl text-sm">
            <CheckCircle2 className="w-4 h-4 text-[#0047FF]" />
            <strong>{multiCount}</strong> Multi-choice
          </span>
        )}
        {tfCount > 0 && (
          <span className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-[#E8E5DF] rounded-xl text-sm">
            <CheckCircle2 className="w-4 h-4 text-[#0047FF]" />
            <strong>{tfCount}</strong> True / False
          </span>
        )}
      </div>

      {/* mode cards */}
      <div className="bg-white border border-[#E8E5DF] rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="text-center space-y-1">
          <div className="w-12 h-12 mx-auto bg-[#0047FF]/8 rounded-2xl flex items-center justify-center mb-3">
            <BookOpen className="w-5 h-5 text-[#0047FF]" />
          </div>
          <h2 className="text-xl font-bold text-[#0A0A0A]">{test.title}</h2>
          <p className="text-sm text-[#6B6B6B]">{test.questions.length} questions · Choose how you want to take it</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <button onClick={() => setSelected("instant")}
            className={`text-left p-5 rounded-xl border-2 transition-all ${
              selected === "instant"
                ? "border-[#0047FF] bg-[#0047FF]/5"
                : "border-[#E8E5DF] hover:border-[#0047FF]/40"
            }`}>
            <div className="w-9 h-9 rounded-lg bg-[#0047FF]/10 flex items-center justify-center mb-3">
              <Zap className="w-4 h-4 text-[#0047FF]" />
            </div>
            <div className="font-semibold text-[#0A0A0A] text-sm">Check as you go</div>
            <div className="text-xs text-[#6B6B6B] mt-1">See correct/wrong immediately after each answer</div>
          </button>
          <button onClick={() => setSelected("batch")}
            className={`text-left p-5 rounded-xl border-2 transition-all ${
              selected === "batch"
                ? "border-[#0047FF] bg-[#0047FF]/5"
                : "border-[#E8E5DF] hover:border-[#0047FF]/40"
            }`}>
            <div className="w-9 h-9 rounded-lg bg-[#6B6B6B]/10 flex items-center justify-center mb-3">
              <ClipboardList className="w-4 h-4 text-[#6B6B6B]" />
            </div>
            <div className="font-semibold text-[#0A0A0A] text-sm">Answer all, then results</div>
            <div className="text-xs text-[#6B6B6B] mt-1">Answer everything first, see the full score at the end</div>
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
            <div className="font-semibold text-sm text-[#0A0A0A]">Shuffle questions</div>
            <div className="text-xs text-[#6B6B6B]">Questions appear in a random order each time</div>
          </div>
          <div className={`w-10 h-6 rounded-full relative transition-colors ${shuffle ? "bg-[#0047FF]" : "bg-[#D1D1D1]"}`}>
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${shuffle ? "left-5" : "left-1"}`} />
          </div>
        </button>

        <button onClick={() => onStart(selected, shuffle)}
          className="w-full py-3.5 rounded-xl bg-[#0047FF] text-white font-semibold text-sm hover:bg-[#0038CC] transition-colors">
          Start Test →
        </button>
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
  const [showResults, setShowResults] = useState(false);

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

  const check = () => {
    if (!answers[current]?.length) return;
    setChecked(prev => { const n = [...prev]; n[current] = true; return n; });
  };

  const next = () => {
    if (mode === "batch" && current === total - 1) { setCurrent(0); return; }
    if (mode === "instant" && current === total - 1) { setShowResults(true); return; }
    setCurrent(c => c + 1);
  };

  const prev = () => { if (current > 0) setCurrent(c => c - 1); };

  const submitAll = () => {
    setChecked(questions.map((qq) => qq.type !== "order"));
    setShowResults(true);
  };

  const answeredCount = answers.filter((a, i) => a && a.length > 0 && questions[i].type !== "order").length;
  const scorableCount = questions.filter(qq => qq.type !== "order").length;

  /* ── Results ─────── */
  if (showResults) {
    let correctCount = 0, wrongCount = 0;
    questions.forEach((qq, i) => {
      if (qq.type === "order") return;
      const a = answers[i] || [];
      if (arrEq(a, qq.correct)) correctCount++; else wrongCount++;
    });
    const pct = scorableCount ? Math.round((correctCount / scorableCount) * 100) : 0;
    const emoji = pct >= 90 ? "🏆" : pct >= 75 ? "👍" : pct >= 60 ? "📖" : "💪";
    const label = pct >= 90 ? "Excellent! You are ready!" : pct >= 75 ? "Good result!" : pct >= 60 ? "Keep studying!" : "More practice needed";

    return (
      <div className="space-y-6">
        <div className="bg-white border border-[#E8E5DF] rounded-2xl p-8 text-center space-y-4">
          <div className="text-6xl font-extrabold text-[#0047FF]">{pct}%</div>
          <div className="text-lg text-[#6B6B6B]">{emoji} {label}</div>
          <div className="flex gap-4 justify-center flex-wrap">
            <div className="bg-[#F5F3EE] rounded-xl px-5 py-3 min-w-[90px]">
              <div className="text-2xl font-bold text-green-600">{correctCount}</div>
              <div className="text-xs text-[#6B6B6B]">Correct</div>
            </div>
            <div className="bg-[#F5F3EE] rounded-xl px-5 py-3 min-w-[90px]">
              <div className="text-2xl font-bold text-red-500">{wrongCount}</div>
              <div className="text-xs text-[#6B6B6B]">Wrong</div>
            </div>
            <div className="bg-[#F5F3EE] rounded-xl px-5 py-3 min-w-[90px]">
              <div className="text-2xl font-bold text-[#0047FF]">{scorableCount}</div>
              <div className="text-xs text-[#6B6B6B]">Total</div>
            </div>
          </div>
          <div className="flex gap-3 justify-center pt-2">
            <button onClick={onFinish} className="px-5 py-2.5 rounded-xl bg-[#0047FF] text-white text-sm font-medium hover:bg-[#0038CC] transition-colors inline-flex items-center gap-2">
              <RotateCcw className="w-4 h-4" /> Restart
            </button>
            <Link to="/study" className="px-5 py-2.5 rounded-xl border border-[#E8E5DF] text-sm font-medium text-[#6B6B6B] hover:bg-[#F0EEE9] transition-colors inline-flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" /> Back to tests
            </Link>
          </div>
        </div>

        {/* review */}
        <h3 className="text-lg font-bold text-[#0A0A0A]">Review All Questions</h3>
        <div className="space-y-3">
          {questions.map((qq, i) => {
            if (qq.type === "order") {
              return (
                <div key={i} className="bg-white border border-[#0047FF]/10 rounded-xl p-4">
                  <div className="flex items-start gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-[#0047FF]/10 text-[#0047FF]">ORDER</span>
                    <span className="font-semibold text-sm text-[#0A0A0A]">Q{i + 1}</span>
                  </div>
                  <p className="text-sm text-[#3A3A3A] mb-2">{qq.question}</p>
                  <div className="text-sm text-[#0047FF]">
                    {qq.items.map(it => <div key={it.order}>{it.order}. {it.text}</div>)}
                  </div>
                </div>
              );
            }
            const a = answers[i] || [];
            const ok = arrEq(a, qq.correct);
            const labels = qq.type === "tf" ? ["True", "False"] : qq.options;
            const yourText = a.length ? a.map(x => labels[x]).join(", ") : "(no answer)";
            const correctText = qq.correct.map(x => labels[x]).join(", ");
            return (
              <div key={i} className={`bg-white border rounded-xl p-4 ${ok ? "border-green-200" : "border-red-200"}`}>
                <div className="flex items-start gap-2 mb-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${ok ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {ok ? "✓" : "✗"}
                  </span>
                  <span className="font-semibold text-sm text-[#0A0A0A]">Q{i + 1}</span>
                </div>
                <p className="text-sm text-[#3A3A3A] mb-2">{qq.question}</p>
                {!ok && <p className="text-xs text-red-500">Your answer: {yourText}</p>}
                <p className="text-xs text-green-600">Correct: {correctText}</p>
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
      if (q.correct.includes(idx)) return userAns.includes(idx) ? "border-green-500 bg-green-50" : "border-green-300 bg-green-50/50";
      if (userAns.includes(idx)) return "border-red-500 bg-red-50";
      return "border-[#E8E5DF]";
    }
    return userAns.includes(idx) ? "border-[#0047FF] bg-[#0047FF]/5" : "border-[#E8E5DF] hover:border-[#0047FF]/40";
  }

  const isCorrect = isChecked && arrEq(userAns, q.correct);

  return (
    <div className="space-y-4">
      {/* progress */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 bg-[#E8E5DF] rounded-full overflow-hidden">
          <div className="h-full bg-[#0047FF] rounded-full transition-all" style={{ width: `${((current + 1) / total) * 100}%` }} />
        </div>
        <span className="text-xs text-[#6B6B6B] shrink-0">{current + 1} / {total}</span>
      </div>

      {/* batch banner */}
      {mode === "batch" && (
        <div className="flex items-center justify-between bg-white border border-[#E8E5DF] rounded-xl px-4 py-3 flex-wrap gap-3">
          <div>
            <div className="font-semibold text-sm text-[#0A0A0A]">Answer all, then results</div>
            <div className="text-xs text-[#0047FF]">Answered: {answeredCount} / {scorableCount}</div>
          </div>
          <button onClick={submitAll} className="px-4 py-2 rounded-lg bg-[#0047FF] text-white text-sm font-medium hover:bg-[#0038CC] transition-colors">
            See Results 🎯
          </button>
        </div>
      )}

      {/* question card */}
      <div className="bg-white border border-[#E8E5DF] rounded-2xl p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="px-2.5 py-1 rounded-lg bg-[#0047FF] text-white text-xs font-bold">Q{current + 1}</span>
          {q.type === "multi" && <span className="px-2.5 py-1 rounded-lg bg-purple-100 text-purple-700 text-xs font-semibold">Choose {q.count}</span>}
          {q.type === "tf" && <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-700 text-xs font-semibold">True / False</span>}
          {q.type === "order" && <span className="px-2.5 py-1 rounded-lg bg-blue-100 text-blue-700 text-xs font-semibold">Chronological order</span>}
        </div>
        <p className="text-[15px] font-semibold text-[#0A0A0A] leading-relaxed mb-5">{q.question}</p>

        {/* options */}
        {q.type === "order" ? (
          <div className="bg-[#F5F3EE] rounded-xl p-4 space-y-2">
            <div className="text-sm font-semibold text-[#0047FF] mb-2">Correct chronological order:</div>
            {q.items.map(it => (
              <div key={it.order} className="flex items-center gap-3 py-1.5">
                <span className="w-6 h-6 rounded-md bg-[#0047FF]/10 text-[#0047FF] text-xs font-bold flex items-center justify-center shrink-0">{it.order}</span>
                <span className="text-sm text-[#3A3A3A]">{it.text}</span>
              </div>
            ))}
          </div>
        ) : q.type === "tf" ? (
          <div className="grid grid-cols-2 gap-3">
            {["✓ True", "✗ False"].map((label, idx) => (
              <button key={idx} onClick={() => !isChecked && select(idx)}
                className={`py-4 rounded-xl border-2 text-sm font-semibold transition-all ${optClass(idx)} ${isChecked ? "cursor-default" : "cursor-pointer"}`}>
                {label}
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-2.5">
            {q.options.map((opt, idx) => {
              const letters = "ABCDE";
              return (
                <button key={idx} onClick={() => !isChecked && select(idx)}
                  className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${optClass(idx)} ${isChecked ? "cursor-default" : "cursor-pointer"}`}>
                  <span className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                    userAns.includes(idx) ? (isChecked ? (q.correct.includes(idx) ? "bg-green-500 text-white" : "bg-red-500 text-white") : "bg-[#0047FF] text-white") : "bg-[#F0EEE9] text-[#6B6B6B]"
                  }`}>{letters[idx]}</span>
                  <span className="text-sm text-[#3A3A3A] leading-snug">{opt}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* feedback */}
        {isChecked && q.type !== "order" && (
          <div className={`mt-4 px-4 py-3 rounded-xl text-sm font-medium ${isCorrect ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
            {isCorrect ? "✓ Correct!" : `✗ Wrong. Correct: ${(q.type === "tf" ? ["True", "False"] : q.options).filter((_, i) => q.correct.includes(i)).join(", ")}`}
          </div>
        )}
        {q.type === "order" && (
          <div className="mt-4 px-4 py-3 rounded-xl text-sm font-medium bg-blue-50 border border-blue-200 text-blue-700">
            ℹ️ Memorize this chronological order for the exam.
          </div>
        )}
      </div>

      {/* nav buttons */}
      <div className="flex items-center justify-between">
        <button onClick={prev} disabled={current === 0}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-[#E8E5DF] text-sm text-[#6B6B6B] hover:bg-[#F0EEE9] transition-colors disabled:opacity-40">
          <ChevronLeft className="w-4 h-4" /> Prev
        </button>
        {mode === "instant" ? (
          isChecked || q.type === "order" ? (
            <button onClick={next}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#0047FF] text-white text-sm font-medium hover:bg-[#0038CC] transition-colors">
              {current === total - 1 ? "See Results 🎯" : <>Next <ChevronRight className="w-4 h-4" /></>}
            </button>
          ) : (
            <button onClick={check} disabled={!userAns.length}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#0047FF]/80 text-white text-sm font-medium hover:bg-[#0047FF] transition-colors disabled:opacity-40">
              Check
            </button>
          )
        ) : (
          <button onClick={next}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#0047FF] text-white text-sm font-medium hover:bg-[#0038CC] transition-colors">
            {current === total - 1 ? "Back to start ↑" : <>Next <ChevronRight className="w-4 h-4" /></>}
          </button>
        )}
      </div>
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
            <ArrowLeft className="w-4 h-4" /> Back to tests
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F3EE]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-28 pb-16">
        {/* breadcrumb */}
        <div className="mb-6">
          <Link to="/study" className="inline-flex items-center gap-1.5 text-sm text-[#6B6B6B] hover:text-[#0047FF] transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to tests
          </Link>
        </div>

        {/* header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-[#8A8A8A] text-sm mb-2">
            <BookOpen className="w-4 h-4" />
            <span>Создание тестов</span>
          </div>
          <h1 className="text-2xl font-bold text-[#0A0A0A]">{test.title}</h1>
          {test.description && <p className="text-[#6B6B6B] text-sm mt-1">{test.description}</p>}
          {test.instructor_name && <p className="text-xs text-[#8A8A8A] mt-1">by {test.instructor_name}</p>}
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
