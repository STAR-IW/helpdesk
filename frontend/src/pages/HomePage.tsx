import { useQuery } from '@tanstack/react-query'
import { Navbar } from '../components/Navbar'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { apiGet, ApiError } from '@/lib/api'
import { TicketsPerDayChart } from '@/components/TicketsPerDayChart'
import type { DashboardStats, DailyTicketCount } from '@/constants/dashboard'

// Formats a duration as its two largest units, e.g. "2d 4h", "3h 12m", "45m".
function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—'
  const minutes = Math.round(seconds / 60)
  if (minutes < 1) return '< 1m'
  const days = Math.floor(minutes / (24 * 60))
  const hours = Math.floor((minutes % (24 * 60)) / 60)
  const mins = minutes % 60
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

function statCards(stats: DashboardStats) {
  return [
    { label: 'Total tickets', value: stats.totalTickets.toLocaleString() },
    { label: 'Open tickets', value: stats.openTickets.toLocaleString() },
    { label: 'Resolved by AI', value: stats.aiResolvedTickets.toLocaleString() },
    { label: 'Resolved by AI (%)', value: `${stats.aiResolvedPercent}%` },
    { label: 'Avg resolution time', value: formatDuration(stats.avgResolutionSeconds) },
  ]
}

const STAT_COUNT = 5

export function HomePage() {
  const { data, error, isPending } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => apiGet<{ stats: DashboardStats; ticketsPerDay: DailyTicketCount[] }>('/api/dashboard/stats'),
  })
  const errorMessage = error
    ? error instanceof ApiError
      ? error.message
      : 'Failed to load dashboard'
    : null

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="space-y-4 p-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        {errorMessage && (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}
        {!errorMessage && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {isPending &&
              Array.from({ length: STAT_COUNT }).map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-4 w-28" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-8 w-16" />
                  </CardContent>
                </Card>
              ))}
            {data &&
              statCards(data.stats).map((stat) => (
                <Card key={stat.label}>
                  <CardHeader>
                    <CardDescription>{stat.label}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <CardTitle className="text-3xl font-semibold tabular-nums">{stat.value}</CardTitle>
                  </CardContent>
                </Card>
              ))}
          </div>
        )}
        {!errorMessage && isPending && (
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-36" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-56 w-full" />
            </CardContent>
          </Card>
        )}
        {!errorMessage && data && <TicketsPerDayChart data={data.ticketsPerDay} />}
      </main>
    </div>
  )
}
