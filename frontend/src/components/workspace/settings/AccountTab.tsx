import { useState } from 'react'
import type { User, ApiError } from '../../../types/auth'
import { useToast } from '../../ToastContext'


interface AccountTabProps {
  user: User
  token: string
  onProfileReset: () => void
  onLogout: () => void
}

export default function AccountTab({
  user,
  token,
  onProfileReset,
  onLogout,
}: AccountTabProps) {
  const toast = useToast()
  const [isResetting, setIsResetting] = useState<boolean>(false)
  const [showConfirmReset, setShowConfirmReset] = useState<boolean>(false)
  const [resetError, setResetError] = useState<string | null>(null)
  const [resetSuccess, setResetSuccess] = useState<string | null>(null)

  const handleResetProfile = async () => {
    setIsResetting(true)
    setResetError(null)
    setResetSuccess(null)

    try {
      const res = await fetch('/api/v1/profile', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!res.ok) {
        const errorData: ApiError = await res.json().catch(() => ({}))
        throw new Error(
          typeof errorData.detail === 'string'
            ? errorData.detail
            : 'Failed to reset profile'
        )
      }

      setResetSuccess('Profile fields have been reset.')
      toast.success('All personal profile fields have been cleared from the database.', 'Profile Reset')
      setShowConfirmReset(false)
      onProfileReset()
      setTimeout(() => setResetSuccess(null), 4000)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An error occurred'
      setResetError(msg)
      toast.error(msg, 'Reset Failed')
    } finally {
      setIsResetting(false)
    }
  }

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
            View authentication session parameters, account metadata, or reset saved profile data.
          </p>
        </div>
      </div>

      {resetError && (
        <div className="settings-alert-banner error" role="alert">
          <span className="material-symbols-outlined alert-icon">error</span>
          <span>{resetError}</span>
        </div>
      )}

      {resetSuccess && (
        <div className="settings-alert-banner success" role="status">
          <span className="material-symbols-outlined alert-icon">check_circle</span>
          <span>{resetSuccess}</span>
        </div>
      )}

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

      {/* Danger Zone: Reset Profile */}
      <div className="settings-section-card danger" style={{ marginTop: '16px' }}>
        <div className="settings-section-header">
          <div className="settings-section-icon danger">
            <span className="material-symbols-outlined">delete_sweep</span>
          </div>
          <div>
            <h5 className="settings-section-title danger">Danger Zone: Reset Profile Data</h5>
            <p className="settings-section-desc">
              Clear your saved name, phone number, address, and social links from the database.
            </p>
          </div>
        </div>

        {!showConfirmReset ? (
          <div style={{ marginTop: '12px' }}>
            <button
              type="button"
              className="btn-danger-outline"
              onClick={() => setShowConfirmReset(true)}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                warning
              </span>
              <span>Reset Profile Data</span>
            </button>
          </div>
        ) : (
          <div className="confirm-reset-box" style={{ marginTop: '12px' }}>
            <div className="confirm-reset-text">
              Are you sure? This will remove all personal profile details from the database. Your user account and login will remain intact.
            </div>
            <div className="confirm-reset-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowConfirmReset(false)}
                disabled={isResetting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger-filled"
                onClick={handleResetProfile}
                disabled={isResetting}
              >
                {isResetting ? 'Resetting...' : 'Yes, Reset My Profile'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
