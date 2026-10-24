import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../ToastContext'
import type { User } from '../../types/auth'
import type { AtsReport } from '../../types/resume'
import type {
  ExperienceItem,
  SkillCategory,
  UserPreferences,
} from '../../types/workspace'
import {
  ApiError,
  createResume,
  exportResume,
  getAtsReport,
  getResume,
  getResumeDraft,
  listResumes,
  updateResume,
} from '../../api/resumes'
import type { SettingsTabId } from './settings'
import WorkspaceNavbar from './WorkspaceNavbar'
import JobDescriptionPanel from './JobDescriptionPanel'
import ResumeCanvas from './ResumeCanvas'
import ExperienceModal from './ExperienceModal'
import SkillsModal from './SkillsModal'
import SettingsModal from './SettingsModal'
import Footer from '../Footer'

interface TailoredResumeWorkspaceProps {
  user?: User
  onLogout?: () => void
  initialModal?: 'experience' | 'skills' | 'settings' | null
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.detail
  if (error instanceof Error && error.message) return error.message
  return fallback
}


const DEFAULT_SAMPLE_JD = `About Stripe:
Stripe builds economic infrastructure for the internet. Millions of companies from worldwide enterprises to seed-stage startups use Stripe’s software and APIs to accept payments, send payouts, and manage their business processes online.

The Role:
We are seeking an exceptional Staff Product Engineer to join our Global Billing & Subscriptions engineering organization. You will architect and build core user-facing systems, scalable revenue orchestration pipelines, and declarative configuration engines utilized by hundreds of thousands of high-growth technology companies.

Key Responsibilities:
• Lead full-lifecycle architectural initiatives across distributed TypeScript, Node.js, React, and Go microservices.
• Partner directly with Product Management, Executive Staff, and Design leads to define the roadmap for multi-currency automated revenue recognition.
• Optimize mission-critical API payloads and asynchronous event queues handling in excess of 15,000 requests/second with five-nines (99.999%) availability.
• Mentor senior engineers, championing high standards of automated testing, edge observability, zero-downtime database migrations, and CI/CD hygiene.

Minimum Qualifications:
• 7+ years of professional full-stack software development experience.
• Mastery of modern web standards, TypeScript, Next.js / React performance optimization, and REST / GraphQL API design.
• Deep familiarity with relational databases (PostgreSQL), distributed caching (Redis), and event streaming (Kafka).
• Demonstrated track record taking zero-to-one product initiatives to massive market scale.`

const INITIAL_PREFERENCES: UserPreferences = {
  targetRole: 'Staff / Lead Software Engineer • Full-Stack',
  targetComp: '$220,000 - $265,000',
  workplacePreference: 'Remote (Worldwide)',
  aggressiveMetrics: true,
}

