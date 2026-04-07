'use client'

interface Props {
  open:    boolean
  title:   string
  message: string
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
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onCancel} />
      {/* Dialog */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="btn-secondary text-sm px-5"
          >
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
    </div>
  )
}
