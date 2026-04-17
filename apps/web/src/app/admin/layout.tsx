'use client'

import { useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import PortalShell from '@/app/_components/PortalShell'

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter()

  useEffect(() => {
    const raw = localStorage.getItem('user')
    if (!raw) { router.push('/login'); return }
    try {
      const user = JSON.parse(raw)
      if (user.role !== 'admin') router.push('/dashboard')
    } catch {
      router.push('/login')
    }
  }, [router])

  return <PortalShell>{children}</PortalShell>
}
