import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { DeleteUserDialog } from './DeleteUserDialog'
import { apiDelete, ApiError } from '@/lib/api'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return {
    ...actual,
    apiDelete: vi.fn(),
  }
})

const mockedApiDelete = vi.mocked(apiDelete)

const agentUser = { id: '1', name: 'Agent Smith', role: 'agent' as const }
const adminUser = { id: '2', name: 'Ada Admin', role: 'admin' as const }

beforeEach(() => {
  mockedApiDelete.mockReset()
})

async function openDialog() {
  const user = userEvent.setup()
  renderWithProviders(<DeleteUserDialog user={agentUser} />)
  await user.click(screen.getByRole('button', { name: 'Delete Agent Smith' }))
  return user
}

async function confirm(user: ReturnType<typeof userEvent.setup>) {
  const confirmButton = within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' })
  await user.click(confirmButton)
}

describe('DeleteUserDialog', () => {
  it('renders an accessible delete button with the dialog closed by default', () => {
    renderWithProviders(<DeleteUserDialog user={agentUser} />)

    expect(screen.getByRole('button', { name: 'Delete Agent Smith' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('disables the delete button for an admin user and does not open a dialog on click', async () => {
    const user = userEvent.setup()
    renderWithProviders(<DeleteUserDialog user={adminUser} />)

    const button = screen.getByRole('button', { name: 'Delete Ada Admin' })
    expect(button).toBeDisabled()

    await user.click(button)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(mockedApiDelete).not.toHaveBeenCalled()
  })

  it('opens a confirmation dialog naming the user', async () => {
    await openDialog()

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Delete User')).toBeInTheDocument()
    expect(
      screen.getByText('Delete Agent Smith? They will immediately lose access to the system.')
    ).toBeInTheDocument()
  })

  it('closes the dialog without calling apiDelete when cancelled', async () => {
    const user = await openDialog()

    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    expect(mockedApiDelete).not.toHaveBeenCalled()
  })

  it('calls apiDelete and closes the dialog on confirm', async () => {
    mockedApiDelete.mockResolvedValue(undefined)
    const user = await openDialog()

    await confirm(user)

    await waitFor(() => {
      expect(mockedApiDelete).toHaveBeenCalledWith('/api/users/1')
    })
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('shows the server error message and keeps the dialog open when deletion is forbidden', async () => {
    mockedApiDelete.mockRejectedValue(new ApiError(403, 'Admin users cannot be deleted'))
    const user = await openDialog()

    await confirm(user)

    expect(await screen.findByText('Admin users cannot be deleted')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('shows a generic error message when the request fails unexpectedly', async () => {
    mockedApiDelete.mockRejectedValue(new Error('network down'))
    const user = await openDialog()

    await confirm(user)

    expect(await screen.findByText('Failed to delete user')).toBeInTheDocument()
  })
})
