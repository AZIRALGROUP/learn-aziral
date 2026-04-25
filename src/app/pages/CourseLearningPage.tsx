import { useState, useEffect } from "react";
import { usePageTitle } from "../hooks/usePageTitle";
import { useParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  CheckCircle2, Lock, ChevronRight, ChevronLeft, BookOpen,
  Star, Zap, Trophy, ArrowLeft, Menu, X, ChevronDown,
  RotateCcw, AlertCircle
} from "lucide-react";

type Lesson = {
  id: number; title: string; order_num: number; xp_reward: number;
  quiz_count: number; completed: number;
};
type Quiz = {
  id: number; question: string; options: string[]; order_num: number;
  xp_reward: number; passed: number;
};
type LessonDetail = {
  id: number; title: string; content: string; course_title: string;
  course_id: number; completed: number; xp_reward: number;
  quizzes: Quiz[];
};

/* ─────────────────────────────────────────────────────────
   Sidebar — defined at module level so React never recreates the
   component type on re-renders (defining components inside render
   causes unnecessary unmount/remount cycles).
───────────────────────────────────────────────────────── */
type SidebarProps = {
  courseId: string;
  lessons: Lesson[];
  current: LessonDetail | null;
  progress: number;
  onSelect: (id: number) => void;
};

function CourseSidebar({ courseId, lessons, current, progress, onSelect }: SidebarProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-[#E8E5DF]">
        <Link to={`/courses/${courseId}`} className="flex items-center gap-2 text-[#6B6B6B] hover:text-[#0A0A0A] text-xs transition-colors mb-3">
          <ArrowLeft className="w-3.5 h-3.5" /> К курсу
        </Link>
        <p className="text-[#0A0A0A] font-medium text-sm leading-snug line-clamp-2">{current?.course_title}</p>
        <div className="mt-3">
          <div className="flex justify-between text-xs text-[#6B6B6B] mb-1">
            <span>Прогресс</span>
            <span>{lessons.filter(l => l.completed).length}/{lessons.length}</span>
          </div>
          <div className="h-1.5 bg-[#F5F3EE] rounded-full">
            <div className="h-1.5 bg-[#0047FF] rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {lessons.map((lesson, i) => {
          const isActive = current?.id === lesson.id;
          const isLocked = i > 0 && !lessons[i - 1].completed && !lesson.completed;
          return (
            <button key={lesson.id} onClick={() => !isLocked && onSelect(lesson.id)} disabled={isLocked}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all duration-200 mb-1 ${
                isActive ? 'bg-[#0047FF]/10 border border-[#0047FF]/30' :
                isLocked ? 'opacity-40 cursor-not-allowed' :
                'hover:bg-[#F0EEE9] border border-transparent'
              }`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs ${
                lesson.completed ? 'bg-green-500 text-white' :
                isActive ? 'bg-[#0047FF] text-white' :
                'bg-[#EDEAE4] text-[#6B6B6B]'
              }`}>
                {lesson.completed ? <CheckCircle2 className="w-4 h-4" /> : isLocked ? <Lock className="w-3 h-3" /> : <span>{i + 1}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm leading-snug line-clamp-2 ${isActive ? 'text-[#0047FF]' : lesson.completed ? 'text-[#6B6B6B]' : 'text-[#3A3A3A]'}`}>
                  {lesson.title}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[#A0A0A0] text-xs">+{lesson.xp_reward} XP</span>
                  {lesson.quiz_count > 0 && <span className="text-[#A0A0A0] text-xs">· {lesson.quiz_count} вопр.</span>}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Safely parse **bold** and `code` inline markers into React elements
function parseInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const re = /(\*\*(.+?)\*\*|`(.+?)`)/g;
  let last = 0, match;
  let idx = 0;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    if (match[0].startsWith('**')) {
      parts.push(<strong key={idx++} className="text-[#0A0A0A] font-semibold">{match[2]}</strong>);
    } else {
      parts.push(<code key={idx++} className="px-1.5 py-0.5 bg-[#EDEAE4] rounded text-[#0047FF] text-sm font-mono">{match[3]}</code>);
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function renderContent(content: string) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <div key={i} className="my-4 rounded-xl overflow-hidden border border-[#2D2D3A]">
          {lang && <div className="px-4 py-1.5 bg-[#16213e] border-b border-[#2D2D3A] text-xs text-[#7B8EC8] font-mono">{lang}</div>}
          <pre className="p-4 bg-[#0d1117] overflow-x-auto text-sm font-mono text-[#C9D1D9] leading-relaxed">
            <code>{codeLines.join('\n')}</code>
          </pre>
        </div>
      );
    } else if (line.startsWith('## ')) {
      elements.push(<h2 key={i} className="text-[#0A0A0A] text-xl font-bold mt-6 mb-3">{line.slice(3)}</h2>);
    } else if (line.startsWith('### ')) {
      elements.push(<h3 key={i} className="text-[#0A0A0A] text-lg font-semibold mt-5 mb-2">{line.slice(4)}</h3>);
    } else if (line.startsWith('> ')) {
      elements.push(
        <div key={i} className="my-3 pl-4 border-l-2 border-[#0047FF]/40 bg-[#0047FF]/5 rounded-r-xl py-2 pr-3">
          <p className="text-[#0047FF] text-sm">{line.slice(2)}</p>
        </div>
      );
    } else if (line.trim() === '') {
      elements.push(<div key={i} className="h-2" />);
    } else {
      elements.push(<p key={i} className="text-[#3A3A3A] leading-relaxed text-sm mb-1">{parseInline(line)}</p>);
    }
    i++;
  }
  return elements;
}

export function CourseLearningPage() {
  const { id, lessonId } = useParams<{ id: string; lessonId?: string }>();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [current, setCurrent] = useState<LessonDetail | null>(null);
  const [loadingLesson, setLoadingLesson] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [xpGained, setXpGained] = useState(0);
  const [totalXp, setTotalXp] = useState(0);
  const [showXpPop, setShowXpPop] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Quiz state
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [quizResult, setQuizResult] = useState<any>(null);
  const [submittingQuiz, setSubmittingQuiz] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [showQuiz, setShowQuiz] = useState(false);
  const [lessonError, setLessonError] = useState<string | null>(null);

  const loadLesson = async (lId: number) => {
    setLoadingLesson(true); setQuizResult(null); setAnswers({}); setShowQuiz(false); setCompleted(false); setLessonError(null);
    try {
      const r = await fetch(`/api/lessons/${lId}`, { credentials: 'include' });
      if (r.ok) {
        const data: LessonDetail = await r.json();
        setCurrent(data);
        setCompleted(!!data.completed);
        if (data.completed) setShowQuiz(true);
      } else {
        const err = await r.json().catch(() => ({}));
        setLessonError((err as { error?: string }).error || "Не удалось загрузить урок");
      }
    } catch {
      setLessonError("Ошибка сети — проверьте подключение");
    } finally {
      setLoadingLesson(false);
      setSidebarOpen(false);
      window.scrollTo(0, 0);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      setLoadError(null);
      try {
        const r = await fetch(`/api/courses/${id}/lessons`, { credentials: 'include' });
        if (!r.ok) { setLoadError("Не удалось загрузить уроки курса"); return; }
        const data: Lesson[] = await r.json();
        if (cancelled) return;
        setLessons(data);
        const targetId = lessonId ? Number(lessonId) : data.find(l => !l.completed)?.id ?? data[0]?.id;
        if (targetId) loadLesson(targetId);
      } catch {
        if (!cancelled) setLoadError("Ошибка сети — проверьте подключение");
      }
    };

    const loadXp = async () => {
      try {
        const r = await fetch('/api/profile/xp', { credentials: 'include' });
        if (r.ok) { const d = await r.json(); if (!cancelled) setTotalXp(d.xp); }
      } catch { /* XP is non-critical, skip silently */ }
    };

    init();
    loadXp();
    return () => { cancelled = true; };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleComplete = async () => {
    if (!current || completing) return;
    setCompleting(true);
    try {
      const r = await fetch(`/api/lessons/${current.id}/complete`, { method: 'POST', credentials: 'include' });
      if (r.ok) {
        const d = await r.json();
        setCompleted(true);
        setShowQuiz(true);
        if (d.xp > 0) {
          setXpGained(d.xp); setTotalXp(p => p + d.xp);
          setShowXpPop(true); setTimeout(() => setShowXpPop(false), 2500);
        }
        setLessons(prev => prev.map(l => l.id === current.id ? { ...l, completed: 1 } : l));
      } else {
        const err = await r.json().catch(() => ({}));
        setLessonError((err as { error?: string }).error || "Не удалось отметить урок — попробуйте ещё раз");
      }
    } catch {
      setLessonError("Ошибка сети — не удалось сохранить прогресс");
    } finally {
      setCompleting(false);
    }
  };

  const handleSubmitQuiz = async () => {
    if (!current || Object.keys(answers).length === 0) return;
    setSubmittingQuiz(true);
    setQuizError(null);
    try {
      const r = await fetch(`/api/lessons/${current.id}/quiz/submit`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      });
      if (r.ok) {
        const d = await r.json();
        setQuizResult(d);
        if (d.totalXp > 0) {
          setTotalXp(p => p + d.totalXp);
          setXpGained(d.totalXp); setShowXpPop(true); setTimeout(() => setShowXpPop(false), 2500);
        }
      } else {
        setQuizError("Не удалось проверить ответы — попробуйте ещё раз");
      }
    } catch {
      setQuizError("Ошибка сети — попробуйте ещё раз");
    } finally {
      setSubmittingQuiz(false);
    }
  };

  usePageTitle(current ? `${current.course_title} — ${current.title}` : "Обучение");
  const currentIndex = lessons.findIndex(l => l.id === current?.id);
  const nextLesson = lessons[currentIndex + 1];
  const prevLesson = lessons[currentIndex - 1];
  const progress = lessons.length ? Math.round(lessons.filter(l => l.completed).length / lessons.length * 100) : 0;

  if (loadError) return (
    <div className="min-h-screen bg-[#F5F3EE] flex flex-col items-center justify-center gap-4 pt-24">
      <AlertCircle className="w-10 h-10 text-red-400" />
      <p className="text-[#0A0A0A] text-lg">{loadError}</p>
      <Link to={`/courses/${id}`}
        className="flex items-center gap-2 px-5 py-2.5 bg-[#0047FF] hover:bg-[#0038CC] text-white rounded-xl text-sm transition-colors">
        <ArrowLeft className="w-4 h-4" /> Вернуться к курсу
      </Link>
    </div>
  );

  const sidebarProps: SidebarProps = { courseId: id!, lessons, current, progress, onSelect: loadLesson };

  return (
    <div className="min-h-screen bg-[#F5F3EE] flex flex-col">
      {/* Top bar */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-[#F5F3EE]/90 backdrop-blur-xl border-b border-[#E8E5DF]">
        <div className="flex items-center gap-4 px-4 py-3 max-w-screen-2xl mx-auto">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden p-1.5 text-[#6B6B6B] hover:text-[#0A0A0A]">
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <Link to={`/courses/${id}`} className="hidden lg:flex items-center gap-2 text-[#6B6B6B] hover:text-[#0A0A0A] text-sm transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-[#0A0A0A] text-sm font-medium truncate">{current?.course_title || 'Загрузка...'}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="h-1 flex-1 max-w-32 bg-[#EDEAE4] rounded-full">
                <div className="h-1 bg-[#0047FF] rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-[#8A8A8A] text-xs">{progress}%</span>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
            <Zap className="w-4 h-4 text-yellow-400" />
            <span className="text-yellow-600 text-sm font-semibold">{totalXp} XP</span>
          </div>
        </div>
      </div>

      {/* XP popup */}
      <AnimatePresence>
        {showXpPop && (
          <motion.div initial={{ opacity: 0, y: -20, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 right-4 z-50 flex items-center gap-2 px-4 py-2 bg-yellow-500/20 border border-yellow-500/30 rounded-xl shadow-xl">
            <Zap className="w-4 h-4 text-yellow-400" />
            <span className="text-yellow-600 font-bold">+{xpGained} XP!</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-1 pt-14">
        {/* Sidebar desktop */}
        <aside className="hidden lg:flex flex-col w-72 border-r border-[#E8E5DF] fixed left-0 top-14 bottom-0 bg-[#F5F3EE]">
          <CourseSidebar {...sidebarProps} />
        </aside>

        {/* Sidebar mobile overlay */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 z-30 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)}>
              <motion.aside initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
                className="absolute left-0 top-14 bottom-0 w-72 bg-[#1a1a2e] border-r border-[#E8E5DF]"
                onClick={e => e.stopPropagation()}>
                <CourseSidebar {...sidebarProps} />
              </motion.aside>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main content */}
        <main className="flex-1 lg:ml-72 min-w-0">
          <div className="max-w-3xl mx-auto px-4 lg:px-8 py-8">
            {loadingLesson ? (
              <div className="flex flex-col gap-4 animate-pulse">
                <div className="h-8 bg-[#F5F3EE] rounded-xl w-3/4" />
                <div className="h-4 bg-[#F5F3EE] rounded-xl" />
                <div className="h-4 bg-[#F5F3EE] rounded-xl w-5/6" />
                <div className="h-32 bg-[#F5F3EE] rounded-xl mt-4" />
              </div>
            ) : current ? (
              <>
                {/* Lesson header */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 text-[#8A8A8A] text-xs mb-3">
                    <span>Урок {currentIndex + 1} из {lessons.length}</span>
                    <span>·</span>
                    <span className="flex items-center gap-1 text-yellow-600"><Zap className="w-3 h-3" /> +{current.xp_reward} XP за урок</span>
                    {current.quizzes.length > 0 && <>
                      <span>·</span>
                      <span className="text-[#0047FF]">+{current.quizzes.reduce((s, q) => s + q.xp_reward, 0)} XP за тест</span>
                    </>}
                  </div>
                  <h1 className="text-2xl lg:text-3xl text-[#0A0A0A] font-bold">{current.title}</h1>
                  {completed && (
                    <div className="flex items-center gap-2 mt-3 text-green-400 text-sm">
                      <CheckCircle2 className="w-4 h-4" /> Урок пройден
                    </div>
                  )}
                </div>

                {/* Lesson content */}
                <div className="prose-custom mb-8 space-y-1">
                  {renderContent(current.content || '')}
                </div>

                {/* Complete button */}
                {!completed && (
                  <motion.div initial={{ y: 10 }} animate={{ y: 0 }} className="mb-8">
                    <button onClick={handleComplete} disabled={completing}
                      className="flex items-center gap-2 px-6 py-3.5 bg-[#0047FF] hover:bg-[#0038CC] text-white rounded-xl font-medium transition-all hover:scale-105 shadow-lg shadow-black/10">
                      {completing ? <div className="w-4 h-4 border-2 border-[#D0CCC6] border-t-white rounded-full animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                      Отметить как прочитанное · +{current.xp_reward} XP
                    </button>
                  </motion.div>
                )}

                {/* Quiz section */}
                {current.quizzes.length > 0 && (
                  <div className="mb-10">
                    <button onClick={() => setShowQuiz(!showQuiz)}
                      className="flex items-center gap-2 text-[#0047FF] hover:text-[#0047FF] text-sm mb-4 transition-colors">
                      <Star className="w-4 h-4" />
                      Тест по уроку ({current.quizzes.length} вопрос{current.quizzes.length > 1 ? 'а' : ''} · +{current.quizzes.reduce((s, q) => s + q.xp_reward, 0)} XP)
                      <ChevronDown className={`w-4 h-4 transition-transform ${showQuiz ? 'rotate-180' : ''}`} />
                    </button>
                    <AnimatePresence>
                      {showQuiz && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                          className="space-y-5 overflow-hidden">
                          {current.quizzes.map((quiz, qi) => {
                            const result = quizResult?.results?.[quiz.id];
                            const alreadyPassed = quiz.passed > 0;
                            return (
                              <div key={quiz.id} className={`bg-[#F5F3EE] border rounded-2xl p-5 ${result ? (result.correct ? 'border-green-500/30' : 'border-red-500/30') : 'border-[#E8E5DF]'}`}>
                                <div className="flex items-start gap-3 mb-4">
                                  <span className="w-7 h-7 bg-[#0047FF]/8 border border-[#0047FF]/20 rounded-lg flex items-center justify-center text-[#0047FF] text-xs shrink-0 font-bold">{qi + 1}</span>
                                  <p className="text-[#0A0A0A] font-medium leading-snug">{quiz.question}</p>
                                </div>
                                <div className="space-y-2 ml-10">
                                  {quiz.options.map((opt, oi) => {
                                    const isSelected = answers[quiz.id] === oi;
                                    const isCorrect = result && oi === result.correctIndex;
                                    const isWrong = result && isSelected && !result.correct;
                                    return (
                                      <button key={oi} disabled={!!quizResult || alreadyPassed}
                                        onClick={() => !quizResult && !alreadyPassed && setAnswers(p => ({ ...p, [quiz.id]: oi }))}
                                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-left transition-all duration-200 ${
                                          isCorrect ? 'bg-green-500/20 border border-green-500/40 text-green-800' :
                                          isWrong   ? 'bg-red-500/15 border border-red-500/30 text-red-300' :
                                          isSelected ? 'bg-[#0047FF]/10 border border-[#0047FF]/30 text-[#0047FF]' :
                                          'bg-[#F5F3EE] border border-[#E8E5DF] text-[#3A3A3A] hover:border-[#E8E5DF]'
                                        }`}>
                                        <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${isCorrect ? 'border-green-400 bg-green-400' : isWrong ? 'border-red-400 bg-red-400' : isSelected ? 'border-[#0047FF] bg-[#0047FF]' : 'border-gray-600'}`}>
                                          {(isCorrect || (isSelected && !quizResult)) && <div className="w-2 h-2 bg-white rounded-full" />}
                                        </span>
                                        {opt}
                                        {isCorrect && <CheckCircle2 className="w-4 h-4 ml-auto text-green-400" />}
                                      </button>
                                    );
                                  })}
                                </div>
                                {alreadyPassed && !quizResult && (
                                  <p className="text-green-400 text-xs mt-3 ml-10 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Уже пройдено</p>
                                )}
                                {result && (
                                  <p className={`text-xs mt-3 ml-10 flex items-center gap-1 ${result.correct ? 'text-green-400' : 'text-red-400'}`}>
                                    {result.correct ? <><CheckCircle2 className="w-3 h-3" /> Верно! +{result.xpEarned} XP</> : <><AlertCircle className="w-3 h-3" /> Неверно — правильный ответ: <strong>{quiz.options[result.correctIndex]}</strong></>}
                                  </p>
                                )}
                              </div>
                            );
                          })}

                          {quizError && (
                            <p className="flex items-center gap-1.5 text-red-400 text-sm px-1">
                              <AlertCircle className="w-4 h-4 shrink-0" /> {quizError}
                            </p>
                          )}
                          {!quizResult && !current.quizzes.every(q => q.passed > 0) && (
                            <button onClick={handleSubmitQuiz} disabled={submittingQuiz || Object.keys(answers).length < current.quizzes.length}
                              className="flex items-center gap-2 px-5 py-3 bg-[#0047FF] hover:bg-[#0038CC] disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-all">
                              {submittingQuiz ? <div className="w-4 h-4 border-2 border-[#D0CCC6] border-t-white rounded-full animate-spin" /> : <Star className="w-4 h-4" />}
                              Проверить ответы
                            </button>
                          )}

                          {quizResult && (
                            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }}
                              className={`p-4 rounded-2xl flex items-center gap-3 ${quizResult.allCorrect ? 'bg-green-500/10 border border-green-500/20' : 'bg-yellow-500/10 border border-yellow-500/20'}`}>
                              {quizResult.allCorrect ? <Trophy className="w-6 h-6 text-yellow-400" /> : <RotateCcw className="w-5 h-5 text-yellow-400" />}
                              <div>
                                <p className={`font-medium ${quizResult.allCorrect ? 'text-green-400' : 'text-yellow-400'}`}>
                                  {quizResult.allCorrect ? '🏆 Отлично! Все правильно!' : 'Есть ошибки — прочитайте ещё раз'}
                                </p>
                                {quizResult.totalXp > 0 && <p className="text-[#6B6B6B] text-sm">Заработано: +{quizResult.totalXp} XP</p>}
                              </div>
                            </motion.div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* Navigation */}
                <div className="flex items-center justify-between pt-6 border-t border-[#E8E5DF]">
                  {prevLesson ? (
                    <button onClick={() => loadLesson(prevLesson.id)}
                      className="flex items-center gap-2 px-4 py-2.5 bg-[#F5F3EE] border border-[#E8E5DF] hover:border-[#E8E5DF] text-[#6B6B6B] hover:text-[#0A0A0A] rounded-xl text-sm transition-all">
                      <ChevronLeft className="w-4 h-4" /> Назад
                    </button>
                  ) : <div />}

                  {nextLesson ? (
                    <button onClick={() => loadLesson(nextLesson.id)}
                      disabled={!completed && !nextLesson.completed}
                      className="flex items-center gap-2 px-5 py-2.5 bg-[#0047FF] hover:bg-[#0038CC] disabled:opacity-40 text-white rounded-xl text-sm font-medium transition-all hover:scale-105">
                      Следующий урок <ChevronRight className="w-4 h-4" />
                    </button>
                  ) : completed ? (
                    <div className="flex items-center gap-2 px-5 py-2.5 bg-green-500/20 border border-green-500/30 text-green-400 rounded-xl text-sm">
                      <Trophy className="w-4 h-4" /> Курс завершён!
                    </div>
                  ) : <div />}
                </div>
              </>
            ) : lessonError ? (
              <div className="text-center py-20">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500/60" />
                <p className="text-[#0A0A0A] text-lg mb-2">{lessonError}</p>
                {lessonError.toLowerCase().includes("запишитесь") || lessonError.toLowerCase().includes("enroll") ? (
                  <p className="text-[#6B6B6B] text-sm mb-6">Чтобы открыть уроки, нужно записаться на курс</p>
                ) : null}
                <Link
                  to={`/courses/${id}`}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0047FF] hover:bg-[#0038CC] text-white rounded-xl text-sm transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Вернуться к курсу
                </Link>
              </div>
            ) : (
              <div className="text-center py-20 text-[#6B6B6B]">
                <BookOpen className="w-10 h-10 mx-auto mb-3 text-[#A0A0A0]" />
                <p>Выберите урок из списка</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
