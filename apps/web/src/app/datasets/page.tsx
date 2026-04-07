'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { gradeColor, fmt } from '@/lib/scoring'
import { apiFetch } from '@/lib/apiClient'

interface OrgItem { id: string; name: string; title: string | null }

interface Dataset {
  id: string
  title: string | null
  name: string
  organization: { id: string; name: string; title: string | null } | null
  resourceCount: number
  overallScore:         number | null
  qualityGrade:         string | null
  completenessScore:    number | null
  timelinessScore:      number | null
  accessibilityScore:   number | null
  machineReadableScore:  number | null
  validityScore:         number | null
  machineReadableStatus: string | null
  lastScanAt:    string | null
  lastScanStatus: string | null
}

interface PageData {
  data: Dataset[]
  total: number
  page: number
  pageSize: number
}

type SortField =
  | 'overallScore' | 'completenessScore' | 'timelinessScore'
  | 'accessibilityScore' | 'machineReadableScore' | 'validityScore'
  | 'machineReadableStatus' | 'lastScanAt' | 'title'

const SCORE_TYPES = [
  { value: '',               label: 'ทุกประเภท'    },
  { value: 'overall',        label: 'คะแนนรวม'     },
  { value: 'completeness',   label: 'ความครบถ้วน'  },
  { value: 'timeliness',     label: 'ความทันสมัย'  },
  { value: 'accessibility',  label: 'การเข้าถึง'   },
  { value: 'machineReadable',label: 'อ่านด้วยเครื่อง' },
  { value: 'validity',       label: 'ความถูกต้อง'  },
]

// ─── Score cell ───────────────────────────────────────────────────

function ScoreCell({ value }: { value: number | null }) {
  if (value === null || value === undefined) {
    return <span className="text-xs text-gray-300">—</span>
  }
  const color = value >= 80 ? 'text-green-600' : value >= 60 ? 'text-yellow-600' : 'text-red-500'
  return <span className={`text-xs font-medium tabular-nums ${color}`}>{Math.round(value)}</span>
}

// ─── Structured / Machine Readable badge ─────────────────────────

function StructuredBadge({ status }: { status: string | null }) {
  if (!status || status === 'unknown') return <span className="text-xs text-gray-300">—</span>
  if (status === 'fully_machine_readable' || status === 'partially_machine_readable')
    return <span className="badge text-emerald-700 bg-emerald-50 border-emerald-200 text-xs">Structured</span>
  return <span className="badge text-red-600 bg-red-50 border-red-200 text-xs">Unstructured</span>
}

function MRBadge({ status }: { status: string | null }) {
  if (!status || status === 'unknown') return <span className="text-xs text-gray-300">—</span>
  if (status === 'fully_machine_readable')
    return <span className="badge text-emerald-700 bg-emerald-50 border-emerald-200 text-xs">ทั้งหมด</span>
  if (status === 'partially_machine_readable')
    return <span className="badge text-amber-700 bg-amber-50 border-amber-200 text-xs">บางส่วน</span>
  return <span className="badge text-red-600 bg-red-50 border-red-200 text-xs">ไม่ได้</span>
}

// ─── Sortable column header ────────────────────────────────────────

function SortTh({
  field, label, sort, onSort, className = '',
}: {
  field: SortField
  label: string
  sort: string
  onSort: (f: SortField) => void
  className?: string
}) {
  const isActive = sort.startsWith(field)
  const isDesc   = sort === `${field}_desc`
  return (
    <th
      className={`px-3 py-3 font-medium text-gray-600 cursor-pointer select-none whitespace-nowrap hover:bg-gray-100 transition-colors ${className}`}
      onClick={() => onSort(field)}
    >
      <span className="flex items-center gap-1 justify-center">
        {label}
        <span className={`text-xs ${isActive ? 'text-blue-500' : 'text-gray-300'}`}>
          {isActive ? (isDesc ? '↓' : '↑') : '↕'}
        </span>
      </span>
    </th>
  )
}

// ─── Page ─────────────────────────────────────────────────────────

