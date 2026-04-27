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
  { href: '/admin', label: 'จัดการระบบ', icon: <IconCog /> },
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

  const [syncing,  setSyncing]  = useState(false)
  const [scanning, setScanning] = useState(false)
  const [toast,    setToast]    = useState<{ msg: string; ok: boolean } | null>(null)

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

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenu(false)
      if (srcMenuRef.current  && !srcMenuRef.current.contains(e.target as Node))  setSrcMenu(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  async function handleSync() {
    if (!confirm('ยืนยันการซิงค์ข้อมูลจาก CKAN?')) return
    setSyncing(true)
    try {
      const r = await apiFetch('/api/sync', { method: 'POST' })
      const d = await r.json()
      showToast(r.ok ? (d.message || 'เริ่มซิงค์แล้ว') : (d.error || 'เกิดข้อผิดพลาด'), r.ok)
    } catch { showToast('ไม่สามารถเชื่อมต่อได้', false) }
    setSyncing(false)
  }

  async function handleScan() {
    if (!confirm('ยืนยันการเริ่มตรวจสอบคุณภาพข้อมูลทั้งหมด?')) return
    setScanning(true)
    try {
      const r = await apiFetch('/api/scan', { method: 'POST' })
      const d = await r.json()
      showToast(r.ok ? (d.message || 'เริ่มตรวจสอบแล้ว') : (d.error || 'เกิดข้อผิดพลาด'), r.ok)
    } catch { showToast('ไม่สามารถเชื่อมต่อได้', false) }
    setScanning(false)
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    localStorage.removeItem('access_token')
    localStorage.removeItem('user')
    router.push('/login')
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')
  const roleLabel: Record<string, string> = { admin: 'ผู้ดูแลระบบ', editor: 'บรรณาธิการ', viewer: 'ผู้ดู' }
  const isManager = user?.role === 'admin' || user?.role === 'editor'
  const isBusy = syncing || scanning

  const PAGE_TITLES: [string, string][] = [
    ['/dashboard', 'ภาพรวมระบบ'],
    ['/datasets',  'ชุดข้อมูล'],
    ['/jobs',      'งานตรวจสอบ'],
    ['/admin',     'จัดการระบบ'],
    ['/settings',  'ตั้งค่าบัญชี'],
  ]
  const pageTitle = PAGE_TITLES.find(([prefix]) => pathname.startsWith(prefix))?.[1] ?? 'GDCatalog QC'

  return (
    <div className="h-screen flex overflow-hidden" style={{ background: 'var(--bg-page)' }}>

      {/* ── SIDEBAR ── */}
      <aside
        className={`shrink-0 h-full flex flex-col transition-all duration-300 overflow-hidden ${collapsed ? 'w-[64px]' : 'w-[240px]'}`}
        style={{ background: '#1B3A6B' }}
      >
        {/* Sidebar logo */}
        <Link href="/" className="flex items-center gap-2.5 no-underline shrink-0 px-3 h-[60px]"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="w-[36px] h-[36px] rounded-[9px] flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg,#0F2349,#3B82F6)' }}>
            <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
            </svg>
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-none min-w-0">
              <strong className="text-[14px] font-bold truncate" style={{ color: '#fff' }}>GDCatalog QC</strong>
              <span className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.45)' }}>ระบบตรวจคุณภาพข้อมูลภาครัฐ</span>
            </div>
          )}
        </Link>

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

        {/* Collapse button */}
        <button
          onClick={() => setCollapsed(v => !v)}
          title={collapsed ? 'ขยายเมนู' : 'ย่อเมนู'}
          className={`shrink-0 flex items-center gap-2 w-full transition-colors ${collapsed ? 'justify-center px-0 py-3' : 'px-4 py-3'}`}
          style={{ borderTop: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.8)'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.4)'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
        >
          {collapsed ? <IconCollapseRight /> : (
            <>
              <IconCollapseLeft />
              <span className="text-[12px] font-medium">ย่อเมนู</span>
            </>
          )}
        </button>
      </aside>

      {/* ── RIGHT COLUMN ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* MAIN HEADER */}
        <header
          className="shrink-0 h-[60px] flex items-center px-6 gap-3 z-30"
          style={{
            background: 'var(--bg-surface)',
            borderBottom: '1px solid var(--border-color)',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          }}
        >
          {/* Page title */}
          <h1 className="text-[17px] font-semibold flex-1 min-w-0 truncate" style={{ color: 'var(--text-primary)' }}>
            {pageTitle}
          </h1>

          {/* Active jobs badge */}
          {activeJobs > 0 && (
            <Link href="/jobs" className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border no-underline"
              style={{ background: '#EFF6FF', color: '#1D4ED8', borderColor: '#BFDBFE' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              ประมวลผล {activeJobs} งาน
            </Link>
          )}

          {/* ซิงค์ข้อมูล + ตรวจสอบคุณภาพ */}
          {isManager && (
            <>
              <button
                onClick={handleSync}
                disabled={isBusy}
                className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'var(--btn-secondary-bg)', color: 'var(--btn-secondary-text)', borderColor: 'var(--btn-secondary-border)' }}
                onMouseEnter={e => { if (!(e.currentTarget as HTMLButtonElement).disabled) (e.currentTarget as HTMLButtonElement).style.background = 'var(--btn-secondary-hover)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--btn-secondary-bg)' }}
              >
                <IconSync className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                <span>{syncing ? 'กำลังซิงค์...' : 'ซิงค์ข้อมูล'}</span>
              </button>
              <button
                onClick={handleScan}
                disabled={isBusy}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: '#3B82F6' }}
                onMouseEnter={e => { if (!(e.currentTarget as HTMLButtonElement).disabled) (e.currentTarget as HTMLButtonElement).style.background = '#2563EB' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#3B82F6' }}
              >
                <IconScan className="w-4 h-4" style={{ color: '#fff' }} />
                <span className="hidden sm:inline">{scanning ? 'กำลังตรวจสอบ...' : 'ตรวจสอบคุณภาพ'}</span>
              </button>
            </>
          )}

          {/* Data sources dropdown */}
          {sources.length > 0 && (
            <div ref={srcMenuRef} className="relative">
              <button
                onClick={() => setSrcMenu(v => !v)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-hover)'}
                onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
              >
                <IconLink className="w-4 h-4" />
                <span className="hidden md:inline text-[13px] font-medium">แหล่งข้อมูล</span>
                <IconChevron className={`w-3.5 h-3.5 transition-transform duration-200 ${srcMenu ? 'rotate-180' : ''}`} />
              </button>
              {srcMenu && (
                <div className="absolute right-0 top-full mt-2 w-64 rounded-xl shadow-lg border py-2 z-50 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>CKAN Sources</div>
                  {sources.map(s => (
                    <a key={s.id} href={s.url} target="_blank" rel="noreferrer"
                      className="flex items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 no-underline"
                      style={{ color: 'var(--text-primary)' }}>
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                      <span className="flex-1 min-w-0">
                        <span className="block font-medium truncate text-xs">{s.name || getHostname(s.url)}</span>
                        <span className="block text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{getHostname(s.url)}</span>
                      </span>
                      <IconExternal className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--text-muted)' }} />
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* User dropdown */}
          {user && (
            <div ref={userMenuRef} className="relative">
              <button onClick={() => setUserMenu(v => !v)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors"
                onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-hover)'}
                onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold uppercase shrink-0"
                  style={{ background: 'linear-gradient(135deg,#3B82F6,#1D4ED8)' }}>
                  {user.username[0]}
                </div>
                <div className="hidden md:block text-left">
                  <div className="text-[13px] font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>{user.username}</div>
                  <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{roleLabel[user.role] ?? user.role}</div>
                </div>
                <IconChevron className={`w-3.5 h-3.5 transition-transform duration-200 ${userMenu ? 'rotate-180' : ''}`} style={{ color: 'var(--text-muted)' }} />
              </button>

              {userMenu && (
                <div className="absolute right-0 top-full mt-2 w-56 rounded-xl shadow-lg border py-2 z-50 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                  <div className="px-3 py-2 mb-1" style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{user.username}</div>
                    {user.email && <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{user.email}</div>}
                    {user.division?.name && (
                      <div className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }} title={user.division.name}>{user.division.name}</div>
                    )}
                    <span className="inline-block mt-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border"
                      style={{ background: '#EFF6FF', color: '#1D4ED8', borderColor: '#BFDBFE' }}>
                      {roleLabel[user.role] ?? user.role}
                    </span>
                  </div>
                  <Link href="/settings" onClick={() => setUserMenu(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 no-underline"
                    style={{ color: 'var(--text-primary)' }}>
                    <IconSettings className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                    ตั้งค่าบัญชี
                  </Link>
                  <button onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
                    style={{ color: '#DC2626' }}>
                    <IconLogout className="w-4 h-4" />
                    ออกจากระบบ
                  </button>
                </div>
              )}
            </div>
          )}
        </header>

        {/* Active jobs banner (mobile) */}
        {activeJobs > 0 && (
          <div className="sm:hidden shrink-0 text-white text-xs py-2 px-4 flex items-center justify-between"
            style={{ background: '#1D4ED8' }}>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              ประมวลผลอยู่ <strong>{activeJobs} งาน</strong>
            </div>
            <Link href="/jobs" className="font-medium text-white no-underline">ดูรายละเอียด →</Link>
          </div>
        )}

        {/* ── MAIN CONTENT ── */}
        <main className="flex-1 overflow-y-auto" style={{ background: 'var(--bg-page)' }}>
          <div key={pathname} style={{ animation: 'pageIn 0.22s ease both' }}>
            {children}
          </div>
        </main>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg text-sm font-medium text-white"
          style={{ background: toast.ok ? '#10B981' : '#EF4444', animation: 'slideIn .3s ease' }}
        >
          {toast.ok ? '✓' : '✕'} {toast.msg}
        </div>
      )}
    </div>
  )
}

/* ─── Sub-components ─── */

function NavSection({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) {
    return <div className="my-2 mx-auto w-6 border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }} />
  }
  return (
    <div className="px-3 pt-4 pb-1">
      <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</span>
    </div>
  )
}

function NavLink({
  item, active, collapsed,
}: {
  item: { href: string; label: string; icon: ReactNode }
  active: boolean
  collapsed: boolean
}) {
  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      className={`group flex items-center gap-3 rounded-lg text-[13px] font-medium transition-all duration-150 no-underline ${
        collapsed ? 'px-0 py-2.5 justify-center mx-1' : 'px-3 py-2.5 mx-0'
      }`}
      style={active
        ? { background: '#3B82F6', color: '#fff', boxShadow: '0 2px 8px rgba(59,130,246,0.35)' }
        : { color: 'rgba(255,255,255,0.6)' }
      }
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.1)'; if (!active) (e.currentTarget as HTMLAnchorElement).style.color = '#fff' }}
      onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.6)' } }}
    >
      <span className={`shrink-0 transition-transform duration-150 ${active ? '' : 'group-hover:scale-110'}`}>
        {item.icon}
      </span>
      {!collapsed && <span className="truncate">{item.label}</span>}
      {!collapsed && active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white/60" />}
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
function IconLink({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  )
}
function IconCollapseLeft() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <polyline points="11 17 6 12 11 7" /><polyline points="18 17 13 12 18 7" />
    </svg>
  )
}
function IconCollapseRight() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <polyline points="13 17 18 12 13 7" /><polyline points="6 17 11 12 6 7" />
    </svg>
  )
}
function IconChevron({ className = 'w-4 h-4', style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}
function IconSettings({ className = 'w-4 h-4', style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
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
function IconExternal({ className = 'w-4 h-4', style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  )
}
function IconCog() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}
function IconSync({ className = 'w-4 h-4', style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  )
}
function IconScan({ className = 'w-4 h-4', style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}
