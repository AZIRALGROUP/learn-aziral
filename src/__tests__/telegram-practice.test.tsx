import { createRef } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PracticeSession } from '../telegram/PracticeSession';
import { telegramApi } from '../telegram/api';
import type { Attempt } from '../telegram/api';

vi.mock('../telegram/api', () => ({ telegramApi: vi.fn() }));
const api = vi.mocked(telegramApi);
const attempt: Attempt = { id: 'attempt1', testId: 'test1', title: 'Тренировка', questions: [
  { question: 'Первый вопрос', options: ['Да', 'Нет'] }, { question: 'Второй вопрос', options: ['Один', 'Два'] },
], answers: [null,null], questionIndex: 0, revision: 0 };
function renderPractice(a = attempt) {
  const onLeave = vi.fn(); const onResult = vi.fn();
  const exitRef = createRef<(() => void) | null>();
  render(<PracticeSession attempt={a} onLeave={onLeave} onResult={onResult} exitRef={exitRef} />);
  return { onLeave, onResult, exitRef };
}
beforeEach(() => { api.mockReset(); });

describe('saved Telegram practice', () => {
  it('serializes rapid changes and saves the latest answer and position before leaving', async () => {
    const user = userEvent.setup();
    let release: (value: { revision: number }) => void = () => {};
    api.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    api.mockResolvedValueOnce({ revision: 2 });
    const { onLeave } = renderPractice();
    await user.click(screen.getByRole('button', { name: 'Да', exact: true }));
    await user.click(screen.getByRole('button', { name: 'Дальше' }));
    expect(api).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Сохранить и выйти' }));
    expect(onLeave).not.toHaveBeenCalled();
    await act(async () => { release({ revision: 1 }); });
    await waitFor(() => expect(onLeave).toHaveBeenCalledOnce());
    expect(api).toHaveBeenNthCalledWith(2, '/attempts/attempt1/save', 'PUT', { answers: [0,null], questionIndex: 1, revision: 1 });
  });
  it('keeps answers visible after a failed save and retries before leaving', async () => {
    const user = userEvent.setup();
    api.mockRejectedValueOnce(new Error('Нет соединения'));
    const { onLeave } = renderPractice();
    await user.click(screen.getByRole('button', { name: 'Нет', exact: true }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Нет соединения');
    expect(screen.getByRole('button', { name: 'Нет', exact: true })).toHaveAttribute('aria-pressed', 'true');
    expect(onLeave).not.toHaveBeenCalled();
    api.mockResolvedValueOnce({ revision: 1 });
    await user.click(screen.getByRole('button', { name: 'Сохранить и выйти' }));
    await waitFor(() => expect(onLeave).toHaveBeenCalledOnce());
    expect(api).toHaveBeenLastCalledWith('/attempts/attempt1/save', 'PUT', { answers: [1,null], questionIndex: 0, revision: 0 });
  });
  it('resumes on the saved question and asks before submitting skipped questions', async () => {
    const user = userEvent.setup();
    const result = { correct: 1, total: 2, review: [] };
    api.mockResolvedValue(result);
    const { onResult } = renderPractice({ ...attempt, answers: [0,null], questionIndex: 1, revision: 3 });
    expect(screen.getByRole('heading', { name: 'Второй вопрос' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Завершить тест' }));
    expect(api).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Подтверждение завершения')).toHaveTextContent('Без ответа: 1 из 2');
    await user.click(screen.getByRole('button', { name: 'Завершить сейчас' }));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(result));
    expect(api).toHaveBeenCalledWith('/attempts/attempt1/submit', 'POST', { answers: [0,null] });
  });
});
