import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import { UsersPage } from './UsersPage'
import { apiGet, ApiError } from '@/lib/api'

vi.mock('@/components/Navbar', () => ({
  Navbar: () => null,
}))

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return {
    ...actual,
    apiGet: vi.fn(),
  }
})

const mockedApiGet = vi.mocked(apiGet)

const users = [
  { id: '1', name: 'Admin', email: 'admin@test.com', role: 'admin' as const, createdAt: '2026-01-15T00:00:00.000Z' },
  { id: '2', name: 'Agent Smith', email: 'agent@test.com', role: 'agent' as const, createdAt: '2026-02-20T00:00:00.000Z' },
]

beforeEach(() => {
  mockedApiGet.mockReset()
})

describe('UsersPage', () => {
  it('shows loading skeletons while the request is pending', () => {
    mockedApiGet.mockImplementation(() => new Promise(() => {}))

    renderWithProviders(<UsersPage />)

    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(document.querySelectorAll('[data-slot="skeleton"]')).not.toHaveLength(0)
  })

  it('renders a row for each user with name, email, role, and joined date', async () => {
    mockedApiGet.mockResolvedValue({ users })

    renderWithProviders(<UsersPage />)

    const adminRow = await screen.findByRole('row', { name: /admin@test\.com/ })
    expect(within(adminRow).getByText('Admin')).toBeInTheDocument()
    expect(within(adminRow).getByText('admin')).toBeInTheDocument()
    expect(within(adminRow).getByText(new Date(users[0].createdAt).toLocaleDateString())).toBeInTheDocument()

    const agentRow = screen.getByRole('row', { name: /agent@test\.com/ })
    expect(within(agentRow).getByText('Agent Smith')).toBeInTheDocument()
    expect(within(agentRow).getByText('agent')).toBeInTheDocument()
  })

  it('shows an empty state when there are no users', async () => {
    mockedApiGet.mockResolvedValue({ users: [] })

    renderWithProviders(<UsersPage />)

    expect(await screen.findByText('No users found.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('shows the server error message when the request fails with an ApiError', async () => {
    mockedApiGet.mockRejectedValue(new ApiError(403, 'Forbidden'))

    renderWithProviders(<UsersPage />)

    expect(await screen.findByText('Forbidden')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('shows a generic error message when the request fails unexpectedly', async () => {
    mockedApiGet.mockRejectedValue(new Error('network down'))

    renderWithProviders(<UsersPage />)

    expect(await screen.findByText('Failed to load users')).toBeInTheDocument()
  })
})
