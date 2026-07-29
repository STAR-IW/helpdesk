import { createBrowserRouter } from 'react-router'
import { LoginPage } from './pages/LoginPage'
import { HomePage } from './pages/HomePage'
import { ProtectedRoute } from './routes/ProtectedRoute'

function ProtectedHome() {
  return (
    <ProtectedRoute>
      <HomePage />
    </ProtectedRoute>
  )
}

export const router = createBrowserRouter([
  { path: '/login', Component: LoginPage },
  { path: '/', Component: ProtectedHome },
])
