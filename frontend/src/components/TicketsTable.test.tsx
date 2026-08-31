import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, within, waitFor } from '@testing-library/react'
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
    expect(within(refundRow).getByRole('link', { name: 'Refund please' })).toHaveAttribute(
      'href',
      '/tickets/1'
    )

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

  it('does not send a status or category param by default', async () => {
    mockedApiGet.mockResolvedValue({ tickets })

    renderWithProviders(<TicketsTable />)

    await screen.findByRole('row', { name: /Refund please/ })
    const lastCallUrl = mockedApiGet.mock.calls.at(-1)?.[0]
    expect(lastCallUrl).not.toContain('status=')
    expect(lastCallUrl).not.toContain('category=')
    expect(lastCallUrl).not.toContain('search=')
  })

  it('searches by text after debounce', async () => {
    const user = userEvent.setup()
    mockedApiGet.mockResolvedValue({ tickets })

    renderWithProviders(<TicketsTable />)

    await screen.findByRole('row', { name: /Refund please/ })
    await user.type(screen.getByRole('textbox', { name: /search tickets/i }), 'refund')

    await waitFor(() => {
      const lastCallUrl = mockedApiGet.mock.calls.at(-1)?.[0]
      expect(lastCallUrl).toContain('search=refund')
    })
  })

  it('hides the clear filters button when no filters are active', async () => {
    mockedApiGet.mockResolvedValue({ tickets })

    renderWithProviders(<TicketsTable />)

    await screen.findByRole('row', { name: /Refund please/ })
    expect(screen.queryByRole('button', { name: /clear filters/i })).not.toBeInTheDocument()
  })

  it('clears all filters when the clear filters button is clicked', async () => {
    const user = userEvent.setup()
    mockedApiGet.mockResolvedValue({ tickets })

    renderWithProviders(<TicketsTable />)

    await screen.findByRole('row', { name: /Refund please/ })
    await user.click(screen.getByRole('combobox', { name: /filter by status/i }))
    await user.click(await screen.findByRole('option', { name: 'Open' }))
    await user.type(screen.getByRole('textbox', { name: /search tickets/i }), 'refund')

    const clearButton = await screen.findByRole('button', { name: /clear filters/i })
    await user.click(clearButton)

    expect(screen.getByRole('textbox', { name: /search tickets/i })).toHaveValue('')
    expect(screen.queryByRole('button', { name: /clear filters/i })).not.toBeInTheDocument()
    await waitFor(() => {
      const lastCallUrl = mockedApiGet.mock.calls.at(-1)?.[0]
      expect(lastCallUrl).not.toContain('status=')
      expect(lastCallUrl).not.toContain('search=')
    })
  })

  it('filters by status when a status is selected', async () => {
    const user = userEvent.setup()
    mockedApiGet.mockResolvedValue({ tickets })

    renderWithProviders(<TicketsTable />)

    await screen.findByRole('row', { name: /Refund please/ })
    await user.click(screen.getByRole('combobox', { name: /filter by status/i }))
    await user.click(await screen.findByRole('option', { name: 'Open' }))

    const lastCallUrl = mockedApiGet.mock.calls.at(-1)?.[0]
    expect(lastCallUrl).toContain('status=open')
  })

  it('filters by category when a category is selected', async () => {
    const user = userEvent.setup()
    mockedApiGet.mockResolvedValue({ tickets })

    renderWithProviders(<TicketsTable />)

    await screen.findByRole('row', { name: /Refund please/ })
    await user.click(screen.getByRole('combobox', { name: /filter by category/i }))
    await user.click(await screen.findByRole('option', { name: 'Technical question' }))

    const lastCallUrl = mockedApiGet.mock.calls.at(-1)?.[0]
    expect(lastCallUrl).toContain('category=technicalQuestion')
  })

  it('sends page 1 and pageSize 10 by default', async () => {
    mockedApiGet.mockResolvedValue({ tickets, total: 2 })

    renderWithProviders(<TicketsTable />)

    await screen.findByRole('row', { name: /Refund please/ })
    const lastCallUrl = mockedApiGet.mock.calls.at(-1)?.[0]
    expect(lastCallUrl).toContain('page=1')
    expect(lastCallUrl).toContain('pageSize=10')
  })

  it('disables Previous on the first page and enables Next when more pages exist', async () => {
    mockedApiGet.mockResolvedValue({ tickets, total: 25 })

    renderWithProviders(<TicketsTable />)

    await screen.findByRole('row', { name: /Refund please/ })
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /next/i })).toBeEnabled()
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument()
  })

  it('requests the next page when Next is clicked', async () => {
    const user = userEvent.setup()
    mockedApiGet.mockResolvedValue({ tickets, total: 25 })

    renderWithProviders(<TicketsTable />)

    await screen.findByRole('row', { name: /Refund please/ })
    await user.click(screen.getByRole('button', { name: /next/i }))

    await waitFor(() => {
      const lastCallUrl = mockedApiGet.mock.calls.at(-1)?.[0]
      expect(lastCallUrl).toContain('page=2')
    })
    expect(screen.getByRole('button', { name: /previous/i })).toBeEnabled()
  })

  it('resets to page 1 when a filter changes', async () => {
    const user = userEvent.setup()
    mockedApiGet.mockResolvedValue({ tickets, total: 25 })

    renderWithProviders(<TicketsTable />)

    await screen.findByRole('row', { name: /Refund please/ })
    await user.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => {
      expect(mockedApiGet.mock.calls.at(-1)?.[0]).toContain('page=2')
    })

    await user.click(screen.getByRole('combobox', { name: /filter by status/i }))
    await user.click(await screen.findByRole('option', { name: 'Open' }))

    await waitFor(() => {
      const lastCallUrl = mockedApiGet.mock.calls.at(-1)?.[0]
      expect(lastCallUrl).toContain('page=1')
      expect(lastCallUrl).toContain('status=open')
    })
  })
})