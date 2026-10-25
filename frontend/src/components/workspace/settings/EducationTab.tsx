import { useEffect, useState } from 'react'
import {
  ApiError,
  createEducation,
  deleteEducation,
  listEducation,
  updateEducation,
} from '../../../api/education'
import type { EducationCreateInput, EducationItem } from '../../../types/workspace'
import { useToast } from '../../ToastContext'

interface EducationTabProps {
  token?: string
}

const MONTH_YEAR_FORMAT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  year: 'numeric',
})

function formatMonthYear(value: string | null): string | null {
  if (!value) return null
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return null
  return MONTH_YEAR_FORMAT.format(parsed)
}

function formatDateRange(startDate: string | null, endDate: string | null): string | null {
  const start = formatMonthYear(startDate)
  if (!start) return null
  const end = formatMonthYear(endDate) ?? 'Present'
  return `${start} \u2013 ${end}`
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.detail
  if (err instanceof Error && err.message) return err.message
  return fallback
}

export default function EducationTab({ token: propToken }: EducationTabProps) {
  const toast = useToast()
  const token =
    propToken ||
    localStorage.getItem('careerTrack_token') ||
    sessionStorage.getItem('careerTrack_token') ||
    ''

  const [records, setRecords] = useState<EducationItem[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const [degree, setDegree] = useState<string>('')
  const [institution, setInstitution] = useState<string>('')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [description, setDescription] = useState<string>('')
  const [validationError, setValidationError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    listEducation(token)
      .then((data) => {
        if (isMounted) setRecords(data)
      })
      .catch((err: unknown) => {
        if (isMounted) {
          toast.error(errorMessage(err, 'Error fetching education records'), 'Network Error')
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [token, toast])

  const resetForm = () => {
    setDegree('')
    setInstitution('')
    setStartDate('')
    setEndDate('')
    setDescription('')
    setValidationError(null)
    setEditingId(null)
    setIsFormOpen(false)
  }

  const openCreateForm = () => {
    setDegree('')
    setInstitution('')
    setStartDate('')
    setEndDate('')
    setDescription('')
    setValidationError(null)
    setEditingId(null)
    setIsFormOpen(true)
  }

  const openEditForm = (record: EducationItem) => {
    setDegree(record.degree)
    setInstitution(record.institution)
    setStartDate(record.start_date ?? '')
    setEndDate(record.end_date ?? '')
    setDescription(record.description)
    setValidationError(null)
    setEditingId(record.id)
    setIsFormOpen(true)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setValidationError(null)

    const trimmedDegree = degree.trim()
    const trimmedInstitution = institution.trim()
    const trimmedStartDate = startDate.trim()
    const trimmedEndDate = endDate.trim()
    const trimmedDescription = description.trim()
    const isEditing = editingId !== null

    if (!trimmedDegree) {
      setValidationError('Degree is required.')
      return
    }
    if (!trimmedInstitution) {
      setValidationError('Institution is required.')
      return
    }
    if (!trimmedStartDate) {
      setValidationError('Start date is required.')
      return
    }
    if (trimmedEndDate && trimmedEndDate < trimmedStartDate) {
      setValidationError('End date cannot be earlier than start date.')
      return
    }
    if (!trimmedDescription) {
      setValidationError('Description is required.')
      return
    }

    const payload: EducationCreateInput = {
      degree: trimmedDegree,
      institution: trimmedInstitution,
      description: trimmedDescription,
      start_date: trimmedStartDate,
      end_date: trimmedEndDate || null,
    }

    setIsSubmitting(true)
    try {
      if (isEditing && editingId !== null) {
        const saved = await updateEducation(token, editingId, payload)
        setRecords((prev) => prev.map((item) => (item.id === saved.id ? saved : item)))
        toast.success(`"${saved.degree}" updated successfully.`, 'Education Updated')
      } else {
        const saved = await createEducation(token, payload)
        setRecords((prev) => [saved, ...prev])
        toast.success(`"${saved.degree}" added to your education.`, 'Education Added')
      }
      resetForm()
    } catch (err: unknown) {
      toast.error(
        errorMessage(err, isEditing ? 'Could not update education record' : 'Could not save education record'),
        isEditing ? 'Update Error' : 'Save Error'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (record: EducationItem) => {
    if (
      !window.confirm(
        `Are you sure you want to remove "${record.degree}, ${record.institution}" from your education?`
      )
    ) {
      return
    }

    setDeletingId(record.id)
    try {
      await deleteEducation(token, record.id)
      setRecords((prev) => prev.filter((item) => item.id !== record.id))
      if (editingId === record.id) {
        resetForm()
      }
      toast.info(`"${record.degree}" removed from your education.`, 'Education Deleted')
    } catch (err: unknown) {
      toast.error(errorMessage(err, 'Failed to delete education record'), 'Delete Error')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="settings-pane-form education-tab-container">
      <div className="settings-pane-header">
        <div>
          <h4 className="settings-pane-title">Education</h4>
          <p className="settings-pane-desc">
            Record your degrees, institutions, study dates, and every detail worth surfacing on your
            resume. These qualifications are added to your resume draft.
          </p>
        </div>
        <button
          type="button"
          className={`pref-add-btn ${isFormOpen && editingId === null ? 'active' : ''}`}
          onClick={() => {
            if (isFormOpen && editingId === null) {
              resetForm()
            } else {
              openCreateForm()
            }
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
            {isFormOpen && editingId === null ? 'close' : 'add'}
          </span>
          <span>{isFormOpen && editingId === null ? 'Cancel' : 'Add Education'}</span>
        </button>
      </div>

      {isFormOpen && (
        <form className="pref-create-card education-form-card" onSubmit={handleSubmit}>
          <div className="pref-card-edit-header">
            <div className="pref-card-edit-title-group">
              <div className="pref-card-edit-icon-badge create">
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  school
                </span>
              </div>
              <div>
                <div className="pref-card-edit-heading">
                  {editingId !== null ? 'Edit Qualification' : 'Add New Qualification'}
                </div>
                <div className="pref-card-edit-subheading">
                  Degree, institution, study dates, and a full description.
                </div>
              </div>
            </div>
            <button
              type="button"
              className="pref-inline-close-btn"
              onClick={resetForm}
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

            <div className="education-form-grid">
              <div className="pref-field-group">
                <label htmlFor="education-degree" className="pref-field-label">
                  Degree <span className="field-required">*</span>
                </label>
                <div className="company-input-wrapper">
                  <span className="material-symbols-outlined company-input-icon">school</span>
                  <input
                    id="education-degree"
                    type="text"
                    className="pref-field-input company-input-with-icon"
                    placeholder="e.g. B.Tech, M.Sc"
                    value={degree}
                    onChange={(event) => setDegree(event.target.value)}
                    maxLength={150}
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className="pref-field-group">
                <label htmlFor="education-institution" className="pref-field-label">
                  Institution <span className="field-required">*</span>
                </label>
                <div className="company-input-wrapper">
                  <span className="material-symbols-outlined company-input-icon">account_balance</span>
                  <input
                    id="education-institution"
                    type="text"
                    className="pref-field-input company-input-with-icon"
                    placeholder="e.g. NIT Trichy"
                    value={institution}
                    onChange={(event) => setInstitution(event.target.value)}
                    maxLength={255}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="education-date-grid">
              <div className="pref-field-group">
                <label htmlFor="education-start-date" className="pref-field-label">
                  Start Date <span className="field-required">*</span>
                </label>
                <input
                  id="education-start-date"
                  type="date"
                  className="pref-field-input education-date-input"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  required
                />
              </div>

              <div className="pref-field-group">
                <label htmlFor="education-end-date" className="pref-field-label">
                  End Date <span className="pref-field-optional">(Optional)</span>
                </label>
                <input
                  id="education-end-date"
                  type="date"
                  className="pref-field-input education-date-input"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(event) => setEndDate(event.target.value)}
                />
                <span className="education-field-hint">
                  Leave this empty if you are still studying.
                </span>
              </div>
            </div>

            <div className="pref-field-group">
              <label htmlFor="education-description" className="pref-field-label">
                Description <span className="field-required">*</span>
              </label>
              <textarea
                id="education-description"
                className="pref-field-textarea education-description-input"
                rows={4}
                placeholder="B.Tech in Computer Science, NIT Trichy - 8.4 CGPA, graduated with distinction"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={2000}
                required
              />
            </div>

            <div className="pref-create-actions">
              <button
                type="button"
                className="pref-btn-cancel"
                onClick={resetForm}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="pref-btn-save"
                disabled={
                  isSubmitting ||
                  !degree.trim() ||
                  !institution.trim() ||
                  !startDate.trim() ||
                  !description.trim()
                }
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                  save
                </span>
                <span>{isSubmitting ? 'Saving...' : 'Save Qualification'}</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {isLoading && (
        <div className="pref-loading-box">
          <div className="pref-loading-spinner" />
          <span>Synchronizing education records from server...</span>
        </div>
      )}

      {!isLoading && records.length > 0 && (
        <div className="education-records-list">
          {records.map((record) => {
            const dateRange = formatDateRange(record.start_date, record.end_date)
            return (
              <article
                key={record.id}
                className={`education-record-card ${editingId === record.id ? 'editing' : ''}`}
              >
                <div className="education-record-icon">
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                    school
                  </span>
                </div>
                <div className="education-record-content">
                  <h5 className="education-record-degree">{record.degree}</h5>
                  <p className="education-record-meta">
                    <span className="education-record-institution">{record.institution}</span>
                    {dateRange && (
                      <>
                        <span className="education-record-meta-separator">·</span>
                        <span className="education-record-dates">{dateRange}</span>
                      </>
                    )}
                  </p>
                  {record.description && (
                    <p className="education-record-description">{record.description}</p>
                  )}
                </div>
                <div className="pref-card-actions">
                  <button
                    type="button"
                    className="pref-action-btn"
                    onClick={() => openEditForm(record)}
                    title="Edit qualification"
                    aria-label={`Edit ${record.degree}`}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                      edit
                    </span>
                  </button>
                  <button
                    type="button"
                    className="pref-action-btn danger"
                    onClick={() => handleDelete(record)}
                    disabled={deletingId === record.id}
                    title="Delete qualification"
                    aria-label={`Delete ${record.degree}`}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                      {deletingId === record.id ? 'hourglass_top' : 'delete'}
                    </span>
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {!isLoading && records.length === 0 && (
        <div className="pref-empty-box education-empty-box">
          <div className="pref-empty-icon-wrapper">
            <span className="material-symbols-outlined pref-empty-icon">school</span>
          </div>
          <h5 className="pref-empty-title">No education recorded yet</h5>
          <p className="pref-empty-desc">
            Add your first qualification to include your degree, study dates, and details in your
            resume.
          </p>
          <button type="button" className="action-btn-primary" onClick={openCreateForm}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              add_circle
            </span>
            <span>Add Your First Qualification</span>
          </button>
        </div>
      )}
    </div>
  )
}
