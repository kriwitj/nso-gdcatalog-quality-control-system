'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'

interface OrgStat { id: string; name: string; count: number }

interface DatasetStat {
  id: string
  title: string | null
  overallScore: number | null
  qualityGrade: string | null
  lastScanAt?: string | null
  organization: { name: string; title: string | null } | null
  ckanSource?: {
    division?: {
      name: string
      department?: {
        name: string
        ministry?: { name: string } | null
      } | null
    } | null
    department?: {
      name: string
      ministry?: { name: string } | null
    } | null
    ministry?: { name: string } | null
  } | null
}

interface PublicStats {
  totalDatasets: number
  totalResources: number
  avgScore: number | null
  topOrgs: OrgStat[]
  topScannedOrgs: OrgStat[]
  topByScore: DatasetStat[]
  recentlyScanned: DatasetStat[]
}

const GRADE_COLOR: Record<string, string> = {
  A: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  B: 'bg-blue-100 text-blue-700 border-blue-200',
  C: 'bg-amber-100 text-amber-700 border-amber-200',
  D: 'bg-orange-100 text-orange-700 border-orange-200',
  F: 'bg-red-100 text-red-700 border-red-200',
  '?': 'bg-gray-100 text-gray-500 border-gray-200',
}

function getOrgHierarchy(ds: DatasetStat): string {
  const src = ds.ckanSource
  if (!src) return ds.organization?.title || ds.organization?.name || '-'
  const div  = src.division?.name || null
  const dept = src.division?.department?.name || src.department?.name || null
  const min  = src.division?.department?.ministry?.name || src.department?.ministry?.name || src.ministry?.name || null
  return [div, dept, min].filter(Boolean).join(' · ') || ds.organization?.title || ds.organization?.name || '-'
}

function fmt(v: number | null | undefined, d = 1) {
  if (v == null) return '-'
  return v.toFixed(d)
}

