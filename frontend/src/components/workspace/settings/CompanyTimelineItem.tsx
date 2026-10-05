import type { CompanyWorkedItem, CompanyWorkedCreateInput } from '../../../types/workspace'
import CompanyForm from './CompanyForm'

interface CompanyTimelineItemProps {
  company: CompanyWorkedItem
  isLast: boolean
  isEditing: boolean
  onStartEdit: () => void
  onCancelEdit: () => void
  onSaveEdit: (data: CompanyWorkedCreateInput) => Promise<void>
  onDelete: () => Promise<void>
  isDeleting: boolean
  isUpdating: boolean
}


function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  try {
    // Treat date as YYYY-MM-DD
    const [year, month, day] = dateStr.split('-').map(Number)
    if (!year || !month) return dateStr
    const d = new Date(year, month - 1, day || 1)
    return d.toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function calculateDuration(startDateStr: string, endDateStr?: string | null, isCurrent?: boolean): string {
  try {
    const [sYear, sMonth] = startDateStr.split('-').map(Number)
    if (!sYear || !sMonth) return ''

    let eYear: number
    let eMonth: number

    if (isCurrent || !endDateStr) {
      const now = new Date()
      eYear = now.getFullYear()
      eMonth = now.getMonth() + 1
    } else {
      const [y, m] = endDateStr.split('-').map(Number)
      eYear = y
      eMonth = m
    }

    let totalMonths = (eYear - sYear) * 12 + (eMonth - sMonth)
    if (totalMonths < 1) totalMonths = 1

    const years = Math.floor(totalMonths / 12)
    const months = totalMonths % 12

    const parts: string[] = []
    if (years > 0) parts.push(`${years} yr${years > 1 ? 's' : ''}`)
    if (months > 0) parts.push(`${months} mo${months > 1 ? 's' : ''}`)

    return parts.length > 0 ? parts.join(' ') : '< 1 mo'
  } catch {
    return ''
  }
}

function formatEmploymentType(type?: string): { label: string; icon: string } {
  switch (type) {
    case 'part_time':
      return { label: 'Part-Time', icon: 'schedule' }
    case 'contract':
      return { label: 'Contract', icon: 'history_edu' }
    case 'internship':
      return { label: 'Internship', icon: 'school' }
    case 'full_time':
    default:
      return { label: 'Full-Time', icon: 'badge' }
  }
}

export default function CompanyTimelineItem({
  company,
  isLast,
  isEditing,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  isDeleting,
  isUpdating,
}: CompanyTimelineItemProps) {
  const startFormatted = formatDate(company.start_date)
  const endFormatted = company.actively_working ? 'Present' : company.end_date ? formatDate(company.end_date) : 'Undated'
  const duration = calculateDuration(company.start_date, company.end_date, company.actively_working)
  const empMeta = formatEmploymentType(company.employment_type)

  if (isEditing) {
    return (
      <div className="company-timeline-node editing">
        <div className="company-timeline-rail">
          <div className="company-timeline-dot active">
            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
              edit
            </span>
          </div>
          {!isLast && <div className="company-timeline-line" />}
        </div>
        <div className="company-timeline-card-wrapper">
          <CompanyForm
            initialValues={{
              company_name: company.company_name,
              employment_type: company.employment_type,
              start_date: company.start_date,
              end_date: company.end_date,
              actively_working: company.actively_working,
            }}
            onSubmit={onSaveEdit}
            onCancel={onCancelEdit}
            isSubmitting={isUpdating}
            title={`Edit ${company.company_name}`}
            subtitle="Update start date, end date, employment type, or actively working status."
            submitLabel="Save Changes"
          />
        </div>
      </div>
    )
  }

  return (
    <div className={`company-timeline-node ${company.actively_working ? 'current' : ''}`}>
      <div className="company-timeline-rail">
        <div
          className={`company-timeline-dot ${company.actively_working ? 'active' : ''}`}
          title={company.actively_working ? 'Actively working' : 'Previous company'}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
            {company.actively_working ? 'work' : 'business'}
          </span>
        </div>
        {!isLast && <div className="company-timeline-line" />}
      </div>

      <div className="company-timeline-card-wrapper">
        <div className="company-timeline-card">
          <div className="company-timeline-header">
            <div className="company-timeline-title-wrap">
              <div className="company-icon-avatar">
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                  domain
                </span>
              </div>
              <div>
                <div className="company-timeline-name-row">
                  <h5 className="company-timeline-name">{company.company_name}</h5>
                  <span className={`company-type-badge ${company.employment_type || 'full_time'}`}>
                    <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>
                      {empMeta.icon}
                    </span>
                    {empMeta.label}
                  </span>
                  {company.actively_working ? (
                    <span className="company-active-pill">
                      <span className="company-active-dot pulse" />
                      Actively Working
                    </span>
                  ) : (
                    <span className="company-past-pill">Past Employer</span>
                  )}
                </div>

                <div className="company-timeline-meta-row">
                  <span className="company-date-chip">
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                      calendar_today
                    </span>
                    <span>
                      {startFormatted} – {endFormatted}
                    </span>
                  </span>
                  {duration && (
                    <>
                      <span className="company-meta-separator">•</span>
                      <span className="company-duration-chip">{duration}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="pref-card-actions">
              <button
                type="button"
                className="pref-action-btn"
                onClick={onStartEdit}
                title="Edit company"
                disabled={isDeleting}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                  edit
                </span>
              </button>
              <button
                type="button"
                className="pref-action-btn danger"
                onClick={onDelete}
                title="Delete company"
                disabled={isDeleting}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                  delete
                </span>
              </button>
            </div>
          </div>

          <div className="company-timeline-footer">
            <div className="company-timeline-details">
              <span className="company-detail-item">
                <span className="company-detail-key">Start:</span>
                <span className="company-detail-val">{company.start_date}</span>
              </span>
              <span className="company-meta-separator">|</span>
              <span className="company-detail-item">
                <span className="company-detail-key">End:</span>
                <span className="company-detail-val">
                  {company.actively_working ? 'Present (Active)' : company.end_date || 'N/A'}
                </span>
              </span>
            </div>
            <span className="pref-date-text">
              Logged: {new Date(company.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
