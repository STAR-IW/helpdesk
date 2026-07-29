import { Navbar } from '../components/Navbar'

export function HomePage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="p-6">
        <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
        <p className="mt-2 text-slate-600">You're logged in.</p>
      </main>
    </div>
  )
}
