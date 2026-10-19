import { useState, useEffect, useMemo } from 'react'
import type {
  CompanyWorkedItem,
  ExperienceItem,
  ExperienceLogItem,
} from '../../types/workspace'
import { useToast } from '../ToastContext'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'

interface ExperienceModalProps {
  isOpen: boolean
  onClose: () => void
  token?: string
  experiences?: ExperienceItem[]
  onAddExperience?: (item: ExperienceItem) => void
  onRemoveExperience?: (id: string) => void
  onExperienceLogsChange?: (items: ExperienceLogItem[]) => void
}

export default function ExperienceModal({
  isOpen,
  onClose,
  token: propToken,
  onExperienceLogsChange,
}: ExperienceModalProps) {
  const toast = useToast()
  useBodyScrollLock(isOpen)
  const token =
    propToken ||
    localStorage.getItem('careerTrack_token') ||
    sessionStorage.getItem('careerTrack_token') ||
    ''

  const [experienceLogs, setExperienceLogs] = useState<ExperienceLogItem[]>([])
  const [companies, setCompanies] = useState<CompanyWorkedItem[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(() => Boolean(token))
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Form State
  const [showDrawer, setShowDrawer] = useState<boolean>(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | ''>('')
  const [description, setDescription] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  // Fetch Experience Logs and Companies Worked on open
  useEffect(() => {
    if (!isOpen || !token) return

    let isMounted = true

    // 1. Fetch Experience Logs
    const fetchLogs = fetch('/api/v1/experience-logs', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load experience logs')
        return res.json()
      })
      .then((data: ExperienceLogItem[]) => {
        if (isMounted) {
          setExperienceLogs(data)
          if (onExperienceLogsChange) onExperienceLogsChange(data)
        }
      })

    // 2. Fetch Companies Worked to populate foreign-key dropdown
    const fetchCompanies = fetch('/api/v1/companies', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (!res.ok) return []
        return res.json()
      })
      .then((data: CompanyWorkedItem[]) => {
        if (isMounted && Array.isArray(data)) {
          setCompanies(data)
        }
      })
      .catch(() => {
        // Non-blocking error for company dropdown
      })

    Promise.all([fetchLogs, fetchCompanies])
      .catch((err) => {
        if (isMounted) {
          const msg =
            err instanceof Error ? err.message : 'Error fetching experience data'
          toast.error(msg, 'Network Error')
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [isOpen, token, onExperienceLogsChange, toast])

  // Reset form
  const handleResetForm = () => {
    setEditingId(null)
    setSelectedCompanyId('')
    setDescription('')
    setShowDrawer(false)
  }

  // Populate form to edit an existing log
  const handleStartEdit = (log: ExperienceLogItem) => {
    setEditingId(log.id)
    setSelectedCompanyId(log.company_id)
    setDescription(log.description)
    setShowDrawer(true)
  }

  // Save (Create or Update) Experience Log
  const handleSaveForm = async () => {
    if (selectedCompanyId === '') {
      toast.error('Please select a company worked in', 'Validation Error')
      return
    }

    if (!description.trim()) {
      toast.error('Please provide a description of the experience', 'Validation Error')
      return
    }

    const companyRecord = companies.find((c) => c.id === selectedCompanyId)
    const companyDisplayName = companyRecord?.company_name || 'Selected Company'

    setIsSubmitting(true)
    try {
      if (editingId !== null) {
        // Update existing entry
        const res = await fetch(`/api/v1/experience-logs/${editingId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            company_id: Number(selectedCompanyId),
            description: description.trim(),
          }),
        })

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.detail || 'Failed to update experience log')
        }

        const updatedItem: ExperienceLogItem = await res.json()
        const updatedList = experienceLogs.map((l) =>
          l.id === editingId ? updatedItem : l
        )
        setExperienceLogs(updatedList)
        if (onExperienceLogsChange) onExperienceLogsChange(updatedList)
        toast.success(`Updated experience at ${companyDisplayName}`, 'Experience Updated')
      } else {
        // Create new entry
        const res = await fetch('/api/v1/experience-logs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            company_id: Number(selectedCompanyId),
            description: description.trim(),
          }),
        })

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.detail || 'Failed to create experience log')
        }

        const createdItem: ExperienceLogItem = await res.json()
        const updatedList = [createdItem, ...experienceLogs]
        setExperienceLogs(updatedList)
        if (onExperienceLogsChange) onExperienceLogsChange(updatedList)
        toast.success(`Logged experience at ${companyDisplayName}`, 'Experience Created')
      }

      handleResetForm()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not save experience'
      toast.error(msg, 'Save Error')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Delete Experience Log
  const handleDelete = async (id: number, companyName: string) => {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/v1/experience-logs/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!res.ok && res.status !== 204) {
        throw new Error('Failed to delete experience log')
      }

      const updatedList = experienceLogs.filter((l) => l.id !== id)
      setExperienceLogs(updatedList)
      if (onExperienceLogsChange) onExperienceLogsChange(updatedList)
      toast.success(`Removed experience at ${companyName}`, 'Experience Deleted')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not delete experience log'
      toast.error(msg, 'Delete Error')
    } finally {
      setDeletingId(null)
    }
  }

  // Filtered List
  const displayedList = useMemo(() => {
    if (!searchQuery.trim()) return experienceLogs
    const q = searchQuery.trim().toLowerCase()
    return experienceLogs.filter(
      (log) =>
        (log.company_name && log.company_name.toLowerCase().includes(q)) ||
        log.description.toLowerCase().includes(q)
    )
  }, [experienceLogs, searchQuery])

  if (!isOpen) return null

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-container modal-wide"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon-badge primary">
              <span className="material-symbols-outlined">work_history</span>
            </div>
            <div>
              <div className="modal-headline-row">
                <h3 className="modal-title">Experience Log</h3>
                <span className="pill-badge primary">
                  {experienceLogs.length} Logged Entries
                </span>
              </div>
              <p className="modal-subtitle">
                Track, update, and manage your career experiences and company achievements
              </p>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Filter & Action Toolbar */}
        <div className="modal-toolbar">
          <div className="filter-group">
            <div className="input-with-icon" style={{ minWidth: '260px' }}>
              <span className="material-symbols-outlined input-leading-icon">search</span>
              <input
                type="text"
                className="compact-input"
                placeholder="Search by company or keyword..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            {searchQuery && (
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: '6px 12px', fontSize: '12px' }}
                onClick={() => setSearchQuery('')}
              >
                Clear
              </button>
            )}
          </div>
          <button
            type="button"
            className="action-btn-primary"
            onClick={() => {
              if (showDrawer) {
                handleResetForm()
              } else {
                setShowDrawer(true)
              }
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              {showDrawer ? 'close' : 'add'}
            </span>
            <span>{showDrawer ? 'Cancel' : 'Log New Experience'}</span>
          </button>
        </div>

        {/* Scrollable Modal Content */}
        <div className="modal-body-scroll">
          {/* Add/Edit Drawer Form */}
        {showDrawer && (
          <div className="drawer-panel">
            <div className="drawer-header">
              <div className="drawer-title">
                <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>
                  edit_document
                </span>
                <h4>{editingId !== null ? 'Edit Experience Log' : 'Log New Experience'}</h4>
              </div>
              <span className="drawer-subtitle">Auto-syncs to ATS Engine</span>
            </div>

            {/* Company Selection Dropdown (Foreign Key to companies_worked) */}
            <div className="form-group-compact">
              <label className="compact-label">Company Worked In *</label>
              <div className="input-with-icon">
                <span className="material-symbols-outlined input-leading-icon">apartment</span>
                <select
                  className="compact-select"
                  value={selectedCompanyId}
                  onChange={(e) =>
                    setSelectedCompanyId(e.target.value ? Number(e.target.value) : '')
                  }
                >
                  <option value="">Select a company from your career...</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company_name} {c.actively_working ? '(Current Role)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {companies.length === 0 && (
                <p className="hint-text" style={{ color: 'var(--tertiary)' }}>
                  No companies found. Please add your employers in Career Settings to associate experience logs with them.
                </p>
              )}
            </div>

            {/* Description Textarea */}
            <div className="form-group-compact" style={{ marginTop: '12px' }}>
              <div className="flex-between">
                <label className="compact-label">Description of Experience *</label>
                <span className="highlight-tag">Impact &amp; Accomplishments</span>
              </div>
              <textarea
                className="compact-textarea"
                rows={4}
                placeholder="Describe what you worked on, projects launched, quantifiable impact, and technical accomplishments..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <p className="hint-text">
                Include measurable outcomes and technical details to power ATS resume tailoring.
              </p>
            </div>

            <div className="drawer-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={handleResetForm}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="action-btn-primary"
                onClick={handleSaveForm}
                disabled={isSubmitting || companies.length === 0}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                  {isSubmitting ? 'hourglass_top' : 'save'}
                </span>
                <span>
                  {isSubmitting
                    ? 'Saving...'
                    : editingId !== null
                    ? 'Update Experience'
                    : 'Save Experience'}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Experience Records List */}
        {isLoading ? (
          <div className="empty-pipeline-state" style={{ padding: '40px 20px' }}>
            <span
              className="material-symbols-outlined empty-icon spin-indicator"
              style={{ animation: 'spin 1.5s linear infinite' }}
            >
              refresh
            </span>
            <span>Loading experience logs...</span>
          </div>
        ) : displayedList.length === 0 ? (
          <div className="empty-pipeline-state" style={{ padding: '40px 20px' }}>
            <span className="material-symbols-outlined empty-icon">work_history</span>
            <span style={{ fontWeight: 600, color: 'var(--on-surface)' }}>
              {searchQuery ? 'No matching experience entries' : 'No experience logs recorded yet'}
            </span>
            <span
              style={{
                fontSize: '13px',
                color: 'var(--on-surface-variant)',
                marginTop: '4px',
              }}
            >
              {searchQuery
                ? `No experience entries match "${searchQuery}".`
                : 'Log your accomplishments at work to power ATS-friendly tailored resumes.'}
            </span>
            {!showDrawer && !searchQuery && (
              <button
                type="button"
                className="action-btn-primary"
                style={{ marginTop: '16px' }}
                onClick={() => setShowDrawer(true)}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  add
                </span>
                <span>Log First Experience</span>
              </button>
            )}
          </div>
        ) : (
          <div className="records-list">
            {displayedList.map((item) => {
              const displayCompanyName =
                item.company_name ||
                companies.find((c) => c.id === item.company_id)?.company_name ||
                'Company'

              return (
                <div key={item.id} className="record-card">
                  <div className="record-header">
                    <div className="record-title-row">
                      <div className="company-avatar">
                        {displayCompanyName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="company-name-row">
                          <span className="company-name">{displayCompanyName}</span>
                          <span className="badge-period">
                            {new Date(item.created_at).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="record-actions">
                      <button
                        type="button"
                        className="action-icon-btn"
                        onClick={() => handleStartEdit(item)}
                        title="Edit Experience"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                          edit
                        </span>
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        className="action-icon-btn error"
                        onClick={() => handleDelete(item.id, displayCompanyName)}
                        disabled={deletingId === item.id}
                        title="Remove Experience"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                          delete
                        </span>
                        <span>{deletingId === item.id ? 'Deleting...' : 'Remove'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="record-body">
                    <p className="record-desc" style={{ whiteSpace: 'pre-wrap' }}>
                      {item.description}
                    </p>
                  </div>

                  <div className="record-footer">
                    <div className="record-meta">
                      <span className="meta-verified">
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                          verified
                        </span>
                        Logged &amp; Synced
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <button
            type="button"
            className="action-btn-outline"
            onClick={() => {
              handleResetForm()
              setShowDrawer(true)
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              add_circle
            </span>
            <span>Log Another Experience</span>
          </button>
          <div className="modal-footer-btns">
            <button type="button" className="action-btn-primary" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
