import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { TicketSummary } from './TicketSummary'
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

describe('TicketSummary', () => {
  it('shows a Summarize button and no summary before generating one', () => {
    renderWithProviders(<TicketSummary ticketId="ticket-1" />)

    expect(screen.getByRole('button', { name: /summarize/i })).toBeInTheDocument()
    expect(screen.queryByText(/customer/i)).not.toBeInTheDocument()
  })

  it('generates and displays a summary, then relabels the button to regenerate', async () => {
    mockedApiPost.mockResolvedValue({ summary: 'Customer wants a refund; agent is processing it.' })
    const user = userEvent.setup()
    renderWithProviders(<TicketSummary ticketId="ticket-1" />)

    await user.click(screen.getByRole('button', { name: 'Summarize' }))

    expect(await screen.findByText('Customer wants a refund; agent is processing it.')).toBeInTheDocument()
    expect(mockedApiPost).toHaveBeenCalledWith('/api/tickets/ticket-1/summary', {})
    expect(screen.getByRole('button', { name: /regenerate summary/i })).toBeInTheDocument()
  })

  it('re-calls the API and replaces the summary when regenerated', async () => {
    mockedApiPost
      .mockResolvedValueOnce({ summary: 'First summary.' })
      .mockResolvedValueOnce({ summary: 'Second summary.' })
    const user = userEvent.setup()
    renderWithProviders(<TicketSummary ticketId="ticket-1" />)

    await user.click(screen.getByRole('button', { name: 'Summarize' }))
    expect(await screen.findByText('First summary.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /regenerate summary/i }))

    expect(await screen.findByText('Second summary.')).toBeInTheDocument()
    expect(screen.queryByText('First summary.')).not.toBeInTheDocument()
    expect(mockedApiPost).toHaveBeenCalledTimes(2)
  })

  it('shows a server error message when summarizing fails', async () => {
    mockedApiPost.mockRejectedValue(new ApiError(400, 'Ticket has no messages to summarize'))
    const user = userEvent.setup()
    renderWithProviders(<TicketSummary ticketId="ticket-1" />)

    await user.click(screen.getByRole('button', { name: 'Summarize' }))

    expect(await screen.findByText('Ticket has no messages to summarize')).toBeInTheDocument()
  })

  it('shows a generic error message for an unexpected error', async () => {
    mockedApiPost.mockRejectedValue(new Error('network down'))
    const user = userEvent.setup()
    renderWithProviders(<TicketSummary ticketId="ticket-1" />)

    await user.click(screen.getByRole('button', { name: 'Summarize' }))

    expect(await screen.findByText('Failed to summarize ticket')).toBeInTheDocument()
  })
})
