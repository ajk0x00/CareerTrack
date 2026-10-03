import type { User } from '../../types/auth'
import WorkspaceSwitcher from './WorkspaceSwitcher'
import UserMenu from './UserMenu'

interface WorkspaceNavbarProps {
  user: User
  currentWorkspace: string
  onSelectWorkspace: (name: string) => void
  onOpenExperience: () => void
  onOpenSkills: () => void
  onOpenSettings: () => void
  onLogout: () => void
}

export default function WorkspaceNavbar({
  user,
  currentWorkspace,
  onSelectWorkspace,
  onOpenExperience,
  onOpenSkills,
  onOpenSettings,
  onLogout,
}: WorkspaceNavbarProps) {
  return (
    <header className="ws-navbar">
      <div className="ws-navbar-inner">
        {/* Left Side: Brand & Workspace Navigation */}
        <div className="ws-nav-left">
          <div className="ws-brand-group">
            <div className="ws-brand-icon">C</div>
            <div className="ws-brand-text">
              <span className="ws-brand-title">CareerTrack</span>
              <span className="ws-brand-tag">Career OS</span>
            </div>
          </div>

          <div className="ws-v-divider hide-mobile"></div>

          <nav className="ws-breadcrumb hide-mobile">
            <span className="ws-crumb-root">Workspace</span>
            <span className="material-symbols-outlined ws-crumb-arrow">chevron_right</span>
            <WorkspaceSwitcher
              currentWorkspace={currentWorkspace}
              onSelectWorkspace={onSelectWorkspace}
            />
            <span className="ws-active-indicator">
              <span className="ws-pulse-dot"></span>
              Active
            </span>
          </nav>
        </div>

        {/* Right Side: Primary Navigation Links & User Profile */}
        <div className="ws-nav-right">
          <nav className="ws-primary-links hide-mobile">
            <button
              type="button"
              className="ws-nav-link"
              onClick={() => alert('Job Pipeline dashboard is active.')}
            >
              <span className="material-symbols-outlined nav-icon">business_center</span>
              <span>Job Pipeline</span>
            </button>

            <button
              type="button"
              className="ws-nav-link"
              onClick={onOpenExperience}
            >
              <span className="material-symbols-outlined nav-icon">work</span>
              <span>Experience</span>
            </button>

            <button
              type="button"
              className="ws-nav-link"
              onClick={onOpenSkills}
            >
              <span className="material-symbols-outlined nav-icon">psychology</span>
              <span>Skills</span>
            </button>
          </nav>

          <div className="ws-v-divider hide-mobile"></div>

          <UserMenu
            user={user}
            onOpenSettings={onOpenSettings}
            onLogout={onLogout}
          />
        </div>
      </div>
    </header>
  )
}
