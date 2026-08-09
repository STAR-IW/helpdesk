import { useNavigate } from 'react-router'
import { authClient, useSession } from '../lib/auth-client'
import { Button } from '@/components/ui/button'

export function Navbar() {
  const navigate = useNavigate()
  const { data: session } = useSession()

  async function handleSignOut() {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => navigate('/login', { replace: true }),
      },
    })
  }

  return (
    <nav className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
      <button
        type="button"
        onClick={() => navigate('/')}
        className="text-lg font-semibold text-foreground"
      >
        Helpdesk
      </button>
      <div className="flex items-center gap-4">
        {session?.user.role === 'admin' && (
          <Button variant="ghost" size="sm" onClick={() => navigate('/users')}>
            Users
          </Button>
        )}
        <span className="text-sm text-muted-foreground">{session?.user.name}</span>
        <Button variant="outline" size="sm" onClick={handleSignOut}>
          Sign out
        </Button>
      </div>
    </nav>
  )
}
