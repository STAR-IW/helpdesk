import { Navbar } from '@/components/Navbar'
import { TicketsTable } from '@/components/TicketsTable'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

export function TicketsPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Tickets</CardTitle>
          </CardHeader>
          <CardContent>
            <TicketsTable />
          </CardContent>
        </Card>
      </main>
    </div>
  )
}