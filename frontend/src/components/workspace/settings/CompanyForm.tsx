import { useState } from 'react'
import type { CompanyWorkedCreateInput, EmploymentType } from '../../../types/workspace'

interface CompanyFormProps {
  initialValues?: {
    company_name: string
    job_title?: string | null
    employment_type?: EmploymentType
    start_date: string
    end_date?: string | null
    actively_working: boolean
  }
  onSubmit: (data: CompanyWorkedCreateInput) => Promise<void>
  onCancel: () => void
  isSubmitting: boolean
  title?: string
  subtitle?: string
  submitLabel?: string
}

export default function CompanyForm({
  initialValues,
  onSubmit,
  onCancel,
  isSubmitting,
  title = 'Add Company',
  subtitle = 'Record an active or past company to update your professional timeline.',
  submitLabel = 'Save Company',
}: CompanyFormProps) {
  const [companyName, setCompanyName] = useState<string>(initialValues?.company_name || '')
  const [jobTitle, setJobTitle] = useState<string>(initialValues?.job_title || '')
  const [employmentType, setEmploymentType] = useState<EmploymentType>(
    initialValues?.employment_type || 'full_time'
  )
  const [startDate, setStartDate] = useState<string>(initialValues?.start_date || '')
  const [endDate, setEndDate] = useState<string>(initialValues?.end_date || '')
  const [activelyWorking, setActivelyWorking] = useState<boolean>(
    initialValues?.actively_working ?? false
  )
  const [validationError, setValidationError] = useState<string | null>(null)

  const handleActivelyWorkingChange = (checked: boolean) => {
    setActivelyWorking(checked)
    if (checked) {
      setEndDate('')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setValidationError(null)

    const trimmedName = companyName.trim()
    if (!trimmedName) {
      setValidationError('Company name is required.')
      return
    }

    if (!startDate) {
      setValidationError('Start date is required.')
      return
    }

    if (!activelyWorking && endDate && endDate < startDate) {
      setValidationError('End date cannot be earlier than start date.')
      return
    }

    await onSubmit({
      company_name: trimmedName,
      job_title: jobTitle.trim() || null,
      employment_type: employmentType,
      start_date: startDate,
      end_date: activelyWorking ? null : endDate || null,
      actively_working: activelyWorking,
    })
  }


  return (
    <form className="pref-create-card company-form-card" onSubmit={handleSubmit}>
      <div className="pref-card-edit-header">
        <div className="pref-card-edit-title-group">
          <div className="pref-card-edit-icon-badge create">
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              apartment
            </span>
          </div>
          <div>
            <div className="pref-card-edit-heading">{title}</div>
            <div className="pref-card-edit-subheading">{subtitle}</div>
          </div>
        </div>
        <button
          type="button"
          className="pref-inline-close-btn"
          onClick={onCancel}
          disabled={isSubmitting}
          title="Cancel"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
            close
          </span>
        </button>
      </div>

      <div className="pref-edit-body">
        {validationError && (
          <div className="company-form-error-banner">
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
              error
            </span>
            <span>{validationError}</span>
          </div>
        )}

        <div className="company-name-grid">
          <div className="pref-field-group">
            <label htmlFor="company-name-input" className="pref-field-label">
              Company Name <span className="field-required">*</span>
            </label>
            <div className="company-input-wrapper">
              <span className="material-symbols-outlined company-input-icon">business</span>
              <input
                id="company-name-input"
                type="text"
                className="pref-field-input company-input-with-icon"
                placeholder="e.g. Stripe, Vercel, Google, Linear..."
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                maxLength={255}
                required
                autoFocus
              />
            </div>
          </div>

          <div className="pref-field-group">
            <label htmlFor="company-job-title-input" className="pref-field-label">
              Job Title <span className="pref-field-optional">(Optional)</span>
            </label>
            <div className="company-input-wrapper">
              <span className="material-symbols-outlined company-input-icon">work</span>
              <input
                id="company-job-title-input"
                type="text"
                className="pref-field-input company-input-with-icon"
                placeholder="e.g. Senior Backend Engineer"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                maxLength={150}
              />
            </div>
          </div>
        </div>

        <div className="pref-field-group">
          <label className="pref-field-label">Employment Type</label>
          <div className="company-type-selector">
            <button
              type="button"
              className={`company-type-choice ${employmentType === 'full_time' ? 'active' : ''}`}
              onClick={() => setEmploymentType('full_time')}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
                badge
              </span>
              <span>Full-Time</span>
            </button>
            <button
              type="button"
              className={`company-type-choice ${employmentType === 'part_time' ? 'active' : ''}`}
              onClick={() => setEmploymentType('part_time')}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
                schedule
              </span>
              <span>Part-Time</span>
            </button>
            <button
              type="button"
              className={`company-type-choice ${employmentType === 'contract' ? 'active' : ''}`}
              onClick={() => setEmploymentType('contract')}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
                history_edu
              </span>
              <span>Contract</span>
            </button>
            <button
              type="button"
              className={`company-type-choice ${employmentType === 'internship' ? 'active' : ''}`}
              onClick={() => setEmploymentType('internship')}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
                school
              </span>
              <span>Internship</span>
            </button>
          </div>
        </div>

        <div className="company-status-toggle-row">

          <label className="company-checkbox-label">
            <input
              type="checkbox"
              className="company-checkbox-native"
              checked={activelyWorking}
              onChange={(e) => handleActivelyWorkingChange(e.target.checked)}
            />
            <span className="company-checkbox-custom">
              {activelyWorking && (
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                  check
                </span>
              )}
            </span>
            <span className="company-checkbox-text">
              I am actively working here (Current Employer)
            </span>
          </label>
          {activelyWorking && (
            <span className="company-active-badge">
              <span className="company-active-dot" />
              Active Position
            </span>
          )}
        </div>

        <div className="company-dates-grid">
          <div className="pref-field-group">
            <label htmlFor="company-start-date" className="pref-field-label">
              Start Date <span className="field-required">*</span>
            </label>
            <div className="company-input-wrapper">
              <span className="material-symbols-outlined company-input-icon">calendar_month</span>
              <input
                id="company-start-date"
                type="date"
                className="pref-field-input company-input-with-icon"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="pref-field-group">
            <label htmlFor="company-end-date" className="pref-field-label">
              End Date {!activelyWorking && <span className="pref-field-optional">(Optional)</span>}
            </label>
            <div className="company-input-wrapper">
              <span className="material-symbols-outlined company-input-icon">event_available</span>
              <input
                id="company-end-date"
                type="date"
                className={`pref-field-input company-input-with-icon ${
                  activelyWorking ? 'disabled-date-input' : ''
                }`}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={activelyWorking}
                placeholder={activelyWorking ? 'Present' : ''}
              />
            </div>
            {activelyWorking && (
              <span className="company-field-hint">Marked as active/present.</span>
            )}
          </div>
        </div>

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
            className="pref-btn-save"
            disabled={isSubmitting || !companyName.trim() || !startDate}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
              save
            </span>
            <span>{isSubmitting ? 'Saving...' : submitLabel}</span>
          </button>
        </div>
      </div>
    </form>
  )
}
