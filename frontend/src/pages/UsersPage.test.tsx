import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { UsersPage } from './UsersPage'
import { apiGet, apiPost, apiPatch, apiDelete, ApiError } from '@/lib/api'

vi.mock('@/components/Navbar', () => ({
  Navbar: () => null,
}))

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return {
    ...actual,
    apiGet: vi.fn(),
    apiPost: vi.fn(),
    apiPatch: vi.fn(),
    apiDelete: vi.fn(),
  }
})

const mockedApiGet = vi.mocked(apiGet)
const mockedApiPost = vi.mocked(apiPost)
const mockedApiPatch = vi.mocked(apiPatch)
const mockedApiDelete = vi.mocked(apiDelete)

const users = [
  { id: '1', name: 'Admin', email: 'admin@test.com', role: 'admin' as const, createdAt: '2026-01-15T00:00:00.000Z' },
  { id: '2', name: 'Agent Smith', email: 'agent@test.com', role: 'agent' as const, createdAt: '2026-02-20T00:00:00.000Z' },
]

beforeEach(() => {
  mockedApiGet.mockReset()
  mockedApiPost.mockReset()
  mockedApiPatch.mockReset()
  mockedApiDelete.mockReset()
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

  it('renders a Create User button above the list', async () => {
    mockedApiGet.mockResolvedValue({ users })

    renderWithProviders(<UsersPage />)

    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create User' })).toBeInTheDocument()
  })

  it('refreshes the list after creating a user', async () => {
    const newUser = { id: '3', name: 'New Agent', email: 'newagent@test.com', role: 'agent' as const, createdAt: '2026-03-01T00:00:00.000Z' }
    mockedApiGet.mockResolvedValueOnce({ users })
    mockedApiGet.mockResolvedValueOnce({ users: [...users, newUser] })
    mockedApiPost.mockResolvedValue({ user: newUser })

    const user = userEvent.setup()
    renderWithProviders(<UsersPage />)

    await screen.findByRole('table')
    await user.click(screen.getByRole('button', { name: 'Create User' }))

    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByLabelText('Name'), newUser.name)
    await user.type(within(dialog).getByLabelText('Email'), newUser.email)
    await user.type(within(dialog).getByLabelText('Password'), 'password123')
    await user.click(within(dialog).getByRole('button', { name: 'Create User' }))

    await waitFor(() => {
      expect(mockedApiGet).toHaveBeenCalledTimes(2)
    })
    expect(await screen.findByRole('row', { name: /newagent@test\.com/ })).toBeInTheDocument()
  })

  it('shows the create user dialog when the Create User button is clicked', async () => {
    mockedApiGet.mockResolvedValue({ users })
    const user = userEvent.setup()
    renderWithProviders(<UsersPage />)

    await screen.findByRole('table')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Create User' }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('hides the dialog when clicking outside of it', async () => {
    mockedApiGet.mockResolvedValue({ users })
    const user = userEvent.setup()
    renderWithProviders(<UsersPage />)

    await screen.findByRole('table')
    await user.click(screen.getByRole('button', { name: 'Create User' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    const overlay = document.querySelector('[data-slot="dialog-overlay"]')
    expect(overlay).not.toBeNull()
    await user.click(overlay as Element)

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('hides the dialog when pressing Escape', async () => {
    mockedApiGet.mockResolvedValue({ users })
    const user = userEvent.setup()
    renderWithProviders(<UsersPage />)

    await screen.findByRole('table')
    await user.click(screen.getByRole('button', { name: 'Create User' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('renders an edit button for each user row', async () => {
    mockedApiGet.mockResolvedValue({ users })

    renderWithProviders(<UsersPage />)

    await screen.findByRole('row', { name: /admin@test\.com/ })
    expect(screen.getByRole('button', { name: 'Edit Admin' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit Agent Smith' })).toBeInTheDocument()
  })

  it('refreshes the list after editing a user', async () => {
    const updatedUsers = [users[0], { ...users[1], name: 'Agent Jones' }]
    mockedApiGet.mockResolvedValueOnce({ users })
    mockedApiGet.mockResolvedValueOnce({ users: updatedUsers })
    mockedApiPatch.mockResolvedValue({ user: updatedUsers[1] })

    const user = userEvent.setup()
    renderWithProviders(<UsersPage />)

    await screen.findByRole('row', { name: /agent@test\.com/ })
    await user.click(screen.getByRole('button', { name: 'Edit Agent Smith' }))

    const dialog = screen.getByRole('dialog')
    const nameInput = within(dialog).getByLabelText('Name')
    await user.clear(nameInput)
    await user.type(nameInput, 'Agent Jones')
    await user.click(within(dialog).getByRole('button', { name: 'Save Changes' }))

    await waitFor(() => {
      expect(mockedApiGet).toHaveBeenCalledTimes(2)
    })
    expect(await screen.findByRole('row', { name: /Agent Jones/ })).toBeInTheDocument()
  })

  it('renders a delete button for each user row, disabled for the admin', async () => {
    mockedApiGet.mockResolvedValue({ users })

    renderWithProviders(<UsersPage />)

    await screen.findByRole('row', { name: /admin@test\.com/ })
    expect(screen.getByRole('button', { name: 'Delete Admin' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Delete Agent Smith' })).toBeEnabled()
  })

  it('removes a user from the list after deleting them', async () => {
    mockedApiGet.mockResolvedValueOnce({ users })
    mockedApiGet.mockResolvedValueOnce({ users: [users[0]] })
    mockedApiDelete.mockResolvedValue(undefined)

    const user = userEvent.setup()
    renderWithProviders(<UsersPage />)

    await screen.findByRole('row', { name: /agent@test\.com/ })
    await user.click(screen.getByRole('button', { name: 'Delete Agent Smith' }))

    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

    await waitFor(() => {
      expect(mockedApiGet).toHaveBeenCalledTimes(2)
    })
    await waitFor(() => {
      expect(screen.queryByRole('row', { name: /agent@test\.com/ })).not.toBeInTheDocument()
    })
  })
})
