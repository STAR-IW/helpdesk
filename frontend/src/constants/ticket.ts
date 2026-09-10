import type { TicketStatus } from '@/constants/ticket-status'
import type { TicketCategory } from '@/constants/ticket-category'
import type { Agent } from '@/constants/agent'
import type { Reply } from '@/constants/reply'

export interface Ticket {
  id: string
  subject: string
  status: TicketStatus
  category: TicketCategory | null
  requesterEmail: string
  requesterName: string | null
  createdAt: string
  updatedAt: string
}

export interface TicketMessage {
  id: string
  fromEmail: string
  fromName: string | null
  toEmail: string
  body: string
  createdAt: string
}

export interface TicketDetail extends Ticket {
  assignedAgent: Agent | null
  messages: TicketMessage[]
  replies: Reply[]
}
