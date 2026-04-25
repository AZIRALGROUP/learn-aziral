import { useState, useEffect } from "react";
import { usePageTitle } from "../hooks/usePageTitle";
import { Link, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft, Plus, Trash2, Save, GripVertical,
  FileText, Video, CheckSquare, Code2,
  Zap, Eye,
  AlertCircle, Check, BookOpen, Loader2,
  PlayCircle, ClipboardList, Pencil
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

type LessonType = "text" | "video" | "quiz" | "task";

type Quiz = {
  id?: number;
  question: string;
  options: string[];
  correct_index: number;
  xp_reward: number;
  _new?: boolean;
  _deleted?: boolean;
};

type Lesson = {
  id?: number;
  title: string;
  type: LessonType;
  content: string;
  video_url: string;
  task_description: string;
  task_starter_code: string;
  xp_reward: number;
  order_num: number;
  quizzes: Quiz[];
  _new?: boolean;
  _saving?: boolean;
};

const TYPE_META: Record<LessonType, { icon: typeof FileText; label: string; color: string; bg: string }> = {
  text:  { icon: FileText,      label: "Текст",    color: "text-blue-400",   bg: "bg-blue-500/10 border-blue-500/20" },
  video: { icon: Video,         label: "Видео",    color: "text-red-400",    bg: "bg-red-500/10 border-red-500/20" },
  quiz:  { icon: CheckSquare,   label: "Тест",     color: "text-green-400",  bg: "bg-green-500/10 border-green-500/20" },
  task:  { icon: Code2,         label: "Задание",  color: "text-[#0047FF]", bg: "bg-[#0047FF]/8 border-[#0047FF]/20" },
};

function getYoutubeEmbed(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
}

export function CourseBuilderPage() {
  usePageTitle("Редактор курса — AZIRAL");
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [course, setCourse] = useState<any>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedId, setSelectedId] = useState<number | string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const showToast = (type: "ok" | "err", text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3000);
  };

  // Load course & lessons
  useEffect(() => {
    if (!id || !user) return;
    Promise.all([
      fetch(`/api/courses/${id}`, { credentials: 'include' }).then(r => r.ok ? r.json() : null),
      fetch(`/api/instructor/courses/${id}/lessons`, { credentials: 'include' }).then(r => r.ok ? r.json() : []),
    ]).then(([c, ls]) => {
      setCourse(c);
      setLessons(ls.map((l: any) => ({
        ...l,
        quizzes: (l.quizzes || []).map((q: any) => ({
          ...q,
          options: typeof q.options === "string" ? JSON.parse(q.options) : q.options,
        })),
      })));
    }).finally(() => setLoading(false));
  }, [id, user]);

  const selected = lessons.find(l => l.id === selectedId || (l._new && l.order_num === selectedId));

  // Add new lesson
  const addLesson = (type: LessonType) => {
    const tempId = Date.now();
    const newLesson: Lesson = {
      title: `Новый урок — ${TYPE_META[type].label}`,
      type,
      content: "",
      video_url: "",
      task_description: "",
      task_starter_code: "// Ваш код здесь\n",
      xp_reward: 10,
      order_num: tempId,
      quizzes: type === "quiz" ? [{ question: "", options: ["", "", "", ""], correct_index: 0, xp_reward: 5 }] : [],
      _new: true,
    };
    setLessons(prev => [...prev, newLesson]);
    setSelectedId(tempId);
  };

  // Update selected lesson field
  const updateLesson = (field: keyof Lesson, value: any) => {
    setLessons(prev => prev.map(l =>
      (l.id === selectedId || (l._new && l.order_num === selectedId))
        ? { ...l, [field]: value }
        : l
    ));
  };

  // Save lesson to backend
  const saveLesson = async (lesson: Lesson) => {
    if (!lesson.title.trim()) { showToast("err", "Введите название урока"); return; }
    setSaving(true);
    const body = {
      title: lesson.title,
      type: lesson.type,
      content: lesson.content,
      video_url: lesson.video_url,
      task_description: lesson.task_description,
      task_starter_code: lesson.task_starter_code,
      xp_reward: lesson.xp_reward,
    };

    let lessonId = lesson.id;

    if (lesson._new) {
      const r = await fetch(`/api/instructor/courses/${id}/lessons`, {
        method: "POST", credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!r.ok) { const d = await r.json(); showToast("err", d.error || "Ошибка создания урока"); setSaving(false); return; }
      const d = await r.json();
      lessonId = d.id;
      setLessons(prev => prev.map(l => l.order_num === selectedId ? { ...l, id: d.id, _new: false } : l));
      setSelectedId(d.id);
    } else {
      const r = await fetch(`/api/instructor/lessons/${lesson.id}`, {
        method: "PATCH", credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!r.ok) { const d = await r.json(); showToast("err", d.error || "Ошибка сохранения"); setSaving(false); return; }
    }

    // Save quizzes for quiz-type or any lesson with quizzes
    if (lesson.type === "quiz" && lessonId) {
      for (const q of lesson.quizzes) {
        if (q._deleted && q.id) {
          await fetch(`/api/instructor/quizzes/${q.id}`, { method: "DELETE", credentials: 'include' });
        } else if (!q._deleted && !q.id && q.question.trim()) {
          await fetch(`/api/instructor/lessons/${lessonId}/quizzes`, {
            method: "POST", credentials: 'include', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question: q.question, options: q.options, correct_index: q.correct_index, xp_reward: q.xp_reward }),
          });
        } else if (!q._deleted && q.id && q.question.trim()) {
          await fetch(`/api/instructor/quizzes/${q.id}`, {
            method: "PATCH", credentials: 'include', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question: q.question, options: q.options, correct_index: q.correct_index, xp_reward: q.xp_reward }),
          });
        }
      }
      // Reload quizzes
      const qr = await fetch(`/api/instructor/lessons/${lessonId}/quizzes`, { credentials: 'include' });
      const updatedQuizzes = await qr.json();
      setLessons(prev => prev.map(l => l.id === lessonId ? {
        ...l,
        quizzes: updatedQuizzes.map((q: any) => ({ ...q, options: typeof q.options === "string" ? JSON.parse(q.options) : q.options }))
      } : l));
    }

    showToast("ok", "Урок сохранён ✓");
    setSaving(false);
  };

  // Ctrl+S / Cmd+S to save current lesson
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        const sel = lessons.find(l => l.id === selectedId || (l._new && l.order_num === selectedId));
        if (sel) saveLesson(sel);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lessons, selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Delete lesson
  const deleteLesson = async (lesson: Lesson) => {
    if (!window.confirm(`Удалить урок "${lesson.title}"?`)) return;
    if (!lesson._new && lesson.id) {
      await fetch(`/api/instructor/lessons/${lesson.id}`, { method: "DELETE", credentials: 'include' });
    }
    setLessons(prev => prev.filter(l => {
      if (lesson.id) return l.id !== lesson.id;
      return !(l._new && l.order_num === lesson.order_num);
    }));
    setSelectedId(null);
  };

  // Quiz helpers
  const addQuizQuestion = () => {
    updateLesson("quizzes", [...(selected?.quizzes || []), { question: "", options: ["", "", "", ""], correct_index: 0, xp_reward: 5 }]);
  };
  const updateQuiz = (qi: number, field: keyof Quiz, value: any) => {
    const qs = [...(selected?.quizzes || [])];
    qs[qi] = { ...qs[qi], [field]: value };
    updateLesson("quizzes", qs);
  };
  const updateQuizOption = (qi: number, oi: number, val: string) => {
    const qs = [...(selected?.quizzes || [])];
    const opts = [...qs[qi].options];
    opts[oi] = val;
    qs[qi] = { ...qs[qi], options: opts };
    updateLesson("quizzes", qs);
  };
  const removeQuizQuestion = (qi: number) => {
    const qs = [...(selected?.quizzes || [])];
    if (qs[qi].id) { qs[qi] = { ...qs[qi], _deleted: true }; }
    else { qs.splice(qi, 1); }
    updateLesson("quizzes", qs);
  };

  // Drag & drop for reorder
  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDrop = async (targetIdx: number) => {
    if (dragIdx === null || dragIdx === targetIdx) { setDragIdx(null); setDragOver(null); return; }
    const reordered = [...lessons];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(targetIdx, 0, moved);
    setLessons(reordered);
    setDragIdx(null); setDragOver(null);
    // Save order to backend
    const ids = reordered.filter(l => !l._new && l.id).map(l => l.id!);
    if (ids.length > 0) {
      await fetch(`/api/instructor/courses/${id}/reorder-lessons`, {
        method: "PATCH", credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order: ids }),
      });
    }
  };

  if (!user) return <div className="min-h-screen bg-[#F5F3EE] flex items-center justify-center text-[#6B6B6B]">Нужно войти</div>;

  if (loading) return (
    <div className="min-h-screen bg-[#F5F3EE] flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-[#0047FF] animate-spin" />
    </div>
  );

  if (!course) return (
    <div className="min-h-screen bg-[#F5F3EE] flex flex-col items-center justify-center gap-4">
      <AlertCircle className="w-12 h-12 text-red-400" />
      <p className="text-[#6B6B6B]">Курс не найден или нет доступа</p>
      <Link to="/instructor" className="text-[#0047FF] hover:underline">← Назад</Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F5F3EE] flex flex-col">

      {/* Top bar */}
      <div className="border-b border-[#E8E5DF] bg-[#F5F3EE]/95 backdrop-blur sticky top-0 z-40">
        <div className="flex items-center gap-4 px-4 py-3">
          <Link to="/instructor" className="flex items-center gap-2 text-[#6B6B6B] hover:text-[#0A0A0A] transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" /> Назад
          </Link>
          <div className="w-px h-5 bg-[#EDEAE4]" />
          <div className="flex-1 min-w-0">
            <h1 className="text-[#0A0A0A] font-medium text-sm truncate">{course.title}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-xs px-2 py-0.5 rounded-full border ${
                course.status === "approved" ? "text-green-400 bg-green-500/10 border-green-500/20" :
                course.status === "pending" ? "text-yellow-400 bg-yellow-500/10 border-yellow-500/20" :
                "text-red-400 bg-red-500/10 border-red-500/20"
              }`}>{course.status === "approved" ? "Опубликован" : course.status === "pending" ? "На проверке" : "Отклонён"}</span>
              <span className="text-[#8A8A8A] text-xs">{lessons.length} уроков</span>
            </div>
          </div>
          <Link to={`/courses/${id}`} target="_blank"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F5F3EE] border border-[#E8E5DF] text-[#6B6B6B] hover:text-[#0A0A0A] rounded-lg text-xs transition-colors">
            <Eye className="w-3.5 h-3.5" /> Просмотр
          </Link>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden" style={{ height: "calc(100vh - 57px)" }}>

        {/* ── LEFT SIDEBAR ── */}
        <div className="w-72 border-r border-[#E8E5DF] bg-[#060b14] flex flex-col shrink-0 overflow-hidden">

          {/* Add lesson buttons */}
          <div className="p-3 border-b border-[#E8E5DF]">
            <p className="text-[#8A8A8A] text-xs mb-2 uppercase tracking-wide px-1">Добавить урок</p>
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.entries(TYPE_META) as [LessonType, typeof TYPE_META["text"]][]).map(([type, meta]) => {
                const Icon = meta.icon;
                return (
                  <button key={type} onClick={() => addLesson(type)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-all hover:scale-[1.02] ${meta.bg} ${meta.color}`}>
                    <Icon className="w-3.5 h-3.5 shrink-0" /> {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Lesson list */}
          <div className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
            {lessons.length === 0 && (
              <div className="text-center py-12 text-[#8A8A8A] text-xs px-4">
                <BookOpen className="w-8 h-8 mx-auto mb-3 opacity-30" />
                Добавьте первый урок с помощью кнопок выше
              </div>
            )}
            {lessons.map((lesson, idx) => {
              const isSelected = lesson.id === selectedId || (lesson._new && lesson.order_num === selectedId);
              const meta = TYPE_META[lesson.type] || TYPE_META.text;
              const Icon = meta.icon;
              return (
                <div key={lesson.id || lesson.order_num}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={e => { e.preventDefault(); setDragOver(idx); }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={() => handleDrop(idx)}
                  onClick={() => setSelectedId(lesson.id || lesson.order_num)}
                  className={`group relative flex items-center gap-2 p-2.5 rounded-xl cursor-pointer transition-all border ${
                    isSelected ? "bg-white/[0.07] border-white/[0.12]" :
                    dragOver === idx ? "bg-[#0047FF]/8 border-[#0047FF]/30" :
                    "border-transparent hover:bg-[#F0EEE9]"
                  }`}
                >
                  <GripVertical className="w-3.5 h-3.5 text-[#A0A0A0] group-hover:text-[#6B6B6B] shrink-0 cursor-grab" />
                  <div className={`p-1 rounded-md shrink-0 ${meta.bg} border`}>
                    <Icon className={`w-3 h-3 ${meta.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium truncate ${isSelected ? "text-[#0A0A0A]" : "text-[#3A3A3A]"}`}>
                      {lesson.title}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Zap className="w-2.5 h-2.5 text-yellow-500/60" />
                      <span className="text-[#8A8A8A] text-[10px]">{lesson.xp_reward} XP</span>
                      {lesson._new && <span className="text-[10px] text-orange-400/70">• несохранён</span>}
                    </div>
                  </div>
                  {/* Delete button */}
                  <button onClick={e => { e.stopPropagation(); deleteLesson(lesson); }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-red-400/70 hover:text-red-400 transition-all rounded-md hover:bg-red-500/10">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── MAIN EDITOR ── */}
        <div className="flex-1 overflow-y-auto bg-[#F5F3EE]">
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <div className="w-20 h-20 bg-[#F5F3EE] border border-[#E8E5DF] rounded-3xl flex items-center justify-center mb-6">
                <Pencil className="w-8 h-8 text-[#A0A0A0]" />
              </div>
              <h2 className="text-[#0A0A0A] text-xl font-medium mb-2">Выберите урок</h2>
              <p className="text-[#6B6B6B] text-sm max-w-xs">Нажмите на урок в списке слева или создайте новый, чтобы начать редактирование</p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto p-6 space-y-6">

              {/* Lesson header */}
              <div className="flex items-start gap-4">
                <div className="flex-1 space-y-3">
                  <input
                    value={selected.title}
                    onChange={e => updateLesson("title", e.target.value)}
                    placeholder="Название урока"
                    className="w-full bg-transparent text-[#0A0A0A] text-2xl font-bold placeholder-[#A0A0A0] outline-none border-b border-[#E8E5DF] pb-2 focus:border-[#0047FF]/50 transition-colors"
                  />
                </div>
              </div>

              {/* Type selector */}
              <div className="flex gap-2 flex-wrap">
                {(Object.entries(TYPE_META) as [LessonType, typeof TYPE_META["text"]][]).map(([type, meta]) => {
                  const Icon = meta.icon;
                  const isActive = selected.type === type;
                  return (
                    <button key={type} onClick={() => updateLesson("type", type)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
                        isActive ? `${meta.bg} ${meta.color}` : "bg-[#F5F3EE] border-[#E8E5DF] text-[#6B6B6B] hover:text-[#3A3A3A]"
                      }`}>
                      <Icon className="w-3.5 h-3.5" /> {meta.label}
                    </button>
                  );
                })}
                <div className="flex items-center gap-2 ml-auto">
                  <Zap className="w-4 h-4 text-yellow-500/70" />
                  <input type="number" min="1" max="100"
                    value={selected.xp_reward}
                    onChange={e => updateLesson("xp_reward", Number(e.target.value))}
                    className="w-16 bg-[#F5F3EE] border border-[#E8E5DF] rounded-lg px-2 py-1.5 text-yellow-400 text-xs text-center outline-none focus:border-yellow-500/40"
                  />
                  <span className="text-[#8A8A8A] text-xs">XP</span>
                </div>
              </div>

              {/* ── TEXT editor ── */}
              {selected.type === "text" && (
                <div className="space-y-3">
                  <label className="text-[#6B6B6B] text-sm">Содержимое урока</label>
                  <textarea
                    value={selected.content}
                    onChange={e => updateLesson("content", e.target.value)}
                    placeholder="Напишите содержимое урока. Поддерживается Markdown: **жирный**, *курсив*, `код`, ## заголовок..."
                    rows={18}
                    className="w-full bg-[#F5F3EE] border border-[#E8E5DF] focus:border-[#0047FF]/30 rounded-2xl p-5 text-[#0A0A0A] text-sm font-mono leading-relaxed placeholder-[#A0A0A0] outline-none transition-colors resize-none"
                  />
                  <p className="text-[#A0A0A0] text-xs">Markdown поддерживается — заголовки (##), списки (-), жирный (**текст**), код (`code`)</p>
                </div>
              )}

              {/* ── VIDEO editor ── */}
              {selected.type === "video" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[#6B6B6B] text-sm flex items-center gap-2">
                      <PlayCircle className="w-4 h-4 text-red-400" /> Ссылка на видео
                    </label>
                    <input
                      value={selected.video_url}
                      onChange={e => updateLesson("video_url", e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=... или https://vimeo.com/..."
                      className="w-full bg-[#F5F3EE] border border-[#E8E5DF] focus:border-red-500/30 rounded-xl px-4 py-3 text-[#0A0A0A] text-sm placeholder-[#A0A0A0] outline-none transition-colors"
                    />
                  </div>
                  {/* Preview */}
                  {selected.video_url && getYoutubeEmbed(selected.video_url) && (
                    <div className="rounded-2xl overflow-hidden border border-[#E8E5DF] bg-[#F0EEE9] aspect-video">
                      <iframe
                        src={getYoutubeEmbed(selected.video_url)!}
                        className="w-full h-full"
                        allowFullScreen
                        title="Предпросмотр видео"
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <label className="text-[#6B6B6B] text-sm">Описание к видео (необязательно)</label>
                    <textarea
                      value={selected.content}
                      onChange={e => updateLesson("content", e.target.value)}
                      placeholder="Опишите что будет в этом видео, ключевые моменты..."
                      rows={5}
                      className="w-full bg-[#F5F3EE] border border-[#E8E5DF] focus:border-red-500/30 rounded-2xl p-4 text-[#0A0A0A] text-sm placeholder-[#A0A0A0] outline-none resize-none transition-colors"
                    />
                  </div>
                </div>
              )}

              {/* ── QUIZ editor ── */}
              {selected.type === "quiz" && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="w-4 h-4 text-green-400" />
                      <h3 className="text-[#0A0A0A] text-sm font-medium">Вопросы теста</h3>
                      <span className="text-[#8A8A8A] text-xs">({selected.quizzes.filter(q => !q._deleted).length} вопр.)</span>
                    </div>
                    <button onClick={addQuizQuestion}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 border border-green-500/20 text-green-400 text-xs rounded-lg hover:bg-green-500/20 transition-colors">
                      <Plus className="w-3.5 h-3.5" /> Добавить вопрос
                    </button>
                  </div>

                  {selected.quizzes.filter(q => !q._deleted).length === 0 && (
                    <div className="text-center py-8 bg-white/[0.02] rounded-2xl border border-dashed border-[#E8E5DF]">
                      <CheckSquare className="w-8 h-8 mx-auto mb-2 text-[#A0A0A0]" />
                      <p className="text-[#8A8A8A] text-sm">Нажмите «Добавить вопрос» чтобы создать тест</p>
                    </div>
                  )}

                  <AnimatePresence>
                    {selected.quizzes.map((q, qi) => {
                      if (q._deleted) return null;
                      return (
                        <motion.div key={qi} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                          className="bg-[#F5F3EE] border border-[#E8E5DF] rounded-2xl p-5 space-y-4">
                          <div className="flex items-start gap-3">
                            <div className="flex items-center justify-center w-6 h-6 bg-green-500/10 border border-green-500/20 rounded-full text-green-400 text-xs font-bold shrink-0 mt-0.5">
                              {qi + 1}
                            </div>
                            <div className="flex-1 space-y-3">
                              <input
                                value={q.question}
                                onChange={e => updateQuiz(qi, "question", e.target.value)}
                                placeholder="Введите вопрос..."
                                className="w-full bg-[#F5F3EE] border border-[#E8E5DF] focus:border-green-500/30 rounded-xl px-4 py-2.5 text-[#0A0A0A] text-sm placeholder-gray-600 outline-none transition-colors"
                              />
                              <div className="space-y-2">
                                {q.options.map((opt, oi) => (
                                  <div key={oi} className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all cursor-pointer ${
                                    q.correct_index === oi
                                      ? "bg-green-500/10 border-green-500/30"
                                      : "bg-white/[0.02] border-[#E8E5DF] hover:bg-[#F0EEE9]"
                                  }`} onClick={() => updateQuiz(qi, "correct_index", oi)}>
                                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                                      q.correct_index === oi ? "border-green-500 bg-green-500" : "border-gray-600"
                                    }`}>
                                      {q.correct_index === oi && <Check className="w-2.5 h-2.5 text-white" />}
                                    </div>
                                    <input
                                      value={opt}
                                      onChange={e => { e.stopPropagation(); updateQuizOption(qi, oi, e.target.value); }}
                                      onClick={e => e.stopPropagation()}
                                      placeholder={`Вариант ${oi + 1}`}
                                      className="flex-1 bg-transparent text-[#0A0A0A] text-sm placeholder-[#A0A0A0] outline-none"
                                    />
                                    {q.correct_index === oi && <span className="text-green-400 text-xs shrink-0">✓ Верный</span>}
                                  </div>
                                ))}
                              </div>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Zap className="w-3.5 h-3.5 text-yellow-500/60" />
                                  <input type="number" min="1" max="50"
                                    value={q.xp_reward}
                                    onChange={e => updateQuiz(qi, "xp_reward", Number(e.target.value))}
                                    className="w-12 bg-[#F5F3EE] border border-[#E8E5DF] rounded-lg px-2 py-1 text-yellow-400 text-xs text-center outline-none"
                                  />
                                  <span className="text-[#8A8A8A] text-xs">XP за правильный</span>
                                </div>
                                <button onClick={() => removeQuizQuestion(qi)}
                                  className="flex items-center gap-1.5 text-red-400/60 hover:text-red-400 text-xs transition-colors">
                                  <Trash2 className="w-3 h-3" /> Удалить
                                </button>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}

              {/* ── TASK editor ── */}
              {selected.type === "task" && (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-[#6B6B6B] text-sm flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#0047FF]" /> Описание задания
                    </label>
                    <textarea
                      value={selected.task_description}
                      onChange={e => updateLesson("task_description", e.target.value)}
                      placeholder="Опишите задание подробно. Что нужно сделать, какой результат ожидается, какие подсказки можно дать..."
                      rows={8}
                      className="w-full bg-[#F5F3EE] border border-[#E8E5DF] focus:border-[#0047FF]/30 rounded-2xl p-5 text-[#0A0A0A] text-sm placeholder-[#A0A0A0] outline-none resize-none transition-colors leading-relaxed"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[#6B6B6B] text-sm flex items-center gap-2">
                      <Code2 className="w-4 h-4 text-[#0047FF]" /> Стартовый код (шаблон)
                    </label>
                    <textarea
                      value={selected.task_starter_code}
                      onChange={e => updateLesson("task_starter_code", e.target.value)}
                      placeholder="// Код, который увидит студент в начале задания"
                      rows={12}
                      className="w-full bg-[#1a1f2e] border border-[#E8E5DF] focus:border-[#0047FF]/30 rounded-2xl p-5 text-green-300 text-sm font-mono placeholder-gray-700 outline-none resize-none transition-colors leading-relaxed"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[#6B6B6B] text-sm">Дополнительные пояснения (необязательно)</label>
                    <textarea
                      value={selected.content}
                      onChange={e => updateLesson("content", e.target.value)}
                      placeholder="Теоретическая база, ссылки на документацию, подсказки..."
                      rows={4}
                      className="w-full bg-[#F5F3EE] border border-[#E8E5DF] focus:border-[#0047FF]/30 rounded-2xl p-4 text-[#0A0A0A] text-sm placeholder-[#A0A0A0] outline-none resize-none transition-colors"
                    />
                  </div>
                </div>
              )}

              {/* Save button */}
              <div className="flex items-center gap-3 pt-2 pb-8">
                <button onClick={() => saveLesson(selected)} disabled={saving}
                  className="flex items-center gap-2 px-6 py-3 bg-[#0047FF] hover:bg-[#0038CC] text-white rounded-xl text-sm font-medium transition-all disabled:opacity-60 shadow-lg shadow-black/8">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? "Сохраняем..." : "Сохранить урок"}
                </button>
                <span className="text-[#8A8A8A] text-xs">Ctrl+S для быстрого сохранения</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className={`fixed bottom-6 right-6 flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-2xl z-50 ${
              toast.type === "ok"
                ? "bg-green-500/10 border-green-500/30 text-green-300"
                : "bg-red-500/10 border-red-500/30 text-red-300"
            }`}>
            {toast.type === "ok" ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span className="text-sm">{toast.text}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
