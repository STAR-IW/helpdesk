import { Navbar } from '../components/Navbar'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="p-6">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Dashboard</CardTitle>
            <CardDescription>You're logged in.</CardDescription>
          </CardHeader>
        </Card>
      </main>
    </div>
  )
}
