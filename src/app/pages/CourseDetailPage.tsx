import { useState, useEffect, useRef } from "react";
import { usePageTitle } from "../hooks/usePageTitle";
import { LEVEL_CONFIG } from "../lib/constants";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  BookOpen, Clock, Users, ArrowLeft, CheckCircle2,
  Loader2, GraduationCap, Lock, ChevronRight, AlertCircle,
  Star, Copy, Check, Play, Zap, FileText, Video,
  Code2, ChevronDown, Award, Shield, Infinity,
  MessageSquare, ThumbsUp
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

type LessonPreview = {
  id: number; title: string; type: string; order_num: number;
  xp_reward: number; quiz_count: number;
};

type Course = {
  id: number; title: string; description: string; content: string | null;
  price: number; category: string; level: string; duration: string | null;
  instructor_name: string; instructor_email: string; students_count: number;
  image: string | null; status: string; enrolled: number;
  lessons_count: number; quizzes_count: number;
  lessons_preview: LessonPreview[];
};

type RelatedCourse = {
  id: number; title: string; price: number; level: string;
  students_count: number; image: string | null; lessons_count?: number;
};

const LEVEL_META = Object.fromEntries(
  Object.entries(LEVEL_CONFIG).map(([k, v]) => [k, { label: v.label, color: v.color, bg: `${v.bgClass} ${v.borderClass}` }])
);

const LESSON_TYPE_ICON: Record<string, typeof FileText> = {
  text:  FileText,
  video: Video,
  quiz:  CheckCircle2,
  task:  Code2,
};
const LESSON_TYPE_LABEL: Record<string, string> = {
  text: "Текст", video: "Видео", quiz: "Тест", task: "Задание",
};

function Stars({ rating, size = "w-4 h-4" }: { rating: number; size?: string }) {
  return (
    <div className="flex items-center gap-1">
      {[1,2,3,4,5].map(i => (
        <Star key={i} className={`${size} ${i <= Math.round(rating) ? "text-yellow-400 fill-yellow-400" : "text-[#A0A0A0]"}`} />
      ))}
      <span className="text-yellow-400 font-semibold ml-1">{rating.toFixed(1)}</span>
    </div>
  );
}

