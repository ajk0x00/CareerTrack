import { useState } from 'react'
import type { UserPreferences } from '../../types/workspace'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  preferences: UserPreferences
  onSavePreferences: (updated: UserPreferences) => void
}

export default function SettingsModal({
  isOpen,
  onClose,
  preferences,
  onSavePreferences,
}: SettingsModalProps) {
  const [targetRole, setTargetRole] = useState<string>(preferences.targetRole)
  const [targetComp, setTargetComp] = useState<string>(preferences.targetComp)
  const [workplacePreference, setWorkplacePreference] = useState<
    'Remote (Worldwide)' | 'Hybrid (San Francisco / NYC)' | 'On-site'
  >(preferences.workplacePreference)
  const [aggressiveMetrics, setAggressiveMetrics] = useState<boolean>(
    preferences.aggressiveMetrics
  )

  if (!isOpen) return null

  const handleSave = () => {
    onSavePreferences({
      targetRole,
      targetComp,
      workplacePreference,
      aggressiveMetrics,
    })
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-container modal-medium"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon-badge secondary">
              <span className="material-symbols-outlined">settings</span>
            </div>
            <div>
              <h3 className="modal-title">Career Profile &amp; Preferences</h3>
              <p className="modal-subtitle">
                Tune optimization engine and salary benchmarking
              </p>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="settings-fields-body">
          <div className="form-group-compact">
            <label className="compact-label">Target Role Category</label>
            <input
              type="text"
              className="compact-input"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
            />
          </div>

          <div className="grid-two-cols" style={{ marginTop: '14px' }}>
            <div className="form-group-compact">
              <label className="compact-label">Target Base Comp (USD)</label>
              <input
                type="text"
                className="compact-input mono"
                value={targetComp}
                onChange={(e) => setTargetComp(e.target.value)}
              />
            </div>

            <div className="form-group-compact">
              <label className="compact-label">Workplace Preference</label>
              <select
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
                <option value="On-site">On-site</option>
              </select>
            </div>
          </div>

          <div className="toggle-card-row" style={{ marginTop: '16px' }}>
            <div>
              <div className="toggle-title">Aggressive Metric Amplification</div>
              <div className="toggle-desc">
                Prioritize revenue, latency, and scale percentages in bullet points
              </div>
            </div>
            <button
              type="button"
              className={`switch-toggle ${aggressiveMetrics ? 'on' : 'off'}`}
              onClick={() => setAggressiveMetrics(!aggressiveMetrics)}
              aria-pressed={aggressiveMetrics}
            >
              <span className="toggle-handle"></span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="action-btn-primary" onClick={handleSave}>
            Save Preferences
          </button>
        </div>
      </div>
    </div>
  )
}
