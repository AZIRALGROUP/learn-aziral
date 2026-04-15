import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { usePageTitle } from "../hooks/usePageTitle";
import { testsApi } from "../../api/client";
import type { TestWithQuestions, TestQuestion } from "../../api/client";
import {
  Plus, Trash2, Save, Upload, Eye, EyeOff, ArrowLeft,
  FileJson, CheckCircle2, XCircle, GripVertical,
} from "lucide-react";

type QType = "single" | "multi" | "tf" | "order";

const TYPE_LABELS: Record<QType, string> = {
  single: "Single choice",
  multi: "Multi choice",
  tf: "True / False",
  order: "Chronological order",
};

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
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // Editable test metadata
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");

  // Import modal
  const [showImport, setShowImport] = useState(false);
  const [importJson, setImportJson] = useState("");
  const [importing, setImporting] = useState(false);

  usePageTitle(test ? `${test.title} — Builder` : "Test Builder");

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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить тест");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadTest(); }, [loadTest]);

  /* ── Save metadata ─────────────────────────────────────── */
  async function saveMeta() {
    if (!test) return;
    setSaving(true);
    try {
      await testsApi.update(test.id, { title, description, category });
      flash("Метаданные сохранены");
    } catch { flash("Ошибка сохранения", true); }
    setSaving(false);
  }

  /* ── Toggle publish ────────────────────────────────────── */
  async function togglePublish() {
    if (!test) return;
    try {
      const res = await testsApi.togglePublish(test.id);
      setTest({ ...test, status: res.status });
      flash(res.status === "published" ? "Тест опубликован" : "Тест в черновике");
    } catch { flash("Ошибка", true); }
  }

  /* ── Add question ──────────────────────────────────────── */
  async function addQuestion() {
    if (!test) return;
    try {
      const q = await testsApi.addQuestion(test.id, emptyQ("single"));
      setQuestions(prev => [...prev, q]);
      setSelectedIdx(questions.length);
      flash("Вопрос добавлен");
    } catch { flash("Ошибка добавления", true); }
  }

  /* ── Save question ─────────────────────────────────────── */
  async function saveQuestion() {
    if (selectedIdx === null) return;
    const q = questions[selectedIdx];
    setSaving(true);
    try {
      const updated = await testsApi.updateQuestion(q.id, {
        question: q.question,
        type: q.type,
        options: q.options,
        items: q.items,
        correct: q.correct,
        count: q.count,
      });
      setQuestions(prev => { const n = [...prev]; n[selectedIdx] = updated; return n; });
      flash("Вопрос сохранён");
    } catch { flash("Ошибка сохранения", true); }
    setSaving(false);
  }

  /* ── Delete question ───────────────────────────────────── */
  async function deleteQuestion() {
    if (selectedIdx === null) return;
    const q = questions[selectedIdx];
    if (!confirm(`Удалить вопрос #${selectedIdx + 1}?`)) return;
    try {
      await testsApi.deleteQuestion(q.id);
      const newList = questions.filter((_, i) => i !== selectedIdx);
      setQuestions(newList);
      setSelectedIdx(newList.length > 0 ? Math.min(selectedIdx, newList.length - 1) : null);
      flash("Вопрос удалён");
    } catch { flash("Ошибка удаления", true); }
  }

  /* ── Import ────────────────────────────────────────────── */
  async function handleImport() {
    if (!test) return;
    setImporting(true);
    try {
      const parsed = JSON.parse(importJson);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      const res = await testsApi.importQuestions(test.id, arr);
      flash(`Импортировано ${res.imported} вопросов`);
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
    setStatus((isError ? "❌ " : "✅ ") + msg);
    setTimeout(() => setStatus(null), 3000);
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
          <button onClick={() => navigate("/instructor")} className="text-sm text-[#0047FF] hover:underline">← Назад</button>
        </div>
      </div>
    );
  }

  const q = selectedIdx !== null ? questions[selectedIdx] : null;

  return (
    <div className="min-h-screen bg-[#F5F3EE]">
      {/* Top bar */}
      <div className="fixed top-0 left-0 right-0 z-50 h-16 bg-white border-b border-[#E8E5DF] flex items-center px-4 gap-3">
        <button onClick={() => navigate("/study")} className="p-2 rounded-lg hover:bg-[#F0EEE9] transition-colors">
          <ArrowLeft className="w-5 h-5 text-[#6B6B6B]" />
        </button>
        <input value={title} onChange={e => setTitle(e.target.value)} onBlur={saveMeta}
          className="flex-1 text-[15px] font-semibold text-[#0A0A0A] bg-transparent border-none outline-none truncate" />
        <button onClick={togglePublish}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            test.status === "published" ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-amber-100 text-amber-700 hover:bg-amber-200"
          }`}>
          {test.status === "published" ? <><Eye className="w-3.5 h-3.5" /> Published</> : <><EyeOff className="w-3.5 h-3.5" /> Draft</>}
        </button>
        <button onClick={() => setShowImport(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F0EEE9] text-xs font-medium text-[#6B6B6B] hover:bg-[#E8E5DF] transition-colors">
          <FileJson className="w-3.5 h-3.5" /> Import
        </button>
      </div>

      {/* Status toast */}
      {status && (
        <div className="fixed top-20 right-4 z-50 px-4 py-2 rounded-xl bg-white border border-[#E8E5DF] shadow-lg text-sm animate-in fade-in">
          {status}
        </div>
      )}

      {/* Main */}
      <div className="flex pt-16" style={{ minHeight: "calc(100vh - 0px)" }}>
        {/* Left: question list */}
        <div className="w-72 shrink-0 bg-white border-r border-[#E8E5DF] overflow-y-auto" style={{ height: "calc(100vh - 64px)" }}>
          <div className="p-3 border-b border-[#E8E5DF]">
            <div className="text-xs text-[#8A8A8A] font-medium mb-2">Description</div>
            <textarea value={description} onChange={e => setDescription(e.target.value)} onBlur={saveMeta}
              rows={2} placeholder="Описание теста..."
              className="w-full text-xs text-[#3A3A3A] bg-[#F5F3EE] rounded-lg p-2 border-none resize-none outline-none focus:ring-1 focus:ring-[#0047FF]/20" />
            <div className="text-xs text-[#8A8A8A] font-medium mt-2 mb-1">Category</div>
            <input value={category} onChange={e => setCategory(e.target.value)} onBlur={saveMeta}
              placeholder="e.g. history, math..."
              className="w-full text-xs text-[#3A3A3A] bg-[#F5F3EE] rounded-lg p-2 border-none outline-none focus:ring-1 focus:ring-[#0047FF]/20" />
          </div>

          <div className="p-2 space-y-1">
            {questions.map((qq, i) => (
              <button key={qq.id} onClick={() => setSelectedIdx(i)}
                className={`w-full flex items-start gap-2 px-3 py-2.5 rounded-lg text-left transition-colors ${
                  selectedIdx === i ? "bg-[#0047FF]/8 text-[#0047FF]" : "hover:bg-[#F5F3EE] text-[#3A3A3A]"
                }`}>
                <span className="text-xs font-bold mt-0.5 shrink-0">{i + 1}</span>
                <div className="overflow-hidden">
                  <div className="text-xs truncate">{qq.question || "(empty)"}</div>
                  <div className="text-[10px] text-[#8A8A8A] mt-0.5">{TYPE_LABELS[qq.type as QType]}</div>
                </div>
              </button>
            ))}
          </div>

          <div className="p-2 border-t border-[#E8E5DF]">
            <button onClick={addQuestion}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-dashed border-[#D1D1D1] text-xs text-[#6B6B6B] hover:border-[#0047FF] hover:text-[#0047FF] transition-colors">
              <Plus className="w-3.5 h-3.5" /> Add question
            </button>
          </div>
        </div>

        {/* Right: editor */}
        <div className="flex-1 overflow-y-auto p-6" style={{ height: "calc(100vh - 64px)" }}>
          {q ? (
            <div className="max-w-2xl space-y-5">
              {/* Type selector */}
              <div>
                <label className="text-xs font-medium text-[#8A8A8A] mb-1.5 block">Question type</label>
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
                <label className="text-xs font-medium text-[#8A8A8A] mb-1.5 block">Question</label>
                <textarea value={q.question} onChange={e => updateQ({ question: e.target.value })}
                  rows={3} placeholder="Enter the question..."
                  className="w-full p-3 rounded-xl bg-white border border-[#E8E5DF] text-sm text-[#0A0A0A] outline-none focus:ring-2 focus:ring-[#0047FF]/20 resize-none" />
              </div>

              {/* Type-specific editor */}
              {(q.type === "single" || q.type === "multi") && (
                <div>
                  <label className="text-xs font-medium text-[#8A8A8A] mb-1.5 block">
                    Options {q.type === "multi" && <span className="text-[#0047FF]">(choose {q.count})</span>}
                  </label>
                  {q.type === "multi" && (
                    <div className="mb-3">
                      <label className="text-xs text-[#8A8A8A]">How many to select:</label>
                      <input type="number" min={1} max={q.options.length} value={q.count}
                        onChange={e => updateQ({ count: parseInt(e.target.value) || 1 })}
                        className="ml-2 w-16 px-2 py-1 rounded-lg border border-[#E8E5DF] text-xs text-center outline-none focus:ring-1 focus:ring-[#0047FF]/20" />
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
                          className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 border-2 transition-colors ${
                            q.correct.includes(oi) ? "bg-green-500 border-green-500 text-white" : "border-[#D1D1D1] text-transparent hover:border-green-400"
                          }`}>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </button>
                        <input value={opt} onChange={e => {
                          const opts = [...q.options]; opts[oi] = e.target.value;
                          updateQ({ options: opts });
                        }}
                          placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                          className="flex-1 px-3 py-2 rounded-lg bg-white border border-[#E8E5DF] text-sm outline-none focus:ring-1 focus:ring-[#0047FF]/20" />
                        <button onClick={() => {
                          const opts = q.options.filter((_, i) => i !== oi);
                          const correct = q.correct.filter(c => c !== oi).map(c => c > oi ? c - 1 : c);
                          updateQ({ options: opts, correct });
                        }}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-[#D1D1D1] hover:text-red-500 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <button onClick={() => updateQ({ options: [...q.options, ""] })}
                      className="flex items-center gap-1.5 text-xs text-[#0047FF] hover:underline mt-1">
                      <Plus className="w-3 h-3" /> Add option
                    </button>
                  </div>
                </div>
              )}

              {q.type === "tf" && (
                <div>
                  <label className="text-xs font-medium text-[#8A8A8A] mb-1.5 block">Correct answer</label>
                  <div className="flex gap-3">
                    {["True", "False"].map((label, vi) => (
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
                  <label className="text-xs font-medium text-[#8A8A8A] mb-1.5 block">Items in correct order</label>
                  <div className="space-y-2">
                    {q.items.map((it, ii) => (
                      <div key={ii} className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-md bg-[#0047FF]/10 text-[#0047FF] text-xs font-bold flex items-center justify-center shrink-0">{ii + 1}</span>
                        <input value={it.text} onChange={e => {
                          const items = [...q.items]; items[ii] = { ...items[ii], text: e.target.value, order: ii + 1 };
                          updateQ({ items });
                        }}
                          placeholder={`Item ${ii + 1}`}
                          className="flex-1 px-3 py-2 rounded-lg bg-white border border-[#E8E5DF] text-sm outline-none focus:ring-1 focus:ring-[#0047FF]/20" />
                        <button onClick={() => {
                          const items = q.items.filter((_, i) => i !== ii).map((it2, i) => ({ ...it2, order: i + 1 }));
                          updateQ({ items });
                        }}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-[#D1D1D1] hover:text-red-500 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <button onClick={() => updateQ({ items: [...q.items, { text: "", order: q.items.length + 1 }] })}
                      className="flex items-center gap-1.5 text-xs text-[#0047FF] hover:underline mt-1">
                      <Plus className="w-3 h-3" /> Add item
                    </button>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center gap-3 pt-3 border-t border-[#E8E5DF]">
                <button onClick={saveQuestion} disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0047FF] text-white text-sm font-medium hover:bg-[#0038CC] transition-colors disabled:opacity-60">
                  <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save question"}
                </button>
                <button onClick={deleteQuestion}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 text-red-500 text-sm font-medium hover:bg-red-50 transition-colors">
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-center">
              <div className="space-y-3">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-[#0047FF]/8 flex items-center justify-center">
                  <GripVertical className="w-6 h-6 text-[#0047FF]" />
                </div>
                <p className="text-[#6B6B6B] text-sm">Select a question from the left panel<br/>or add a new one</p>
                <button onClick={addQuestion}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0047FF] text-white text-sm font-medium hover:bg-[#0038CC] transition-colors">
                  <Plus className="w-4 h-4" /> Add question
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
            <h3 className="text-lg font-bold text-[#0A0A0A]">Import Questions (JSON)</h3>
            <p className="text-xs text-[#6B6B6B]">
              Paste a JSON array of questions. Each item: {"{"} question, type, options, correct, count, items {"}"}
            </p>
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[#E8E5DF] text-xs cursor-pointer hover:bg-[#F5F3EE]">
                <Upload className="w-3.5 h-3.5 text-[#6B6B6B]" /> Upload .json
                <input type="file" accept=".json" onChange={handleFileImport} className="hidden" />
              </label>
            </div>
            <textarea value={importJson} onChange={e => setImportJson(e.target.value)}
              rows={10} placeholder='[{ "question": "...", "type": "single", "options": ["A","B","C"], "correct": [1] }]'
              className="w-full p-3 rounded-xl border border-[#E8E5DF] text-xs font-mono outline-none focus:ring-2 focus:ring-[#0047FF]/20 resize-none" />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowImport(false)}
                className="px-4 py-2 rounded-lg text-sm text-[#6B6B6B] hover:bg-[#F0EEE9] transition-colors">Cancel</button>
              <button onClick={handleImport} disabled={importing || !importJson.trim()}
                className="px-5 py-2 rounded-lg bg-[#0047FF] text-white text-sm font-medium hover:bg-[#0038CC] transition-colors disabled:opacity-60">
                {importing ? "Importing..." : "Import"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
