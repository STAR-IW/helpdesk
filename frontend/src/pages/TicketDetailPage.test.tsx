import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router'
import { TicketDetailPage } from './TicketDetailPage'
import { apiGet, apiPatch, apiPost, ApiError } from '@/lib/api'
import { useSession } from '@/lib/auth-client'
import type { TicketCategory } from '@/constants/ticket-category'

vi.mock('@/components/Navbar', () => ({
  Navbar: () => null,
}))

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return {
    ...actual,
    apiGet: vi.fn(),
    apiPatch: vi.fn(),
    apiPost: vi.fn(),
  }
})

vi.mock('@/lib/auth-client', () => ({
  useSession: vi.fn(),
}))

const mockedApiGet = vi.mocked(apiGet)
const mockedApiPatch = vi.mocked(apiPatch)
const mockedApiPost = vi.mocked(apiPost)
const mockedUseSession = vi.mocked(useSession)

const ticket = {
  id: '1',
  subject: 'Refund please',
  status: 'open' as const,
  category: 'refundRequest' as const,
  requesterEmail: 'bob@example.com',
  requesterName: 'Bob',
  assignedAgent: null,
  createdAt: '2026-02-20T00:00:00.000Z',
  updatedAt: '2026-02-21T00:00:00.000Z',
  messages: [
    {
      id: 'm1',
      fromEmail: 'bob@example.com',
      fromName: 'Bob',
      toEmail: 'support@example.com',
      body: 'Please refund my order.',
      createdAt: '2026-02-20T09:00:00.000Z',
    },
    {
      id: 'm2',
      fromEmail: 'support@example.com',
      fromName: null,
      toEmail: 'bob@example.com',
      body: "We're looking into it.",
      createdAt: '2026-02-20T10:00:00.000Z',
    },
  ],
  replies: [
    {
      id: 'r1',
      senderType: 'agent' as const,
      body: 'Thanks for reaching out, refund is on the way.',
      author: { id: 'agent-3', name: 'Priya Support' },
      createdAt: '2026-02-20T11:00:00.000Z',
    },
  ],
}

const agents = [
  { id: 'agent-1', name: 'Alice Agent' },
  { id: 'agent-2', name: 'Charlie Agent' },
]

function mockSession(role: 'admin' | 'agent') {
  mockedUseSession.mockReturnValue({
    data: { user: { role } },
  } as unknown as ReturnType<typeof useSession>)
}

