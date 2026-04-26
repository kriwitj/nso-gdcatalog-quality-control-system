'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { apiFetch } from '@/lib/apiClient'

const NAV = [
  { href: '/dashboard', label: 'ภาพรวม',     icon: <IconGrid /> },
  { href: '/datasets',  label: 'ชุดข้อมูล',  icon: <IconDatabase /> },
  { href: '/jobs',      label: 'งานตรวจสอบ', icon: <IconClipboard /> },
]

const ADMIN_NAV = [
  { href: '/admin/org',          label: 'โครงสร้างองค์กร', icon: <IconBuilding /> },
  { href: '/admin/ckan-sources', label: 'CKAN Sources',     icon: <IconLink /> },
  { href: '/admin/users',        label: 'ผู้ใช้',           icon: <IconUsers /> },
  { href: '/admin/audit',        label: 'Audit Log',        icon: <IconAudit /> },
]

interface UserInfo {
  id: string; username: string; email?: string; role: string
  division?: { id: string; name: string } | null
}
interface SourceInfo { id: string; name: string; url: string }

function getHostname(url: string) {
  try { return new URL(url).hostname } catch { return url }
}

export default function PortalShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()
  const [user,       setUser]       = useState<UserInfo | null>(null)
  const [sources,    setSources]    = useState<SourceInfo[]>([])
  const [activeJobs, setActiveJobs] = useState(0)
  const [collapsed,  setCollapsed]  = useState(false)
  const [userMenu,   setUserMenu]   = useState(false)
  const [srcMenu,    setSrcMenu]    = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const srcMenuRef  = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    async function checkJobs() {
      try {
        const r = await apiFetch('/api/jobs')
        if (!r.ok) return
        const { data } = await r.json()
        const count = (data as { status: string }[]).filter(
          j => j.status === 'running' || j.status === 'pending'
        ).length
        setActiveJobs(count)
      } catch { /* ignore */ }
    }
    checkJobs()
    const iv = setInterval(checkJobs, 8000)
    return () => clearInterval(iv)
  }, [])

  // close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenu(false)
      if (srcMenuRef.current  && !srcMenuRef.current.contains(e.target as Node))  setSrcMenu(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    localStorage.removeItem('access_token')
    localStorage.removeItem('user')
    router.push('/login')
  }

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/')

  const roleLabel: Record<string, string> = { admin: 'ผู้ดูแลระบบ', editor: 'บรรณาธิการ', viewer: 'ผู้ดู' }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-950">

      {/* ── TOP NAVBAR ── */}
      <header className="shrink-0 h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center px-4 gap-3 z-30 shadow-sm">

        {/* Sidebar toggle */}
        <button
          onClick={() => setCollapsed(v => !v)}
          title={collapsed ? 'ขยายเมนู' : 'ย่อเมนู'}
          className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-150"
        >
          {collapsed
            ? <IconMenuOpen />
            : <IconMenuClose />
          }
        </button>

        {/* Brand */}
        <Link href="/" className="flex items-center gap-2 mr-auto">
          <span className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white text-sm font-bold shrink-0">G</span>
          <span className="hidden sm:block text-sm font-semibold text-gray-800 dark:text-gray-100 leading-tight">
            GDCatalog <span className="text-blue-600 dark:text-blue-400">Quality</span>
          </span>
        </Link>

        {/* Active jobs badge */}
        {activeJobs > 0 && (
          <Link
            href="/jobs"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-xs font-medium border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition-colors"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            ประมวลผล {activeJobs} งาน
          </Link>
        )}

        {/* Data sources dropdown */}
        {sources.length > 0 && (
          <div ref={srcMenuRef} className="relative">
            <button
              onClick={() => setSrcMenu(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <IconLink className="w-4 h-4" />
              <span className="hidden md:inline">แหล่งข้อมูล</span>
              <IconChevron className={`w-3.5 h-3.5 transition-transform duration-200 ${srcMenu ? 'rotate-180' : ''}`} />
            </button>
            {srcMenu && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-2 z-50">
                <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  CKAN Sources
                </div>
                {sources.map(s => (
                  <a
                    key={s.id}
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                    <span className="flex-1 min-w-0">
                      <span className="block font-medium truncate">{s.name || getHostname(s.url)}</span>
                      <span className="block text-xs text-gray-400 truncate">{getHostname(s.url)}</span>
                    </span>
                    <IconExternal className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {/* User dropdown */}
        {user && (
          <div ref={userMenuRef} className="relative">
            <button
              onClick={() => setUserMenu(v => !v)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-xs font-bold uppercase shrink-0">
                {user.username[0]}
              </div>
              <div className="hidden md:block text-left">
                <div className="text-xs font-semibold text-gray-800 dark:text-gray-100 leading-tight">{user.username}</div>
                <div className="text-xs text-gray-400 dark:text-gray-500">{roleLabel[user.role] ?? user.role}</div>
              </div>
              <IconChevron className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${userMenu ? 'rotate-180' : ''}`} />
            </button>

            {userMenu && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-2 z-50">
                <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800 mb-1">
                  <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">{user.username}</div>
                  {user.email && <div className="text-xs text-gray-400 truncate">{user.email}</div>}
                  {user.division?.name && (
                    <div className="text-xs text-gray-400 mt-0.5 truncate" title={user.division.name}>
                      {user.division.name}
                    </div>
                  )}
                  <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-medium border border-blue-200 dark:border-blue-800">
                    {roleLabel[user.role] ?? user.role}
                  </span>
                </div>
                <Link
                  href="/settings"
                  onClick={() => setUserMenu(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <IconSettings className="w-4 h-4 text-gray-400" />
                  ตั้งค่าบัญชี
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                >
                  <IconLogout className="w-4 h-4" />
                  ออกจากระบบ
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      {/* Active jobs banner (mobile / full-width) */}
      {activeJobs > 0 && (
        <div className="sm:hidden shrink-0 bg-blue-600 text-white text-xs py-2 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            ประมวลผลอยู่ <strong>{activeJobs} งาน</strong>
          </div>
          <Link href="/jobs" className="underline font-medium">ดูรายละเอียด →</Link>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">

        {/* ── SIDEBAR ── */}
        <aside
          className={`shrink-0 h-full flex flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-all duration-300 overflow-hidden ${
            collapsed ? 'w-16' : 'w-60'
          }`}
        >
          {/* Nav */}
          <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
            <NavSection label="เมนูหลัก" collapsed={collapsed} />
            {NAV.map(item => (
              <NavLink key={item.href} item={item} active={isActive(item.href)} collapsed={collapsed} />
            ))}

            {user?.role === 'admin' && (
              <>
                <NavSection label="Admin" collapsed={collapsed} />
                {ADMIN_NAV.map(item => (
                  <NavLink key={item.href} item={item} active={isActive(item.href)} collapsed={collapsed} />
                ))}
              </>
            )}
          </nav>
        </aside>

        {/* ── MAIN ── */}
        <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-950">
          {children}
        </main>
      </div>
    </div>
  )
}

/* ─── Sub-components ─── */

function NavSection({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) {
    return <div className="my-2 mx-auto w-6 border-t border-gray-200 dark:border-gray-700" />
  }
  return (
    <div className="px-3 pt-3 pb-1">
      <span className="text-[10px] font-bold text-gray-400 dark:text-gray-600 uppercase tracking-widest">{label}</span>
    </div>
  )
}

function NavLink({
  item,
  active,
  collapsed,
}: {
  item: { href: string; label: string; icon: ReactNode }
  active: boolean
  collapsed: boolean
}) {
  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      className={`group flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-150 ${
        collapsed ? 'px-0 py-2.5 justify-center mx-1' : 'px-3 py-2.5 mx-0'
      } ${
        active
          ? 'bg-blue-600 text-white shadow-sm shadow-blue-200 dark:shadow-none'
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
      }`}
    >
      <span className={`shrink-0 transition-transform duration-150 ${active ? '' : 'group-hover:scale-110'}`}>
        {item.icon}
      </span>
      {!collapsed && <span className="truncate">{item.label}</span>}
      {!collapsed && active && (
        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white/60" />
      )}
    </Link>
  )
}

/* ─── SVG Icons ─── */

function IconGrid() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  )
}
function IconDatabase() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <ellipse cx="12" cy="6" rx="8" ry="3" />
      <path d="M4 6v4c0 1.66 3.58 3 8 3s8-1.34 8-3V6" />
      <path d="M4 10v4c0 1.66 3.58 3 8 3s8-1.34 8-3v-4" />
    </svg>
  )
}
function IconClipboard() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="M9 12h6M9 16h4" />
    </svg>
  )
}
function IconBuilding() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M3 21h18M6 21V7l6-4 6 4v14" />
      <path d="M9 21v-4h6v4M9 11h.01M12 11h.01M15 11h.01M9 15h.01M15 15h.01" />
    </svg>
  )
}
function IconLink({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  )
}
function IconUsers() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="9" cy="7" r="4" />
      <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75M21 21v-2a4 4 0 0 0-3-3.85" />
    </svg>
  )
}
function IconAudit() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  )
}
function IconMenuOpen() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  )
}
function IconMenuClose() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="15" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  )
}
function IconChevron({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}
function IconSettings({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}
function IconLogout({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}
function IconExternal({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  )
}
