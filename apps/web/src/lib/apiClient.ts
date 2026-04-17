/**
 * Client-side fetch wrapper
 * - Adds Authorization: Bearer header จาก localStorage โดยอัตโนมัติ
 * - Proactive refresh: refresh ก่อน token หมดอายุ 60 วินาที
 * - Singleton refresh promise: กัน race condition เมื่อหลาย request ยิงพร้อมกัน
 * - เมื่อได้รับ 401: ลอง refresh token ผ่าน httpOnly cookie → retry
 * - Refresh ไม่สำเร็จ: ล้าง storage และ redirect /login
 */

// Singleton: ถ้ามี refresh กำลังทำงานอยู่ ให้รอ promise เดิม ไม่ยิงซ้ำ
let refreshPromise: Promise<string | null> | null = null

/** อ่าน exp จาก JWT payload โดยไม่ต้องใช้ library */
function getTokenExp(token: string): number | null {
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(b64))
    return typeof payload.exp === 'number' ? payload.exp : null
  } catch {
    return null
  }
}

/** คืน true ถ้า token หมดอายุแล้ว หรือจะหมดใน 60 วินาที */
function isExpiringSoon(token: string): boolean {
  const exp = getTokenExp(token)
  if (!exp) return true
  return exp * 1000 < Date.now() + 60_000
}

async function doRefresh(): Promise<string | null> {
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

async function tryRefresh(): Promise<string | null> {
  // ถ้ามี refresh กำลังทำอยู่ → รอผลเดียวกัน ไม่ยิงใหม่ (แก้ race condition)
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => { refreshPromise = null })
  }
  return refreshPromise
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
  let token = typeof window !== 'undefined'
    ? localStorage.getItem('access_token')
    : null

  // Proactive refresh: refresh ก่อน token หมดอายุ ป้องกัน 401 ตั้งแต่แรก
  if (token && isExpiringSoon(token)) {
    const newToken = await tryRefresh()
    if (newToken) token = newToken
    // ถ้า refresh ล้มเหลว ส่ง request ต่อไป → รับ 401 → จัดการด้านล่าง
  }

  let res: Response
  try {
    res = await fetch(url, { ...init, headers: makeHeaders(token, init) })
  } catch {
    // network error, server down, CORS ฯลฯ → ไม่ throw ออกไป
    return networkErrorResponse()
  }

  if (res.status === 401) {
    if (token) {
      // token ยังอยู่แต่ server ปฏิเสธ → ลอง refresh อีกครั้ง (singleton)
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
