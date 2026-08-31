export const STATUS_LABELS = {
  open: 'Open',
  resolved: 'Resolved',
  closed: 'Closed',
} as const

export type TicketStatus = keyof typeof STATUS_LABELS

export const STATUS_VARIANTS: Record<TicketStatus, 'default' | 'secondary' | 'outline'> = {
  open: 'default',
  resolved: 'secondary',
  closed: 'outline',
}
