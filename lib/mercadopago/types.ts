export type MpTokenResponse = {
  access_token: string
  token_type?: string
  expires_in: number
  scope?: string
  user_id: number
  refresh_token: string
  public_key?: string
  live_mode?: boolean
}

export type MpUser = {
  id: number
  nickname?: string
  first_name?: string
  last_name?: string
  email?: string
}
