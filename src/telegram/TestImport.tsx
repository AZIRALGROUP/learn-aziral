import { useState } from 'react';
import { Upload } from 'lucide-react';
import type { Question } from './api';
export function TestImport({ onImport, onSource }: { onImport: (title: string, questions: Question[]) => void; onSource: (text: string) => void }) {
  const [error,setError] = useState('');
  return <section className="tg-ai-panel"><p className="tg-small">JSON с вопросами — готовый тест. TXT с материалом — основа для ИИ.</p><label className="tg-secondary tg-file-input"><Upload size={16} aria-hidden="true" />Выбрать файл<input type="file" accept=".json,.txt,application/json,text/plain" onChange={e => {
    const file = e.target.files?.[0]; setError('');
    if (!file) return;
    if (file.size > 120000) { setError('Файл должен быть меньше 120 КБ'); return; }
    void file.text().then(text => {
      if (file.name.toLowerCase().endsWith('.txt')) {
        if (text.length > 12000) throw new Error('Для ИИ нужно до 12 000 символов');
        onSource(text); return;
      }
      let parsed;
      try { parsed = JSON.parse(text); } catch { throw new Error('Не удалось прочитать JSON. Проверь формат файла'); }
      if (!parsed || typeof parsed !== 'object') throw new Error('В JSON нужен объект с вопросами или массив');
      const rows = Array.isArray(parsed) ? parsed : parsed.questions;
      if (!Array.isArray(rows) || !rows.length || rows.length > 30) throw new Error('В JSON нужен массив questions: от 1 до 30 вопросов');
      const questions = rows.map(q => {
        if (!q || typeof q !== 'object') throw new Error('Каждый вопрос должен содержать question, options и correct');
        const correct = Array.isArray(q.correct) && q.correct.length === 1 ? q.correct[0] : q.correct;
        if (typeof q.question !== 'string' || !Array.isArray(q.options) || q.options.length < 2 || q.options.length > 6 || q.options.some((o: unknown) => typeof o !== 'string') || !Number.isInteger(correct) || correct < 0 || correct >= q.options.length) throw new Error('Нужны question, options и correct — номер верного ответа от 0');
        return { question: q.question, options: q.options, correct, explanation: typeof q.explanation === 'string' ? q.explanation : '' };
      });
      onImport(typeof parsed.title === 'string' ? parsed.title.slice(0,160) : file.name.replace(/\.json$/i,''), questions);
    }).catch(e => setError(e instanceof Error ? e.message : 'Не удалось прочитать файл'));
  }} /></label><details className="tg-fold"><summary>Формат JSON</summary><pre>{'{"title":"Мой тест","questions":[{"question":"2 + 2?","options":["3","4"],"correct":1}]}'}</pre></details>{error && <p role="alert" className="tg-incorrect">{error}</p>}</section>;
}
