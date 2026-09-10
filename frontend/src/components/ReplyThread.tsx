import { SENDER_TYPE_LABELS, type SenderType } from '@/lib/reply-sender-type'
import type { Agent } from '@/components/TicketDetails'

export type Reply = {
  id: string
  senderType: SenderType
  body: string
  author: Agent | null
  createdAt: string
}

type ReplyThreadProps = {
  replies: Reply[]
  requesterName: string | null
  requesterEmail: string
}

export function ReplyThread({ replies, requesterName, requesterEmail }: ReplyThreadProps) {
  if (replies.length === 0) {
    return <p className="text-sm text-muted-foreground">No replies yet.</p>
  }

  return (
    <div className="space-y-4">
      {replies.map((reply) => (
        <div key={reply.id} className="rounded-lg border border-border p-3">
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-medium">
              {reply.author?.name ?? requesterName ?? requesterEmail}{' '}
              <span className="font-normal text-muted-foreground">
                ({SENDER_TYPE_LABELS[reply.senderType]})
              </span>
            </span>
            <span className="text-muted-foreground">
              {new Date(reply.createdAt).toLocaleString()}
            </span>
          </div>
          <p className="text-sm whitespace-pre-wrap">{reply.body}</p>
        </div>
      ))}
    </div>
  )
}
