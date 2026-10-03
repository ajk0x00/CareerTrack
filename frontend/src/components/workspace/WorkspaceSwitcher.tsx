import { useState, useRef, useEffect } from 'react'

interface WorkspaceSwitcherProps {
  currentWorkspace: string
  onSelectWorkspace: (name: string) => void
}

const DEFAULT_WORKSPACES = [
  {
    name: 'Tailored Resume Generator',
    subtitle: 'Active • 3 tailored resumes',
    icon: 'check_circle',
    isCurrent: true,
  },
  {
    name: 'Executive Bio & Pitch Deck',
    subtitle: 'Updated 2d ago',
    icon: 'description',
    isCurrent: false,
  },
  {
    name: 'Cover Letter Synthesizer',
    subtitle: 'Updated 5d ago',
    icon: 'mail',
    isCurrent: false,
  },
  {
    name: 'Technical Interview Storybank',
    subtitle: 'Updated 1w ago',
    icon: 'record_voice_over',
    isCurrent: false,
  },
]

export default function WorkspaceSwitcher({
  currentWorkspace,
  onSelectWorkspace,
}: WorkspaceSwitcherProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false)
  const [searchQuery, setSearchQuery] = useState<string>('')
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

  const filtered = DEFAULT_WORKSPACES.filter((ws) =>
    ws.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleCreateNew = () => {
    const title = window.prompt('Enter title for the new workspace:')
    if (title && title.trim()) {
      onSelectWorkspace(title.trim())
      setIsOpen(false)
    }
  }

  return (
    <div className="workspace-switcher-relative" ref={menuRef}>
      <button
        type="button"
        className="workspace-switcher-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <span className="ws-current-title">{currentWorkspace}</span>
        <span className="material-symbols-outlined ws-caret">unfold_more</span>
      </button>

      {isOpen && (
        <div className="workspace-dropdown-panel">
          <div className="ws-search-wrapper">
            <span className="material-symbols-outlined ws-search-icon">search</span>
            <input
              type="text"
              className="ws-search-input"
              placeholder="Search workspaces..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
          </div>

          <div className="ws-header-row">
            <span className="ws-header-label">Recent Workspaces</span>
            <span className="ws-count-badge">{DEFAULT_WORKSPACES.length} Total</span>
          </div>

          <div className="ws-items-list">
            {filtered.map((ws, idx) => (
              <button
                key={idx}
                type="button"
                className={`ws-item-btn ${
                  ws.name === currentWorkspace ? 'selected' : ''
                }`}
                onClick={() => {
                  onSelectWorkspace(ws.name)
                  setIsOpen(false)
                }}
              >
                <div className="ws-item-info">
                  <span
                    className="material-symbols-outlined ws-item-icon"
                    style={{
                      color: ws.name === currentWorkspace ? 'var(--primary)' : 'var(--outline)',
                    }}
                  >
                    {ws.icon}
                  </span>
                  <div className="ws-item-text">
                    <div className="ws-item-title">{ws.name}</div>
                    <div className="ws-item-sub">{ws.subtitle}</div>
                  </div>
                </div>
                {ws.name === currentWorkspace && (
                  <span className="ws-badge-current">Current</span>
                )}
              </button>
            ))}
          </div>

          <div className="dropdown-divider"></div>

          <button
            type="button"
            className="ws-create-btn"
            onClick={handleCreateNew}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              add_circle
            </span>
            <span>Create New Workspace</span>
          </button>
        </div>
      )}
    </div>
  )
}