export default function LandingPage() {
  const [username,    setUsername]    = useState<string | null>(null)
  const [stats,       setStats]       = useState<PublicStats | null>(null)
  const [statsLoaded, setStatsLoaded] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (token) {
      try {
        const u = JSON.parse(localStorage.getItem('user') || 'null')
        setUsername(u?.username ?? null)
      } catch { /* ignore */ }
    }

    fetch('/api/public-stats')
      .then(r => r.ok ? r.json() : null)
      .then(d => { setStats(d); setStatsLoaded(true) })
      .catch(() => setStatsLoaded(true))
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full flex items-center justify-between px-6 py-4 border-b border-gray-100/80 dark:border-gray-800 bg-white/90 dark:bg-gray-900/95 backdrop-blur-md shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-bold text-sm shadow-md">
            GQC
          </div>
          <div>
            <div className="text-xs text-gray-400 dark:text-gray-500 leading-none">ระบบตรวจคุณภาพข้อมูล</div>
            <div className="text-sm font-semibold text-gray-800 dark:text-gray-200 leading-tight">GDCatalog Quality Control</div>
          </div>
        </div>

        {username ? (
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 dark:text-gray-400 hidden sm:block">
              ยินดีต้อนรับ <span className="font-semibold text-gray-800 dark:text-gray-100">{username}</span>
            </span>
            <Link href="/dashboard" className="btn-primary text-sm px-5 py-2">เข้าสู่ Portal →</Link>
          </div>
        ) : (
          <Link href="/login" className="btn-primary text-sm px-5 py-2">เข้าสู่ระบบ →</Link>
        )}
      </header>

      {/* Hero */}
      <section className="flex flex-col items-center justify-center px-6 pt-20 pb-12 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-100/80 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-semibold px-4 py-1.5 rounded-full mb-6 border border-blue-200/60 dark:border-blue-800">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse inline-block"></span>
          Open Government Data — ข้อมูลเปิดภาครัฐ
        </div>

        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white leading-tight mb-5 max-w-4xl">
          <span className="text-blue-600 dark:text-blue-400">GDCatalog</span>{' '}
          Quality Control
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-lg max-w-2xl mb-4 leading-relaxed">
          ระบบตรวจสอบและประเมินคุณภาพข้อมูลจาก CKAN Catalog ใน <strong className="text-gray-700 dark:text-gray-300">5 มิติ</strong>{' '}
          สำหรับสำนักงานสถิติจังหวัดสระบุรี
        </p>

        {/* Quick stats */}
        {stats && (
          <div className="flex flex-wrap justify-center gap-6 my-6 text-center">
            <div>
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{stats.totalDatasets.toLocaleString()}</div>
              <div className="text-xs text-gray-500 mt-0.5">ชุดข้อมูล</div>
            </div>
            <div className="w-px bg-gray-200 dark:bg-gray-700 hidden sm:block" />
            <div>
              <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">{stats.totalResources.toLocaleString()}</div>
              <div className="text-xs text-gray-500 mt-0.5">ทรัพยากร</div>
            </div>
            <div className="w-px bg-gray-200 dark:bg-gray-700 hidden sm:block" />
            <div>
              <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{fmt(stats.avgScore)}</div>
              <div className="text-xs text-gray-500 mt-0.5">คะแนนเฉลี่ย / 100</div>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 mt-4 mb-16">
          {username ? (
            <Link href="/dashboard" className="btn-primary px-8 py-3 text-base shadow-lg shadow-blue-200 dark:shadow-none">
              ไปยัง Dashboard →
            </Link>
          ) : (
            <Link href="/login" className="btn-primary px-8 py-3 text-base shadow-lg shadow-blue-200 dark:shadow-none">
              เข้าสู่ Portal →
            </Link>
          )}
        </div>

        {/* 5 Quality dimensions */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 max-w-5xl w-full text-left mb-16">
          {FEATURES.map(f => (
            <div key={f.title} className="bg-white dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="text-2xl mb-2">{f.icon}</div>
              <div className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">{f.title}</div>
              <div className="text-xs text-gray-500 leading-relaxed dark:text-gray-400 mb-2">{f.desc}</div>
              <div className="inline-block text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">{f.weight}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Chart Section — top orgs by scanned datasets */}
      {stats && stats.topScannedOrgs?.length > 0 && (
        <section className="px-6 pb-8 max-w-6xl mx-auto w-full">
          <div className="bg-white dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-1 h-7 rounded-full bg-gradient-to-b from-violet-500 to-indigo-500"></div>
              <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">
                📊 5 อันดับหน่วยงาน (Organization) ที่มีชุดข้อมูลที่ตรวจสอบสูงสุด
              </h2>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              {/* Bar chart */}
              <div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={stats.topScannedOrgs.map(o => ({
                      name: o.name.length > 22 ? o.name.slice(0, 20) + '…' : o.name,
                      fullName: o.name,
                      จำนวน: o.count,
                    }))}
                    layout="vertical"
                    margin={{ top: 0, right: 24, left: 8, bottom: 0 }}
                  >
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(v) => [`${Number(v).toLocaleString()} ชุดข้อมูล`, 'ตรวจสอบแล้ว']}
                      labelFormatter={(_l, payload) => {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        return (payload as any)?.[0]?.payload?.fullName ?? ''
                      }}
                    />
                    <Bar dataKey="จำนวน" radius={[0, 6, 6, 0]}>
                      {stats.topScannedOrgs.map((_, i) => (
                        <Cell
                          key={i}
                          fill={BAR_COLORS[i % BAR_COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Ranked list */}
              <div className="space-y-2">
                {stats.topScannedOrgs.map((o, i) => {
                  const max = stats.topScannedOrgs[0].count || 1
                  const pct = Math.round((o.count / max) * 100)
                  return (
                    <div key={o.id} className="flex items-center gap-3">
                      <span
                        className="text-xs font-bold w-5 text-center shrink-0"
                        style={{ color: BAR_COLORS[i % BAR_COLORS.length] }}
                      >
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate mb-1">{o.name}</div>
                        <div className="relative h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="absolute inset-y-0 left-0 rounded-full transition-all"
                            style={{ width: `${pct}%`, backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }}
                          />
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-gray-600 dark:text-gray-400 shrink-0 w-10 text-right">
                        {o.count.toLocaleString()}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Dashboard Section */}
      <section className="px-6 pb-20 max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-1 h-8 rounded-full bg-gradient-to-b from-blue-500 to-indigo-500"></div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">ภาพรวมชุดข้อมูล</h2>
          {!statsLoaded && <span className="text-sm text-gray-400 animate-pulse">กำลังโหลด...</span>}
        </div>

        {statsLoaded && !stats && (
          <div className="text-center py-12 text-gray-400">ไม่สามารถโหลดข้อมูลได้ในขณะนี้</div>
        )}

        {stats && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Top 5 orgs by dataset count */}
            <StatCard title="🏛 5 อันดับหน่วยงานที่มีชุดข้อมูลสูงสุด">
              {stats.topOrgs.length === 0 ? (
                <EmptyState />
              ) : (
                stats.topOrgs.map((o, i) => (
                  <div key={o.id} className="flex items-center gap-3 py-2 border-b border-gray-50 dark:border-gray-700/50 last:border-0">
                    <span className="text-lg font-bold text-gray-300 dark:text-gray-600 w-6 text-center shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{o.name}</div>
                    </div>
                    <span className="text-sm font-semibold text-blue-600 dark:text-blue-400 shrink-0 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">
                      {o.count.toLocaleString()}
                    </span>
                  </div>
                ))
              )}
            </StatCard>

            {/* Top 5 by score */}
            <StatCard title="🏆 5 อันดับชุดข้อมูลคะแนนสูงสุด">
              {stats.topByScore.length === 0 ? (
                <EmptyState />
              ) : (
                stats.topByScore.map((d, i) => (
                  <DatasetRow key={d.id} ds={d} rank={i + 1} />
                ))
              )}
            </StatCard>

            {/* Top 5 recently scanned */}
            <StatCard title="🔍 5 อันดับที่ตรวจสอบล่าสุด">
              {stats.recentlyScanned.length === 0 ? (
                <EmptyState />
              ) : (
                stats.recentlyScanned.map((d, i) => (
                  <DatasetRow key={d.id} ds={d} rank={i + 1} showTime />
                ))
              )}
            </StatCard>
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="text-center text-xs text-gray-400 dark:text-gray-600 py-8 border-t border-gray-100 dark:border-gray-800 mt-auto">
        <div className="font-medium text-gray-500 dark:text-gray-500 mb-1">GDCatalog Quality Control System</div>
        ระบบตรวจคุณภาพข้อมูล GDCatalog Smart Plus — พัฒนาโดย สำนักงานสถิติจังหวัดสระบุรี © 2026
      </footer>
    </div>
  )
}

function StatCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">{title}</h3>
      <div className="space-y-0">{children}</div>
    </div>
  )
}

function EmptyState() {
  return <p className="text-sm text-gray-400 text-center py-6">ยังไม่มีข้อมูล</p>
}

function DatasetRow({ ds, rank, showTime }: { ds: DatasetStat; rank: number; showTime?: boolean }) {
  const grade = ds.qualityGrade || '?'
  const orgHier = getOrgHierarchy(ds)
  return (
    <div className="flex items-start gap-3 py-2 border-b border-gray-50 dark:border-gray-700/50 last:border-0">
      <span className="text-lg font-bold text-gray-300 dark:text-gray-600 w-6 text-center shrink-0 mt-0.5">{rank}</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate leading-snug">{ds.title || '-'}</div>
        <div className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">{orgHier}</div>
        {showTime && ds.lastScanAt && (
          <div className="text-xs text-gray-300 dark:text-gray-600 mt-0.5">
            {new Date(ds.lastScanAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}
          </div>
        )}
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className={`text-xs font-bold border px-1.5 py-0.5 rounded ${GRADE_COLOR[grade]}`}>{grade}</span>
        <span className="text-xs text-gray-500 dark:text-gray-400">{fmt(ds.overallScore)}</span>
      </div>
    </div>
  )
}

const BAR_COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe']

const FEATURES = [
  { icon: '📋', title: 'Completeness',     weight: '20%', desc: 'ความสมบูรณ์ของ Metadata เช่น ชื่อ, คำอธิบาย, tag, license' },
  { icon: '⏱',  title: 'Timeliness',       weight: '20%', desc: 'ความทันสมัยเทียบกับความถี่ที่ระบุ' },
  { icon: '🔗', title: 'Accessibility',    weight: '15%', desc: 'ดาวน์โหลดได้จริงหรือไม่ และ HTTP status' },
  { icon: '🤖', title: 'Machine Readable', weight: '20%', desc: 'รูปแบบ CSV/JSON/XLSX vs PDF/DOC' },
  { icon: '✔',  title: 'Validity',         weight: '25%', desc: 'ความถูกต้องของตาราง (Frictionless)' },
]
