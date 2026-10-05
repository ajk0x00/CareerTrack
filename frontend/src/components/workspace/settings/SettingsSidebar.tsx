import type { User } from '../../../types/auth'

export type SettingsTabId = 'profile' | 'career' | 'preferences' | 'optimization' | 'account'

interface SettingsSidebarProps {
  activeTab: SettingsTabId
  onTabChange: (tab: SettingsTabId) => void
  user: User
}

interface NavItem {
  id: SettingsTabId
  label: string
  sublabel: string
  icon: string
  badge?: string
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'profile',
    label: 'Profile & Identity',
    sublabel: 'Name, phone, socials & address',
    icon: 'person',
  },
  {
    id: 'career',
    label: 'Career',
    sublabel: 'Companies worked & timeline',
    icon: 'work_history',
  },
  {
    id: 'preferences',
    label: 'Career Preferences',
    sublabel: 'Target role, comp & location',
    icon: 'tune',
  },

  {
    id: 'optimization',
    label: 'ATS & Optimization',
    sublabel: 'Metric boost & keyword tuning',
    icon: 'auto_awesome',
    badge: 'AI',
  },
  {
    id: 'account',
    label: 'Account & Security',
    sublabel: 'Auth session & profile reset',
    icon: 'shield',
  },
]

export default function SettingsSidebar({
  activeTab,
  onTabChange,
  user,
}: SettingsSidebarProps) {
  const displayInitial = (user.name?.[0] || user.email[0] || 'U').toUpperCase()
  const displayTitle = user.name || user.email.split('@')[0]

  return (
    <aside className="settings-sidebar" aria-label="Settings navigation">
      <div className="settings-nav-group">
        <div className="settings-nav-header">SETTINGS</div>
        <nav className="settings-nav-list" role="tablist">
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`settings-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => onTabChange(item.id)}
              >
                <div className="settings-nav-item-icon-wrap">
                  <span className="material-symbols-outlined settings-nav-icon">
                    {item.icon}
                  </span>
                </div>
                <div className="settings-nav-item-text">
                  <div className="settings-nav-item-label-row">
                    <span className="settings-nav-label">{item.label}</span>
                    {item.badge && (
                      <span className="settings-nav-badge">{item.badge}</span>
                    )}
                  </div>
                  <span className="settings-nav-sublabel">{item.sublabel}</span>
                </div>
                {isActive && <div className="settings-nav-indicator" />}
              </button>
            )
          })}
        </nav>
      </div>

      <div className="settings-user-card">
        <div className="settings-user-avatar">{displayInitial}</div>
        <div className="settings-user-info">
          <div className="settings-user-name" title={displayTitle}>
            {displayTitle}
          </div>
          <div className="settings-user-email" title={user.email}>
            {user.email}
          </div>
        </div>
        <div className="settings-user-status-dot" title="Authenticated session" />
      </div>
    </aside>
  )
}
