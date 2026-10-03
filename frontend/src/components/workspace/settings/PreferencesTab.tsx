import { useState } from 'react'
import type { UserPreferences } from '../../../types/workspace'
import { useToast } from '../../ToastContext'


interface PreferencesTabProps {
  preferences: UserPreferences
  onSavePreferences: (updated: UserPreferences) => void
}

const COMMON_ROLES = [
  'Staff / Lead Software Engineer • Full-Stack',
  'Senior Frontend Engineer • React / TypeScript',
  'Senior Backend Engineer • Distributed Systems',
  'Engineering Manager • Core Infrastructure',
  'Staff AI / Machine Learning Systems Engineer',
]

const INDUSTRIES = [
  'Fintech & Payments',
  'Developer Tools & Infrastructure',
  'Artificial Intelligence & ML',
  'Enterprise SaaS & Cloud',
  'Healthcare & Biotechnology',
  'Consumer Tech & Marketplace',
]

export default function PreferencesTab({
  preferences,
  onSavePreferences,
}: PreferencesTabProps) {
  const toast = useToast()
  const [targetRole, setTargetRole] = useState<string>(preferences.targetRole)
  const [targetComp, setTargetComp] = useState<string>(preferences.targetComp)
  const [workplacePreference, setWorkplacePreference] = useState<
    'Remote (Worldwide)' | 'Hybrid (San Francisco / NYC)' | 'On-site'
  >(preferences.workplacePreference)
  const [seniorityLevel, setSeniorityLevel] = useState<
    'Entry-Level' | 'Mid-Senior' | 'Staff / Principal' | 'Executive / Director'
  >(preferences.seniorityLevel || 'Staff / Principal')
  const [targetIndustry, setTargetIndustry] = useState<string>(
    preferences.targetIndustry || 'Fintech & Payments'
  )

  const [savedSuccess, setSavedSuccess] = useState<boolean>(false)

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    onSavePreferences({
      ...preferences,
      targetRole,
      targetComp,
      workplacePreference,
      seniorityLevel,
      targetIndustry,
    })
    setSavedSuccess(true)
    toast.success('Career preferences updated successfully!', 'Preferences Saved')
    setTimeout(() => setSavedSuccess(false), 3000)
  }

  return (
    <form className="settings-pane-form" onSubmit={handleSave}>
      <div className="settings-pane-header">
        <div>
          <h4 className="settings-pane-title">Career Preferences &amp; Targeting</h4>
          <p className="settings-pane-desc">
            Define your ideal career objectives, compensation expectations, and workplace boundaries.
          </p>
        </div>
      </div>

      {savedSuccess && (
        <div className="settings-alert-banner success" role="status">
          <span className="material-symbols-outlined alert-icon">check_circle</span>
          <span>Preferences saved successfully!</span>
        </div>
      )}

      {/* Section 1: Role & Seniority */}
      <div className="settings-section-card">
        <div className="settings-section-header">
          <div className="settings-section-icon">
            <span className="material-symbols-outlined">work</span>
          </div>
          <div>
            <h5 className="settings-section-title">Target Role &amp; Seniority Level</h5>
            <p className="settings-section-desc">Used to calibrate resume impact and executive presence</p>
          </div>
        </div>

        <div className="form-group-compact">
          <label className="compact-label" htmlFor="pref-target-role">
            Target Role Title
          </label>
          <input
            id="pref-target-role"
            type="text"
            className="compact-input"
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value)}
            placeholder="e.g. Staff Product Engineer"
            required
          />
        </div>

        <div className="preset-chips-row" style={{ marginTop: '8px' }}>
          <span className="preset-chips-label">Quick suggestions:</span>
          {COMMON_ROLES.map((role) => (
            <button
              key={role}
              type="button"
              className={`preset-chip ${targetRole === role ? 'active' : ''}`}
              onClick={() => setTargetRole(role)}
            >
              {role}
            </button>
          ))}
        </div>

        <div className="settings-grid-two" style={{ marginTop: '16px' }}>
          <div className="form-group-compact">
            <label className="compact-label" htmlFor="pref-seniority">
              Seniority Level
            </label>
            <select
              id="pref-seniority"
              className="compact-select"
              value={seniorityLevel}
              onChange={(e) =>
                setSeniorityLevel(
                  e.target.value as
                    | 'Entry-Level'
                    | 'Mid-Senior'
                    | 'Staff / Principal'
                    | 'Executive / Director'
                )
              }
            >
              <option value="Entry-Level">Entry-Level / Associate (0-2 yrs)</option>
              <option value="Mid-Senior">Mid-Senior Engineer (3-6 yrs)</option>
              <option value="Staff / Principal">Staff / Principal / Lead (7+ yrs)</option>
              <option value="Executive / Director">Director / VP / Executive</option>
            </select>
          </div>

          <div className="form-group-compact">
            <label className="compact-label" htmlFor="pref-industry">
              Target Industry / Sector
            </label>
            <select
              id="pref-industry"
              className="compact-select"
              value={targetIndustry}
              onChange={(e) => setTargetIndustry(e.target.value)}
            >
              {INDUSTRIES.map((ind) => (
                <option key={ind} value={ind}>
                  {ind}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Section 2: Compensation & Workplace */}
      <div className="settings-section-card" style={{ marginTop: '16px' }}>
        <div className="settings-section-header">
          <div className="settings-section-icon">
            <span className="material-symbols-outlined">payments</span>
          </div>
          <div>
            <h5 className="settings-section-title">Compensation &amp; Location</h5>
            <p className="settings-section-desc">Salary benchmarking and workplace flexibility</p>
          </div>
        </div>

        <div className="settings-grid-two">
          <div className="form-group-compact">
            <label className="compact-label" htmlFor="pref-comp">
              Target Base Comp (USD)
            </label>
            <input
              id="pref-comp"
              type="text"
              className="compact-input mono"
              value={targetComp}
              onChange={(e) => setTargetComp(e.target.value)}
              placeholder="e.g. $220,000 - $265,000"
            />
          </div>

          <div className="form-group-compact">
            <label className="compact-label" htmlFor="pref-workplace">
              Workplace Flexibility
            </label>
            <select
              id="pref-workplace"
              className="compact-select"
              value={workplacePreference}
              onChange={(e) =>
                setWorkplacePreference(
                  e.target.value as
                    | 'Remote (Worldwide)'
                    | 'Hybrid (San Francisco / NYC)'
                    | 'On-site'
                )
              }
            >
              <option value="Remote (Worldwide)">Remote (Worldwide)</option>
              <option value="Hybrid (San Francisco / NYC)">Hybrid (San Francisco / NYC)</option>
              <option value="On-site">On-site Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Pane Footer Action Bar */}
      <div className="settings-pane-actions">
        <div className="settings-actions-hint">
          Changes will influence all newly generated resumes in your pipeline.
        </div>
        <button type="submit" className="action-btn-primary">
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
            save
          </span>
          <span>Save Preferences</span>
        </button>
      </div>
    </form>
  )
}
