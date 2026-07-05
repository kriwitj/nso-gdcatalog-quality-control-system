import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { signAccessToken, signRefreshToken } from '@/lib/auth'
import { exchangeCode, fetchUserInfo } from '@/lib/sso'

export const dynamic = 'force-dynamic'

const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code  = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  // ใช้ origin จาก REDIRECT_URI (ถูกต้องเสมอแม้อยู่หลัง reverse proxy)
  const origin = new URL(process.env.NSO_SSO_REDIRECT_URI!).origin

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

    const role = 'editor' as const
    const { ministryId, departmentId, divisionId, groupId } = await resolveOrg(info)

    // find by sso_sub → หรือ username (employee ID) → หรือสร้างใหม่
    let user = await prisma.user.findUnique({ where: { ssoSub: info.sub } })

    if (!user) {
      user = await prisma.user.findUnique({ where: { username: info.preferred_username } })
    }

    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          ssoSub:       info.sub,
          displayName:  info.display_name,
          email:        info.email ?? undefined,
          role,
          isActive:     true,
          ssoAccessToken,
          ministryId:   ministryId  ?? user.ministryId,
          departmentId: departmentId ?? user.departmentId,
          divisionId:   divisionId  ?? user.divisionId,
          groupId:      groupId     ?? user.groupId,
        },
      })
    } else {
      user = await prisma.user.create({
        data: {
          username:     info.preferred_username,
          ssoSub:       info.sub,
          displayName:  info.display_name,
          email:        info.email ?? null,
          passwordHash: null,
          role,
          isActive:     true,
          ssoAccessToken,
          ministryId,
          departmentId,
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

const FIXED_MINISTRY   = 'กระทรวงดิจิทัลเพื่อเศรษฐกิจและสังคม'
const FIXED_DEPARTMENT = 'สำนักงานสถิติแห่งชาติ'

async function resolveOrg(info: {
  branch_code:     string | null
  branch:          string | null
  division_code:   string | null
  division:        string | null
  department_code: string | null
  department:      string | null
}) {
  let ministryId:   string | null = null
  let departmentId: string | null = null
  let divisionId:   string | null = null
  let groupId:      string | null = null

  // 1. Ministry (fixed)
  const ministry = await prisma.ministry.findFirst({
    where:  { name: FIXED_MINISTRY },
    select: { id: true },
  })
  ministryId = ministry?.id ?? null

  // 2. Department under Ministry (fixed)
  if (ministryId) {
    const dept = await prisma.department.findFirst({
      where:  { ministryId, name: FIXED_DEPARTMENT },
      select: { id: true },
    })
    departmentId = dept?.id ?? null
  }

  // 3. Division (ศูนย์/กอง) — มาจาก SSO field: division / division_code
  if (departmentId && (info.division_code || info.division)) {
    const divName = info.division ?? info.division_code ?? ''
    const existing = await prisma.division.findFirst({
      where: {
        departmentId,
        OR: [
          ...(info.division_code ? [{ code: info.division_code }] : []),
          { name: divName },
        ],
      },
      select: { id: true },
    })
    if (existing) {
      divisionId = existing.id
    } else {
      const created = await prisma.division.create({
        data: { departmentId, name: divName, code: info.division_code ?? null },
        select: { id: true },
      })
      divisionId = created.id
      console.log(`[sso] created division "${divName}" (code=${info.division_code})`)
    }
  }

  // 4. Group — ค้นหาด้วย code หรือชื่อ ถ้าไม่มีให้สร้างใหม่
  if (divisionId && (info.department_code || info.department)) {
    const grpName = info.department ?? info.department_code ?? ''
    const existing = await prisma.group.findFirst({
      where: {
        divisionId,
        OR: [
          ...(info.department_code ? [{ code: info.department_code }] : []),
          { name: grpName },
        ],
      },
      select: { id: true },
    })
    if (existing) {
      groupId = existing.id
    } else {
      const created = await prisma.group.create({
        data: { divisionId, name: grpName, code: info.department_code ?? null },
        select: { id: true },
      })
      groupId = created.id
      console.log(`[sso] created group "${grpName}" (code=${info.department_code})`)
    }
  }

  return { ministryId, departmentId, divisionId, groupId }
}
