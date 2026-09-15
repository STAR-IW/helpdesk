import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { ReplyForm } from './ReplyForm'
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

describe('ReplyForm', () => {
  it('replaces the draft with the polished text on success', async () => {
    const user = userEvent.setup()
    mockedApiPost.mockResolvedValue({ text: 'A more polished reply.' })
    renderWithProviders(<ReplyForm ticketId="ticket-1" />)

    await user.type(screen.getByLabelText('Reply message'), 'hey we will fix it')
    await user.click(screen.getByRole('button', { name: 'Polish' }))

    expect(await screen.findByDisplayValue('A more polished reply.')).toBeInTheDocument()
    expect(mockedApiPost).toHaveBeenCalledWith('/api/tickets/ticket-1/replies/polish', {
      body: 'hey we will fix it',
    })
  })

  it('disables Polish and Send reply while the draft is empty, and enables them once text is entered', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ReplyForm ticketId="ticket-1" />)

    expect(screen.getByRole('button', { name: 'Polish' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Send reply' })).toBeDisabled()

    await user.type(screen.getByLabelText('Reply message'), 'hey we will fix it')

    expect(screen.getByRole('button', { name: 'Polish' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Send reply' })).toBeEnabled()
  })

  it('keeps Polish and Send reply disabled when the draft is only whitespace', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ReplyForm ticketId="ticket-1" />)

    await user.type(screen.getByLabelText('Reply message'), '   ')

    expect(screen.getByRole('button', { name: 'Polish' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Send reply' })).toBeDisabled()
  })

  it('shows a server error message when polishing fails', async () => {
    const user = userEvent.setup()
    mockedApiPost.mockRejectedValue(new ApiError(502, 'Failed to polish reply'))
    renderWithProviders(<ReplyForm ticketId="ticket-1" />)

    await user.type(screen.getByLabelText('Reply message'), 'hey we will fix it')
    await user.click(screen.getByRole('button', { name: 'Polish' }))

    expect(await screen.findByText('Failed to polish reply')).toBeInTheDocument()
  })

  it('shows a generic error message on an unexpected polish failure', async () => {
    const user = userEvent.setup()
    mockedApiPost.mockRejectedValue(new Error('network down'))
    renderWithProviders(<ReplyForm ticketId="ticket-1" />)

    await user.type(screen.getByLabelText('Reply message'), 'hey we will fix it')
    await user.click(screen.getByRole('button', { name: 'Polish' }))

    expect(await screen.findByText('Failed to polish reply')).toBeInTheDocument()
  })

  it('sends the reply body on submit', async () => {
    const user = userEvent.setup()
    mockedApiPost.mockResolvedValue({ reply: { id: 'reply-1' } })
    renderWithProviders(<ReplyForm ticketId="ticket-1" />)

    await user.type(screen.getByLabelText('Reply message'), 'Thanks for reaching out.')
    await user.click(screen.getByRole('button', { name: 'Send reply' }))

    expect(mockedApiPost).toHaveBeenCalledWith('/api/tickets/ticket-1/replies', {
      body: 'Thanks for reaching out.',
    })
  })
})
