import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../ToastContext'
import WorkspaceNavbar from './WorkspaceNavbar'
import Footer from '../Footer'
import SettingsModal from './SettingsModal'
import ExperienceModal from './ExperienceModal'
import SkillsModal from './SkillsModal'
import JobModal from './JobModal'
import JobDetailModal from './JobDetailModal'
import type {
  ExperienceItem,
  JobItem,
  JobStatus,
  UserPreferences,
} from '../../types/workspace'

const STAGES: { id: JobStatus; label: string; icon: string; countColor: string; description: string }[] = [
  { id: 'saved', label: 'Saved & Researching', icon: 'bookmark', countColor: '#64748b', description: 'Target companies & saved postings' },
  { id: 'applied', label: 'Applied / Awaiting', icon: 'send', countColor: '#3b82f6', description: 'Applications submitted & waiting for response' },
  { id: 'interviewing', label: 'Interviewing', icon: 'forum', countColor: '#eab308', description: 'Active interview rounds & take-homes' },
  { id: 'offer', label: 'Offers & Negotiations', icon: 'verified', countColor: '#22c55e', description: 'Received offers & decision stage' },
]

export default function JobPipeline() {
  const { user, logout, updateUser } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()

  const token =
    localStorage.getItem('careerTrack_token') ||
    sessionStorage.getItem('careerTrack_token') ||
    ''

  const [jobs, setJobs] = useState<JobItem[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(() => Boolean(token))
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Job Modal (Add / Edit) State
  const [isJobModalOpen, setIsJobModalOpen] = useState<boolean>(false)
  const [editingJob, setEditingJob] = useState<JobItem | null>(null)
  const [initialStageForModal, setInitialStageForModal] = useState<JobStatus>('saved')
  const [deletingJobId, setDeletingJobId] = useState<number | null>(null)

  // Job Posting Exact Detail Modal State
  const [selectedJobForDetail, setSelectedJobForDetail] = useState<JobItem | null>(null)

  // Sub-Modals
  const [activeModal, setActiveModal] = useState<'experience' | 'skills' | 'settings' | null>(null)
  const [experiences, setExperiences] = useState<ExperienceItem[]>([])
  const [preferences, setPreferences] = useState<UserPreferences>({
    targetRole: 'Staff / Lead Software Engineer • Full-Stack',
    targetComp: '$220,000 - $265,000',
    workplacePreference: 'Remote (Worldwide)',
    aggressiveMetrics: true,
  })

  // Fetch jobs from backend API on mount
  useEffect(() => {
    if (!token) return

    let isMounted = true
    fetch('/api/v1/jobs', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load tracked jobs')
        return res.json()
      })
      .then((data: JobItem[]) => {
        if (isMounted) setJobs(data)
      })
      .catch((err) => {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : 'Error fetching job pipeline'
          toast.error(msg, 'Network Error')
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [token, toast])

  // Search filter across title, company, location, and description
  const filteredJobs = useMemo(() => {
    if (!searchQuery.trim()) return jobs
    const q = searchQuery.trim().toLowerCase()
    return jobs.filter(
      (job) =>
        job.title.toLowerCase().includes(q) ||
        job.company_name.toLowerCase().includes(q) ||
        (job.location && job.location.toLowerCase().includes(q)) ||
        (job.description && job.description.toLowerCase().includes(q)) ||
        (job.current_stage && job.current_stage.toLowerCase().includes(q))
    )
  }, [jobs, searchQuery])

  // Move stage via dropdown with optimistic update
  const handleMoveStage = async (id: number, newStage: JobStatus) => {
    const previousJobs = [...jobs]
    const targetJob = jobs.find((j) => j.id === id)
    if (!targetJob || targetJob.status === newStage) return

    // Optimistic UI update
    setJobs((prev) =>
      prev.map((job) => (job.id === id ? { ...job, status: newStage } : job))
    )

    try {
      const res = await fetch(`/api/v1/jobs/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStage }),
      })

      if (!res.ok) {
        throw new Error('Failed to update job stage')
      }

      const updated: JobItem = await res.json()
      setJobs((prev) => prev.map((j) => (j.id === id ? updated : j)))
      const stageName = STAGES.find((s) => s.id === newStage)?.label || newStage
      toast.success(`Moved ${targetJob.title} to ${stageName}`, 'Stage Updated')
    } catch (err) {
      // Revert optimistic update
      setJobs(previousJobs)
      const msg = err instanceof Error ? err.message : 'Could not update stage'
      toast.error(msg, 'Update Error')
    }
  }

  // Delete Job from pipeline
  const handleDeleteJob = async (job: JobItem) => {
    if (
      !window.confirm(
        `Are you sure you want to remove "${job.title}" at ${job.company_name} from your pipeline?`
      )
    ) {
      return
    }

    setDeletingJobId(job.id)
    try {
      const res = await fetch(`/api/v1/jobs/${job.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!res.ok && res.status !== 204) {
        throw new Error('Failed to delete job')
      }

      setJobs((prev) => prev.filter((j) => j.id !== job.id))
      toast.success(
        `Removed ${job.title} at ${job.company_name}`,
        'Opportunity Removed'
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not delete opportunity'
      toast.error(msg, 'Delete Error')
    } finally {
      setDeletingJobId(null)
    }
  }

  // Open modal to add job
  const handleOpenAddModal = (stage: JobStatus = 'saved') => {
    setEditingJob(null)
    setInitialStageForModal(stage)
    setIsJobModalOpen(true)
  }

  // Open modal to edit existing job
  const handleOpenEditModal = (job: JobItem) => {
    setEditingJob(job)
    setInitialStageForModal(job.status)
    setIsJobModalOpen(true)
  }

  // Handle job added or updated from JobModal
  const handleSavedJob = (saved: JobItem) => {
    setJobs((prev) => {
      const exists = prev.some((j) => j.id === saved.id)
      if (exists) {
        return prev.map((j) => (j.id === saved.id ? saved : j))
      }
      return [saved, ...prev]
    })
    setSelectedJobForDetail((prev) => (prev && prev.id === saved.id ? saved : prev))
  }

  // Navigate to workspace to tailor resume
  const handleTailorResume = (job: JobItem) => {
    navigate(
      `/?jobId=${job.id}&company=${encodeURIComponent(job.company_name)}&role=${encodeURIComponent(job.title)}`
    )
  }

  // Format compensation display
  const formatCompensation = (job: JobItem): string | null => {
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

  // Format location and workplace display
  const formatLocation = (job: JobItem): string => {
    const parts: string[] = []
    if (job.location) parts.push(job.location)
    if (job.workplace_type) {
      const wp = job.workplace_type.replace('_', ' ')
      const cap = wp.charAt(0).toUpperCase() + wp.slice(1)
      if (!job.location || !job.location.toLowerCase().includes(wp)) {
        parts.push(`(${cap})`)
      }
    }
    return parts.join(' ') || 'Remote'
  }

  if (!user) return null

  return (
    <div className="workspace-root">
      <WorkspaceNavbar
        user={user}
        onOpenExperience={() => setActiveModal('experience')}
        onOpenSkills={() => setActiveModal('skills')}
        onOpenSettings={() => setActiveModal('settings')}
        onLogout={logout}
      />

      <main className="pipeline-container">
        {/* Pipeline Top Bar */}
        <div className="pipeline-header-bar">
          <div>
            <div className="pipeline-breadcrumb">
              <span
                className="material-symbols-outlined"
                style={{ fontSize: '16px', color: 'var(--primary)' }}
              >
                business_center
              </span>
              <span>Career Track</span>
              <span
                className="material-symbols-outlined"
                style={{ fontSize: '14px', color: 'var(--on-surface-variant)' }}
              >
                chevron_right
              </span>
              <span style={{ fontWeight: 600, color: 'var(--on-surface)' }}>
                Job Application Pipeline
              </span>
            </div>
            <h2 className="pipeline-title">Active Opportunities</h2>
            <p className="pipeline-subtitle">
              Track target roles, interview velocity, and tailor ATS resumes to specific pipeline stages.
            </p>
          </div>

          <div className="pipeline-header-actions">
            <div className="pipeline-search-box">
              <span className="material-symbols-outlined pipeline-search-icon">
                search
              </span>
              <input
                type="text"
                className="pipeline-search-input"
                placeholder="Search company, title, or location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <button
              type="button"
              className="action-btn-primary"
              onClick={() => handleOpenAddModal('saved')}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                add_circle
              </span>
              <span>Track Opportunity</span>
            </button>

            <button
              type="button"
              className="btn-secondary hide-mobile"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', fontSize: '13px' }}
              onClick={() => navigate('/')}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                auto_awesome
              </span>
              <span>Tailor Resume</span>
            </button>
          </div>
        </div>

        {/* Global Loading Spinner */}
        {isLoading && (
          <div
            className="pref-loading-box"
            style={{ padding: '60px 20px', textAlign: 'center' }}
          >
            <div className="pref-loading-spinner" />
            <span style={{ fontSize: '14px', color: 'var(--on-surface-variant)' }}>
              Loading your career pipeline from database...
            </span>
          </div>
        )}

        {/* Onboarding Empty State if DB has 0 jobs */}
        {!isLoading && jobs.length === 0 && (
          <div className="pipeline-hero-empty">
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '48px', color: 'var(--primary)', opacity: 0.8 }}
            >
              work_outline
            </span>
            <h3>No Job Applications Tracked Yet</h3>
            <p>
              Your pipeline is connected to the database. Start adding target companies, job postings, and active interview rounds to track your career progress.
            </p>
            <button
              type="button"
              className="action-btn-primary"
              style={{ marginTop: '8px' }}
              onClick={() => handleOpenAddModal('saved')}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                add
              </span>
              <span>Track Your First Opportunity</span>
            </button>
          </div>
        )}

        {/* Pipeline Kanban Columns */}
        {!isLoading && (
          <div className="pipeline-columns-grid">
            {STAGES.map((col) => {
              const colJobs = filteredJobs.filter((j) => j.status === col.id)
              return (
                <div key={col.id} className="pipeline-column">
                  <div className="pipeline-col-header">
                    <div className="pipeline-col-header-left">
                      <span className="material-symbols-outlined pipeline-col-icon">
                        {col.icon}
                      </span>
                      <span className="pipeline-col-title">{col.label}</span>
                    </div>
                    <div className="pipeline-col-header-right">
                      <span
                        className="pipeline-col-count"
                        style={{
                          borderColor: col.countColor,
                          color: col.countColor,
                        }}
                      >
                        {colJobs.length}
                      </span>
                      <button
                        type="button"
                        className="pipeline-col-add-btn"
                        onClick={() => handleOpenAddModal(col.id)}
                        title={`Add opportunity to ${col.label}`}
                        aria-label={`Add opportunity to ${col.label}`}
                      >
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: '16px' }}
                        >
                          add
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="pipeline-card-list">
                    {colJobs.map((job) => {
                      const compText = formatCompensation(job)
                      const locationText = formatLocation(job)

                      return (
                        <div
                          key={job.id}
                          className="pipeline-job-card"
                          onClick={() => setSelectedJobForDetail(job)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              setSelectedJobForDetail(job)
                            }
                          }}
                          title="Click to view exact job posting"
                        >
                          <div className="pipeline-card-top">
                            <div className="pipeline-company-logo">
                              {job.company_name.charAt(0).toUpperCase()}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {job.excitement_rating ? (
                                <div
                                  className="pipeline-match-badge"
                                  title={`Priority: ${job.excitement_rating}/5`}
                                >
                                  <span>{'★'.repeat(job.excitement_rating)}</span>
                                </div>
                              ) : job.current_stage ? (
                                <div
                                  className="pipeline-match-badge"
                                  title="Current Interview Stage"
                                >
                                  <span
                                    className="material-symbols-outlined"
                                    style={{ fontSize: '12px' }}
                                  >
                                    flag
                                  </span>
                                  <span>{job.current_stage}</span>
                                </div>
                              ) : null}
                              <span
                                className="material-symbols-outlined pipeline-card-expand-icon"
                                title="View exact job posting"
                              >
                                open_in_full
                              </span>
                            </div>
                          </div>

                          <div className="pipeline-card-title">{job.title}</div>
                          <div className="pipeline-card-company">
                            {job.company_name}
                          </div>

                          <div className="pipeline-meta-row">
                            <span className="pipeline-meta-item">
                              <span className="material-symbols-outlined meta-icon">
                                location_on
                              </span>
                              {locationText}
                            </span>
                            {compText && (
                              <span className="pipeline-meta-item">
                                <span className="material-symbols-outlined meta-icon">
                                  payments
                                </span>
                                {compText}
                              </span>
                            )}
                            {job.applied_date && (
                              <span className="pipeline-meta-item">
                                <span className="material-symbols-outlined meta-icon">
                                  event
                                </span>
                                Applied {job.applied_date}
                              </span>
                            )}
                          </div>

                          {job.notes && (
                            <div className="pipeline-notes-box">
                              {job.notes}
                            </div>
                          )}

                          <div className="pipeline-card-footer">
                            <select
                              className="pipeline-stage-select"
                              value={job.status}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) =>
                                handleMoveStage(
                                  job.id,
                                  e.target.value as JobStatus
                                )
                              }
                              title="Move to stage"
                            >
                              <option value="saved">Stage: Saved</option>
                              <option value="applied">Stage: Applied</option>
                              <option value="interviewing">
                                Stage: Interviewing
                              </option>
                              <option value="offer">Stage: Offer</option>
                            </select>

                            <div className="pipeline-card-actions">
                              <button
                                type="button"
                                className="action-icon-btn"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleOpenEditModal(job)
                                }}
                                title="Edit opportunity"
                                aria-label="Edit opportunity"
                              >
                                <span
                                  className="material-symbols-outlined"
                                  style={{ fontSize: '15px' }}
                                >
                                  edit
                                </span>
                              </button>
                              <button
                                type="button"
                                className="action-icon-btn error"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteJob(job)
                                }}
                                disabled={deletingJobId === job.id}
                                title="Remove opportunity"
                                aria-label="Remove opportunity"
                              >
                                <span
                                  className="material-symbols-outlined"
                                  style={{ fontSize: '15px' }}
                                >
                                  delete
                                </span>
                              </button>
                              <button
                                type="button"
                                className="pipeline-tailor-btn"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleTailorResume(job)
                                }}
                                title="Tailor resume against this role"
                              >
                                <span
                                  className="material-symbols-outlined"
                                  style={{ fontSize: '14px' }}
                                >
                                  auto_awesome
                                </span>
                                <span>Tailor</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}

                    {colJobs.length === 0 && (
                      <div className="pipeline-empty-col">
                        <span className="material-symbols-outlined empty-icon">
                          inbox
                        </span>
                        <span>No opportunities in this stage</span>
                        <button
                          type="button"
                          className="pipeline-add-stage-btn"
                          onClick={() => handleOpenAddModal(col.id)}
                        >
                          <span
                            className="material-symbols-outlined"
                            style={{ fontSize: '14px' }}
                          >
                            add
                          </span>
                          <span>Track {col.label.split(' ')[0]}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Opportunity Add / Edit Modal */}
      {isJobModalOpen && (
        <JobModal
          key={editingJob ? `edit-${editingJob.id}` : `new-${initialStageForModal}`}
          isOpen={isJobModalOpen}
          onClose={() => setIsJobModalOpen(false)}
          onSaved={handleSavedJob}
          editingJob={editingJob}
          initialStatus={initialStageForModal}
        />
      )}

      {/* Exact Job Posting Detail Modal */}
      {selectedJobForDetail && (
        <JobDetailModal
          job={selectedJobForDetail}
          isOpen={Boolean(selectedJobForDetail)}
          onClose={() => setSelectedJobForDetail(null)}
          onEdit={(job) => {
            handleOpenEditModal(job)
          }}
          onTailor={(job) => {
            handleTailorResume(job)
          }}
          onJobUpdated={(updated) => {
            handleSavedJob(updated)
            setSelectedJobForDetail(updated)
          }}
        />
      )}

      {/* Experience, Skills, and Settings Modals */}
      <ExperienceModal
        isOpen={activeModal === 'experience'}
        onClose={() => setActiveModal(null)}
        experiences={experiences}
        onAddExperience={(item) => setExperiences([item, ...experiences])}
        onRemoveExperience={(id) =>
          setExperiences(experiences.filter((e) => e.id !== id))
        }
      />

      <SkillsModal
        isOpen={activeModal === 'skills'}
        onClose={() => setActiveModal(null)}
      />

      <SettingsModal
        isOpen={activeModal === 'settings'}
        onClose={() => setActiveModal(null)}
        preferences={preferences}
        onSavePreferences={(updated) => setPreferences(updated)}
        user={user}
        onProfileUpdated={updateUser}
        onLogout={logout}
      />

      <Footer />
    </div>
  )
}

