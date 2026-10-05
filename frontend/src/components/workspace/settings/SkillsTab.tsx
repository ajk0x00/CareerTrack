import { useState, useEffect, useMemo } from 'react'
import type {
  SkillItem,
  SkillProficiency,
  SkillCreateInput,
  SkillUpdateInput,
} from '../../../types/workspace'
import { useToast } from '../../ToastContext'
import SkillForm from './SkillForm'
import SkillCard from './SkillCard'

interface SkillsTabProps {
  token?: string
}

export default function SkillsTab({ token: propToken }: SkillsTabProps) {
  const toast = useToast()
  const token =
    propToken ||
    localStorage.getItem('careerTrack_token') ||
    sessionStorage.getItem('careerTrack_token') ||
    ''

  const [skills, setSkills] = useState<SkillItem[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [filter, setFilter] = useState<'all' | SkillProficiency>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Form & action states
  const [isCreating, setIsCreating] = useState<boolean>(false)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [isUpdating, setIsUpdating] = useState<boolean>(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  // Fetch skills from backend
  useEffect(() => {
    let isMounted = true
    const params = new URLSearchParams()
    if (filter !== 'all') {
      params.set('proficiency', filter)
    }
    if (searchQuery.trim()) {
      params.set('q', searchQuery.trim())
    }

    const queryString = params.toString()
    const url = `/api/v1/skills${queryString ? `?${queryString}` : ''}`

    fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load skills')
        return res.json()
      })
      .then((data: SkillItem[]) => {
        if (isMounted) setSkills(data)
      })
      .catch((err) => {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : 'Error fetching skill data'
          toast.error(msg, 'Network Error')
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [token, filter, searchQuery, toast])

  // Overview metrics (calculated across all loaded skills when not filtered, or cached)
  const stats = useMemo(() => {
    return {
      total: skills.length,
      expert: skills.filter((s) => s.proficiency === 'expert').length,
      advanced: skills.filter((s) => s.proficiency === 'advanced').length,
      intermediate: skills.filter((s) => s.proficiency === 'intermediate').length,
      beginner: skills.filter((s) => s.proficiency === 'beginner').length,
    }
  }, [skills])

  // Create Skill
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
      setSkills((prev) => [created, ...prev])
      setIsCreating(false)
      toast.success(
        `"${created.name}" added at ${created.proficiency} level.`,
        'Skill Added'
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save skill'
      toast.error(msg, 'Save Error')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Update Skill
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

      const updated: SkillItem = await res.json()
      setSkills((prev) => prev.map((s) => (s.id === id ? updated : s)))
      setEditingId(null)
      toast.success(`"${updated.name}" updated successfully.`, 'Skill Updated')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update skill'
      toast.error(msg, 'Update Error')
    } finally {
      setIsUpdating(false)
    }
  }

  // Delete Skill
  const handleDeleteSkill = async (id: number, skillName: string) => {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/v1/skills/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        const msg =
          typeof errData.detail === 'string'
            ? errData.detail
            : 'Could not delete skill'
        throw new Error(msg)
      }

      setSkills((prev) => prev.filter((s) => s.id !== id))
      toast.success(`"${skillName}" removed from your profile.`, 'Skill Deleted')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete skill'
      toast.error(msg, 'Delete Error')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="skills-tab-container">
      {/* Header */}
      <div className="pref-tab-header">
        <div className="pref-header-left">
          <div className="pref-header-badge">
            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
              psychology
            </span>
            <span>Skill Matrix</span>
          </div>
          <h3 className="pref-tab-title">Skills &amp; Competencies</h3>
          <p className="pref-tab-description">
            Catalog your technical languages, frameworks, infrastructure tools, and depth of proficiency to power automated ATS keyword mapping.
          </p>
        </div>

        <button
          type="button"
          className="action-btn-primary pref-add-btn"
          onClick={() => {
            setIsCreating(!isCreating)
            setEditingId(null)
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
            {isCreating ? 'close' : 'add'}
          </span>
          <span>{isCreating ? 'Close Form' : 'Add Skill'}</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="career-stats-row">
        <div className="career-stat-card">
          <div className="career-stat-icon-wrap">
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
              bolt
            </span>
          </div>
          <div className="career-stat-info">
            <div className="career-stat-value">{stats.total}</div>
            <div className="career-stat-label">Total Skills</div>
          </div>
        </div>

        <div className="career-stat-card">
          <div className="career-stat-icon-wrap" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#d97706' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
              workspace_premium
            </span>
          </div>
          <div className="career-stat-info">
            <div className="career-stat-value">{stats.expert}</div>
            <div className="career-stat-label">Expert Tier</div>
          </div>
        </div>

        <div className="career-stat-card">
          <div className="career-stat-icon-wrap" style={{ background: 'rgba(139, 92, 246, 0.12)', color: '#7c3aed' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
              military_tech
            </span>
          </div>
          <div className="career-stat-info">
            <div className="career-stat-value">{stats.advanced}</div>
            <div className="career-stat-label">Advanced Tier</div>
          </div>
        </div>

        <div className="career-stat-card">
          <div className="career-stat-icon-wrap" style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#2563eb' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
              code
            </span>
          </div>
          <div className="career-stat-info">
            <div className="career-stat-value">{stats.intermediate + stats.beginner}</div>
            <div className="career-stat-label">Intermediate / Core</div>
          </div>
        </div>
      </div>

      {/* Creation Drawer */}
      {isCreating && (
        <SkillForm
          onSubmit={handleCreateSkill}
          onCancel={() => setIsCreating(false)}
          isSubmitting={isSubmitting}
          title="Add New Skill"
          subtitle="Catalog a language, framework, database, or domain skill with your verified proficiency level."
          submitLabel="Save Skill"
        />
      )}

      {/* Search and Filter Bar */}
      <div className="skills-filter-toolbar">
        <div className="skills-search-wrapper">
          <span className="material-symbols-outlined skills-search-icon">search</span>
          <input
            type="text"
            className="skills-search-input"
            placeholder="Search skills by name (e.g. Python, Docker, React)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="skills-search-clear"
              onClick={() => setSearchQuery('')}
              title="Clear search"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                close
              </span>
            </button>
          )}
        </div>

        <div className="pref-filter-bar skills-tier-pills">
          <button
            type="button"
            className={`pref-filter-pill ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            <span>All</span>
            <span className="pref-filter-count">{stats.total}</span>
          </button>
          <button
            type="button"
            className={`pref-filter-pill ${filter === 'expert' ? 'active' : ''}`}
            onClick={() => setFilter('expert')}
          >
            <span>Expert</span>
            <span className="pref-filter-count">{stats.expert}</span>
          </button>
          <button
            type="button"
            className={`pref-filter-pill ${filter === 'advanced' ? 'active' : ''}`}
            onClick={() => setFilter('advanced')}
          >
            <span>Advanced</span>
            <span className="pref-filter-count">{stats.advanced}</span>
          </button>
          <button
            type="button"
            className={`pref-filter-pill ${filter === 'intermediate' ? 'active' : ''}`}
            onClick={() => setFilter('intermediate')}
          >
            <span>Intermediate</span>
            <span className="pref-filter-count">{stats.intermediate}</span>
          </button>
          <button
            type="button"
            className={`pref-filter-pill ${filter === 'beginner' ? 'active' : ''}`}
            onClick={() => setFilter('beginner')}
          >
            <span>Beginner</span>
            <span className="pref-filter-count">{stats.beginner}</span>
          </button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="pref-loading-box">
          <div className="pref-loading-spinner" />
          <span>Synchronizing skills matrix from server...</span>
        </div>
      )}

      {/* Skills Grid */}
      {!isLoading && skills.length > 0 && (
        <div className="skills-cards-grid">
          {skills.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              isEditing={editingId === skill.id}
              onStartEdit={() => {
                setEditingId(skill.id)
                if (isCreating) setIsCreating(false)
              }}
              onCancelEdit={() => setEditingId(null)}
              onSaveEdit={(payload) => handleUpdateSkill(skill.id, payload)}
              onDelete={() => handleDeleteSkill(skill.id, skill.name)}
              isDeleting={deletingId === skill.id}
              isUpdating={isUpdating}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && skills.length === 0 && (
        <div className="pref-empty-box company-empty-box">
          <div className="pref-empty-icon-wrapper">
            <span className="material-symbols-outlined pref-empty-icon">psychology</span>
          </div>
          <h5 className="pref-empty-title">
            {searchQuery
              ? `No skills matching "${searchQuery}"`
              : filter !== 'all'
              ? `No ${filter} skills cataloged yet`
              : 'No skills cataloged yet'}
          </h5>
          <p className="pref-empty-desc">
            {searchQuery
              ? 'Try modifying your search term or clearing the query to view all competencies.'
              : 'Power your ATS resume customization with your verified skill matrix. Add languages, frameworks, cloud platforms, and architecture patterns.'}
          </p>

          <button
            type="button"
            className="action-btn-primary company-empty-cta"
            onClick={() => {
              if (searchQuery) {
                setSearchQuery('')
              } else {
                setIsCreating(true)
              }
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              {searchQuery ? 'clear_all' : 'add_circle'}
            </span>
            <span>{searchQuery ? 'Clear Search' : 'Add Your First Skill'}</span>
          </button>
        </div>
      )}
    </div>
  )
}
