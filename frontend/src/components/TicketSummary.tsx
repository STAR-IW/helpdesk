import { Sparkles } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { apiPost, ApiError } from '@/lib/api'

type TicketSummaryProps = {
  ticketId: string
}

export function TicketSummary({ ticketId }: TicketSummaryProps) {
  const summaryMutation = useMutation({
    mutationFn: () => apiPost<{ summary: string }>(`/api/tickets/${ticketId}/summary`, {}),
  })

  const errorMessage = summaryMutation.isError
    ? summaryMutation.error instanceof ApiError
      ? summaryMutation.error.message
      : 'Failed to summarize ticket'
    : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {summaryMutation.data && (
          <p className="text-sm whitespace-pre-wrap">{summaryMutation.data.summary}</p>
        )}
        {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
        <Button
          type="button"
          variant="outline"
          onClick={() => summaryMutation.mutate()}
          disabled={summaryMutation.isPending}
        >
          <Sparkles />
          {summaryMutation.isPending
            ? 'Summarizing…'
            : summaryMutation.data
              ? 'Regenerate summary'
              : 'Summarize'}
        </Button>
      </CardContent>
    </Card>
  )
}
