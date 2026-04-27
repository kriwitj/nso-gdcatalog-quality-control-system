'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/apiClient'

interface UserInfo {
  id: string; username: string; email?: string; role: string
  division?: { id: string; name: string } | null
}

const THEME_OPTIONS = [
  { value: 'light',  label: 'สว่าง',    icon: '☀️' },
  { value: 'dark',   label: 'มืด',      icon: '🌙' },
  { value: 'system', label: 'อุปกรณ์', icon: '💻' },
]

const ROLE_LABEL: Record<string, string> = {
  admin:  'ผู้ดูแลระบบ',
  editor: 'ผู้แก้ไข',
  viewer: 'ผู้ดูข้อมูล',
}

export default function SettingsPage() {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [user,    setUser]    = useState<UserInfo | null>(null)
  const [form, setForm]       = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [loading, setLoading] = useState(false)
  const [msg, setMsg]         = useState<{ text: string; ok: boolean } | null>(null)

  useEffect(() => {
    setMounted(true)
    const stored = localStorage.getItem('user')
    if (stored) {
      try { setUser(JSON.parse(stored)) } catch {}
    }
    // refresh from server
    apiFetch('/api/auth/me').then(async r => {
      if (r.ok) {
        const { user: u } = await r.json()
        setUser(u)
        localStorage.setItem('user', JSON.stringify(u))
      }
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.newPassword !== form.confirmPassword) {
      setMsg({ text: 'รหัสผ่านใหม่ไม่ตรงกัน', ok: false }); return
    }
    setLoading(true); setMsg(null)
    const r = await apiFetch('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }),
    })
    const d = await r.json()
    if (r.ok) {
      setMsg({ text: d.message, ok: true })
      setTimeout(() => {
        localStorage.removeItem('access_token'); localStorage.removeItem('user')
        router.push('/login')
      }, 2000)
    } else {
      setMsg({ text: d.error || 'เกิดข้อผิดพลาด', ok: false })
    }
    setLoading(false)
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">ตั้งค่าบัญชี</h1>

      {/* Profile */}
      <section className="card p-6">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">ข้อมูลโปรไฟล์</h2>
        {user ? (
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center text-2xl font-bold uppercase shrink-0">
              {user.username[0]}
            </div>
            <div className="space-y-2 text-sm flex-1">
              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                <div>
                  <dt className="text-xs text-gray-400 dark:text-gray-500">ชื่อผู้ใช้</dt>
                  <dd className="font-medium text-gray-900 dark:text-gray-100">{user.username}</dd>
                </div>
                {user.email && (
                  <div>
                    <dt className="text-xs text-gray-400 dark:text-gray-500">อีเมล</dt>
                    <dd className="font-medium text-gray-900 dark:text-gray-100">{user.email}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs text-gray-400 dark:text-gray-500">บทบาท</dt>
                  <dd className="font-medium text-gray-900 dark:text-gray-100">
                    {ROLE_LABEL[user.role] || user.role}
                  </dd>
                </div>
                {user.division && (
                  <div>
                    <dt className="text-xs text-gray-400 dark:text-gray-500">ศูนย์/กอง</dt>
                    <dd className="font-medium text-gray-900 dark:text-gray-100">{user.division.name}</dd>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-400">กำลังโหลด...</div>
        )}
      </section>

      {/* Theme */}
      <section className="card p-6">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">ธีมการแสดงผล</h2>
        {mounted ? (
          <div className="flex gap-3">
            {THEME_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                className={`flex-1 flex flex-col items-center gap-2 py-4 rounded-xl border-2 text-sm transition-all ${
                  theme === opt.value
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                <span className="text-2xl">{opt.icon}</span>
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="h-20 bg-gray-100 dark:bg-gray-700 rounded-xl animate-pulse" />
        )}
      </section>

      {/* Change password */}
      <section className="card p-6">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">เปลี่ยนรหัสผ่าน</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {(
            [
              { key: 'currentPassword', label: 'รหัสผ่านปัจจุบัน' },
              { key: 'newPassword',     label: 'รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)' },
              { key: 'confirmPassword', label: 'ยืนยันรหัสผ่านใหม่' },
            ] as const
          ).map(({ key, label }) => (
            <div key={key}>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">{label}</label>
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
            <p className={`text-sm ${msg.ok ? 'text-green-600' : 'text-red-500'}`}>{msg.text}</p>
          )}
          <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
            {loading ? 'กำลังบันทึก...' : 'เปลี่ยนรหัสผ่าน'}
          </button>
        </form>
      </section>
    </div>
  )
}
