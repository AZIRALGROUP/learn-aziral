import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { QuestionChoices } from '../telegram/QuestionChoices';
import type { Answer, PublicQuestion } from '../telegram/api';

function Harness({ question }: { question: PublicQuestion }) {
  const [value, setValue] = useState<Answer>(null);
  return <><QuestionChoices question={question} value={value} onChange={setValue} /><output aria-label="Выбранные ответы">{JSON.stringify(value)}</output></>;
}

describe('Telegram question controls', () => {
  it('retains multiple selected answers and lets the user deselect one', async () => {
    const user = userEvent.setup();
    render(<Harness question={{ question: 'Выбери два', type: 'multi', options: ['Первый', 'Второй', 'Третий'] }} />);
    await user.click(screen.getByRole('button', { name: 'Первый' }));
    await user.click(screen.getByRole('button', { name: 'Третий' }));
    expect(screen.getByLabelText('Выбранные ответы').textContent).toBe('[0,2]');
    await user.click(screen.getByRole('button', { name: 'Первый' }));
    expect(screen.getByLabelText('Выбранные ответы').textContent).toBe('[2]');
  });
  it('reorders items with named keyboard-accessible controls without changing the option identities', async () => {
    const user = userEvent.setup();
    render(<Harness question={{ question: 'Порядок', type: 'order', options: ['Второй', 'Первый', 'Третий'] }} />);
    expect(screen.getByRole('button', { name: 'Поднять пункт 1' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Поднять пункт 2' }));
    expect(screen.getByLabelText('Выбранные ответы').textContent).toBe('[1,0,2]');
  });
});
