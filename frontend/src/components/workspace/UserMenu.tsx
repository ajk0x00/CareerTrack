import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { User } from '../../types/auth'

interface UserMenuProps {
  user: User
  onOpenSettings: () => void
  onLogout: () => void
}

export default function UserMenu({
  user,
  onOpenSettings,
  onLogout,
}: UserMenuProps) {
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState<boolean>(false)
  const menuRef = useRef<HTMLDivElement>(null)


  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  // Derive a user-friendly name from user.name or email
  const displayName =
    user.name ||
    (user.email === 'demo@careertrack.app'
      ? 'Alex Chen'
      : user.email.split('@')[0].replace(/[._]/g, ' '))


  const initial = (displayName.charAt(0) || 'U').toUpperCase()

  return (
    <div className="user-menu-relative" ref={menuRef}>
      <button
        type="button"
        className="user-menu-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <div className="user-text-column">
          <span className="user-display-name">{displayName}</span>
          <span className="user-tier-badge">Pro Member</span>
        </div>
        <div className="user-avatar-circle">
          <span>{initial}</span>
        </div>
        <span className="material-symbols-outlined user-caret">expand_more</span>
      </button>

      {isOpen && (
        <div className="user-dropdown-panel">
          <div className="user-dropdown-header">
            <div className="user-header-name">{displayName}</div>
            <div className="user-header-email">{user.email}</div>
            <div className="user-header-badge-row">
              <span className="badge-pro">Pro Member</span>
            </div>
          </div>

          <div className="user-dropdown-items">
            <button
              type="button"
              className="user-dropdown-item"
              onClick={() => {
                setIsOpen(false)
                navigate('/settings')
                onOpenSettings()
              }}
            >
              <span className="material-symbols-outlined item-icon primary">settings</span>
              <div>
                <div className="item-title">Settings</div>
                <div className="item-subtitle">Profile, preferences &amp; companies</div>
              </div>
            </button>

            <button
              type="button"
              className="user-dropdown-item"
              onClick={() => {
                setIsOpen(false)
                navigate('/settings/preferences')
                onOpenSettings()
              }}
            >
              <span className="material-symbols-outlined item-icon">tune</span>
              <span className="item-title">Account Preferences</span>
            </button>

            <button
              type="button"
              className="user-dropdown-item"
              onClick={() => {
                setIsOpen(false)
                navigate('/pipeline')
              }}
            >
              <span className="material-symbols-outlined item-icon">business_center</span>
              <span className="item-title">Job Pipeline</span>
            </button>
          </div>

          <div className="dropdown-divider"></div>

          <button
            type="button"
            className="user-logout-btn"
            onClick={() => {
              setIsOpen(false)
              onLogout()
              navigate('/login')
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>logout</span>
            <span>Sign out</span>
          </button>
        </div>
      )}
    </div>
  )
}
