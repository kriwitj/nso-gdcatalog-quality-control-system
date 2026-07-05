import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { buildAuthorizeUrl } from '@/lib/sso'

export const dynamic = 'force-dynamic'

export function GET() {
  const state = randomBytes(16).toString('hex')
  const authorizeUrl = buildAuthorizeUrl(state)

  const res = NextResponse.redirect(authorizeUrl)
  res.cookies.set('sso_state', state, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   5 * 60,
    path:     '/',
  })
  return res
}
