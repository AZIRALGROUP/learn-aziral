import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { usePageTitle } from "../hooks/usePageTitle";
import { LEVEL_CONFIG } from "../lib/constants";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  BookOpen, Clock, Users, Search, GraduationCap, Zap,
  Star, TrendingUp, X, Play, Code2, Smartphone, Server,
  Palette, Gamepad2, Sparkles, CheckCircle2, ArrowRight,
  Gift, SlidersHorizontal, ChevronRight, BarChart3, Loader2,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useTranslation } from "react-i18next";

/* ─────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────── */
type Course = {
  id: number; title: string; description: string; price: number;
  category: string; level: string; duration: string | null;
  instructor_name: string; students_count: number;
  lessons_count: number; image: string | null; enrolled: number;
  avg_rating: number | null; rating_count: number;
};

/* ─────────────────────────────────────────────────────────
   Constants
───────────────────────────────────────────────────────── */
const CATS = [
  { value: "all",    icon: Sparkles,   grad: "[#0047FF]",   bg: "bg-[#0047FF]/8",  border: "border-[#0047FF]/20", text: "text-[#0047FF]",  emoji: "✨" },
  { value: "web",    icon: Code2,      grad: "from-blue-500 to-cyan-500",     bg: "bg-blue-500/10",    border: "border-[#0047FF]/20",   text: "text-[#0047FF]",    emoji: "🌐" },
  { value: "mobile", icon: Smartphone, grad: "from-emerald-500 to-green-500", bg: "bg-emerald-500/10", border: "border-emerald-500/30",text: "text-emerald-600", emoji: "📱" },
  { value: "devops", icon: Server,     grad: "from-orange-500 to-amber-500",  bg: "bg-orange-500/10",  border: "border-orange-500/30", text: "text-orange-500",  emoji: "⚙️" },
  { value: "design", icon: Palette,    grad: "from-pink-500 to-rose-500",     bg: "bg-pink-500/10",    border: "border-pink-500/30",   text: "text-pink-500",    emoji: "🎨" },
  { value: "other",  icon: Gamepad2,   grad: "from-yellow-500 to-amber-500",  bg: "bg-yellow-500/10",  border: "border-yellow-500/30", text: "text-yellow-600",  emoji: "🎮" },
];

const LEVEL_COLOR = Object.fromEntries(
  Object.entries(LEVEL_CONFIG).map(([k, v]) => [k, `${v.color} ${v.bgClass} ${v.borderClass}`])
);

// Navbar height in px (fixed, h-18 = 72px)
const NAVBAR_H = 72;

/* ─────────────────────────────────────────────────────────
   StarRating
───────────────────────────────────────────────────────── */
function StarRating({ rating, size = "sm" }: { rating: number | null; size?: "sm" | "xs" }) {
  const { t } = useTranslation();
  if (!rating) return <span className="text-[#8A8A8A] text-xs">{t("courses.no_rating")}</span>;
  const sz = size === "xs" ? "w-2.5 h-2.5" : "w-3 h-3";
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} className={`${sz} ${i <= Math.round(rating) ? "text-yellow-400 fill-yellow-400" : "text-[#A0A0A0]"}`} />
      ))}
      <span className="text-yellow-400 text-xs ml-1 font-medium">{rating.toFixed(1)}</span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   SkeletonCard
