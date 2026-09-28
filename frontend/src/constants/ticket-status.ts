export const STATUS_LABELS = {
  new: 'New',
  processing: 'Processing',
  open: 'Open',
  resolved: 'Resolved',
  closed: 'Closed',
} as const

export type TicketStatus = keyof typeof STATUS_LABELS

// Statuses an agent can filter by or set. new/processing tickets are still being handled
// by the AI pipeline: the API hides them from the list and rejects them on update.
export const SELECTABLE_STATUSES = ['open', 'resolved', 'closed'] as const satisfies readonly TicketStatus[]

export const STATUS_VARIANTS: Record<TicketStatus, 'default' | 'secondary' | 'outline'> = {
  new: 'outline',
  processing: 'outline',
  open: 'default',
  resolved: 'secondary',
  closed: 'outline',
}
