import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { usePageTitle } from "../hooks/usePageTitle";
import { useAuth } from "../contexts/AuthContext";
import { testsApi } from "../../api/client";
import type { TestSummary } from "../../api/client";
import { BookOpen, Plus, ClipboardList, Search, User } from "lucide-react";

/* ─────────────────────────────────────────────────────────
   Category badge colours
───────────────────────────────────────────────────────── */
const CATEGORY_STYLE: Record<string, { bg: string; text: string }> = {
  web:    { bg: "bg-blue-500/10",    text: "text-blue-600" },
  mobile: { bg: "bg-emerald-500/10", text: "text-emerald-600" },
  devops: { bg: "bg-orange-500/10",  text: "text-orange-600" },
  design: { bg: "bg-pink-500/10",    text: "text-pink-600" },
  other:  { bg: "bg-yellow-500/10",  text: "text-yellow-600" },
};

function categoryBadge(cat: string) {
  const style = CATEGORY_STYLE[cat] ?? { bg: "bg-[#0047FF]/8", text: "text-[#0047FF]" };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
      {cat || "Без категории"}
    </span>
  );
}

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

  /* ── Filter ──────────────────────────────────────────── */
  const query = search.toLowerCase().trim();
  const filtered = query
    ? tests.filter(
        (t) =>
          t.title.toLowerCase().includes(query) ||
          t.description.toLowerCase().includes(query) ||
          t.category.toLowerCase().includes(query) ||
          t.instructor_name.toLowerCase().includes(query),
      )
    : tests;

  /* ── Render ──────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-[#F5F3EE]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-28 pb-16">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#1A1A1A] tracking-tight">
              Тесты
            </h1>
            <p className="text-[#6B6B6B] mt-1 text-sm sm:text-base">
              Проверьте свои знания с помощью интерактивных тестов
            </p>
          </div>

          {isInstructor && (
            <button
              onClick={handleCreate}
              disabled={creating}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0047FF] text-white text-sm font-medium
                         hover:bg-[#0038CC] active:scale-[0.97] transition-all disabled:opacity-60 disabled:cursor-not-allowed
                         shadow-sm shadow-[#0047FF]/20"
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

        {/* Search bar */}
        <div className="relative mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[#A0A0A0] pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по названию, описанию или категории..."
            className="w-full pl-11 pr-4 py-3 rounded-xl bg-white border border-[#E8E5DF] text-sm text-[#1A1A1A]
                       placeholder:text-[#A0A0A0] focus:outline-none focus:ring-2 focus:ring-[#0047FF]/20 focus:border-[#0047FF]
                       transition-shadow"
          />
        </div>

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
              {search ? "Ничего не найдено" : "Тесты пока не добавлены"}
            </h2>
            <p className="text-sm text-[#6B6B6B] max-w-xs">
              {search
                ? "Попробуйте изменить запрос поиска"
                : "Скоро здесь появятся интерактивные тесты для проверки знаний"}
            </p>
          </div>
        )}

        {/* Test cards grid */}
        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((test) => (
              <Link
                key={test.id}
                to={`/study/${test.id}`}
                className="group bg-white border border-[#E8E5DF] rounded-2xl p-5 flex flex-col
                           hover:border-[#0047FF]/30 hover:shadow-lg hover:shadow-[#0047FF]/5
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
                {test.description && (
                  <p className="text-sm text-[#6B6B6B] leading-relaxed line-clamp-2 mb-auto">
                    {test.description}
                  </p>
                )}

                {/* Footer: instructor */}
                <div className="flex items-center gap-2 pt-4 mt-4 border-t border-[#F0EEE9]">
                  <div className="w-6 h-6 rounded-full bg-[#F0EEE9] flex items-center justify-center">
                    <User className="w-3.5 h-3.5 text-[#8A8A8A]" />
                  </div>
                  <span className="text-xs text-[#6B6B6B] truncate">
                    {test.instructor_name}
                  </span>
                </div>
              </Link>
            ))}
          </div>
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
