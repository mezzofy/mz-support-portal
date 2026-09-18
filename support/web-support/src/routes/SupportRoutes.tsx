/**
 * SupportRoutes — Support Console
 */
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthGuard } from '../presentation/features/auth/guards/AuthGuard'
import { QueuePage } from '../presentation/features/support/pages/QueuePage'
import { MyAssignedPage } from '../presentation/features/support/pages/MyAssignedPage'
import { SupportTicketDetailPage } from '../presentation/features/support/pages/SupportTicketDetailPage'

export function SupportRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/queue" replace />} />
      <Route path="/queue" element={<AuthGuard><QueuePage /></AuthGuard>} />
      <Route path="/my" element={<AuthGuard><MyAssignedPage /></AuthGuard>} />
      <Route path="/tickets/:id" element={<AuthGuard><SupportTicketDetailPage /></AuthGuard>} />
      <Route path="*" element={<Navigate to="/queue" replace />} />
    </Routes>
  )
}
