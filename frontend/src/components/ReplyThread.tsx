import { SENDER_TYPE_LABELS } from '@/constants/reply-sender-type'
import type { Reply } from '@/constants/reply'
import { sanitizeHtml } from '@/lib/sanitize'

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
          {reply.bodyHtml ? (
            <div
              className="text-sm [&_a]:underline"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(reply.bodyHtml) }}
            />
          ) : (
            <p className="text-sm whitespace-pre-wrap">{reply.body}</p>
          )}
        </div>
      ))}
    </div>
  )
}
