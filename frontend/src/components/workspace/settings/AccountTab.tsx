import type { User } from '../../../types/auth'

interface AccountTabProps {
  user: User
  token: string
  onLogout: () => void
}

export default function AccountTab({
  user,
  onLogout,
}: AccountTabProps) {
  const formattedDate = user.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Active'

  return (
    <div className="settings-pane-form">
      <div className="settings-pane-header">
        <div>
          <h4 className="settings-pane-title">Account &amp; Security</h4>
          <p className="settings-pane-desc">
            View authentication session parameters and account metadata.
          </p>
        </div>
      </div>

      {/* Account Info */}
      <div className="settings-section-card">
        <div className="settings-section-header">
          <div className="settings-section-icon">
            <span className="material-symbols-outlined">badge</span>
          </div>
          <div>
            <h5 className="settings-section-title">Account Overview</h5>
            <p className="settings-section-desc">Identifiers tied to your authentication account</p>
          </div>
        </div>

        <div className="account-details-grid">
          <div className="account-detail-item">
            <div className="account-detail-label">User Identifier</div>
            <div className="account-detail-value mono">UID #{user.id}</div>
          </div>

          <div className="account-detail-item">
            <div className="account-detail-label">Account Email</div>
            <div className="account-detail-value">{user.email}</div>
          </div>

          <div className="account-detail-item">
            <div className="account-detail-label">Member Since</div>
            <div className="account-detail-value">{formattedDate}</div>
          </div>

          <div className="account-detail-item">
            <div className="account-detail-label">Status</div>
            <div className="account-detail-value" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="status-live-indicator" />
              <span>{user.is_active ? 'Active Pro Member' : 'Inactive'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Session Security */}
      <div className="settings-section-card" style={{ marginTop: '16px' }}>
        <div className="settings-section-header">
          <div className="settings-section-icon">
            <span className="material-symbols-outlined">lock</span>
          </div>
          <div>
            <h5 className="settings-section-title">Session &amp; Authentication</h5>
            <p className="settings-section-desc">Cryptographically signed JSON Web Token (JWT) session</p>
          </div>
        </div>

        <div className="session-info-row">
          <div>
            <div className="session-title">Secure Active Session</div>
            <div className="session-desc">
              Your session is authenticated via Bearer token with HMAC-SHA256 encryption.
            </div>
          </div>
          <button
            type="button"
            className="btn-secondary"
            onClick={onLogout}
            style={{ color: 'var(--error)' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
              logout
            </span>
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  )
}
