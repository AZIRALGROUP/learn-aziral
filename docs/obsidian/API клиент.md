---
title: API клиент
tags: [api, сеть, проект/learn-aziral]
created: 2026-08-02
---

# API клиент

Часть проекта [[learn-aziral]]. Файл: `src/api/client.ts` (145 строк).

## Базовый механизм

```ts
const BASE = `${import.meta.env.VITE_API_BASE_URL || ''}/api`;
```

В проде переменная пустая → путь относительный `/api`, и его проксирует nginx.
В деве работает прокси Vite на `localhost:3001`. См. [[Инфраструктура и деплой]].

Функция `request<T>()` делает три вещи и делает их в одном месте:
1. подставляет `credentials: 'include'` — без этого не уйдёт SSO-кука;
2. ставит `Content-Type: application/json`;
3. разворачивает ошибку: берёт `data.error`, иначе `HTTP <код>`; ловит бан.

> [!danger] Не обходи `request()`
> Прямой `fetch` теряет куку и обработку ошибок. В коде есть исключения
> (`ProfilePage.tsx:177`, генерация вопросов в `TestBuilderPage.tsx:671`) —
> это технический долг, а не образец.

## Группы эндпоинтов

### `authApi`
| Метод | Запрос |
|---|---|
| `me()` | `GET /auth/me` |
| `logout()` | `POST /auth/logout` |
| `updateMe(payload)` | `PATCH /auth/me` |
| `checkUsername(u)` | `GET /auth/check-username` |

### `coursesApi`
`list` · `get` · `lessons` · `enroll` · `rate` · `create` · `update` · `delete`
→ `/courses`, `/courses/:id/lessons`, `/courses/:id/enroll`, `/courses/:id/rating`

### `lessonsApi`
`get` · `complete` (`POST /lessons/:id/complete`) · `submitQuiz`

### `enrollmentsApi`
`mine` → `/my-enrollments` · `myCourses` → `/profile/courses` · `myXp` → `/profile/xp`

### `instructorApi`
Самая большая группа: курсы, заявка на статус инструктора (`apply`),
доходы (`earnings`), CRUD уроков, `reorderLessons`, CRUD квизов внутри уроков.

### `testsApi`
Отдельная система тестов — см. [[Домен Тесты]]. Публичные `list`/`get`
и инструкторские: CRUD, `togglePublish`, работа с вопросами, `importQuestions`.

### `notificationsApi`
`myList` · `unreadCount` · `markRead` · `markAllRead`

## Типизация

Только домен тестов типизирован по-настоящему — `TestSummary`, `TestQuestion`,
`TestWithQuestions` (`client.ts:100-111`). Остальные методы возвращают
`object` / `object[]`.

> [!todo] Направление улучшения
> Расширять типы на курсы, уроки, записи. Сейчас страницы приводят типы
> у себя, и это расползается.

Связано: [[Аутентификация SSO]], [[Тестирование и качество]].
