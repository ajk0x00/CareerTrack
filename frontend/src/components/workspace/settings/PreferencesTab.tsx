import { useState, useEffect } from 'react'
import type {
  PreferenceItem,
  PreferenceImportance,
  PreferenceCreateInput,
  PreferenceUpdateInput,
} from '../../../types/workspace'
import { useToast } from '../../ToastContext'

interface PreferencesTabProps {
  token?: string
}

interface PresetSuggestion {
  title: string
  description: string
  importance: PreferenceImportance
}

const PRESET_SUGGESTIONS: PresetSuggestion[] = [
  {
    title: '100% Remote (Worldwide / Flexible)',
    description: 'Autonomous distributed working model with async-first communication and minimal recurring synchronous meetings.',
    importance: 'critical',
  },
  {
    title: 'Target Compensation: $220,000 - $265,000 Total Comp',
    description: 'Competitive base salary + liquid equity (RSUs or top-tier secondary liquidity options) reflecting Staff/Lead engineering scope.',
    importance: 'high',
  },
  {
    title: 'Modern Cloud & Microservices Stack (Python, TS, Go)',
    description: 'High-throughput distributed systems using modern TypeScript/React, FastAPI/Python, Docker, and PostgreSQL.',
    importance: 'medium',
  },
  {
    title: 'Balanced On-Call & Observability Standards',
    description: 'Sensible rotation schedules, healthy paging thresholds, and post-mortem blameless engineering culture.',
    importance: 'medium',
  },
  {
    title: 'Staff / Principal Technical Leadership Track',
    description: 'Technical ownership over architectural RFCs, domain modeling, and mentoring senior engineers.',
    importance: 'high',
  },
]

