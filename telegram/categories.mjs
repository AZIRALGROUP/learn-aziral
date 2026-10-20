import { ApiError } from './auth.mjs';
export const categoryIds = ['study', 'games', 'movies', 'science', 'world', 'music', 'sport', 'mixed'];
export function validateCategory(value = 'study') {
  if (!categoryIds.includes(value)) throw new ApiError(400, 'Выберите категорию теста');
  return value;
}
export function testCategory(db, id) {
  return db.prepare('SELECT category FROM test_categories WHERE test_id=?').get(id)?.category || 'study';
}
