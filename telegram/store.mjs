import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID, randomInt } from 'node:crypto';
import { ApiError } from './auth.mjs';

export function openStore(filename = 'telegram/data/learn.sqlite') {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, username TEXT);
    CREATE TABLE IF NOT EXISTS tests (id TEXT PRIMARY KEY, owner TEXT NOT NULL, title TEXT NOT NULL, subject TEXT NOT NULL, questions TEXT NOT NULL, published INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS courses (id TEXT PRIMARY KEY, owner TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL, lessons TEXT NOT NULL, published INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS progress (user_id TEXT, course_id TEXT, lesson INTEGER, PRIMARY KEY(user_id, course_id, lesson));
    CREATE TABLE IF NOT EXISTS attempts (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, test_id TEXT NOT NULL, snapshot TEXT NOT NULL, result TEXT);
    CREATE TABLE IF NOT EXISTS attempt_details (attempt_id TEXT PRIMARY KEY REFERENCES attempts(id) ON DELETE CASCADE, title TEXT NOT NULL, created INTEGER NOT NULL, updated INTEGER NOT NULL, answers TEXT NOT NULL, question_index INTEGER NOT NULL DEFAULT 0, revision INTEGER NOT NULL DEFAULT 0);
    CREATE INDEX IF NOT EXISTS attempts_by_user ON attempts(user_id);
    CREATE TABLE IF NOT EXISTS duels (id TEXT PRIMARY KEY, test_id TEXT NOT NULL, title TEXT NOT NULL, snapshot TEXT NOT NULL, host TEXT NOT NULL, guest TEXT, created INTEGER NOT NULL, start_at INTEGER);
    CREATE TABLE IF NOT EXISTS answers (duel_id TEXT, user_id TEXT, round INTEGER, choice INTEGER NOT NULL, elapsed INTEGER NOT NULL, PRIMARY KEY(duel_id, user_id, round));
    CREATE TABLE IF NOT EXISTS ai_usage (day TEXT, user_id TEXT, count INTEGER NOT NULL, PRIMARY KEY(day, user_id));
    CREATE TABLE IF NOT EXISTS ai_cache (key TEXT PRIMARY KEY, value TEXT NOT NULL, created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS bot_updates (id INTEGER PRIMARY KEY, payload TEXT NOT NULL, sent INTEGER NOT NULL DEFAULT 0);
  `);
  return db;
}

export const newId = () => randomUUID().replaceAll('-', '');
export function text(value, name, max = 160, min = 1) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) throw new ApiError(400, `${name}: от ${min} до ${max} символов`);
  return value.trim();
}

export function validateQuestions(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 30) throw new ApiError(400, 'Добавьте от 1 до 30 вопросов');
  return value.map(q => {
    if (!q || !Array.isArray(q.options) || q.options.length < 2 || q.options.length > 6 || !Number.isInteger(q.correct) || q.correct < 0 || q.correct >= q.options.length) throw new ApiError(400, 'Укажите варианты и один правильный ответ');
    const options = q.options.map(o => text(o, 'Вариант ответа', 500));
    if (new Set(options.map(o => o.toLocaleLowerCase())).size !== options.length) throw new ApiError(400, 'Варианты ответа должны различаться');
    return { question: text(q.question, 'Вопрос', 1500), options, correct: q.correct, explanation: text(q.explanation || '', 'Объяснение', 2000, 0) };
  });
}

export function accessible(db, table, id, userId) {
  if (table !== 'tests' && table !== 'courses') throw new Error('Invalid table');
  const row = db.prepare(`SELECT * FROM ${table} WHERE id = ? AND (owner = ? OR published = 1)`).get(id, userId);
  if (!row) throw new ApiError(404, 'Материал не найден или не опубликован');
  return row;
}

export function publicQuestions(questions) {
  return questions.map(({ question, options, type }) => ({ question, options, type: type || 'single' }));
}

export function prepareQuestions(questions, limit = questions.length) {
  const copy = structuredClone(questions);
  if (copy.length > limit) {
    for (let i = copy.length - 1; i > 0; i--) { const j = randomInt(i + 1); [copy[i], copy[j]] = [copy[j], copy[i]]; }
  }
  return copy.slice(0, limit).map(q => {
    if (q.type !== 'order') return q;
    const order = q.options.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) { const j = randomInt(i + 1); [order[i], order[j]] = [order[j], order[i]]; }
    return { ...q, options: order.map(i => q.options[i]), correct: q.correct.map(i => order.indexOf(i)) };
  });
}

export function validAnswer(q, answer) {
  if (answer === null) return true;
  if (q.type === 'multi' || q.type === 'order') {
    return Array.isArray(answer) && new Set(answer).size === answer.length && answer.every(a => Number.isInteger(a) && a >= 0 && a < q.options.length) && (q.type !== 'order' || answer.length === q.options.length);
  }
  return Number.isInteger(answer) && answer >= 0 && answer < q.options.length;
}
export function answerMatches(q, answer) {
  if (answer === null) return false;
  if (q.type === 'multi') return [...answer].sort((a,b) => a-b).join(',') === [...q.correct].sort((a,b) => a-b).join(',');
  if (q.type === 'order') return answer.join(',') === q.correct.join(',');
  return answer === q.correct;
}
export const decodeChoice = value => typeof value === 'string' ? JSON.parse(value) : value;

export function grade(questions, answers) {
  if (!Array.isArray(answers) || answers.length !== questions.length || answers.some((a, i) => !validAnswer(questions[i], a))) throw new ApiError(400, 'Некорректные ответы');
  const review = questions.map((q, i) => ({ ...q, answer: answers[i], isCorrect: answerMatches(q, answers[i]) }));
  return { correct: review.filter(q => q.isCorrect).length, total: questions.length, review };
}

export function createDuel(db, testId, userId, now, sourceTest) {
  const test = sourceTest || accessible(db, 'tests', testId, userId);
  const active = db.prepare('SELECT COUNT(*) AS n FROM duels WHERE host = ? AND created > ?').get(userId, now - 3600000).n;
  if (active >= 20) throw new ApiError(429, 'Слишком много дуэлей. Попробуйте позже');
  const id = newId();
  db.prepare('INSERT INTO duels (id,test_id,title,snapshot,host,created) VALUES (?,?,?,?,?,?)').run(id, testId, test.title, JSON.stringify(prepareQuestions(JSON.parse(test.questions), 10)), userId, now);
  return id;
}

export function duelView(db, id, userId, now) {
  const d = db.prepare('SELECT * FROM duels WHERE id = ?').get(id);
  if (!d) throw new ApiError(404, 'Дуэль не найдена');
  const questions = JSON.parse(d.snapshot);
  const member = d.host === userId || d.guest === userId;
  const players = [d.host, d.guest].filter(Boolean).map(id => ({ id, name: db.prepare('SELECT name FROM users WHERE id = ?').get(id)?.name || 'Участник' }));
  const expired = !d.start_at && now - d.created >= 900000;
  const round = d.start_at ? Math.floor((now - d.start_at) / 15000) : -1;
  const finished = d.start_at && round >= questions.length;
  const state = expired ? 'expired' : finished ? 'finished' : !d.start_at ? 'waiting' : round < 0 ? 'countdown' : 'playing';
  const base = { id, title: d.title, state, players, member, total: questions.length, serverNow: now, startAt: d.start_at, round, endsAt: d.start_at ? d.start_at + (round + 1) * 15000 : null };
  if (!member) return { ...base, round: -1, endsAt: null };
  if (state === 'playing') {
    const answer = db.prepare('SELECT choice FROM answers WHERE duel_id = ? AND user_id = ? AND round = ?').get(id, userId, round);
    return { ...base, question: publicQuestions([questions[round]])[0], answer: answer ? decodeChoice(answer.choice) : null };
  }
  if (state === 'finished') {
    return { ...base, results: players.map(p => {
      const answers = db.prepare('SELECT * FROM answers WHERE duel_id = ? AND user_id = ?').all(id, p.id);
      let correct = 0, score = 0;
      for (const a of answers) if (answerMatches(questions[a.round], decodeChoice(a.choice))) { correct++; score += 1000 + Math.floor((15000 - a.elapsed) / 100); }
      return { ...p, correct, score };
    }).sort((a, b) => b.score - a.score), review: questions };
  }
  return base;
}
