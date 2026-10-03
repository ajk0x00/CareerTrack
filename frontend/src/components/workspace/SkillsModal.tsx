import { useState } from 'react'
import type { SkillCategory } from '../../types/workspace'

interface SkillsModalProps {
  isOpen: boolean
  onClose: () => void
  categories: SkillCategory[]
  onAddSkill: (categoryId: string, skillName: string) => void
}

export default function SkillsModal({
  isOpen,
  onClose,
  categories,
  onAddSkill,
}: SkillsModalProps) {
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null)
  const [newSkillText, setNewSkillText] = useState<string>('')

  if (!isOpen) return null

  const handleAdd = (categoryId: string) => {
    if (!newSkillText.trim()) return
    onAddSkill(categoryId, newSkillText.trim())
    setNewSkillText('')
    setActiveCategoryId(null)
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
            <div className="modal-icon-badge tertiary">
              <span className="material-symbols-outlined">lightbulb</span>
            </div>
            <div>
              <h3 className="modal-title">Skills &amp; Competency Matrix</h3>
              <p className="modal-subtitle">
                Verified technical proficiencies and ATS keyword mappings
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

        {/* Categories */}
        <div className="skills-categories-list">
          {categories.map((category) => (
            <div key={category.id} className="skill-category-group">
              <span className="skill-category-title">{category.title}</span>
              <div className="skill-chips-wrap">
                {category.skills.map((skill, sIdx) => (
                  <span key={sIdx} className="skill-chip">
                    {skill}
                  </span>
                ))}

                {activeCategoryId === category.id ? (
                  <div className="inline-add-input-wrapper">
                    <input
                      type="text"
                      className="inline-skill-input"
                      placeholder="e.g. GraphQL • 3 yrs"
                      value={newSkillText}
                      onChange={(e) => setNewSkillText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAdd(category.id)
                        if (e.key === 'Escape') setActiveCategoryId(null)
                      }}
                      autoFocus
                    />
                    <button
                      type="button"
                      className="btn-tiny-save"
                      onClick={() => handleAdd(category.id)}
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      className="btn-tiny-cancel"
                      onClick={() => setActiveCategoryId(null)}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="add-skill-chip-btn"
                    onClick={() => {
                      setActiveCategoryId(category.id)
                      setNewSkillText('')
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                      add
                    </span>
                    <span>Add Skill</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
          <button type="button" className="action-btn-primary" onClick={onClose}>
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}
