import { useState } from 'react'
import type { UserPreferences } from '../../../types/workspace'
import { useToast } from '../../ToastContext'


interface OptimizationTabProps {
  preferences: UserPreferences
  onSavePreferences: (updated: UserPreferences) => void
}

export default function OptimizationTab({
  preferences,
  onSavePreferences,
}: OptimizationTabProps) {
  const toast = useToast()
  const [aggressiveMetrics, setAggressiveMetrics] = useState<boolean>(
    preferences.aggressiveMetrics
  )
  const [atsKeywordDensity, setAtsKeywordDensity] = useState<
    'Standard' | 'Aggressive' | 'Maximum Match'
  >(preferences.atsKeywordDensity || 'Aggressive')
  const [actionVerbTone, setActionVerbTone] = useState<
    'Dynamic Engineering' | 'Leadership & Strategic' | 'Research & Analytical'
  >(preferences.actionVerbTone || 'Dynamic Engineering')

  const [savedSuccess, setSavedSuccess] = useState<boolean>(false)

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    onSavePreferences({
      ...preferences,
      aggressiveMetrics,
      atsKeywordDensity,
      actionVerbTone,
    })
    setSavedSuccess(true)
    toast.success('ATS keyword density and metric amplification settings updated.', 'Optimization Config Saved')
    setTimeout(() => setSavedSuccess(false), 3000)
  }

  return (
    <form className="settings-pane-form" onSubmit={handleSave}>
      <div className="settings-pane-header">
        <div>
          <h4 className="settings-pane-title">ATS &amp; Optimization Engine</h4>
          <p className="settings-pane-desc">
            Fine-tune how the generative engine shapes your accomplishments, formats metrics, and matches keywords.
          </p>
        </div>
      </div>

      {savedSuccess && (
        <div className="settings-alert-banner success" role="status">
          <span className="material-symbols-outlined alert-icon">check_circle</span>
          <span>Optimization engine configuration saved!</span>
        </div>
      )}

      {/* Metric Amplification Toggle Card */}
      <div className="settings-section-card">
        <div className="toggle-card-row">
          <div style={{ flex: 1 }}>
            <div className="toggle-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Aggressive Metric Amplification</span>
              <span className="settings-pill-indicator active">Recommended</span>
            </div>
            <div className="toggle-desc" style={{ marginTop: '4px' }}>
              Automatically emphasizes quantifiable achievements (e.g. latency slashed by 42%, $1.4B+ revenue transacted, 99.999% uptime) in high-priority bullet points.
            </div>
          </div>
          <button
            type="button"
            className={`switch-toggle ${aggressiveMetrics ? 'on' : 'off'}`}
            onClick={() => setAggressiveMetrics(!aggressiveMetrics)}
            aria-pressed={aggressiveMetrics}
          >
            <span className="toggle-handle" />
          </button>
        </div>
      </div>

      {/* Section: ATS Calibration */}
      <div className="settings-section-card" style={{ marginTop: '16px' }}>
        <div className="settings-section-header">
          <div className="settings-section-icon">
            <span className="material-symbols-outlined">psychology</span>
          </div>
          <div>
            <h5 className="settings-section-title">Keyword Density &amp; Tone Tuning</h5>
            <p className="settings-section-desc">Control exact phrasing matching against target Job Descriptions</p>
          </div>
        </div>

        <div className="settings-grid-two">
          <div className="form-group-compact">
            <label className="compact-label" htmlFor="ats-density">
              Target Keyword Density
            </label>
            <select
              id="ats-density"
              className="compact-select"
              value={atsKeywordDensity}
              onChange={(e) =>
                setAtsKeywordDensity(
                  e.target.value as 'Standard' | 'Aggressive' | 'Maximum Match'
                )
              }
            >
              <option value="Standard">Standard (Natural phrasing, 80%+ match)</option>
              <option value="Aggressive">Aggressive (Prioritize ATS score, 92%+ match)</option>
              <option value="Maximum Match">Maximum Match (Direct keyword mirroring)</option>
            </select>
          </div>

          <div className="form-group-compact">
            <label className="compact-label" htmlFor="action-tone">
              Action Verb Style
            </label>
            <select
              id="action-tone"
              className="compact-select"
              value={actionVerbTone}
              onChange={(e) =>
                setActionVerbTone(
                  e.target.value as
                    | 'Dynamic Engineering'
                    | 'Leadership & Strategic'
                    | 'Research & Analytical'
                )
              }
            >
              <option value="Dynamic Engineering">Dynamic Engineering (Architected, Slashed, Engineered)</option>
              <option value="Leadership & Strategic">Leadership &amp; Strategic (Spearheaded, Championed, Partnered)</option>
              <option value="Research & Analytical">Research &amp; Analytical (Constructed, Investigated, Quantified)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Information Box */}
      <div className="settings-info-card" style={{ marginTop: '16px' }}>
        <div className="settings-info-icon">
          <span className="material-symbols-outlined">verified</span>
        </div>
        <div className="settings-info-content">
          <div className="settings-info-title">ATS Compliance Guarantee</div>
          <div className="settings-info-desc">
            All generated resumes maintain standard single-column typography, high contrast ratios, and clean hierarchy. We never inject invisible text or non-standard tables that trigger parsing penalties in Greenhouse, Lever, or Workday.
          </div>
        </div>
      </div>

      {/* Pane Footer Action Bar */}
      <div className="settings-pane-actions">
        <div className="settings-actions-hint">
          Tuning takes effect immediately upon generating resumes.
        </div>
        <button type="submit" className="action-btn-primary">
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
            save
          </span>
          <span>Save Optimization Config</span>
        </button>
      </div>
    </form>
  )
}
