import { useEffect, useState } from 'react'
import type { EducationCreateInput, EducationItem } from '../../../types/workspace'
import { useToast } from '../../ToastContext'

interface EducationTabProps {
  token?: string
}

interface ApiErrorBody {
  detail?: unknown
}

function extractErrorMessage(body: unknown, fallback: string): string {
  if (typeof body === 'object' && body !== null && 'detail' in body) {
    const detail = (body as ApiErrorBody).detail
    if (typeof detail === 'string') {
      return detail
    }
  }
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
  const [cgpa, setCgpa] = useState<string>('')
  const [validationError, setValidationError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    fetch('/api/v1/education', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load education records')
        return res.json()
      })
      .then((data: EducationItem[]) => {
        if (isMounted) setRecords(data)
      })
      .catch((err) => {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : 'Error fetching education records'
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

  const resetForm = () => {
    setDegree('')
    setInstitution('')
    setCgpa('')
    setValidationError(null)
    setEditingId(null)
    setIsFormOpen(false)
  }

  const openCreateForm = () => {
    setDegree('')
    setInstitution('')
    setCgpa('')
    setValidationError(null)
    setEditingId(null)
    setIsFormOpen(true)
  }

  const openEditForm = (record: EducationItem) => {
    setDegree(record.degree)
    setInstitution(record.institution)
    setCgpa(record.cgpa.toFixed(2))
    setValidationError(null)
    setEditingId(record.id)
    setIsFormOpen(true)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setValidationError(null)

    const trimmedDegree = degree.trim()
    const trimmedInstitution = institution.trim()
    const trimmedCgpa = cgpa.trim()

    if (!trimmedDegree) {
      setValidationError('Degree is required.')
      return
    }
    if (!trimmedInstitution) {
      setValidationError('Institution is required.')
      return
    }
    if (!trimmedCgpa) {
      setValidationError('CGPA is required.')
      return
    }

    const parsedCgpa = Number(trimmedCgpa)
    if (!Number.isFinite(parsedCgpa) || parsedCgpa < 0 || parsedCgpa > 99.99) {
      setValidationError('CGPA must be a number between 0 and 99.99.')
      return
    }

    const payload: EducationCreateInput = {
      degree: trimmedDegree,
      institution: trimmedInstitution,
      cgpa: parsedCgpa,
    }

    setIsSubmitting(true)
    try {
      const isEditing = editingId !== null
      const res = await fetch(
        isEditing ? `/api/v1/education/${editingId}` : '/api/v1/education',
        {
          method: isEditing ? 'PATCH' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        }
      )

      if (!res.ok) {
        const errData: unknown = await res.json().catch(() => null)
        throw new Error(
          extractErrorMessage(
            errData,
            isEditing ? 'Could not update education record' : 'Could not save education record'
          )
        )
      }

      const saved: EducationItem = await res.json()
      if (isEditing) {
        setRecords((prev) => prev.map((item) => (item.id === saved.id ? saved : item)))
        toast.success(`"${saved.degree}" updated successfully.`, 'Education Updated')
      } else {
        setRecords((prev) => [saved, ...prev])
        toast.success(`"${saved.degree}" added to your education.`, 'Education Added')
      }
      resetForm()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save education record'
      toast.error(msg, editingId !== null ? 'Update Error' : 'Save Error')
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
      const res = await fetch(`/api/v1/education/${record.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!res.ok) {
        const errData: unknown = await res.json().catch(() => null)
        throw new Error(extractErrorMessage(errData, 'Failed to delete education record'))
      }

      setRecords((prev) => prev.filter((item) => item.id !== record.id))
      if (editingId === record.id) {
        resetForm()
      }
      toast.info(`"${record.degree}" removed from your education.`, 'Education Deleted')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete education record'
      toast.error(msg, 'Delete Error')
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
            Record your degrees and institutions with the passing CGPA. These qualifications are
            added to your resume draft.
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
                  Degree type, institution, and passing CGPA.
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
                    placeholder="e.g. IIT Bombay"
                    value={institution}
                    onChange={(event) => setInstitution(event.target.value)}
                    maxLength={255}
                    required
                  />
                </div>
              </div>

              <div className="pref-field-group">
                <label htmlFor="education-cgpa" className="pref-field-label">
                  Passing CGPA <span className="field-required">*</span>
                </label>
                <div className="company-input-wrapper">
                  <span className="material-symbols-outlined company-input-icon">grade</span>
                  <input
                    id="education-cgpa"
                    type="number"
                    className="pref-field-input company-input-with-icon"
                    placeholder="e.g. 8.40"
                    value={cgpa}
                    onChange={(event) => setCgpa(event.target.value)}
                    step="0.01"
                    min="0"
                    max="99.99"
                    required
                  />
                </div>
              </div>
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
                disabled={isSubmitting || !degree.trim() || !institution.trim() || !cgpa.trim()}
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
          {records.map((record) => (
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
                <p className="education-record-institution">{record.institution}</p>
              </div>
              <span className="education-cgpa-badge">CGPA {record.cgpa.toFixed(2)}</span>
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
          ))}
        </div>
      )}

      {!isLoading && records.length === 0 && (
        <div className="pref-empty-box education-empty-box">
          <div className="pref-empty-icon-wrapper">
            <span className="material-symbols-outlined pref-empty-icon">school</span>
          </div>
          <h5 className="pref-empty-title">No education recorded yet</h5>
          <p className="pref-empty-desc">
            Add your first qualification to include your degree and CGPA in your resume.
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
