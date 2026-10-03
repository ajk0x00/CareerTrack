import type { User } from '../types/auth'

interface DashboardProps {
  user: User
  onLogout: () => void
}

export default function Dashboard({ user, onLogout }: DashboardProps) {
  return (
    <main className="main-wrapper">
      <div className="auth-page-container">
        <div className="dashboard-card">
          <div className="dashboard-user-header">
            <div className="dashboard-avatar">
              {user.email.charAt(0).toUpperCase()}
            </div>
            <div className="dashboard-user-details">
              <h2>{user.email}</h2>
              <p>Authenticated via Career OS JWT</p>
            </div>
          </div>

          <table className="dashboard-info-table">
            <tbody>
              <tr>
                <td>User ID</td>
                <td>#{user.id}</td>
              </tr>
              <tr>
                <td>Account Status</td>
                <td style={{ color: user.is_active ? 'var(--tertiary)' : 'var(--error)' }}>
                  {user.is_active ? 'Active' : 'Inactive'}
                </td>
              </tr>
              <tr>
                <td>Registered On</td>
                <td>{new Date(user.created_at).toLocaleDateString()}</td>
              </tr>
            </tbody>
          </table>

          <button
            type="button"
            className="submit-btn"
            onClick={onLogout}
            style={{
              background: 'var(--surface-container-high)',
              color: 'var(--on-surface)',
              boxShadow: 'none',
            }}
          >
            <span className="material-symbols-outlined">logout</span>
            <span>Log out</span>
          </button>
        </div>
      </div>
    </main>
  )
}
