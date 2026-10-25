import type {
  ApiClientCreateInput,
  ApiClientCreateResponse,
  ApiClientItem,
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

const API_CLIENTS_PATH = '/api/v1/api-clients'

function apiClientPath(clientId: string): string {
  return `${API_CLIENTS_PATH}/${clientId}`
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

/** Lists the authenticated user's active and revoked API clients. */
export async function listApiClients(token: string): Promise<ApiClientItem[]> {
  return requestJson<ApiClientItem[]>(API_CLIENTS_PATH, {
    headers: authHeaders(token),
  })
}

/** Creates a new API client credential pair. */
export async function createApiClient(
  token: string,
  input: ApiClientCreateInput
): Promise<ApiClientCreateResponse> {
  return requestJson<ApiClientCreateResponse>(API_CLIENTS_PATH, {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify(input),
  })
}

/** Revokes an API client credential pair. */
export async function deleteApiClient(token: string, clientId: string): Promise<void> {
  const response = await fetch(apiClientPath(clientId), {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  if (!response.ok) {
    throw await toApiError(response)
  }
}
