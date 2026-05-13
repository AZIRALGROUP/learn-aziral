import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { usePageTitle } from "../hooks/usePageTitle";
import { testsApi } from "../../api/client";
import type { TestWithQuestions, TestQuestion } from "../../api/client";
import * as XLSX from "xlsx";
import {
  Plus, Trash2, Upload, Eye, ArrowLeft, Globe, Save,
  FileJson, CheckCircle2, XCircle, GripVertical, Check, Loader2, Copy, Zap, Pencil,
  Monitor, ChevronLeft, ChevronRight, Shuffle, Table, Sparkles,
} from "lucide-react";

type QType = "single" | "multi" | "tf" | "order";
const CHATGPT_PROMPT = `Создай JSON файл с тестовыми вопросами на тему: [ТЕМА].

Требования:
- Количество вопросов: [N]
- Язык: русский
- Формат — строго JSON массив (без лишнего текста):

[
  {
    "question": "Текст вопроса?",
    "type": "single",
    "options": ["Вариант A", "Вариант B", "Вариант C", "Вариант D"],
    "correct": [0]
  },
  {
    "question": "Какие верны?",
    "type": "multi",
    "options": ["Вариант A", "Вариант B", "Вариант C", "Вариант D"],
    "correct": [0, 2],
    "count": 2
  }
]

Типы вопросов:
- "single" — один правильный ответ, correct: [индекс от 0]
- "multi" — несколько правильных, correct: [0, 2], count: количество правильных ответов
- "tf" — Правда/Ложь, options: ["Правда", "Ложь"], correct: [0] или [1]

Верни ТОЛЬКО JSON массив, без объяснений и без markdown.`;


const TYPE_LABELS: Record<QType, string> = {
  single: "Один ответ",
  multi: "Несколько ответов",
  tf: "Правда / Ложь",
  order: "Расставить по порядку",
};

type SaveState = "idle" | "saving" | "saved" | "error";

/* ── Empty question template ──────────────────────────────── */
function emptyQ(type: QType = "single") {
  if (type === "tf") return { question: "", type, options: [], items: [], correct: [0], count: 1 };
  if (type === "order") return { question: "", type, options: [], items: [{ text: "", order: 1 }], correct: [0], count: 1 };
  return { question: "", type, options: ["", ""], items: [], correct: [0], count: type === "multi" ? 2 : 1 };
}

/* ── Preview helpers ─────────────────────────────────────────────────────── */
function arrEqPreview(a: number[], b: number[]) {
  if (a.length !== b.length) return false;
  return [...a].sort().every((v, i) => [...b].sort()[i] === v);
}

type PreviewMode = "instant" | "batch";

