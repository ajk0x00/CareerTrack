import type { ReactNode } from 'react'

interface NavbarProps {
  rightActions?: ReactNode
}

export default function Navbar({ rightActions }: NavbarProps) {
  return (
    <header className="app-header">
      <div className="header-container">
        <div className="brand-group">
          <div className="brand-icon">C</div>
          <span className="brand-name">CareerTrack</span>
        </div>

        <div className="header-actions">
          {rightActions ?? (
            <>
              <a href="#help" className="header-link">Help &amp; Support</a>
              <div className="header-divider"></div>
              <button type="button" className="header-btn" title="Language selection">
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>language</span>
                <span>EN</span>
              </button>
              <button type="button" className="header-btn" title="Toggle theme">
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>light_mode</span>
              </button>
              <button type="button" className="user-avatar-btn" title="Account">
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>person</span>
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
