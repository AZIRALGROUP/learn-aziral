import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import TelegramApp from '../telegram/TelegramApp';
import { telegramApi } from '../telegram/api';

vi.mock('../telegram/api', async original => ({ ...await original<typeof import('../telegram/api')>(), loadTelegram: vi.fn().mockResolvedValue(undefined), telegramApi: vi.fn() }));
afterEach(() => { vi.restoreAllMocks(); });
it('returns from a lesson quiz result to the same course lesson', async () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  vi.mocked(telegramApi).mockImplementation(async path => {
    if (path === '/me') return { user: { id: '1', name: 'Ученик' }, dev: true, botUsername: 'Test', aiAvailable: false };
    if (path === '/learning') return { stats: { completed: 0, total: 0, correct: 0, lessons: 0, duels: 0 }, active: [], recent: [] };
    if (path.startsWith('/tests?')) return [];
    if (path.startsWith('/courses?')) return [{ id: 'site-1', title: 'Курс физики', count: 1, mine: false, published: true }];
    if (path === '/courses/site-1') return { id: 'site-1', title: 'Курс физики', completed: [], lessons: [{ id: 21, title: 'Сила тяжести', content: 'Материал урока', quizCount: 1 }] };
    if (path === '/tests/lesson-21/attempts') return { id: 'a1', title: 'Тест урока', testId: 'lesson-21', questions: [{ question: 'Верный ответ?', options: ['Первый', 'Второй'] }], answers: [null], questionIndex: 0, revision: 0 };
    if (path === '/attempts/a1/save') return { revision: 1 };
    if (path === '/attempts/a1/submit') return { correct: 1, total: 1, review: [] };
    throw new Error('Unexpected route');
  });
  const user = userEvent.setup(); render(<TelegramApp />);
  await user.click(await screen.findByRole('button', { name: 'Курсы', exact: true }));
  await user.click(await screen.findByRole('button', { name: 'Учиться', exact: true }));
  await user.click(await screen.findByRole('button', { name: 'Тест к этому уроку' }));
  await user.click(await screen.findByRole('button', { name: 'Первый', exact: true }));
  await user.click(screen.getByRole('button', { name: 'Завершить тест' }));
  await user.click(await screen.findByRole('button', { name: 'Вернуться к уроку' }));
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Сила тяжести' })).toBeInTheDocument());
  expect(screen.getByText('Материал урока')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Тренироваться' })).not.toBeInTheDocument();
});
