import type { SkillProficiency } from '../../../types/workspace'
import { getProficiencyMeta } from './proficiency'

interface SkillBadgeProps {
  proficiency: SkillProficiency
  showIcon?: boolean
  className?: string
}

export default function SkillBadge({
  proficiency,
  showIcon = true,
  className = '',
}: SkillBadgeProps) {
  const meta = getProficiencyMeta(proficiency)

  return (
    <span className={`skill-badge ${meta.colorClass} ${className}`}>
      {showIcon && (
        <span className="material-symbols-outlined skill-badge-icon">
          {meta.icon}
        </span>
      )}
      <span className="skill-badge-label">{meta.label}</span>
    </span>
  )
}
