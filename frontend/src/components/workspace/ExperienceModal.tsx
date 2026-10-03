import { useState } from 'react'
import type { ExperienceItem } from '../../types/workspace'

interface ExperienceModalProps {
  isOpen: boolean
  onClose: () => void
  experiences: ExperienceItem[]
  onAddExperience: (item: ExperienceItem) => void
  onRemoveExperience: (id: string) => void
}

export default function ExperienceModal({
  isOpen,
  onClose,
  experiences,
  onAddExperience,
  onRemoveExperience,
}: ExperienceModalProps) {
  const [showDrawer, setShowDrawer] = useState<boolean>(false)
  const [filter, setFilter] = useState<'all' | 'fulltime'>('all')

  // Form State
  const [company, setCompany] = useState<string>('')
  const [role, setRole] = useState<string>('')
  const [period, setPeriod] = useState<string>('2022 - Present')
  const [location, setLocation] = useState<string>('San Francisco, CA (Remote)')
  const [description, setDescription] = useState<string>('')

  if (!isOpen) return null

  const handleSaveForm = () => {
    if (!company.trim() || !role.trim()) {
      alert('Please provide company name and role.')
      return
    }

    const newItem: ExperienceItem = {
      id: `exp-${Date.now()}`,
      company,
      role,
      period,
      location,
      description: description || 'Responsible for architecting scalable cloud systems.',
      bullets: [
        'Optimized critical workflow performance and reduced system latency.',
        'Mentored engineering teams and established architectural standards.',
      ],
      metricsCount: 2,
      skills: ['TypeScript', 'Cloud Infra', 'React'],
      isCurrent: period.toLowerCase().includes('present'),
    }

    onAddExperience(newItem)
    setCompany('')
    setRole('')
    setDescription('')
    setShowDrawer(false)
  }

  const displayedList =
    filter === 'all'
      ? experiences
      : experiences.filter((e) => !e.isCurrent || e.period.includes('Jan 2019'))

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
                  {experiences.length} Logged Roles
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

        {/* Filter & Action Bar */}
        <div className="modal-toolbar">
          <div className="filter-group">
            <span className="filter-label">Filter:</span>
            <button
              type="button"
              className={`filter-pill ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All Experiences ({experiences.length})
            </button>
            <button
              type="button"
              className={`filter-pill ${filter === 'fulltime' ? 'active' : ''}`}
              onClick={() => setFilter('fulltime')}
            >
              Full-Time
            </button>
          </div>
          <button
            type="button"
            className="action-btn-primary"
            onClick={() => setShowDrawer(!showDrawer)}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              {showDrawer ? 'remove' : 'add'}
            </span>
            <span>{showDrawer ? 'Hide Form' : 'Log New Experience'}</span>
          </button>
        </div>

        {/* Add/Edit Drawer */}
        {showDrawer && (
          <div className="drawer-panel">
            <div className="drawer-header">
              <div className="drawer-title">
                <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>
                  edit_document
                </span>
                <h4>Log New Experience</h4>
              </div>
              <span className="drawer-subtitle">Auto-syncs to ATS Engine</span>
            </div>

            <div className="grid-two-cols">
              <div className="form-group-compact">
                <label className="compact-label">Company Name *</label>
                <div className="input-with-icon">
                  <span className="material-symbols-outlined input-leading-icon">apartment</span>
                  <input
                    type="text"
                    className="compact-input"
                    placeholder="e.g. Netflix, Airbnb, Stripe..."
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group-compact">
                <label className="compact-label">Role / Title *</label>
                <div className="input-with-icon">
                  <span className="material-symbols-outlined input-leading-icon">badge</span>
                  <input
                    type="text"
                    className="compact-input"
                    placeholder="e.g. Staff Software Engineer"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="grid-two-cols" style={{ marginTop: '12px' }}>
              <div className="form-group-compact">
                <label className="compact-label">Employment Period *</label>
                <div className="input-with-icon">
                  <span className="material-symbols-outlined input-leading-icon">calendar_today</span>
                  <input
                    type="text"
                    className="compact-input"
                    placeholder="e.g. Jan 2022 – Present"
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group-compact">
                <label className="compact-label">Location &amp; Type</label>
                <div className="input-with-icon">
                  <span className="material-symbols-outlined input-leading-icon">location_on</span>
                  <input
                    type="text"
                    className="compact-input"
                    placeholder="e.g. San Francisco, CA (Remote)"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="form-group-compact" style={{ marginTop: '12px' }}>
              <div className="flex-between">
                <label className="compact-label">Experience &amp; Impact Description *</label>
                <span className="highlight-tag">Metric Amplification Active</span>
              </div>
              <textarea
                className="compact-textarea"
                rows={3}
                placeholder="Describe your responsibilities, projects launched, quantifiable impact, and technologies used (e.g. Scaled payments pipeline by 35%, processed $1.2B volume with 99.99% SLA)..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <p className="hint-text">
                Pro-tip: Include raw metrics ($ revenue, % latency, team count) to automatically score higher in ATS tailoring.
              </p>
            </div>

            <div className="drawer-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowDrawer(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="action-btn-primary"
                onClick={handleSaveForm}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>save</span>
                <span>Save Experience</span>
              </button>
            </div>
          </div>
        )}

        {/* Experience Records List */}
        <div className="records-list">
          {displayedList.map((item) => (
            <div key={item.id} className="record-card">
              <div className="record-header">
                <div className="record-title-row">
                  <div className="company-avatar">
                    {item.company.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="company-name-row">
                      <span className="company-name">{item.company}</span>
                      {item.isCurrent && (
                        <span className="badge-status-active">
                          <span className="pulse-indicator"></span>
                          Current Role
                        </span>
                      )}
                      <span className="badge-period">{item.period}</span>
                    </div>
                    <div className="role-title-highlight">{item.role}</div>
                  </div>
                </div>

                <div className="record-actions">
                  <button
                    type="button"
                    className="action-icon-btn error"
                    onClick={() => onRemoveExperience(item.id)}
                    title="Remove Experience"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>delete</span>
                    <span>Remove</span>
                  </button>
                </div>
              </div>

              <div className="record-body">
                <p className="record-desc">{item.description}</p>
                {item.bullets.length > 0 && (
                  <ul className="record-bullets">
                    {item.bullets.map((b, idx) => (
                      <li key={idx}>{b}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="record-footer">
                <div className="record-meta">
                  <span className="meta-verified">
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>verified</span>
                    Logged &amp; Verified
                  </span>
                  <span>•</span>
                  <span>{item.metricsCount} Impact Metrics Detected</span>
                </div>
                <div className="tag-cluster">
                  {item.skills.map((skill, sIdx) => (
                    <span key={sIdx} className="mini-tag">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <button
            type="button"
            className="action-btn-outline"
            onClick={() => setShowDrawer(true)}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add_circle</span>
            <span>Log Another Experience</span>
          </button>
          <div className="modal-footer-btns">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Done
            </button>
            <button type="button" className="action-btn-primary" onClick={onClose}>
              Save &amp; Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
