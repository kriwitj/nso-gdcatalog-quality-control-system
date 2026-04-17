'use client'

import { useEffect, useState, useCallback } from 'react'
import { apiFetch } from '@/lib/apiClient'
import ConfirmDialog from '@/app/_components/ConfirmDialog'

interface Job {
  id: string; type: string; status: string
  triggeredBy: string | null; triggeredByUsername: string | null
  totalItems: number; doneItems: number; errorItems: number
  startedAt: string | null; finishedAt: string | null; errorMsg: string | null
  createdAt: string; dataset: { title: string | null; name: string } | null
}

interface QueueLengths { resourceQueue: number; scoreQueue: number }

const STATUS_COLOR: Record<string, string> = {
  pending: 'text-amber-700 bg-amber-50 border-amber-200',
  running: 'text-blue-700 bg-blue-50 border-blue-200',
  done:    'text-emerald-700 bg-emerald-50 border-emerald-200',
  error:   'text-red-700 bg-red-50 border-red-200',
}
const STATUS_LABEL: Record<string, string> = {
  pending: '⏳ รอ', running: '▶ กำลังทำ', done: '✓ เสร็จ', error: '✕ ผิดพลาด',
}
const TYPE_LABEL: Record<string, string> = {
  full:         'ตรวจทั้งหมด',
  resource:     'ตรวจรายการ',
  catalog_sync: 'ซิงค์',
}