export default function PreferencesTab({ token: propToken }: PreferencesTabProps) {
  const toast = useToast()
  const token =
    propToken ||
    localStorage.getItem('careerTrack_token') ||
    sessionStorage.getItem('careerTrack_token') ||
    ''

  const [preferences, setPreferences] = useState<PreferenceItem[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [filter, setFilter] = useState<'all' | PreferenceImportance>('all')

  // Creation State
  const [isCreating, setIsCreating] = useState<boolean>(false)
  const [newTitle, setNewTitle] = useState<string>('')
  const [newDescription, setNewDescription] = useState<string>('')
  const [newImportance, setNewImportance] = useState<PreferenceImportance>('medium')
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  // Edit State
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState<string>('')
  const [editDescription, setEditDescription] = useState<string>('')
  const [editImportance, setEditImportance] = useState<PreferenceImportance>('medium')
  const [isUpdating, setIsUpdating] = useState<boolean>(false)

  // Deletion State
  const [deletingId, setDeletingId] = useState<number | null>(null)

  // Fetch Preferences from Backend
  useEffect(() => {
    let isMounted = true
    const url =
      filter === 'all'
        ? '/api/v1/preferences'
        : `/api/v1/preferences?importance=${filter}`

    fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load career preferences')
        return res.json()
      })
      .then((data: PreferenceItem[]) => {
        if (isMounted) setPreferences(data)
      })
      .catch((err) => {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : 'Error fetching preferences'
          toast.error(msg, 'Network Error')
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [token, filter, toast])

  // Create Preference
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) {
      toast.error('Please enter a title for this preference', 'Validation Error')
      return
    }

    setIsSubmitting(true)
    try {
      const payload: PreferenceCreateInput = {
        title: newTitle.trim(),
        description: newDescription.trim() || null,
        importance: newImportance,
      }

      const res = await fetch('/api/v1/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        const msg = typeof errData.detail === 'string' ? errData.detail : 'Could not create preference'
        throw new Error(msg)
      }

      const createdItem: PreferenceItem = await res.json()
      setPreferences((prev) => [createdItem, ...prev])
      setNewTitle('')
      setNewDescription('')
      setNewImportance('medium')
      setIsCreating(false)
      toast.success(`"${createdItem.title}" saved to your career preferences.`, 'Preference Created')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save preference'
      toast.error(msg, 'Save Error')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Start Editing
  const startEditing = (pref: PreferenceItem) => {
    setEditingId(pref.id)
    setEditTitle(pref.title)
    setEditDescription(pref.description || '')
    setEditImportance(pref.importance)
  }

  // Save Edit
  const handleSaveEdit = async (id: number) => {
    if (!editTitle.trim()) {
      toast.error('Title cannot be empty', 'Validation Error')
      return
    }

    setIsUpdating(true)
    try {
      const payload: PreferenceUpdateInput = {
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        importance: editImportance,
      }

      const res = await fetch(`/api/v1/preferences/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        const msg = typeof errData.detail === 'string' ? errData.detail : 'Could not update preference'
        throw new Error(msg)
      }

      const updatedItem: PreferenceItem = await res.json()
      setPreferences((prev) =>
        prev.map((item) => (item.id === id ? updatedItem : item))
      )
      setEditingId(null)
      toast.success('Preference updated successfully!', 'Saved')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update'
      toast.error(msg, 'Update Error')
    } finally {
      setIsUpdating(false)
    }
  }

  // Delete Preference
  const handleDelete = async (id: number, title: string) => {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/v1/preferences/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!res.ok) {
        throw new Error('Failed to delete preference')
      }

      setPreferences((prev) => prev.filter((item) => item.id !== id))
      toast.info(`"${title}" has been removed from preferences.`, 'Preference Removed')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete'
      toast.error(msg, 'Delete Error')
    } finally {
      setDeletingId(null)
    }
  }

  // Apply suggestion
  const applyPreset = (preset: PresetSuggestion) => {
    setNewTitle(preset.title)
    setNewDescription(preset.description)
    setNewImportance(preset.importance)
    setIsCreating(true)
  }

  // Helper for badge styling
  const getImportanceMeta = (importance: PreferenceImportance) => {
    switch (importance) {
      case 'critical':
        return { label: 'Critical / Must-Have', icon: 'priority_high', className: 'pref-badge-critical' }
      case 'high':
        return { label: 'High Priority', icon: 'flag', className: 'pref-badge-high' }
      case 'medium':
        return { label: 'Medium Priority', icon: 'bookmark', className: 'pref-badge-medium' }
      case 'low':
        return { label: 'Low / Nice-to-Have', icon: 'low_priority', className: 'pref-badge-low' }
    }
  }

  return (
    <div className="settings-pane-form">
      {/* Top Header */}
      <div className="settings-pane-header">
        <div>
          <h4 className="settings-pane-title">Career Preferences &amp; Priorities</h4>
          <p className="settings-pane-desc">
            Define non-negotiables, target compensation, stacks, and work culture. These priorities guide ATS resume tailoring.
          </p>
        </div>
        <button
          type="button"
          className={`pref-add-btn ${isCreating ? 'active' : ''}`}
          onClick={() => setIsCreating(!isCreating)}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
            {isCreating ? 'close' : 'add'}
          </span>
          <span>{isCreating ? 'Cancel' : 'Add Preference'}</span>
        </button>
      </div>

      {/* Quick Add Form Drawer */}
      {isCreating && (
        <form className="pref-create-card" onSubmit={handleCreate}>
          <div className="pref-card-edit-header">
            <div className="pref-card-edit-title-group">
              <div className="pref-card-edit-icon-badge create">
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  add_circle
                </span>
              </div>
              <div>
                <div className="pref-card-edit-heading">New Career Preference</div>
                <div className="pref-card-edit-subheading">Define a non-negotiable requirement, compensation target, or stack preference</div>
              </div>
            </div>
            <button
              type="button"
              className="pref-inline-close-btn"
              onClick={() => setIsCreating(false)}
              title="Close"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                close
              </span>
            </button>
          </div>

          <div className="pref-edit-body">
            <div className="pref-field-group">
              <label htmlFor="pref-new-title" className="pref-field-label">
                Preference Title <span className="field-required">*</span>
              </label>
              <input
                id="pref-new-title"
                type="text"
                className="pref-field-input"
                placeholder="e.g. 100% Remote (Worldwide), Target Comp $240k+, No Crypto/Gambling"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                maxLength={255}
                required
                autoFocus
              />
            </div>

            <div className="pref-field-group">
              <label className="pref-field-label">Importance Level</label>
              <div className="pref-importance-selector">
                {(['critical', 'high', 'medium', 'low'] as PreferenceImportance[]).map((level) => {
                  const meta = getImportanceMeta(level)
                  return (
                    <button
                      key={level}
                      type="button"
                      className={`pref-importance-choice ${meta.className} ${
                        newImportance === level ? 'active' : ''
                      }`}
                      onClick={() => setNewImportance(level)}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
                        {meta.icon}
                      </span>
                      <span>{meta.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="pref-field-group">
              <label htmlFor="pref-new-desc" className="pref-field-label">
                Description / Context <span className="pref-field-optional">(Optional)</span>
              </label>
              <textarea
                id="pref-new-desc"
                className="pref-field-textarea"
                rows={3}
                placeholder="Add context, specifics, or boundary conditions for this preference..."
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                maxLength={2000}
              />
            </div>

            <div className="pref-create-actions">
              <button
                type="button"
                className="pref-btn-cancel"
                onClick={() => setIsCreating(false)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="pref-btn-save"
                disabled={isSubmitting || !newTitle.trim()}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                  save
                </span>
                <span>{isSubmitting ? 'Saving...' : 'Save Preference'}</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Filter Tabs */}
      <div className="pref-filter-bar">
        {(['all', 'critical', 'high', 'medium', 'low'] as const).map((lvl) => {
          const count =
            lvl === 'all'
              ? preferences.length
              : preferences.filter((p) => p.importance === lvl).length

          return (
            <button
              key={lvl}
              type="button"
              className={`pref-filter-pill ${filter === lvl ? 'active' : ''}`}
              onClick={() => setFilter(lvl)}
            >
              <span style={{ textTransform: 'capitalize' }}>
                {lvl === 'all' ? 'All Preferences' : lvl}
              </span>
              <span className="pref-filter-count">{count}</span>
            </button>
          )
        })}
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="pref-loading-box">
          <div className="pref-loading-spinner" />
          <span>Synchronizing preferences from server...</span>
        </div>
      )}

      {/* Preferences List */}
      {!isLoading && preferences.length > 0 && (
        <div className="pref-cards-list">
          {preferences.map((pref) => {
            const meta = getImportanceMeta(pref.importance)
            const isEditing = editingId === pref.id
            const isDeleting = deletingId === pref.id

            if (isEditing) {
              return (
                <div key={pref.id} className="pref-card pref-card-editing">
                  <div className="pref-card-edit-header">
                    <div className="pref-card-edit-title-group">
                      <div className="pref-card-edit-icon-badge">
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                          edit_note
                        </span>
                      </div>
                      <div>
                        <div className="pref-card-edit-heading">Edit Career Preference</div>
                        <div className="pref-card-edit-subheading">Update title, priority level, or boundary guidance</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="pref-inline-close-btn"
                      onClick={() => setEditingId(null)}
                      title="Cancel Edit"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                        close
                      </span>
                    </button>
                  </div>

                  <div className="pref-edit-body">
                    <div className="pref-field-group">
                      <label htmlFor={`edit-title-${pref.id}`} className="pref-field-label">
                        Title <span className="field-required">*</span>
                      </label>
                      <input
                        id={`edit-title-${pref.id}`}
                        type="text"
                        className="pref-field-input"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        maxLength={255}
                        placeholder="e.g. 100% Remote (Worldwide / Flexible)"
                        required
                        autoFocus
                      />
                    </div>

                    <div className="pref-field-group">
                      <label className="pref-field-label">Importance Level</label>
                      <div className="pref-importance-selector">
                        {(['critical', 'high', 'medium', 'low'] as PreferenceImportance[]).map((level) => {
                          const lvlMeta = getImportanceMeta(level)
                          return (
                            <button
                              key={level}
                              type="button"
                              className={`pref-importance-choice ${lvlMeta.className} ${
                                editImportance === level ? 'active' : ''
                              }`}
                              onClick={() => setEditImportance(level)}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
                                {lvlMeta.icon}
                              </span>
                              <span>{lvlMeta.label}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <div className="pref-field-group">
                      <label htmlFor={`edit-desc-${pref.id}`} className="pref-field-label">
                        Description / Guidance Notes <span className="pref-field-optional">(Optional)</span>
                      </label>
                      <textarea
                        id={`edit-desc-${pref.id}`}
                        className="pref-field-textarea"
                        rows={3}
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        maxLength={2000}
                        placeholder="Specific boundary conditions, preferred compensation details, or tech stacks..."
                      />
                    </div>

                    <div className="pref-edit-actions">
                      <button
                        type="button"
                        className="pref-btn-cancel"
                        onClick={() => setEditingId(null)}
                        disabled={isUpdating}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="pref-btn-save"
                        onClick={() => handleSaveEdit(pref.id)}
                        disabled={isUpdating || !editTitle.trim()}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                          check
                        </span>
                        <span>{isUpdating ? 'Saving...' : 'Save Changes'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )
            }

            return (
              <div key={pref.id} className="pref-card">
                <div className="pref-card-top-row">
                  <span className={`pref-badge ${meta.className}`}>
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                      {meta.icon}
                    </span>
                    <span>{meta.label}</span>
                  </span>

                  <div className="pref-card-actions">
                    <button
                      type="button"
                      className="pref-action-btn"
                      onClick={() => startEditing(pref)}
                      title="Edit preference"
                      disabled={isDeleting}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                        edit
                      </span>
                    </button>
                    <button
                      type="button"
                      className="pref-action-btn danger"
                      onClick={() => handleDelete(pref.id, pref.title)}
                      title="Delete preference"
                      disabled={isDeleting}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                        delete
                      </span>
                    </button>
                  </div>
                </div>

                <div className="pref-card-content">
                  <h5 className="pref-card-title">{pref.title}</h5>
                  {pref.description && (
                    <p className="pref-card-desc">{pref.description}</p>
                  )}
                </div>

                <div className="pref-card-footer">
                  <span className="pref-date-text">
                    Added: {new Date(pref.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && preferences.length === 0 && (
        <div className="pref-empty-box">
          <div className="pref-empty-icon-wrapper">
            <span className="material-symbols-outlined pref-empty-icon">
              playlist_add_check
            </span>
          </div>
          <h5 className="pref-empty-title">
            {filter === 'all'
              ? 'No career preferences defined yet'
              : `No ${filter} priority preferences found`}
          </h5>
          <p className="pref-empty-desc">
            Preferences define your career boundaries and requirements. Click a suggested template below or use the button above to add one.
          </p>

          <div className="pref-suggestions-section">
            <div className="pref-suggestions-title">Suggested Starter Templates:</div>
            <div className="pref-suggestions-grid">
              {PRESET_SUGGESTIONS.map((preset, idx) => {
                const meta = getImportanceMeta(preset.importance)
                return (
                  <button
                    key={idx}
                    type="button"
                    className="pref-suggestion-card"
                    onClick={() => applyPreset(preset)}
                  >
                    <div className="pref-suggestion-top">
                      <span className={`pref-badge ${meta.className}`}>
                        <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>
                          {meta.icon}
                        </span>
                        <span>{meta.label}</span>
                      </span>
                      <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--primary)' }}>
                        add_circle
                      </span>
                    </div>
                    <div className="pref-suggestion-name">{preset.title}</div>
                    <div className="pref-suggestion-desc">{preset.description}</div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
