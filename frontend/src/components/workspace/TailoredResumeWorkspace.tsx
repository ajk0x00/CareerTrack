import { useState, useEffect } from 'react'
import type { User } from '../../types/auth'
import type {
  ExperienceItem,
  SkillCategory,
  UserPreferences,
} from '../../types/workspace'
import WorkspaceNavbar from './WorkspaceNavbar'
import JobDescriptionPanel from './JobDescriptionPanel'
import ResumeCanvas from './ResumeCanvas'
import ExperienceModal from './ExperienceModal'
import SkillsModal from './SkillsModal'
import SettingsModal from './SettingsModal'
import Footer from '../Footer'

interface TailoredResumeWorkspaceProps {
  user: User
  onLogout: () => void
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

const DEFAULT_MARKDOWN = `# ALEX CHEN
**Staff Full-Stack & Product Infrastructure Engineer**  
San Francisco, CA • alex.chen@workplace.dev • +1 (415) 890-4412  
[github.com/alexchen-eng](https://github.com) • [linkedin.com/in/alexchen](https://linkedin.com)

---

## PROFESSIONAL SUMMARY
Staff Product & Distributed Systems Engineer with 8+ years specializing in high-throughput payment architectures, resilient Next.js edge runtimes, and developer infrastructure. Architected multi-currency billing engines transacting **$4.2B+ quarterly** with zero unplanned downtime. Proven collaborator with executive leadership across product direction, regulatory compliance, and distributed team scaling.

---

## WORK EXPERIENCE

### Staff Product Engineer • Edge Platform
**Vercel Inc.** | May 2022 – Present | San Francisco, CA (Remote)
- Spearheaded the rebuild of the core **Incremental Static Regeneration (ISR) pipeline**, slashing global Edge TTFB by **42%** across 400M+ monthly incoming page executions.
- Engineered declarative middleware validation layer in **TypeScript and Go**, enabling fine-grained security policies and automated traffic rerouting across multi-region serverless clusters.
- Collaborated cross-functionally with Design Systems and Product Management to release 12 core Vercel dashboard workflow modules, expanding active enterprise seats by **34% YoY**.
- Authored zero-downtime deployment strategies and incident runbooks; maintained a pristine **99.999% platform availability** throughout peak traffic surges.

### Senior Full-Stack Engineer • Billing & Subscriptions
**Stripe** | January 2019 – April 2022 | San Francisco, CA
- Designed and delivered the automated tax recalculation microservice for Stripe Invoicing, processing **$1.4B+ in monthly recurring transactions** across 48 distinct international regulatory jurisdictions.
- Migrated mission-critical billing scheduler from legacy polling to distributed **Kafka event streaming and Redis caching**, resolving race conditions and decreasing invoice generation p99 latency from 1.8s to **85ms**.
- Mentored 6 engineers through promotion cycles; founded the internal Frontend Performance Guild producing shared linting rules, bundle analyzer tooling, and standardized Web Vitals tracking.
- Directly authored **REST and GraphQL API contracts** implemented by thousands of developer teams worldwide with extensive regression test suites achieving 96% branch coverage.

### Software Engineer II • Trading Systems
**Coinbase** | August 2017 – December 2018 | San Francisco, CA
- Constructed resilient WebSocket trading telemetry feeds sustaining sustained loads of **180,000 concurrent client connections** with sub-millisecond dispatch times.
- Rewrote React institutional order book component with WebAssembly parsing modules, eliminating frame drops during extreme market volatility periods.

---

## TECHNICAL COMPETENCIES
- **Languages & Runtimes:** TypeScript, JavaScript (ESNext), Go, Python, Node.js, SQL, HTML5/CSS3
- **Frameworks & UI:** React 18+, Next.js App Router, Tailwind CSS, GraphQL, Express, gRPC
- **Cloud & Data Systems:** PostgreSQL, Redis, Apache Kafka, AWS (ECS, S3, RDS), Docker, Kubernetes, CI/CD

---

## EDUCATION
**University of California, Berkeley**  
B.S. in Electrical Engineering & Computer Science (EECS) — *Magna Cum Laude*`

const INITIAL_EXPERIENCES: ExperienceItem[] = [
  {
    id: 'exp-1',
    company: 'Vercel Inc.',
    role: 'Staff Product Engineer • Edge Platform',
    period: 'May 2022 – Present',
    location: 'San Francisco, CA (Remote)',
    description:
      'Spearheaded rebuild of the core Incremental Static Regeneration (ISR) pipeline across 400M+ monthly page hits. Engineered declarative middleware validation layer in TypeScript and Go with fine-grained routing policies.',
    bullets: [
      'Slashing global Edge TTFB by 42% across distributed serverless clusters.',
      'Expanded active enterprise workflow seats by 34% YoY via 12 core dashboard modules.',
      'Maintained 99.999% platform availability throughout viral customer releases.',
    ],
    metricsCount: 3,
    skills: ['TypeScript', 'Go', 'Edge Computing'],
    isCurrent: true,
  },
  {
    id: 'exp-2',
    company: 'Stripe',
    role: 'Senior Full-Stack Engineer • Billing & Subscriptions',
    period: 'Jan 2019 – Apr 2022',
    location: 'San Francisco, CA',
    description:
      'Architected automated tax recalculation microservices processing $1.4B+ monthly transactions. Migrated billing scheduler from legacy polling to distributed Kafka streaming and Redis caching.',
    bullets: [
      'Decreased p99 invoice batch latency from 1.8s to 85ms with zero race conditions.',
      'Mentored 6 engineers through promotion and created internal Frontend Performance Guild.',
      'Delivered REST & GraphQL contracts with 96% branch coverage.',
    ],
    metricsCount: 4,
    skills: ['Kafka', 'Redis', 'GraphQL', 'PostgreSQL'],
  },
  {
    id: 'exp-3',
    company: 'Coinbase',
    role: 'Software Engineer II • Trading Systems',
    period: 'Aug 2017 – Dec 2018',
    location: 'San Francisco, CA',
    description:
      'Constructed resilient WebSocket trading telemetry feeds sustaining sustained loads of 180,000 concurrent client connections with sub-millisecond dispatch times. Rewrote React institutional order book component with WebAssembly parsing modules.',
    bullets: [
      'Engineered sub-millisecond order book dispatch feed with WebAssembly parsing.',
      'Eliminated frame drops during high-volume trading volatility surges.',
    ],
    metricsCount: 2,
    skills: ['WebSockets', 'React', 'WebAssembly'],
  },
]

const INITIAL_SKILLS: SkillCategory[] = [
  {
    id: 'cat-1',
    title: 'Primary Languages & Frameworks',
    skills: [
      'TypeScript • 8 yrs',
      'React / Next.js • 7 yrs',
      'Node.js • 7 yrs',
      'Go • 4 yrs',
      'Python / PyTorch • 3 yrs',
    ],
  },
  {
    id: 'cat-2',
    title: 'Cloud & Infrastructure',
    skills: [
      'AWS ECS / Lambda',
      'Kubernetes',
      'Docker',
      'PostgreSQL / Prisma',
      'Kafka & Redis',
    ],
  },
  {
    id: 'cat-3',
    title: 'Architecture & Methodologies',
    skills: [
      'Distributed Systems',
      'High-Volume Microservices',
      'Zero-Downtime Deployment',
      'GraphQL Federations',
    ],
  },
]

const INITIAL_PREFERENCES: UserPreferences = {
  targetRole: 'Staff / Lead Software Engineer • Full-Stack',
  targetComp: '$220,000 - $265,000',
  workplacePreference: 'Remote (Worldwide)',
  aggressiveMetrics: true,
}

export default function TailoredResumeWorkspace({
  user,
  onLogout,
}: TailoredResumeWorkspaceProps) {
  const [currentWorkspace, setCurrentWorkspace] = useState<string>(
    'Tailored Resume Generator'
  )
  const [company, setCompany] = useState<string>('Stripe, Inc.')
  const [roleTitle, setRoleTitle] = useState<string>('Staff Product Engineer')
  const [jobDescription, setJobDescription] = useState<string>(DEFAULT_SAMPLE_JD)
  const [markdownContent, setMarkdownContent] = useState<string>(DEFAULT_MARKDOWN)
  const [experiences, setExperiences] = useState<ExperienceItem[]>(INITIAL_EXPERIENCES)
  const [categories, setCategories] = useState<SkillCategory[]>(INITIAL_SKILLS)
  const [preferences, setPreferences] = useState<UserPreferences>(INITIAL_PREFERENCES)

  // Modals state
  const [activeModal, setActiveModal] = useState<
    'experience' | 'skills' | 'settings' | null
  >(null)

  // Generation state
  const [isGenerating, setIsGenerating] = useState<boolean>(false)
  const [highlightFlash, setHighlightFlash] = useState<boolean>(false)

  const displayName =
    user.email === 'demo@careertrack.app'
      ? 'Alex Chen'
      : user.email.split('@')[0].replace(/[._]/g, ' ')

  // Handle Trigger Resume Generation
  const handleGenerate = () => {
    setIsGenerating(true)
    setTimeout(() => {
      setIsGenerating(false)
      setHighlightFlash(true)
      setTimeout(() => setHighlightFlash(false), 1200)
    }, 900)
  }

  // Keyboard shortcut listener (Cmd/Ctrl + Enter to generate, Escape to close modals)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        handleGenerate()
      }
      if (e.key === 'Escape') {
        setActiveModal(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(markdownContent)
    alert('Tailored resume markdown copied to clipboard!')
  }

  return (
    <div className="workspace-root">
      {/* Navbar */}
      <WorkspaceNavbar
        user={user}
        currentWorkspace={currentWorkspace}
        onSelectWorkspace={(name) => setCurrentWorkspace(name)}
        onOpenExperience={() => setActiveModal('experience')}
        onOpenSkills={() => setActiveModal('skills')}
        onOpenSettings={() => setActiveModal('settings')}
        onLogout={onLogout}
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
        />
      </main>

      {/* Interactive Modals */}
      <ExperienceModal
        isOpen={activeModal === 'experience'}
        onClose={() => setActiveModal(null)}
        experiences={experiences}
        onAddExperience={(newItem) => setExperiences([newItem, ...experiences])}
        onRemoveExperience={(id) =>
          setExperiences(experiences.filter((exp) => exp.id !== id))
        }
      />

      <SkillsModal
        isOpen={activeModal === 'skills'}
        onClose={() => setActiveModal(null)}
        categories={categories}
        onAddSkill={(catId, skill) => {
          setCategories(
            categories.map((cat) =>
              cat.id === catId ? { ...cat, skills: [...cat.skills, skill] } : cat
            )
          )
        }}
      />

      <SettingsModal
        isOpen={activeModal === 'settings'}
        onClose={() => setActiveModal(null)}
        preferences={preferences}
        onSavePreferences={(updated) => setPreferences(updated)}
      />

      <Footer />
    </div>
  )
}
