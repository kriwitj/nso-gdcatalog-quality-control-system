'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/apiClient'

interface AuditEntry {
  id: string; userId: string | null; action: string
  entity: string; entityId: string | null
  detail: Record<string, unknown> | null
  createdAt: string
}

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-700',
  UPDATE: 'bg-blue-100 text-blue-700',
  DELETE: 'bg-red-100 text-red-700',
}

export default function AdminAuditPage() {
  const [logs,    setLogs]    = useState<AuditEntry[]>([])
  const [total,   setTotal]   = useState(0)
  const [page,    setPage]    = useState(1)
  const [loading, setLoading] = useState(true)
  const [entity,  setEntity]  = useState('')
  const [action,  setAction]  = useState('')

  async function load(p = page, e = entity, a = action) {
    setLoading(true)
    const q = new URLSearchParams({ page: String(p) })
    if (e) q.set('entity', e)
    if (a) q.set('action', a)
    const r = await apiFetch(`/api/admin/audit?${q}`)
    if (r.ok) {
      const d = await r.json()
      setLogs(d.logs); setTotal(d.total)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function applyFilter() { setPage(1); load(1) }

  const totalPages = Math.max(1, Math.ceil(total / 50))

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Audit Log</h1>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <select
          className="input-field w-40"
          value={action}
          onChange={e => { setAction(e.target.value); setPage(1); load(1, entity, e.target.value) }}
        >
          <option value="">— Action ทั้งหมด —</option>
          <option value="CREATE">CREATE</option>
          <option value="UPDATE">UPDATE</option>
          <option value="DELETE">DELETE</option>
        </select>
        <input
          className="input-field w-48"
          placeholder="Entity (User, CkanSource...)"
          value={entity}
          onChange={e => setEntity(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && applyFilter()}
        />
        <button onClick={applyFilter} className="btn-secondary text-sm">ค้นหา</button>
        <span className="text-xs text-gray-400 self-center">รวม {total.toLocaleString()} รายการ</span>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">เวลา</th>
              <th className="px-4 py-3 text-left">ผู้ดำเนินการ</th>
              <th className="px-4 py-3 text-left">Action</th>
              <th className="px-4 py-3 text-left">Entity</th>
              <th className="px-4 py-3 text-left">รายละเอียด</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">กำลังโหลด...</td></tr>}
            {!loading && logs.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">ไม่พบรายการ</td></tr>}
            {logs.map(log => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleString('th-TH')}
                </td>
                <td className="px-4 py-3 text-xs text-gray-600 font-mono">
                  {log.userId ? log.userId.slice(0, 8) + '…' : '—'}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-600'}`}>
                    {log.action}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs">
                  <span className="text-gray-700 font-medium">{log.entity}</span>
                  {log.entityId && <span className="text-gray-400 ml-1 font-mono">{log.entityId.slice(0, 8)}…</span>}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">
                  {log.detail ? JSON.stringify(log.detail) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button
            onClick={() => { const p = Math.max(1, page - 1); setPage(p); load(p) }}
            disabled={page <= 1}
            className="btn-secondary text-xs disabled:opacity-40"
          >← ก่อน</button>
          <span className="text-sm text-gray-500 self-center">{page} / {totalPages}</span>
          <button
            onClick={() => { const p = Math.min(totalPages, page + 1); setPage(p); load(p) }}
            disabled={page >= totalPages}
            className="btn-secondary text-xs disabled:opacity-40"
          >ถัดไป →</button>
        </div>
      )}
    </div>
  )
}
