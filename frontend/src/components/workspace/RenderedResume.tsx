import type { ExperienceItem, SkillCategory } from '../../types/workspace'

interface RenderedResumeProps {
  userName: string
  roleTitle: string
  company: string
  experiences: ExperienceItem[]
  categories: SkillCategory[]
}

export default function RenderedResume({
  userName,
  roleTitle,
  company,
  experiences,
  categories,
}: RenderedResumeProps) {
  return (
    <article className="resume-sheet">
      {/* Resume Header */}
      <header className="resume-header">
        <div className="resume-header-top">
          <div>
            <h1 className="resume-candidate-name">{userName.toUpperCase()}</h1>
            <p className="resume-target-role">
              {roleTitle} • {company} Tailored
            </p>
          </div>
          <div className="resume-contact-block">
            <span>alex.chen@workplace.dev</span>
            <span>+1 (415) 890-4412 • San Francisco, CA</span>
            <span>github.com/alexchen-eng • linkedin.com/in/alexchen</span>
          </div>
        </div>

        {/* Summary */}
        <div className="resume-summary-box">
          <p className="resume-summary-text">
            Staff Product &amp; Distributed Systems Engineer with 8+ years specializing in high-throughput
            payment architectures, resilient Next.js edge runtimes, and developer infrastructure.
            Architected multi-currency billing engines transacting{' '}
            <span className="metric-badge">$4.2B+ quarterly</span> with zero unplanned downtime.
            Proven collaborator with executive leadership across product direction, regulatory
            compliance, and distributed team scaling.
          </p>
        </div>
      </header>

      {/* Work Experience */}
      <section className="resume-section">
        <div className="section-title-row">
          <h2 className="section-title">Work Experience</h2>
          <div className="section-divider-line"></div>
        </div>

        <div className="experience-items-stack">
          {experiences.map((exp) => (
            <div key={exp.id} className="resume-exp-item">
              <div className="exp-heading-row">
                <div>
                  <span className="exp-company-bold">{exp.company}</span>
                  <span className="bullet-dot">•</span>
                  <span className="exp-role-title">{exp.role}</span>
                </div>
                <span className="exp-period-text">{exp.period}</span>
              </div>
              <div className="exp-location-text">{exp.location}</div>

              <ul className="exp-bullets-list">
                {exp.bullets.map((bullet, bIdx) => (
                  <li key={bIdx}>{bullet}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Technical Competencies */}
      <section className="resume-section">
        <div className="section-title-row">
          <h2 className="section-title">Technical Competencies</h2>
          <div className="section-divider-line"></div>
        </div>

        <div className="competencies-grid">
          {categories.map((cat) => (
            <div key={cat.id} className="competency-card">
              <span className="competency-title">{cat.title}</span>
              <p className="competency-content">{cat.skills.join(', ')}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Education & Credentials */}
      <section className="resume-section">
        <div className="section-title-row">
          <h2 className="section-title">Education &amp; Credentials</h2>
          <div className="section-divider-line"></div>
        </div>

        <div className="education-row">
          <div>
            <span className="edu-school">University of California, Berkeley</span>
            <span className="bullet-dot">•</span>
            <span className="edu-degree">B.S. in Electrical Engineering &amp; Computer Science (EECS)</span>
          </div>
          <span className="edu-honors">Graduated Magna Cum Laude</span>
        </div>
      </section>
    </article>
  )
}
