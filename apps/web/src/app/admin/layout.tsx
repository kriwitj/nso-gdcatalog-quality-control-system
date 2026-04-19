'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import PortalShell from '@/app/_components/PortalShell'
import { apiFetch } from '@/lib/apiClient'

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    apiFetch('/api/auth/me')
      .then(async (res) => {
        if (!res.ok) { router.push('/login'); return }
        const data = await res.json()
        if (data.role !== 'admin') { router.push('/dashboard'); return }
        setAuthorized(true)
      })
      .catch(() => router.push('/login'))
  }, [router])

  if (!authorized) return null

  return <PortalShell>{children}</PortalShell>
}
