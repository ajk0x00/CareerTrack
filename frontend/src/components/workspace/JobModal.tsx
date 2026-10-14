import { useState } from 'react'
import type { JobItem, JobStatus } from '../../types/workspace'
import { useToast } from '../ToastContext'

interface JobModalProps {
  isOpen: boolean
  onClose: () => void
  onSaved: (job: JobItem) => void
  editingJob?: JobItem | null
  initialStatus?: JobStatus
  token?: string
}

export default function JobModal({
  isOpen,
  onClose,
  onSaved,
  editingJob,
  initialStatus = 'saved',
  token: propToken,
}: JobModalProps) {
  const toast = useToast()
  const token =
    propToken ||
    localStorage.getItem('careerTrack_token') ||
    sessionStorage.getItem('careerTrack_token') ||
    ''

  const [title, setTitle] = useState<string>(() => editingJob?.title || '')
  const [companyName, setCompanyName] = useState<string>(() => editingJob?.company_name || '')
  const [status, setStatus] = useState<JobStatus>(() => editingJob?.status || initialStatus)
  const [workplaceType, setWorkplaceType] = useState<string>(() => editingJob?.workplace_type || 'remote')
  const [location, setLocation] = useState<string>(() => editingJob?.location || '')
  const [salaryMin, setSalaryMin] = useState<string>(() =>
    editingJob?.salary_min != null ? String(editingJob.salary_min) : ''
  )
  const [salaryMax, setSalaryMax] = useState<string>(() =>
    editingJob?.salary_max != null ? String(editingJob.salary_max) : ''
  )
  const [salaryCurrency, setSalaryCurrency] = useState<string>(() => editingJob?.salary_currency || 'USD')
  const [salaryInterval, setSalaryInterval] = useState<string>(() => editingJob?.salary_interval || 'yearly')
  const [jobUrl, setJobUrl] = useState<string>(() => editingJob?.job_url || '')
  const [currentStage, setCurrentStage] = useState<string>(() => editingJob?.current_stage || '')
  const [excitementRating, setExcitementRating] = useState<number | ''>(() =>
    editingJob?.excitement_rating != null ? editingJob.excitement_rating : ''
  )
  const [notes, setNotes] = useState<string>(() => editingJob?.notes || '')
  const [description, setDescription] = useState<string>(() => editingJob?.description || '')
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const trimmedTitle = title.trim()
    const trimmedCompany = companyName.trim()

    if (!trimmedTitle) {
      toast.error('Job title is required', 'Validation Error')
      return
    }
    if (!trimmedCompany) {
      toast.error('Company name is required', 'Validation Error')
      return
    }

    const minNum = salaryMin ? Number(salaryMin) : null
    const maxNum = salaryMax ? Number(salaryMax) : null

    if (minNum != null && isNaN(minNum)) {
      toast.error('Salary minimum must be a valid number', 'Validation Error')
      return
    }
    if (maxNum != null && isNaN(maxNum)) {
      toast.error('Salary maximum must be a valid number', 'Validation Error')
      return
    }
    if (minNum != null && maxNum != null && maxNum < minNum) {
      toast.error('Maximum salary cannot be less than minimum salary', 'Validation Error')
      return
    }

    const payload: Record<string, unknown> = {
      title: trimmedTitle,
      company_name: trimmedCompany,
      status,
      workplace_type: workplaceType || null,
      location: location.trim() || null,
      salary_min: minNum,
      salary_max: maxNum,
      salary_currency: salaryCurrency.trim() || 'USD',
      salary_interval: salaryInterval || null,
      job_url: jobUrl.trim() || null,
      current_stage: currentStage.trim() || null,
      excitement_rating: excitementRating ? Number(excitementRating) : null,
      notes: notes.trim() || null,
      description: description.trim() || null,
    }

    setIsSubmitting(true)
    try {
      const url = editingJob ? `/api/v1/jobs/${editingJob.id}` : '/api/v1/jobs'
      const method = editingJob ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        const msg =
          typeof errData.detail === 'string'
            ? errData.detail
            : Array.isArray(errData.detail)
            ? errData.detail.map((d: { msg?: string }) => d.msg).join(', ')
            : 'Failed to save job application'
        throw new Error(msg)
      }

      const savedJob: JobItem = await res.json()
      onSaved(savedJob)
      toast.success(
        editingJob
          ? `Updated ${savedJob.title} at ${savedJob.company_name}`
          : `Added ${savedJob.title} to pipeline`,
        editingJob ? 'Opportunity Updated' : 'Opportunity Added'
      )
      onClose()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error saving opportunity'
      toast.error(msg, 'Save Error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-container modal-wide"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '680px' }}
      >
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon-badge primary">
              <span className="material-symbols-outlined">
                {editingJob ? 'edit_square' : 'business_center'}
              </span>
            </div>
            <div>
              <div className="modal-headline-row">
                <h3 className="modal-title">
                  {editingJob ? 'Edit Opportunity' : 'Track New Opportunity'}
                </h3>
                <span className="pill-badge primary">
                  {status.charAt(0).toUpperCase() + status.slice(1)} Stage
                </span>
              </div>
              <p className="modal-subtitle">
                Keep job details, stages, notes, and compensation in sync with your pipeline.
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Title & Company */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="form-group-compact">
                <label className="compact-label">Job Title / Role *</label>
                <div className="input-with-icon">
                  <span className="material-symbols-outlined input-leading-icon">badge</span>
                  <input
                    type="text"
                    className="compact-input"
                    placeholder="e.g. Staff Software Engineer"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className="form-group-compact">
                <label className="compact-label">Company Name *</label>
                <div className="input-with-icon">
                  <span className="material-symbols-outlined input-leading-icon">apartment</span>
                  <input
                    type="text"
                    className="compact-input"
                    placeholder="e.g. Stripe, Anthropic"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Stage & Workplace */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="form-group-compact">
                <label className="compact-label">Pipeline Stage *</label>
                <div className="input-with-icon">
                  <span className="material-symbols-outlined input-leading-icon">flag</span>
                  <select
                    className="compact-select"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as JobStatus)}
                  >
                    <option value="saved">Saved &amp; Researching</option>
                    <option value="applied">Applied / Awaiting Response</option>
                    <option value="interviewing">Interviewing</option>
                    <option value="offer">Offers &amp; Negotiations</option>
                  </select>
                </div>
              </div>

              <div className="form-group-compact">
                <label className="compact-label">Workplace Policy</label>
                <div className="input-with-icon">
                  <span className="material-symbols-outlined input-leading-icon">home_work</span>
                  <select
                    className="compact-select"
                    value={workplaceType}
                    onChange={(e) => setWorkplaceType(e.target.value)}
                  >
                    <option value="">Not Specified</option>
                    <option value="remote">Remote</option>
                    <option value="hybrid">Hybrid</option>
                    <option value="on_site">On-site</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Location & Job URL */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="form-group-compact">
                <label className="compact-label">Location</label>
                <div className="input-with-icon">
                  <span className="material-symbols-outlined input-leading-icon">location_on</span>
                  <input
                    type="text"
                    className="compact-input"
                    placeholder="e.g. San Francisco, CA"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group-compact">
                <label className="compact-label">Job Posting / Requisition URL</label>
                <div className="input-with-icon">
                  <span className="material-symbols-outlined input-leading-icon">link</span>
                  <input
                    type="url"
                    className="compact-input"
                    placeholder="https://jobs.example.com/posting/123"
                    value={jobUrl}
                    onChange={(e) => setJobUrl(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Compensation Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px 110px', gap: '10px' }}>
              <div className="form-group-compact">
                <label className="compact-label">Salary Min</label>
                <input
                  type="number"
                  className="compact-input"
                  placeholder="e.g. 180000"
                  value={salaryMin}
                  onChange={(e) => setSalaryMin(e.target.value)}
                  min={0}
                />
              </div>

              <div className="form-group-compact">
                <label className="compact-label">Salary Max</label>
                <input
                  type="number"
                  className="compact-input"
                  placeholder="e.g. 240000"
                  value={salaryMax}
                  onChange={(e) => setSalaryMax(e.target.value)}
                  min={0}
                />
              </div>

              <div className="form-group-compact">
                <label className="compact-label">Currency</label>
                <select
                  className="compact-select"
                  value={salaryCurrency}
                  onChange={(e) => setSalaryCurrency(e.target.value)}
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="CAD">CAD ($)</option>
                  <option value="INR">INR (₹)</option>
                </select>
              </div>

              <div className="form-group-compact">
                <label className="compact-label">Interval</label>
                <select
                  className="compact-select"
                  value={salaryInterval}
                  onChange={(e) => setSalaryInterval(e.target.value)}
                >
                  <option value="yearly">/ Year</option>
                  <option value="monthly">/ Month</option>
                  <option value="hourly">/ Hour</option>
                </select>
              </div>
            </div>

            {/* Current Stage & Excitement Rating */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '14px' }}>
              <div className="form-group-compact">
                <label className="compact-label">Current Interview Stage</label>
                <div className="input-with-icon">
                  <span className="material-symbols-outlined input-leading-icon">schedule</span>
                  <input
                    type="text"
                    className="compact-input"
                    placeholder="e.g. Technical Screen, Hiring Manager Chat"
                    value={currentStage}
                    onChange={(e) => setCurrentStage(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group-compact">
                <label className="compact-label">Priority / Rating</label>
                <select
                  className="compact-select"
                  value={excitementRating}
                  onChange={(e) =>
                    setExcitementRating(e.target.value ? Number(e.target.value) : '')
                  }
                >
                  <option value="">No Rating</option>
                  <option value="5">★★★★★ Top Choice</option>
                  <option value="4">★★★★ High Interest</option>
                  <option value="3">★★★ Neutral / Good</option>
                  <option value="2">★★ Low Priority</option>
                  <option value="1">★ Safety Role</option>
                </select>
              </div>
            </div>

            {/* Private Notes */}
            <div className="form-group-compact">
              <label className="compact-label">Private Notes &amp; Follow-ups</label>
              <textarea
                className="compact-textarea"
                rows={2}
                placeholder="Referral name, questions to ask, interview impressions, upcoming deadlines..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {/* Job Description (Optional) */}
            <div className="form-group-compact">
              <div className="flex-between">
                <label className="compact-label">Job Description (JD)</label>
                <span className="highlight-tag">For Resume Tailoring</span>
              </div>
              <textarea
                className="compact-textarea"
                rows={3}
                placeholder="Paste the requirements or responsibilities to tailor against..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="modal-actions" style={{ marginTop: '20px', padding: 0 }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="action-btn-primary"
              disabled={isSubmitting}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                {isSubmitting ? 'hourglass_top' : 'save'}
              </span>
              <span>{isSubmitting ? 'Saving...' : editingJob ? 'Update Opportunity' : 'Save to Pipeline'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
