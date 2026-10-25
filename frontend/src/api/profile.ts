import type { AddressDetails, SocialLinks, User } from '../types/auth'

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

/** Payload accepted by the profile PATCH endpoint. */
export interface ProfileUpdateInput {
  name: string | null
  email?: string
  phone: string | null
  address: AddressDetails | null
  socials: SocialLinks | null
}

const PROFILE_PATH = '/api/v1/profile'

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

/** Loads the authenticated user's profile. */
export async function getProfile(token: string): Promise<User> {
  return requestJson<User>(PROFILE_PATH, { headers: authHeaders(token) })
}

/** Partially updates the authenticated user's profile. */
export async function updateProfile(
  token: string,
  input: ProfileUpdateInput
): Promise<User> {
  return requestJson<User>(PROFILE_PATH, {
    method: 'PATCH',
    headers: jsonHeaders(token),
    body: JSON.stringify(input),
  })
}
