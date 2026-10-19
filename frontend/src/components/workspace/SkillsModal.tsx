import { useState, useEffect, useMemo } from 'react'
import type {
  SkillItem,
  SkillProficiency,
  SkillCreateInput,
  SkillUpdateInput,
  SkillCategory,
} from '../../types/workspace'
import { useToast } from '../ToastContext'
import { SkillCard, SkillForm } from './skills'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'

interface SkillsModalProps {
  isOpen: boolean
  onClose: () => void
  token?: string
  categories?: SkillCategory[]
  onAddSkill?: (categoryId: string, skillName: string) => void
  onSkillsChange?: (skills: SkillItem[]) => void
}

type FilterTab = 'all' | SkillProficiency

export default function SkillsModal({
  isOpen,
  onClose,
  token: propToken,
  onSkillsChange,
}: SkillsModalProps) {
  const toast = useToast()
  useBodyScrollLock(isOpen)
  const token =
    propToken ||
    localStorage.getItem('careerTrack_token') ||
    sessionStorage.getItem('careerTrack_token') ||
    ''

  const [skills, setSkills] = useState<SkillItem[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(() => Boolean(token))
  const [filter, setFilter] = useState<FilterTab>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Form states
  const [isCreating, setIsCreating] = useState<boolean>(false)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [isUpdating, setIsUpdating] = useState<boolean>(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  // Fetch skills from API
  useEffect(() => {
    if (!isOpen || !token) return

    let isMounted = true

    fetch('/api/v1/skills', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load skills')
        return res.json()
      })
      .then((data: SkillItem[]) => {
        if (isMounted) {
          setSkills(data)
          if (onSkillsChange) onSkillsChange(data)
        }
      })
      .catch((err) => {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : 'Error fetching skills'
          toast.error(msg, 'Network Error')
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [isOpen, token, onSkillsChange, toast])

  // Create Skill Handler
  const handleCreateSkill = async (payload: SkillCreateInput) => {
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/v1/skills', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        const msg =
          typeof errData.detail === 'string'
            ? errData.detail
            : 'Could not create skill'
        throw new Error(msg)
      }

      const created: SkillItem = await res.json()
      const updated = [created, ...skills]
      setSkills(updated)
      if (onSkillsChange) onSkillsChange(updated)
      setIsCreating(false)
      toast.success(`"${created.name}" added to skills`, 'Skill Added')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Update Skill Handler
  const handleUpdateSkill = async (id: number, payload: SkillUpdateInput) => {
    setIsUpdating(true)
    try {
      const res = await fetch(`/api/v1/skills/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        const msg =
          typeof errData.detail === 'string'
            ? errData.detail
            : 'Could not update skill'
        throw new Error(msg)
      }

      const updatedItem: SkillItem = await res.json()
      const updated = skills.map((s) => (s.id === id ? updatedItem : s))
      setSkills(updated)
      if (onSkillsChange) onSkillsChange(updated)
      setEditingId(null)
      toast.success(`"${updatedItem.name}" updated`, 'Skill Updated')
    } finally {
      setIsUpdating(false)
    }
  }

  // Delete Skill Handler
  const handleDeleteSkill = async (id: number, name: string) => {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/v1/skills/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!res.ok && res.status !== 204) {
        throw new Error('Failed to delete skill')
      }

      const updated = skills.filter((s) => s.id !== id)
      setSkills(updated)
      if (onSkillsChange) onSkillsChange(updated)
      toast.success(`"${name}" removed from profile`, 'Skill Deleted')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not delete skill'
      toast.error(msg, 'Delete Error')
    } finally {
      setDeletingId(null)
    }
  }

  // Client-side filtering & search
  const filteredSkills = useMemo(() => {
    return skills.filter((skill) => {
      const matchesFilter = filter === 'all' || skill.proficiency === filter
      const matchesSearch =
        !searchQuery.trim() ||
        skill.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
      return matchesFilter && matchesSearch
    })
  }, [skills, filter, searchQuery])

  if (!isOpen) return null

  const filterTabs: { id: FilterTab; label: string; count: number }[] = [
    { id: 'all', label: 'All Skills', count: skills.length },
    {
      id: 'expert',
      label: 'Expert',
      count: skills.filter((s) => s.proficiency === 'expert').length,
    },
    {
      id: 'advanced',
      label: 'Advanced',
      count: skills.filter((s) => s.proficiency === 'advanced').length,
    },
    {
      id: 'intermediate',
      label: 'Intermediate',
      count: skills.filter((s) => s.proficiency === 'intermediate').length,
    },
    {
      id: 'beginner',
      label: 'Beginner',
      count: skills.filter((s) => s.proficiency === 'beginner').length,
    },
  ]

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="skills-modal-title"
    >
      <div
        className="modal-container modal-large skills-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="skills-modal-header">
          <div className="skills-modal-header-left">
            <div className="modal-icon-badge tertiary">
              <span className="material-symbols-outlined">psychology</span>
            </div>
            <div>
              <h3 id="skills-modal-title" className="skills-modal-title">
                Skills &amp; Technical Competencies
              </h3>
              <p className="skills-modal-subtitle">
                Manage verified technical skills and proficiencies for tailored ATS keyword matching
              </p>
            </div>
          </div>
          <div className="skills-modal-header-right">
            {!isCreating && (
              <button
                type="button"
                className="action-btn-primary skills-add-btn"
                onClick={() => {
                  setIsCreating(true)
                  setEditingId(null)
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                  add
                </span>
                <span>Add Skill</span>
              </button>
            )}
            <button
              type="button"
              className="modal-close-btn"
              onClick={onClose}
              aria-label="Close modal"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        {/* Inline Creation Drawer */}
        {isCreating && (
          <div className="skills-create-drawer-wrap">
            <SkillForm
              onSubmit={handleCreateSkill}
              onCancel={() => setIsCreating(false)}
              isSubmitting={isSubmitting}
              title="Add New Skill"
              subtitle="Specify skill title and select an assessed proficiency tier."
              submitLabel="Add Skill"
            />
          </div>
        )}

        {/* Toolbar: Filters & Fast Search */}
        <div className="skills-toolbar">
          <div className="skills-filter-pills" role="tablist">
            {filterTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={filter === tab.id}
                className={`skills-filter-pill ${filter === tab.id ? 'active' : ''}`}
                onClick={() => setFilter(tab.id)}
              >
                <span>{tab.label}</span>
                <span className="skills-filter-count">{tab.count}</span>
              </button>
            ))}
          </div>

          <div className="skills-search-wrapper">
            <span className="material-symbols-outlined skills-search-icon">search</span>
            <input
              type="text"
              className="skills-search-input"
              placeholder="Search skills..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="skills-search-clear"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                  close
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="skills-modal-body">
          {isLoading && (
            <div className="pref-loading-box skills-loading-box">
              <div className="pref-loading-spinner" />
              <span>Synchronizing skills with server...</span>
            </div>
          )}

          {!isLoading && filteredSkills.length > 0 && (
            <div className="skills-cards-grid">
              {filteredSkills.map((skill) => (
                <SkillCard
                  key={skill.id}
                  skill={skill}
                  isEditing={editingId === skill.id}
                  isUpdating={isUpdating}
                  isDeleting={deletingId === skill.id}
                  onStartEdit={() => {
                    setEditingId(skill.id)
                    if (isCreating) setIsCreating(false)
                  }}
                  onCancelEdit={() => setEditingId(null)}
                  onSaveEdit={(payload) => handleUpdateSkill(skill.id, payload)}
                  onDelete={() => handleDeleteSkill(skill.id, skill.name)}
                />
              ))}
            </div>
          )}

          {!isLoading && filteredSkills.length === 0 && (
            <div className="pref-empty-box skills-empty-box">
              <div className="pref-empty-icon-wrapper">
                <span className="material-symbols-outlined pref-empty-icon">
                  psychology_alt
                </span>
              </div>
              <h5 className="pref-empty-title">
                {searchQuery.trim()
                  ? `No skills matching "${searchQuery}"`
                  : filter === 'all'
                  ? 'No skills recorded yet'
                  : `No ${filter} skills found`}
              </h5>
              <p className="pref-empty-desc">
                {searchQuery.trim()
                  ? 'Try a different search term or clear the filter.'
                  : 'Add technical competencies, languages, frameworks, or cloud architectures to power ATS score optimizations.'}
              </p>
              {!isCreating && (
                <button
                  type="button"
                  className="action-btn-primary skills-empty-cta"
                  onClick={() => setIsCreating(true)}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                    add_circle
                  </span>
                  <span>Add Your First Skill</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="skills-modal-footer">
          <div className="skills-footer-meta">
            <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#10b981' }}>
              cloud_done
            </span>
            <span>
              {skills.length} total skill{skills.length === 1 ? '' : 's'} recorded
            </span>
          </div>
          <button type="button" className="action-btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
