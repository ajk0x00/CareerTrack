import type {
  CompanyWorkedCreateInput,
  CompanyWorkedItem,
  CompanyWorkedUpdateInput,
  EmploymentType,
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

/** Filter accepted by the companies list endpoint. */
export type CompanyListFilter = 'all' | 'active' | EmploymentType

const COMPANIES_PATH = '/api/v1/companies'

function companyPath(id: number): string {
  return `${COMPANIES_PATH}/${id}`
}

function listPath(filter: CompanyListFilter): string {
  if (filter === 'all') return COMPANIES_PATH
  if (filter === 'active') return `${COMPANIES_PATH}?actively_working=true`
  return `${COMPANIES_PATH}?employment_type=${filter}`
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

/** Lists the authenticated user's companies, optionally filtered. */
export async function listCompanies(
  token: string,
  filter: CompanyListFilter = 'all'
): Promise<CompanyWorkedItem[]> {
  return requestJson<CompanyWorkedItem[]>(listPath(filter), {
    headers: authHeaders(token),
  })
}

/** Adds a company to the authenticated user's career timeline. */
export async function createCompany(
  token: string,
  input: CompanyWorkedCreateInput
): Promise<CompanyWorkedItem> {
  return requestJson<CompanyWorkedItem>(COMPANIES_PATH, {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify(input),
  })
}

/** Partially updates a company entry. */
export async function updateCompany(
  token: string,
  id: number,
  input: CompanyWorkedUpdateInput
): Promise<CompanyWorkedItem> {
  return requestJson<CompanyWorkedItem>(companyPath(id), {
    method: 'PATCH',
    headers: jsonHeaders(token),
    body: JSON.stringify(input),
  })
}

/** Deletes a company entry. */
export async function deleteCompany(token: string, id: number): Promise<void> {
  const response = await fetch(companyPath(id), {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  if (!response.ok) {
    throw await toApiError(response)
  }
}
