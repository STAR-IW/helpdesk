import { Card, CardHeader, CardTitle } from '@/components/ui/card'

export function UsersPage() {
  return (
    <div className="min-h-screen bg-background">
      <main className="p-6">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Users</CardTitle>
          </CardHeader>
        </Card>
      </main>
    </div>
  )
}
