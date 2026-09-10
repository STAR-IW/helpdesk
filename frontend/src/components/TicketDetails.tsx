import type { ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { apiPatch, ApiError } from '@/lib/api'
import { sanitizeHtml } from '@/lib/sanitize'
import { STATUS_LABELS, type TicketStatus } from '@/constants/ticket-status'
import { CATEGORY_LABELS, type TicketCategory } from '@/constants/ticket-category'
import type { TicketDetail } from '@/constants/ticket'
import type { Agent } from '@/constants/agent'

const UNASSIGNED = 'unassigned'
const UNCATEGORIZED = 'uncategorized'

type TicketDetailsProps = {
  ticket: TicketDetail
  isAdmin: boolean
  agents: Agent[]
  children?: ReactNode
}

export function TicketDetails({ ticket, isAdmin, agents, children }: TicketDetailsProps) {
  const queryClient = useQueryClient()

  const assignMutation = useMutation({
    mutationFn: (agentId: string | null) =>
      apiPatch<{ ticket: TicketDetail }>(`/api/tickets/${ticket.id}`, { agentId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', ticket.id] })
    },
  })

  const statusMutation = useMutation({
    mutationFn: (status: TicketStatus) =>
      apiPatch<{ ticket: TicketDetail }>(`/api/tickets/${ticket.id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', ticket.id] })
    },
  })

  const categoryMutation = useMutation({
    mutationFn: (category: TicketCategory | null) =>
      apiPatch<{ ticket: TicketDetail }>(`/api/tickets/${ticket.id}`, { category }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', ticket.id] })
    },
  })

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_220px]">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>{ticket.subject}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">
              <span className="text-muted-foreground">Requester: </span>
              {ticket.requesterName ? `${ticket.requesterName} · ` : ''}
              {ticket.requesterEmail}
            </p>
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
                    {message.bodyHtml ? (
                      <div
                        className="text-sm [&_a]:underline"
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(message.bodyHtml) }}
                      />
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{message.body}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        {children}
      </div>
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Properties</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <span className="text-sm text-muted-foreground">Status</span>
              <Select
                items={Object.entries(STATUS_LABELS).map(([value, label]) => ({
                  value,
                  label,
                }))}
                value={ticket.status}
                onValueChange={(value) => statusMutation.mutate(value as TicketStatus)}
              >
                <SelectTrigger aria-label="Ticket status" size="sm" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {statusMutation.isError && (
                <p className="text-sm text-destructive">
                  {statusMutation.error instanceof ApiError
                    ? statusMutation.error.message
                    : 'Failed to update ticket'}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <span className="text-sm text-muted-foreground">Category</span>
              <Select
                items={[
                  { value: UNCATEGORIZED, label: 'Uncategorized' },
                  ...Object.entries(CATEGORY_LABELS).map(([value, label]) => ({
                    value,
                    label,
                  })),
                ]}
                value={ticket.category ?? UNCATEGORIZED}
                onValueChange={(value) =>
                  categoryMutation.mutate(value === UNCATEGORIZED ? null : (value as TicketCategory))
                }
              >
                <SelectTrigger aria-label="Ticket category" size="sm" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNCATEGORIZED}>Uncategorized</SelectItem>
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {categoryMutation.isError && (
                <p className="text-sm text-destructive">
                  {categoryMutation.error instanceof ApiError
                    ? categoryMutation.error.message
                    : 'Failed to update ticket'}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <span className="text-sm text-muted-foreground">Assigned to</span>
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
                  <SelectTrigger aria-label="Assigned agent" size="sm" className="w-full">
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
                <p className="text-sm">{ticket.assignedAgent?.name ?? 'Unassigned'}</p>
              )}
              {assignMutation.isError && (
                <p className="text-sm text-destructive">
                  {assignMutation.error instanceof ApiError
                    ? assignMutation.error.message
                    : 'Failed to assign ticket'}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
