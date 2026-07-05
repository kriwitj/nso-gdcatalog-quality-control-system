'use client'

import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function SsoDoneInner() {
  const router = useRouter()
  const params = useSearchParams()

  useEffect(() => {
    const token = params.get('token')
    if (!token) {
      router.replace('/login?sso_error=missing_token')
      return
    }

    localStorage.setItem('access_token', token)

    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (data.user) localStorage.setItem('user', JSON.stringify(data.user))
        router.replace('/dashboard')
      })
      .catch(() => router.replace('/dashboard'))
  }, [params, router])

  return null
}

export default function SsoDonePage() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0F2349' }}>
      <div className="text-center text-white">
        <div className="w-10 h-10 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm opacity-70">กำลังเข้าสู่ระบบ...</p>
      </div>
      <Suspense>
        <SsoDoneInner />
      </Suspense>
    </div>
  )
}
