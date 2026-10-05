import { useState } from 'react'
import type { SkillProficiency, SkillCreateInput } from '../../../types/workspace'

interface SkillFormProps {
  initialValues?: {
    name: string
    proficiency: SkillProficiency
  }
  onSubmit: (payload: SkillCreateInput) => Promise<void>
  onCancel: () => void
  isSubmitting: boolean
  title?: string
  subtitle?: string
  submitLabel?: string
}

const PROFICIENCY_OPTIONS: {
  level: SkillProficiency
  label: string
  subtitle: string
  icon: string
  dots: number
}[] = [
  {
    level: 'beginner',
    label: 'Beginner',
    subtitle: 'Foundational concepts, guided execution',
    icon: 'school',
    dots: 1,
  },
  {
    level: 'intermediate',
    label: 'Intermediate',
    subtitle: 'Practical production use, autonomous builder',
    icon: 'code',
    dots: 2,
  },
  {
    level: 'advanced',
    label: 'Advanced',
    subtitle: 'Deep architectural fluency & system design',
    icon: 'military_tech',
    dots: 3,
  },
  {
    level: 'expert',
    label: 'Expert',
    subtitle: 'Domain authority, mentors & drives technical RFCs',
    icon: 'workspace_premium',
    dots: 4,
  },
]

const QUICK_SUGGESTIONS = [
  'Python',
  'TypeScript',
  'React',
  'Go',
  'FastAPI',
  'Docker',
  'PostgreSQL',
  'Kubernetes',
  'AWS',
  'GraphQL',
  'Redis',
  'Node.js',
]

export default function SkillForm({
  initialValues,
  onSubmit,
  onCancel,
  isSubmitting,
  title = 'Add New Skill',
  subtitle = 'Track technical competencies, tools, and depth of proficiency.',
  submitLabel = 'Save Skill',
}: SkillFormProps) {
  const [name, setName] = useState<string>(initialValues?.name || '')
  const [proficiency, setProficiency] = useState<SkillProficiency>(
    initialValues?.proficiency || 'intermediate'
  )
  const [validationError, setValidationError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()

    if (!trimmed) {
      setValidationError('Please enter a skill name.')
      return
    }

    if (trimmed.length > 100) {
      setValidationError('Skill name cannot exceed 100 characters.')
      return
    }

    setValidationError(null)
    await onSubmit({
      name: trimmed,
      proficiency,
    })
  }

  return (
    <div className="pref-create-card skill-form-card">
      <div className="pref-create-header">
        <div className="pref-create-title-group">
          <div className="pref-create-icon-badge">
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
              psychology
            </span>
          </div>
          <div>
            <h4 className="pref-create-title">{title}</h4>
            <p className="pref-create-subtitle">{subtitle}</p>
          </div>
        </div>
        <button
          type="button"
          className="pref-modal-close-btn"
          onClick={onCancel}
          disabled={isSubmitting}
          aria-label="Close form"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
            close
          </span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="pref-edit-body">
        {validationError && (
          <div className="company-form-error-banner">
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
              error
            </span>
            <span>{validationError}</span>
          </div>
        )}

        <div className="pref-field-group">
          <label htmlFor="skill-name-input" className="pref-field-label">
            Skill Name <span className="field-required">*</span>
          </label>
          <div className="company-input-wrapper">
            <span className="material-symbols-outlined company-input-icon">build</span>
            <input
              id="skill-name-input"
              type="text"
              className="pref-field-input company-input-with-icon"
              placeholder="e.g. TypeScript, Python, Distributed Systems, Docker..."
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (validationError) setValidationError(null)
              }}
              maxLength={100}
              required
              autoFocus
            />
          </div>

          {/* Quick Suggestions Chips */}
          <div className="skill-suggestions-row">
            <span className="skill-suggestions-label">Suggestions:</span>
            <div className="skill-suggestions-pills">
              {QUICK_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className={`skill-suggest-pill ${name.toLowerCase() === suggestion.toLowerCase() ? 'active' : ''}`}
                  onClick={() => setName(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Proficiency Level Grid Selector */}
        <div className="pref-field-group">
          <label className="pref-field-label">
            Proficiency Level <span className="field-required">*</span>
          </label>
          <div className="skill-proficiency-grid">
            {PROFICIENCY_OPTIONS.map((opt) => {
              const isSelected = proficiency === opt.level
              return (
                <button
                  key={opt.level}
                  type="button"
                  className={`skill-proficiency-choice ${opt.level} ${isSelected ? 'active' : ''}`}
                  onClick={() => setProficiency(opt.level)}
                >
                  <div className="skill-choice-header">
                    <div className="skill-choice-icon-wrap">
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                        {opt.icon}
                      </span>
                    </div>
                    <span className="skill-choice-label">{opt.label}</span>
                    <div className="skill-choice-indicator" title={`Level ${opt.dots} of 4`}>
                      {Array.from({ length: 4 }).map((_, i) => (
                        <span
                          key={i}
                          className={`skill-indicator-bar ${i < opt.dots ? 'filled' : ''}`}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="skill-choice-desc">{opt.subtitle}</div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pref-create-actions">
          <button
            type="button"
            className="pref-btn-cancel"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="action-btn-primary"
            disabled={isSubmitting || !name.trim()}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
              {isSubmitting ? 'sync' : 'save'}
            </span>
            <span>{isSubmitting ? 'Saving...' : submitLabel}</span>
          </button>
        </div>
      </form>
    </div>
  )
}