function PreviewQuiz({
  questions,
  mode,
  onFinish,
}: {
  questions: TestQuestion[];
  mode: PreviewMode;
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

  function select(idx: number) {
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
  }

  function check() {
    if (!answers[current]?.length) return;
    setChecked(prev => { const n = [...prev]; n[current] = true; return n; });
  }

  function next() {
    if (current === total - 1) { setShowResults(true); return; }
    setCurrent(c => c + 1);
  }

  function submitAll() {
    setChecked(questions.map(qq => qq.type !== "order"));
    setShowResults(true);
  }

  const answeredCount = answers.filter((a, i) => a && a.length > 0 && questions[i].type !== "order").length;
  const scorableCount = questions.filter(qq => qq.type !== "order").length;

  if (showResults) {
    let correctCount = 0, wrongCount = 0;
    questions.forEach((qq, i) => {
      if (qq.type === "order") return;
      const a = answers[i] || [];
      if (arrEqPreview(a, qq.correct)) correctCount++; else wrongCount++;
    });
    const pct = scorableCount ? Math.round((correctCount / scorableCount) * 100) : 0;
    const emoji = pct >= 90 ? "🏆" : pct >= 75 ? "👍" : pct >= 60 ? "📖" : "💪";
    const label = pct >= 90 ? "Отлично!" : pct >= 75 ? "Хороший результат!" : pct >= 60 ? "Продолжайте учиться!" : "Нужно больше практики";

    return (
      <div className="space-y-6">
        <div className="bg-white border border-[#E8E5DF] rounded-2xl p-8 text-center space-y-4">
          <div className="text-6xl font-extrabold text-[#0047FF]">{pct}%</div>
          <div className="text-lg text-[#6B6B6B]">{emoji} {label}</div>
          <div className="flex gap-4 justify-center flex-wrap">
            <div className="bg-[#F5F3EE] rounded-xl px-5 py-3 min-w-[90px]">
              <div className="text-2xl font-bold text-green-600">{correctCount}</div>
              <div className="text-xs text-[#6B6B6B]">Верно</div>
            </div>
            <div className="bg-[#F5F3EE] rounded-xl px-5 py-3 min-w-[90px]">
              <div className="text-2xl font-bold text-red-500">{wrongCount}</div>
              <div className="text-xs text-[#6B6B6B]">Неверно</div>
            </div>
            <div className="bg-[#F5F3EE] rounded-xl px-5 py-3 min-w-[90px]">
              <div className="text-2xl font-bold text-[#0047FF]">{scorableCount}</div>
              <div className="text-xs text-[#6B6B6B]">Всего</div>
            </div>
          </div>
          <div className="flex gap-3 justify-center pt-2">
            <button onClick={onFinish}
              className="px-5 py-2.5 rounded-xl bg-[#0047FF] text-white text-sm font-medium hover:bg-[#0038CC] transition-colors">
              ↺ Начать заново
            </button>
          </div>
        </div>
        <h3 className="text-lg font-bold text-[#0A0A0A]">Разбор ответов</h3>
        <div className="space-y-3">
          {questions.map((qq, i) => {
            if (qq.type === "order") return (
              <div key={i} className="bg-white border border-[#0047FF]/10 rounded-xl p-4">
                <div className="flex items-start gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-[#0047FF]/10 text-[#0047FF]">ПОРЯДОК</span>
                  <span className="font-semibold text-sm text-[#0A0A0A]">В{i + 1}</span>
                </div>
                <p className="text-sm text-[#3A3A3A]">{qq.question}</p>
              </div>
            );
            const a = answers[i] || [];
            const ok = arrEqPreview(a, qq.correct);
            const labels = qq.type === "tf" ? ["Верно", "Неверно"] : qq.options;
            const yourText = a.length ? a.map(x => labels[x]).join(", ") : "(нет ответа)";
            const correctText = qq.correct.map(x => labels[x]).join(", ");
            return (
              <div key={i} className={`bg-white border rounded-xl p-4 ${ok ? "border-green-200" : "border-red-200"}`}>
                <div className="flex items-start gap-2 mb-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${ok ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{ok ? "✓" : "✗"}</span>
                  <span className="font-semibold text-sm text-[#0A0A0A]">В{i + 1}</span>
                </div>
                <p className="text-sm text-[#3A3A3A] mb-2">{qq.question}</p>
                {!ok && <p className="text-xs text-red-500">Ваш ответ: {yourText}</p>}
                <p className="text-xs text-green-600">Правильно: {correctText}</p>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function optClass(idx: number) {
    if (isChecked) {
      if (q.correct.includes(idx)) return userAns.includes(idx) ? "border-green-500 bg-green-50" : "border-green-300 bg-green-50/50";
      if (userAns.includes(idx)) return "border-red-500 bg-red-50";
      return "border-[#E8E5DF]";
    }
    return userAns.includes(idx) ? "border-[#0047FF] bg-[#0047FF]/5" : "border-[#E8E5DF] hover:border-[#0047FF]/40";
  }

  const isCorrect = isChecked && arrEqPreview(userAns, q.correct);
  const letters = "АБВГД";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 bg-[#E8E5DF] rounded-full overflow-hidden">
          <div className="h-full bg-[#0047FF] rounded-full transition-all" style={{ width: `${((current + 1) / total) * 100}%` }} />
        </div>
        <span className="text-xs text-[#6B6B6B] shrink-0">{current + 1} / {total}</span>
      </div>

      {mode === "batch" && (
        <div className="flex items-center justify-between bg-white border border-[#E8E5DF] rounded-xl px-4 py-3 flex-wrap gap-3">
          <div>
            <div className="font-semibold text-sm text-[#0A0A0A]">Ответить всё, затем результаты</div>
            <div className="text-xs text-[#0047FF]">Отвечено: {answeredCount} / {scorableCount}</div>
          </div>
          <button onClick={submitAll} className="px-4 py-2 rounded-lg bg-[#0047FF] text-white text-sm font-medium hover:bg-[#0038CC] transition-colors">
            Результаты 🎯
          </button>
        </div>
      )}

      <div className="bg-white border border-[#E8E5DF] rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="px-2.5 py-1 rounded-lg bg-[#0047FF] text-white text-xs font-bold">В{current + 1}</span>
          {q.type === "multi" && <span className="px-2.5 py-1 rounded-lg bg-purple-100 text-purple-700 text-xs font-semibold">Выберите {q.count}</span>}
          {q.type === "tf" && <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-700 text-xs font-semibold">Правда/Ложь</span>}
          {q.type === "order" && <span className="px-2.5 py-1 rounded-lg bg-blue-100 text-blue-700 text-xs font-semibold">Порядок</span>}
        </div>
        <p className="text-[15px] font-semibold text-[#0A0A0A] leading-relaxed mb-5">{q.question}</p>

        {q.type === "tf" ? (
          <div className="grid grid-cols-2 gap-3">
            {["✓ Верно", "✗ Неверно"].map((label, idx) => (
              <button key={idx} onClick={() => select(idx)}
                className={`py-4 rounded-xl border-2 text-sm font-semibold transition-all ${optClass(idx)} ${isChecked ? "cursor-default" : "cursor-pointer"}`}>
                {label}
              </button>
            ))}
          </div>
        ) : q.type === "order" ? (
          <div className="bg-[#F5F3EE] rounded-xl p-4 space-y-2">
            <div className="text-sm font-semibold text-[#0047FF] mb-2">Правильный порядок:</div>
            {q.items.map(it => (
              <div key={it.order} className="flex items-center gap-3 py-1.5">
                <span className="w-6 h-6 rounded-md bg-[#0047FF]/10 text-[#0047FF] text-xs font-bold flex items-center justify-center shrink-0">{it.order}</span>
                <span className="text-sm text-[#3A3A3A]">{it.text}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2.5">
            {q.options.map((opt, idx) => (
              <button key={idx} onClick={() => select(idx)}
                className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${optClass(idx)} ${isChecked ? "cursor-default" : "cursor-pointer"}`}>
                <span className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                  userAns.includes(idx) ? (isChecked ? (q.correct.includes(idx) ? "bg-green-500 text-white" : "bg-red-500 text-white") : "bg-[#0047FF] text-white") : "bg-[#F0EEE9] text-[#6B6B6B]"
                }`}>{letters[idx]}</span>
                <span className="text-sm text-[#3A3A3A] leading-snug">{opt}</span>
              </button>
            ))}
          </div>
        )}

        {isChecked && q.type !== "order" && (
          <div className={`mt-4 px-4 py-3 rounded-xl text-sm font-medium ${isCorrect ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
            {isCorrect ? "✓ Верно!" : `✗ Неверно. Правильно: ${(q.type === "tf" ? ["Верно", "Неверно"] : q.options).filter((_, i) => q.correct.includes(i)).join(", ")}`}
          </div>
        )}
        {q.type === "order" && (
          <div className="mt-4 px-4 py-3 rounded-xl text-sm bg-blue-50 border border-blue-200 text-blue-700">
            ℹ️ Запомните этот порядок.
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <button onClick={() => current > 0 && setCurrent(c => c - 1)} disabled={current === 0}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-[#E8E5DF] text-sm text-[#6B6B6B] hover:bg-[#F0EEE9] transition-colors disabled:opacity-40">
          <ChevronLeft className="w-4 h-4" /> Назад
        </button>
        {mode === "instant" ? (
          isChecked || q.type === "order" ? (
            <button onClick={next}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#0047FF] text-white text-sm font-medium hover:bg-[#0038CC] transition-colors">
              {current === total - 1 ? "Результаты 🎯" : <>Далее <ChevronRight className="w-4 h-4" /></>}
            </button>
          ) : (
            <button onClick={check} disabled={!userAns.length}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#0047FF]/80 text-white text-sm font-medium hover:bg-[#0047FF] transition-colors disabled:opacity-40">
              Проверить
            </button>
          )
        ) : (
          <button onClick={next}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#0047FF] text-white text-sm font-medium hover:bg-[#0038CC] transition-colors">
            {current === total - 1 ? "К итогам →" : <>Далее <ChevronRight className="w-4 h-4" /></>}
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Preview wrapper: mode selector + quiz ───────────────── */
function PreviewModal({
  test,
  questions,
  onClose,
}: {
  test: { title: string; description?: string };
  questions: TestQuestion[];
  onClose: () => void;
}) {
  const [mode, setMode] = useState<PreviewMode>("instant");
  const [shuffle, setShuffle] = useState(false);
  const [started, setStarted] = useState(false);
  const [activeQuestions, setActiveQuestions] = useState<TestQuestion[]>([]);

  function start() {
    const qs = shuffle ? [...questions].sort(() => Math.random() - 0.5) : questions;
    setActiveQuestions(qs);
    setStarted(true);
  }

  function restart() {
    setStarted(false);
    setActiveQuestions([]);
  }

  if (questions.length === 0) {
    return (
      <div className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 text-center space-y-3 max-w-sm w-full">
          <Monitor className="w-10 h-10 text-[#6B6B6B] mx-auto" />
          <p className="text-[#6B6B6B]">Добавьте хотя бы один вопрос для предпросмотра</p>
          <button onClick={onClose} className="px-5 py-2 rounded-lg bg-[#0047FF] text-white text-sm font-medium hover:bg-[#0038CC] transition-colors">Закрыть</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] bg-[#F5F3EE] overflow-y-auto">
      {/* Preview header bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-[#E8E5DF] px-4 py-3 flex items-center gap-3">
        <div className="flex items-center gap-2 flex-1">
          <Monitor className="w-4 h-4 text-[#0047FF]" />
          <span className="text-sm font-semibold text-[#0A0A0A]">Предпросмотр</span>
          <span className="text-xs text-[#8A8A8A] hidden sm:inline">— так видит студент</span>
        </div>
        <button onClick={onClose}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E8E5DF] text-xs text-[#6B6B6B] hover:bg-[#F0EEE9] transition-colors">
          ✕ Закрыть
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Test header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#0A0A0A]">{test.title || "Новый тест"}</h1>
          {test.description && <p className="text-[#6B6B6B] text-sm mt-1">{test.description}</p>}
        </div>

        {!started ? (
          <div className="bg-white border border-[#E8E5DF] rounded-2xl p-6 space-y-5">
            <div className="text-center space-y-1">
              <p className="text-sm text-[#6B6B6B]">{questions.length} вопросов · Выберите режим</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <button onClick={() => setMode("instant")}
                className={`text-left p-4 rounded-xl border-2 transition-all ${mode === "instant" ? "border-[#0047FF] bg-[#0047FF]/5" : "border-[#E8E5DF] hover:border-[#0047FF]/40"}`}>
                <div className="font-semibold text-sm text-[#0A0A0A]">⚡ Проверять по ходу</div>
                <div className="text-xs text-[#6B6B6B] mt-1">Сразу видите — правильно или нет</div>
              </button>
              <button onClick={() => setMode("batch")}
                className={`text-left p-4 rounded-xl border-2 transition-all ${mode === "batch" ? "border-[#0047FF] bg-[#0047FF]/5" : "border-[#E8E5DF] hover:border-[#0047FF]/40"}`}>
                <div className="font-semibold text-sm text-[#0A0A0A]">📋 Всё, затем итог</div>
                <div className="text-xs text-[#6B6B6B] mt-1">Сначала ответьте на всё, затем результат</div>
              </button>
            </div>
            <button onClick={() => setShuffle(v => !v)}
              className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-all ${shuffle ? "border-[#0047FF]/30 bg-[#0047FF]/5" : "border-[#E8E5DF]"}`}>
              <Shuffle className="w-4 h-4 text-[#6B6B6B]" />
              <div className="text-left flex-1">
                <div className="font-semibold text-sm text-[#0A0A0A]">Перемешать вопросы</div>
              </div>
              <div className={`w-10 h-6 rounded-full relative transition-colors ${shuffle ? "bg-[#0047FF]" : "bg-[#D1D1D1]"}`}>
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${shuffle ? "left-5" : "left-1"}`} />
              </div>
            </button>
            <button onClick={start}
              className="w-full py-3.5 rounded-xl bg-[#0047FF] text-white font-semibold text-sm hover:bg-[#0038CC] transition-colors">
              Начать тест →
            </button>
          </div>
        ) : (
          <PreviewQuiz questions={activeQuestions} mode={mode} onFinish={restart} />
        )}
      </div>
    </div>
  );
}


/* ══════════════════════════════════════════════════════════
   TestBuilderPage
══════════════════════════════════════════════════════════ */
export function TestBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [test, setTest] = useState<TestWithQuestions | null>(null);
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [status, setStatus] = useState<{ msg: string; isError?: boolean } | null>(null);

  // Editable test metadata
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");

  // Import modal
  const [showImport, setShowImport] = useState(false);
  const [importJson, setImportJson] = useState("");
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [importing, setImporting] = useState(false);

  // Preview modal
  const [showPreview, setShowPreview] = useState(false);

  // Rename modal
  const [showRename, setShowRename] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);

  // Quick Input modal
  const [showQuickInput, setShowQuickInput] = useState(false);
  const [quickText, setQuickText] = useState("");
  const [quickImporting, setQuickImporting] = useState(false);

  // AI generate modal
  const [showAiGen, setShowAiGen] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [aiCount, setAiCount] = useState(10);
  const [aiLang, setAiLang] = useState("ru");
  const [aiTypes, setAiTypes] = useState<string[]>(["single"]);
  const [aiGenerating, setAiGenerating] = useState(false);

  // Autosave timers
  const metaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedRef = useRef(false);

  usePageTitle(test ? `${test.title || "Новый тест"} — Редактор` : "Редактор теста");

  /* ── Load test ─────────────────────────────────────────── */
  const loadTest = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await testsApi.getForEdit(id);
      setTest(data);
      setQuestions(data.questions);
      setTitle(data.title);
      setDescription(data.description || "");
      setCategory(data.category || "");
      if (data.questions.length > 0) setSelectedIdx(0);
      initializedRef.current = true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить тест");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadTest(); }, [loadTest]);

  /* ── Autosave metadata (debounced) ─────────────────────── */
  useEffect(() => {
    if (!test || !initializedRef.current) return;
    if (metaTimer.current) clearTimeout(metaTimer.current);
    metaTimer.current = setTimeout(async () => { // delay: 2500ms
      setSaveState("saving");
      try {
        await testsApi.update(test.id, { title, description, category });
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 1500);
      } catch {
        setSaveState("error");
        flash("Не удалось сохранить", true);
      }
    }, 2500);
    return () => { if (metaTimer.current) clearTimeout(metaTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, category]);

  /* ── Autosave current question (debounced) ─────────────── */
  useEffect(() => {
    if (selectedIdx === null || !initializedRef.current) return;
    const q = questions[selectedIdx];
    if (!q) return;
    if (qTimer.current) clearTimeout(qTimer.current);
    qTimer.current = setTimeout(async () => {
      setSaveState("saving");
      try {
        const updated = await testsApi.updateQuestion(q.id, {
          question: q.question,
          type: q.type,
          options: q.options,
          items: q.items,
          correct: q.correct,
          count: q.count,
        });
        setQuestions(prev => {
          const n = [...prev];
          const idx = n.findIndex(x => x.id === updated.id);
          if (idx !== -1) n[idx] = updated;
          return n;
        });
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 1500);
      } catch {
        setSaveState("error");
        flash("Не удалось сохранить вопрос", true);
      }
    }, 2500);
    return () => { if (qTimer.current) clearTimeout(qTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIdx !== null ? questions[selectedIdx] : null]);

  /* ── Toggle publish ────────────────────────────────────── */
  async function togglePublish() {
    if (!test) return;
    try {
      const res = await testsApi.togglePublish(test.id);
      setTest({ ...test, status: res.status });
      flash(res.status === "published" ? "Тест опубликован" : "Снят с публикации");
    } catch (e) {
      flash(e instanceof Error ? e.message : "Не удалось опубликовать", true);
    }
  }

  /* ── Save as draft ─────────────────────────────────────── */
  async function saveDraft() {
    if (!test) return;
    setSaveState("saving");
    try {
      await testsApi.update(test.id, { title, description, category });
      if (test.status === "published") {
        const res = await testsApi.togglePublish(test.id);
        setTest(prev => prev ? { ...prev, status: res.status, title, description, category } : prev);
        flash("Переведён в черновик");
      } else {
        setTest(prev => prev ? { ...prev, title, description, category } : prev);
        flash("Сохранено как черновик");
      }
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
    } catch {
      setSaveState("error");
      flash("Ошибка сохранения", true);
    }
  }

  /* ── Add question ──────────────────────────────────────── */
  async function addQuestion() {
    if (!test) return;
    try {
      const q = await testsApi.addQuestion(test.id, emptyQ("single"));
      setQuestions(prev => [...prev, q]);
      setSelectedIdx(questions.length);
    } catch (e) {
      flash(e instanceof Error ? e.message : "Не удалось добавить вопрос", true);
    }
  }

  /* ── Delete question ───────────────────────────────────── */
  async function deleteQuestion() {
    if (selectedIdx === null) return;
    const q = questions[selectedIdx];
    if (!confirm(`Удалить вопрос №${selectedIdx + 1}?`)) return;
    try {
      await testsApi.deleteQuestion(q.id);
      const newList = questions.filter((_, i) => i !== selectedIdx);
      setQuestions(newList);
      setSelectedIdx(newList.length > 0 ? Math.min(selectedIdx, newList.length - 1) : null);
      flash("Вопрос удалён");
    } catch { flash("Не удалось удалить", true); }
  }

  /* ── Import ────────────────────────────────────────────── */
  async function handleImport(jsonText?: string) {
    if (!test) return;
    const raw = jsonText ?? importJson;
    if (!raw.trim()) return;
    setImporting(true);
    try {
      const parsed = JSON.parse(raw);
      // Smart unwrap: flat array, { questions: [...] } wrapper, or single object
      let arr: any[];
      if (Array.isArray(parsed)) {
        arr = parsed;
      } else if (parsed.questions && Array.isArray(parsed.questions)) {
        arr = parsed.questions; // { quiz_title: "...", questions: [...] }
      } else {
        arr = [parsed];
      }
      if (arr.length === 0) { flash("JSON пустой — нет вопросов", true); setImporting(false); return; }
      // Ensure count is set for multi-answer questions
      arr = arr.map((q: any) => {
        if (q.type === 'multi' && !q.count && q.correct && Array.isArray(q.correct)) {
          return { ...q, count: q.correct.length };
        }
        return q;
      });
      const res = await testsApi.importQuestions(test.id, arr);
      const msg = (res as any).skipped > 0
        ? `Импортировано: ${res.imported}, пропущено: ${(res as any).skipped} (нет текста вопроса)`
        : `Импортировано вопросов: ${res.imported}`;
      flash(msg, res.imported === 0);
      setShowImport(false);
      setImportJson("");
      await loadTest();
    } catch (e) {
      if (e instanceof SyntaxError) flash("Невалидный JSON: " + e.message, true);
      else flash((e as Error).message || "Ошибка импорта", true);
    }
    setImporting(false);
  }

  async function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setImportJson(text);
    await handleImport(text);
    e.target.value = "";
  }

  /* ── Rename test ───────────────────────────────────────────────── */
  async function handleRename() {
    if (!test || !renameValue.trim()) return;
    setRenaming(true);
    try {
      await testsApi.update(test.id, { title: renameValue.trim() });
      setTitle(renameValue.trim());
      setTest(prev => prev ? { ...prev, title: renameValue.trim() } : prev);
      setShowRename(false);
      flash("Название обновлено");
    } catch {
      flash("Не удалось переименовать", true);
    }
    setRenaming(false);
  }

  /* ── AI generation ────────────────────────────────────────────────── */
  async function handleAiGenerate() {
    if (!test || !aiTopic.trim()) return;
    setAiGenerating(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/instructor/ai/generate-questions`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: aiTopic.trim(), count: aiCount, language: aiLang, types: aiTypes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка генерации');
      const imported = await testsApi.importQuestions(test.id, data.questions);
      flash(`AI сгенерировал ${imported.imported} вопросов!`);
      setShowAiGen(false);
      setAiTopic("");
      await loadTest();
    } catch (e) {
      flash((e as Error).message || 'Ошибка AI', true);
    }
    setAiGenerating(false);
  }

  /* Quick Input parser */
  function parseQuickText(text: string): {question: string; type: string; options: string[]; correct: number[]; count?: number}[] {
    const results: {question: string; type: string; options: string[]; correct: number[]; count?: number}[] = [];
    const lines = text.split('\n').map(l => l.trim());

    let currentQuestion = '';
    let options: string[] = [];
    let correct: number[] = [];

    function flush() {
      if (currentQuestion && options.length > 0) {
        const type = correct.length > 1 ? 'multi' : 'single';
        const payload: {question: string; type: string; options: string[]; correct: number[]; count?: number} = { question: currentQuestion, type, options, correct };
        if (type === 'multi') payload.count = correct.length;
        results.push(payload);
      }
      options = [];
      correct = [];
    }

    for (const line of lines) {
      if (!line) continue; // skip blank lines
      if (line.startsWith('+') && !line.startsWith('--')) {
        correct.push(options.length);
        options.push(line.slice(line[1] === ' ' ? 2 : 1).trim());
      } else if (line.startsWith('-') && !line.startsWith('--')) {
        options.push(line.slice(line[1] === ' ' ? 2 : 1).trim());
      } else {
        // New question line — save previous and start new
        flush();
        currentQuestion = line;
      }
    }
    flush(); // save last question

    return results;
  }

  async function handleQuickImport() {
    if (!test || !quickText.trim()) return;
    const parsed = parseQuickText(quickText);
    if (parsed.length === 0) { flash('Не удалось распознать вопросы. Проверьте формат.', true); return; }
    setQuickImporting(true);
    try {
      const res = await testsApi.importQuestions(test.id, parsed);
      flash(`Добавлено вопросов: ${res.imported}`, res.imported === 0);
      setShowQuickInput(false);
      setQuickText("");
      await loadTest();
    } catch (e) {
      flash((e as Error).message || 'Ошибка импорта', true);
    }
    setQuickImporting(false);
  }


  /* ── Spreadsheet (CSV / Excel) import ─────────────────────────── */
  function parseSpreadsheet(data: unknown[][]): {question: string; type: string; options: string[]; correct: number[]; count?: number}[] {
    if (data.length === 0) return [];

    // Detect if first row is a header
    const firstRow = data[0].map(c => String(c || '').toLowerCase().trim());
    const hasHeader = firstRow.some(h =>
      ['question', 'вопрос', 'type', 'тип', 'correct', 'правильный', 'option', 'вариант'].some(k => h.includes(k))
    );

    // Find column indices by header name or use positional defaults
    let qIdx = 0, typeIdx = 1, opt1Idx = 2, correctIdx: number;
    if (hasHeader) {
      qIdx        = firstRow.findIndex(h => h.includes('question') || h.includes('вопрос')) ?? 0;
      typeIdx     = firstRow.findIndex(h => h === 'type' || h === 'тип');
      opt1Idx     = firstRow.findIndex(h => h.includes('option') || h.includes('вариант') || h.includes('answer') || h.includes('ответ'));
      correctIdx  = firstRow.findIndex(h => h.includes('correct') || h.includes('правильн'));
      if (qIdx < 0) qIdx = 0;
      if (opt1Idx < 0) opt1Idx = 2;
      if (correctIdx < 0) correctIdx = firstRow.length - 1;
    } else {
      // Positional: question | type | opt1 | opt2 | opt3 | opt4 | correct
      correctIdx = data[0].length - 1;
    }

    const rows = hasHeader ? data.slice(1) : data;
    const results: {question: string; type: string; options: string[]; correct: number[]; count?: number}[] = [];

    for (const row of rows) {
      const cells = row.map(c => String(c || '').trim());
      const questionText = cells[qIdx];
      if (!questionText) continue;

      // Collect options: columns from opt1Idx up to (but not including) correctIdx
      const options: string[] = [];
      for (let i = opt1Idx; i < correctIdx; i++) {
        if (cells[i]) options.push(cells[i]);
      }
      if (options.length === 0) continue;

      // Parse correct: "1" or "A" or "1,2" or "A,B"
      const rawCorrect = cells[correctIdx] || '1';
      const correct: number[] = rawCorrect.split(/[,;]/).map(v => {
        const t = v.trim();
        if (/^[A-Za-zА-Яа-я]$/.test(t)) {
          // Letter: A→0, B→1, А→0, Б→1
          const eng = 'ABCDEабвгд';
          const idx = eng.indexOf(t.toUpperCase());
          return idx >= 0 ? idx : 0;
        }
        const n = parseInt(t, 10);
        return isNaN(n) ? 0 : Math.max(0, n - 1); // 1-based to 0-based
      }).filter((n, i, arr) => n >= 0 && n < options.length && arr.indexOf(n) === i);

      if (correct.length === 0) correct.push(0);

      const typeRaw = typeIdx >= 0 ? (cells[typeIdx] || '').toLowerCase() : '';
      let type = 'single';
      if (typeRaw.includes('multi') || typeRaw.includes('несколько') || correct.length > 1) type = 'multi';
      else if (typeRaw.includes('tf') || typeRaw.includes('true') || typeRaw.includes('правда')) type = 'tf';

      const payload: {question: string; type: string; options: string[]; correct: number[]; count?: number} = { question: questionText, type, options, correct };
      if (type === 'multi') payload.count = correct.length;
      results.push(payload);
    }
    return results;
  }

  async function handleSpreadsheetImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !test) return;
    e.target.value = '';
    setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      const parsed = parseSpreadsheet(data);
      if (parsed.length === 0) { flash('Не удалось распознать вопросы. Проверьте формат таблицы.', true); setImporting(false); return; }
      const res = await testsApi.importQuestions(test.id, parsed);
      flash(`Импортировано из таблицы: ${res.imported} вопросов`, res.imported === 0);
      setShowImport(false);
      await loadTest();
    } catch (e) {
      flash((e as Error).message || 'Ошибка чтения файла', true);
    }
    setImporting(false);
  }

  /* ── Update local question ─────────────────────────────── */
  function updateQ(patch: Partial<TestQuestion>) {
    if (selectedIdx === null) return;
    setQuestions(prev => {
      const n = [...prev];
      n[selectedIdx] = { ...n[selectedIdx], ...patch };
      return n;
    });
  }

  function changeType(newType: QType) {
    if (selectedIdx === null) return;
    const base = emptyQ(newType);
    updateQ({ type: newType, options: base.options as string[], items: base.items as { text: string; order: number }[], correct: base.correct as number[], count: base.count });
  }

  /* ── Flash message ─────────────────────────────────────── */
  function flash(msg: string, isError = false) {
    setStatus({ msg, isError });
    setTimeout(() => setStatus(null), 3500);
  }

  /* ── Loading / Error ───────────────────────────────────── */
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
        <div className="text-center space-y-3">
          <XCircle className="w-10 h-10 text-red-400 mx-auto" />
          <p className="text-[#6B6B6B]">{error || "Тест не найден"}</p>
          <button onClick={() => navigate("/study")} className="text-sm text-[#0047FF] hover:underline">← Назад к тестам</button>
        </div>
      </div>
    );
  }

  const q = selectedIdx !== null ? questions[selectedIdx] : null;

  return (
    <div className="min-h-screen bg-[#F5F3EE]">
      {/* Top bar */}
      <div className="fixed top-0 left-0 right-0 z-50 h-16 bg-white border-b border-[#E8E5DF] flex items-center px-4 gap-3">
        <button onClick={() => navigate("/instructor", { state: { tab: "tests" } })} className="p-2 rounded-lg hover:bg-[#F0EEE9] transition-colors" title="Мои тесты">
          <ArrowLeft className="w-5 h-5 text-[#6B6B6B]" />
        </button>
        <div className="flex-1 flex items-center gap-1.5 min-w-0">
          <span className="text-[15px] font-semibold text-[#0A0A0A] truncate">{title || "Новый тест"}</span>
          <button
            onClick={() => { setRenameValue(title); setShowRename(true); }}
            className="flex-shrink-0 p-1 rounded-md text-[#BFBFBF] hover:text-[#6B6B6B] hover:bg-[#F0EEE9] transition-colors"
            title="Переименовать тест">
            <Pencil className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Autosave indicator */}
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#8A8A8A] min-w-[90px] justify-end">
          {saveState === "saving" && <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Сохраняем…</>}
          {saveState === "saved" && <><Check className="w-3.5 h-3.5 text-green-600" /> Сохранено</>}
          {saveState === "error" && <span className="text-red-500">Ошибка</span>}
        </div>

        {/* Draft + Publish buttons */}
        <div className="flex items-center gap-2">
          {/* Save as draft */}
          <button onClick={saveDraft}
            title="Сохранить изменения и оставить/перевести в черновик"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[#E8E5DF] bg-white text-[#6B6B6B] hover:bg-[#F5F3EE] hover:text-[#0A0A0A] transition-colors">
            <Save className="w-3.5 h-3.5" /> В черновик
          </button>
          {/* Publish / Published toggle */}
          {test.status === "published" ? (
            <button onClick={togglePublish}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-100 text-green-700 hover:bg-green-200 transition-colors border border-green-200"
              title="Тест опубликован — нажмите чтобы снять с публикации">
              <Eye className="w-3.5 h-3.5" /> Опубликован
            </button>
          ) : (
            <button onClick={togglePublish}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0047FF] text-white hover:bg-[#0038CC] transition-colors shadow-sm shadow-[#0047FF]/20"
              title="Опубликовать — тест появится на странице /study">
              <Globe className="w-3.5 h-3.5" /> Опубликовать
            </button>
          )}
        </div>
        <button onClick={() => setShowImport(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F0EEE9] text-xs font-medium text-[#6B6B6B] hover:bg-[#E8E5DF] transition-colors" title="Импорт вопросов из JSON">
          <FileJson className="w-3.5 h-3.5" /> Импорт
        </button>
        <button onClick={() => setShowQuickInput(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors border border-amber-200" title="Быстрый текстовый ввод вопросов">
          <Zap className="w-3.5 h-3.5" /> Быстрый ввод
        </button>
        <button onClick={() => setShowAiGen(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 text-xs font-medium text-purple-700 hover:bg-purple-100 transition-colors border border-purple-200" title="Сгенерировать вопросы с помощью AI">
          <Sparkles className="w-3.5 h-3.5" /> AI генерация
        </button>
        <button onClick={() => setShowPreview(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#EEF2FF] text-xs font-medium text-[#4F46E5] hover:bg-[#E0E7FF] transition-colors border border-[#C7D2FE]" title="Предпросмотр — посмотреть глазами студента">
          <Monitor className="w-3.5 h-3.5" /> Предпросмотр
        </button>
      </div>

      {/* Status toast */}
      {status && (
        <div className={`fixed top-20 right-4 z-50 px-4 py-2.5 rounded-xl border shadow-lg text-sm animate-in fade-in ${
          status.isError ? "bg-red-50 border-red-200 text-red-700" : "bg-white border-[#E8E5DF] text-[#0A0A0A]"
        }`}>
          {status.msg}
        </div>
      )}

      {/* Main */}
      <div className="flex pt-16" style={{ minHeight: "calc(100vh - 0px)" }}>
        {/* Left: question list */}
        <div className="w-72 shrink-0 bg-white border-r border-[#E8E5DF] flex flex-col" style={{ height: "calc(100vh - 64px)" }}>
          <div className="p-3 border-b border-[#E8E5DF] shrink-0">
            <div className="text-xs text-[#8A8A8A] font-medium mb-2">Описание</div>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              rows={2} placeholder="Коротко о чём этот тест…"
              className="w-full text-xs text-[#3A3A3A] bg-[#F5F3EE] rounded-lg p-2 border-none resize-none outline-none focus:ring-1 focus:ring-[#0047FF]/20" />
            <div className="text-xs text-[#8A8A8A] font-medium mt-2 mb-1">Категория</div>
            <input value={category} onChange={e => setCategory(e.target.value)}
              placeholder="напр. история, программирование"
              className="w-full text-xs text-[#3A3A3A] bg-[#F5F3EE] rounded-lg p-2 border-none outline-none focus:ring-1 focus:ring-[#0047FF]/20" />
          </div>

          <div className="flex items-center justify-between px-3 pt-3 pb-1 shrink-0">
            <div className="text-xs font-medium text-[#8A8A8A]">Вопросы · {questions.length}</div>
          </div>

          <div className="p-2 space-y-1 overflow-y-auto flex-1">
            {questions.length === 0 && (
              <div className="text-center text-xs text-[#8A8A8A] px-4 py-6">
                Пока нет вопросов.<br />Нажмите кнопку ниже, чтобы добавить первый.
              </div>
            )}
            {questions.map((qq, i) => (
              <button key={qq.id} onClick={() => setSelectedIdx(i)}
                className={`w-full flex items-start gap-2 px-3 py-2.5 rounded-lg text-left transition-colors ${
                  selectedIdx === i ? "bg-[#0047FF]/8 text-[#0047FF]" : "hover:bg-[#F5F3EE] text-[#3A3A3A]"
                }`}>
                <span className="text-xs font-bold mt-0.5 shrink-0">{i + 1}</span>
                <div className="overflow-hidden flex-1">
                  <div className="text-xs truncate">{qq.question || <span className="text-[#B0B0B0] italic">без текста</span>}</div>
                  <div className="text-[10px] text-[#8A8A8A] mt-0.5">{TYPE_LABELS[qq.type as QType]}</div>
                </div>
              </button>
            ))}
          </div>

          <div className="p-2 border-t border-[#E8E5DF] shrink-0">
            <button onClick={addQuestion}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#0047FF] text-white text-xs font-medium hover:bg-[#0038CC] transition-colors">
              <Plus className="w-3.5 h-3.5" /> Добавить вопрос
            </button>
          </div>
        </div>

        {/* Right: editor */}
        <div className="flex-1 overflow-y-auto p-6" style={{ height: "calc(100vh - 64px)" }}>
          {q ? (
            <div className="max-w-2xl space-y-5">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium text-[#8A8A8A]">Вопрос №{(selectedIdx ?? 0) + 1} из {questions.length}</div>
                <button onClick={deleteQuestion}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-red-500 hover:bg-red-50 text-xs font-medium transition-colors">
                  <Trash2 className="w-3.5 h-3.5" /> Удалить
                </button>
              </div>

              {/* Type selector */}
              <div>
                <label className="text-xs font-medium text-[#8A8A8A] mb-1.5 block">Тип вопроса</label>
                <div className="flex gap-2 flex-wrap">
                  {(["single", "multi", "tf", "order"] as QType[]).map(t => (
                    <button key={t} onClick={() => changeType(t)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        q.type === t ? "bg-[#0047FF] text-white" : "bg-white border border-[#E8E5DF] text-[#6B6B6B] hover:border-[#0047FF]/40"
                      }`}>
                      {TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Question text */}
              <div>
                <label className="text-xs font-medium text-[#8A8A8A] mb-1.5 block">Формулировка вопроса</label>
                <textarea value={q.question} onChange={e => updateQ({ question: e.target.value })}
                  rows={3} placeholder="Напишите вопрос…"
                  className="w-full p-3 rounded-xl bg-white border border-[#E8E5DF] text-sm text-[#0A0A0A] outline-none focus:ring-2 focus:ring-[#0047FF]/20 resize-none" />
              </div>

              {/* Type-specific editor */}
              {(q.type === "single" || q.type === "multi") && (
                <div>
                  <label className="text-xs font-medium text-[#8A8A8A] mb-1.5 block">
                    Варианты ответа <span className="text-[#B0B0B0]">· отметьте {q.type === "multi" ? "правильные" : "правильный"} зелёной галочкой</span>
                  </label>
                  {q.type === "multi" && (
                    <div className="mb-3 flex items-center gap-2">
                      <label className="text-xs text-[#8A8A8A]">Сколько нужно выбрать:</label>
                      <input type="number" min={1} max={q.options.length} value={q.count}
                        onChange={e => updateQ({ count: parseInt(e.target.value) || 1 })}
                        className="w-16 px-2 py-1 rounded-lg border border-[#E8E5DF] text-xs text-center outline-none focus:ring-1 focus:ring-[#0047FF]/20" />
                    </div>
                  )}
                  <div className="space-y-2">
                    {q.options.map((opt, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        <button onClick={() => {
                          if (q.type === "single") {
                            updateQ({ correct: [oi] });
                          } else {
                            const c = q.correct.includes(oi) ? q.correct.filter(x => x !== oi) : [...q.correct, oi];
                            updateQ({ correct: c });
                          }
                        }}
                          title={q.correct.includes(oi) ? "Отметить неправильным" : "Отметить правильным"}
                          className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 border-2 transition-colors ${
                            q.correct.includes(oi) ? "bg-green-500 border-green-500 text-white" : "border-[#D1D1D1] text-transparent hover:border-green-400"
                          }`}>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </button>
                        <input value={opt} onChange={e => {
                          const opts = [...q.options]; opts[oi] = e.target.value;
                          updateQ({ options: opts });
                        }}
                          placeholder={`Вариант ${String.fromCharCode(1040 + oi)}`}
                          className="flex-1 px-3 py-2 rounded-lg bg-white border border-[#E8E5DF] text-sm outline-none focus:ring-1 focus:ring-[#0047FF]/20" />
                        <button onClick={() => {
                          const opts = q.options.filter((_, i) => i !== oi);
                          const correct = q.correct.filter(c => c !== oi).map(c => c > oi ? c - 1 : c);
                          updateQ({ options: opts, correct });
                        }}
                          title="Удалить вариант"
                          className="p-1.5 rounded-lg hover:bg-red-50 text-[#D1D1D1] hover:text-red-500 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <button onClick={() => updateQ({ options: [...q.options, ""] })}
                      className="flex items-center gap-1.5 text-xs text-[#0047FF] hover:underline mt-1">
                      <Plus className="w-3 h-3" /> Добавить вариант
                    </button>
                  </div>
                </div>
              )}

              {q.type === "tf" && (
                <div>
                  <label className="text-xs font-medium text-[#8A8A8A] mb-1.5 block">Правильный ответ</label>
                  <div className="flex gap-3">
                    {["Правда", "Ложь"].map((label, vi) => (
                      <button key={vi} onClick={() => updateQ({ correct: [vi] })}
                        className={`flex-1 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                          q.correct[0] === vi ? "border-green-500 bg-green-50 text-green-700" : "border-[#E8E5DF] text-[#6B6B6B] hover:border-green-300"
                        }`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {q.type === "order" && (
                <div>
                  <label className="text-xs font-medium text-[#8A8A8A] mb-1.5 block">Элементы в правильном порядке</label>
                  <div className="space-y-2">
                    {q.items.map((it, ii) => (
                      <div key={ii} className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-md bg-[#0047FF]/10 text-[#0047FF] text-xs font-bold flex items-center justify-center shrink-0">{ii + 1}</span>
                        <input value={it.text} onChange={e => {
                          const items = [...q.items]; items[ii] = { ...items[ii], text: e.target.value, order: ii + 1 };
                          updateQ({ items });
                        }}
                          placeholder={`Элемент №${ii + 1}`}
                          className="flex-1 px-3 py-2 rounded-lg bg-white border border-[#E8E5DF] text-sm outline-none focus:ring-1 focus:ring-[#0047FF]/20" />
                        <button onClick={() => {
                          const items = q.items.filter((_, i) => i !== ii).map((it2, i) => ({ ...it2, order: i + 1 }));
                          updateQ({ items });
                        }}
                          title="Удалить"
                          className="p-1.5 rounded-lg hover:bg-red-50 text-[#D1D1D1] hover:text-red-500 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <button onClick={() => updateQ({ items: [...q.items, { text: "", order: q.items.length + 1 }] })}
                      className="flex items-center gap-1.5 text-xs text-[#0047FF] hover:underline mt-1">
                      <Plus className="w-3 h-3" /> Добавить элемент
                    </button>
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-[#E8E5DF] text-xs text-[#8A8A8A]">
                💡 Изменения сохраняются автоматически каждые ~2.5 сек. Нажмите «Опубликовать» — тест появится на странице /study.
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-center">
              <div className="space-y-3">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-[#0047FF]/8 flex items-center justify-center">
                  <GripVertical className="w-6 h-6 text-[#0047FF]" />
                </div>
                <p className="text-[#6B6B6B] text-sm">Выберите вопрос слева<br/>или добавьте новый</p>
                <button onClick={addQuestion}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0047FF] text-white text-sm font-medium hover:bg-[#0038CC] transition-colors">
                  <Plus className="w-4 h-4" /> Добавить вопрос
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Preview modal */}
      {showPreview && (
        <PreviewModal
          test={{ title, description }}
          questions={questions}
          onClose={() => setShowPreview(false)}
        />
      )}

      {/* AI Generate modal */}
      {showAiGen && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4" onClick={() => setShowAiGen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-5" onClick={e => e.stopPropagation()}>
            <div>
              <h3 className="text-lg font-bold text-[#0A0A0A] flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" /> AI генерация вопросов
              </h3>
              <p className="text-xs text-[#6B6B6B] mt-1">Gemini сгенерирует готовые вопросы по вашей теме</p>
            </div>

            {/* Topic */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#6B6B6B]">Тема</label>
              <input
                autoFocus
                value={aiTopic}
                onChange={e => setAiTopic(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAiGenerate()}
                placeholder="например: История Казахстана, Python основы..."
                className="w-full px-4 py-3 rounded-xl border border-[#E8E5DF] text-sm outline-none focus:ring-2 focus:ring-purple-300/50 focus:border-purple-300"
              />
            </div>

            {/* Count */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#6B6B6B]">Количество вопросов: <span className="font-bold text-[#0A0A0A]">{aiCount}</span></label>
              <input
                type="range" min={3} max={30} value={aiCount}
                onChange={e => setAiCount(Number(e.target.value))}
                className="w-full accent-purple-600"
              />
              <div className="flex justify-between text-[10px] text-[#BFBFBF]">
                <span>3</span><span>10</span><span>20</span><span>30</span>
              </div>
            </div>

            {/* Language */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#6B6B6B]">Язык</label>
              <div className="flex gap-2">
                {[{v:"ru",l:"Русский"},{v:"kz",l:"Казахский"},{v:"en",l:"English"}].map(({v,l}) => (
                  <button key={v} onClick={() => setAiLang(v)}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all ${aiLang === v ? "border-purple-400 bg-purple-50 text-purple-700" : "border-[#E8E5DF] text-[#6B6B6B] hover:border-purple-200"}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Types */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#6B6B6B]">Типы вопросов</label>
              <div className="flex flex-wrap gap-2">
                {[{v:"single",l:"Один ответ"},{v:"multi",l:"Несколько"},{v:"tf",l:"Правда/Ложь"}].map(({v,l}) => (
                  <button key={v}
                    onClick={() => setAiTypes(prev => prev.includes(v) ? prev.filter(t => t !== v) : [...prev, v])}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${aiTypes.includes(v) ? "border-purple-400 bg-purple-50 text-purple-700" : "border-[#E8E5DF] text-[#6B6B6B] hover:border-purple-200"}`}>
                    {aiTypes.includes(v) ? "✓ " : ""}{l}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-1">
              <button onClick={() => setShowAiGen(false)}
                className="px-4 py-2 rounded-lg text-sm text-[#6B6B6B] hover:bg-[#F0EEE9] transition-colors">Отмена</button>
              <button onClick={handleAiGenerate}
                disabled={aiGenerating || !aiTopic.trim() || aiTypes.length === 0}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-60">
                {aiGenerating
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Генерируем…</>
                  : <><Sparkles className="w-4 h-4" /> Сгенерировать</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename modal */}
      {showRename && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4" onClick={() => setShowRename(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[#0A0A0A]">Переименовать тест</h3>
            <input
              autoFocus
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setShowRename(false); }}
              placeholder="Название теста"
              className="w-full px-4 py-3 rounded-xl border border-[#E8E5DF] text-sm outline-none focus:ring-2 focus:ring-[#0047FF]/20 focus:border-[#0047FF]/40"
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowRename(false)}
                className="px-4 py-2 rounded-lg text-sm text-[#6B6B6B] hover:bg-[#F0EEE9] transition-colors">Отмена</button>
              <button onClick={handleRename} disabled={renaming || !renameValue.trim()}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-[#0047FF] text-white text-sm font-medium hover:bg-[#0038CC] transition-colors disabled:opacity-60">
                {renaming ? <><Loader2 className="w-4 h-4 animate-spin" /> Сохраняем…</> : "Сохранить"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Input modal */}
      {showQuickInput && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4" onClick={() => setShowQuickInput(false)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div>
              <h3 className="text-lg font-bold text-[#0A0A0A] flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-600" /> Быстрый ввод
              </h3>
              <p className="text-xs text-[#6B6B6B] mt-1">Введите вопросы в простом текстовом формате — без JSON</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 space-y-0.5">
              <p className="font-semibold mb-1">Формат:</p>
              <p><span className="font-mono bg-white/70 px-1 rounded">Текст вопроса</span> — первая строка блока</p>
              <p><span className="font-mono bg-white/70 px-1 rounded">+ Правильный ответ</span> — начинается с плюса</p>
              <p><span className="font-mono bg-white/70 px-1 rounded">- Неправильный ответ</span> — начинается с минуса</p>
              <p className="text-amber-700 mt-1">Новый вопрос начинается с любой строки без + или -. Несколько + = тип «несколько ответов».</p>
            </div>
            <div className="bg-[#F5F3EE] rounded-xl p-3 text-xs font-mono text-[#6B6B6B]">
              <p className="text-[#0A0A0A] font-semibold mb-2 font-sans">Пример:</p>
              <div className="space-y-0.5">
                <p>Столица Казахстана?</p>
                <p className="text-green-700">+ Астана</p>
                <p className="text-red-500">- Алматы</p>
                <p className="text-red-500">- Шымкент</p>
                <p className="mt-1">Какие языки компилируемые?</p>
                <p className="text-green-700">+ Go</p>
                <p className="text-green-700">+ Rust</p>
                <p className="text-red-500">- Python</p>
              </div>
            </div>
            <textarea
              value={quickText}
              onChange={e => setQuickText(e.target.value)}
              rows={10}
              placeholder={"Текст вопроса?\n+ Правильный ответ\n- Неправильный ответ\n- Ещё вариант\n\nСледующий вопрос?\n+ Верно\n- Неверно"}
              className="w-full p-3 rounded-xl border border-[#E8E5DF] text-sm outline-none focus:ring-2 focus:ring-amber-300/50 resize-none font-mono"
            />
            {quickText.trim() && (
              <p className="text-xs text-[#6B6B6B]">
                Найдено вопросов: <span className="font-semibold text-[#0A0A0A]">{parseQuickText(quickText).length}</span>
              </p>
            )}
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowQuickInput(false)}
                className="px-4 py-2 rounded-lg text-sm text-[#6B6B6B] hover:bg-[#F0EEE9] transition-colors">Отмена</button>
              <button onClick={handleQuickImport} disabled={quickImporting || !quickText.trim()}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition-colors disabled:opacity-60">
                {quickImporting
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Создаём…</>
                  : <><Zap className="w-4 h-4" /> Создать вопросы</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import modal */}
      {showImport && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4" onClick={() => setShowImport(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[#0A0A0A]">Импорт вопросов (JSON)</h3>
            <p className="text-xs text-[#6B6B6B]">
              Вставьте JSON или загрузите <strong>CSV / Excel</strong>.<br />
              Формат таблицы: <code className="bg-[#F5F3EE] px-1 rounded text-[11px]">вопрос | тип | вариант1 | вариант2 | ... | правильный</code><br />
              Пример JSON элемента:<br />
              <code className="text-[11px] bg-[#F5F3EE] px-1.5 py-0.5 rounded">{`{ "question": "...", "type": "single", "options": ["A","B"], "correct": [0] }`}</code>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[#E8E5DF] text-xs cursor-pointer hover:bg-[#F5F3EE]">
                <Upload className="w-3.5 h-3.5 text-[#6B6B6B]" /> Загрузить .json
                <input type="file" accept=".json" onChange={handleFileImport} className="hidden" />
              </label>
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-green-200 bg-green-50 text-xs cursor-pointer hover:bg-green-100 text-green-700">
                <Table className="w-3.5 h-3.5" /> CSV / Excel
                <input type="file" accept=".csv,.xlsx,.xls,.ods" onChange={handleSpreadsheetImport} className="hidden" />
              </label>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(CHATGPT_PROMPT);
                  setCopiedPrompt(true);
                  setTimeout(() => setCopiedPrompt(false), 2000);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#0047FF]/30 bg-[#0047FF]/5 text-xs text-[#0047FF] hover:bg-[#0047FF]/10 transition-colors"
              >
                {copiedPrompt ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedPrompt ? "Скопировано!" : "Промпт для ChatGPT"}
              </button>
            </div>
            <textarea value={importJson} onChange={e => setImportJson(e.target.value)}
              rows={10} placeholder='[{ "question": "...", "type": "single", "options": ["A","B","C"], "correct": [1] }]'
              className="w-full p-3 rounded-xl border border-[#E8E5DF] text-xs font-mono outline-none focus:ring-2 focus:ring-[#0047FF]/20 resize-none" />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowImport(false)}
                className="px-4 py-2 rounded-lg text-sm text-[#6B6B6B] hover:bg-[#F0EEE9] transition-colors">Отмена</button>
              <button onClick={() => handleImport()} disabled={importing || !importJson.trim()}
                className="px-5 py-2 rounded-lg bg-[#0047FF] text-white text-sm font-medium hover:bg-[#0038CC] transition-colors disabled:opacity-60">
                {importing ? "Импортируем…" : "Импортировать"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
