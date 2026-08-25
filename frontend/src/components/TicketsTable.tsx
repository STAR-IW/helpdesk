import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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
  const sortBy = sorting[0]?.id ?? 'createdAt'
  const sortOrder = sorting[0]?.desc ? 'desc' : 'asc'

  const {
    data,
    error,
    isPending,
  } = useQuery({
    queryKey: ['tickets', sortBy, sortOrder],
    queryFn: () => {
      const params = new URLSearchParams({ sortBy, sortOrder })
      return apiGet<{ tickets: Ticket[] }>(`/api/tickets?${params.toString()}`)
    },
  })
  const tickets = data?.tickets ?? null
  const errorMessage = error ? (error instanceof ApiError ? error.message : 'Failed to load tickets') : null

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
    </>
  )
}
