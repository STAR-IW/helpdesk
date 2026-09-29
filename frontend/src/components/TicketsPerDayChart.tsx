import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import type { DailyTicketCount } from '@/constants/dashboard'

const chartConfig = {
  count: { label: 'Tickets', color: 'var(--chart-2)' },
} satisfies ChartConfig

// Dates are UTC calendar days, so format in UTC to avoid shifting by the viewer's offset.
function formatDay(date: string, options: Intl.DateTimeFormatOptions): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, { ...options, timeZone: 'UTC' })
}

type TicketsPerDayChartProps = {
  data: DailyTicketCount[]
}

export function TicketsPerDayChart({ data }: TicketsPerDayChartProps) {
  const total = data.reduce((sum, d) => sum + d.count, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tickets per day</CardTitle>
        <CardDescription>Last 30 days · {total.toLocaleString()} tickets</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-56 w-full">
          <BarChart accessibilityLayer data={data}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={24}
              tickFormatter={(date: string) => formatDay(date, { month: 'short', day: 'numeric' })}
            />
            <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={32} />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) =>
                    formatDay(payload[0]?.payload.date, { weekday: 'short', month: 'short', day: 'numeric' })
                  }
                />
              }
            />
            <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
