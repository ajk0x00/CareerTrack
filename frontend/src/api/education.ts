import type {
  EducationCreateInput,
  EducationItem,
  EducationUpdateInput,
} from '../types/workspace'

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

const EDUCATION_PATH = '/api/v1/education'

function educationPath(id: number): string {
  return `${EDUCATION_PATH}/${id}`
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

/** Lists every education record for the authenticated user, newest first. */
export async function listEducation(token: string): Promise<EducationItem[]> {
  return requestJson<EducationItem[]>(EDUCATION_PATH, { headers: authHeaders(token) })
}

/** Creates a new education record. */
export async function createEducation(
  token: string,
  input: EducationCreateInput
): Promise<EducationItem> {
  return requestJson<EducationItem>(EDUCATION_PATH, {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify(input),
  })
}

/** Partially updates an education record. */
export async function updateEducation(
  token: string,
  id: number,
  input: EducationUpdateInput
): Promise<EducationItem> {
  return requestJson<EducationItem>(educationPath(id), {
    method: 'PATCH',
    headers: jsonHeaders(token),
    body: JSON.stringify(input),
  })
}

/** Deletes an education record. */
export async function deleteEducation(token: string, id: number): Promise<void> {
  const response = await fetch(educationPath(id), {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  if (!response.ok) {
    throw await toApiError(response)
  }
}
