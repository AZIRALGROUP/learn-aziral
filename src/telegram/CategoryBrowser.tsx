import { Atom, Clapperboard, Gamepad2, Globe2, GraduationCap, Medal, Music2, Shuffle, ArrowLeft } from 'lucide-react';
import { categories, categoryLabel } from './categories';
const icons = { Atom, Clapperboard, Gamepad2, Globe2, GraduationCap, Medal, Music2, Shuffle };
export function CategoryBrowser({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  if (value) return <div className="tg-category-path"><button className="tg-secondary" onClick={() => onChange('')}><ArrowLeft size={16} aria-hidden="true" />Все категории</button><strong>{categoryLabel(value)}</strong></div>;
  return <div className="tg-category-grid" aria-label="Категории тестов">{categories.map(c => {
    const Icon = icons[c.icon];
    return <button key={c.id} className={`tg-category tg-category-${c.id}`} onClick={() => onChange(c.id)}><Icon size={23} aria-hidden="true" /><span><strong>{c.label}</strong><small>{c.hint}</small></span></button>;
  })}</div>;
}
