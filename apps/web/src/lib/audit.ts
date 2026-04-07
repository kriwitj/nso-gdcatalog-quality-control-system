import prisma from './prisma'

export async function logAudit(params: {
  userId: string
  action: 'CREATE' | 'UPDATE' | 'DELETE'
  entity: string
  entityId?: string
  detail?: Record<string, unknown>
  ip?: string
}) {
  try {
    await prisma.auditLog.create({ data: params })
  } catch (err) {
    console.error('[audit] failed to log:', err)
  }
}
