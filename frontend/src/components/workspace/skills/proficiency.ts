import type { SkillProficiency } from '../../../types/workspace'

export function getProficiencyMeta(proficiency: SkillProficiency): {
  label: string
  icon: string
  colorClass: string
} {
  switch (proficiency) {
    case 'expert':
      return {
        label: 'Expert',
        icon: 'workspace_premium',
        colorClass: 'prof-expert',
      }
    case 'advanced':
      return {
        label: 'Advanced',
        icon: 'verified',
        colorClass: 'prof-advanced',
      }
    case 'intermediate':
      return {
        label: 'Intermediate',
        icon: 'trending_up',
        colorClass: 'prof-intermediate',
      }
    case 'beginner':
    default:
      return {
        label: 'Beginner',
        icon: 'school',
        colorClass: 'prof-beginner',
      }
  }
}
