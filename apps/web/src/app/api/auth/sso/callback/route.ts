import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { signAccessToken, signRefreshToken } from '@/lib/auth'
import { exchangeCode, fetchUserInfo, mapSsoRole } from '@/lib/sso'

export const dynamic = 'force-dynamic'

const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code  = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  const origin = new URL(req.url).origin

  if (error) {
    return NextResponse.redirect(`${origin}/login?sso_error=${encodeURIComponent(error)}`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${origin}/login?sso_error=invalid_request`)
  }

  const cookieState = req.cookies.get('sso_state')?.value
  if (!cookieState || cookieState !== state) {
    return NextResponse.redirect(`${origin}/login?sso_error=invalid_state`)
  }

  try {
    const ssoAccessToken = await exchangeCode(code)
    const info = await fetchUserInfo(ssoAccessToken)

    const role = mapSsoRole(info.permissions ?? [], info.role ?? '')
    const { divisionId, groupId } = await resolveOrg(info.branch_code, info.department_code)

    // find by sso_sub → หรือ username (employee ID) → หรือสร้างใหม่
    let user = await prisma.user.findUnique({ where: { ssoSub: info.sub } })

    if (!user) {
      user = await prisma.user.findUnique({ where: { username: info.preferred_username } })
    }

    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          ssoSub:         info.sub,
          displayName:    info.display_name,
          email:          info.email ?? undefined,
          role,
          isActive:       true,
          ssoAccessToken,
          divisionId:     divisionId ?? user.divisionId,
          groupId:        groupId    ?? user.groupId,
        },
      })
    } else {
      user = await prisma.user.create({
        data: {
          username:       info.preferred_username,
          ssoSub:         info.sub,
          displayName:    info.display_name,
          email:          info.email ?? null,
          passwordHash:   null,
          role,
          isActive:       true,
          ssoAccessToken,
          divisionId,
          groupId,
        },
      })
    }

    const accessToken  = signAccessToken({ userId: user.id, role: user.role })
    const refreshToken = signRefreshToken({ userId: user.id })
    const expiresAt    = new Date(Date.now() + REFRESH_TTL_MS)

    await prisma.refreshToken.create({
      data: { userId: user.id, token: refreshToken, expiresAt },
    })

    // ส่ง access token ผ่าน URL ไปหน้า sso/done (client) เพื่อเก็บใน localStorage
    const doneUrl = new URL('/sso/done', origin)
    doneUrl.searchParams.set('token', accessToken)

    const res = NextResponse.redirect(doneUrl.toString())
    res.cookies.delete('sso_state')
    res.cookies.set('refresh_token', refreshToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires:  expiresAt,
      path:     '/api/auth',
    })
    return res
  } catch (err) {
    console.error('[sso-callback]', err)
    return NextResponse.redirect(`${origin}/login?sso_error=sso_failed`)
  }
}

async function resolveOrg(branchCode: string | null, departmentCode: string | null) {
  let divisionId: string | null = null
  let groupId:    string | null = null

  if (branchCode) {
    const div = await prisma.division.findFirst({
      where:  { code: branchCode },
      select: { id: true },
    })
    divisionId = div?.id ?? null
  }

  if (departmentCode && divisionId) {
    const grp = await prisma.group.findFirst({
      where:  { code: departmentCode, divisionId },
      select: { id: true },
    })
    groupId = grp?.id ?? null
  }

  return { divisionId, groupId }
}
