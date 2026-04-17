import { NextRequest, NextResponse } from 'next/server'
import { extractBearerToken, verifyAccessToken, AccessTokenPayload } from './auth'

export type AuthedContext<P extends Record<string, string> = Record<string, string>> = {
  params: P
  user: AccessTokenPayload
}

type AuthedHandler<P extends Record<string, string> = Record<string, string>> =
  (req: NextRequest, ctx: AuthedContext<P>) => Promise<NextResponse>

/**
 * ครอบ Route Handler ให้ต้องมี Bearer token ที่ถูกต้อง
 * Generic P รองรับ params ของแต่ละ dynamic route (เช่น { id: string }, { type: string; id: string })
 * @param handler  handler ที่จะรับ user payload ใน ctx.user
 * @param roles    ถ้าระบุ — เฉพาะ role ที่อยู่ในลิสต์เท่านั้นผ่านได้
 */
export function withAuth<P extends Record<string, string> = Record<string, string>>(
  handler: AuthedHandler<P>,
  roles?: string[],
) {
  return async (req: NextRequest, ctx: { params: P }): Promise<NextResponse> => {
    const token = extractBearerToken(req)
    if (!token) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
    }

    let user: AccessTokenPayload
    try {
      user = verifyAccessToken(token)
    } catch {
      return NextResponse.json({ error: 'token ไม่ถูกต้องหรือหมดอายุ' }, { status: 401 })
    }

    if (roles && !roles.includes(user.role)) {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 })
    }

    return handler(req, { ...ctx, user })
  }
}
