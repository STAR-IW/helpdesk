import { useNavigate } from 'react-router'
import { authClient, useSession } from '../lib/auth-client'

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
    <nav className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
      <span className="text-lg font-semibold text-slate-900">Helpdesk</span>
      <div className="flex items-center gap-4">
        <span className="text-sm text-slate-600">{session?.user.name}</span>
        <button
          onClick={handleSignOut}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Sign out
        </button>
      </div>
    </nav>
  )
}
