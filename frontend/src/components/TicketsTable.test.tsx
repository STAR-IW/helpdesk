import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { TicketsTable } from './TicketsTable'
import { apiGet, ApiError } from '@/lib/api'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return {
    ...actual,
    apiGet: vi.fn(),
  }
})

const mockedApiGet = vi.mocked(apiGet)

const tickets = [
  {
    id: '1',
    subject: 'Refund please',
    status: 'open' as const,
    category: null,
    requesterEmail: 'bob@example.com',
    requesterName: 'Bob',
    createdAt: '2026-02-20T00:00:00.000Z',
    updatedAt: '2026-02-20T00:00:00.000Z',
  },
  {
    id: '2',
    subject: 'Cannot log in',
    status: 'resolved' as const,
    category: 'technicalQuestion' as const,
    requesterEmail: 'alice@example.com',
    requesterName: null,
    createdAt: '2026-01-15T00:00:00.000Z',
    updatedAt: '2026-01-15T00:00:00.000Z',
  },
]

beforeEach(() => {
  mockedApiGet.mockReset()
})

describe('TicketsTable', () => {
  it('shows loading skeletons while the request is pending', () => {
    mockedApiGet.mockImplementation(() => new Promise(() => {}))

    renderWithProviders(<TicketsTable />)

    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(document.querySelectorAll('[data-slot="skeleton"]')).not.toHaveLength(0)
  })

  it('renders a row for each ticket with subject, requester, status, and category', async () => {
    mockedApiGet.mockResolvedValue({ tickets })

    renderWithProviders(<TicketsTable />)

    const refundRow = await screen.findByRole('row', { name: /Refund please/ })
    expect(within(refundRow).getByText('Bob')).toBeInTheDocument()
    expect(within(refundRow).getByText('Open')).toBeInTheDocument()
    expect(within(refundRow).getByText('Uncategorized')).toBeInTheDocument()

    const loginRow = screen.getByRole('row', { name: /Cannot log in/ })
    expect(within(loginRow).getByText('alice@example.com')).toBeInTheDocument()
    expect(within(loginRow).getByText('Resolved')).toBeInTheDocument()
    expect(within(loginRow).getByText('Technical question')).toBeInTheDocument()
  })

  it('shows an empty state when there are no tickets', async () => {
    mockedApiGet.mockResolvedValue({ tickets: [] })

    renderWithProviders(<TicketsTable />)

    expect(await screen.findByText('No tickets found.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('shows the server error message when the request fails with an ApiError', async () => {
    mockedApiGet.mockRejectedValue(new ApiError(403, 'Forbidden'))

    renderWithProviders(<TicketsTable />)

    expect(await screen.findByText('Forbidden')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('shows a generic error message when the request fails unexpectedly', async () => {
    mockedApiGet.mockRejectedValue(new Error('network down'))

    renderWithProviders(<TicketsTable />)

    expect(await screen.findByText('Failed to load tickets')).toBeInTheDocument()
  })

  it('sorts by createdAt descending by default', async () => {
    mockedApiGet.mockResolvedValue({ tickets })

    renderWithProviders(<TicketsTable />)

    await screen.findByRole('row', { name: /Refund please/ })
    const lastCallUrl = mockedApiGet.mock.calls.at(-1)?.[0]
    expect(lastCallUrl).toContain('sortBy=createdAt')
    expect(lastCallUrl).toContain('sortOrder=desc')
  })

  it('toggles sort direction when clicking the active column header again', async () => {
    const user = userEvent.setup()
    mockedApiGet.mockResolvedValue({ tickets })

    renderWithProviders(<TicketsTable />)

    await screen.findByRole('row', { name: /Refund please/ })
    await user.click(screen.getByRole('button', { name: /Created/ }))

    const lastCallUrl = mockedApiGet.mock.calls.at(-1)?.[0]
    expect(lastCallUrl).toContain('sortBy=createdAt')
    expect(lastCallUrl).toContain('sortOrder=asc')
  })

  it('sorts ascending when switching to a different column', async () => {
    const user = userEvent.setup()
    mockedApiGet.mockResolvedValue({ tickets })

    renderWithProviders(<TicketsTable />)

    await screen.findByRole('row', { name: /Refund please/ })
    await user.click(screen.getByRole('button', { name: /Subject/ }))

    const lastCallUrl = mockedApiGet.mock.calls.at(-1)?.[0]
    expect(lastCallUrl).toContain('sortBy=subject')
    expect(lastCallUrl).toContain('sortOrder=asc')
  })
})