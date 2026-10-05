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

export type PreferenceImportance = 'low' | 'medium' | 'high' | 'critical'

export interface PreferenceItem {
  id: number
  user_id: number
  title: string
  description?: string | null
  importance: PreferenceImportance
  created_at: string
  updated_at: string
}

export interface PreferenceCreateInput {
  title: string
  description?: string | null
  importance: PreferenceImportance
}

export interface PreferenceUpdateInput {
  title?: string
  description?: string | null
  importance?: PreferenceImportance
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

export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'internship'

export interface CompanyWorkedItem {
  id: number
  user_id: number
  company_name: string
  employment_type: EmploymentType
  start_date: string
  end_date?: string | null
  actively_working: boolean
  created_at: string
  updated_at: string
}

export interface CompanyWorkedCreateInput {
  company_name: string
  employment_type: EmploymentType
  start_date: string
  end_date?: string | null
  actively_working: boolean
}

export interface CompanyWorkedUpdateInput {
  company_name?: string
  employment_type?: EmploymentType
  start_date?: string
  end_date?: string | null
  actively_working?: boolean
}

export type SkillProficiency = 'beginner' | 'intermediate' | 'advanced' | 'expert'

export interface SkillItem {
  id: number
  user_id: number
  name: string
  proficiency: SkillProficiency
  created_at: string
  updated_at: string
}

export interface SkillCreateInput {
  name: string
  proficiency: SkillProficiency
}

export interface SkillUpdateInput {
  name?: string
  proficiency?: SkillProficiency
}

export interface WorkspaceItem {
  id: number
  user_id: number
  name: string
  created_at: string
  updated_at: string
}

export interface WorkspaceCreateInput {
  name: string
}

export interface WorkspaceUpdateInput {
  name: string
}

export interface ApiClientItem {
  id: number
  name: string
  client_id: string
  client_secret_prefix: string
  is_active: boolean
  last_used_at?: string | null
  created_at: string
}

export interface ApiClientCreateInput {
  name: string
}

export interface ApiClientCreateResponse extends ApiClientItem {
  client_secret: string
}






