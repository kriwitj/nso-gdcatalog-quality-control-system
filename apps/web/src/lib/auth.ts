import jwt, { JwtPayload } from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import { NextRequest } from 'next/server'

const ACCESS_SECRET  = process.env.JWT_ACCESS_SECRET!
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!
const ACCESS_EXP     = (process.env.JWT_ACCESS_EXPIRES_IN  || '15m') as jwt.SignOptions['expiresIn']
const REFRESH_EXP    = (process.env.JWT_REFRESH_EXPIRES_IN || '7d')  as jwt.SignOptions['expiresIn']

export interface AccessTokenPayload extends JwtPayload {
  userId: string
  role:   string
  jti:    string
}

export interface RefreshTokenPayload extends JwtPayload {
  userId: string
}

// ─── Password ─────────────────────────────────────────────────────

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// ─── Token signing ────────────────────────────────────────────────

export function signAccessToken(payload: Pick<AccessTokenPayload, 'userId' | 'role'>): string {
  return jwt.sign({ ...payload, jti: randomUUID() }, ACCESS_SECRET, { expiresIn: ACCESS_EXP })
}

export function signRefreshToken(payload: Pick<RefreshTokenPayload, 'userId'>): string {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXP })
}

// ─── Token verification ───────────────────────────────────────────

export function verifyAccessToken(token: string): AccessTokenPayload {
  const payload = jwt.verify(token, ACCESS_SECRET)
  if (typeof payload === 'string') throw new Error('Invalid token')
  return payload as AccessTokenPayload
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const payload = jwt.verify(token, REFRESH_SECRET)
  if (typeof payload === 'string') throw new Error('Invalid token')
  return payload as RefreshTokenPayload
}

// ─── Token blacklist (Redis) ──────────────────────────────────────

const BLACKLIST_PREFIX = 'ogd:blacklist:'

/** เพิกถอน access token โดยเก็บ jti ใน Redis จนกว่า token จะหมดอายุ */
export async function blacklistToken(payload: AccessTokenPayload): Promise<void> {
  const { getRedis } = await import('./queue')
  const now = Math.floor(Date.now() / 1000)
  const ttl = (payload.exp ?? now + 900) - now
  if (ttl > 0) {
    await getRedis().set(`${BLACKLIST_PREFIX}${payload.jti}`, '1', 'EX', ttl)
  }
}

/** ตรวจสอบว่า token ถูกเพิกถอนแล้วหรือไม่ */
export async function isTokenBlacklisted(jti: string): Promise<boolean> {
  const { getRedis } = await import('./queue')
  return (await getRedis().exists(`${BLACKLIST_PREFIX}${jti}`)) === 1
}

// ─── Request helpers ──────────────────────────────────────────────

/** ดึง Bearer token จาก Authorization header */
export function extractBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || ''
  const [scheme, token] = auth.split(' ')
  return scheme === 'Bearer' && token ? token : null
}
