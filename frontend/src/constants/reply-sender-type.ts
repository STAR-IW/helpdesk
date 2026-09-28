export const SENDER_TYPE_LABELS = {
  agent: 'Agent',
  customer: 'Customer',
  ai: 'AI',
} as const

export type SenderType = keyof typeof SENDER_TYPE_LABELS
