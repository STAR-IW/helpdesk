import { useQuery } from '@tanstack/react-query'
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

export function TicketsTable() {
  const {
    data,
    error,
    isPending,
  } = useQuery({
    queryKey: ['tickets'],
    queryFn: () => apiGet<{ tickets: Ticket[] }>('/api/tickets'),
  })
  const tickets = data?.tickets ?? null
  const errorMessage = error ? (error instanceof ApiError ? error.message : 'Failed to load tickets') : null

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
            <TableRow>
              <TableHead>Subject</TableHead>
              <TableHead>Requester</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
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
            <TableRow>
              <TableHead>Subject</TableHead>
              <TableHead>Requester</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.map((ticket) => (
              <TableRow key={ticket.id}>
                <TableCell>{ticket.subject}</TableCell>
                <TableCell>{ticket.requesterName ?? ticket.requesterEmail}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANTS[ticket.status]}>
                    {STATUS_LABELS[ticket.status]}
                  </Badge>
                </TableCell>
                <TableCell>
                  {ticket.category ? (
                    <Badge variant="outline">{CATEGORY_LABELS[ticket.category]}</Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">Uncategorized</span>
                  )}
                </TableCell>
                <TableCell>{new Date(ticket.createdAt).toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  )
}
