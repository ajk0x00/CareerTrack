export interface User {
  id: number
  email: string
  is_active: boolean
  created_at: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
}

export interface ApiError {
  detail?: string | Array<{ msg: string }>
}
