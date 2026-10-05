import type { SkillItem, SkillProficiency } from '../../../types/workspace'
import SkillBadge from './SkillBadge'
import SkillForm from './SkillForm'

interface SkillCardProps {
  skill: SkillItem
  isEditing: boolean
  isUpdating: boolean
  isDeleting: boolean
  onStartEdit: () => void
  onCancelEdit: () => void
  onSaveEdit: (payload: { name: string; proficiency: SkillProficiency }) => Promise<void>
  onDelete: () => void
}

export default function SkillCard({
  skill,
  isEditing,
  isUpdating,
  isDeleting,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
}: SkillCardProps) {
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
          title={`Edit "${skill.name}"`}
          subtitle="Update skill naming or proficiency rating."
          submitLabel="Save Changes"
        />
      </div>
    )
  }

  return (
    <div className={`skill-card ${isDeleting ? 'deleting' : ''}`}>
      <div className="skill-card-content">
        <div className="skill-card-identity">
          <span className="skill-card-name">{skill.name}</span>
          <SkillBadge proficiency={skill.proficiency} />
        </div>

        <div className="skill-card-actions">
          <button
            type="button"
            className="skill-action-btn edit"
            onClick={onStartEdit}
            title="Edit skill"
            disabled={isDeleting}
            aria-label={`Edit ${skill.name}`}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
              edit
            </span>
          </button>
          <button
            type="button"
            className="skill-action-btn delete"
            onClick={onDelete}
            title="Delete skill"
            disabled={isDeleting}
            aria-label={`Delete ${skill.name}`}
          >
            {isDeleting ? (
              <span className="pref-loading-spinner tiny" />
            ) : (
              <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
                delete
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