function renderPage(id = '1') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/tickets/${id}`]}>
        <Routes>
          <Route path="/tickets/:id" element={<TicketDetailPage />} />
          <Route path="/tickets" element={<div>Tickets List</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  mockedApiGet.mockReset()
  mockedApiPatch.mockReset()
  mockedApiPost.mockReset()
  mockSession('agent')
})

describe('TicketDetailPage', () => {
  it('shows loading skeletons while the request is pending', () => {
    mockedApiGet.mockImplementation(() => new Promise(() => {}))

    renderPage()

    expect(document.querySelectorAll('[data-slot="skeleton"]')).not.toHaveLength(0)
  })

  it('renders the ticket metadata and message thread in order', async () => {
    mockedApiGet.mockResolvedValue({ ticket })

    renderPage()

    expect(
      await screen.findByText('Refund please', { selector: '[data-slot="card-title"]' })
    ).toBeInTheDocument()
    expect(screen.getByText('Open')).toBeInTheDocument()
    expect(screen.getByText('Refund request')).toBeInTheDocument()
    expect(
      screen.getByText('Bob · bob@example.com', { selector: 'p', exact: false })
    ).toBeInTheDocument()

    const messageBodies = screen.getAllByText(/Please refund my order\.|We're looking into it\./)
    expect(messageBodies).toHaveLength(2)
    expect(messageBodies[0]).toHaveTextContent('Please refund my order.')
    expect(messageBodies[1]).toHaveTextContent("We're looking into it.")
    expect(screen.getByText('Bob → support@example.com')).toBeInTheDocument()
    expect(screen.getByText('support@example.com → bob@example.com')).toBeInTheDocument()

    expect(
      screen.getByText('Thanks for reaching out, refund is on the way.')
    ).toBeInTheDocument()
    expect(screen.getByText('Priya Support', { exact: false })).toBeInTheDocument()
    expect(screen.getByText('(Agent)')).toBeInTheDocument()
  })

  it('shows "Uncategorized" when the ticket has no category', async () => {
    mockedApiGet.mockResolvedValue({ ticket: { ...ticket, category: null } })

    renderPage()

    expect(await screen.findByText('Uncategorized')).toBeInTheDocument()
  })

  it('shows an empty state when the ticket has no messages', async () => {
    mockedApiGet.mockResolvedValue({ ticket: { ...ticket, messages: [] } })

    renderPage()

    expect(await screen.findByText('No messages yet.', { selector: 'p' })).toBeInTheDocument()
  })

  it('shows the server error message when the request fails with an ApiError', async () => {
    mockedApiGet.mockRejectedValue(new ApiError(403, 'Forbidden'))

    renderPage()

    expect(await screen.findByText('Forbidden')).toBeInTheDocument()
  })

  it('shows a generic error message when the request fails unexpectedly', async () => {
    mockedApiGet.mockRejectedValue(new Error('network down'))

    renderPage()

    expect(await screen.findByText('Failed to load ticket')).toBeInTheDocument()
  })

  it('shows the not-found message for a nonexistent ticket', async () => {
    mockedApiGet.mockRejectedValue(new ApiError(404, 'Ticket not found'))

    renderPage('does-not-exist')

    expect(await screen.findByText('Ticket not found')).toBeInTheDocument()
  })

  it('navigates back to the tickets list when the back link is clicked', async () => {
    mockedApiGet.mockResolvedValue({ ticket })
    const user = userEvent.setup()

    renderPage()

    await screen.findByText('Refund please', { selector: '[data-slot="card-title"]' })
    await user.click(screen.getByRole('link', { name: /back to tickets/i }))

    expect(await screen.findByText('Tickets List')).toBeInTheDocument()
  })

  describe('ticket assignment', () => {
    it('shows the assignee as read-only text for a non-admin, with no dropdown', async () => {
      mockSession('agent')
      mockedApiGet.mockResolvedValue({ ticket: { ...ticket, assignedAgent: agents[0] } })

      renderPage()

      await screen.findByText('Refund please', { selector: '[data-slot="card-title"]' })
      expect(screen.getByText('Alice Agent')).toBeInTheDocument()
      expect(screen.queryByRole('combobox', { name: /assigned agent/i })).not.toBeInTheDocument()
      expect(mockedApiGet).not.toHaveBeenCalledWith('/api/users')
    })

    it('shows "Unassigned" for a non-admin when no agent is assigned', async () => {
      mockSession('agent')
      mockedApiGet.mockResolvedValue({ ticket })

      renderPage()

      await screen.findByText('Refund please', { selector: '[data-slot="card-title"]' })
      expect(screen.getByText('Unassigned')).toBeInTheDocument()
    })

    it('lets an admin reassign the ticket via the dropdown', async () => {
      mockSession('admin')
      let currentTicket: Omit<typeof ticket, 'assignedAgent'> & {
        assignedAgent: { id: string; name: string } | null
      } = ticket
      mockedApiGet.mockImplementation((path: string) => {
        if (path === '/api/users') return Promise.resolve({ users: agents })
        return Promise.resolve({ ticket: currentTicket })
      })
      mockedApiPatch.mockImplementation(async (_path, body) => {
        const { agentId } = body as { agentId: string | null }
        currentTicket = {
          ...ticket,
          assignedAgent: agents.find((agent) => agent.id === agentId) ?? null,
        }
        return { ticket: currentTicket }
      })
      const user = userEvent.setup()

      renderPage()

      await screen.findByText('Refund please', { selector: '[data-slot="card-title"]' })
      const select = screen.getByRole('combobox', { name: /assigned agent/i })
      await user.click(select)
      await user.click(await screen.findByRole('option', { name: 'Alice Agent' }))

      expect(mockedApiPatch).toHaveBeenCalledWith('/api/tickets/1', { agentId: 'agent-1' })
      await waitFor(() => expect(select).toHaveTextContent('Alice Agent'))
    })

    it('shows an error when assigning fails', async () => {
      mockSession('admin')
      mockedApiGet.mockImplementation((path: string) => {
        if (path === '/api/users') return Promise.resolve({ users: agents })
        return Promise.resolve({ ticket })
      })
      mockedApiPatch.mockRejectedValue(new ApiError(400, 'Agent not found'))
      const user = userEvent.setup()

      renderPage()

      await screen.findByText('Refund please', { selector: '[data-slot="card-title"]' })
      const select = screen.getByRole('combobox', { name: /assigned agent/i })
      await user.click(select)
      await user.click(await screen.findByRole('option', { name: 'Alice Agent' }))

      expect(await screen.findByText('Agent not found')).toBeInTheDocument()
    })
  })

  describe('status and category', () => {
    it('lets any authenticated user change the status via the dropdown', async () => {
      mockSession('agent')
      let currentTicket = ticket
      mockedApiGet.mockImplementation(() => Promise.resolve({ ticket: currentTicket }))
      mockedApiPatch.mockImplementation(async (_path, body) => {
        currentTicket = { ...currentTicket, ...(body as Partial<typeof ticket>) }
        return { ticket: currentTicket }
      })
      const user = userEvent.setup()

      renderPage()

      await screen.findByText('Refund please', { selector: '[data-slot="card-title"]' })
      const select = screen.getByRole('combobox', { name: /ticket status/i })
      await user.click(select)
      await user.click(await screen.findByRole('option', { name: 'Resolved' }))

      expect(mockedApiPatch).toHaveBeenCalledWith('/api/tickets/1', { status: 'resolved' })
      await waitFor(() => expect(select).toHaveTextContent('Resolved'))
    })

    it('lets a user clear the category back to Uncategorized', async () => {
      mockSession('agent')
      let currentTicket: Omit<typeof ticket, 'category'> & { category: TicketCategory | null } =
        ticket
      mockedApiGet.mockImplementation(() => Promise.resolve({ ticket: currentTicket }))
      mockedApiPatch.mockImplementation(async (_path, body) => {
        currentTicket = { ...currentTicket, ...(body as { category: TicketCategory | null }) }
        return { ticket: currentTicket }
      })
      const user = userEvent.setup()

      renderPage()

      await screen.findByText('Refund please', { selector: '[data-slot="card-title"]' })
      const select = screen.getByRole('combobox', { name: /ticket category/i })
      await user.click(select)
      await user.click(await screen.findByRole('option', { name: 'Uncategorized' }))

      expect(mockedApiPatch).toHaveBeenCalledWith('/api/tickets/1', { category: null })
      await waitFor(() => expect(select).toHaveTextContent('Uncategorized'))
    })

    it('shows an error when updating the status fails', async () => {
      mockedApiGet.mockResolvedValue({ ticket })
      mockedApiPatch.mockRejectedValue(new ApiError(400, 'Invalid status'))
      const user = userEvent.setup()

      renderPage()

      await screen.findByText('Refund please', { selector: '[data-slot="card-title"]' })
      const select = screen.getByRole('combobox', { name: /ticket status/i })
      await user.click(select)
      await user.click(await screen.findByRole('option', { name: 'Closed' }))

      expect(await screen.findByText('Invalid status')).toBeInTheDocument()
    })
  })

  describe('replies', () => {
    it('shows an empty state when the ticket has no replies', async () => {
      mockedApiGet.mockResolvedValue({ ticket: { ...ticket, replies: [] } })

      renderPage()

      expect(await screen.findByText('No replies yet.')).toBeInTheDocument()
    })

    it('submits a new reply and shows it once the ticket refetches', async () => {
      let currentTicket = ticket
      mockedApiGet.mockImplementation(() => Promise.resolve({ ticket: currentTicket }))
      mockedApiPost.mockImplementation(async (_path, body) => {
        const newReply = {
          id: 'r2',
          senderType: 'agent' as const,
          body: (body as { body: string }).body,
          author: { id: 'agent-1', name: 'Alice Agent' },
          createdAt: '2026-02-20T12:00:00.000Z',
        }
        currentTicket = { ...currentTicket, replies: [...currentTicket.replies, newReply] }
        return { reply: newReply }
      })
      const user = userEvent.setup()

      renderPage()

      await screen.findByText('Refund please', { selector: '[data-slot="card-title"]' })
      const textbox = screen.getByRole('textbox', { name: /reply message/i })
      await user.type(textbox, 'Sending your refund now.')
      await user.click(screen.getByRole('button', { name: /send reply/i }))

      expect(mockedApiPost).toHaveBeenCalledWith('/api/tickets/1/replies', {
        body: 'Sending your refund now.',
      })
      expect(await screen.findByText('Sending your refund now.')).toBeInTheDocument()
      await waitFor(() => expect(textbox).toHaveValue(''))
    })

    it('shows a validation error when submitting an empty reply', async () => {
      mockedApiGet.mockResolvedValue({ ticket })
      const user = userEvent.setup()

      renderPage()

      await screen.findByText('Refund please', { selector: '[data-slot="card-title"]' })
      await user.click(screen.getByRole('button', { name: /send reply/i }))

      expect(await screen.findByText('Reply cannot be empty')).toBeInTheDocument()
      expect(mockedApiPost).not.toHaveBeenCalled()
    })

    it('shows an error when sending a reply fails', async () => {
      mockedApiGet.mockResolvedValue({ ticket })
      mockedApiPost.mockRejectedValue(new ApiError(500, 'Failed to send reply'))
      const user = userEvent.setup()

      renderPage()

      await screen.findByText('Refund please', { selector: '[data-slot="card-title"]' })
      await user.type(screen.getByRole('textbox', { name: /reply message/i }), 'Hello')
      await user.click(screen.getByRole('button', { name: /send reply/i }))

      expect(await screen.findByText('Failed to send reply')).toBeInTheDocument()
    })
  })
})
