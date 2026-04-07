'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, Tooltip,
} from 'recharts'
import {
  gradeColor, timelinessColor, timelinessLabel,
  machineReadableLabel, machineReadableColor,
  structuredLabel, severityColor, severityLabel, fmt, scoreBarColor,
} from '@/lib/scoring'

interface ResourceRow {
  id: string
  name: string | null
  format: string | null
  url: string | null
  latestCheck: {
    httpStatus: number | null
    downloadable: boolean | null
    timelinessStatus: string | null
    structuredStatus: string | null
    isMachineReadable: boolean | null
    isValid: boolean | null
    rowCount: number | null
    columnCount: number | null
    errorCount: number | null
    validityReport: {
      blankHeader: number; duplicateHeader: number; blankRow: number
      extraValue: number; missingValue: number; valid: boolean | null
      severity: string | null; errorMessage: string | null
    } | null
  } | null
}

interface DatasetDetail {
  id: string; ckanId: string; title: string | null; name: string
  notes: string | null; license: string | null; tags: string[]; groups: string[]
  updateFrequency: string | null; metadataModified: string | null
  resourceCount: number
  organization: { name: string; title: string | null } | null
  completenessScore: number | null; timelinessScore: number | null
  accessibilityScore: number | null; machineReadableScore: number | null
  validityScore: number | null; overallScore: number | null
  qualityGrade: string | null; machineReadableStatus: string | null
  timelinessStatus: string | null; lastScanAt: string | null
  resources: ResourceRow[]
  scoreHistory: { recordedAt: string; overallScore: number | null }[]
  ckanSource: { id: string; name: string; url: string } | null
}

const SCORE_LABELS: Record<string, string> = {
  completenessScore: 'Metadata', timelinessScore: 'Timeliness',
  accessibilityScore: 'Accessibility', machineReadableScore: 'Machine Readable', validityScore: 'Validity',
}
const SCORE_WEIGHTS: Record<string, number> = {
  completenessScore: 20, timelinessScore: 20, accessibilityScore: 15,
  machineReadableScore: 20, validityScore: 25,
}

