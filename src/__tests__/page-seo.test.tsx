import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { usePageTitle, isPrivateLearningPath } from '@/app/hooks/usePageTitle';

function Page() {
  usePageTitle('Курс');
  const navigate = useNavigate();
  return <button onClick={() => navigate('/courses/2?utm_source=test')}>Другой курс</button>;
}

describe('Learn page metadata', () => {
  it('uses the Learn origin and follows route changes even when the title is unchanged', () => {
    render(<MemoryRouter initialEntries={['/courses/1?utm_source=test']}><Page /></MemoryRouter>);
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://learn.aziral.com/courses/1');
    fireEvent.click(screen.getByText('Другой курс'));
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://learn.aziral.com/courses/2');
    expect(document.title).toBe('Курс | AZIRAL Learn');
  });

  it.each(['/instructor', '/instructor/tests/4/build', '/profile', '/practice/123', '/courses/2/learn/3'])('excludes a private page: %s', path => {
    expect(isPrivateLearningPath(path)).toBe(true);
  });
  it.each(['/', '/study', '/study/5', '/courses/1', '/instructor-guide'])('keeps public pages indexable: %s', path => {
    expect(isPrivateLearningPath(path)).toBe(false);
  });
  it('sets noindex on a private route', () => {
    render(<MemoryRouter initialEntries={['/instructor']}><Page /></MemoryRouter>);
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex, nofollow');
  });
});
