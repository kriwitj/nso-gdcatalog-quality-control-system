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

export async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = typeof window !== 'undefined'
    ? localStorage.getItem('access_token')
    : null

  let res = await fetch(url, { ...init, headers: makeHeaders(token, init) })

  if (res.status === 401 && token) {
    const newToken = await tryRefresh()
    if (newToken) {
      res = await fetch(url, { ...init, headers: makeHeaders(newToken, init) })
    } else {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('access_token')
        localStorage.removeItem('user')
        window.location.href = '/login'
      }
    }
  }

  return res
}