export default function JobsPage() {
  const [jobs,    setJobs]    = useState<Job[]>([])
  const [queue,   setQueue]   = useState<QueueLengths | null>(null)
  const [loading, setLoading] = useState(true)
  const [msg,     setMsg]     = useState('')
  const [confirmSync, setConfirmSync] = useState(false)
  const [confirmScan, setConfirmScan] = useState(false)

  const load = useCallback(async () => {
    const [jRes, qRes] = await Promise.all([
      apiFetch('/api/jobs'),
      apiFetch('/api/jobs/queue'),
    ])
    if (jRes.ok) setJobs((await jRes.json()).data || [])
    if (qRes.ok) setQueue(await qRes.json())
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const iv = setInterval(load, 5000)
    return () => clearInterval(iv)
  }, [load])

  async function forceJob(id: string, action: 'complete' | 'cancel') {
    setMsg('')
    const r = await apiFetch(`/api/jobs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    const d = await r.json()
    setMsg(r.ok ? `Job ${action === 'complete' ? 'ปิดเสร็จสิ้น' : 'ยกเลิก'}แล้ว` : (d.error || 'เกิดข้อผิดพลาด'))
    load()
  }

  async function triggerSync() {
    setConfirmSync(false); setMsg('')
    const r = await apiFetch('/api/sync', { method: 'POST' })
    const d = await r.json()
    setMsg(r.ok ? (d.message || 'เริ่มซิงค์แล้ว') : (d.error || 'เกิดข้อผิดพลาด'))
    if (r.ok) load()
  }

  async function triggerScan() {
    setConfirmScan(false); setMsg('')
    const r = await apiFetch('/api/scan', { method: 'POST' })
    const d = await r.json()
    setMsg(r.ok ? (d.message || 'เริ่มตรวจสอบแล้ว') : (d.error || 'เกิดข้อผิดพลาด'))
    if (r.ok) load()
  }

  const running = jobs.filter(j => j.status === 'running').length
  const pending = jobs.filter(j => j.status === 'pending').length

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h2 className="text-2xl font-semibold text-gray-900 mb-6 dark:text-gray-100">งานตรวจสอบ</h2>

      {/* Queue stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'กำลังทำ',           value: running,                   color: 'text-blue-600' },
          { label: 'รออยู่',             value: pending,                   color: 'text-amber-600' },
          { label: 'คิว Resource Check', value: queue?.resourceQueue ?? '-', color: 'text-gray-700' },
          { label: 'คิว Score Calc',     value: queue?.scoreQueue ?? '-',   color: 'text-gray-700' },
        ].map(c => (
          <div key={c.label} className="stat-card">
            <div className={`text-3xl font-semibold ${c.color}`}>{c.value}</div>
            <div className="text-xs text-gray-500">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-3 mb-4">
        <button onClick={() => setConfirmSync(true)} className="btn-secondary">⟳ ซิงค์ CKAN</button>
        <button onClick={() => setConfirmScan(true)} className="btn-primary">▶ ตรวจสอบทั้งหมด</button>
        <button onClick={load}                       className="btn-secondary">🔄 รีเฟรช</button>
      </div>
      <ConfirmDialog
        open={confirmSync} title="ยืนยันการซิงค์"
        message="ซิงค์ข้อมูลชุดข้อมูลจาก CKAN ใช่หรือไม่?"
        confirmLabel="⟳ เริ่มซิงค์"
        onConfirm={triggerSync} onCancel={() => setConfirmSync(false)}
      />
      <ConfirmDialog
        open={confirmScan} title="ยืนยันการตรวจสอบ"
        message="ตรวจสอบคุณภาพทรัพยากรทั้งหมดในขอบเขตของคุณ ใช่หรือไม่?"
        confirmLabel="▶ เริ่มตรวจสอบ"
        onConfirm={triggerScan} onCancel={() => setConfirmScan(false)}
      />
      {msg && (
        <div className={`mb-5 p-3 rounded-lg text-sm border ${
          msg.includes('ผิดพลาด') || msg.includes('อยู่แล้ว') || msg.includes('สิทธิ์')
            ? 'bg-red-50 border-red-200 text-red-800'
            : 'bg-blue-50 border-blue-200 text-blue-800'
        }`}>{msg}</div>
      )}

      {/* Job list */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-left text-xs dark:bg-gray-800 dark:border-gray-700">
              <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">ประเภท</th>
              <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">ชุดข้อมูล</th>
              <th className="px-4 py-3 font-medium text-gray-600 text-center dark:text-gray-400">สถานะ</th>
              <th className="px-4 py-3 font-medium text-gray-600 hidden sm:table-cell dark:text-gray-400">ความคืบหน้า</th>
              <th className="px-4 py-3 font-medium text-gray-600 hidden md:table-cell dark:text-gray-400">ผู้ดำเนินการ</th>
              <th className="px-4 py-3 font-medium text-gray-600 hidden md:table-cell dark:text-gray-400">เวลา</th>
              <th className="px-4 py-3 font-medium text-gray-600 w-24 dark:text-gray-400"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
            {loading && (
              <tr><td colSpan={6} className="text-center py-10 text-gray-400 dark:text-gray-500">กำลังโหลด...</td></tr>
            )}
            {!loading && jobs.length === 0 && (
              <tr><td colSpan={6} className="text-center py-10 text-gray-400 dark:text-gray-500">ยังไม่มีงาน</td></tr>
            )}
            {jobs.map(j => {
              const progress = j.totalItems > 0 ? Math.round((j.doneItems / j.totalItems) * 100) : null
              const duration = j.startedAt && j.finishedAt
                ? Math.round((new Date(j.finishedAt).getTime() - new Date(j.startedAt).getTime()) / 1000)
                : null
              return (
                <tr key={j.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <td className="px-4 py-3">
                    <span className="badge border-gray-200 text-gray-600 text-xs dark:border-gray-700 dark:text-gray-400 dark:bg-gray-800">
                      {TYPE_LABEL[j.type] || j.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 truncate max-w-xs text-xs dark:text-gray-400">
                    {j.dataset ? (j.dataset.title || j.dataset.name) : 'ทั้งหมด'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`badge text-xs ${STATUS_COLOR[j.status] || 'text-gray-500 bg-gray-50 border-gray-200 dark:text-gray-400 dark:bg-gray-800 dark:border-gray-700'}`}>
                      {STATUS_LABEL[j.status] || j.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    {j.totalItems > 0 ? (
                      <div>
                        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                          <span>{j.doneItems} / {j.totalItems}</span>
                          <span>{progress}%</span>
                        </div>
                        <div className="bg-gray-100 rounded-full h-1.5 dark:bg-gray-700">
                          <div
                            className="bg-blue-500 h-1.5 rounded-full transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        {j.errorItems > 0 && (
                          <div className="text-xs text-red-500 mt-0.5">ผิดพลาด {j.errorItems} รายการ</div>
                        )}
                      </div>
                    ) : <span className="text-gray-300">-</span>}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {j.triggeredByUsername ? (
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-semibold uppercase shrink-0">
                          {j.triggeredByUsername[0]}
                        </div>
                        <span className="text-xs text-gray-600">{j.triggeredByUsername}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-300 dark:text-gray-500">ระบบ</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 hidden md:table-cell">
                    <div>{new Date(j.createdAt).toLocaleString('th-TH')}</div>
                    {duration !== null && <div className="text-gray-300 dark:text-gray-500">ใช้เวลา {duration}s</div>}
                    {j.errorMsg && <div className="text-red-400 truncate max-w-40" title={j.errorMsg}>{j.errorMsg}</div>}
                  </td>
                  <td className="px-3 py-3">
                    {(j.status === 'running' || j.status === 'pending') && (
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => forceJob(j.id, 'complete')}
                          className="text-xs px-2 py-1 rounded border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-colors"
                          title="บันทึกเป็นเสร็จสิ้น (force complete)"
                        >✓ ปิด</button>
                        <button
                          onClick={() => forceJob(j.id, 'cancel')}
                          className="text-xs px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                          title="ยกเลิก job นี้"
                        >✕ ยกเลิก</button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
