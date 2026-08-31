import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router'
import { TicketDetailPage } from './TicketDetailPage'
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

const ticket = {
  id: '1',
  subject: 'Refund please',
  status: 'open' as const,
  category: 'refundRequest' as const,
  requesterEmail: 'bob@example.com',
  requesterName: 'Bob',
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
})
