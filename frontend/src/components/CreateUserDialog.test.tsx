import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { CreateUserDialog } from './CreateUserDialog'
import { apiPost, ApiError } from '@/lib/api'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return {
    ...actual,
    apiPost: vi.fn(),
  }
})

const mockedApiPost = vi.mocked(apiPost)

beforeEach(() => {
  mockedApiPost.mockReset()
})

async function openDialog() {
  const user = userEvent.setup()
  renderWithProviders(<CreateUserDialog />)
  await user.click(screen.getByRole('button', { name: 'Create User' }))
  return user
}

async function fillAndSubmit(
  user: ReturnType<typeof userEvent.setup>,
  values: { name?: string; email?: string; password?: string }
) {
  if (values.name !== undefined) {
    await user.type(screen.getByLabelText('Name'), values.name)
  }
  if (values.email !== undefined) {
    await user.type(screen.getByLabelText('Email'), values.email)
  }
  if (values.password !== undefined) {
    await user.type(screen.getByLabelText('Password'), values.password)
  }
  // The trigger button stays mounted behind the dialog, so two "Create User"
  // buttons exist while open; the submit button is the one inside the dialog.
  const submitButton = within(screen.getByRole('dialog')).getByRole('button', { name: 'Create User' })
  await user.click(submitButton)
}

describe('CreateUserDialog', () => {
  it('renders a Create User button with the dialog closed by default', () => {
    renderWithProviders(<CreateUserDialog />)

    expect(screen.getByRole('button', { name: 'Create User' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument()
  })

  it('opens the dialog with name, email, and password fields when clicked', async () => {
    await openDialog()

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
  })

  it('shows a validation error and does not submit when the name is too short', async () => {
    const user = await openDialog()

    await fillAndSubmit(user, { name: 'ab', email: 'agent@test.com', password: 'password123' })

    expect(await screen.findByText('Name must be at least 3 characters')).toBeInTheDocument()
    expect(mockedApiPost).not.toHaveBeenCalled()
  })

  it('shows a validation error and does not submit when the email is invalid', async () => {
    const user = await openDialog()

    await fillAndSubmit(user, { name: 'Agent Smith', email: 'not-an-email', password: 'password123' })

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument()
    expect(mockedApiPost).not.toHaveBeenCalled()
  })

  it('shows a validation error and does not submit when the password is too short', async () => {
    const user = await openDialog()

    await fillAndSubmit(user, { name: 'Agent Smith', email: 'agent@test.com', password: 'short' })

    expect(await screen.findByText('Password must be at least 8 characters')).toBeInTheDocument()
    expect(mockedApiPost).not.toHaveBeenCalled()
  })

  it('submits valid values to the create user endpoint', async () => {
    mockedApiPost.mockResolvedValue({
      user: { id: '3', name: 'Agent Smith', email: 'agent@test.com', role: 'agent', createdAt: '2026-08-10T00:00:00.000Z' },
    })
    const user = await openDialog()

    await fillAndSubmit(user, { name: 'Agent Smith', email: 'agent@test.com', password: 'password123' })

    await waitFor(() => {
      expect(mockedApiPost).toHaveBeenCalledTimes(1)
    })
    expect(mockedApiPost).toHaveBeenCalledWith('/api/users', {
      name: 'Agent Smith',
      email: 'agent@test.com',
      password: 'password123',
    })
  })

  it('closes the dialog on a successful submit', async () => {
    mockedApiPost.mockResolvedValue({
      user: { id: '3', name: 'Agent Smith', email: 'agent@test.com', role: 'agent', createdAt: '2026-08-10T00:00:00.000Z' },
    })
    const user = await openDialog()

    await fillAndSubmit(user, { name: 'Agent Smith', email: 'agent@test.com', password: 'password123' })

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('shows the server error message and keeps the dialog open when the email is already taken', async () => {
    mockedApiPost.mockRejectedValue(new ApiError(409, 'A user with this email already exists'))
    const user = await openDialog()

    await fillAndSubmit(user, { name: 'Agent Smith', email: 'agent@test.com', password: 'password123' })

    expect(await screen.findByText('A user with this email already exists')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('shows a generic error message when the request fails unexpectedly', async () => {
    mockedApiPost.mockRejectedValue(new Error('network down'))
    const user = await openDialog()

    await fillAndSubmit(user, { name: 'Agent Smith', email: 'agent@test.com', password: 'password123' })

    expect(await screen.findByText('Failed to create user')).toBeInTheDocument()
  })

  it('shows a blank form when reopened after a failed submit', async () => {
    mockedApiPost.mockRejectedValue(new ApiError(409, 'A user with this email already exists'))
    const user = await openDialog()

    await fillAndSubmit(user, { name: 'Agent Smith', email: 'agent@test.com', password: 'password123' })
    expect(await screen.findByText('A user with this email already exists')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Create User' }))

    expect(screen.getByLabelText('Name')).toHaveValue('')
    expect(screen.getByLabelText('Email')).toHaveValue('')
    expect(screen.getByLabelText('Password')).toHaveValue('')
    expect(screen.queryByText('A user with this email already exists')).not.toBeInTheDocument()
  })
})
