import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { TicketDetails } from './TicketDetails'
import { apiPatch, ApiError } from '@/lib/api'
import type { TicketDetail } from '@/constants/ticket'
import type { Agent } from '@/constants/agent'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return {
    ...actual,
    apiPatch: vi.fn(),
  }
})

const mockedApiPatch = vi.mocked(apiPatch)

const baseTicket: TicketDetail = {
  id: 'ticket-1',
  subject: 'Cannot log in',
  status: 'open',
  category: null,
  requesterEmail: 'requester@test.com',
  requesterName: 'Rae Requester',
  createdAt: '2026-01-10T00:00:00.000Z',
  updatedAt: '2026-01-12T00:00:00.000Z',
  assignedAgent: null,
  messages: [],
  replies: [],
}

const agents: Agent[] = [
  { id: 'agent-1', name: 'Alice Agent' },
  { id: 'agent-2', name: 'Bob Agent' },
]

beforeEach(() => {
  mockedApiPatch.mockReset()
})

describe('TicketDetails', () => {
  it('renders the subject, requester, and created/updated dates', () => {
    renderWithProviders(<TicketDetails ticket={baseTicket} isAdmin={false} agents={[]} />)

    expect(screen.getByText('Cannot log in')).toBeInTheDocument()
    expect(screen.getByText(/Rae Requester/)).toBeInTheDocument()
    expect(screen.getByText(/requester@test\.com/)).toBeInTheDocument()
    expect(
      screen.getByText(
        `Created ${new Date(baseTicket.createdAt).toLocaleDateString()} · Updated ${new Date(
          baseTicket.updatedAt
        ).toLocaleDateString()}`
      )
    ).toBeInTheDocument()
  })

  it('shows an empty state when there are no messages', () => {
    renderWithProviders(<TicketDetails ticket={baseTicket} isAdmin={false} agents={[]} />)

    expect(screen.getByText('No messages yet.')).toBeInTheDocument()
  })

  it('renders each message with its sender, recipient, body, and timestamp', () => {
    const ticket: TicketDetail = {
      ...baseTicket,
      messages: [
        {
          id: 'message-1',
          fromEmail: 'requester@test.com',
          fromName: 'Rae Requester',
          toEmail: 'support@test.com',
          body: 'My login keeps failing.',
          bodyHtml: null,
          createdAt: '2026-01-10T08:00:00.000Z',
        },
      ],
    }

    renderWithProviders(<TicketDetails ticket={ticket} isAdmin={false} agents={[]} />)

    expect(screen.getByText('Rae Requester → support@test.com')).toBeInTheDocument()
    expect(screen.getByText('My login keeps failing.')).toBeInTheDocument()
    expect(
      screen.getByText(new Date(ticket.messages[0].createdAt).toLocaleString())
    ).toBeInTheDocument()
  })

  it('renders children below the messages card', () => {
    renderWithProviders(
      <TicketDetails ticket={baseTicket} isAdmin={false} agents={[]}>
        <p>Replies section</p>
      </TicketDetails>
    )

    expect(screen.getByText('Replies section')).toBeInTheDocument()
  })

  it('updates the ticket status', async () => {
    mockedApiPatch.mockResolvedValue({ ticket: { ...baseTicket, status: 'resolved' } })
    const user = userEvent.setup()
    renderWithProviders(<TicketDetails ticket={baseTicket} isAdmin={false} agents={[]} />)

    await user.click(screen.getByRole('combobox', { name: /ticket status/i }))
    await user.click(await screen.findByRole('option', { name: 'Resolved' }))

    await waitFor(() => {
      expect(mockedApiPatch).toHaveBeenCalledWith('/api/tickets/ticket-1', { status: 'resolved' })
    })
  })

  it('shows an error when updating the status fails', async () => {
    mockedApiPatch.mockRejectedValue(new ApiError(400, 'Cannot reopen a closed ticket'))
    const user = userEvent.setup()
    renderWithProviders(<TicketDetails ticket={baseTicket} isAdmin={false} agents={[]} />)

    await user.click(screen.getByRole('combobox', { name: /ticket status/i }))
    await user.click(await screen.findByRole('option', { name: 'Closed' }))

    expect(await screen.findByText('Cannot reopen a closed ticket')).toBeInTheDocument()
  })

  it('shows the category as Uncategorized and lets you set one', async () => {
    mockedApiPatch.mockResolvedValue({ ticket: { ...baseTicket, category: 'refundRequest' } })
    const user = userEvent.setup()
    renderWithProviders(<TicketDetails ticket={baseTicket} isAdmin={false} agents={[]} />)

    const categorySelect = screen.getByRole('combobox', { name: /ticket category/i })
    expect(categorySelect).toHaveTextContent('Uncategorized')

    await user.click(categorySelect)
    await user.click(await screen.findByRole('option', { name: 'Refund request' }))

    await waitFor(() => {
      expect(mockedApiPatch).toHaveBeenCalledWith('/api/tickets/ticket-1', { category: 'refundRequest' })
    })
  })

  it('clears the category back to null when Uncategorized is selected', async () => {
    const categorized: TicketDetail = { ...baseTicket, category: 'generalQuestion' }
    mockedApiPatch.mockResolvedValue({ ticket: { ...categorized, category: null } })
    const user = userEvent.setup()
    renderWithProviders(<TicketDetails ticket={categorized} isAdmin={false} agents={[]} />)

    await user.click(screen.getByRole('combobox', { name: /ticket category/i }))
    await user.click(await screen.findByRole('option', { name: 'Uncategorized' }))

    await waitFor(() => {
      expect(mockedApiPatch).toHaveBeenCalledWith('/api/tickets/ticket-1', { category: null })
    })
  })

  it('shows an assignment dropdown for admins and assigns an agent', async () => {
    mockedApiPatch.mockResolvedValue({ ticket: { ...baseTicket, assignedAgent: agents[0] } })
    const user = userEvent.setup()
    renderWithProviders(<TicketDetails ticket={baseTicket} isAdmin={true} agents={agents} />)

    const assignSelect = screen.getByRole('combobox', { name: /assigned agent/i })
    expect(assignSelect).toHaveTextContent('Unassigned')

    await user.click(assignSelect)
    await user.click(await screen.findByRole('option', { name: 'Alice Agent' }))

    await waitFor(() => {
      expect(mockedApiPatch).toHaveBeenCalledWith('/api/tickets/ticket-1', { agentId: 'agent-1' })
    })
  })

  it('shows an error when assigning an agent fails', async () => {
    mockedApiPatch.mockRejectedValue(new ApiError(404, 'Agent not found'))
    const user = userEvent.setup()
    renderWithProviders(<TicketDetails ticket={baseTicket} isAdmin={true} agents={agents} />)

    await user.click(screen.getByRole('combobox', { name: /assigned agent/i }))
    await user.click(await screen.findByRole('option', { name: 'Alice Agent' }))

    expect(await screen.findByText('Agent not found')).toBeInTheDocument()
  })

  it('shows the assigned agent as plain text for non-admins, with no dropdown', () => {
    const ticket: TicketDetail = { ...baseTicket, assignedAgent: agents[0] }
    renderWithProviders(<TicketDetails ticket={ticket} isAdmin={false} agents={agents} />)

    expect(screen.getByText('Alice Agent')).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: /assigned agent/i })).not.toBeInTheDocument()
  })
})
