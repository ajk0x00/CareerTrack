export interface AddressDetails {
  street?: string | null
  city?: string | null
  state?: string | null
  postal_code?: string | null
  country?: string | null
}

export interface SocialLinks {
  linkedin?: string | null
  github?: string | null
  twitter?: string | null
  portfolio?: string | null
  website?: string | null
  [key: string]: string | null | undefined
}

export interface User {
  id: number
  email: string
  name?: string | null
  phone?: string | null
  socials?: SocialLinks | null
  address?: AddressDetails | null
  is_active: boolean
  created_at: string
  updated_at?: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
}

export interface ApiError {
  detail?: string | Array<{ msg: string; loc?: string[] }>
}

