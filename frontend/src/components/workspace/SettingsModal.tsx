import { useState } from 'react'
import type { User } from '../../types/auth'
import type { UserPreferences } from '../../types/workspace'
import {
  SettingsSidebar,
  ProfileTab,
  CareerTab,
  PreferencesTab,
  OptimizationTab,
  AccountTab,
  type SettingsTabId,
} from './settings'


interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  preferences: UserPreferences
  onSavePreferences: (updated: UserPreferences) => void
  user: User
  initialTab?: SettingsTabId
  onProfileUpdated?: (updatedUser: User) => void
  onLogout?: () => void
}

export default function SettingsModal({
  isOpen,
  onClose,
  preferences,
  onSavePreferences,
  user,
  initialTab,
  onProfileUpdated,
  onLogout,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTabId>(initialTab || 'profile')

  if (!isOpen) return null

  const token =
    localStorage.getItem('careerTrack_token') ||
    sessionStorage.getItem('careerTrack_token') ||
    ''

  const handleProfileUpdated = (updatedUser: User) => {
    if (onProfileUpdated) {
      onProfileUpdated(updatedUser)
    }
  }

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-dialog-title"
    >
      <div
        className="modal-container modal-xlarge settings-dialog-container"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="settings-modal-header">
          <div className="settings-modal-header-left">
            <div className="settings-modal-header-badge">
              <span className="material-symbols-outlined">tune</span>
            </div>
            <div>
              <h3 id="settings-dialog-title" className="settings-modal-title">
                Workspace &amp; Account Settings
              </h3>
              <p className="settings-modal-subtitle">
                Manage your user profile, career preferences, optimization engine, and session
              </p>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close settings modal"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Modal Body: Sidebar + Main Content */}
        <div className="settings-modal-layout">
          <SettingsSidebar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            user={user}
          />

          <main className="settings-content-pane" role="tabpanel">
            {activeTab === 'profile' && (
              <ProfileTab
                user={user}
                token={token}
                onProfileUpdated={handleProfileUpdated}
              />
            )}

            {activeTab === 'career' && (
              <CareerTab
                token={token}
              />
            )}

            {activeTab === 'preferences' && (
              <PreferencesTab
                token={token}
              />
            )}


            {activeTab === 'optimization' && (
              <OptimizationTab
                preferences={preferences}
                onSavePreferences={onSavePreferences}
              />
            )}

            {activeTab === 'account' && (
              <AccountTab
                user={user}
                token={token}
                onLogout={onLogout || (() => {})}
              />
            )}
          </main>
        </div>
      </div>
    </div>
  )
}
