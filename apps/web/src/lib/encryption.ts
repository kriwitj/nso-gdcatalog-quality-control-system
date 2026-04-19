import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const SEPARATOR = ':'

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY
  if (!hex || hex.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)')
  }
  return Buffer.from(hex, 'hex')
}

/** เข้ารหัสข้อความ → คืน "iv:authTag:ciphertext" (hex) */
export function encryptField(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(SEPARATOR)
}

/** ถอดรหัส "iv:authTag:ciphertext" → ข้อความเดิม */
export function decryptField(encryptedValue: string): string {
  const parts = encryptedValue.split(SEPARATOR)
  if (parts.length !== 3) throw new Error('Invalid encrypted value format')
  const [ivHex, authTagHex, cipherHex] = parts
  const key = getKey()
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'))
  return Buffer.concat([decipher.update(Buffer.from(cipherHex, 'hex')), decipher.final()]).toString('utf8')
}

/**
 * ถอดรหัสแบบ backward-compatible:
 * ถ้าค่าไม่ใช่รูปแบบที่เข้ารหัส (ข้อมูลเก่า) → คืนค่าเดิม
 */
export function tryDecryptField(value: string | null | undefined): string | null {
  if (!value) return null
  const parts = value.split(SEPARATOR)
  if (parts.length !== 3) return value // plaintext เก่า
  try {
    return decryptField(value)
  } catch {
    return value
  }
}
