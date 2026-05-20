import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { usePageTitle } from "../hooks/usePageTitle";
import { useAuth } from "../contexts/AuthContext";
import { testsApi } from "../../api/client";
import type { TestSummary } from "../../api/client";
import {
  BookOpen, Plus, ClipboardList, Search, User, X,
  GraduationCap, Layers, ArrowUpDown, Clock,
  Filter, Zap, FileText,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────
   Category badge colours
───────────────────────────────────────────────────────── */
const CATEGORY_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  web:    { bg: "bg-blue-500/10",    text: "text-blue-600",    border: "border-blue-200" },
  mobile: { bg: "bg-emerald-500/10", text: "text-emerald-600", border: "border-emerald-200" },
  devops: { bg: "bg-orange-500/10",  text: "text-orange-600",  border: "border-orange-200" },
  design: { bg: "bg-pink-500/10",    text: "text-pink-600",    border: "border-pink-200" },
  other:  { bg: "bg-yellow-500/10",  text: "text-yellow-600",  border: "border-yellow-200" },
};

function categoryStyle(cat: string) {
  return CATEGORY_STYLE[cat] ?? { bg: "bg-[#0047FF]/8", text: "text-[#0047FF]", border: "border-[#0047FF]/20" };
}

function categoryBadge(cat: string) {
  const s = categoryStyle(cat);
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
      {cat || "Без категории"}
    </span>
  );
}

type SortBy = "newest" | "oldest" | "name" | "questions";

