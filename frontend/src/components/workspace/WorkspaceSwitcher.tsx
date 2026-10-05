import { useState, useRef, useEffect, useMemo } from 'react'
import type { WorkspaceItem } from '../../types/workspace'
import { useToast } from '../ToastContext'

interface WorkspaceSwitcherProps {
  currentWorkspace: string
  onSelectWorkspace: (name: string) => void
  token?: string
}

export default function WorkspaceSwitcher({
  currentWorkspace,
  onSelectWorkspace,
  token: propToken,
}: WorkspaceSwitcherProps) {
  const toast = useToast()
  const token =
    propToken ||
    localStorage.getItem('careerTrack_token') ||
    sessionStorage.getItem('careerTrack_token') ||
    ''

  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(() => Boolean(token))
  const [isOpen, setIsOpen] = useState<boolean>(false)
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Rename current workspace state
  const [isRenaming, setIsRenaming] = useState<boolean>(false)
  const [renameText, setRenameText] = useState<string>('')
  const [isSavingRename, setIsSavingRename] = useState<boolean>(false)

  // Dropdown item editing state
  const [editingItemWsId, setEditingItemWsId] = useState<number | null>(null)
  const [editingItemText, setEditingItemText] = useState<string>('')

  // Creation state
  const [isCreatingInline, setIsCreatingInline] = useState<boolean>(false)
  const [newWsTitle, setNewWsTitle] = useState<string>('')
  const [isSubmittingCreate, setIsSubmittingCreate] = useState<boolean>(false)

  const menuRef = useRef<HTMLDivElement>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)

  // Fetch workspaces on mount
  useEffect(() => {
    if (!token) return

    let isMounted = true
    fetch('/api/v1/workspaces', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load workspaces')
        return res.json()
      })
      .then(async (data: WorkspaceItem[]) => {
        if (!isMounted) return

        if (data.length === 0) {
          // Auto-provision initial workspace
          const defaultName = currentWorkspace || 'Tailored Resume Generator'
          try {
            const createRes = await fetch('/api/v1/workspaces', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ name: defaultName }),
            })
            if (createRes.ok) {
              const created: WorkspaceItem = await createRes.json()
              if (isMounted) {
                setWorkspaces([created])
                onSelectWorkspace(created.name)
              }
            }
          } catch {
            // fallback
          }
        } else {
          setWorkspaces(data)
          // If currentWorkspace doesn't match any backend workspace, select the first
          const exists = data.some((w) => w.name === currentWorkspace)
          if (!exists && data[0]) {
            onSelectWorkspace(data[0].name)
          }
        }
      })
      .catch((err) => {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : 'Error fetching workspaces'
          toast.error(msg, 'Network Error')
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [token, currentWorkspace, onSelectWorkspace, toast])

  // Handle outside click to close dropdown or cancel rename
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setIsCreatingInline(false)
        setEditingItemWsId(null)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  // Auto focus rename input when editing opens
  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [isRenaming])

  const activeWorkspace = useMemo(() => {
    return (
      workspaces.find((w) => w.name.toLowerCase() === currentWorkspace.toLowerCase()) ||
      workspaces[0]
    )
  }, [workspaces, currentWorkspace])

  // Start renaming current workspace
  const handleStartRename = () => {
    setRenameText(activeWorkspace ? activeWorkspace.name : currentWorkspace)
    setIsRenaming(true)
    setIsOpen(false)
  }

  // Save renamed workspace
  const handleSaveRename = async () => {
    const trimmed = renameText.trim()
    if (!trimmed) {
      toast.error('Workspace name cannot be empty', 'Validation Error')
      return
    }

    if (activeWorkspace && activeWorkspace.name === trimmed) {
      setIsRenaming(false)
      return
    }

    if (!activeWorkspace) {
      onSelectWorkspace(trimmed)
      setIsRenaming(false)
      return
    }

    setIsSavingRename(true)
    try {
      const res = await fetch(`/api/v1/workspaces/${activeWorkspace.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: trimmed }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        const msg =
          typeof errData.detail === 'string'
            ? errData.detail
            : 'Could not rename workspace'
        throw new Error(msg)
      }

      const updated: WorkspaceItem = await res.json()
      setWorkspaces((prev) =>
        prev.map((w) => (w.id === updated.id ? updated : w))
      )
      onSelectWorkspace(updated.name)
      setIsRenaming(false)
      toast.success(`Workspace renamed to "${updated.name}"`, 'Renamed')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Rename failed'
      toast.error(msg, 'Error')
    } finally {
      setIsSavingRename(false)
    }
  }

  // Create new workspace
  const handleCreateWorkspace = async () => {
    const trimmed = newWsTitle.trim()
    if (!trimmed) return

    setIsSubmittingCreate(true)
    try {
      const res = await fetch('/api/v1/workspaces', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: trimmed }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        const msg =
          typeof errData.detail === 'string'
            ? errData.detail
            : 'Could not create workspace'
        throw new Error(msg)
      }

      const created: WorkspaceItem = await res.json()
      setWorkspaces((prev) => [...prev, created])
      onSelectWorkspace(created.name)
      setNewWsTitle('')
      setIsCreatingInline(false)
      setIsOpen(false)
      toast.success(`Workspace "${created.name}" created`, 'Workspace Created')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create workspace'
      toast.error(msg, 'Create Error')
    } finally {
      setIsSubmittingCreate(false)
    }
  }

  // Delete workspace
  const handleDeleteWorkspace = async (id: number, name: string, e: React.MouseEvent) => {
    e.stopPropagation()

    if (workspaces.length <= 1) {
      toast.error('You must have at least one active workspace.', 'Cannot Delete')
      return
    }

    try {
      const res = await fetch(`/api/v1/workspaces/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!res.ok && res.status !== 204) {
        throw new Error('Failed to delete workspace')
      }

      const updated = workspaces.filter((w) => w.id !== id)
      setWorkspaces(updated)

      if (currentWorkspace.toLowerCase() === name.toLowerCase() && updated[0]) {
        onSelectWorkspace(updated[0].name)
      }

      toast.success(`"${name}" deleted`, 'Workspace Removed')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Delete failed'
      toast.error(msg, 'Error')
    }
  }

  // Filter workspaces by search query
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return workspaces
    return workspaces.filter((ws) =>
      ws.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
    )
  }, [workspaces, searchQuery])

  return (
    <div className="workspace-switcher-group" ref={menuRef}>
      {isRenaming ? (
        <div className="ws-rename-box">
          <input
            ref={renameInputRef}
            type="text"
            className="ws-rename-input"
            value={renameText}
            onChange={(e) => setRenameText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveRename()
              if (e.key === 'Escape') setIsRenaming(false)
            }}
            maxLength={100}
            disabled={isSavingRename}
          />
          <button
            type="button"
            className="ws-rename-action-btn check"
            onClick={handleSaveRename}
            disabled={isSavingRename || !renameText.trim()}
            title="Save name"
            aria-label="Save name"
          >
            {isSavingRename ? (
              <span className="pref-loading-spinner tiny" />
            ) : (
              <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
                check
              </span>
            )}
          </button>
          <button
            type="button"
            className="ws-rename-action-btn cancel"
            onClick={() => setIsRenaming(false)}
            disabled={isSavingRename}
            title="Cancel"
            aria-label="Cancel"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
              close
            </span>
          </button>
        </div>
      ) : (
        <div className="workspace-switcher-relative">
          <button
            type="button"
            className="workspace-switcher-trigger"
            onClick={() => setIsOpen(!isOpen)}
            aria-expanded={isOpen}
          >
            <span className="ws-current-title">{currentWorkspace}</span>
            <span className="material-symbols-outlined ws-caret">unfold_more</span>
          </button>

          <button
            type="button"
            className="workspace-edit-btn"
            onClick={handleStartRename}
            title="Edit workspace name"
            aria-label="Edit workspace name"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
              edit
            </span>
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
                <span className="ws-header-label">Your Workspaces</span>
                <span className="ws-count-badge">
                  {isLoading ? '...' : `${workspaces.length} Total`}
                </span>
              </div>

              <div className="ws-items-list">
                {isLoading && (
                  <div className="pref-loading-box" style={{ padding: '16px' }}>
                    <div className="pref-loading-spinner tiny" />
                    <span style={{ fontSize: '12px' }}>Loading workspaces...</span>
                  </div>
                )}

                {!isLoading &&
                  filtered.map((ws) => {
                    const isSelected =
                      ws.name.toLowerCase() === currentWorkspace.toLowerCase()
                    const isEditingItem = editingItemWsId === ws.id

                    if (isEditingItem) {
                      return (
                        <div key={ws.id} className="ws-rename-box" style={{ margin: '4px 0' }}>
                          <input
                            type="text"
                            className="ws-rename-input"
                            value={editingItemText}
                            onChange={(e) => setEditingItemText(e.target.value)}
                            onKeyDown={async (e) => {
                              if (e.key === 'Enter') {
                                const trimmed = editingItemText.trim()
                                if (!trimmed) return
                                try {
                                  const res = await fetch(`/api/v1/workspaces/${ws.id}`, {
                                    method: 'PATCH',
                                    headers: {
                                      'Content-Type': 'application/json',
                                      Authorization: `Bearer ${token}`,
                                    },
                                    body: JSON.stringify({ name: trimmed }),
                                  })
                                  if (res.ok) {
                                    const updated: WorkspaceItem = await res.json()
                                    setWorkspaces((prev) =>
                                      prev.map((w) => (w.id === ws.id ? updated : w))
                                    )
                                    if (isSelected) onSelectWorkspace(updated.name)
                                    setEditingItemWsId(null)
                                    toast.success('Workspace updated', 'Renamed')
                                  }
                                } catch {
                                  toast.error('Update failed', 'Error')
                                }
                              }
                              if (e.key === 'Escape') setEditingItemWsId(null)
                            }}
                            autoFocus
                            maxLength={100}
                          />
                          <button
                            type="button"
                            className="ws-rename-action-btn cancel"
                            onClick={() => setEditingItemWsId(null)}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                              close
                            </span>
                          </button>
                        </div>
                      )
                    }

                    return (
                      <button
                        key={ws.id}
                        type="button"
                        className={`ws-item-btn ${isSelected ? 'selected' : ''}`}
                        onClick={() => {
                          onSelectWorkspace(ws.name)
                          setIsOpen(false)
                        }}
                      >
                        <div className="ws-item-info">
                          <span
                            className="material-symbols-outlined ws-item-icon"
                            style={{
                              color: isSelected ? 'var(--primary)' : 'var(--outline)',
                            }}
                          >
                            workspaces
                          </span>
                          <div className="ws-item-text">
                            <div className="ws-item-title">{ws.name}</div>
                            <div className="ws-item-sub">
                              {isSelected ? 'Active Workspace' : 'Click to switch'}
                            </div>
                          </div>
                        </div>

                        <div className="ws-item-actions-group">
                          {isSelected && <span className="ws-badge-current">Current</span>}
                          <div className="ws-item-actions">
                            <span
                              className="ws-item-action-icon-btn"
                              title="Rename workspace"
                              onClick={(e) => {
                                e.stopPropagation()
                                setEditingItemWsId(ws.id)
                                setEditingItemText(ws.name)
                              }}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.stopPropagation()
                                  setEditingItemWsId(ws.id)
                                  setEditingItemText(ws.name)
                                }
                              }}
                            >
                              <span
                                className="material-symbols-outlined"
                                style={{ fontSize: '14px' }}
                              >
                                edit
                              </span>
                            </span>
                            <span
                              className="ws-item-action-icon-btn delete"
                              title="Delete workspace"
                              onClick={(e) => handleDeleteWorkspace(ws.id, ws.name, e)}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleDeleteWorkspace(ws.id, ws.name, e as unknown as React.MouseEvent)
                                }
                              }}
                            >
                              <span
                                className="material-symbols-outlined"
                                style={{ fontSize: '14px' }}
                              >
                                delete
                              </span>
                            </span>
                          </div>
                        </div>
                      </button>
                    )
                  })}

                {!isLoading && filtered.length === 0 && (
                  <div className="ws-empty-hint" style={{ padding: '12px', fontSize: '12px', color: 'var(--on-surface-variant)', textAlign: 'center' }}>
                    No workspaces found
                  </div>
                )}
              </div>

              <div className="dropdown-divider" />

              {isCreatingInline ? (
                <div className="ws-inline-create-box">
                  <input
                    type="text"
                    className="ws-inline-create-input"
                    placeholder="Workspace name..."
                    value={newWsTitle}
                    onChange={(e) => setNewWsTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateWorkspace()
                      if (e.key === 'Escape') setIsCreatingInline(false)
                    }}
                    autoFocus
                    maxLength={100}
                    disabled={isSubmittingCreate}
                  />
                  <button
                    type="button"
                    className="action-btn-primary"
                    style={{ padding: '4px 10px', fontSize: '11px' }}
                    onClick={handleCreateWorkspace}
                    disabled={isSubmittingCreate || !newWsTitle.trim()}
                  >
                    {isSubmittingCreate ? '...' : 'Create'}
                  </button>
                  <button
                    type="button"
                    className="pref-btn-cancel"
                    style={{ padding: '4px 8px', fontSize: '11px' }}
                    onClick={() => setIsCreatingInline(false)}
                    disabled={isSubmittingCreate}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="ws-create-btn"
                  onClick={() => setIsCreatingInline(true)}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                    add_circle
                  </span>
                  <span>Create New Workspace</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
