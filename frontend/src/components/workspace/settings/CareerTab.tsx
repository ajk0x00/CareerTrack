import { useState, useEffect, useMemo } from 'react'
import type {
  CompanyWorkedItem,
  CompanyWorkedCreateInput,
} from '../../../types/workspace'
import { useToast } from '../../ToastContext'
import CompanyForm from './CompanyForm'
import CompanyTimelineItem from './CompanyTimelineItem'

interface CareerTabProps {
  token?: string
}

const CURRENT_YEAR = new Date().getFullYear()

export default function CareerTab({ token: propToken }: CareerTabProps) {

  const toast = useToast()
  const token =
    propToken ||
    localStorage.getItem('careerTrack_token') ||
    sessionStorage.getItem('careerTrack_token') ||
    ''

  const [companies, setCompanies] = useState<CompanyWorkedItem[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [filter, setFilter] = useState<'all' | 'active' | 'past'>('all')

  // Form states
  const [isCreating, setIsCreating] = useState<boolean>(false)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [isUpdating, setIsUpdating] = useState<boolean>(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  // Fetch companies from backend
  useEffect(() => {
    let isMounted = true
    const url =
      filter === 'all'
        ? '/api/v1/companies'
        : filter === 'active'
        ? '/api/v1/companies?actively_working=true'
        : '/api/v1/companies?actively_working=false'

    fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load companies')
        return res.json()
      })
      .then((data: CompanyWorkedItem[]) => {
        if (isMounted) setCompanies(data)
      })
      .catch((err) => {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : 'Error fetching company data'
          toast.error(msg, 'Network Error')
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [token, filter, toast])

  // Create new company
  const handleCreateCompany = async (payload: CompanyWorkedCreateInput) => {
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/v1/companies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        const msg =
          typeof errData.detail === 'string'
            ? errData.detail
            : 'Could not create company entry'
        throw new Error(msg)
      }

      const created: CompanyWorkedItem = await res.json()
      setCompanies((prev) => [created, ...prev])
      setIsCreating(false)
      toast.success(
        `"${created.company_name}" added to your career timeline.`,
        'Company Added'
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save company'
      toast.error(msg, 'Save Error')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Update existing company
  const handleUpdateCompany = async (
    companyId: number,
    payload: CompanyWorkedCreateInput
  ) => {
    setIsUpdating(true)
    try {
      const res = await fetch(`/api/v1/companies/${companyId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        const msg =
          typeof errData.detail === 'string'
            ? errData.detail
            : 'Could not update company entry'
        throw new Error(msg)
      }

      const updated: CompanyWorkedItem = await res.json()
      setCompanies((prev) =>
        prev.map((c) => (c.id === companyId ? updated : c))
      )
      setEditingId(null)
      toast.success(
        `"${updated.company_name}" details updated successfully.`,
        'Company Updated'
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update company'
      toast.error(msg, 'Update Error')
    } finally {
      setIsUpdating(false)
    }
  }

  // Delete company
  const handleDeleteCompany = async (companyId: number, companyName: string) => {
    if (
      !window.confirm(
        `Are you sure you want to remove "${companyName}" from your career timeline?`
      )
    ) {
      return
    }

    setDeletingId(companyId)
    try {
      const res = await fetch(`/api/v1/companies/${companyId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!res.ok) {
        throw new Error('Failed to delete company entry')
      }

      setCompanies((prev) => prev.filter((c) => c.id !== companyId))
      toast.info(`"${companyName}" removed from career history.`, 'Company Deleted')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete company'
      toast.error(msg, 'Delete Error')
    } finally {
      setDeletingId(null)
    }
  }

  // Stats calculation
  const stats = useMemo(() => {
    const total = companies.length
    const active = companies.filter((c) => c.actively_working).length
    const past = total - active

    let earliestYear: number | null = null
    companies.forEach((c) => {
      const y = parseInt(c.start_date.split('-')[0], 10)
      if (!isNaN(y)) {
        if (earliestYear === null || y < earliestYear) earliestYear = y
      }
    })

    const spanText =
      earliestYear !== null
        ? `${earliestYear} – Present (${CURRENT_YEAR - earliestYear} yrs)`
        : 'Not recorded'


    return { total, active, past, spanText }
  }, [companies])

  return (
    <div className="settings-pane-form career-tab-container">
      {/* Top Header */}
      <div className="settings-pane-header">
        <div>
          <h4 className="settings-pane-title">Career Timeline &amp; Companies</h4>
          <p className="settings-pane-desc">
            Record your past and active employers, employment dates, and current roles. This timeline fuels your resume work experience.
          </p>
        </div>
        <button
          type="button"
          className={`pref-add-btn ${isCreating ? 'active' : ''}`}
          onClick={() => {
            setIsCreating(!isCreating)
            if (editingId) setEditingId(null)
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
            {isCreating ? 'close' : 'add'}
          </span>
          <span>{isCreating ? 'Cancel' : 'Add Company'}</span>
        </button>
      </div>

      {/* Career Overview Stats Bar */}
      <div className="career-stats-row">
        <div className="career-stat-card">
          <div className="career-stat-icon-wrap primary">
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              apartment
            </span>
          </div>
          <div>
            <div className="career-stat-number">{stats.total}</div>
            <div className="career-stat-label">Companies Logged</div>
          </div>
        </div>

        <div className="career-stat-card">
          <div className="career-stat-icon-wrap active">
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              work
            </span>
          </div>
          <div>
            <div className="career-stat-number">{stats.active}</div>
            <div className="career-stat-label">Actively Working</div>
          </div>
        </div>

        <div className="career-stat-card">
          <div className="career-stat-icon-wrap timeline">
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              timeline
            </span>
          </div>
          <div>
            <div className="career-stat-number">{stats.spanText}</div>
            <div className="career-stat-label">Career Span</div>
          </div>
        </div>
      </div>

      {/* Creation Drawer */}
      {isCreating && (
        <CompanyForm
          onSubmit={handleCreateCompany}
          onCancel={() => setIsCreating(false)}
          isSubmitting={isSubmitting}
          title="Add New Company"
          subtitle="Add an active position or previous employer with employment dates."
          submitLabel="Save Company"
        />
      )}

      {/* Filter Segment Tabs */}
      <div className="pref-filter-bar">
        <button
          type="button"
          className={`pref-filter-pill ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          <span>All Companies</span>
          <span className="pref-filter-count">{companies.length}</span>
        </button>
        <button
          type="button"
          className={`pref-filter-pill ${filter === 'active' ? 'active' : ''}`}
          onClick={() => setFilter('active')}
        >
          <span>Actively Working</span>
          <span className="pref-filter-count">
            {companies.filter((c) => c.actively_working).length}
          </span>
        </button>
        <button
          type="button"
          className={`pref-filter-pill ${filter === 'past' ? 'active' : ''}`}
          onClick={() => setFilter('past')}
        >
          <span>Previous Roles</span>
          <span className="pref-filter-count">
            {companies.filter((c) => !c.actively_working).length}
          </span>
        </button>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="pref-loading-box">
          <div className="pref-loading-spinner" />
          <span>Synchronizing career timeline from server...</span>
        </div>
      )}

      {/* Timeline Stream */}
      {!isLoading && companies.length > 0 && (
        <div className="company-timeline-stream">
          {companies.map((company, index) => (
            <CompanyTimelineItem
              key={company.id}
              company={company}
              isLast={index === companies.length - 1}
              isEditing={editingId === company.id}

              onStartEdit={() => {
                setEditingId(company.id)
                if (isCreating) setIsCreating(false)
              }}
              onCancelEdit={() => setEditingId(null)}
              onSaveEdit={(payload) => handleUpdateCompany(company.id, payload)}
              onDelete={() => handleDeleteCompany(company.id, company.company_name)}
              isDeleting={deletingId === company.id}
              isUpdating={isUpdating}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && companies.length === 0 && (
        <div className="pref-empty-box company-empty-box">
          <div className="pref-empty-icon-wrapper">
            <span className="material-symbols-outlined pref-empty-icon">
              work_history
            </span>
          </div>
          <h5 className="pref-empty-title">
            {filter === 'all'
              ? 'No company history recorded yet'
              : filter === 'active'
              ? 'No active employers found'
              : 'No past employers found'}
          </h5>
          <p className="pref-empty-desc">
            Build your professional narrative. Add companies you have worked in with start and end dates to construct a verified career timeline.
          </p>

          <button
            type="button"
            className="action-btn-primary company-empty-cta"
            onClick={() => setIsCreating(true)}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              add_circle
            </span>
            <span>Add Your First Company</span>
          </button>
        </div>
      )}
    </div>
  )
}
