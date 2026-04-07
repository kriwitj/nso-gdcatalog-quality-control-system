'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/apiClient'

export default function SettingsPage() {
  const router = useRouter()
  const [form, setForm]     = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [loading, setLoading] = useState(false)
  const [msg, setMsg]         = useState<{ text: string; ok: boolean } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.newPassword !== form.confirmPassword) {
      setMsg({ text: 'รหัสผ่านใหม่ไม่ตรงกัน', ok: false })
      return
    }
    setLoading(true); setMsg(null)
    const r = await apiFetch('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({
        currentPassword: form.currentPassword,
        newPassword:     form.newPassword,
      }),
    })
    const d = await r.json()
    if (r.ok) {
      setMsg({ text: d.message, ok: true })
      setTimeout(() => {
        localStorage.removeItem('access_token')
        localStorage.removeItem('user')
        router.push('/login')
      }, 2000)
    } else {
      setMsg({ text: d.error || 'เกิดข้อผิดพลาด', ok: false })
    }
    setLoading(false)
  }

  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">เปลี่ยนรหัสผ่าน</h1>
      <div className="card p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {(
            [
              { key: 'currentPassword', label: 'รหัสผ่านปัจจุบัน' },
              { key: 'newPassword',     label: 'รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)' },
              { key: 'confirmPassword', label: 'ยืนยันรหัสผ่านใหม่' },
            ] as const
          ).map(({ key, label }) => (
            <div key={key}>
              <label className="block text-sm text-gray-600 mb-1">{label}</label>
              <input
                type="password"
                required
                className="input-field"
                value={form[key]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
              />
            </div>
          ))}

          {msg && (
            <p className={`text-sm ${msg.ok ? 'text-green-600' : 'text-red-600'}`}>
              {msg.text}
            </p>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
            {loading ? 'กำลังบันทึก...' : 'เปลี่ยนรหัสผ่าน'}
          </button>
        </form>
      </div>
    </div>
  )
}
