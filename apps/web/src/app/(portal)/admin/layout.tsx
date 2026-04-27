'use client'

import Link from 'next/link'
import { useEffect, useState, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/apiClient'

const TABS = [
  { href: '/admin/users',        label: 'ผู้ใช้งาน' },
  { href: '/admin/ckan-sources', label: 'CKAN Sources' },
  { href: '/admin/org',          label: 'หน่วยงาน' },
  { href: '/admin/audit',        label: 'Audit Log' },
]

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    apiFetch('/api/auth/me')
      .then(async (res) => {
        if (!res.ok) { router.push('/login'); return }
        const data = await res.json()
        if (data.user?.role !== 'admin') { router.push('/dashboard'); return }
        setAuthorized(true)
      })
      .catch(() => router.push('/login'))
  }, [router])

  if (!authorized) return null

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-5" style={{ color: 'var(--text-primary)' }}>จัดการระบบ</h1>

      <div className="rounded-xl shadow-sm border overflow-hidden mb-6 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <div className="flex border-b border-gray-200 dark:border-gray-700 px-2 pt-2 gap-1">
          {TABS.map(tab => {
            const active = pathname === tab.href || pathname.startsWith(tab.href + '/')
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="px-5 py-2.5 text-sm font-medium rounded-t-lg transition-colors no-underline"
                style={active
                  ? { background: '#1B3A6B', color: '#fff' }
                  : { color: 'var(--text-secondary)' }
                }
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLAnchorElement).style.background = 'var(--bg-hover)' }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLAnchorElement).style.background = 'transparent' }}
              >
                {tab.label}
              </Link>
            )
          })}
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}