export default function DatasetsPage() {
  const [pd,        setPd]       = useState<PageData | null>(null)
  const [orgs,      setOrgs]     = useState<OrgItem[]>([])
  const [page,       setPage]      = useState(1)
  const [search,     setSearch]    = useState('')
  const [grade,      setGrade]     = useState('')
  const [orgId,      setOrgId]     = useState('')
  const [scoreType,  setScoreType] = useState('')
  const [minScore,   setMinScore]  = useState('')
  const [structured, setStructured]= useState('')
  const [mrStatus,   setMrStatus]  = useState('')
  const [sort,       setSort]      = useState<string>('overallScore_asc')

  const loadData = useCallback(async (overrides: Record<string, unknown> = {}) => {
    const p   = (overrides.page       ?? page)       as number
    const s   = (overrides.search     ?? search)     as string
    const g   = (overrides.grade      ?? grade)      as string
    const o   = (overrides.orgId      ?? orgId)      as string
    const st  = (overrides.scoreType  ?? scoreType)  as string
    const ms  = (overrides.minScore   ?? minScore)   as string
    const str = (overrides.structured ?? structured) as string
    const mr  = (overrides.mrStatus   ?? mrStatus)   as string
    const so  = (overrides.sort       ?? sort)       as string

    const params = new URLSearchParams({ page: String(p), sort: so })
    if (s)   params.set('search',     s)
    if (g)   params.set('grade',      g)
    if (o)   params.set('orgId',      o)
    if (st)  params.set('scoreType',  st)
    if (ms)  params.set('minScore',   ms)
    if (str) params.set('structured', str)
    if (mr)  params.set('mrStatus',   mr)

    const r = await apiFetch(`/api/datasets?${params}`)
    if (r.ok) setPd(await r.json())
  }, [page, search, grade, orgId, scoreType, minScore, structured, mrStatus, sort])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    apiFetch('/api/orgs').then(r => r.ok ? r.json() : null).then(d => {
      if (d?.orgs) setOrgs(d.orgs)
    })
  }, [])

  function handleSort(field: SortField) {
    const next = sort === `${field}_asc` ? `${field}_desc` : `${field}_asc`
    setSort(next)
    setPage(1)
    loadData({ sort: next, page: 1 })
  }

  function setFilter(key: string, value: string) {
    const updates: Record<string, unknown> = { [key]: value, page: 1 }
    if (key === 'search')     setSearch(value)
    if (key === 'grade')      setGrade(value)
    if (key === 'orgId')      setOrgId(value)
    if (key === 'scoreType')  setScoreType(value)
    if (key === 'minScore')   setMinScore(value)
    if (key === 'structured') { setStructured(value); if (value) setMrStatus('') }
    if (key === 'mrStatus')   { setMrStatus(value);   if (value) setStructured('') }
    setPage(1)
    loadData(updates)
  }

  const totalPages = pd ? Math.ceil(pd.total / pd.pageSize) : 0

  return (
    <div className="p-6 max-w-full mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">ชุดข้อมูลทั้งหมด</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {pd ? `${pd.total.toLocaleString()} ชุดข้อมูล` : 'กำลังโหลด...'}
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="card p-4 mb-5 flex flex-wrap gap-3">
        {/* Search */}
        <input
          className="input-field flex-1 min-w-44"
          placeholder="ค้นหาชุดข้อมูล..."
          value={search}
          onChange={e => setFilter('search', e.target.value)}
        />

        {/* Organization */}
        <select
          className="input-field w-48"
          value={orgId}
          onChange={e => setFilter('orgId', e.target.value)}
        >
          <option value="">— หน่วยงานทั้งหมด —</option>
          {orgs.map(o => (
            <option key={o.id} value={o.id}>{o.title || o.name}</option>
          ))}
        </select>

        {/* Grade */}
        <select
          className="input-field w-32"
          value={grade}
          onChange={e => setFilter('grade', e.target.value)}
        >
          <option value="">ทุกเกรด</option>
          {['A','B','C','D','F'].map(g => (
            <option key={g} value={g}>เกรด {g}</option>
          ))}
        </select>

        {/* Structured filter */}
        <select
          className="input-field w-36"
          value={structured}
          onChange={e => setFilter('structured', e.target.value)}
        >
          <option value="">ทุกประเภท</option>
          <option value="yes">Structured</option>
          <option value="no">Unstructured</option>
        </select>

        {/* Machine Readable filter */}
        <select
          className="input-field w-44"
          value={mrStatus}
          onChange={e => setFilter('mrStatus', e.target.value)}
        >
          <option value="">ทุก Machine Read.</option>
          <option value="fully_machine_readable">อ่านได้ทั้งหมด</option>
          <option value="partially_machine_readable">อ่านได้บางส่วน</option>
          <option value="not_machine_readable">อ่านไม่ได้</option>
          <option value="unknown">ไม่ทราบ</option>
        </select>

        {/* Score type filter */}
        <select
          className="input-field w-44"
          value={scoreType}
          onChange={e => setFilter('scoreType', e.target.value)}
        >
          {SCORE_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>

        {/* Min score */}
        {scoreType && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 whitespace-nowrap">ต่ำสุด</span>
            <input
              type="number" min="0" max="100"
              className="input-field w-20"
              placeholder="0–100"
              value={minScore}
              onChange={e => setFilter('minScore', e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-xs">
              <th className="text-left px-4 py-3 font-medium text-gray-600 min-w-48">ชุดข้อมูล</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell min-w-32">หน่วยงาน</th>
              <SortTh field="machineReadableStatus" label="Structured"   sort={sort} onSort={handleSort} className="text-center hidden lg:table-cell" />
              <SortTh field="machineReadableStatus" label="Machine Read." sort={sort} onSort={handleSort} className="text-center hidden lg:table-cell" />
              <SortTh field="overallScore"         label="เกรด/รวม"  sort={sort} onSort={handleSort} className="text-center" />
              <SortTh field="completenessScore"    label="ครบถ้วน"   sort={sort} onSort={handleSort} className="text-center hidden lg:table-cell" />
              <SortTh field="timelinessScore"      label="ทันสมัย"   sort={sort} onSort={handleSort} className="text-center hidden lg:table-cell" />
              <SortTh field="accessibilityScore"   label="เข้าถึง"   sort={sort} onSort={handleSort} className="text-center hidden xl:table-cell" />
              <SortTh field="machineReadableScore" label="อ่านได้"   sort={sort} onSort={handleSort} className="text-center hidden xl:table-cell" />
              <SortTh field="validityScore"        label="ถูกต้อง"   sort={sort} onSort={handleSort} className="text-center hidden xl:table-cell" />
              <th className="text-center px-3 py-3 font-medium text-gray-600 hidden md:table-cell w-12">ไฟล์</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {!pd && (
              <tr><td colSpan={11} className="text-center py-12 text-gray-400">กำลังโหลด...</td></tr>
            )}
            {pd?.data.length === 0 && (
              <tr><td colSpan={11} className="text-center py-12 text-gray-400">ไม่พบชุดข้อมูล</td></tr>
            )}
            {pd?.data.map(d => (
              <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <Link href={`/datasets/${d.id}`} className="font-medium text-blue-600 hover:underline line-clamp-2 max-w-xs block">
                    {d.title || d.name}
                  </Link>
                  <div className="text-xs text-gray-400 mt-0.5 md:hidden">
                    {d.organization?.title || d.organization?.name || '—'}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500 hidden md:table-cell text-xs truncate max-w-36">
                  {d.organization?.title || d.organization?.name || '—'}
                </td>
                <td className="px-3 py-3 text-center hidden lg:table-cell">
                  <StructuredBadge status={d.machineReadableStatus} />
                </td>
                <td className="px-3 py-3 text-center hidden lg:table-cell">
                  <MRBadge status={d.machineReadableStatus} />
                </td>
                {/* Grade + overall */}
                <td className="px-3 py-3 text-center">
                  <div className="flex flex-col items-center gap-1">
                    <span className={`badge ${gradeColor(d.qualityGrade || '?')} font-semibold text-xs`}>
                      {d.qualityGrade || '?'}
                    </span>
                    <span className="text-xs tabular-nums text-gray-500">{fmt(d.overallScore, 0)}</span>
                  </div>
                </td>
                <td className="px-3 py-3 text-center hidden lg:table-cell">
                  <ScoreCell value={d.completenessScore} />
                </td>
                <td className="px-3 py-3 text-center hidden lg:table-cell">
                  <ScoreCell value={d.timelinessScore} />
                </td>
                <td className="px-3 py-3 text-center hidden xl:table-cell">
                  <ScoreCell value={d.accessibilityScore} />
                </td>
                <td className="px-3 py-3 text-center hidden xl:table-cell">
                  <ScoreCell value={d.machineReadableScore} />
                </td>
                <td className="px-3 py-3 text-center hidden xl:table-cell">
                  <ScoreCell value={d.validityScore} />
                </td>
                <td className="px-3 py-3 text-center text-gray-500 hidden md:table-cell text-xs">
                  {d.resourceCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Score legend */}
      <div className="flex gap-4 mt-3 text-xs text-gray-400">
        <span className="text-green-600 font-medium">■</span> ≥80
        <span className="text-yellow-600 font-medium">■</span> 60–79
        <span className="text-red-500 font-medium">■</span> &lt;60
        <span className="text-gray-300">■</span> ยังไม่ตรวจ
        <span className="ml-auto hidden lg:block">คลิกหัวคอลัมน์เพื่อเรียงลำดับ ↕</span>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-5">
          <button
            className="btn-secondary text-xs"
            disabled={page === 1}
            onClick={() => { const p = page - 1; setPage(p); loadData({ page: p }) }}
          >← ก่อน</button>
          <span className="text-sm text-gray-600">หน้า {page} / {totalPages}</span>
          <button
            className="btn-secondary text-xs"
            disabled={page === totalPages}
            onClick={() => { const p = page + 1; setPage(p); loadData({ page: p }) }}
          >ถัดไป →</button>
        </div>
      )}
    </div>
  )
}
