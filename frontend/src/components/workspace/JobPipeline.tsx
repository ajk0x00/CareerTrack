import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import WorkspaceNavbar from './WorkspaceNavbar'
import Footer from '../Footer'
import SettingsModal from './SettingsModal'
import ExperienceModal from './ExperienceModal'
import SkillsModal from './SkillsModal'
import type { ExperienceItem, SkillCategory, UserPreferences } from '../../types/workspace'

interface PipelineJob {
  id: string
  company: string
  role: string
  location: string
  comp: string
  stage: 'saved' | 'applied' | 'interviewing' | 'offer'
  matchScore: number
  appliedDate?: string
  notes?: string
}

const INITIAL_PIPELINE: PipelineJob[] = [
  {
    id: 'pipe-1',
    company: 'Stripe, Inc.',
    role: 'Staff Product Engineer',
    location: 'San Francisco, CA (Remote)',
    comp: '$240,000 - $280,000',
    stage: 'interviewing',
    matchScore: 96,
    appliedDate: 'Sep 28, 2026',
    notes: 'Technical screen completed. Architectural deep dive scheduled.',
  },
  {
    id: 'pipe-2',
    company: 'Vercel Inc.',
    role: 'Staff Product Engineer • Edge Platform',
    location: 'San Francisco, CA (Remote)',
    comp: '$235,000 - $270,000',
    stage: 'applied',
    matchScore: 94,
    appliedDate: 'Oct 01, 2026',
    notes: 'Tailored resume submitted via executive referral.',
  },
  {
    id: 'pipe-3',
    company: 'Linear',
    role: 'Lead Systems Engineer',
    location: 'Remote (Worldwide)',
    comp: '$220,000 - $260,000',
    stage: 'saved',
    matchScore: 89,
    notes: 'Reviewing job description keywords for Next.js sync engine.',
  },
  {
    id: 'pipe-4',
    company: 'Anthropic',
    role: 'Member of Technical Staff • Platform',
    location: 'San Francisco, CA',
    comp: '$260,000 - $310,000',
    stage: 'offer',
    matchScore: 98,
    appliedDate: 'Sep 15, 2026',
    notes: 'Written offer received. Evaluating equity vesting schedule.',
  },
]

const STAGES: { id: PipelineJob['stage']; label: string; icon: string; countColor: string }[] = [
  { id: 'saved', label: 'Saved & Researching', icon: 'bookmark', countColor: '#64748b' },
  { id: 'applied', label: 'Applied / Awaiting', icon: 'send', countColor: '#3b82f6' },
  { id: 'interviewing', label: 'Interviewing', icon: 'forum', countColor: '#eab308' },
  { id: 'offer', label: 'Offers & Negotiations', icon: 'verified', countColor: '#22c55e' },
]

