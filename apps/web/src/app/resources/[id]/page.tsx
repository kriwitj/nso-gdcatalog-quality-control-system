'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { timelinessLabel, timelinessColor, structuredLabel, severityColor, severityLabel } from '@/lib/scoring'
import { apiFetch } from '@/lib/apiClient'
import { downloadCSV, downloadXLSX } from '@/lib/downloadFile'
import ConfirmDialog from '@/app/_components/ConfirmDialog'

interface ValidityReportRow {
  blankHeader: number; duplicateHeader: number; blankRow: number
  extraValue: number; extraHeader: number; missingValue: number
  formatError: number; schemaError: number; encodingError: number; sourceError: number
  encoding: string | null; errorMessage: string | null; valid: boolean | null
  severity: string | null; primaryIssue: string | null; rawJson: unknown
}

interface CheckRow {
  id: string; checkedAt: string | null; httpStatus: number | null; downloadable: boolean | null
  contentType: string | null; fileSize: number | null; detectedFormat: string | null
  isMachineReadable: boolean | null; isStructured: boolean | null
  structuredStatus: string | null; timelinessStatus: string | null
  encoding: string | null; rowCount: number | null; columnCount: number | null
  isValid: boolean | null; errorCount: number | null; warningCount: number | null
  partialScan: boolean; scanDurationMs: number | null; errorMsg: string | null
  validityReport: ValidityReportRow | null
}

interface ResourceDetail {
  id: string; ckanId: string; name: string | null; format: string | null; url: string | null
  dataset: { id: string; title: string | null; name: string }
  checks: CheckRow[]
}

type NumericVRKey = 'blankHeader' | 'duplicateHeader' | 'blankRow' | 'extraValue' | 'extraHeader' | 'missingValue' | 'formatError' | 'schemaError' | 'encodingError' | 'sourceError'

const VR_FIELDS: { key: NumericVRKey; label: string }[] = [
  { key: 'blankHeader',     label: 'หัวคอลัมน์ว่าง (Blank Header)' },
  { key: 'duplicateHeader', label: 'หัวคอลัมน์ซ้ำ (Duplicate Header)' },
  { key: 'blankRow',        label: 'แถวว่าง (Blank Row)' },
  { key: 'extraValue',      label: 'ค่าเกิน (Extra Value)' },
  { key: 'extraHeader',     label: 'หัวเกิน (Extra Header)' },
  { key: 'missingValue',    label: 'ค่าหายไป (Missing Value)' },
  { key: 'formatError',     label: 'ข้อผิดพลาด Format' },
  { key: 'schemaError',     label: 'ข้อผิดพลาด Schema' },
  { key: 'encodingError',   label: 'ข้อผิดพลาด Encoding' },
  { key: 'sourceError',     label: 'ข้อผิดพลาดแหล่งข้อมูล' },
]

function safeDate(s: string | null | undefined): string {
  if (!s) return '-'
  const d = new Date(s)
  return isNaN(d.getTime()) ? '-' : d.toLocaleString('th-TH')
}

