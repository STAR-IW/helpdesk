import { createBrowserRouter } from 'react-router'
import { LoginPage } from './pages/LoginPage'
import { HomePage } from './pages/HomePage'
import { TicketsPage } from './pages/TicketsPage'
import { UsersPage } from './pages/UsersPage'
import { ProtectedRoute } from './routes/ProtectedRoute'

function ProtectedHome() {
  return (
    <ProtectedRoute>
      <HomePage />
    </ProtectedRoute>
  )
}

function ProtectedTickets() {
  return (
    <ProtectedRoute>
      <TicketsPage />
    </ProtectedRoute>
  )
}

function ProtectedUsers() {
  return (
    <ProtectedRoute role="admin">
      <UsersPage />
    </ProtectedRoute>
  )
}

export const router = createBrowserRouter([
  { path: '/login', Component: LoginPage },
  { path: '/', Component: ProtectedHome },
  { path: '/tickets', Component: ProtectedTickets },
  { path: '/users', Component: ProtectedUsers },
])
