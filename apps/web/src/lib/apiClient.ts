/**
 * Client-side fetch wrapper
 * - Adds Authorization: Bearer header จาก localStorage โดยอัตโนมัติ
 * - เมื่อได้รับ 401: ลอง refresh token ผ่าน httpOnly cookie → retry
 * - Refresh ไม่สำเร็จ: ล้าง storage และ redirect /login
 */

async function tryRefresh(): Promise<string | null> {
  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    })
    if (!res.ok) return null
    const data = await res.json()
    const { accessToken } = data
    if (accessToken) {
      localStorage.setItem('access_token', accessToken)
      return accessToken
    }
  } catch {}
  return null
}

function makeHeaders(token: string | null, init: RequestInit): HeadersInit {
  return {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

function redirectLogin() {
  if (typeof window === 'undefined') return
  localStorage.removeItem('access_token')
  localStorage.removeItem('user')
  window.location.href = '/login'
}

function networkErrorResponse() {
  return new Response(JSON.stringify({ error: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = typeof window !== 'undefined'
    ? localStorage.getItem('access_token')
    : null

  let res: Response
  try {
    res = await fetch(url, { ...init, headers: makeHeaders(token, init) })
  } catch {
    // network error, server down, CORS ฯลฯ → ไม่ throw ออกไป
    return networkErrorResponse()
  }

  if (res.status === 401) {
    if (token) {
      // มี token แต่ expired → ลอง refresh
      const newToken = await tryRefresh()
      if (newToken) {
        try {
          return await fetch(url, { ...init, headers: makeHeaders(newToken, init) })
        } catch {
          return networkErrorResponse()
        }
      }
    }
    // ไม่มี token หรือ refresh ไม่สำเร็จ → redirect /login
    redirectLogin()
    return res
  }

  return res
}
