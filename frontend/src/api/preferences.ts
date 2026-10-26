import type {
  PreferenceCreateInput,
  PreferenceImportance,
  PreferenceItem,
  PreferenceUpdateInput,
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

/** Filter accepted by the preferences list endpoint. */
export type PreferenceListFilter = 'all' | PreferenceImportance

const PREFERENCES_PATH = '/api/v1/preferences'

function preferencePath(id: number): string {
  return `${PREFERENCES_PATH}/${id}`
}

function listPath(filter: PreferenceListFilter): string {
  if (filter === 'all') return PREFERENCES_PATH
  return `${PREFERENCES_PATH}?importance=${filter}`
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

/** Lists the authenticated user's career preferences, optionally filtered. */
export async function listPreferences(
  token: string,
  filter: PreferenceListFilter = 'all'
): Promise<PreferenceItem[]> {
  return requestJson<PreferenceItem[]>(listPath(filter), {
    headers: authHeaders(token),
  })
}

/** Creates a career preference. */
export async function createPreference(
  token: string,
  input: PreferenceCreateInput
): Promise<PreferenceItem> {
  return requestJson<PreferenceItem>(PREFERENCES_PATH, {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify(input),
  })
}

/** Partially updates a career preference. */
export async function updatePreference(
  token: string,
  id: number,
  input: PreferenceUpdateInput
): Promise<PreferenceItem> {
  return requestJson<PreferenceItem>(preferencePath(id), {
    method: 'PATCH',
    headers: jsonHeaders(token),
    body: JSON.stringify(input),
  })
}

/** Deletes a career preference. */
export async function deletePreference(token: string, id: number): Promise<void> {
  const response = await fetch(preferencePath(id), {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  if (!response.ok) {
    throw await toApiError(response)
  }
}
