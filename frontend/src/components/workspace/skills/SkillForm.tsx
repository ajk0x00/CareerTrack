import React, { useState } from 'react'
import type { SkillProficiency } from '../../../types/workspace'
import { getProficiencyMeta } from './proficiency'

interface SkillFormProps {
  initialValues?: {
    name: string
    proficiency: SkillProficiency
  }
  onSubmit: (payload: { name: string; proficiency: SkillProficiency }) => Promise<void>
  onCancel: () => void
  isSubmitting?: boolean
  title?: string
  subtitle?: string
  submitLabel?: string
}

const PROFICIENCY_OPTIONS: SkillProficiency[] = [
  'expert',
  'advanced',
  'intermediate',
  'beginner',
]

export default function SkillForm({
  initialValues,
  onSubmit,
  onCancel,
  isSubmitting = false,
  title,
  subtitle,
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
      setValidationError('Skill name cannot be empty.')
      return
    }
    if (trimmed.length > 100) {
      setValidationError('Skill name cannot exceed 100 characters.')
      return
    }

    setValidationError(null)
    try {
      await onSubmit({
        name: trimmed,
        proficiency,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save skill'
      setValidationError(msg)
    }
  }

  return (
    <form className="skill-form-drawer" onSubmit={handleSubmit}>
      {(title || subtitle) && (
        <div className="skill-form-header">
          <div className="skill-form-title-wrap">
            <span className="material-symbols-outlined skill-form-header-icon">
              {initialValues ? 'edit' : 'add_circle'}
            </span>
            <div>
              {title && <h5 className="skill-form-title">{title}</h5>}
              {subtitle && <p className="skill-form-subtitle">{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            className="skill-form-close-btn"
            onClick={onCancel}
            disabled={isSubmitting}
            aria-label="Cancel"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              close
            </span>
          </button>
        </div>
      )}

      <div className="skill-form-body">
        {validationError && (
          <div className="skill-form-error-banner">
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
            <span className="material-symbols-outlined company-input-icon">psychology</span>
            <input
              id="skill-name-input"
              type="text"
              className="pref-field-input company-input-with-icon"
              placeholder="e.g. TypeScript, React, PostgreSQL, Distributed Systems..."
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
        </div>

        <div className="pref-field-group">
          <label className="pref-field-label">Proficiency Level</label>
          <div className="proficiency-selector">
            {PROFICIENCY_OPTIONS.map((lvl) => {
              const meta = getProficiencyMeta(lvl)
              const isSelected = proficiency === lvl
              return (
                <button
                  key={lvl}
                  type="button"
                  className={`proficiency-choice ${meta.colorClass} ${
                    isSelected ? 'active' : ''
                  }`}
                  onClick={() => setProficiency(lvl)}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                    {meta.icon}
                  </span>
                  <span>{meta.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="skill-form-actions">
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
            {isSubmitting ? (
              <>
                <span className="pref-loading-spinner tiny" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                  check
                </span>
                <span>{submitLabel}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  )
}
