'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  open:         boolean
  title:        string
  message:      string
  confirmLabel?: string
  cancelLabel?:  string
  danger?: boolean
  onConfirm: () => void
  onCancel:  () => void
}

export default function ConfirmDialog({
  open, title, message,
  confirmLabel = 'ยืนยัน', cancelLabel = 'ยกเลิก',
  danger = false,
  onConfirm, onCancel,
}: Props) {
  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ margin: 0 }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
      />
      {/* Dialog box */}
      <div className="relative z-10 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">
          {title}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
          {message}
        </p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="btn-secondary text-sm px-5">
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`text-sm px-5 py-2 rounded-lg font-medium transition-colors ${
              danger
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'btn-primary'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
