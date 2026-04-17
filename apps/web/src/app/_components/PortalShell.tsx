'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/apiClient'

const NAV = [
  { href: '/dashboard', label: 'ภาพรวม',    icon: '◈' },
  { href: '/datasets',  label: 'ชุดข้อมูล', icon: '▤' },
  { href: '/jobs',      label: 'งานตรวจสอบ', icon: '⟳' },
]

const ADMIN_NAV = [
  { href: '/admin/users',        label: 'ผู้ใช้',            icon: '👤' },
  { href: '/admin/ckan-sources', label: 'CKAN Sources',      icon: '🔗' },
  { href: '/admin/org',          label: 'โครงสร้างองค์กร',  icon: '🏛' },
  { href: '/admin/audit',        label: 'Audit Log',         icon: '📋' },
]

interface UserInfo {
  id: string; username: string; email?: string; role: string
  division?: { id: string; name: string } | null
}
interface SourceInfo { id: string; name: string; url: string }

function getHostname(url: string) {
  try { return new URL(url).hostname } catch { return url }
}

export default function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()
  const [user,    setUser]    = useState<UserInfo | null>(null)
  const [sources, setSources] = useState<SourceInfo[]>([])

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) { router.push('/login'); return }

    apiFetch('/api/auth/me').then(async r => {
      if (!r.ok) { router.push('/login'); return }
      const { user: u, sources: srcs } = await r.json()
      setUser(u)
      setSources(srcs ?? [])
      localStorage.setItem('user', JSON.stringify(u))
    })
  }, [router])

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    localStorage.removeItem('access_token')
    localStorage.removeItem('user')
    router.push('/login')
  }

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/')

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col shrink-0 h-full overflow-y-auto">
        <div className="p-5 border-b border-gray-100 dark:border-gray-700">
          <Link href="/" className="block">
            <div className="text-xs text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wider mb-0.5">
              GQC - GDCatalog Quality Control System
            </div>
            <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100 leading-snug">
              ระบบตรวจคุณภาพ<br />ข้อมูล GDCatalog<br />Smart Plus
            </h1>
          </Link>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV.map(item => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} />
          ))}

          {user?.role === 'admin' && (
            <>
              <div className="pt-3 pb-1 px-3">
                <span className="text-xs font-medium text-gray-400 dark:text-gray-600 uppercase tracking-wider">Admin</span>
              </div>
              {ADMIN_NAV.map(item => (
                <NavLink key={item.href} item={item} active={isActive(item.href)} />
              ))}
            </>
          )}
        </nav>

        <div className="p-4 border-t border-gray-100 dark:border-gray-700 space-y-3">
          {user && (
            <>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center text-xs font-semibold uppercase shrink-0">
                  {user.username[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{user.username}</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500">
                    {user.division?.name
                      ? <span title={`ศูนย์/กอง: ${user.division.name}`}>{user.division.name}</span>
                      : <span className="capitalize">{user.role}</span>
                    }
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  title="ออกจากระบบ"
                  className="text-gray-400 hover:text-red-500 text-xs transition-colors"
                >⏏</button>
              </div>
              <Link
                href="/settings"
                className="block text-xs text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                ⚙️ ตั้งค่าบัญชี
              </Link>
            </>
          )}

          {/* แหล่งข้อมูล CKAN Sources */}
          {sources.length > 0 && (
            <div className="text-xs text-gray-400 dark:text-gray-500">
              <div className="mb-1 font-medium text-gray-500 dark:text-gray-400">แหล่งข้อมูล</div>
              <div className="space-y-0.5">
                {sources.map(s => (
                  <a
                    key={s.id}
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    title={s.url}
                    className="block text-blue-500 dark:text-blue-400 hover:underline truncate"
                  >
                    {s.name || getHostname(s.url)}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
        {children}
      </main>
    </div>
  )
}

function NavLink({ item, active }: { item: { href: string; label: string; icon: string }; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
        active
          ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium'
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
      }`}
    >
      <span className="text-base w-5 text-center">{item.icon}</span>
      {item.label}
    </Link>
  )
}
