import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { EditUserDialog } from './EditUserDialog'
import { apiPatch, ApiError } from '@/lib/api'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return {
    ...actual,
    apiPatch: vi.fn(),
  }
})

const mockedApiPatch = vi.mocked(apiPatch)

const sampleUser = {
  id: '1',
  name: 'Agent Smith',
  email: 'agent@test.com',
  role: 'agent' as const,
  createdAt: '2026-01-01T00:00:00.000Z',
}

beforeEach(() => {
  mockedApiPatch.mockReset()
})

async function openDialog() {
  const user = userEvent.setup()
  renderWithProviders(<EditUserDialog user={sampleUser} />)
  await user.click(screen.getByRole('button', { name: 'Edit Agent Smith' }))
  return user
}

async function submit(user: ReturnType<typeof userEvent.setup>) {
  const submitButton = within(screen.getByRole('dialog')).getByRole('button', {
    name: 'Save Changes',
  })
  await user.click(submitButton)
}

describe('EditUserDialog', () => {
  it('renders an accessible edit button with the dialog closed by default', () => {
    renderWithProviders(<EditUserDialog user={sampleUser} />)

    expect(screen.getByRole('button', { name: 'Edit Agent Smith' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument()
  })

  it('opens the dialog pre-filled with the user\'s current name and email, and a blank password', async () => {
    await openDialog()

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveValue('Agent Smith')
    expect(screen.getByLabelText('Email')).toHaveValue('agent@test.com')
    expect(screen.getByLabelText('Password')).toHaveValue('')
  })

  it('shows a validation error and does not submit when the name is too short', async () => {
    const user = await openDialog()

    await user.clear(screen.getByLabelText('Name'))
    await user.type(screen.getByLabelText('Name'), 'ab')
    await submit(user)

    expect(await screen.findByText('Name must be at least 3 characters')).toBeInTheDocument()
    expect(mockedApiPatch).not.toHaveBeenCalled()
  })

  it('shows a validation error and does not submit when the email is invalid', async () => {
    const user = await openDialog()

    await user.clear(screen.getByLabelText('Email'))
    await user.type(screen.getByLabelText('Email'), 'not-an-email')
    await submit(user)

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument()
    expect(mockedApiPatch).not.toHaveBeenCalled()
  })

  it('shows a validation error and does not submit when the name contains numbers or symbols', async () => {
    const user = await openDialog()

    await user.clear(screen.getByLabelText('Name'))
    await user.type(screen.getByLabelText('Name'), 'Agent99!')
    await submit(user)

    expect(await screen.findByText('Name can only contain letters')).toBeInTheDocument()
    expect(mockedApiPatch).not.toHaveBeenCalled()
  })

  it('shows a validation error and does not submit when a new password is under 8 characters', async () => {
    const user = await openDialog()

    await user.type(screen.getByLabelText('Password'), 'short')
    await submit(user)

    expect(await screen.findByText('Password must be at least 8 characters')).toBeInTheDocument()
    expect(mockedApiPatch).not.toHaveBeenCalled()
  })

  it('submits with the password omitted when left blank', async () => {
    mockedApiPatch.mockResolvedValue({ user: sampleUser })
    const user = await openDialog()

    await submit(user)

    await waitFor(() => {
      expect(mockedApiPatch).toHaveBeenCalledTimes(1)
    })
    expect(mockedApiPatch).toHaveBeenCalledWith('/api/users/1', {
      name: 'Agent Smith',
      email: 'agent@test.com',
      password: undefined,
    })
  })

  it('submits with the new password when one is provided', async () => {
    mockedApiPatch.mockResolvedValue({ user: sampleUser })
    const user = await openDialog()

    await user.type(screen.getByLabelText('Password'), 'newpassword123')
    await submit(user)

    await waitFor(() => {
      expect(mockedApiPatch).toHaveBeenCalledTimes(1)
    })
    expect(mockedApiPatch).toHaveBeenCalledWith('/api/users/1', {
      name: 'Agent Smith',
      email: 'agent@test.com',
      password: 'newpassword123',
    })
  })

  it('closes the dialog on a successful submit', async () => {
    mockedApiPatch.mockResolvedValue({ user: sampleUser })
    const user = await openDialog()

    await submit(user)

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('shows the server error message and keeps the dialog open when the email is already taken', async () => {
    mockedApiPatch.mockRejectedValue(new ApiError(409, 'A user with this email already exists'))
    const user = await openDialog()

    await submit(user)

    expect(await screen.findByText('A user with this email already exists')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('shows a generic error message when the request fails unexpectedly', async () => {
    mockedApiPatch.mockRejectedValue(new Error('network down'))
    const user = await openDialog()

    await submit(user)

    expect(await screen.findByText('Failed to update user')).toBeInTheDocument()
  })

  it('shows the original user values when reopened after closing without submitting', async () => {
    const user = await openDialog()

    await user.clear(screen.getByLabelText('Name'))
    await user.type(screen.getByLabelText('Name'), 'Someone Else')

    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Edit Agent Smith' }))

    expect(screen.getByLabelText('Name')).toHaveValue('Agent Smith')
  })
})
