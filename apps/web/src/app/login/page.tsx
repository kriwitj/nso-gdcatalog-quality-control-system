'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'เกิดข้อผิดพลาด')
        setLoading(false)
        return
      }

      localStorage.setItem('access_token', data.accessToken)
      localStorage.setItem('user', JSON.stringify(data.user))
      router.push('/dashboard')
    } catch {
      setError('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้')
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
      style={{ background: 'linear-gradient(160deg,#0F2349 0%,#1a3a6b 50%,#0a1f42 100%)' }}
    >
      {/* Grid bg */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(59,130,246,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(59,130,246,0.06) 1px,transparent 1px)',
        backgroundSize: '60px 60px',
      }} />
      {/* Glow */}
      <div className="absolute pointer-events-none" style={{ width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle,rgba(59,130,246,0.12) 0%,transparent 70%)', top: -100, right: -100 }} />

      <div className="relative w-full max-w-sm">
        {/* Back link */}
        <div className="mb-5">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors no-underline" style={{ color: 'rgba(255,255,255,0.5)' }}>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            กลับหน้าหลัก
          </Link>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-8 shadow-2xl" style={{ background: '#fff' }}>
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg" style={{ background: 'linear-gradient(135deg,#0F2349,#3B82F6)' }}>
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
              </svg>
            </div>
          </div>

          <h1 className="text-xl font-extrabold text-center mb-1" style={{ color: '#0F2349' }}>เข้าสู่ระบบ</h1>
          <p className="text-sm text-center text-gray-400 mb-7">GDCatalog Quality Control System</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                ชื่อผู้ใช้ / Username
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                autoComplete="username"
                placeholder="admin"
                className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none transition-all"
                style={{ border: '1.5px solid #E5E7EB', color: '#111827' }}
                onFocus={e => (e.target.style.borderColor = '#3B82F6')}
                onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                รหัสผ่าน / Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none transition-all"
                style={{ border: '1.5px solid #E5E7EB', color: '#111827' }}
                onFocus={e => (e.target.style.borderColor = '#3B82F6')}
                onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
              />
            </div>

            {error && (
              <div className="rounded-lg px-3.5 py-2.5 text-sm" style={{ background: '#FEE2E2', border: '1px solid #FECACA', color: '#B91C1C' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all mt-2 disabled:opacity-60"
              style={{ background: '#0F2349' }}
            >
              {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ →'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-5">
            สงวนสิทธิ์เฉพาะเจ้าหน้าที่ที่ได้รับอนุญาต · Authorized Personnel Only
          </p>
        </div>

        <p className="text-center text-xs mt-5" style={{ color: 'rgba(255,255,255,0.3)' }}>
          GDCatalog Quality Control System — สำนักงานสถิติจังหวัดสระบุรี
        </p>
      </div>
    </div>
  )
}