───────────────────────────────────────────────────────── */
function SkeletonCard() {
  return (
    <div className="bg-white border border-[#E8E5DF] rounded-2xl overflow-hidden animate-pulse">
      <div className="bg-[#F0EEE9]" style={{ paddingBottom: "56.25%" }} />
      <div className="p-4 space-y-3">
        <div className="flex gap-2"><div className="h-4 bg-[#F5F3EE] rounded-lg w-20" /><div className="h-4 bg-[#F5F3EE] rounded-lg w-16" /></div>
        <div className="h-4 bg-[#F5F3EE] rounded-lg w-5/6" />
        <div className="h-4 bg-[#F5F3EE] rounded-lg w-3/4" />
        <div className="h-3 bg-[#F5F3EE] rounded-lg" />
        <div className="h-3 bg-[#F5F3EE] rounded-lg w-2/3" />
        <div className="flex justify-between pt-2 border-t border-white/5">
          <div className="h-3 bg-[#F5F3EE] rounded-lg w-16" />
          <div className="h-3 bg-[#F5F3EE] rounded-lg w-12" />
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   CourseCard
───────────────────────────────────────────────────────── */
function CourseCard({ course, index }: { course: Course; index: number }) {
  const { t } = useTranslation();
  const cat   = CATS.find(c => c.value === course.category) || CATS[0];
  const lvlCls = LEVEL_COLOR[course.level] || LEVEL_COLOR.beginner;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95, y: 12 }}
      animate={{ opacity: 1, scale: 1,    y: 0  }}
      exit={{    opacity: 0, scale: 0.97, y: -8 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.03, 0.15) }}
    >
      <Link
        to={`/courses/${course.id}`}
        className="group relative flex flex-col bg-white border border-[#E8E5DF] hover:border-[#0047FF]/40 rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/10 h-full"
      >
        {/* Thumbnail */}
        <div className="relative overflow-hidden shrink-0" style={{ paddingBottom: "56.25%" }}>
          <div className="absolute inset-0">
            {course.image ? (
              <img src={course.image} alt={course.title} loading="lazy"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
            ) : (
              <div className={`w-full h-full ${cat.bg} flex items-center justify-center`}>
                <span className="text-5xl opacity-40">{cat.emoji}</span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/15 to-transparent" />
          </div>

          {/* Hover play */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="w-11 h-11 bg-[#E8E5DF] backdrop-blur-sm rounded-full flex items-center justify-center border border-[#D0CCC6] shadow-xl">
              <Play className="w-4 h-4 text-white fill-white ml-0.5" />
            </div>
          </div>

          {/* Badges */}
          <div className="absolute top-3 left-3 right-3 flex justify-between items-start">
            {course.enrolled ? (
              <span className="flex items-center gap-1 px-2 py-1 bg-blue-600/90 backdrop-blur-sm rounded-lg text-[#0A0A0A] text-xs font-medium">
                <CheckCircle2 className="w-3 h-3" /> {t("courses.enrolled")}
              </span>
            ) : <span />}
            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold backdrop-blur-sm ${
              course.price === 0 ? "bg-emerald-500 text-white" : "bg-black/60 border border-[#E8E5DF] text-white"
            }`}>
              {course.price === 0 ? t("courses.free") : `${course.price.toLocaleString()} ₸`}
            </span>
          </div>

          {/* Student count */}
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 text-white/90 text-xs font-medium">
            <Users className="w-3 h-3" />
            <span>{course.students_count > 999 ? `${(course.students_count/1000).toFixed(1)}K` : course.students_count}</span>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-col flex-1 p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-2 py-0.5 rounded-md text-xs font-medium border ${lvlCls}`}>
              {t(`courses.level_${course.level}` as any)}
            </span>
            <span className={`text-xs ${cat.text} font-medium`}>{cat.emoji} {t(`courses.cat_${course.category}` as any)}</span>
          </div>

          <h3 className="text-[#0A0A0A] font-semibold text-sm leading-snug mb-1.5 group-hover:text-[#0038CC] transition-colors line-clamp-2 flex-1">
            {course.title}
          </h3>

          <p className="text-[#6B6B6B] text-xs line-clamp-2 mb-3 leading-relaxed">{course.description}</p>

          <StarRating rating={course.avg_rating} />

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#E8E5DF] text-xs text-[#6B6B6B]">
            <div className="flex items-center gap-3">
              {course.lessons_count > 0 && (
                <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" /> {course.lessons_count} {t("courses.lessons")}</span>
              )}
              {course.duration && (
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {course.duration}</span>
              )}
            </div>
            <span className="truncate max-w-[90px] text-[#8A8A8A]">{course.instructor_name}</span>
          </div>
        </div>

        {/* Accent bottom line on hover */}
        <div className={`absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r ${cat.grad} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
      </Link>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────
   ActiveTag
───────────────────────────────────────────────────────── */
function ActiveTag({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85 }}
      transition={{ duration: 0.12 }}
      onClick={onRemove}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0047FF]/8 border border-[#0047FF]/30 text-[#0047FF] text-xs rounded-xl hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-300 transition-all"
    >
      {label} <X className="w-3 h-3" />
    </motion.button>
  );
}

/* ─────────────────────────────────────────────────────────
   CoursesPage
───────────────────────────────────────────────────────── */
export function CoursesPage() {
  const { t, i18n } = useTranslation();
  usePageTitle(t("courses.page_title"), {
    description: "IT-курсы от команды AZIRAL: веб-разработка, мобильные приложения, DevOps. Практические знания от реальных специалистов из Казахстана.",
    path: "/courses",
  });
  const { user } = useAuth();

  const searchRef = useRef<HTMLInputElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);   // sentinel for sticky bar
  const [sticky, setSticky] = useState(false);

  // Data
  const [allCourses, setAllCourses]     = useState<Course[]>([]);
  const [platformStats, setPlatformStats] = useState({ total: 0, free: 0, students: 0 });
  const [loading, setLoading]           = useState(true);
  const [fetching, setFetching]         = useState(false); // subtle re-fetch indicator
  const [error, setError]               = useState("");

  // Filters
  const [category, setCategory]   = useState("all");
  const [level, setLevel]         = useState("all");
  const [onlyFree, setOnlyFree]   = useState(false);
  const [search, setSearch]       = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [sort, setSort]           = useState("popular");

  /* ── Derived ── */
  const courses = useMemo(() => {
    const d = [...allCourses];
    if (sort === "popular")    d.sort((a, b) => b.students_count - a.students_count);
    if (sort === "price_asc")  d.sort((a, b) => a.price - b.price);
    if (sort === "price_desc") d.sort((a, b) => b.price - a.price);
    if (sort === "rating")     d.sort((a, b) => (b.avg_rating || 0) - (a.avg_rating || 0));
    if (sort === "new")        d.sort((a, b) => b.id - a.id);
    return d;
  }, [allCourses, sort]);

  const trending = useMemo(() =>
    [...allCourses].sort((a, b) => b.students_count - a.students_count).slice(0, 5)
  , [allCourses]);

  // Count of courses per category in current result
  const catCounts = useMemo(() =>
    Object.fromEntries(CATS.map(c => [c.value, allCourses.filter(x => x.category === c.value).length]))
  , [allCourses]);

  const isDefault  = !search && category === "all" && level === "all" && !onlyFree;
  const hasFilters = !!(search || category !== "all" || level !== "all" || onlyFree || sort !== "popular");

  const LEVELS = [
    { value: "all",          label: t("courses.level_all") },
    { value: "beginner",     label: t("courses.level_beginner") },
    { value: "intermediate", label: t("courses.level_intermediate") },
    { value: "advanced",     label: t("courses.level_advanced") },
  ];

  const SORT_OPTIONS = [
    { v: "popular",    icon: TrendingUp, l: t("courses.sort_popular")   },
    { v: "rating",     icon: Star,       l: t("courses.sort_rating")    },
    { v: "price_asc",  icon: Gift,       l: t("courses.sort_price_asc") },
    { v: "price_desc", icon: BarChart3,  l: t("courses.sort_price_desc")},
    { v: "new",        icon: Sparkles,   l: t("courses.sort_new")       },
  ];

  const pluralCourse = (n: number) => {
    if (i18n.language === "en") return n === 1 ? t("courses.courses_one") : t("courses.courses_many");
    const m10 = n % 10, m100 = n % 100;
    if (m100 >= 11 && m100 <= 19) return t("courses.courses_many");
    if (m10 === 1) return t("courses.courses_one");
    if (m10 >= 2 && m10 <= 4) return t("courses.courses_few");
    return t("courses.courses_many");
  };

  /* ── Platform stats (once on mount, no filters) ── */
  useEffect(() => {
    const token = localStorage.getItem("azr-token");
    fetch("/api/courses", { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => r.ok ? r.json() : [])
      .then((data: Course[]) => setPlatformStats({
        total:    data.length,
        free:     data.filter(c => c.price === 0).length,
        students: data.reduce((s, c) => s + c.students_count, 0),
      }))
      .catch(() => {});
  }, []);

  /* ── Debounce search ── */
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  /* ── Fetch filtered courses ── */
  const fetchCourses = useCallback(async (isFirst = false) => {
    isFirst ? setLoading(true) : setFetching(true);
    setError("");
    try {
      const p = new URLSearchParams();
      if (category !== "all") p.set("category", category);
      if (level !== "all")    p.set("level", level);
      if (onlyFree)           p.set("free", "1");
      if (search)             p.set("search", search);
      const token = localStorage.getItem("azr-token");
      const r = await fetch(`/api/courses?${p}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!r.ok) throw new Error();
      setAllCourses(await r.json());
    } catch {
      setError(t("courses.error_loading"));
    } finally {
      isFirst ? setLoading(false) : setFetching(false);
    }
  }, [category, level, onlyFree, search, t]);

  // First load
  useEffect(() => { fetchCourses(true); }, []); // eslint-disable-line

  // Filter changes — subtle re-fetch
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    fetchCourses(false);
  }, [fetchCourses]);

  /* ── ⌘K / Ctrl+K ── */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      if (e.key === "Escape" && document.activeElement === searchRef.current) {
        setSearchInput(""); setSearch("");
        searchRef.current?.blur();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  /* ── Sticky filter bar sentinel ── */
  useEffect(() => {
    const el = stickyRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        // Show sticky only when sentinel has scrolled ABOVE the navbar
        // (not when it's simply below the viewport on fresh load)
        setSticky(!entry.isIntersecting && entry.boundingClientRect.top < NAVBAR_H);
      },
      { threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const clearFilters = () => {
    setSearchInput(""); setSearch(""); setCategory("all");
    setLevel("all"); setOnlyFree(false); setSort("popular");
  };

  /* ── Active filter tags ── */
  const activeTags = useMemo(() => {
    const tags: { key: string; label: string; onRemove: () => void }[] = [];
    if (category !== "all") {
      const c = CATS.find(x => x.value === category);
      tags.push({ key: "cat", label: `${c?.emoji} ${t(`courses.cat_${category}` as any)}`, onRemove: () => setCategory("all") });
    }
    if (level !== "all") {
      tags.push({ key: "lvl", label: t(`courses.level_${level}` as any), onRemove: () => setLevel("all") });
    }
    if (onlyFree) {
      tags.push({ key: "free", label: t("courses.only_free"), onRemove: () => setOnlyFree(false) });
    }
    if (search) {
      tags.push({ key: "q", label: `"${search}"`, onRemove: () => { setSearch(""); setSearchInput(""); } });
    }
    return tags;
  }, [category, level, onlyFree, search, t]);

  /* ══════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-[#F5F3EE] pb-28">

      {/* ── STICKY FILTER BAR (below navbar) ── */}
      <AnimatePresence>
        {sticky && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.18 }}
            style={{ top: NAVBAR_H }}
            className="fixed left-0 right-0 z-40 bg-[#F5F3EE]/96 backdrop-blur-xl border-b border-[#E8E5DF] shadow-2xl shadow-black/50"
          >
            <div className="max-w-7xl mx-auto px-6 py-2.5 flex items-center gap-3 overflow-x-auto scrollbar-hide">
              {/* Category quick pills */}
              {CATS.map(c => (
                <button
                  key={c.value}
                  onClick={() => setCategory(c.value)}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${
                    category === c.value
                      ? "bg-[#0047FF] text-white border-[#0038CC]"
                      : "bg-[#F0EEE9] border-[#E8E5DF] text-[#6B6B6B] hover:text-[#0A0A0A] hover:border-[#E8E5DF]"
                  }`}
                >
                  <span>{c.emoji}</span>
                  <span className="hidden sm:inline">{t(`courses.cat_${c.value}` as any).split(" ")[0]}</span>
                </button>
              ))}

              <div className="w-px h-4 bg-[#EDEAE4] shrink-0" />

              {/* Sort */}
              <div className="flex gap-1.5 shrink-0">
                {SORT_OPTIONS.map(o => (
                  <button
                    key={o.v}
                    onClick={() => setSort(o.v)}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                      sort === o.v
                        ? "bg-[#0047FF]/10 border-[#0047FF]/30 text-[#0047FF]"
                        : "bg-white/[0.02] border-[#E8E5DF] text-[#6B6B6B] hover:text-[#3A3A3A]"
                    }`}
                  >
                    <span className="hidden sm:inline">{o.l}</span>
                    <o.icon className="w-3.5 h-3.5 sm:hidden" />
                  </button>
                ))}
              </div>

              <div className="ml-auto flex items-center gap-2 shrink-0">
                {fetching && <Loader2 className="w-3.5 h-3.5 text-[#0047FF] animate-spin" />}
                {!fetching && courses.length > 0 && (
                  <span className="text-[#8A8A8A] text-xs">{courses.length} {pluralCourse(courses.length)}</span>
                )}
                {hasFilters && (
                  <button onClick={clearFilters}
                    className="flex items-center gap-1 text-xs text-[#8A8A8A] hover:text-[#0A0A0A] transition-colors">
                    <X className="w-3 h-3" /> {t("courses.reset")}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── HERO ── */}
      <div className="relative pt-24 pb-14 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0047FF]/5 via-transparent to-transparent pointer-events-none" />
        <div className="absolute -top-20 left-1/4 w-[600px] h-[600px] bg-[#0047FF]/6 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-10 right-1/4 w-[400px] h-[400px] bg-blue-600/6 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-[#E8E5DF]" />

        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
            <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#0047FF]/8 border border-[#0047FF]/20 rounded-full text-[#0047FF] text-xs mb-6 font-medium">
              <GraduationCap className="w-3.5 h-3.5" /> {t("courses.hero_badge")}
            </span>
            <h1 className="text-4xl lg:text-6xl font-extrabold text-[#0A0A0A] mb-4 leading-tight tracking-tight">
              {t("courses.hero_title1")}{" "}
              <span className="text-[#0047FF]">
                {t("courses.hero_title2")}
              </span>
            </h1>
            <p className="text-[#6B6B6B] text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
              {t("courses.hero_subtitle")}
            </p>

            {/* Search */}
            <div className="relative max-w-2xl mx-auto group">
              <div className="absolute -inset-px bg-[#0047FF]/10 rounded-2xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 pointer-events-none" />
              <div className="relative">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B6B6B] pointer-events-none group-focus-within:text-[#0047FF] transition-colors" />
                <input
                  ref={searchRef}
                  type="text"
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  placeholder={t("courses.search_placeholder")}
                  className="w-full bg-[#F0EEE9] border border-[#E8E5DF] focus:border-[#0047FF]/40 focus:bg-white rounded-2xl pl-14 pr-16 py-4 text-[#0A0A0A] placeholder-[#A0A0A0] outline-none transition-all text-base"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  {searchInput ? (
                    <button
                      onClick={() => { setSearchInput(""); setSearch(""); searchRef.current?.focus(); }}
                      className="p-1.5 text-[#6B6B6B] hover:text-[#0A0A0A] hover:bg-[#EDEAE4] transition-all rounded-lg"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  ) : (
                    <kbd className="text-[10px] text-[#A0A0A0] border border-[#E8E5DF] rounded-md px-1.5 py-0.5 font-mono pointer-events-none">⌘K</kbd>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Platform stats (fixed, no filter dependency) */}
          {platformStats.total > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex items-center justify-center gap-6 sm:gap-8 mt-10 flex-wrap"
            >
              {[
                { icon: BookOpen, val: platformStats.total,    label: pluralCourse(platformStats.total),    color: "text-[#0047FF]" },
                { icon: Gift,     val: platformStats.free,     label: t("courses.stat_free"),               color: "text-emerald-400" },
                { icon: Users,    val: platformStats.students > 999 ? `${(platformStats.students/1000).toFixed(1)}K` : platformStats.students, label: t("courses.stat_students"), color: "text-blue-400" },
              ].map(s => (
                <div key={s.label} className="flex items-center gap-2 text-[#6B6B6B] text-sm">
                  <s.icon className={`w-4 h-4 ${s.color}`} />
                  <span className="text-[#0A0A0A] font-bold">{s.val}</span>
                  <span>{s.label}</span>
                </div>
              ))}
              <div className="hidden sm:block w-px h-4 bg-[#EDEAE4]" />
              {(user?.role === "instructor" || user?.role === "admin") ? (
                <Link to="/instructor"
                  className="flex items-center gap-2 px-3 py-1.5 bg-[#0047FF]/10 border border-[#0047FF]/30 hover:bg-[#0047FF]/30 text-[#0047FF] text-xs rounded-xl transition-all hover:scale-105">
                  <Zap className="w-3.5 h-3.5" /> {t("courses.instructor_cabinet")}
                </Link>
              ) : (
                <Link to="/instructor"
                  className="flex items-center gap-2 px-3 py-1.5 bg-[#F0EEE9] border border-[#E8E5DF] hover:border-[#0047FF]/30 hover:text-[#0047FF] text-[#6B6B6B] text-xs rounded-xl transition-all">
                  <GraduationCap className="w-3.5 h-3.5" /> {t("courses.become_instructor_link")}
                </Link>
              )}
            </motion.div>
          )}
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="max-w-7xl mx-auto px-6 lg:px-8">

        {/* Category quick-jump grid (always visible, active highlighted) */}
        {!loading && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8"
          >
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {CATS.filter(c => c.value !== "all").map(cat => {
                const Icon    = cat.icon;
                const count   = catCounts[cat.value] || 0;
                const isActive = category === cat.value;
                return (
                  <button
                    key={cat.value}
                    onClick={() => setCategory(isActive ? "all" : cat.value)}
                    className={`group relative flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all duration-200 overflow-hidden
                      ${isActive
                        ? `${cat.bg} ${cat.border} scale-[1.02] shadow-lg`
                        : `bg-white/[0.02] border-[#E8E5DF] hover:${cat.bg} hover:${cat.border} hover:scale-[1.02]`
                      }`}
                  >
                    {/* Glow */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${cat.grad} transition-opacity duration-200
                      ${isActive ? "opacity-10" : "opacity-0 group-hover:opacity-8"}`} />

                    <div className={`relative w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200
                      ${isActive ? `bg-[#0047FF] text-white shadow-md` : `bg-[#F5F3EE] ${cat.text} group-hover:scale-110`}`}>
                      <Icon className="w-4.5 h-4.5 w-[18px] h-[18px]" />
                    </div>

                    <div className="relative text-center">
                      <p className={`text-xs font-semibold transition-colors ${isActive ? cat.text : "text-[#6B6B6B] group-hover:" + cat.text.slice(5)}`}>
                        {cat.emoji} {t(`courses.cat_${cat.value}` as any).split(" ")[0]}
                      </p>
                      <p className="text-[#8A8A8A] text-[10px] mt-0.5">{count} {pluralCourse(count)}</p>
                    </div>

                    {isActive && (
                      <motion.div
                        layoutId="cat-active"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0047FF]"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Trending (default view only) */}
        <AnimatePresence>
          {isDefault && !loading && trending.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              transition={{ duration: 0.25 }}
              className="mb-10 overflow-hidden"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-orange-500/15 rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-orange-400" />
                  </div>
                  <h2 className="text-[#0A0A0A] font-bold text-lg">{t("courses.trending")}</h2>
                  <span className="hidden sm:inline px-2 py-0.5 bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs rounded-full">
                    Top {trending.length}
                  </span>
                </div>
                {/* "Все" — shows all courses, NO scroll */}
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 text-[#6B6B6B] hover:text-[#0A0A0A] text-sm transition-colors group"
                >
                  {t("courses.all_btn")}
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>

              <div className="flex gap-4 overflow-x-auto pb-2 -mx-2 px-2 scrollbar-hide snap-x snap-mandatory">
                {trending.map((course, i) => {
                  const cat = CATS.find(c => c.value === course.category) || CATS[0];
                  return (
                    <Link key={course.id} to={`/courses/${course.id}`}
                      className="group snap-start shrink-0 w-60 flex flex-col bg-white border border-[#E8E5DF] hover:border-[#0047FF]/30 rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/10">
                      <div className="relative h-32 overflow-hidden">
                        {course.image ? (
                          <img src={course.image} alt={course.title} loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                        ) : (
                          <div className={`w-full h-full ${cat.bg} flex items-center justify-center`}>
                            <span className="text-4xl opacity-40">{cat.emoji}</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                        <div className={`absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold backdrop-blur-sm ${
                          i === 0 ? "bg-yellow-500 text-black" :
                          i === 1 ? "bg-gray-300/80 text-black" :
                          i === 2 ? "bg-orange-500/80 text-white" : "bg-black/50 text-white"
                        }`}>
                          #{i + 1}
                        </div>
                        <div className="absolute top-2 right-2">
                          <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${
                            course.price === 0 ? "bg-emerald-500 text-white" : "bg-black/60 border border-[#E8E5DF] text-white"
                          }`}>
                            {course.price === 0 ? t("courses.free") : `${course.price.toLocaleString()} ₸`}
                          </span>
                        </div>
                      </div>
                      <div className="p-3 flex-1 flex flex-col">
                        <h3 className="text-[#0A0A0A] text-xs font-semibold line-clamp-2 leading-snug mb-2 group-hover:text-[#0047FF] transition-colors flex-1">
                          {course.title}
                        </h3>
                        <div className="flex items-center justify-between">
                          <StarRating rating={course.avg_rating} size="xs" />
                          <span className="flex items-center gap-1 text-[#8A8A8A] text-xs">
                            <Users className="w-2.5 h-2.5" />
                            {course.students_count > 999 ? `${(course.students_count/1000).toFixed(1)}K` : course.students_count}
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}

                {/* Browse all — clears filters, NO scroll */}
                <button
                  onClick={clearFilters}
                  className="snap-start shrink-0 w-44 flex flex-col items-center justify-center gap-3 bg-white/[0.02] border border-dashed border-[#E8E5DF] hover:border-[#0047FF]/30 hover:bg-[#0038CC]/5 rounded-2xl transition-all p-4 text-center group"
                >
                  <div className="w-10 h-10 bg-[#0047FF]/8 group-hover:bg-[#0038CC]/20 rounded-xl flex items-center justify-center transition-colors">
                    <ArrowRight className="w-5 h-5 text-[#0047FF]" />
                  </div>
                  <p className="text-[#6B6B6B] text-xs leading-snug">
                    {t("courses.browse_all_prefix")}{" "}
                    <span className="text-[#0A0A0A] font-semibold">{platformStats.total}</span>{" "}
                    {pluralCourse(platformStats.total)}
                  </p>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── FILTER BAR ── */}
        {/* Sentinel — triggers sticky bar when scrolled past */}
        <div ref={stickyRef} className="h-0" />

        <div className="mb-5 space-y-3">
          {/* Category pills */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {CATS.map(c => {
              const count = c.value === "all" ? allCourses.length : (catCounts[c.value] || 0);
              return (
                <button
                  key={c.value}
                  onClick={() => setCategory(c.value)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm whitespace-nowrap transition-all duration-200 shrink-0 border ${
                    category === c.value
                      ? "bg-[#0047FF] text-white border-[#0038CC] shadow-lg shadow-black/10"
                      : "bg-[#F5F3EE] border-[#E8E5DF] text-[#6B6B6B] hover:border-[#E8E5DF] hover:text-[#0A0A0A] hover:bg-[#F0EEE9]"
                  }`}
                >
                  <span>{c.emoji}</span>
                  <span>{t(`courses.cat_${c.value}` as any)}</span>
                  {!loading && count > 0 && (
                    <span className={`text-xs rounded-full px-1.5 py-0.5 ${
                      category === c.value ? "bg-[#E8E5DF]" : "bg-[#EDEAE4] text-[#8A8A8A]"
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Row 2: Level + Free + Sort */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Level */}
            <div className="flex gap-1.5 flex-wrap">
              {LEVELS.map(l => (
                <button key={l.value} onClick={() => setLevel(l.value)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                    level === l.value
                      ? "bg-blue-600/20 border-blue-500/40 text-[#0047FF]"
                      : "bg-white/[0.02] border-[#E8E5DF] text-[#6B6B6B] hover:text-[#3A3A3A] hover:border-white/15"
                  }`}>
                  {l.label}
                </button>
              ))}
            </div>

            <div className="w-px h-5 bg-[#EDEAE4] hidden sm:block" />

            {/* Free */}
            <button onClick={() => setOnlyFree(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                onlyFree
                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-600"
                  : "bg-white/[0.02] border-[#E8E5DF] text-[#6B6B6B] hover:text-[#3A3A3A] hover:border-white/15"
              }`}>
              <Gift className="w-3.5 h-3.5" /> {t("courses.only_free")}
            </button>

            {/* Sort */}
            <div className="flex items-center gap-1.5 ml-auto">
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#8A8A8A] shrink-0" />
              {SORT_OPTIONS.map(o => {
                const Icon = o.icon;
                return (
                  <button key={o.v} onClick={() => setSort(o.v)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                      sort === o.v
                        ? "bg-[#EDEAE4] border-[#E8E5DF] text-[#6B6B6B] shadow-sm"
                        : "bg-white/[0.02] border-[#E8E5DF] text-[#6B6B6B] hover:text-[#3A3A3A] hover:border-white/15"
                    }`}>
                    <Icon className="w-3 h-3" />
                    <span className="hidden md:inline">{o.l}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Active tags + count row */}
        {(activeTags.length > 0 || (!loading && courses.length > 0)) && (
          <div className="flex items-center gap-2 flex-wrap mb-5">
            <AnimatePresence>
              {activeTags.map(tag => (
                <ActiveTag key={tag.key} label={tag.label} onRemove={tag.onRemove} />
              ))}
            </AnimatePresence>
            <div className="ml-auto flex items-center gap-3">
              {fetching && (
                <span className="flex items-center gap-1.5 text-xs text-[#0047FF]">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Поиск...
                </span>
              )}
              {!loading && !fetching && courses.length > 0 && (
                <span className="text-[#8A8A8A] text-xs">{courses.length} {pluralCourse(courses.length)}</span>
              )}
              {hasFilters && (
                <button onClick={clearFilters}
                  className="flex items-center gap-1 text-xs text-[#8A8A8A] hover:text-red-400 transition-colors border border-[#E8E5DF] hover:border-red-500/25 px-2.5 py-1.5 rounded-xl">
                  <X className="w-3 h-3" /> {t("courses.reset")}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── COURSE GRID ── */}
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {[...Array(8)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : error ? (
          <div className="text-center py-24">
            <div className="text-5xl mb-4">⚠️</div>
            <p className="text-red-400 mb-4">{error}</p>
            <button onClick={() => fetchCourses(false)}
              className="px-5 py-2.5 bg-[#F5F3EE] border border-[#E8E5DF] hover:border-[#E8E5DF] text-[#6B6B6B] hover:text-[#0A0A0A] rounded-xl text-sm transition-all">
              {t("courses.retry")}
            </button>
          </div>
        ) : courses.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-28 bg-white/[0.02] border border-[#E8E5DF] rounded-3xl"
          >
            <div className="text-6xl mb-5">🔍</div>
            <p className="text-[#0A0A0A] text-2xl font-bold mb-2">{t("courses.not_found")}</p>
            <p className="text-[#6B6B6B] mb-8 max-w-xs mx-auto">{t("courses.not_found_desc")}</p>
            <button onClick={clearFilters}
              className="px-6 py-3 bg-[#0047FF]/10 border border-[#0047FF]/30 hover:bg-[#0047FF]/30 text-[#0047FF] rounded-xl text-sm transition-all hover:scale-105 font-medium">
              {t("courses.show_all")}
            </button>
          </motion.div>
        ) : (
          /* popLayout: cards stay mounted (no image flicker), animate in/out individually */
          <div className={`grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 transition-opacity duration-200 ${fetching ? "opacity-60" : "opacity-100"}`}>
            <AnimatePresence mode="popLayout">
              {courses.map((course, i) => (
                <CourseCard key={course.id} course={course} index={i} />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* ── INSTRUCTOR CTA ── */}
        {!loading && !error && courses.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="mt-20 relative overflow-hidden rounded-3xl border border-[#0047FF]/20 bg-[#F5F3EE] p-8 lg:p-12"
          >
            <div className="absolute -top-16 -right-16 w-80 h-80 bg-[#0047FF]/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 w-60 h-60 bg-blue-600/8 rounded-full blur-3xl pointer-events-none" />
            <div className="relative flex flex-col lg:flex-row items-center gap-8 text-center lg:text-left">
              <div className="w-16 h-16 bg-[#0047FF] rounded-2xl flex items-center justify-center shrink-0 shadow-xl shadow-black/10">
                <GraduationCap className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-[#0A0A0A] text-2xl font-bold mb-2">{t("courses.cta_title")}</h3>
                <p className="text-[#6B6B6B] max-w-xl leading-relaxed">
                  {t("courses.cta_desc_pre")}{" "}
                  <span className="text-[#0047FF] font-bold">{t("courses.cta_percent")}</span>
                  {t("courses.cta_desc_post", { count: platformStats.students.toLocaleString() })}
                </p>
              </div>
              <Link to="/instructor"
                className="shrink-0 flex items-center gap-2 px-7 py-3.5 bg-[#0047FF] hover:bg-[#0038CC] hover:to-blue-500 text-white rounded-xl font-semibold transition-all hover:scale-105 shadow-xl shadow-black/10 text-sm">
                <Play className="w-4 h-4 fill-white" /> {t("courses.cta_btn")}
              </Link>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
