import { ApiError } from './auth.mjs';
import { newId, publicQuestions, prepareQuestions, validAnswer, grade, accessible } from './store.mjs';
import { isSiteId, isLessonId } from './site.mjs';

export function createAttempt(db, userId, testId, title, questions, now) {
  const id = newId();
  const snapshot = prepareQuestions(questions);
  const answers = snapshot.map(q => q.type === 'order' ? q.options.map((_, i) => i) : null);
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('INSERT INTO attempts (id,user_id,test_id,snapshot) VALUES (?,?,?,?)').run(id, userId, testId, JSON.stringify(snapshot));
    db.prepare('INSERT INTO attempt_details (attempt_id,title,created,updated,answers) VALUES (?,?,?,?,?)').run(id, title, now, now, JSON.stringify(answers));
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  return { id, testId, title, questions: publicQuestions(snapshot), answers, questionIndex: 0, revision: 0 };
}

export function learningSummary(db, userId, now) {
  const stats = db.prepare(`SELECT COUNT(*) AS completed, COALESCE(SUM(json_extract(result,'$.correct')),0) AS correct, COALESCE(SUM(json_extract(result,'$.total')),0) AS total FROM attempts WHERE user_id=? AND result IS NOT NULL`).get(userId);
  stats.lessons = db.prepare('SELECT COUNT(*) AS n FROM progress WHERE user_id=?').get(userId).n;
  stats.duels = db.prepare('SELECT COUNT(*) AS n FROM duels WHERE (host=? OR guest=?) AND start_at IS NOT NULL AND start_at + json_array_length(snapshot)*15000 <= ?').get(userId, userId, now).n;
  const fields = `a.id,a.test_id AS testId,COALESCE(d.title,t.title,'Тренировка') AS title,d.updated AS updated,json_array_length(a.snapshot) AS total`;
  const joins = 'FROM attempts a LEFT JOIN attempt_details d ON d.attempt_id=a.id LEFT JOIN tests t ON t.id=a.test_id';
  const active = db.prepare(`SELECT ${fields},d.answers ${joins} WHERE a.user_id=? AND a.result IS NULL AND d.answers IS NOT NULL ORDER BY d.updated DESC,a.rowid DESC LIMIT 5`).all(userId);
  const recent = db.prepare(`SELECT ${fields},json_extract(a.result,'$.correct') AS correct ${joins} WHERE a.user_id=? AND a.result IS NOT NULL ORDER BY COALESCE(d.updated,0) DESC,a.rowid DESC LIMIT 20`).all(userId);
  return { stats,
    active: active.map(({ answers, ...r }) => ({ ...r, answered: JSON.parse(answers).filter(a => a !== null && (!Array.isArray(a) || a.length > 0)).length })),
    recent,
  };
}

export async function handleAttempt({ db, site, userId, id, action, method, body, now }) {
  const a = db.prepare('SELECT a.*,d.title,d.answers,d.question_index,d.revision FROM attempts a LEFT JOIN attempt_details d ON d.attempt_id=a.id WHERE a.id=? AND a.user_id=?').get(id, userId);
  if (!a) throw new ApiError(404, 'Попытка не найдена');
  // Recheck paid access before exposing a stored lesson or its answer key.
  if (isSiteId(a.test_id) || isLessonId(a.test_id)) {
    if (!site) throw new ApiError(503, 'Сайт временно недоступен');
    await site.test(userId, a.test_id);
  } else accessible(db, 'tests', a.test_id, userId);
  const snapshot = JSON.parse(a.snapshot);
  if (!action && method === 'GET') return {
    id, testId: a.test_id, title: a.title || 'Тренировка', questions: publicQuestions(snapshot),
    answers: a.answers ? JSON.parse(a.answers) : snapshot.map(() => null), questionIndex: a.question_index || 0, revision: a.revision || 0,
    ...(a.result ? { result: JSON.parse(a.result) } : {}),
  };
  if (action === 'save' && method === 'PUT') {
    if (a.result) throw new ApiError(409, 'Тренировка уже завершена. Открой результат в прогрессе');
    if (!a.answers) throw new ApiError(409, 'Начни новую тренировку');
    const { answers, questionIndex, revision } = body;
    if (!Array.isArray(answers) || answers.length !== snapshot.length || answers.some((answer, i) => !validAnswer(snapshot[i], answer)) || !Number.isInteger(questionIndex) || questionIndex < 0 || questionIndex >= snapshot.length || !Number.isSafeInteger(revision) || revision < 0) throw new ApiError(400, 'Некорректные ответы или номер вопроса');
    const saved = db.prepare('UPDATE attempt_details SET answers=?,question_index=?,updated=?,revision=revision+1 WHERE attempt_id=? AND revision=? AND EXISTS(SELECT 1 FROM attempts WHERE id=? AND result IS NULL)').run(JSON.stringify(answers), questionIndex, now, id, revision, id);
    if (!saved.changes) throw new ApiError(409, 'Тренировка изменена в другом окне. Вернись в прогресс и открой её заново');
    return { revision: revision + 1 };
  }
  if (action === 'submit' && method === 'POST') {
    if (a.result) return JSON.parse(a.result);
    const result = grade(snapshot, body.answers);
    const saved = db.prepare('UPDATE attempts SET result=? WHERE id=? AND result IS NULL').run(JSON.stringify(result), id);
    if (!saved.changes) return JSON.parse(db.prepare('SELECT result FROM attempts WHERE id=?').get(id).result);
    db.prepare('UPDATE attempt_details SET updated=? WHERE attempt_id=?').run(now, id);
    return result;
  }
  if (action === 'retry' && method === 'POST') {
    if (!a.result) throw new ApiError(400, 'Сначала заверши тренировку');
    if (!['all', 'errors'].includes(body.mode)) throw new ApiError(400, 'Выбери режим повторения');
    const questions = body.mode === 'errors' ? JSON.parse(a.result).review.filter(q => !q.isCorrect).map(({ answer, isCorrect, ...q }) => q) : snapshot;
    if (!questions.length) throw new ApiError(400, 'Все ответы верные — ошибок для повторения нет');
    return createAttempt(db, userId, a.test_id, a.title || 'Тренировка', questions, now);
  }
  throw new ApiError(404, 'Маршрут не найден');
}
