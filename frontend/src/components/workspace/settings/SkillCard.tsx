import { useState } from 'react'
import type { SkillItem, SkillProficiency, SkillUpdateInput } from '../../../types/workspace'
import SkillForm from './SkillForm'

interface SkillCardProps {
  skill: SkillItem
  isEditing: boolean
  onStartEdit: () => void
  onCancelEdit: () => void
  onSaveEdit: (payload: SkillUpdateInput) => Promise<void>
  onDelete: () => Promise<void>
  isDeleting: boolean
  isUpdating: boolean
}

const PROFICIENCY_META: Record<
  SkillProficiency,
  { label: string; icon: string; level: number; className: string }
> = {
  beginner: {
    label: 'Beginner',
    icon: 'school',
    level: 1,
    className: 'proficiency-beginner',
  },
  intermediate: {
    label: 'Intermediate',
    icon: 'code',
    level: 2,
    className: 'proficiency-intermediate',
  },
  advanced: {
    label: 'Advanced',
    icon: 'military_tech',
    level: 3,
    className: 'proficiency-advanced',
  },
  expert: {
    label: 'Expert',
    icon: 'workspace_premium',
    level: 4,
    className: 'proficiency-expert',
  },
}

export default function SkillCard({
  skill,
  isEditing,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  isDeleting,
  isUpdating,
}: SkillCardProps) {
  const [showConfirmDelete, setShowConfirmDelete] = useState<boolean>(false)
  const meta = PROFICIENCY_META[skill.proficiency] || PROFICIENCY_META.intermediate

  if (isEditing) {
    return (
      <div className="skill-card-editing-wrapper">
        <SkillForm
          initialValues={{
            name: skill.name,
            proficiency: skill.proficiency,
          }}
          onSubmit={onSaveEdit}
          onCancel={onCancelEdit}
          isSubmitting={isUpdating}
          title={`Edit ${skill.name}`}
          subtitle="Update skill name or proficiency rating"
          submitLabel="Save Changes"
        />
      </div>
    )
  }

  return (
    <div className={`skill-card ${meta.className}`}>
      <div className="skill-card-main">
        <div className="skill-card-left">
          <div className="skill-card-icon-wrap">
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
              {meta.icon}
            </span>
          </div>
          <div className="skill-card-content">
            <div className="skill-card-title-row">
              <h5 className="skill-card-name" title={skill.name}>
                {skill.name}
              </h5>
              <span className={`skill-badge ${meta.className}`}>
                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>
                  {meta.icon}
                </span>
                <span>{meta.label}</span>
              </span>
            </div>

            <div className="skill-level-bars" title={`Proficiency level ${meta.level} of 4`}>
              {Array.from({ length: 4 }).map((_, idx) => (
                <span
                  key={idx}
                  className={`skill-bar-segment ${idx < meta.level ? 'active' : ''}`}
                />
              ))}
              <span className="skill-level-caption">Tier {meta.level}/4</span>
            </div>
          </div>
        </div>

        {/* Card Actions */}
        <div className="pref-card-actions">
          {showConfirmDelete ? (
            <div className="skill-delete-confirm-group">
              <span className="skill-delete-prompt">Delete?</span>
              <button
                type="button"
                className="skill-confirm-btn"
                onClick={onDelete}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Yes'}
              </button>
              <button
                type="button"
                className="skill-cancel-btn"
                onClick={() => setShowConfirmDelete(false)}
                disabled={isDeleting}
              >
                No
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                className="pref-action-btn"
                onClick={onStartEdit}
                title="Edit skill"
                disabled={isDeleting}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                  edit
                </span>
              </button>
              <button
                type="button"
                className="pref-action-btn delete"
                onClick={() => setShowConfirmDelete(true)}
                title="Delete skill"
                disabled={isDeleting}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                  delete
                </span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
