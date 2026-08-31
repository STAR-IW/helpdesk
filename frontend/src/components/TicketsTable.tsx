import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { ArrowUp, ArrowDown, ArrowUpDown, Search, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { apiGet, ApiError } from '@/lib/api'
import type { TicketStatus } from '@/lib/ticket-status'
import type { TicketCategory } from '@/lib/ticket-category'

type Ticket = {
  id: string
  subject: string
  status: TicketStatus
  category: TicketCategory | null
  requesterEmail: string
  requesterName: string | null
  createdAt: string
  updatedAt: string
}

const STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'Open',
  resolved: 'Resolved',
  closed: 'Closed',
}

const STATUS_VARIANTS: Record<TicketStatus, 'default' | 'secondary' | 'outline'> = {
  open: 'default',
  resolved: 'secondary',
  closed: 'outline',
}

const CATEGORY_LABELS: Record<TicketCategory, string> = {
  generalQuestion: 'General question',
  technicalQuestion: 'Technical question',
  refundRequest: 'Refund request',
}

const PAGE_SIZE = 10

const columns: ColumnDef<Ticket>[] = [
  { id: 'subject', accessorKey: 'subject', header: 'Subject' },
  {
    id: 'requesterName',
    header: 'Requester',
    accessorFn: (row) => row.requesterName ?? row.requesterEmail,
  },
  {
    id: 'status',
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <Badge variant={STATUS_VARIANTS[row.original.status]}>
        {STATUS_LABELS[row.original.status]}
      </Badge>
    ),
  },
  {
    id: 'category',
    accessorKey: 'category',
    header: 'Category',
    cell: ({ row }) =>
      row.original.category ? (
        <Badge variant="outline">{CATEGORY_LABELS[row.original.category]}</Badge>
      ) : (
        <span className="text-sm text-muted-foreground">Uncategorized</span>
      ),
  },
  {
    id: 'createdAt',
    accessorKey: 'createdAt',
    header: 'Created',
    cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
  },
]

export function TicketsTable() {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'createdAt', desc: true }])
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all')
  const [categoryFilter, setCategoryFilter] = useState<TicketCategory | 'all'>('all')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const sortBy = sorting[0]?.id ?? 'createdAt'
  const sortOrder = sorting[0]?.desc ? 'desc' : 'asc'

  useEffect(() => {
    const timeout = setTimeout(() => setSearch(searchInput.trim()), 300)
    return () => clearTimeout(timeout)
  }, [searchInput])

  useEffect(() => {
    setPage(1)
  }, [sortBy, sortOrder, statusFilter, categoryFilter, search])

  const {
    data,
    error,
    isPending,
  } = useQuery({
    queryKey: ['tickets', sortBy, sortOrder, statusFilter, categoryFilter, search, page],
    queryFn: () => {
      const params = new URLSearchParams({
        sortBy,
        sortOrder,
        page: String(page),
        pageSize: String(PAGE_SIZE),
      })
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (categoryFilter !== 'all') params.set('category', categoryFilter)
      if (search) params.set('search', search)
      return apiGet<{ tickets: Ticket[]; total: number }>(`/api/tickets?${params.toString()}`)
    },
  })
  const tickets = data?.tickets ?? null
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const errorMessage = error ? (error instanceof ApiError ? error.message : 'Failed to load tickets') : null

  const hasFilters = statusFilter !== 'all' || categoryFilter !== 'all' || searchInput !== ''
  const clearFilters = () => {
    setStatusFilter('all')
    setCategoryFilter('all')
    setSearchInput('')
    setSearch('')
  }

  const table = useReactTable({
    data: tickets ?? [],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    manualSorting: true,
    enableSortingRemoval: false,
    getCoreRowModel: getCoreRowModel(),
  })

  const headerRow = table.getHeaderGroups()[0]
  const headerCells = headerRow.headers.map((header) => {
    const sorted = header.column.getIsSorted()
    return (
      <TableHead
        key={header.id}
        aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none'}
      >
        <button
          type="button"
          className="flex items-center gap-1"
          onClick={header.column.getToggleSortingHandler()}
        >
          {flexRender(header.column.columnDef.header, header.getContext())}
          {sorted === 'asc' && <ArrowUp className="size-3.5" />}
          {sorted === 'desc' && <ArrowDown className="size-3.5" />}
          {!sorted && <ArrowUpDown className="size-3.5 text-muted-foreground" />}
        </button>
      </TableHead>
    )
  })

  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        <div className="relative w-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search subject or requester..."
            aria-label="Search tickets"
            className="pl-8"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as TicketStatus | 'all')}
        >
          <SelectTrigger aria-label="Filter by status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={categoryFilter}
          onValueChange={(value) => setCategoryFilter(value as TicketCategory | 'all')}
        >
          <SelectTrigger aria-label="Filter by category">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="size-4" />
            Clear filters
          </Button>
        )}
      </div>
      {errorMessage && (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}
      {!errorMessage && isPending && (
        <Table>
          <TableHeader>
            <TableRow>{headerCells}</TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Skeleton className="h-4 w-48" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-40" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-14 rounded-4xl" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-28 rounded-4xl" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-20" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {!errorMessage && tickets !== null && tickets.length === 0 && (
        <p className="text-sm text-muted-foreground">No tickets found.</p>
      )}
      {!errorMessage && tickets !== null && tickets.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>{headerCells}</TableRow>
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {!errorMessage && tickets !== null && tickets.length > 0 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * PAGE_SIZE + 1}-{(page - 1) * PAGE_SIZE + tickets.length} of {total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p - 1)}
              disabled={page <= 1}
            >
              <ChevronLeft className="size-4" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages}
            >
              Next
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
