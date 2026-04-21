import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { usePageTitle } from "../hooks/usePageTitle";
import { testsApi } from "../../api/client";
import type { TestWithQuestions, TestQuestion } from "../../api/client";
import {
  Plus, Trash2, Upload, Eye, EyeOff, ArrowLeft,
  FileJson, CheckCircle2, XCircle, GripVertical, Check, Loader2,
} from "lucide-react";

type QType = "single" | "multi" | "tf" | "order";

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
  const [importing, setImporting] = useState(false);

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
    metaTimer.current = setTimeout(async () => {
      setSaveState("saving");
      try {
        await testsApi.update(test.id, { title, description, category });
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 1500);
      } catch {
        setSaveState("error");
        flash("Не удалось сохранить", true);
      }
    }, 600);
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
    }, 700);
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
  async function handleImport() {
    if (!test) return;
    setImporting(true);
    try {
      const parsed = JSON.parse(importJson);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      const res = await testsApi.importQuestions(test.id, arr);
      flash(`Импортировано вопросов: ${res.imported}`);
      setShowImport(false);
      setImportJson("");
      await loadTest();
    } catch (e) {
      flash(e instanceof SyntaxError ? "Невалидный JSON" : "Ошибка импорта", true);
    }
    setImporting(false);
  }

  async function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setImportJson(text);
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
        <button onClick={() => navigate("/study")} className="p-2 rounded-lg hover:bg-[#F0EEE9] transition-colors" title="К списку тестов">
          <ArrowLeft className="w-5 h-5 text-[#6B6B6B]" />
        </button>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Название теста"
          className="flex-1 text-[15px] font-semibold text-[#0A0A0A] bg-transparent border-none outline-none truncate" />

        {/* Autosave indicator */}
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#8A8A8A] min-w-[90px] justify-end">
          {saveState === "saving" && <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Сохраняем…</>}
          {saveState === "saved" && <><Check className="w-3.5 h-3.5 text-green-600" /> Сохранено</>}
          {saveState === "error" && <span className="text-red-500">Ошибка</span>}
        </div>

        <button onClick={togglePublish}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            test.status === "published" ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-amber-100 text-amber-700 hover:bg-amber-200"
          }`}
          title={test.status === "published" ? "Снять с публикации" : "Опубликовать тест"}>
          {test.status === "published" ? <><Eye className="w-3.5 h-3.5" /> Опубликован</> : <><EyeOff className="w-3.5 h-3.5" /> Черновик</>}
        </button>
        <button onClick={() => setShowImport(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F0EEE9] text-xs font-medium text-[#6B6B6B] hover:bg-[#E8E5DF] transition-colors" title="Импорт вопросов из JSON">
          <FileJson className="w-3.5 h-3.5" /> Импорт
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
                💡 Изменения сохраняются автоматически. Когда всё готово — нажмите «Черновик» в шапке, чтобы опубликовать тест.
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

      {/* Import modal */}
      {showImport && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4" onClick={() => setShowImport(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[#0A0A0A]">Импорт вопросов (JSON)</h3>
            <p className="text-xs text-[#6B6B6B]">
              Вставьте массив вопросов. Пример одного элемента:<br />
              <code className="text-[11px] bg-[#F5F3EE] px-1.5 py-0.5 rounded">{`{ "question": "...", "type": "single", "options": ["A","B"], "correct": [0] }`}</code>
            </p>
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[#E8E5DF] text-xs cursor-pointer hover:bg-[#F5F3EE]">
                <Upload className="w-3.5 h-3.5 text-[#6B6B6B]" /> Загрузить .json
                <input type="file" accept=".json" onChange={handleFileImport} className="hidden" />
              </label>
            </div>
            <textarea value={importJson} onChange={e => setImportJson(e.target.value)}
              rows={10} placeholder='[{ "question": "...", "type": "single", "options": ["A","B","C"], "correct": [1] }]'
              className="w-full p-3 rounded-xl border border-[#E8E5DF] text-xs font-mono outline-none focus:ring-2 focus:ring-[#0047FF]/20 resize-none" />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowImport(false)}
                className="px-4 py-2 rounded-lg text-sm text-[#6B6B6B] hover:bg-[#F0EEE9] transition-colors">Отмена</button>
              <button onClick={handleImport} disabled={importing || !importJson.trim()}
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
