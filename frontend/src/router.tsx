import { createBrowserRouter } from 'react-router'
import { Role } from './constants/role'
import { LoginPage } from './pages/LoginPage'
import { HomePage } from './pages/HomePage'
import { TicketsPage } from './pages/TicketsPage'
import { TicketDetailPage } from './pages/TicketDetailPage'
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

function ProtectedTicketDetail() {
  return (
    <ProtectedRoute>
      <TicketDetailPage />
    </ProtectedRoute>
  )
}

function ProtectedUsers() {
  return (
    <ProtectedRoute role={Role.admin}>
      <UsersPage />
    </ProtectedRoute>
  )
}

export const router = createBrowserRouter([
  { path: '/login', Component: LoginPage },
  { path: '/', Component: ProtectedHome },
  { path: '/tickets', Component: ProtectedTickets },
  { path: '/tickets/:id', Component: ProtectedTicketDetail },
  { path: '/users', Component: ProtectedUsers },
])
