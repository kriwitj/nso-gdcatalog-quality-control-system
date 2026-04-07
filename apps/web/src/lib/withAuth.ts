import { NextRequest, NextResponse } from 'next/server'
import { extractBearerToken, verifyAccessToken, AccessTokenPayload } from './auth'

type RouteContext = { params: Record<string, string> }
type AuthedContext = RouteContext & { user: AccessTokenPayload }
type AuthedHandler = (req: NextRequest, ctx: AuthedContext) => Promise<NextResponse>

/**
 * ครอบ Route Handler ให้ต้องมี Bearer token ที่ถูกต้อง
 * @param handler  handler ที่จะรับ user payload ใน ctx.user
 * @param roles    ถ้าระบุ — เฉพาะ role ที่อยู่ในลิสต์เท่านั้นผ่านได้
 */
export function withAuth(handler: AuthedHandler, roles?: string[]) {
  return async (req: NextRequest, ctx: RouteContext): Promise<NextResponse> => {
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
