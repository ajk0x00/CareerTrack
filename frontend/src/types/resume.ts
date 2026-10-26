/** A stored resume as returned by the list endpoint. */
export interface ResumeSummary {
  id: number
  title: string
  job_id: number | null
  job_title: string | null
  job_company: string | null
  created_at: string
  updated_at: string
  exported_at: string | null
}

/** A stored resume including its Markdown body. */
export interface ResumeDetail extends ResumeSummary {
  markdown: string
}

/** A resume draft built from live career data without persisting anything. */
export interface ResumeDraft {
  markdown: string
  has_profile: boolean
  has_experience: boolean
  has_skills: boolean
}

/** ATS parse and keyword verification for a stored resume. */
export interface AtsReport {
  parse_clean: boolean
  char_count: number
  page_count: number
  sections_found: string[]
  missing_tokens: string[]
  keyword_coverage: number | null
  matched_keywords: string[]
  missing_keywords: string[]
}

/** Optional target used when AI-generating a resume. */
export interface ResumeGenerateInput {
  job_id?: number | null
  job_description?: string | null
}

/** Payload for persisting a new resume. */
export interface ResumeCreateInput {
  job_id?: number | null
  title?: string
  markdown: string
}

/** Payload for partially updating a stored resume. */
export interface ResumeUpdateInput {
  title?: string
  markdown?: string
}