/* ─────────────────────────────────────────────────────────
   Skeleton card for loading state
───────────────────────────────────────────────────────── */
function SkeletonCard() {
  return (
    <div className="bg-white border border-[#E8E5DF] rounded-2xl p-5 animate-pulse space-y-4">
      <div className="flex items-center gap-2">
        <div className="h-5 w-16 bg-[#F0EEE9] rounded-full" />
      </div>
      <div className="h-5 bg-[#F0EEE9] rounded-lg w-4/5" />
      <div className="space-y-2">
        <div className="h-3.5 bg-[#F0EEE9] rounded-lg w-full" />
        <div className="h-3.5 bg-[#F0EEE9] rounded-lg w-2/3" />
      </div>
      <div className="flex items-center justify-between pt-3 border-t border-[#F0EEE9]">
        <div className="h-3.5 bg-[#F0EEE9] rounded-lg w-24" />
        <div className="h-3.5 bg-[#F0EEE9] rounded-lg w-16" />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Stats card
───────────────────────────────────────────────────────── */
function StatCard({ icon: Icon, value, label, accent }: {
  icon: React.ComponentType<{ className?: string }>;
  value: number | string;
  label: string;
  accent: string;
}) {
  return (
    <div className="bg-white border border-[#E8E5DF] rounded-2xl p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl ${accent} flex items-center justify-center shrink-0`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <div className="text-xl font-bold text-[#1A1A1A] leading-tight">{value}</div>
        <div className="text-xs text-[#6B6B6B] leading-tight">{label}</div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   StudyPage
───────────────────────────────────────────────────────── */
export function StudyPage() {
  usePageTitle("Тесты — AZIRAL Learn");

  const { user } = useAuth();
  const navigate = useNavigate();

  const [tests, setTests] = useState<TestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortBy>("newest");
  const [sortOpen, setSortOpen] = useState(false);

  const isInstructor = user?.role === "instructor" || user?.role === "admin";

  /* ── Fetch tests ─────────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    testsApi
      .list()
      .then((data) => {
        if (!cancelled) setTests(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Не удалось загрузить тесты");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  /* ── Create test (instructor) ────────────────────────── */
  async function handleCreate() {
    if (creating) return;
    setCreating(true);
    try {
      const newTest = await testsApi.create({ title: "Новый тест" });
      navigate(`/instructor/tests/${newTest.id}/build`);
    } catch {
      setError("Не удалось создать тест");
      setCreating(false);
    }
  }

  /* ── Derived data ────────────────────────────────────── */
  const categories = useMemo(() => {
    const set = new Set<string>();
    tests.forEach(t => { if (t.category) set.add(t.category); });
    return Array.from(set).sort();
  }, [tests]);

  const totalQuestions = useMemo(
    () => tests.reduce((sum, t) => sum + (t.question_count || 0), 0),
    [tests]
  );

  const totalInstructors = useMemo(() => {
    const set = new Set<string>();
    tests.forEach(t => { if (t.instructor_name) set.add(t.instructor_name); });
    return set.size;
  }, [tests]);

  /* ── Filter & sort ───────────────────────────────────── */
  const query = search.toLowerCase().trim();

  const filtered = useMemo(() => {
    let result = tests;

    if (activeCategory !== "all") {
      result = result.filter(t => t.category === activeCategory);
    }

    if (query) {
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(query) ||
          t.description.toLowerCase().includes(query) ||
          t.category.toLowerCase().includes(query) ||
          t.instructor_name.toLowerCase().includes(query),
      );
    }

    const sorted = [...result];
    switch (sortBy) {
      case "newest":
        sorted.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
        break;
      case "oldest":
        sorted.sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
        break;
      case "name":
        sorted.sort((a, b) => a.title.localeCompare(b.title, "ru"));
        break;
      case "questions":
        sorted.sort((a, b) => (b.question_count || 0) - (a.question_count || 0));
        break;
    }
    return sorted;
  }, [tests, activeCategory, query, sortBy]);

  const sortLabels: Record<SortBy, string> = {
    newest: "Сначала новые",
    oldest: "Сначала старые",
    name: "По названию",
    questions: "По кол-ву вопросов",
  };

  /* ── Render ──────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-[#F5F3EE]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-24 sm:pt-28 pb-16">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6 sm:mb-8">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0047FF] to-[#3366FF] flex items-center justify-center shadow-lg shadow-[#0047FF]/20 shrink-0">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#1A1A1A] tracking-tight">
                Тесты
              </h1>
              <p className="text-[#6B6B6B] mt-1 text-sm sm:text-base">
                Проверьте свои знания с помощью интерактивных тестов
              </p>
            </div>
          </div>

          {isInstructor && (
            <button
              onClick={handleCreate}
              disabled={creating}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0047FF] text-white text-sm font-medium
                         hover:bg-[#0038CC] active:scale-[0.97] transition-all disabled:opacity-60 disabled:cursor-not-allowed
                         shadow-sm shadow-[#0047FF]/20 shrink-0"
            >
              {creating ? (
                <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Создать тест
            </button>
          )}
        </div>

        {/* Stats summary cards */}
        {!loading && tests.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <StatCard
              icon={ClipboardList}
              value={tests.length}
              label={pluralTests(tests.length)}
              accent="bg-[#0047FF]/10 text-[#0047FF]"
            />
            <StatCard
              icon={FileText}
              value={totalQuestions}
              label={pluralQuestions(totalQuestions)}
              accent="bg-emerald-500/10 text-emerald-600"
            />
            <StatCard
              icon={Layers}
              value={categories.length}
              label={pluralCategories(categories.length)}
              accent="bg-orange-500/10 text-orange-600"
            />
            <StatCard
              icon={User}
              value={totalInstructors}
              label={pluralInstructors(totalInstructors)}
              accent="bg-pink-500/10 text-pink-600"
            />
          </div>
        )}

        {/* Search + Sort row */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[#A0A0A0] pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск тестов..."
              className="w-full pl-11 pr-10 py-3 rounded-xl bg-white border border-[#E8E5DF] text-sm text-[#1A1A1A]
                         placeholder:text-[#A0A0A0] focus:outline-none focus:ring-2 focus:ring-[#0047FF]/20 focus:border-[#0047FF]
                         transition-shadow"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-[#F0EEE9] transition-colors"
                aria-label="Очистить"
              >
                <X className="w-4 h-4 text-[#8A8A8A]" />
              </button>
            )}
          </div>

          {/* Sort dropdown */}
          <div className="relative">
            <button
              onClick={() => setSortOpen((v) => !v)}
              onBlur={() => setTimeout(() => setSortOpen(false), 150)}
              className="w-full sm:w-auto inline-flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-white border border-[#E8E5DF]
                         text-sm text-[#1A1A1A] hover:border-[#0047FF]/40 transition-colors sm:min-w-[180px]"
            >
              <span className="inline-flex items-center gap-2">
                <ArrowUpDown className="w-4 h-4 text-[#8A8A8A]" />
                {sortLabels[sortBy]}
              </span>
            </button>
            {sortOpen && (
              <div className="absolute right-0 mt-1 w-48 bg-white border border-[#E8E5DF] rounded-xl shadow-lg z-10 overflow-hidden">
                {(Object.keys(sortLabels) as SortBy[]).map((key) => (
                  <button
                    key={key}
                    onMouseDown={() => { setSortBy(key); setSortOpen(false); }}
                    className={`block w-full text-left px-4 py-2.5 text-sm hover:bg-[#F5F3EE] transition-colors ${
                      sortBy === key ? "bg-[#0047FF]/5 text-[#0047FF] font-medium" : "text-[#3A3A3A]"
                    }`}
                  >
                    {sortLabels[key]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Category pills */}
        {!loading && categories.length > 0 && (
          <div className="flex items-center gap-2 mb-8 flex-wrap">
            <button
              onClick={() => setActiveCategory("all")}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all ${
                activeCategory === "all"
                  ? "bg-[#0047FF] text-white shadow-sm shadow-[#0047FF]/20"
                  : "bg-white border border-[#E8E5DF] text-[#3A3A3A] hover:border-[#0047FF]/40"
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              Все ({tests.length})
            </button>
            {categories.map((cat) => {
              const count = tests.filter(t => t.category === cat).length;
              const s = categoryStyle(cat);
              const active = activeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all ${
                    active
                      ? `${s.bg} ${s.text} border ${s.border}`
                      : "bg-white border border-[#E8E5DF] text-[#3A3A3A] hover:border-[#0047FF]/40"
                  }`}
                >
                  {cat}
                  <span className={`text-xs ${active ? "" : "text-[#8A8A8A]"}`}>({count})</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#0047FF]/8 flex items-center justify-center mb-5">
              <ClipboardList className="w-7 h-7 text-[#0047FF]" />
            </div>
            <h2 className="text-lg font-semibold text-[#1A1A1A] mb-1">
              {search || activeCategory !== "all" ? "Ничего не найдено" : "Тесты пока не добавлены"}
            </h2>
            <p className="text-sm text-[#6B6B6B] max-w-xs">
              {search || activeCategory !== "all"
                ? "Попробуйте изменить запрос поиска или сбросить фильтры"
                : "Скоро здесь появятся интерактивные тесты для проверки знаний"}
            </p>
            {(search || activeCategory !== "all") && (
              <button
                onClick={() => { setSearch(""); setActiveCategory("all"); }}
                className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0047FF]/10 text-[#0047FF] text-sm font-medium hover:bg-[#0047FF]/20 transition-colors"
              >
                <X className="w-4 h-4" />
                Сбросить фильтры
              </button>
            )}
          </div>
        )}

        {/* Test cards grid */}
        {!loading && filtered.length > 0 && (
          <>
            <div className="text-xs text-[#8A8A8A] mb-3 flex items-center gap-2">
              <span>Найдено: <strong className="text-[#3A3A3A]">{filtered.length}</strong></span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map((test) => {
                const estimatedMin = Math.max(1, Math.ceil(test.question_count * 0.5));
                return (
                  <Link
                    key={test.id}
                    to={`/study/${test.id}`}
                    className="group relative bg-white border border-[#E8E5DF] rounded-2xl p-5 flex flex-col
                               hover:border-[#0047FF]/30 hover:shadow-lg hover:shadow-[#0047FF]/5 hover:-translate-y-0.5
                               transition-all duration-200"
                  >
                    {/* Category + question count */}
                    <div className="flex items-center justify-between mb-3">
                      {categoryBadge(test.category)}
                      <span className="flex items-center gap-1 text-xs text-[#8A8A8A]">
                        <BookOpen className="w-3.5 h-3.5" />
                        {test.question_count} {pluralQuestions(test.question_count)}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="text-[15px] font-semibold text-[#1A1A1A] leading-snug mb-2 line-clamp-2 group-hover:text-[#0047FF] transition-colors">
                      {test.title}
                    </h3>

                    {/* Description */}
                    {test.description ? (
                      <p className="text-sm text-[#6B6B6B] leading-relaxed line-clamp-2 mb-auto">
                        {test.description}
                      </p>
                    ) : (
                      <p className="text-sm text-[#A0A0A0] italic leading-relaxed line-clamp-2 mb-auto">
                        Без описания
                      </p>
                    )}

                    {/* Meta info: estimated time */}
                    <div className="flex items-center gap-3 mt-3 text-xs text-[#8A8A8A]">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        ~{estimatedMin} мин
                      </span>
                    </div>

                    {/* Footer: instructor + start CTA */}
                    <div className="flex items-center justify-between gap-2 pt-4 mt-4 border-t border-[#F0EEE9]">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-full bg-[#F0EEE9] flex items-center justify-center shrink-0">
                          <User className="w-3.5 h-3.5 text-[#8A8A8A]" />
                        </div>
                        <span className="text-xs text-[#6B6B6B] truncate">
                          {test.instructor_name}
                        </span>
                      </div>
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-[#0047FF] opacity-0 group-hover:opacity-100 transition-opacity">
                        <Zap className="w-3 h-3" />
                        Начать
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Helpers ──────────────────────────────────────────── */
function pluralQuestions(n: number): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return "вопросов";
  if (last > 1 && last < 5) return "вопроса";
  if (last === 1) return "вопрос";
  return "вопросов";
}

function pluralTests(n: number): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return "тестов";
  if (last > 1 && last < 5) return "теста";
  if (last === 1) return "тест";
  return "тестов";
}

function pluralCategories(n: number): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return "категорий";
  if (last > 1 && last < 5) return "категории";
  if (last === 1) return "категория";
  return "категорий";
}

function pluralInstructors(n: number): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return "преподавателей";
  if (last > 1 && last < 5) return "преподавателя";
  if (last === 1) return "преподаватель";
  return "преподавателей";
}
