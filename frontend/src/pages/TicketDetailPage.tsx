import { useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Navbar } from '@/components/Navbar'
import { BackLink } from '@/components/BackLink'
import { TicketDetails } from '@/components/TicketDetails'
import type { TicketDetail } from '@/constants/ticket'
import type { Agent } from '@/constants/agent'
import { ReplyThread } from '@/components/ReplyThread'
import { ReplyForm } from '@/components/ReplyForm'
import { CardSkeleton } from '@/components/CardSkeleton'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { apiGet, ApiError } from '@/lib/api'
import { Role } from '@/constants/role'
import { useSession } from '@/lib/auth-client'

export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: session } = useSession()
  const isAdmin = session?.user.role === Role.admin

  const { data, error, isPending } = useQuery({
    queryKey: ['ticket', id],
    queryFn: () => apiGet<{ ticket: TicketDetail }>(`/api/tickets/${id}`),
  })
  const ticket = data?.ticket ?? null
  const errorMessage = error ? (error instanceof ApiError ? error.message : 'Failed to load ticket') : null

  const { data: agentsData } = useQuery({
    queryKey: ['users'],
    queryFn: () => apiGet<{ users: Agent[] }>('/api/users'),
    enabled: isAdmin,
  })
  const agents = agentsData?.users ?? []

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-5xl space-y-4 p-6">
        <BackLink to="/tickets">Back to tickets</BackLink>
        {errorMessage && (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}
        {!errorMessage && isPending && <CardSkeleton />}
        {!errorMessage && ticket && (
          <TicketDetails ticket={ticket} isAdmin={isAdmin} agents={agents}>
            <Card>
              <CardHeader>
                <CardTitle>Replies</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ReplyThread
                  replies={ticket.replies}
                  requesterName={ticket.requesterName}
                  requesterEmail={ticket.requesterEmail}
                />
                <ReplyForm ticketId={ticket.id} />
              </CardContent>
            </Card>
          </TicketDetails>
        )}
      </main>
    </div>
  )
}
