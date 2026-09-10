import type { SenderType } from '@/constants/reply-sender-type'
import type { Agent } from '@/constants/agent'

export interface Reply {
  id: string
  senderType: SenderType
  body: string
  bodyHtml: string | null
  author: Agent | null
  createdAt: string
}