export default function JobPipeline() {
  const { user, logout, updateUser } = useAuth()
  const navigate = useNavigate()

  const [jobs, setJobs] = useState<PipelineJob[]>(INITIAL_PIPELINE)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [activeModal, setActiveModal] = useState<'experience' | 'skills' | 'settings' | null>(null)

  const [experiences, setExperiences] = useState<ExperienceItem[]>([])
  const [categories, setCategories] = useState<SkillCategory[]>([])
  const [preferences, setPreferences] = useState<UserPreferences>({
    targetRole: 'Staff / Lead Software Engineer • Full-Stack',
    targetComp: '$220,000 - $265,000',
    workplacePreference: 'Remote (Worldwide)',
    aggressiveMetrics: true,
  })

  if (!user) return null

  const filteredJobs = jobs.filter((job) =>
    `${job.company} ${job.role} ${job.location}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  )

  const handleMoveStage = (id: string, stage: PipelineJob['stage']) => {
    setJobs((prev) =>
      prev.map((job) => (job.id === id ? { ...job, stage } : job))
    )
  }

  const handleTailorResume = (company: string, role: string) => {
    navigate(`/?company=${encodeURIComponent(company)}&role=${encodeURIComponent(role)}`)
  }

  return (
    <div className="workspace-root">
      <WorkspaceNavbar
        user={user}
        currentWorkspace="Job Pipeline"
        onSelectWorkspace={(name) => {
          if (name.includes('Resume')) navigate('/')
        }}
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
              <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--primary)' }}>
                business_center
              </span>
              <span>Career Track</span>
              <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--on-surface-variant)' }}>
                chevron_right
              </span>
              <span style={{ fontWeight: 600, color: 'var(--on-surface)' }}>Job Application Pipeline</span>
            </div>
            <h2 className="pipeline-title">Active Opportunities</h2>
            <p className="pipeline-subtitle">
              Track target roles, interview velocity, and match tailored resumes to specific pipeline stages.
            </p>
          </div>

          <div className="pipeline-header-actions">
            <div className="pipeline-search-box">
              <span className="material-symbols-outlined pipeline-search-icon">search</span>
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
              onClick={() => navigate('/')}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                auto_awesome
              </span>
              <span>Tailor New Resume</span>
            </button>
          </div>
        </div>

        {/* Pipeline Kanban Columns */}
        <div className="pipeline-columns-grid">
          {STAGES.map((col) => {
            const colJobs = filteredJobs.filter((j) => j.stage === col.id)
            return (
              <div key={col.id} className="pipeline-column">
                <div className="pipeline-col-header">
                  <div className="pipeline-col-header-left">
                    <span className="material-symbols-outlined pipeline-col-icon">
                      {col.icon}
                    </span>
                    <span className="pipeline-col-title">{col.label}</span>
                  </div>
                  <span className="pipeline-col-count" style={{ borderColor: col.countColor, color: col.countColor }}>
                    {colJobs.length}
                  </span>
                </div>

                <div className="pipeline-card-list">
                  {colJobs.map((job) => (
                    <div key={job.id} className="pipeline-job-card">
                      <div className="pipeline-card-top">
                        <div className="pipeline-company-logo">
                          {job.company.charAt(0)}
                        </div>
                        <div className="pipeline-match-badge" title="ATS Competency Alignment Score">
                          <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>
                            auto_awesome
                          </span>
                          <span>{job.matchScore}% Match</span>
                        </div>
                      </div>

                      <div className="pipeline-card-title">{job.role}</div>
                      <div className="pipeline-card-company">{job.company}</div>

                      <div className="pipeline-meta-row">
                        <span className="pipeline-meta-item">
                          <span className="material-symbols-outlined meta-icon">location_on</span>
                          {job.location}
                        </span>
                        <span className="pipeline-meta-item">
                          <span className="material-symbols-outlined meta-icon">payments</span>
                          {job.comp}
                        </span>
                      </div>

                      {job.notes && (
                        <div className="pipeline-notes-box">
                          {job.notes}
                        </div>
                      )}

                      <div className="pipeline-card-footer">
                        <select
                          className="pipeline-stage-select"
                          value={job.stage}
                          onChange={(e) => handleMoveStage(job.id, e.target.value as PipelineJob['stage'])}
                          title="Move to stage"
                        >
                          <option value="saved">Stage: Saved</option>
                          <option value="applied">Stage: Applied</option>
                          <option value="interviewing">Stage: Interviewing</option>
                          <option value="offer">Stage: Offer</option>
                        </select>
                        <button
                          type="button"
                          className="pipeline-tailor-btn"
                          onClick={() => handleTailorResume(job.company, job.role)}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                            edit_document
                          </span>
                          <span>Tailor</span>
                        </button>
                      </div>
                    </div>
                  ))}

                  {colJobs.length === 0 && (
                    <div className="pipeline-empty-col">
                      <span className="material-symbols-outlined empty-icon">inbox</span>
                      <span>No opportunities in this stage</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </main>

      {/* Modals */}
      <ExperienceModal
        isOpen={activeModal === 'experience'}
        onClose={() => setActiveModal(null)}
        experiences={experiences}
        onAddExperience={(item) => setExperiences([item, ...experiences])}
        onRemoveExperience={(id) => setExperiences(experiences.filter((e) => e.id !== id))}
      />

      <SkillsModal
        isOpen={activeModal === 'skills'}
        onClose={() => setActiveModal(null)}
        categories={categories}
        onAddSkill={(catId, skill) => {
          setCategories(
            categories.map((c) => (c.id === catId ? { ...c, skills: [...c.skills, skill] } : c))
          )
        }}
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
