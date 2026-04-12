/**
 * API client for learn.aziral.com
 * Auth is cookie-based SSO — no localStorage needed.
 * In dev: Vite proxy handles /api → localhost:3001
 * In prod: VITE_API_BASE_URL=https://aziral.com
 */

const BASE = `${import.meta.env.VITE_API_BASE_URL || ''}/api`;

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: 'include', // SSO cookie
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (data as { error?: string }).error || `HTTP ${res.status}`;
    if (res.status === 403 && message === 'Аккаунт заблокирован') {
      window.dispatchEvent(new Event('azr:banned'));
    }
    throw new Error(message);
  }
  return data as T;
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  me: () => request<{ id: number; name: string; email: string; role: string }>('/auth/me'),
  logout: () => request('/auth/logout', { method: 'POST' }),
  updateMe: (payload: object) => request('/auth/me', { method: 'PATCH', body: JSON.stringify(payload) }),
};

// ── Courses ───────────────────────────────────────────────────────────────────
export const coursesApi = {
  list: (params?: Record<string, string>) =>
    request<object[]>(`/courses?${new URLSearchParams(params)}`),
  get: (id: number | string) => request<object>(`/courses/${id}`),
  lessons: (id: number | string) => request<object[]>(`/courses/${id}/lessons`),
  enroll: (id: number | string) => request(`/courses/${id}/enroll`, { method: 'POST' }),
  rate: (id: number | string, rating: number) =>
    request(`/courses/${id}/rating`, { method: 'POST', body: JSON.stringify({ rating }) }),
  create: (payload: object) => request<object>('/courses', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id: number | string, payload: object) =>
    request(`/courses/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  delete: (id: number | string) => request(`/courses/${id}`, { method: 'DELETE' }),
};

// ── Lessons ───────────────────────────────────────────────────────────────────
export const lessonsApi = {
  get: (id: number | string) => request<object>(`/lessons/${id}`),
  complete: (id: number | string) => request(`/lessons/${id}/complete`, { method: 'POST' }),
  submitQuiz: (id: number | string, answers: object) =>
    request(`/lessons/${id}/quiz/submit`, { method: 'POST', body: JSON.stringify(answers) }),
};

// ── Enrollments ───────────────────────────────────────────────────────────────
export const enrollmentsApi = {
  mine: () => request<object[]>('/my-enrollments'),
  myCourses: () => request<object[]>('/profile/courses'),
  myXp: () => request<{ total_xp: number }>('/profile/xp'),
};

// ── Instructor ────────────────────────────────────────────────────────────────
export const instructorApi = {
  courses: () => request<object[]>('/instructor/courses'),
  earnings: () => request<object>('/instructor/earnings'),
  apply: (payload: object) => request('/instructor/apply', { method: 'POST', body: JSON.stringify(payload) }),
  applicationStatus: () => request<object>('/instructor/apply'),
  getLessons: (courseId: number | string) =>
    request<object[]>(`/instructor/courses/${courseId}/lessons`),
  createLesson: (courseId: number | string, payload: object) =>
    request(`/instructor/courses/${courseId}/lessons`, { method: 'POST', body: JSON.stringify(payload) }),
  updateLesson: (lessonId: number | string, payload: object) =>
    request(`/instructor/lessons/${lessonId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteLesson: (lessonId: number | string) =>
    request(`/instructor/lessons/${lessonId}`, { method: 'DELETE' }),
  reorderLessons: (courseId: number | string, order: object) =>
    request(`/instructor/courses/${courseId}/reorder-lessons`, { method: 'PATCH', body: JSON.stringify(order) }),
  getQuizzes: (lessonId: number | string) =>
    request<object[]>(`/instructor/lessons/${lessonId}/quizzes`),
  createQuiz: (lessonId: number | string, payload: object) =>
    request(`/instructor/lessons/${lessonId}/quizzes`, { method: 'POST', body: JSON.stringify(payload) }),
  updateQuiz: (quizId: number | string, payload: object) =>
    request(`/instructor/quizzes/${quizId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteQuiz: (quizId: number | string) =>
    request(`/instructor/quizzes/${quizId}`, { method: 'DELETE' }),
};

// ── Notifications ─────────────────────────────────────────────────────────────
export const notificationsApi = {
  myList: () => request<object[]>('/profile/notifications'),
  unreadCount: () => request<{ count: number }>('/profile/notifications/unread-count'),
  markRead: (id: number) => request(`/profile/notifications/${id}/read`, { method: 'PATCH' }),
  markAllRead: () => request('/profile/notifications/read-all', { method: 'PATCH' }),
};
