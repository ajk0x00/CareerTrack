import type {
  AtsReport,
  ResumeCreateInput,
  ResumeDetail,
  ResumeDraft,
  ResumeSummary,
  ResumeUpdateInput,
} from '../types/resume'

/** Non-2xx response carrying the backend `detail` message and HTTP status. */
export class ApiError extends Error {
  readonly status: number
  readonly detail: string

  constructor(status: number, detail: string) {
    super(detail)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

/** Result of a PDF export: the binary payload plus the server-chosen filename. */
export interface ExportedResume {
  blob: Blob
  fileName: string
}

const RESUMES_PATH = '/api/v1/resumes'
const DRAFT_PATH = '/api/v1/resumes/draft'

function resumePath(id: number): string {
  return `${RESUMES_PATH}/${id}`
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` }
}

function jsonHeaders(token: string): Record<string, string> {
  return { ...authHeaders(token), 'Content-Type': 'application/json' }
}

function extractDetail(payload: unknown, status: number): string {
  if (payload && typeof payload === 'object' && 'detail' in payload) {
    const detail = (payload as { detail?: unknown }).detail
    if (typeof detail === 'string' && detail.trim()) {
      return detail
    }
    if (Array.isArray(detail)) {
      const messages = detail
        .map((item) => {
          if (item && typeof item === 'object' && 'msg' in item) {
            const message = (item as { msg?: unknown }).msg
            if (typeof message === 'string') return message
          }
          return null
        })
        .filter((message): message is string => message !== null)
      if (messages.length > 0) {
        return messages.join('; ')
      }
    }
  }
  return `Request failed with status ${status}`
}

async function toApiError(response: Response): Promise<ApiError> {
  const payload: unknown = await response.json().catch(() => null)
  return new ApiError(response.status, extractDetail(payload, response.status))
}

async function requestJson<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  if (!response.ok) {
    throw await toApiError(response)
  }
  return (await response.json()) as T
}

function readFileName(header: string | null): string | null {
  if (!header) return null

  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(header)
  if (utf8Match && utf8Match[1]) {
    const raw = utf8Match[1].trim()
    try {
      return decodeURIComponent(raw)
    } catch {
      return raw
    }
  }

  const plainMatch = /filename="?([^";]+)"?/i.exec(header)
  if (plainMatch && plainMatch[1]) {
    return plainMatch[1].trim()
  }

  return null
}

/** Lists every stored resume for the authenticated user, newest updated first. */
export async function listResumes(token: string): Promise<ResumeSummary[]> {
  return requestJson<ResumeSummary[]>(RESUMES_PATH, { headers: authHeaders(token) })
}

/** Builds a resume draft from the user's live career data without persisting it. */
export async function getResumeDraft(token: string): Promise<ResumeDraft> {
  return requestJson<ResumeDraft>(DRAFT_PATH, { headers: authHeaders(token) })
}

/** Persists a resume, optionally tied to a job. */
export async function createResume(
  token: string,
  input: ResumeCreateInput
): Promise<ResumeDetail> {
  return requestJson<ResumeDetail>(RESUMES_PATH, {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify(input),
  })
}

/** Loads one stored resume including its Markdown body. */
export async function getResume(token: string, id: number): Promise<ResumeDetail> {
  return requestJson<ResumeDetail>(resumePath(id), { headers: authHeaders(token) })
}

/** Partially updates a stored resume. */
export async function updateResume(
  token: string,
  id: number,
  input: ResumeUpdateInput
): Promise<ResumeDetail> {
  return requestJson<ResumeDetail>(resumePath(id), {
    method: 'PATCH',
    headers: jsonHeaders(token),
    body: JSON.stringify(input),
  })
}

/** Deletes a stored resume. */
export async function deleteResume(token: string, id: number): Promise<void> {
  const response = await fetch(resumePath(id), {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  if (!response.ok) {
    throw await toApiError(response)
  }
}

/** Renders a stored resume to an ATS-safe PDF. */
export async function exportResume(token: string, id: number): Promise<ExportedResume> {
  const response = await fetch(`${resumePath(id)}/export`, {
    method: 'POST',
    headers: authHeaders(token),
  })
  if (!response.ok) {
    throw await toApiError(response)
  }

  const blob = await response.blob()
  const fileName =
    readFileName(response.headers.get('Content-Disposition')) ?? `resume-${id}.pdf`
  return { blob, fileName }
}

/** Verifies a stored resume and returns its ATS parse and keyword report. */
export async function getAtsReport(token: string, id: number): Promise<AtsReport> {
  return requestJson<AtsReport>(`${resumePath(id)}/ats-report`, {
    headers: authHeaders(token),
  })
}
