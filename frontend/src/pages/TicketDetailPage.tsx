import { Link, useParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { Navbar } from '@/components/Navbar'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { apiGet, apiPatch, ApiError, Role } from '@/lib/api'
import { useSession } from '@/lib/auth-client'
import { STATUS_LABELS, STATUS_VARIANTS, type TicketStatus } from '@/lib/ticket-status'
import { CATEGORY_LABELS, type TicketCategory } from '@/lib/ticket-category'

const UNASSIGNED = 'unassigned'

type Message = {
  id: string
  fromEmail: string
  fromName: string | null
  toEmail: string
  body: string
  createdAt: string
}

type Agent = {
  id: string
  name: string
}

type TicketDetail = {
  id: string
  subject: string
  status: TicketStatus
  category: TicketCategory | null
  requesterEmail: string
  requesterName: string | null
  assignedAgent: Agent | null
  createdAt: string
  updatedAt: string
  messages: Message[]
}

export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: session } = useSession()
  const isAdmin = session?.user.role === Role.admin
  const queryClient = useQueryClient()

  const {
    data,
    error,
    isPending,
  } = useQuery({
    queryKey: ['ticket', id],
    queryFn: () => apiGet<{ ticket: TicketDetail }>(`/api/tickets/${id}`),
  })
  const ticket = data?.ticket ?? null
  const errorMessage = error ? (error instanceof ApiError ? error.message : 'Failed to load ticket') : null

  const { data: agentsData } = useQuery({
    queryKey: ['users'],
    queryFn: () => apiGet<{ users: Agent[] }>('/api/users'),
    enabled: isAdmin,
  })
  const agents = agentsData?.users ?? []

  const assignMutation = useMutation({
    mutationFn: (agentId: string | null) =>
      apiPatch<{ ticket: TicketDetail }>(`/api/tickets/${id}/assign`, { agentId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', id] })
    },
  })

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="space-y-4 p-6">
        <Link
          to="/tickets"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to tickets
        </Link>
        {errorMessage && (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}
        {!errorMessage && isPending && (
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-64" />
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-4 w-32" />
            </CardContent>
          </Card>
        )}
        {!errorMessage && ticket && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>{ticket.subject}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant={STATUS_VARIANTS[ticket.status]}>{STATUS_LABELS[ticket.status]}</Badge>
                  {ticket.category ? (
                    <Badge variant="outline">{CATEGORY_LABELS[ticket.category]}</Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">Uncategorized</span>
                  )}
                </div>
                <p className="text-sm">
                  <span className="text-muted-foreground">Requester: </span>
                  {ticket.requesterName ? `${ticket.requesterName} · ` : ''}
                  {ticket.requesterEmail}
                </p>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Assigned to:</span>
                  {isAdmin ? (
                    <Select
                      items={[
                        { value: UNASSIGNED, label: 'Unassigned' },
                        ...agents.map((agent) => ({ value: agent.id, label: agent.name })),
                      ]}
                      value={ticket.assignedAgent?.id ?? UNASSIGNED}
                      onValueChange={(value) =>
                        assignMutation.mutate(value === UNASSIGNED ? null : value)
                      }
                    >
                      <SelectTrigger aria-label="Assigned agent" size="sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                        {agents.map((agent) => (
                          <SelectItem key={agent.id} value={agent.id}>
                            {agent.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span>{ticket.assignedAgent?.name ?? 'Unassigned'}</span>
                  )}
                  {assignMutation.isError && (
                    <span className="text-destructive">
                      {assignMutation.error instanceof ApiError
                        ? assignMutation.error.message
                        : 'Failed to assign ticket'}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Created {new Date(ticket.createdAt).toLocaleDateString()} · Updated{' '}
                  {new Date(ticket.updatedAt).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Messages</CardTitle>
              </CardHeader>
              <CardContent>
                {ticket.messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No messages yet.</p>
                ) : (
                  <div className="space-y-4">
                    {ticket.messages.map((message) => (
                      <div key={message.id} className="rounded-lg border border-border p-3">
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="font-medium">
                            {message.fromName ?? message.fromEmail} → {message.toEmail}
                          </span>
                          <span className="text-muted-foreground">
                            {new Date(message.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{message.body}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  )
}
