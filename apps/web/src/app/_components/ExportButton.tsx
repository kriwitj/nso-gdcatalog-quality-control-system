'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  onExport: (format: 'csv' | 'xlsx') => void
  disabled?: boolean
  loading?: boolean
  label?: string
}

export default function ExportButton({ onExport, disabled, loading, label = 'ดาวน์โหลดรายงาน' }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function pick(format: 'csv' | 'xlsx') {
    setOpen(false)
    onExport(format)
  }

  return (
    <div ref={ref} className="relative inline-flex rounded-lg shadow-sm">
      {/* Main button */}
      <button
        onClick={() => pick('xlsx')}
        disabled={disabled || loading}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-l-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading
          ? <IconSpinner />
          : <IconDownload />
        }
        {label}
      </button>

      {/* Chevron / dropdown trigger */}
      <button
        onClick={() => setOpen(v => !v)}
        disabled={disabled || loading}
        className="flex items-center px-2 py-1.5 text-xs font-medium rounded-r-lg border border-l-0 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        aria-label="เลือกรูปแบบ"
      >
        <IconChevron className={`w-3.5 h-3.5 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-44 bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
          <div className="px-3 py-1.5 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
            เลือกรูปแบบ
          </div>
          <button
            onClick={() => pick('xlsx')}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <IconXlsx />
            <div className="text-left">
              <div className="font-medium leading-tight">XLSX</div>
              <div className="text-xs text-gray-400">Excel หลายชีท</div>
            </div>
          </button>
          <button
            onClick={() => pick('csv')}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <IconCsv />
            <div className="text-left">
              <div className="font-medium leading-tight">CSV</div>
              <div className="text-xs text-gray-400">ข้อความ UTF-8</div>
            </div>
          </button>
        </div>
      )}
    </div>
  )
}

function IconDownload() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
      <path d="M12 3v13M7 11l5 5 5-5" /><path d="M5 20h14" />
    </svg>
  )
}
function IconSpinner() {
  return (
    <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  )
}
function IconChevron({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}
function IconXlsx() {
  return (
    <span className="w-7 h-7 rounded-md bg-green-100 dark:bg-green-950 flex items-center justify-center text-[10px] font-bold text-green-700 dark:text-green-400 shrink-0">
      XLS
    </span>
  )
}
function IconCsv() {
  return (
    <span className="w-7 h-7 rounded-md bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-[10px] font-bold text-blue-700 dark:text-blue-400 shrink-0">
      CSV
    </span>
  )
}
