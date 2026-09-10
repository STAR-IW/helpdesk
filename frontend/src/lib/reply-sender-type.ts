export const SENDER_TYPE_LABELS = {
  agent: 'Agent',
  customer: 'Customer',
} as const

export type SenderType = keyof typeof SENDER_TYPE_LABELS