export default function TailoredResumeWorkspace({
  user,
  onLogout,
  initialModal,
}: TailoredResumeWorkspaceProps) {
  const { user: authUser, token: authToken, logout: authLogout, updateUser } = useAuth()
  const activeUser = user || authUser
  const handleLogout = onLogout || authLogout

  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const { tab } = useParams<{ tab?: string }>()
  const [searchParams] = useSearchParams()

  const token =
    authToken ||
    localStorage.getItem('careerTrack_token') ||
    sessionStorage.getItem('careerTrack_token') ||
    ''

  const [profileOverride, setProfileOverride] = useState<User | null>(null)
  const currentUser = profileOverride || activeUser

  const [currentWorkspace, setCurrentWorkspace] = useState<string>(
    'Tailored Resume Generator'
  )
  const qCompany = searchParams.get('company')
  const qRole = searchParams.get('role')
  const qJobId = searchParams.get('jobId')
  const jobId: number | null =
    qJobId !== null && /^\d+$/.test(qJobId) ? Number(qJobId) : null

  const [company, setCompany] = useState<string>(() => qCompany || 'Stripe, Inc.')
  const [roleTitle, setRoleTitle] = useState<string>(() => qRole || 'Staff Product Engineer')
  const [prevParams, setPrevParams] = useState({ company: qCompany, role: qRole, jobId: qJobId })

  if (
    prevParams.company !== qCompany ||
    prevParams.role !== qRole ||
    prevParams.jobId !== qJobId
  ) {
    setPrevParams({ company: qCompany, role: qRole, jobId: qJobId })
    if (qCompany) setCompany(qCompany)
    if (qRole) setRoleTitle(qRole)
  }

  const [jobDescription, setJobDescription] = useState<string>(DEFAULT_SAMPLE_JD)

  // Fetch full job description if jobId query parameter is passed
  useEffect(() => {
    if (!qJobId || !token) return

    let isMounted = true
    fetch(`/api/v1/jobs/${qJobId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load target job')
        return res.json()
      })
      .then((job) => {
        if (!isMounted) return
        if (job.company_name) setCompany(job.company_name)
        if (job.title) setRoleTitle(job.title)
        if (job.description) {
          const fullPosting =
            job.description +
            (job.requirements
              ? `\n\nKey Requirements & Qualifications:\n${job.requirements}`
              : '')
          setJobDescription(fullPosting)
          toast.success(
            `Loaded exact job posting for ${job.title} at ${job.company_name}`,
            'Target Job Loaded'
          )
        }
      })
      .catch(() => {
        // Fallback gracefully to default or URL params
      })

    return () => {
      isMounted = false
    }
  }, [qJobId, token, toast])

  const [markdownContent, setMarkdownContent] = useState<string>('')
  const [experiences, setExperiences] = useState<ExperienceItem[]>([])
  const [categories, setCategories] = useState<SkillCategory[]>([])
  const [preferences, setPreferences] = useState<UserPreferences>(INITIAL_PREFERENCES)

  // Persisted resume state for the currently viewed document
  const [resumeId, setResumeId] = useState<number | null>(null)
  const [savedMarkdown, setSavedMarkdown] = useState<string>('')
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const [loadErrorState, setLoadErrorState] = useState<{
    key: string
    error: string
  } | null>(null)
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [isDownloading, setIsDownloading] = useState<boolean>(false)
  const [atsState, setAtsState] = useState<{
    resumeId: number
    report: AtsReport | null
  } | null>(null)
  const [atsRefreshKey, setAtsRefreshKey] = useState<number>(0)

  // Which document this view wants, and whether it has finished loading.
  const loadKey = jobId !== null ? `job-${jobId}` : 'master'
  const isLoadingResume = Boolean(token) && loadedKey !== loadKey
  const loadError =
    loadErrorState && loadErrorState.key === loadKey ? loadErrorState.error : null

  // Only trust an ATS report that belongs to the document currently on screen.
  const atsReport =
    atsState && atsState.resumeId === resumeId ? atsState.report : null

  // Resolve the resume that belongs to this view: the job-tailored document when a
  // jobId is present, otherwise the canonical master resume. Both fall back to the
  // live draft when nothing has been persisted yet.
  useEffect(() => {
    if (!token) return

    let isMounted = true

    const resolveResume = async (): Promise<void> => {
      try {
        const resumes = await listResumes(token)
        const stored =
          jobId !== null
            ? resumes.find((item) => item.job_id === jobId)
            : resumes.find((item) => item.job_id === null)

        if (stored) {
          const detail = await getResume(token, stored.id)
          if (!isMounted) return
          setResumeId(detail.id)
          setMarkdownContent(detail.markdown)
          setSavedMarkdown(detail.markdown)
        } else {
          const draft = await getResumeDraft(token)
          if (!isMounted) return
          setResumeId(null)
          setMarkdownContent(draft.markdown)
          setSavedMarkdown(draft.markdown)
        }
        setLoadErrorState(null)
      } catch (error) {
        if (!isMounted) return
        const message = toErrorMessage(error, 'Could not load your resume')
        setLoadErrorState({ key: loadKey, error: message })
        setResumeId(null)
        setMarkdownContent('')
        toast.error(message, 'Resume Load Error')
      } finally {
        if (isMounted) setLoadedKey(loadKey)
      }
    }

    void resolveResume()

    return () => {
      isMounted = false
    }
  }, [token, jobId, loadKey, toast])

  // Refresh the ATS report whenever a stored resume is on screen or was just saved.
  useEffect(() => {
    if (resumeId === null || !token) return

    let isMounted = true
    getAtsReport(token, resumeId)
      .then((report) => {
        if (isMounted) setAtsState({ resumeId, report })
      })
      .catch(() => {
        // A 422 here means the stored markdown cannot be rendered to a PDF yet.
        if (isMounted) setAtsState({ resumeId, report: null })
      })

    return () => {
      isMounted = false
    }
  }, [resumeId, token, atsRefreshKey])

  // Route-driven modal state
  const modalFromPath: 'experience' | 'skills' | 'settings' | null =
    location.pathname.startsWith('/settings')
      ? 'settings'
      : location.pathname.startsWith('/experience')
      ? 'experience'
      : location.pathname.startsWith('/skills')
      ? 'skills'
      : null

  const [localModal, setLocalModal] = useState<'experience' | 'skills' | 'settings' | null>(
    initialModal || null
  )

  const activeModal = modalFromPath || localModal

  const handleCloseModal = useCallback(() => {
    setLocalModal(null)
    if (modalFromPath) {
      navigate('/', { replace: true })
    }
  }, [modalFromPath, navigate])

  // Generation state
  const [isGenerating, setIsGenerating] = useState<boolean>(false)
  const [highlightFlash, setHighlightFlash] = useState<boolean>(false)

  // Rebuild the canvas from the user's live career data
  const handleGenerate = useCallback(async (): Promise<void> => {
    if (!token) {
      toast.error('Sign in again to rebuild your resume draft', 'Not Signed In')
      return
    }

    setIsGenerating(true)
    try {
      const draft = await getResumeDraft(token)
      setMarkdownContent(draft.markdown)
      setLoadErrorState(null)
      setHighlightFlash(true)
      window.setTimeout(() => setHighlightFlash(false), 1200)
      toast.success('Draft rebuilt from your career data', 'Draft Rebuilt')
    } catch (error) {
      toast.error(toErrorMessage(error, 'Could not rebuild your draft'), 'Draft Error')
    } finally {
      setIsGenerating(false)
    }
  }, [token, toast])

  // Persist the canvas: create on first save, patch on subsequent saves.
  // Returns the stored resume id so callers (export) can chain off it.
  const persistResume = useCallback(async (): Promise<number | null> => {
    if (!token || !markdownContent.trim()) return null

    if (resumeId !== null) {
      const updated = await updateResume(token, resumeId, { markdown: markdownContent })
      setSavedMarkdown(updated.markdown)
      setAtsState(null)
      setAtsRefreshKey((key) => key + 1)
      toast.success(`Saved "${updated.title}"`, 'Resume Saved')
      return updated.id
    }

    try {
      const created = await createResume(
        token,
        jobId !== null
          ? { job_id: jobId, markdown: markdownContent }
          : { markdown: markdownContent }
      )
      setResumeId(created.id)
      setSavedMarkdown(created.markdown)
      setAtsRefreshKey((key) => key + 1)
      toast.success(`Saved "${created.title}"`, 'Resume Saved')
      return created.id
    } catch (error) {
      if (jobId !== null || !(error instanceof ApiError) || error.status !== 409) {
        throw error
      }

      // A canonical resume already exists: update it instead of creating a second one.
      const resumes = await listResumes(token)
      const canonical = resumes.find((item) => item.job_id === null)
      if (!canonical) throw error

      const updated = await updateResume(token, canonical.id, { markdown: markdownContent })
      setResumeId(updated.id)
      setSavedMarkdown(updated.markdown)
      setAtsRefreshKey((key) => key + 1)
      toast.success(
        'Your existing master resume was updated with this markdown',
        'Master Resume Updated'
      )
      return updated.id
    }
  }, [token, markdownContent, resumeId, jobId, toast])

  const handleSave = useCallback(async (): Promise<void> => {
    if (!token) {
      toast.error('Sign in again to save this resume', 'Not Signed In')
      return
    }
    if (!markdownContent.trim()) {
      toast.error('There is no resume content to save yet', 'Empty Resume')
      return
    }

    setIsSaving(true)
    try {
      await persistResume()
    } catch (error) {
      toast.error(toErrorMessage(error, 'Could not save this resume'), 'Save Error')
    } finally {
      setIsSaving(false)
    }
  }, [token, markdownContent, persistResume, toast])

  // Download the server-rendered, ATS-safe PDF. Unsaved edits are persisted first so
  // the exported file always matches what is on screen.
  const handleDownload = useCallback(async (): Promise<void> => {
    if (!token || !markdownContent.trim()) return

    setIsDownloading(true)
    try {
      const targetId =
        resumeId !== null && markdownContent === savedMarkdown
          ? resumeId
          : await persistResume()
      if (targetId === null) {
        toast.error('Save the resume before exporting it', 'Nothing To Export')
        return
      }

      const { blob, fileName } = await exportResume(token, targetId)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = fileName
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      toast.success(`Downloaded ${fileName}`, 'PDF Exported')
    } catch (error) {
      toast.error(
        toErrorMessage(error, 'Could not export this resume as a PDF'),
        'Export Error'
      )
    } finally {
      setIsDownloading(false)
    }
  }, [token, markdownContent, resumeId, savedMarkdown, persistResume, toast])

  const isDirty = markdownContent !== savedMarkdown

  // Keyboard shortcut listener (Cmd/Ctrl + Enter to generate, Escape to close modals)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        void handleGenerate()
      }
      if (e.key === 'Escape') {
        handleCloseModal()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleGenerate, handleCloseModal])

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(markdownContent)
    toast.info('Tailored resume markdown copied to clipboard!', 'Markdown Copied')
  }

  if (!currentUser) return null

  const displayName =
    currentUser.name ||
    (currentUser.email === 'demo@careertrack.app'
      ? 'Alex Chen'
      : currentUser.email.split('@')[0].replace(/[._]/g, ' '))

  return (
    <div className="workspace-root">
      {/* Navbar */}
      <WorkspaceNavbar
        user={currentUser}
        currentWorkspace={currentWorkspace}
        onSelectWorkspace={(name) => setCurrentWorkspace(name)}
        onOpenExperience={() => navigate('/experience')}
        onOpenSkills={() => navigate('/skills')}
        onOpenSettings={() => navigate('/settings')}
        onLogout={handleLogout}
      />

      {/* Main 2-Column Workspace */}
      <main className="workspace-body">
        <JobDescriptionPanel
          company={company}
          onCompanyChange={setCompany}
          roleTitle={roleTitle}
          onRoleTitleChange={setRoleTitle}
          jobDescription={jobDescription}
          onJobDescriptionChange={setJobDescription}
          onReloadSample={() => setJobDescription(DEFAULT_SAMPLE_JD)}
          onGenerate={handleGenerate}
          isGenerating={isGenerating}
          userName={displayName}
        />

        <ResumeCanvas
          userName={displayName}
          roleTitle={roleTitle}
          company={company}
          experiences={experiences}
          categories={categories}
          markdownContent={markdownContent}
          onMarkdownChange={setMarkdownContent}
          onCopyMarkdown={handleCopyMarkdown}
          highlightFlash={highlightFlash}
          onSave={handleSave}
          onDownload={handleDownload}
          isSaving={isSaving}
          isDownloading={isDownloading}
          isDirty={isDirty}
          atsReport={atsReport}
          isLoadingDraft={isLoadingResume}
          loadError={loadError}
        />
      </main>

      {/* Interactive Modals */}
      <ExperienceModal
        isOpen={activeModal === 'experience'}
        onClose={handleCloseModal}
        experiences={experiences}
        onAddExperience={(newItem) => setExperiences([newItem, ...experiences])}
        onRemoveExperience={(id) =>
          setExperiences(experiences.filter((exp) => exp.id !== id))
        }
      />

      <SkillsModal
        isOpen={activeModal === 'skills'}
        onClose={handleCloseModal}
        onSkillsChange={(userSkills) => {
          if (userSkills.length > 0) {
            const expert = userSkills.filter((s) => s.proficiency === 'expert').map((s) => s.name)
            const advanced = userSkills.filter((s) => s.proficiency === 'advanced').map((s) => s.name)
            const core = userSkills
              .filter((s) => s.proficiency === 'intermediate' || s.proficiency === 'beginner')
              .map((s) => s.name)

            const updatedCategories: SkillCategory[] = []
            if (expert.length > 0) {
              updatedCategories.push({
                id: 'cat-expert',
                title: 'Expert Proficiencies',
                skills: expert,
              })
            }
            if (advanced.length > 0) {
              updatedCategories.push({
                id: 'cat-adv',
                title: 'Advanced Competencies',
                skills: advanced,
              })
            }
            if (core.length > 0) {
              updatedCategories.push({
                id: 'cat-core',
                title: 'Core Technologies',
                skills: core,
              })
            }
            if (updatedCategories.length > 0) {
              setCategories(updatedCategories)
            }
          }
        }}
      />

      <SettingsModal
        isOpen={activeModal === 'settings'}
        onClose={handleCloseModal}
        preferences={preferences}
        onSavePreferences={(updated) => setPreferences(updated)}
        user={currentUser}
        initialTab={tab as SettingsTabId | undefined}
        onProfileUpdated={(updated) => {
          setProfileOverride(updated)
          updateUser(updated)
        }}
        onLogout={handleLogout}
      />

      <Footer />
    </div>
  )
}
