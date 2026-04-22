'use client'

import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { scoreToGrade, gradeColor, fmt } from '@/lib/scoring'
import { apiFetch } from '@/lib/apiClient'
import Link from 'next/link'
import ConfirmDialog from '@/app/_components/ConfirmDialog'

interface Stats {
  totalDatasets: number
  totalResources: number
  totalOrganizations: number
  avgScore: number | null
  gradeDistribution: { grade: string; count: number }[]
  machineReadableDistribution: { status: string; label: string; count: number }[]
  timelinessDistribution: { status: string; label: string; count: number }[]
  topDatasets: { id: string; title: string; overallScore: number | null; qualityGrade: string | null; organization: { name: string } | null }[]
  lowDatasets:  { id: string; title: string; overallScore: number | null; qualityGrade: string | null; organization: { name: string } | null }[]
  lastSyncAt: string | null
  pendingJobs: number
}

const GRADE_COLORS: Record<string, string> = {
  A: '#10b981', B: '#3b82f6', C: '#f59e0b', D: '#f97316', F: '#ef4444', '?': '#9ca3af',
}

const MR_COLORS: Record<string, string> = {
  fully_machine_readable: '#10b981',
  partially_machine_readable: '#f59e0b',
  not_machine_readable: '#ef4444',
  unknown: '#9ca3af',
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing,      setSyncing]      = useState(false)
  const [scanning,     setScanning]     = useState(false)
  const [msg,          setMsg]          = useState('')
  const [confirmSync,  setConfirmSync]  = useState(false)
  const [confirmScan,  setConfirmScan]  = useState(false)
  const [activeJobs,   setActiveJobs]   = useState(0)

  useEffect(() => {
    apiFetch('/api/stats').then(async r => {
      if (!r.ok) { setLoading(false); return }
      const data = await r.json()
      setStats(data)
      setActiveJobs(data.pendingJobs ?? 0)
      setLoading(false)
    })
  }, [])

  async function triggerSync() {
    setConfirmSync(false)
    setSyncing(true); setMsg('')
    const r = await apiFetch('/api/sync', { method: 'POST' })
    const d = await r.json()
    setMsg(r.ok ? (d.message || 'เริ่มซิงค์แล้ว') : (d.error || 'เกิดข้อผิดพลาด'))
    if (r.ok) setActiveJobs(j => j + 1)
    setSyncing(false)
  }

  async function triggerScan() {
    setConfirmScan(false)
    setScanning(true); setMsg('')
    const r = await apiFetch('/api/scan', { method: 'POST' })
    const d = await r.json()
    setMsg(r.ok ? (d.message || 'เริ่มตรวจสอบแล้ว') : (d.error || 'เกิดข้อผิดพลาด'))
    if (r.ok) setActiveJobs(j => j + 1)
    setScanning(false)
  }

  const isBusy = syncing || scanning || activeJobs > 0

  if (loading) return (
    <div className="p-8 flex items-center justify-center h-64 text-gray-400">กำลังโหลด...</div>
  )
  if (!stats) return (
    <div className="p-8 flex items-center justify-center h-64 text-gray-400">ไม่สามารถโหลดข้อมูล กรุณาลองใหม่อีกครั้ง</div>
  )

  const s = stats

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">ภาพรวมคุณภาพข้อมูล</h2>
          <p className="text-sm text-gray-500 mt-1">
            ซิงค์ล่าสุด: {s.lastSyncAt ? new Date(s.lastSyncAt).toLocaleString('th-TH') : 'ยังไม่ได้ซิงค์'}
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setConfirmSync(true)} disabled={isBusy} className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed">
            {syncing ? '⏳ กำลังซิงค์...' : activeJobs > 0 && !syncing ? '⏳ กำลังดำเนินการ...' : '⟳ ซิงค์จาก CKAN'}
          </button>
          <button onClick={() => setConfirmScan(true)} disabled={isBusy} className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
            {scanning ? '⏳ กำลังตรวจ...' : activeJobs > 0 && !scanning ? '⏳ กำลังดำเนินการ...' : '▶ ตรวจสอบคุณภาพ'}
          </button>
        </div>
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
        <div className={`mb-6 p-3 border rounded-lg text-sm ${
          msg.includes('ผิดพลาด') || msg.includes('สิทธิ์')
            ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/30 dark:border-red-700 dark:text-red-300'
            : 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300'
        }`}>{msg}</div>
      )}

      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'ชุดข้อมูลทั้งหมด', value: s.totalDatasets.toLocaleString(), icon: '▤' },
          { label: 'ทรัพยากรทั้งหมด',  value: s.totalResources.toLocaleString(),  icon: '📄' },
          { label: 'หน่วยงาน',          value: s.totalOrganizations.toLocaleString(), icon: '🏛' },
          { label: 'คะแนนเฉลี่ย',      value: `${fmt(s.avgScore)} / 100`,  icon: '⭐' },
        ].map(c => (
          <div key={c.label} className="stat-card">
            <span className="text-2xl">{c.icon}</span>
            <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{c.value}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Grade distribution */}
        <div className="card p-5">
          <h3 className="text-sm font-medium text-gray-700 mb-4 dark:text-gray-200">การกระจายเกรดคุณภาพ</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={s.gradeDistribution} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="grade" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [`${v} ชุดข้อมูล`, 'จำนวน']} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {s.gradeDistribution.map(d => (
                  <Cell key={d.grade} fill={GRADE_COLORS[d.grade] || '#9ca3af'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-2 mt-2">
            {s.gradeDistribution.map(d => (
              <span key={d.grade} className={`badge ${gradeColor(d.grade)}`}>
                {d.grade}: {d.count}
              </span>
            ))}
          </div>
        </div>

        {/* Machine readable pie */}
        <div className="card p-5">
          <h3 className="text-sm font-medium text-gray-700 mb-4 dark:text-gray-200">Machine Readable Status</h3>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={s.machineReadableDistribution} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={70}>
                {s.machineReadableDistribution.map(d => (
                  <Cell key={d.status} fill={MR_COLORS[d.status] || '#9ca3af'} />
                ))}
              </Pie>
              <Tooltip formatter={(v, n) => [`${v} ชุดข้อมูล`, n]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-3 space-y-1">
            {s.machineReadableDistribution.map(d => {
              const total = s.machineReadableDistribution.reduce((a, b) => a + b.count, 0)
              const pct = total > 0 ? ((d.count / total) * 100).toFixed(0) : '0'
              return (
                <div key={d.status} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: MR_COLORS[d.status] || '#9ca3af' }} />
                    <span className="text-gray-600 dark:text-gray-400 truncate">{d.label}</span>
                  </div>
                  <span className="text-gray-500 dark:text-gray-500 shrink-0 ml-2">{d.count} ({pct}%)</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Timeliness pie */}
        <div className="card p-5">
          <h3 className="text-sm font-medium text-gray-700 mb-4 dark:text-gray-200">Timeliness Status</h3>
          {(() => {
            const TL_COLORS = ['#10b981', '#f59e0b', '#ef4444', '#9ca3af']
            return (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={s.timelinessDistribution} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={70}>
                      {s.timelinessDistribution.map((d, i) => (
                        <Cell key={d.status} fill={TL_COLORS[i % 4]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v, n) => [`${v} ชุดข้อมูล`, n]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-3 space-y-1">
                  {s.timelinessDistribution.map((d, i) => {
                    const total = s.timelinessDistribution.reduce((a, b) => a + b.count, 0)
                    const pct = total > 0 ? ((d.count / total) * 100).toFixed(0) : '0'
                    return (
                      <div key={d.status} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: TL_COLORS[i % 4] }} />
                          <span className="text-gray-600 dark:text-gray-400 truncate">{d.label}</span>
                        </div>
                        <span className="text-gray-500 dark:text-gray-500 shrink-0 ml-2">{d.count} ({pct}%)</span>
                      </div>
                    )
                  })}
                </div>
              </>
            )
          })()}
        </div>
      </div>

      {/* Top/Bottom datasets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DatasetRankCard title="🏆 ชุดข้อมูลคุณภาพดีสุด" datasets={s.topDatasets} />
        <DatasetRankCard title="⚠️ ชุดข้อมูลที่ต้องปรับปรุง" datasets={s.lowDatasets} />
      </div>
    </div>
  )
}

function DatasetRankCard({ title, datasets }: { title: string; datasets: Stats['topDatasets'] }) {
  return (
    <div className="card p-5">
      <h3 className="text-sm font-medium text-gray-700 mb-4 dark:text-gray-200">{title}</h3>
      <div className="space-y-3">
        {datasets.length === 0 && <p className="text-sm text-gray-400 text-center py-4 dark:text-gray-500">ยังไม่มีข้อมูล</p>}
        {datasets.map(d => (
          <Link href={`/datasets/${d.id}`} key={d.id} className="flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg p-2 -mx-2 transition-colors">
            <span className={`badge ${gradeColor(d.qualityGrade || '?')} text-sm font-semibold w-8 justify-center`}>
              {d.qualityGrade || '?'}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{d.title || '-'}</div>
              <div className="text-xs text-gray-400 dark:text-gray-500">{d.organization?.name || '-'}</div>
            </div>
            <div className="text-sm font-semibold text-gray-600 dark:text-gray-400 shrink-0">{fmt(d.overallScore)}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
