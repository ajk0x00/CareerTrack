import { useEffect, useState } from 'react'
import type { JobItem, JobStatus } from '../../types/workspace'
import type { ResumeSummary } from '../../types/resume'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../ToastContext'
import { ApiError, exportResume, listResumes } from '../../api/resumes'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'

interface JobDetailModalProps {
  job: JobItem | null
  isOpen: boolean
  onClose: () => void
  onEdit: (job: JobItem) => void
  onTailor: (job: JobItem) => void
  onJobUpdated?: (job: JobItem) => void
}

const STAGE_LABELS: Record<JobStatus, { label: string; color: string; icon: string }> = {
  saved: { label: 'Saved & Researching', color: '#64748b', icon: 'bookmark' },
  applied: { label: 'Applied / Awaiting', color: '#3b82f6', icon: 'send' },
  interviewing: { label: 'Interviewing', color: '#eab308', icon: 'forum' },
  offer: { label: 'Offer & Negotiation', color: '#22c55e', icon: 'verified' },
}

export default function JobDetailModal({
  job,
  isOpen,
  onClose,
  onEdit,
  onTailor,
}: JobDetailModalProps) {
  const { token: authToken } = useAuth()
  const toast = useToast()
  useBodyScrollLock(isOpen)

  const token =
    authToken ||
    localStorage.getItem('careerTrack_token') ||
    sessionStorage.getItem('careerTrack_token') ||
    ''

  const jobId = job?.id ?? null

  const [submittedResumeState, setSubmittedResumeState] = useState<{
    jobId: number
    resume: ResumeSummary | null
    error: string | null
  } | null>(null)
  const [isDownloadingSubmittedResume, setIsDownloadingSubmittedResume] =
    useState<boolean>(false)

  const submittedResume =
    submittedResumeState && submittedResumeState.jobId === jobId
      ? submittedResumeState.resume
      : null
  const submittedResumeError =
    submittedResumeState && submittedResumeState.jobId === jobId
      ? submittedResumeState.error
      : null
  const isLoadingSubmittedResume =
    isOpen && jobId !== null && Boolean(token) && submittedResumeState?.jobId !== jobId

  // Look up the resume already linked to this job, if any
  useEffect(() => {
    if (!isOpen || jobId === null || !token) return

    let isMounted = true

    listResumes(token)
      .then((resumes) => {
        if (!isMounted) return
        setSubmittedResumeState({
          jobId,
          resume: resumes.find((item) => item.job_id === jobId) ?? null,
          error: null,
        })
      })
      .catch((error: unknown) => {
        if (!isMounted) return
        setSubmittedResumeState({
          jobId,
          resume: null,
          error:
            error instanceof ApiError
              ? error.detail
              : 'Could not load the resume for this job',
        })
      })

    return () => {
      isMounted = false
    }
  }, [isOpen, jobId, token])

  if (!isOpen || !job) return null

  const handleDownloadSubmittedResume = async (): Promise<void> => {
    if (!submittedResume || !token) return

    setIsDownloadingSubmittedResume(true)
    try {
      const { blob, fileName } = await exportResume(token, submittedResume.id)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = fileName
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
      toast.success(`Downloaded ${fileName}`, 'PDF Exported')
    } catch (error) {
      toast.error(
        error instanceof ApiError
          ? error.detail
          : 'Could not export this resume as a PDF',
        'Export Error'
      )
    } finally {
      setIsDownloadingSubmittedResume(false)
    }
  }

  const stageInfo = STAGE_LABELS[job.status] || STAGE_LABELS.saved

  // Format compensation
  const formatComp = (): string | null => {
    const { salary_min, salary_max, salary_currency = 'USD', salary_interval = 'yearly' } = job
    if (!salary_min && !salary_max) return null

    const cur = salary_currency === 'USD' ? '$' : `${salary_currency} `
    const intervalSuffix =
      salary_interval === 'yearly' ? '/yr' : salary_interval === 'monthly' ? '/mo' : '/hr'

    const fmt = (n: number) => {
      if (n >= 1000) return `${Math.round(n / 1000)}k`
      return n.toLocaleString()
    }

    if (salary_min && salary_max) {
      return `${cur}${fmt(salary_min)} - ${cur}${fmt(salary_max)} ${intervalSuffix}`
    }
    if (salary_min) {
      return `${cur}${fmt(salary_min)}+ ${intervalSuffix}`
    }
    if (salary_max) {
      return `Up to ${cur}${fmt(salary_max)} ${intervalSuffix}`
    }
    return null
  }

  const compText = formatComp()

  // Render paragraphs and bullets cleanly
  const renderFormattedDescription = (text: string) => {
    const lines = text.split('\n')
    const blocks: { type: 'heading' | 'bullet' | 'paragraph'; content: string }[] = []

    for (const rawLine of lines) {
      const trimmed = rawLine.trim()
      if (!trimmed) continue

      if (trimmed.startsWith('•') || trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const content = trimmed.replace(/^[•\-*]\s*/, '')
        blocks.push({ type: 'bullet', content })
      } else if (
        trimmed.endsWith(':') ||
        trimmed.startsWith('#') ||
        (trimmed.length < 50 &&
          /^(about|role|overview|responsibilities|requirements|qualifications|benefits|what|who|stack|compensation)/i.test(
            trimmed
          ))
      ) {
        const content = trimmed.replace(/^#+\s*/, '')
        blocks.push({ type: 'heading', content })
      } else {
        blocks.push({ type: 'paragraph', content: trimmed })
      }
    }

    return (
      <div className="job-detail-text-flow">
        {blocks.map((block, idx) => {
          if (block.type === 'heading') {
            return (
              <h4 key={idx} className="job-detail-subheading">
                {block.content}
              </h4>
            )
          }
          if (block.type === 'bullet') {
            return (
              <div key={idx} className="job-detail-bullet-item">
                <span className="bullet-dot">•</span>
                <span className="bullet-text">{block.content}</span>
              </div>
            )
          }
          return (
            <p key={idx} className="job-detail-paragraph">
              {block.content}
            </p>
          )
        })}
      </div>
    )
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-container modal-wide job-detail-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Pinned Header */}
        <div className="modal-header">
          <div className="modal-title-group" style={{ flex: 1, minWidth: 0 }}>
            <div className="job-detail-logo-avatar">
              {job.company_name.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="modal-headline-row" style={{ flexWrap: 'wrap', gap: '8px' }}>
                <h3 className="modal-title job-detail-main-title">{job.title}</h3>
                <span
                  className="pill-badge"
                  style={{
                    backgroundColor: `${stageInfo.color}18`,
                    color: stageInfo.color,
                    borderColor: `${stageInfo.color}40`,
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: '13px', verticalAlign: 'middle', marginRight: '4px' }}
                  >
                    {stageInfo.icon}
                  </span>
                  {stageInfo.label}
                </span>
                {job.workplace_type && (
                  <span className="pill-badge default">
                    {job.workplace_type.charAt(0).toUpperCase() + job.workplace_type.slice(1).replace('_', ' ')}
                  </span>
                )}
                {job.excitement_rating && (
                  <span className="pill-badge warning" title={`Priority: ${job.excitement_rating}/5`}>
                    {'★'.repeat(job.excitement_rating)}
                  </span>
                )}
              </div>
              <div className="job-detail-company-sub">
                <span className="company-name-highlight">{job.company_name}</span>
                {job.location && (
                  <>
                    <span className="divider-dot">•</span>
                    <span>{job.location}</span>
                  </>
                )}
                {job.department && (
                  <>
                    <span className="divider-dot">•</span>
                    <span>{job.department}</span>
                  </>
                )}
              </div>
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

        {/* Highlights Bar */}
        <div className="job-detail-highlights-bar">
          {compText && (
            <div className="highlight-item">
              <span className="material-symbols-outlined highlight-icon">payments</span>
              <div>
                <span className="highlight-label">Compensation</span>
                <span className="highlight-value">{compText}</span>
              </div>
            </div>
          )}

          {job.current_stage && (
            <div className="highlight-item">
              <span className="material-symbols-outlined highlight-icon">flag</span>
              <div>
                <span className="highlight-label">Current Stage</span>
                <span className="highlight-value">{job.current_stage}</span>
              </div>
            </div>
          )}

          {job.applied_date && (
            <div className="highlight-item">
              <span className="material-symbols-outlined highlight-icon">event</span>
              <div>
                <span className="highlight-label">Applied Date</span>
                <span className="highlight-value">{job.applied_date}</span>
              </div>
            </div>
          )}

          {job.posted_date && (
            <div className="highlight-item">
              <span className="material-symbols-outlined highlight-icon">schedule</span>
              <div>
                <span className="highlight-label">Posted Date</span>
                <span className="highlight-value">{job.posted_date}</span>
              </div>
            </div>
          )}

          {job.job_url && (
            <div className="highlight-item link-item">
              <span className="material-symbols-outlined highlight-icon">link</span>
              <div>
                <span className="highlight-label">Requisition Link</span>
                <a
                  href={job.job_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="highlight-link"
                >
                  <span>Open Posting</span>
                  <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>
                    open_in_new
                  </span>
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Scrollable Modal Body */}
        <div className="modal-body-scroll job-detail-body">
          {/* Full Job Description Section */}
          <section className="job-detail-section">
            <div className="job-detail-section-header">
              <div className="section-title-wrap">
                <span className="material-symbols-outlined section-icon">description</span>
                <h3 className="section-title">Exact Job Description &amp; Responsibilities</h3>
              </div>
            </div>

            {job.description ? (
              <div className="job-detail-content-card">
                {renderFormattedDescription(job.description)}
              </div>
            ) : (
              <div className="job-detail-empty-posting">
                <span className="material-symbols-outlined empty-posting-icon">article</span>
                <p>No job description stored for this opportunity yet.</p>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    onClose()
                    onEdit(job)
                  }}
                  style={{ marginTop: '8px' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                    edit
                  </span>
                  <span>Edit Job to Add Description</span>
                </button>
              </div>
            )}
          </section>

          {/* Requirements Section */}
          {job.requirements && (
            <section className="job-detail-section">
              <div className="job-detail-section-header">
                <div className="section-title-wrap">
                  <span className="material-symbols-outlined section-icon">checklist</span>
                  <h3 className="section-title">Key Requirements &amp; Qualifications</h3>
                </div>
              </div>
              <div className="job-detail-content-card requirements-card">
                {renderFormattedDescription(job.requirements)}
              </div>
            </section>
          )}

          {/* Submitted Resume Section */}
          <section className="job-detail-section">
            <div className="job-detail-section-header">
              <div className="section-title-wrap">
                <span className="material-symbols-outlined section-icon">article</span>
                <h3 className="section-title">Submitted Resume</h3>
              </div>
            </div>

            <div className="submitted-resume-card">
              {isLoadingSubmittedResume ? (
                <span className="submitted-resume-muted">
                  Checking for a saved resume...
                </span>
              ) : submittedResume ? (
                <>
                  <div className="submitted-resume-info">
                    <span className="submitted-resume-title">{submittedResume.title}</span>
                    <span className="submitted-resume-meta">
                      Updated{' '}
                      {new Date(submittedResume.updated_at).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn-secondary submitted-resume-download"
                    onClick={() => {
                      void handleDownloadSubmittedResume()
                    }}
                    disabled={isDownloadingSubmittedResume}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                      {isDownloadingSubmittedResume ? 'hourglass_top' : 'download'}
                    </span>
                    <span>
                      {isDownloadingSubmittedResume ? 'Downloading...' : 'Download PDF'}
                    </span>
                  </button>
                </>
              ) : submittedResumeError ? (
                <span className="submitted-resume-error">
                  Could not load the submitted resume: {submittedResumeError}
                </span>
              ) : (
                <span className="submitted-resume-muted">
                  No resume saved for this job yet
                </span>
              )}
            </div>
          </section>

          {/* Private Notes & Intel Callout */}
          {job.notes && (
            <section className="job-detail-section">
              <div className="job-detail-notes-card">
                <div className="notes-card-header">
                  <span className="material-symbols-outlined notes-icon">lock</span>
                  <span className="notes-title">Private Notes &amp; Compensation Intel</span>
                </div>
                <p className="notes-content">{job.notes}</p>
              </div>
            </section>
          )}

          {/* Recruiter / Contact info if available */}
          {(job.contact_name || job.contact_email || job.contact_phone) && (
            <section className="job-detail-section">
              <div className="job-detail-contact-card">
                <div className="contact-card-header">
                  <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--primary)' }}>
                    contact_mail
                  </span>
                  <span>Recruiter / Contact Information</span>
                </div>
                <div className="contact-card-grid">
                  {job.contact_name && (
                    <div className="contact-item">
                      <span className="contact-label">Name</span>
                      <span className="contact-value">{job.contact_name}</span>
                    </div>
                  )}
                  {job.contact_email && (
                    <div className="contact-item">
                      <span className="contact-label">Email</span>
                      <a href={`mailto:${job.contact_email}`} className="contact-value link">
                        {job.contact_email}
                      </a>
                    </div>
                  )}
                  {job.contact_phone && (
                    <div className="contact-item">
                      <span className="contact-label">Phone</span>
                      <span className="contact-value">{job.contact_phone}</span>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}
        </div>

        {/* Pinned Footer */}
        <div className="modal-footer">
          <div className="job-detail-footer-left">
            {job.job_url && (
              <a
                href={job.job_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
              >
                <span>Original Posting</span>
                <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
                  open_in_new
                </span>
              </a>
            )}
          </div>

          <div className="modal-footer-btns">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Close
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                onClose()
                onEdit(job)
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                edit
              </span>
              <span>Edit Opportunity</span>
            </button>
            <button
              type="button"
              className="action-btn-primary"
              onClick={() => {
                onClose()
                onTailor(job)
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>
                auto_awesome
              </span>
              <span>Tailor Resume for this Job</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
