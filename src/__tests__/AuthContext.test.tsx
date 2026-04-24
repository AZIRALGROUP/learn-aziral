import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('@/api/client', () => ({
  authApi: {
    me: vi.fn(),
    logout: vi.fn(),
  },
}))

import { authApi } from '@/api/client'
import { AuthProvider, useAuth, type User } from '@/app/contexts/AuthContext'

const mockedMe = vi.mocked(authApi.me)
const mockedLogout = vi.mocked(authApi.logout)

const TEST_USER: User = {
  id: 1,
  name: 'Alice',
  email: 'alice@example.com',
  role: 'user',
  username: 'alice',
  avatar: null,
  bio: null,
  notifications_enabled: 1,
}

function TestConsumer() {
  const { user, loading, logout, updateUser } = useAuth()
  if (loading) return <div>loading</div>
  return (
    <div>
      <div data-testid="user">{user ? user.name : 'no user'}</div>
      <button onClick={logout}>logout</button>
      <button onClick={() => updateUser({ ...TEST_USER, name: 'Updated' })}>update</button>
    </div>
  )
}

function renderWithProvider() {
  return render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>,
  )
}

beforeEach(() => {
  mockedMe.mockReset()
  mockedLogout.mockReset()
  mockedLogout.mockResolvedValue({} as never)
  vi.stubGlobal('location', { href: '' })
})

describe('AuthProvider — initial load', () => {
  it('shows loading state before fetchMe resolves', () => {
    mockedMe.mockReturnValue(new Promise(() => {}))
    renderWithProvider()
    expect(screen.getByText('loading')).toBeInTheDocument()
  })

  it('sets user when fetchMe resolves successfully', async () => {
    mockedMe.mockResolvedValue(TEST_USER as never)
    renderWithProvider()
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('Alice'))
  })

  it('sets user to null when fetchMe rejects', async () => {
    mockedMe.mockRejectedValue(new Error('Unauthorized'))
    renderWithProvider()
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('no user'))
  })

  it('clears loading state after fetchMe resolves', async () => {
    mockedMe.mockResolvedValue(TEST_USER as never)
    renderWithProvider()
    await waitFor(() => expect(screen.queryByText('loading')).not.toBeInTheDocument())
  })

  it('clears loading state even when fetchMe rejects', async () => {
    mockedMe.mockRejectedValue(new Error('Network error'))
    renderWithProvider()
    await waitFor(() => expect(screen.queryByText('loading')).not.toBeInTheDocument())
  })
})

describe('AuthProvider — azr:banned event', () => {
  it('clears user when azr:banned event is fired', async () => {
    mockedMe.mockResolvedValue(TEST_USER as never)
    renderWithProvider()
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('Alice'))

    act(() => {
      window.dispatchEvent(new Event('azr:banned'))
    })

    expect(screen.getByTestId('user').textContent).toBe('no user')
  })

  it('does not crash when azr:banned fires with no user loaded', async () => {
    mockedMe.mockRejectedValue(new Error('no auth'))
    renderWithProvider()
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('no user'))

    act(() => {
      window.dispatchEvent(new Event('azr:banned'))
    })

    expect(screen.getByTestId('user').textContent).toBe('no user')
  })
})

describe('AuthProvider — logout', () => {
  it('clears user state immediately on logout', async () => {
    mockedMe.mockResolvedValue(TEST_USER as never)
    renderWithProvider()
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('Alice'))

    await userEvent.click(screen.getByRole('button', { name: 'logout' }))
    expect(screen.getByTestId('user').textContent).toBe('no user')
  })

  it('redirects to the main site on logout', async () => {
    mockedMe.mockResolvedValue(TEST_USER as never)
    renderWithProvider()
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('Alice'))

    await userEvent.click(screen.getByRole('button', { name: 'logout' }))
    expect(window.location.href).toBe('https://aziral.com')
  })

  it('still redirects even when authApi.logout rejects', async () => {
    mockedMe.mockResolvedValue(TEST_USER as never)
    mockedLogout.mockRejectedValue(new Error('Server error'))
    renderWithProvider()
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('Alice'))

    await userEvent.click(screen.getByRole('button', { name: 'logout' }))
    expect(window.location.href).toBe('https://aziral.com')
  })
})

describe('AuthProvider — updateUser', () => {
  it('updates the user state when updateUser is called', async () => {
    mockedMe.mockResolvedValue(TEST_USER as never)
    renderWithProvider()
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('Alice'))

    await userEvent.click(screen.getByRole('button', { name: 'update' }))
    expect(screen.getByTestId('user').textContent).toBe('Updated')
  })
})

describe('useAuth — outside provider', () => {
  it('throws when used outside AuthProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<TestConsumer />)).toThrow('useAuth must be used within AuthProvider')
    spy.mockRestore()
  })
})
