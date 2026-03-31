export type MlTokenResponse = {
  access_token: string
  token_type?: string
  expires_in: number
  scope?: string
  user_id: number
  refresh_token: string
}

export type MlUser = {
  id: number
  nickname?: string
  first_name?: string
  last_name?: string
  email?: string
}