export function CourseDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [course, setCourse]         = useState<Course | null>(null);
  const [related, setRelated]       = useState<RelatedCourse[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [enrolling, setEnrolling]   = useState(false);
  const [enrolled, setEnrolled]     = useState(false);
  const [payPending, setPayPending] = useState(false);
  const [enrollError, setEnrollError] = useState("");
  const [copied, setCopied]         = useState(false);
  const [programOpen, setProgramOpen] = useState(true);
  const [showAllLessons, setShowAllLessons] = useState(false);
  const [ratingData, setRatingData] = useState<{ avg: number | null; count: number; userRating: number | null } | null>(null);
  const [submittingRating, setSubmittingRating] = useState(false);
  const enrollingRef = useRef(false);

  // ← ОБЯЗАТЕЛЬНО до любых conditional return (Rules of Hooks)
  usePageTitle(course?.title || "");

  useEffect(() => {
    const load = async () => {
      setLoading(true); setError("");
      try {
        const r = await fetch(`/api/courses/${id}`, { credentials: 'include' });
        if (!r.ok) throw new Error("Курс не найден");
        const data: Course = await r.json();
        setCourse(data);
        setEnrolled(!!data.enrolled);
        const [r2, r3] = await Promise.all([
          fetch(`/api/courses?category=${data.category}`),
          fetch(`/api/courses/${id}/rating`, { credentials: 'include' }),
        ]);
        if (r2.ok) {
          const all: RelatedCourse[] = await r2.json();
          setRelated(all.filter(c => c.id !== data.id).slice(0, 4));
        }
        if (r3.ok) setRatingData(await r3.json());
      } catch (e: any) { setError(e.message); }
      finally { setLoading(false); }
    };
    load();
  }, [id]);

  const handleEnroll = async () => {
    if (!user) { navigate("/login", { state: { from: location.pathname } }); return; }
    if (enrollingRef.current) return;
    enrollingRef.current = true;
    setEnrolling(true); setEnrollError("");
    try {
      const r = await fetch(`/api/courses/${id}/enroll`, {
        method: "POST",
        credentials: 'include',
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Ошибка записи");
      if (data.paymentStatus === "free") setEnrolled(true);
      else setPayPending(true);
    } catch (e: any) { setEnrollError(e.message); }
    finally { setEnrolling(false); enrollingRef.current = false; }
  };

  const handleRate = async (stars: number) => {
    if (!user || !enrolled) return;
    setSubmittingRating(true);
    try {
      const r = await fetch(`/api/courses/${id}/rating`, {
        method: "POST",
        credentials: 'include',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: stars }),
      });
      if (r.ok) {
        const d = await r.json();
        setRatingData(prev => ({ ...(prev || { count: 0, userRating: null }), avg: d.avg, count: d.count, userRating: stars }));
      }
    } finally { setSubmittingRating(false); }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const contentItems: string[] = (() => {
    if (!course?.content) return [];
    try { return JSON.parse(course.content); }
    catch { return course.content?.split("\n").filter(Boolean) || []; }
  })();

  if (loading) return (
    <div className="min-h-screen bg-[#F5F3EE] flex items-center justify-center pt-24">
      <Loader2 className="w-8 h-8 text-[#0047FF] animate-spin" />
    </div>
  );

  if (error || !course) return (
    <div className="min-h-screen bg-[#F5F3EE] flex flex-col items-center justify-center pt-24 gap-4">
      <div className="text-4xl">😕</div>
      <p className="text-[#0A0A0A] text-xl">{error || "Курс не найден"}</p>
      <Link to="/courses" className="flex items-center gap-2 text-[#0047FF] hover:text-[#0047FF] text-sm transition-colors">
        <ArrowLeft className="w-4 h-4" /> К списку курсов
      </Link>
    </div>
  );

  const lvl = LEVEL_META[course.level] || LEVEL_META.beginner;
  const rating = ratingData?.avg ?? null;
  const lessons = course.lessons_preview || [];
  const visibleLessons = showAllLessons ? lessons : lessons.slice(0, 6);
  const totalXp = lessons.reduce((s, l) => s + l.xp_reward, 0) + (course.quizzes_count * 5);

  return (
    <div className="min-h-screen bg-[#F5F3EE]">

      {/* ── HERO BANNER ── */}
      <div className="relative min-h-[360px] flex items-end overflow-hidden">
        {/* BG image */}
        {course.image ? (
          <div className="absolute inset-0">
            <img src={course.image} alt={course.title} className="w-full h-full object-cover opacity-15 blur-sm scale-110" />
          </div>
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/60" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-transparent" />

        <div className="relative w-full max-w-7xl mx-auto px-6 lg:px-8 pt-28 pb-8">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-white/50 mb-5">
            <Link to="/courses" className="hover:text-white transition-colors flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Курсы
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="capitalize">{course.category}</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="truncate max-w-xs">{course.title}</span>
          </div>

          <div className="max-w-3xl">
            {/* Badges */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className={`px-2.5 py-1 rounded-lg text-xs border font-medium ${lvl.color} ${lvl.bg}`}>{lvl.label}</span>
              {course.price === 0
                ? <span className="px-2.5 py-1 rounded-lg text-xs border border-green-500/30 bg-green-500/10 text-green-400 font-medium">🎁 Бесплатно</span>
                : <span className="px-2.5 py-1 rounded-lg text-xs border border-white/20 bg-white/10 text-white font-medium">{course.price.toLocaleString()} ₸</span>
              }
            </div>

            <h1 className="text-3xl lg:text-4xl font-bold text-white leading-tight mb-4">{course.title}</h1>
            <p className="text-white/75 text-base leading-relaxed mb-5 max-w-2xl">{course.description}</p>

            {/* Stats row */}
            <div className="flex flex-wrap items-center gap-4 text-sm">
              {rating !== null
                ? <><Stars rating={rating} /><span className="text-white/50 text-xs">({ratingData?.count} оценок)</span></>
                : <span className="text-white/50 text-sm">Нет оценок</span>
              }
              <span className="text-white/30">·</span>
              <div className="flex items-center gap-1.5 text-white/70">
                <Users className="w-4 h-4 text-white/40" />
                <span>{course.students_count.toLocaleString()} студентов</span>
              </div>
              {course.lessons_count > 0 && <>
                <span className="text-white/30">·</span>
                <div className="flex items-center gap-1.5 text-white/70">
                  <BookOpen className="w-4 h-4 text-white/40" />
                  <span>{course.lessons_count} уроков</span>
                </div>
              </>}
              {course.duration && <>
                <span className="text-white/30">·</span>
                <div className="flex items-center gap-1.5 text-white/70">
                  <Clock className="w-4 h-4 text-white/40" />
                  <span>{course.duration}</span>
                </div>
              </>}
            </div>

            {/* Instructor */}
            <div className="flex items-center gap-2 mt-4">
              <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center text-white text-xs font-bold">
                {course.instructor_name?.[0]?.toUpperCase()}
              </div>
              <span className="text-white/50 text-sm">
                Автор: <span className="text-blue-300 hover:underline cursor-pointer">{course.instructor_name}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">

          {/* ── LEFT COLUMN ── */}
          <div className="flex-1 min-w-0 space-y-6">

            {/* Stats strip */}
            {(course.lessons_count > 0 || course.quizzes_count > 0 || totalXp > 0) && (
              <motion.div initial={{ y: 15 }} animate={{ y: 0 }}
                className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { icon: BookOpen,  val: course.lessons_count,  label: "уроков",   color: "text-blue-400",   bg: "bg-blue-500/5 border-blue-500/10" },
                  { icon: CheckCircle2, val: course.quizzes_count, label: "вопросов", color: "text-green-400",  bg: "bg-green-500/5 border-green-500/10" },
                  { icon: Zap,       val: totalXp > 0 ? `${totalXp} XP` : "—", label: "опыта",  color: "text-yellow-400", bg: "bg-yellow-500/5 border-yellow-500/10" },
                  { icon: Users,     val: course.students_count > 999 ? `${(course.students_count/1000).toFixed(1)}K` : course.students_count, label: "студентов", color: "text-[#0047FF]", bg: "bg-[#0047FF]/5 border-[#0047FF]/10" },
                ].map(s => (
                  <div key={s.label} className={`flex flex-col items-center justify-center p-4 rounded-2xl border ${s.bg} text-center`}>
                    <s.icon className={`w-5 h-5 ${s.color} mb-1.5`} />
                    <p className="text-[#0A0A0A] font-bold text-lg leading-none">{s.val}</p>
                    <p className="text-[#6B6B6B] text-xs mt-1">{s.label}</p>
                  </div>
                ))}
              </motion.div>
            )}

            {/* What you'll learn */}
            {contentItems.length > 0 && (
              <motion.div initial={{ y: 15 }} animate={{ y: 0 }} transition={{ delay: 0.05 }}
                className="bg-[#F5F3EE] border border-[#E8E5DF] rounded-2xl p-6">
                <h2 className="text-[#0A0A0A] font-bold text-lg mb-5 flex items-center gap-2">
                  <ThumbsUp className="w-5 h-5 text-[#0047FF]" /> Чему вы научитесь
                </h2>
                <div className="grid sm:grid-cols-2 gap-2.5">
                  {contentItems.map((item, i) => (
                    <motion.div key={i} initial={{ x: -10 }} animate={{ x: 0 }}
                      transition={{ delay: 0.05 + i * 0.03 }}
                      className="flex items-start gap-3">
                      <div className="w-5 h-5 bg-[#0047FF]/8 border border-[#0047FF]/20 rounded-md flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-3 h-3 text-[#0047FF]" />
                      </div>
                      <span className="text-[#3A3A3A] text-sm leading-relaxed">
                        {/^[^\w\s]/.test(item) ? item.slice(item.indexOf(" ") + 1) : item}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Program / Lessons */}
            {lessons.length > 0 && (
              <motion.div initial={{ y: 15 }} animate={{ y: 0 }} transition={{ delay: 0.1 }}
                className="bg-white/[0.02] border border-[#E8E5DF] rounded-2xl overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors"
                  onClick={() => setProgramOpen(v => !v)}>
                  <div className="flex items-center gap-3">
                    <h2 className="text-[#0A0A0A] font-bold text-lg">Программа курса</h2>
                    <span className="text-[#6B6B6B] text-sm">{course.lessons_count} уроков · {course.quizzes_count} вопросов</span>
                  </div>
                  <ChevronDown className={`w-5 h-5 text-[#6B6B6B] transition-transform ${programOpen ? "rotate-180" : ""}`} />
                </button>

                <AnimatePresence initial={false}>
                  {programOpen && (
                    <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
                      style={{ overflow: "hidden" }}>
                      <div className="border-t border-[#E8E5DF]">
                        {visibleLessons.map((lesson, i) => {
                          const Icon = LESSON_TYPE_ICON[lesson.type] || FileText;
                          const typeLabel = LESSON_TYPE_LABEL[lesson.type] || "Урок";
                          const isLocked = !enrolled && i >= 2;
                          return (
                            <div key={lesson.id}
                              className={`flex items-center gap-4 px-6 py-3.5 border-b border-[#E8E5DF] last:border-0 ${isLocked ? "" : "hover:bg-[#F0EEE9]"} transition-colors`}>
                              <div className="w-7 h-7 rounded-lg bg-[#F0EEE9] flex items-center justify-center shrink-0">
                                {isLocked
                                  ? <Lock className="w-3.5 h-3.5 text-[#6B6B6B]" />
                                  : <Icon className="w-3.5 h-3.5 text-[#0047FF]" />
                                }
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm ${isLocked ? "text-[#9CA3AF]" : "text-[#0A0A0A]"} truncate`}>
                                  <span className="text-[#A0A0A0] mr-2">{lesson.order_num}.</span>
                                  {lesson.title}
                                </p>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <span className="text-[#6B6B6B] text-xs">{typeLabel}</span>
                                {lesson.quiz_count > 0 && (
                                  <span className="text-green-600 text-xs">{lesson.quiz_count} вопр.</span>
                                )}
                                <div className="flex items-center gap-1">
                                  <Zap className="w-3 h-3 text-yellow-500" />
                                  <span className="text-yellow-600 text-xs">{lesson.xp_reward}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {lessons.length > 6 && (
                          <div className="px-6 py-4">
                            <button onClick={() => setShowAllLessons(v => !v)}
                              className="text-sm text-[#0047FF] hover:text-[#0047FF] transition-colors flex items-center gap-1.5">
                              <ChevronDown className={`w-4 h-4 transition-transform ${showAllLessons ? "rotate-180" : ""}`} />
                              {showAllLessons
                                ? "Скрыть"
                                : `Показать ещё ${lessons.length - 6} уроков`}
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {/* Instructor */}
            <motion.div initial={{ y: 15 }} animate={{ y: 0 }} transition={{ delay: 0.15 }}
              className="bg-white/[0.02] border border-[#E8E5DF] rounded-2xl p-6">
              <h2 className="text-[#0A0A0A] font-bold text-lg mb-5 flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-[#0047FF]" /> Об инструкторе
              </h2>
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 bg-gradient-to-br [#0047FF] rounded-2xl flex items-center justify-center text-[#0A0A0A] text-2xl font-bold shrink-0 shadow-lg shadow-black/10">
                  {course.instructor_name?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="text-[#0A0A0A] font-semibold text-base">{course.instructor_name}</p>
                  <p className="text-[#6B6B6B] text-sm mt-0.5">Практикующий специалист · Aziral Education</p>
                  <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-[#8A8A8A]">
                    {rating !== null && <span className="flex items-center gap-1.5"><Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" /> {rating.toFixed(1)} рейтинг</span>}
                    <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> {course.students_count.toLocaleString()}+ студентов</span>
                    <span className="flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5" /> {course.lessons_count} уроков</span>
                    <span className="flex items-center gap-1.5"><Award className="w-3.5 h-3.5 text-[#0047FF]" /> Сертифицированный</span>
                  </div>
                  <p className="text-[#6B6B6B] text-sm mt-3 leading-relaxed">
                    Специалист с практическим опытом в разработке коммерческих проектов.
                    Преподаёт в понятной форме с акцентом на реальные задачи и современные инструменты.
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Ratings */}
            <motion.div initial={{ y: 15 }} animate={{ y: 0 }} transition={{ delay: 0.2 }}
              className="bg-white/[0.02] border border-[#E8E5DF] rounded-2xl p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-[#0A0A0A] font-bold text-lg flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-[#0047FF]" /> Оценки
                </h2>
                {rating !== null && (
                  <div className="flex items-center gap-2">
                    <Stars rating={rating} />
                    <span className="text-[#6B6B6B] text-sm">({ratingData?.count} оценок)</span>
                  </div>
                )}
              </div>
              {enrolled ? (
                <div>
                  <p className="text-[#6B6B6B] text-sm mb-3">
                    {ratingData?.userRating ? "Ваша оценка:" : "Оцените курс:"}
                  </p>
                  <div className="flex items-center gap-2">
                    {[1,2,3,4,5].map(s => (
                      <button key={s} onClick={() => !submittingRating && handleRate(s)} disabled={submittingRating}
                        className="transition-transform hover:scale-110 disabled:opacity-50">
                        <Star className={`w-8 h-8 ${s <= (ratingData?.userRating || 0) ? "text-yellow-400 fill-yellow-400" : "text-[#8A8A8A] hover:text-yellow-400"} transition-colors`} />
                      </button>
                    ))}
                    {ratingData?.userRating && <span className="text-[#6B6B6B] text-sm ml-2">Ваша оценка: {ratingData.userRating}/5</span>}
                  </div>
                </div>
              ) : (
                <p className="text-[#6B6B6B] text-sm">
                  {rating !== null
                    ? `Средняя оценка: ${rating.toFixed(1)} из 5 (${ratingData?.count} студентов)`
                    : "Оценок пока нет. Запишитесь на курс, чтобы оставить оценку."}
                </p>
              )}
            </motion.div>
          </div>

          {/* ── RIGHT COLUMN — STICKY ENROLLMENT ── */}
          <div className="w-full lg:w-[340px] shrink-0">
            <motion.div initial={{ x: 20 }} animate={{ x: 0 }} transition={{ delay: 0.1 }}
              className="sticky top-24 space-y-3">

              {/* Course preview card */}
              <div className="bg-[#1a1a2e] border border-[#E8E5DF] rounded-2xl overflow-hidden shadow-2xl shadow-black/40">
                {/* Thumbnail */}
                <div className="relative aspect-video overflow-hidden">
                  {course.image ? (
                    <img src={course.image} alt={course.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-[#1a1f2e] flex items-center justify-center">
                      <BookOpen className="w-12 h-12 text-blue-400/20" />
                    </div>
                  )}
                  {/* Play overlay */}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/10 transition-colors cursor-pointer group">
                    <div className="w-14 h-14 bg-white/80 group-hover:bg-white rounded-full flex items-center justify-center border border-[#E8E5DF] transition-all group-hover:scale-110">
                      <Play className="w-6 h-6 text-[#0A0A0A] ml-0.5" />
                    </div>
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  {/* Price */}
                  <div>
                    {course.price === 0 ? (
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-green-400">Бесплатно</span>
                      </div>
                    ) : (
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-white">{course.price.toLocaleString()} ₸</span>
                      </div>
                    )}
                    <p className="text-[#9CA3AF] text-xs mt-1">
                      {course.price === 0 ? "Полный доступ сразу после записи" : "Единовременная оплата · Пожизненный доступ"}
                    </p>
                  </div>

                  {/* Enroll button */}
                  {enrolled ? (
                    <Link to={`/courses/${id}/learn`}
                      className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-xl font-medium transition-all hover:scale-[1.02] shadow-lg">
                      <Play className="w-4 h-4" /> Продолжить обучение
                    </Link>
                  ) : payPending ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                        <AlertCircle className="w-4 h-4 text-yellow-400 shrink-0" />
                        <div>
                          <p className="text-yellow-400 text-sm font-medium">Заявка отправлена</p>
                          <p className="text-[#9CA3AF] text-xs mt-0.5">Переведите {course.price.toLocaleString()} ₸ и напишите нам</p>
                        </div>
                      </div>
                      <a href="mailto:aziralgroup@outlook.com"
                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#F5F3EE] border border-[#E8E5DF] text-blue-400 hover:text-[#0047FF] rounded-xl text-sm transition-colors">
                        aziralgroup@outlook.com
                      </a>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      <button onClick={handleEnroll} disabled={enrolling}
                        className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#0047FF] hover:bg-[#0038CC] disabled:opacity-50 text-white rounded-xl font-medium transition-all hover:scale-[1.02] shadow-lg shadow-black/10">
                        {enrolling ? <Loader2 className="w-4 h-4 animate-spin" /> :
                          course.price === 0
                            ? <><GraduationCap className="w-4 h-4" /> Записаться бесплатно</>
                            : <><Lock className="w-4 h-4" /> Записаться на курс</>
                        }
                      </button>
                      {!user && (
                        <p className="text-center text-[#9CA3AF] text-xs">
                          <Link to="/login" className="text-blue-400 hover:underline">Войдите</Link> или{" "}
                          <Link to="/register" className="text-blue-400 hover:underline">зарегистрируйтесь</Link>
                        </p>
                      )}
                    </div>
                  )}

                  {enrollError && (
                    <p className="text-red-400 text-xs flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> {enrollError}
                    </p>
                  )}

                  {/* What's included */}
                  <div className="space-y-2 pt-1 border-t border-white/10">
                    <p className="text-[#9CA3AF] text-xs font-medium uppercase tracking-wide mb-3">В курс включено</p>
                    {[
                      { icon: BookOpen,   text: `${course.lessons_count || "..."} уроков`,              show: true },
                      { icon: CheckCircle2, text: `${course.quizzes_count} вопросов в тестах`,          show: course.quizzes_count > 0 },
                      { icon: Clock,      text: course.duration || "Гибкий темп",                         show: true },
                      { icon: Zap,        text: `${totalXp} XP опыта`,                                   show: totalXp > 0 },
                      { icon: Infinity,   text: "Пожизненный доступ",                                    show: true },
                      { icon: Award,      text: "Сертификат по завершении",                              show: course.price > 0 || enrolled },
                      { icon: Shield,     text: "Поддержка инструктора",                                 show: true },
                    ].filter(i => i.show).map((item, i) => (
                      <div key={i} className="flex items-center gap-2.5 text-sm">
                        <item.icon className="w-4 h-4 text-[#9CA3AF] shrink-0" />
                        <span className="text-[#E2E8F0]">{item.text}</span>
                      </div>
                    ))}
                  </div>

                  {/* Share */}
                  <button onClick={handleCopy}
                    className="w-full flex items-center justify-center gap-2 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-[#9CA3AF] hover:text-white rounded-xl text-xs transition-all">
                    {copied ? <><Check className="w-3.5 h-3.5 text-green-400" /> Ссылка скопирована!</> : <><Copy className="w-3.5 h-3.5" /> Поделиться курсом</>}
                  </button>
                </div>
              </div>

              {/* Guarantee */}
              <div className="flex items-start gap-3 p-4 bg-white/[0.02] border border-[#E8E5DF] rounded-xl">
                <Shield className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[#0A0A0A] text-sm font-medium">Гарантия качества</p>
                  <p className="text-[#6B6B6B] text-xs mt-0.5 leading-relaxed">Если курс не оправдал ожиданий — напишите нам и мы разберёмся</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* ── RELATED COURSES ── */}
        {related.length > 0 && (
          <motion.div initial={{ y: 20 }} animate={{ y: 0 }} transition={{ delay: 0.3 }}
            className="mt-16">
            <h2 className="text-[#0A0A0A] font-bold text-xl mb-6 flex items-center gap-2">
              Похожие курсы
              <span className="text-[#8A8A8A] font-normal text-base">в категории {course.category}</span>
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {related.map(c => {
                const rl = LEVEL_META[c.level] || LEVEL_META.beginner;
                return (
                  <Link key={c.id} to={`/courses/${c.id}`}
                    className="group flex flex-col gap-3 p-4 bg-[#1a1a2e] border border-white/10 hover:border-[#0047FF]/40 rounded-2xl transition-all duration-300 hover:-translate-y-0.5">
                    <div className="w-full h-28 rounded-xl overflow-hidden bg-[#0d1117]">
                      {c.image
                        ? <img src={c.image} alt={c.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        : <div className="w-full h-full flex items-center justify-center"><BookOpen className="w-7 h-7 text-blue-400/20" /></div>
                      }
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium group-hover:text-blue-300 transition-colors line-clamp-2 leading-snug">{c.title}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className={`text-xs ${rl.color}`}>{rl.label}</span>
                        <span className={`text-xs font-semibold ${c.price === 0 ? "text-green-400" : "text-white/80"}`}>
                          {c.price === 0 ? "Бесплатно" : `${c.price.toLocaleString()} ₸`}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
