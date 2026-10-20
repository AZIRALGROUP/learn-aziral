export const categories = [
  { id: 'study', label: 'Учёба', icon: 'GraduationCap', hint: 'Предметы и экзамены' },
  { id: 'games', label: 'Игры', icon: 'Gamepad2', hint: 'Миры и персонажи' },
  { id: 'movies', label: 'Кино', icon: 'Clapperboard', hint: 'Фильмы и мультфильмы' },
  { id: 'science', label: 'Наука', icon: 'Atom', hint: 'Космос и открытия' },
  { id: 'world', label: 'Мир', icon: 'Globe2', hint: 'Страны и путешествия' },
  { id: 'music', label: 'Музыка', icon: 'Music2', hint: 'Ритмы и инструменты' },
  { id: 'sport', label: 'Спорт', icon: 'Medal', hint: 'Правила и рекорды' },
  { id: 'mixed', label: 'Микс', icon: 'Shuffle', hint: 'Всего понемногу' },
] as const;
export type Category = typeof categories[number]['id'];
export function categoryOf(item: { category?: string; subject?: string }): Category {
  return categories.some(c => c.id === item.category) ? item.category as Category : 'study';
}
export const categoryLabel = (id: string) => categories.find(c => c.id === id)?.label || 'Учёба';
