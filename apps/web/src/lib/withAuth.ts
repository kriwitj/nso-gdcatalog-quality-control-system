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
 * Next.js 15/16: params เป็น Promise<P> — withAuth จะ await ให้ก่อนส่งต่อ handler
 */
export function withAuth<P extends Record<string, string> = Record<string, string>>(
  handler: AuthedHandler<P>,
  roles?: string[],
) {
  return async (req: NextRequest, ctx: { params: Promise<P> | P }): Promise<NextResponse> => {
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

    // Next.js 15/16: params อาจเป็น Promise — resolve ก่อนส่ง handler
    const resolvedParams = ctx.params instanceof Promise ? await ctx.params : ctx.params

    return handler(req, { params: resolvedParams, user })
  }
}
