export interface ExperienceItem {
  id: string
  company: string
  role: string
  period: string
  location: string
  description: string
  bullets: string[]
  metricsCount: number
  skills: string[]
  isCurrent?: boolean
}

export interface SkillCategory {
  id: string
  title: string
  skills: string[]
}

export interface UserPreferences {
  targetRole: string
  targetComp: string
  workplacePreference: 'Remote (Worldwide)' | 'Hybrid (San Francisco / NYC)' | 'On-site'
  aggressiveMetrics: boolean
  targetIndustry?: string
  seniorityLevel?: 'Entry-Level' | 'Mid-Senior' | 'Staff / Principal' | 'Executive / Director'
  atsKeywordDensity?: 'Standard' | 'Aggressive' | 'Maximum Match'
  actionVerbTone?: 'Dynamic Engineering' | 'Leadership & Strategic' | 'Research & Analytical'
}