// helper: แปลงวันที่อย่างปลอดภัย
function safeDate(s: string | null | undefined): string {
  if (!s) return '-'
  const d = new Date(s)
  if (isNaN(d.getTime())) return '-'
  return d.toLocaleString('th-TH')
}
function safeDateShort(s: string | null | undefined): string {
  if (!s) return '-'
  const d = new Date(s)
  if (isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('th-TH', { month: 'short', day: 'numeric' })
}

export default function DatasetDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<DatasetDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    setError(null)
    fetch(`/api/datasets/${id}`)
      .then(async r => {
        const text = await r.text()
        if (!text) throw new Error('API returned empty response')
        try { return JSON.parse(text) } catch { throw new Error(`Non-JSON: ${text.slice(0, 200)}`) }
      })
      .then(d => {
        if (d.error) throw new Error(d.error + (d.detail ? ` — ${d.detail}` : ''))
        setData(d)
      })
      .catch(e => { console.error(e); setError(e.message) })
  }, [id])

  async function triggerScan() {
    setScanning(true); setMsg('')
    try {
      const r = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ datasetId: id }),
      })
      const d = await r.json()
      setMsg(d.message || 'เริ่มตรวจสอบแล้ว')
    } catch (e) { setMsg('เกิดข้อผิดพลาด: ' + String(e)) }
    setScanning(false)
  }

  if (error) return (
    <div className="p-8 max-w-3xl mx-auto">
      <Link href="/datasets" className="text-sm text-gray-400 hover:text-gray-600">← ชุดข้อมูล</Link>
      <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
        <div className="font-medium mb-1">เกิดข้อผิดพลาด</div>
        <div className="font-mono text-xs whitespace-pre-wrap">{error}</div>
      </div>
    </div>
  )
  if (!data) return <div className="p-8 flex items-center justify-center h-64 text-gray-400">กำลังโหลด...</div>

  const radarData = Object.keys(SCORE_LABELS).map(k => ({
    subject: SCORE_LABELS[k],
    score: (data[k as keyof DatasetDetail] as number | null) ?? 0,
    fullMark: 100,
  }))
  const historyData = data.scoreHistory
    .map(h => ({ date: safeDateShort(h.recordedAt), score: h.overallScore ?? 0 }))

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
        <Link href="/datasets" className="hover:text-gray-600">ชุดข้อมูล</Link>
        <span>/</span>
        <span className="text-gray-600 truncate">{data.title || data.name}</span>
      </div>

      <div className="flex items-start justify-between gap-4 mb-8">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className={`badge ${gradeColor(data.qualityGrade || '?')} text-lg font-bold px-3 py-1`}>
              {data.qualityGrade || '?'}
            </span>
            <h2 className="text-xl font-semibold text-gray-900">{data.title || data.name}</h2>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-gray-500">
            <span>🏛 {data.organization?.title || data.organization?.name || 'ไม่ระบุ'}</span>
            <span>📄 {data.resourceCount} ไฟล์</span>
            {data.updateFrequency && <span>🔄 {data.updateFrequency}</span>}
            {data.lastScanAt && <span>🕐 ตรวจ: {safeDate(data.lastScanAt)}</span>}
          </div>
          {data.notes && <p className="mt-3 text-sm text-gray-600 max-w-3xl line-clamp-3">{data.notes}</p>}
          {(data.tags?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {data.tags.map(t => <span key={t} className="badge border-gray-200 text-gray-500">{t}</span>)}
            </div>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          {data.ckanSource && (
            <a href={`${data.ckanSource.url}/dataset/${data.ckanId}`} target="_blank" rel="noreferrer" className="btn-secondary text-xs">
              เปิดใน CKAN ↗
            </a>
          )}
          <button onClick={triggerScan} disabled={scanning} className="btn-primary text-xs">
            {scanning ? '⏳ กำลังตรวจ...' : '▶ ตรวจสอบ'}
          </button>
        </div>
      </div>
      {msg && <div className="mb-6 p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg text-sm">{msg}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 card p-5">
          <h3 className="text-sm font-medium text-gray-700 mb-4">คะแนนแต่ละมิติ</h3>
          <div className="space-y-4">
            {Object.keys(SCORE_LABELS).map(k => {
              const score = (data[k as keyof DatasetDetail] as number | null) ?? null
              return (
                <div key={k}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{SCORE_LABELS[k]} <span className="text-gray-400 text-xs">(น้ำหนัก {SCORE_WEIGHTS[k]}%)</span></span>
                    <span className="font-medium">{fmt(score)} / 100</span>
                  </div>
                  <div className="bg-gray-100 rounded-full h-2">
                    <div className={`score-bar ${scoreBarColor(score)}`} style={{ width: `${score ?? 0}%` }} />
                  </div>
                </div>
              )
            })}
            <div className="border-t border-gray-100 pt-3 flex justify-between text-sm font-semibold">
              <span>คะแนนรวม</span>
              <span className="text-lg">{fmt(data.overallScore)} / 100</span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Radar Score</h3>
            <ResponsiveContainer width="100%" height={160}>
              <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
                <Radar dataKey="score" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          {historyData.length > 1 && (
            <div className="card p-5">
              <h3 className="text-sm font-medium text-gray-700 mb-2">ประวัติคะแนน</h3>
              <ResponsiveContainer width="100%" height={100}>
                <LineChart data={historyData} margin={{ top: 5, right: 5, bottom: 5, left: -30 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v) => [`${Number(v).toFixed(1)}`, 'คะแนน']} />
                  <Line type="monotone" dataKey="score" stroke="#3b82f6" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-medium text-gray-700">ทรัพยากร ({data.resources.length})</h3>
        </div>
        {data.resources.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">ไม่มีทรัพยากรในชุดข้อมูลนี้</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-left">
                  <th className="px-4 py-3 font-medium text-gray-600">ชื่อไฟล์</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Format</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-center">HTTP</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-center">Timeliness</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-center">Structured</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-center">Machine Read.</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-center">Validity</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-center">แถว</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.resources.map(r => {
                  const c = r.latestCheck
                  // validity badge: ใช้ validityReport.severity ถ้ามี, fallback ดู isValid
                  const validityBadge = () => {
                    if (!c) return <span className="text-gray-300">-</span>
                    if (c.validityReport) {
                      return <span className={`badge ${severityColor(c.validityReport.severity)}`}>{severityLabel(c.validityReport.severity)}</span>
                    }
                    if (c.isValid === true)  return <span className="badge text-emerald-700 bg-emerald-50 border-emerald-200">ผ่าน</span>
                    if (c.isValid === false) return <span className="badge text-red-700 bg-red-50 border-red-200">ไม่ผ่าน</span>
                    return <span className="text-gray-300">-</span>
                  }
                  return (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/resources/${r.id}`} className="text-blue-600 hover:underline font-medium truncate block max-w-xs">
                          {r.name || r.url?.split('/').pop() || r.id}
                        </Link>
                        {r.url && <div className="text-xs text-gray-400 truncate max-w-xs mt-0.5">{r.url}</div>}
                      </td>
                      <td className="px-4 py-3">
                        {r.format && <span className="badge border-gray-200 text-gray-600">{r.format}</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {c?.httpStatus
                          ? <span className={`badge ${c.httpStatus === 200 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-red-700 bg-red-50 border-red-200'}`}>{c.httpStatus}</span>
                          : <span className="text-gray-300">-</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {c ? <span className={`badge ${timelinessColor(c.timelinessStatus)}`}>{timelinessLabel(c.timelinessStatus)}</span>
                           : <span className="text-gray-300">-</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {c ? <span className="badge border-gray-200 text-gray-600">{structuredLabel(c.structuredStatus)}</span>
                           : <span className="text-gray-300">-</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {c ? <span className={`badge ${machineReadableColor(c.isMachineReadable ? 'fully_machine_readable' : 'not_machine_readable')}`}>
                               {c.isMachineReadable ? 'ใช่' : 'ไม่'}
                             </span>
                           : <span className="text-gray-300">-</span>}
                      </td>
                      <td className="px-4 py-3 text-center">{validityBadge()}</td>
                      <td className="px-4 py-3 text-center text-gray-500">
                        {c?.rowCount?.toLocaleString() ?? '-'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}