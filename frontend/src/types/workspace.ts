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

export interface EducationItem {
  id: number
  degree: string
  institution: string
  description: string
  start_date: string | null
  end_date: string | null
  created_at: string
  updated_at: string
}

export interface EducationCreateInput {
  degree: string
  institution: string
  description: string
  start_date: string
  end_date: string | null
}

export interface EducationUpdateInput {
  degree?: string
  institution?: string
  description?: string
  start_date?: string
  end_date?: string | null
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

export type JobStatus = 'saved' | 'applied' | 'interviewing' | 'offer'

export interface JobItem {
  id: number
  user_id: number
  title: string
  company_name: string
  job_url?: string | null
  location?: string | null
  workplace_type?: 'remote' | 'hybrid' | 'on_site' | null
  employment_type?: EmploymentType | null
  department?: string | null
  description?: string | null
  requirements?: string | null
  salary_min?: number | null
  salary_max?: number | null
  salary_currency?: string | null
  salary_interval?: 'yearly' | 'monthly' | 'hourly' | null
  posted_date?: string | null
  deadline_date?: string | null
  status: JobStatus
  current_stage?: string | null
  applied_date?: string | null
  excitement_rating?: number | null
  notes?: string | null
  contact_name?: string | null
  contact_email?: string | null
  contact_phone?: string | null
  created_at: string
  updated_at: string
}

export interface JobCreateInput {
  title: string
  company_name: string
  job_url?: string | null
  location?: string | null
  workplace_type?: 'remote' | 'hybrid' | 'on_site' | null
  employment_type?: EmploymentType | null
  department?: string | null
  description?: string | null
  requirements?: string | null
  salary_min?: number | null
  salary_max?: number | null
  salary_currency?: string | null
  salary_interval?: 'yearly' | 'monthly' | 'hourly' | null
  posted_date?: string | null
  deadline_date?: string | null
  status?: JobStatus
  current_stage?: string | null
  applied_date?: string | null
  excitement_rating?: number | null
  notes?: string | null
  contact_name?: string | null
  contact_email?: string | null
  contact_phone?: string | null
}

export interface JobUpdateInput {
  title?: string
  company_name?: string
  job_url?: string | null
  location?: string | null
  workplace_type?: 'remote' | 'hybrid' | 'on_site' | null
  employment_type?: EmploymentType | null
  department?: string | null
  description?: string | null
  requirements?: string | null
  salary_min?: number | null
  salary_max?: number | null
  salary_currency?: string | null
  salary_interval?: 'yearly' | 'monthly' | 'hourly' | null
  posted_date?: string | null
  deadline_date?: string | null
  status?: JobStatus
  current_stage?: string | null
  applied_date?: string | null
  excitement_rating?: number | null
  notes?: string | null
  contact_name?: string | null
  contact_email?: string | null
  contact_phone?: string | null
}

export interface JobPipelineSummary {
  total: number
  saved: number
  applied: number
  interviewing: number
  offer: number
}

export interface ExperienceLogItem {
  id: number
  user_id: number
  company_id: number
  company_name: string
  description: string
  created_at: string
  updated_at: string
}

export interface ExperienceLogCreateInput {
  company_id: number
  description: string
}

export interface ExperienceLogUpdateInput {
  company_id?: number
  description?: string
}