function safeDateShort(s: string | null | undefined): string {
  if (!s) return '-'
  const d = new Date(s)
  return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('th-TH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function ResourceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [data,     setData]     = useState<ResourceDetail | null>(null)
  const [error,    setError]    = useState<string | null>(null)
  const [activeCheck, setActiveCheck] = useState(0)
  const [scanning,     setScanning]     = useState(false)
  const [scanMsg,      setScanMsg]      = useState('')
  const [confirmOpen,  setConfirmOpen]  = useState(false)

  async function triggerScan() {
    setConfirmOpen(false)
    setScanning(true); setScanMsg('')
    try {
      const r = await apiFetch('/api/scan', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ resourceId: id }),
      })
      const d = await r.json()
      setScanMsg(r.ok ? (d.message || 'เริ่มตรวจสอบแล้ว') : (d.error || 'เกิดข้อผิดพลาด'))
    } catch (e) { setScanMsg('เกิดข้อผิดพลาด: ' + String(e)) }
    setScanning(false)
  }

  useEffect(() => {
    fetch(`/api/resources/${id}`)
      .then(async r => {
        const text = await r.text()
        if (!text) throw new Error('Empty response')
        try { return JSON.parse(text) } catch { throw new Error(`Non-JSON: ${text.slice(0, 200)}`) }
      })
      .then(d => {
        if (d.error) throw new Error(d.error + (d.detail ? ` — ${d.detail}` : ''))
        setData(d)
      })
      .catch(e => { console.error(e); setError(e.message) })
  }, [id])

  function handleDownload(format: 'csv' | 'xlsx') {
    if (!data) return
    const ts = new Date().toISOString().slice(0, 10)
    const name = (data.name || data.ckanId).replace(/[/\\?%*:|"<>]/g, '_')

    const rows = data.checks.map((c, i) => {
      const vr = c.validityReport
      return {
        'ลำดับ': i + 1,
        'ตรวจเมื่อ': c.checkedAt ? new Date(c.checkedAt).toLocaleString('th-TH') : '',
        'HTTP Status': c.httpStatus ?? '',
        'ดาวน์โหลดได้': c.downloadable === true ? 'ใช่' : c.downloadable === false ? 'ไม่' : '',
        'Content-Type': c.contentType || '',
        'Format ที่ตรวจพบ': c.detectedFormat || '',
        'Encoding': c.encoding || '',
        'ขนาดไฟล์ (MB)': c.fileSize ? (c.fileSize / 1024 / 1024).toFixed(2) : '',
        'จำนวนแถว': c.rowCount ?? '',
        'จำนวนคอลัมน์': c.columnCount ?? '',
        'Machine Readable': c.isMachineReadable === true ? 'ใช่' : c.isMachineReadable === false ? 'ไม่' : '',
        'Structured Status': structuredLabel(c.structuredStatus),
        'Timeliness': timelinessLabel(c.timelinessStatus),
        'Validity': c.isValid === true ? 'ผ่าน' : c.isValid === false ? 'ไม่ผ่าน' : '',
        'Severity': vr?.severity || '',
        'ข้อผิดพลาด (รวม)': c.errorCount ?? '',
        'คำเตือน': c.warningCount ?? '',
        'Blank Header': vr?.blankHeader ?? '',
        'Duplicate Header': vr?.duplicateHeader ?? '',
        'Blank Row': vr?.blankRow ?? '',
        'Extra Value': vr?.extraValue ?? '',
        'Extra Header': vr?.extraHeader ?? '',
        'Missing Value': vr?.missingValue ?? '',
        'Format Error': vr?.formatError ?? '',
        'Schema Error': vr?.schemaError ?? '',
        'Encoding Error': vr?.encodingError ?? '',
        'Source Error': vr?.sourceError ?? '',
        'Error Message': vr?.errorMessage || '',
        'Partial Scan': c.partialScan ? 'ใช่' : 'ไม่',
        'ใช้เวลาตรวจ (ms)': c.scanDurationMs ?? '',
      }
    })

    if (format === 'csv') {
      downloadCSV(rows, `${name}_checks_${ts}.csv`)
    } else {
      downloadXLSX([{ name: 'ผลการตรวจสอบ', rows }], `${name}_checks_${ts}.xlsx`)
    }
  }

  if (error) return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-mono whitespace-pre-wrap dark:bg-red-900/30 dark:border-red-700 dark:text-red-300">{error}</div>
    </div>
  )
  if (!data) return <div className="p-8 flex items-center justify-center h-64 text-gray-400">กำลังโหลด...</div>

  const check = data.checks[activeCheck]
  const vr = check?.validityReport

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500 mb-6">
        <Link href="/datasets" className="hover:text-gray-600 dark:hover:text-gray-300">ชุดข้อมูล</Link>
        <span>/</span>
        <Link href={`/datasets/${data.dataset.id}`} className="hover:text-gray-600 dark:hover:text-gray-300 truncate max-w-xs">
          {data.dataset.title || data.dataset.name}
        </Link>
        <span>/</span>
        <span className="text-gray-600 dark:text-gray-300">ทรัพยากร</span>
      </div>

      {/* Header */}
      <div className="card p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">{data.name || data.ckanId}</h2>
            <div className="flex flex-wrap gap-3 text-sm text-gray-500 dark:text-gray-400">
              {data.format && <span className="badge border-gray-200 text-gray-600 dark:border-gray-600 dark:text-gray-400">{data.format}</span>}
              {data.url && (
                <a href={data.url} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline truncate max-w-sm">{data.url}</a>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            {data.url && (
              <a href={data.url} target="_blank" rel="noreferrer" className="btn-secondary text-xs">ดาวน์โหลดไฟล์ ↓</a>
            )}
            <button onClick={() => handleDownload('csv')} disabled={!data.checks.length} className="btn-secondary text-xs">⬇ รายงาน CSV</button>
            <button onClick={() => handleDownload('xlsx')} disabled={!data.checks.length} className="btn-secondary text-xs">⬇ รายงาน XLSX</button>
            <button onClick={() => setConfirmOpen(true)} disabled={scanning} className="btn-primary text-xs">
              {scanning ? '⏳ กำลังตรวจ...' : '▶ ตรวจสอบ'}
            </button>
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={confirmOpen} title="ยืนยันการตรวจสอบ"
        message={`ตรวจสอบคุณภาพทรัพยากร "${data.name || data.ckanId}" ใช่หรือไม่?`}
        confirmLabel="▶ เริ่มตรวจสอบ"
        onConfirm={triggerScan} onCancel={() => setConfirmOpen(false)}
      />
      {scanMsg && (
        <div className={`mb-5 p-3 rounded-lg text-sm border ${
          scanMsg.includes('ผิดพลาด') || scanMsg.includes('สิทธิ์')
            ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/30 dark:border-red-700 dark:text-red-300'
            : 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300'
        }`}>{scanMsg}</div>
      )}

      {/* Check history tabs */}
      {data.checks.length > 1 && (
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {data.checks.map((c, i) => (
            <button key={c.id} onClick={() => setActiveCheck(i)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                i === activeCheck ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}>
              {safeDateShort(c.checkedAt)}
            </button>
          ))}
        </div>
      )}

      {!check ? (
        <div className="card p-8 text-center text-gray-400">ยังไม่มีผลการตรวจสอบ — กดปุ่ม "ตรวจสอบ" ที่หน้าชุดข้อมูลก่อนครับ</div>
      ) : (
        <div className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'HTTP Status',      value: String(check.httpStatus ?? '-'), ok: check.httpStatus === 200 },
              { label: 'ดาวน์โหลดได้',     value: check.downloadable === true ? 'ได้' : check.downloadable === false ? 'ไม่ได้' : '-', ok: check.downloadable ?? null },
              { label: 'Machine Readable', value: check.isMachineReadable === true ? 'ใช่' : check.isMachineReadable === false ? 'ไม่' : '-', ok: check.isMachineReadable ?? null },
              { label: 'Validity',         value: check.isValid === true ? 'ผ่าน' : check.isValid === false ? 'ไม่ผ่าน' : '-', ok: check.isValid ?? null },
            ].map(item => (
              <div key={item.label} className="card p-4">
                <div className="text-xs text-gray-500 mb-1">{item.label}</div>
                <div className={`text-xl font-semibold ${item.ok === true ? 'text-emerald-600' : item.ok === false ? 'text-red-500' : 'text-gray-400'}`}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          {/* Metadata */}
          <div className="card p-5">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">ข้อมูลทรัพยากร</h3>
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-3 text-sm">
              {[
                { label: 'ตรวจเมื่อ',         val: safeDate(check.checkedAt) },
                { label: 'Content-Type',       val: check.contentType },
                { label: 'Format ที่ตรวจพบ',  val: check.detectedFormat },
                { label: 'Encoding',            val: check.encoding },
                { label: 'ขนาดไฟล์',           val: check.fileSize ? `${(check.fileSize / 1024 / 1024).toFixed(2)} MB` : null },
                { label: 'จำนวนแถว',           val: check.rowCount?.toLocaleString() },
                { label: 'จำนวนคอลัมน์',       val: check.columnCount?.toLocaleString() },
                { label: 'Timeliness',          val: timelinessLabel(check.timelinessStatus) },
                { label: 'Structured Status',   val: structuredLabel(check.structuredStatus) },
                { label: 'ใช้เวลาตรวจ',        val: check.scanDurationMs ? `${check.scanDurationMs} ms` : null },
              ].map(f => (
                <div key={f.label}>
                  <dt className="text-gray-400 dark:text-gray-500">{f.label}</dt>
                  <dd className="font-medium text-gray-800 dark:text-gray-200 mt-0.5">{f.val || '-'}</dd>
                </div>
              ))}
            </dl>
            {check.partialScan && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-300">
                ⚠️ Partial scan — ไฟล์ขนาดใหญ่เกินกำหนด ตรวจเพียงบางส่วน
              </div>
            )}
            {check.errorMsg && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs font-mono whitespace-pre-wrap dark:bg-red-900/30 dark:border-red-700 dark:text-red-300">
                ข้อผิดพลาด: {check.errorMsg}
              </div>
            )}
          </div>

          {/* Validity Report */}
          {(vr || check.isValid === false) && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Validity Report</h3>
                <div className="flex items-center gap-2">
                  {vr && <span className={`badge ${severityColor(vr.severity)}`}>{severityLabel(vr.severity)}</span>}
                  <span className={`badge ${vr?.valid || check.isValid ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-red-700 bg-red-50 border-red-200'}`}>
                    {vr?.valid || check.isValid ? 'Valid' : 'Invalid'}
                  </span>
                </div>
              </div>

              {/* Error message */}
              {vr?.errorMessage && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs font-mono whitespace-pre-wrap dark:bg-red-900/30 dark:border-red-700 dark:text-red-300">
                  {vr.errorMessage}
                </div>
              )}

              {/* กรณี valid=False แต่ errorMessage ว่าง */}
              {vr && !vr.errorMessage && vr.valid === false && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-300">
                  ไฟล์ไม่ผ่านการตรวจสอบจาก Frictionless แต่ไม่มีรายละเอียด error type ที่ชัดเจน
                  อาจเป็นปัญหาเรื่อง encoding หรือโครงสร้างข้อมูลที่ไม่รองรับ
                </div>
              )}

              {/* Fallback: ไม่มี validityReport row */}
              {!vr && check.isValid === false && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs space-y-1 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-300">
                  <div className="font-medium">ไม่มีรายละเอียด Validity Report</div>
                  {check.errorMsg && <div className="font-mono">{check.errorMsg}</div>}
                  {(check.errorCount ?? 0) > 0 && <div>พบข้อผิดพลาด {check.errorCount} รายการ</div>}
                  <div className="text-amber-700 dark:text-amber-400 mt-1">💡 กด ▶ ตรวจสอบอีกครั้งเพื่อรับ report ล่าสุด</div>
                </div>
              )}

              {/* Error count grid */}
              {vr && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                  {VR_FIELDS.map(f => {
                    const val = vr[f.key]
                    return (
                      <div key={f.key} className={`rounded-lg p-3 border text-sm ${val > 0 ? 'bg-red-50 border-red-200 dark:bg-red-900/30 dark:border-red-700' : 'bg-gray-50 border-gray-100 dark:bg-gray-700/50 dark:border-gray-600'}`}>
                        <div className={`text-xl font-semibold ${val > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-300 dark:text-gray-500'}`}>{val}</div>
                        <div className={`text-xs mt-0.5 ${val > 0 ? 'text-red-700 dark:text-red-300' : 'text-gray-400 dark:text-gray-500'}`}>{f.label}</div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Raw JSON */}
              {vr?.rawJson != null && (
                <details>
                  <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300">Raw JSON</summary>
                  <pre className="mt-2 text-xs bg-gray-50 p-3 rounded-lg overflow-x-auto border border-gray-100 text-gray-600 dark:bg-gray-700/50 dark:border-gray-600 dark:text-gray-300">
                    {JSON.stringify(vr.rawJson, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}