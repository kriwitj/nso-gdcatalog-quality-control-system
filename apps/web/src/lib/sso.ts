const SSO_BASE      = process.env.NSO_SSO_URL          ?? 'https://sso.nso.go.th'
const CLIENT_ID     = process.env.NSO_SSO_CLIENT_ID!
const CLIENT_SECRET = process.env.NSO_SSO_CLIENT_SECRET!
const REDIRECT_URI  = process.env.NSO_SSO_REDIRECT_URI!

const SCOPES = 'openid profile email org_full profile_name_parts'

export interface SsoUserInfo {
  sub:                  string
  preferred_username:   string
  display_name:         string
  picture:              string | null
  email:                string | null
  email_verified:       boolean
  region_code:          string | null
  region:               string | null
  branch_code:          string | null
  branch:               string | null
  department_code:      string | null
  department:           string | null
  province_code:        string | null
  province:             string | null
  prefix:               string | null
  first_name:           string | null
  mid_name:             string | null
  last_name:            string | null
  permissions:          string[]
  role:                 string
  role_name:            string
}

export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id:     CLIENT_ID,
    redirect_uri:  REDIRECT_URI,
    scope:         SCOPES,
    state,
  })
  return `${SSO_BASE}/api/sso/authorize.php?${params}`
}

export async function exchangeCode(code: string): Promise<string> {
  const res = await fetch(`${SSO_BASE}/api/sso/token.php`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'authorization_code',
      code,
      redirect_uri:  REDIRECT_URI,
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  })
  if (!res.ok) throw new Error(`SSO token exchange failed: ${res.status}`)
  const data = await res.json()
  if (!data.access_token) throw new Error('SSO token exchange: missing access_token')
  return data.access_token as string
}

export async function fetchUserInfo(accessToken: string): Promise<SsoUserInfo> {
  const res = await fetch(`${SSO_BASE}/api/sso/userinfo.php`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`SSO userinfo failed: ${res.status}`)
  return res.json()
}

export async function revokeSsoSession(accessToken: string): Promise<void> {
  try {
    await fetch(`${SSO_BASE}/api/auth/logout.php`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
  } catch {
    // best-effort — ไม่ block logout ของระบบ
  }
}

export function mapSsoRole(permissions: string[], role: string): 'admin' | 'editor' | 'viewer' {
  if (permissions.includes('admin') || role === 'admin') return 'admin'
  if (permissions.includes('editor'))                    return 'editor'
  return 'viewer'
}
