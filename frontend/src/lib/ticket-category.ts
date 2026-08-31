export const CATEGORY_LABELS = {
  generalQuestion: 'General question',
  technicalQuestion: 'Technical question',
  refundRequest: 'Refund request',
} as const

export type TicketCategory = keyof typeof CATEGORY_LABELS
