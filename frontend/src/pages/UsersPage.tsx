import { useQuery } from '@tanstack/react-query'
import { Navbar } from '@/components/Navbar'
import { CreateUserDialog } from '@/components/CreateUserDialog'
import { EditUserDialog } from '@/components/EditUserDialog'
import { DeleteUserDialog } from '@/components/DeleteUserDialog'
import { Card, CardHeader, CardTitle, CardAction, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { apiGet, ApiError, type Role } from '@/lib/api'

type User = {
  id: string
  name: string
  email: string
  role: Role
  createdAt: string
}

export function UsersPage() {
  const {
    data,
    error,
    isPending,
  } = useQuery({
    queryKey: ['users'],
    queryFn: () => apiGet<{ users: User[] }>('/api/users'),
  })
  const users = data?.users ?? null
  const errorMessage = error ? (error instanceof ApiError ? error.message : 'Failed to load users') : null

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Users</CardTitle>
            <CardAction>
              <CreateUserDialog />
            </CardAction>
          </CardHeader>
          <CardContent>
            {errorMessage && (
              <Alert variant="destructive">
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}
            {!errorMessage && isPending && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Edit</TableHead>
                    <TableHead>Delete</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-40" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-14 rounded-4xl" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-16" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="size-8" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="size-8" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {!errorMessage && users !== null && users.length === 0 && (
              <p className="text-sm text-muted-foreground">No users found.</p>
            )}
            {!errorMessage && users !== null && users.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Edit</TableHead>
                    <TableHead>Delete</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <EditUserDialog user={user} />
                      </TableCell>
                      <TableCell>
                        <DeleteUserDialog user={user} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
