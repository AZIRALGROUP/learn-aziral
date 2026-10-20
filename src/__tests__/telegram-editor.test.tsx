import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import TelegramApp from '../telegram/TelegramApp';
import { telegramApi } from '../telegram/api';

vi.mock('../telegram/api', async original => ({ ...await original<typeof import('../telegram/api')>(), loadTelegram: vi.fn().mockResolvedValue(undefined), telegramApi: vi.fn() }));
const api = vi.mocked(telegramApi);
beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  api.mockReset();
  api.mockImplementation(async path => {
    if (path === '/me') return { user: { id: '1', name: 'Ученик' }, dev: true, botUsername: 'Test', aiAvailable: false };
    if (path === '/learning') return { stats: { completed: 0, total: 0, correct: 0, lessons: 0, duels: 0 }, active: [], recent: [] };
    if (path.startsWith('/tests?') || path.startsWith('/courses?')) return [];
    if (path === '/tests' || path === '/courses') return { id: 'saved' };
    throw new Error('Unexpected route');
  });
});
afterEach(() => { vi.restoreAllMocks(); });

it('keeps collapsed question values, reveals the first invalid question and saves the whole draft', async () => {
  const user = userEvent.setup(); render(<TelegramApp />);
  await user.click(await screen.findByRole('button', { name: 'Создать тест', exact: true }));
  await user.type(screen.getByLabelText('Название', { exact: true }), 'Тест по биологии');
  await user.type(screen.getByLabelText('Вопрос', { exact: true }), 'Первый вопрос');
  for (let n = 1; n <= 4; n++) await user.type(screen.getByLabelText(`Вариант ${n} вопроса 1`), `Ответ ${n}`);
  await user.click(screen.getByLabelText('Вариант 3 — правильный для вопроса 1'));
  await user.click(screen.getByRole('button', { name: 'Добавить вопрос' }));
  expect(screen.getByLabelText('Вариант 1 вопроса 1')).not.toBeVisible();
  expect(screen.getByLabelText('Вариант 1 вопроса 1')).toHaveValue('Ответ 1');
  await user.click(screen.getByRole('button', { name: 'Вопрос 2', exact: true }));
  await user.click(screen.getByRole('button', { name: 'Сохранить', exact: true }));
  const secondQuestion = screen.getAllByLabelText('Вопрос', { exact: true })[1];
  await waitFor(() => expect(secondQuestion).toHaveFocus());
  expect(secondQuestion).toBeVisible();
  expect(api.mock.calls.some(([path]) => path === '/tests')).toBe(false);
  await user.type(secondQuestion, 'Второй вопрос');
  for (let n = 1; n <= 4; n++) await user.type(screen.getByLabelText(`Вариант ${n} вопроса 2`), `Вариант ${n}`);
  await user.click(screen.getByRole('button', { name: 'Сохранить', exact: true }));
  await waitFor(() => expect(api).toHaveBeenCalledWith('/tests', 'POST', expect.objectContaining({ title: 'Тест по биологии', questions: [expect.objectContaining({ question: 'Первый вопрос', correct: 2, options: ['Ответ 1','Ответ 2','Ответ 3','Ответ 4'] }),expect.objectContaining({ question: 'Второй вопрос' })] })));
});

it('opens a collapsed lesson with missing content instead of submitting an incomplete course', async () => {
  const user = userEvent.setup(); render(<TelegramApp />);
  await user.click(await screen.findByRole('button', { name: 'Курсы', exact: true }));
  await user.click(screen.getByRole('button', { name: 'Создать курс', exact: true }));
  await user.type(screen.getByLabelText('Название курса'), 'Компактный курс');
  await user.type(screen.getByLabelText('Название урока'), 'Первый урок');
  await user.click(screen.getByRole('button', { name: 'Добавить урок' }));
  await user.click(screen.getByRole('button', { name: 'Сохранить', exact: true }));
  const firstContent = screen.getAllByLabelText('Материал')[0];
  await waitFor(() => expect(firstContent).toHaveFocus());
  expect(firstContent).toBeVisible();
  expect(screen.getAllByLabelText('Материал')[1]).not.toBeVisible();
  expect(api.mock.calls.some(([path]) => path === '/courses')).toBe(false);
});
