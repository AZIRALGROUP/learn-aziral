import { ArrowDown, ArrowUp, Check } from 'lucide-react';
import type { Answer, PublicQuestion } from './api';

export function QuestionChoices({ question, value, onChange, disabled = false }: {
  question: PublicQuestion; value: Answer; onChange: (answer: Answer) => void; disabled?: boolean;
}) {
  if (question.type === 'order') {
    const order = Array.isArray(value) ? value : question.options.map((_, i) => i);
    function move(position: number, delta: number) {
      const next = [...order];
      [next[position], next[position + delta]] = [next[position + delta], next[position]];
      onChange(next);
    }
    return <div className="tg-choices"><p className="tg-small">Расположи пункты по порядку. Используй кнопки вверх и вниз.</p>{order.map((option, position) => <div className="tg-order-option" key={option}><span>{position + 1}. {question.options[option]}</span><button className="tg-icon-button" disabled={disabled || position === 0} aria-label={`Поднять пункт ${position + 1}`} onClick={() => move(position, -1)}><ArrowUp size={18} aria-hidden="true" /></button><button className="tg-icon-button" disabled={disabled || position === order.length - 1} aria-label={`Опустить пункт ${position + 1}`} onClick={() => move(position, 1)}><ArrowDown size={18} aria-hidden="true" /></button></div>)}</div>;
  }
  const multi = question.type === 'multi';
  return <div className="tg-choices">{multi && <p className="tg-small">Выбери все правильные варианты.</p>}{question.options.map((option, i) => {
    const selected = multi ? Array.isArray(value) && value.includes(i) : value === i;
    return <button key={i} disabled={disabled} className={selected ? 'tg-choice tg-choice-selected' : 'tg-choice'} aria-pressed={selected} onClick={() => {
      if (!multi) return onChange(i);
      const chosen = Array.isArray(value) ? value : [];
      onChange(selected ? chosen.filter(v => v !== i) : [...chosen, i]);
    }}><span aria-hidden="true">{selected && multi ? <Check size={16} aria-hidden="true" /> : String.fromCharCode(65 + i)}</span>{option}</button>;
  })}</div>;
}
