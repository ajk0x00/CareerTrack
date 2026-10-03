import { Navigate, useLocation, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function PublicOnlyRoute() {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--surface)',
        }}
      >
        <div className="brand-badge">
          <span className="pulse-dot" />
          <span>Loading CareerTrack...</span>
        </div>
      </div>
    )
  }

  if (user) {
    const from = (location.state as { from?: { pathname?: string } })?.from?.pathname || '/'
    return <Navigate to={from} replace />
  }

  return <Outlet />
}
