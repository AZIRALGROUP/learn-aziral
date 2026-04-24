import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { authApi, coursesApi, notificationsApi } from '@/api/client'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function makeResponse(body: object, status = 200): Promise<Response> {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response)
}

function makeNonJsonResponse(status: number): Promise<Response> {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.reject(new SyntaxError('Unexpected token')),
  } as unknown as Response)
}

beforeEach(() => {
  mockFetch.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('request() — success path', () => {
  it('returns parsed JSON body on 2xx response', async () => {
    mockFetch.mockReturnValue(makeResponse({ id: 1, name: 'Alice', email: 'a@b.com', role: 'user', username: null, avatar: null, bio: null, notifications_enabled: 1 }))
    const data = await authApi.me()
    expect(data).toMatchObject({ id: 1, name: 'Alice' })
  })

  it('sends credentials: include on every request', async () => {
    mockFetch.mockReturnValue(makeResponse({}))
    await authApi.logout()
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ credentials: 'include' }),
    )
  })

  it('sets Content-Type: application/json header', async () => {
    mockFetch.mockReturnValue(makeResponse([]))
    await coursesApi.list()
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      }),
    )
  })

  it('sends POST body as JSON string', async () => {
    mockFetch.mockReturnValue(makeResponse({}))
    await authApi.logout()
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/auth/logout'),
      expect.objectContaining({ method: 'POST' }),
    )
  })
})

describe('request() — error handling', () => {
  it('throws an error with the message from the response body', async () => {
    mockFetch.mockReturnValue(makeResponse({ error: 'Not found' }, 404))
    await expect(authApi.me()).rejects.toThrow('Not found')
  })

  it('throws a generic HTTP error when response body has no error field', async () => {
    mockFetch.mockReturnValue(makeResponse({}, 500))
    await expect(authApi.me()).rejects.toThrow('HTTP 500')
  })

  it('does not throw on 2xx even with an error field present in body', async () => {
    mockFetch.mockReturnValue(makeResponse({ error: 'ignore me' }, 200))
    await expect(authApi.me()).resolves.toBeDefined()
  })

  it('handles non-JSON response body gracefully and falls back to HTTP status message', async () => {
    mockFetch.mockReturnValue(makeNonJsonResponse(502))
    await expect(authApi.me()).rejects.toThrow('HTTP 502')
  })

  it('propagates network-level errors (fetch rejection)', async () => {
    mockFetch.mockReturnValue(Promise.reject(new Error('Network failure')))
    await expect(authApi.me()).rejects.toThrow('Network failure')
  })
})

describe('request() — ban detection', () => {
  it('dispatches azr:banned event on 403 with the exact ban message', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
    mockFetch.mockReturnValue(makeResponse({ error: 'Аккаунт заблокирован' }, 403))
    await expect(authApi.me()).rejects.toThrow('Аккаунт заблокирован')
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'azr:banned' }),
    )
  })

  it('does NOT dispatch azr:banned for a generic 403 error', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
    mockFetch.mockReturnValue(makeResponse({ error: 'Forbidden' }, 403))
    await expect(authApi.me()).rejects.toThrow('Forbidden')
    expect(dispatchSpy).not.toHaveBeenCalled()
  })

  it('does NOT dispatch azr:banned for a 401 response', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
    mockFetch.mockReturnValue(makeResponse({ error: 'Аккаунт заблокирован' }, 401))
    await expect(authApi.me()).rejects.toThrow()
    expect(dispatchSpy).not.toHaveBeenCalled()
  })
})

describe('authApi endpoints', () => {
  it('me() calls GET /api/auth/me', async () => {
    mockFetch.mockReturnValue(makeResponse({}))
    await authApi.me().catch(() => {})
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/me'),
      expect.objectContaining({}),
    )
  })

  it('logout() calls POST /api/auth/logout', async () => {
    mockFetch.mockReturnValue(makeResponse({}))
    await authApi.logout()
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/logout'),
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('checkUsername() percent-encodes the username in the query string', async () => {
    mockFetch.mockReturnValue(makeResponse({ available: true }))
    await authApi.checkUsername('hello world')
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('hello%20world'),
      expect.any(Object),
    )
  })
})

describe('notificationsApi endpoints', () => {
  it('markRead() calls PATCH /api/profile/notifications/:id/read', async () => {
    mockFetch.mockReturnValue(makeResponse({}))
    await notificationsApi.markRead(42)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/profile/notifications/42/read'),
      expect.objectContaining({ method: 'PATCH' }),
    )
  })

  it('markAllRead() calls PATCH /api/profile/notifications/read-all', async () => {
    mockFetch.mockReturnValue(makeResponse({}))
    await notificationsApi.markAllRead()
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/profile/notifications/read-all'),
      expect.objectContaining({ method: 'PATCH' }),
    )
  })
})
