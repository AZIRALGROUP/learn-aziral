// Shared level configuration used across CoursesPage and CourseDetailPage
export const LEVEL_CONFIG: Record<string, { label: string; color: string; bgClass: string; borderClass: string }> = {
  beginner:     { label: "Начинающий",  color: "text-green-400",  bgClass: "bg-green-500/10",  borderClass: "border-green-500/20" },
  intermediate: { label: "Средний",     color: "text-yellow-400", bgClass: "bg-yellow-500/10", borderClass: "border-yellow-500/20" },
  advanced:     { label: "Продвинутый", color: "text-red-400",    bgClass: "bg-red-500/10",    borderClass: "border-red-500/20" },
};

// Course categories
export const COURSE_CATEGORIES = [
  { value: "web",    label: "Веб-разработка",      emoji: "🌐" },
  { value: "mobile", label: "Мобильная разработка", emoji: "📱" },
  { value: "devops", label: "DevOps & Cloud",       emoji: "⚙️" },
  { value: "design", label: "UI/UX Дизайн",         emoji: "🎨" },
  { value: "other",  label: "Другое",               emoji: "🎮" },
];
