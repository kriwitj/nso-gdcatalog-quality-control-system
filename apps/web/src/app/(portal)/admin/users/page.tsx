'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { apiFetch } from '@/lib/apiClient'

interface OrgItem { id: string; name: string }
interface OrgData {
  ministries:  OrgItem[]
  departments: (OrgItem & { ministryId: string })[]
  divisions:   (OrgItem & { departmentId: string })[]
  groups:      (OrgItem & { divisionId: string })[]
}
interface UserItem {
  id: string; username: string; email: string | null
  role: string; isActive: boolean; createdAt: string
  ministry: OrgItem | null; department: OrgItem | null
  division: OrgItem | null; group: OrgItem | null
}

const EMPTY_FORM = {
  username: '', email: '', password: '', role: 'viewer', isActive: true,
  ministryId: '', departmentId: '', divisionId: '', groupId: '',
}

const ROLE_STYLE: Record<string, string> = {
  admin:  'text-white border-transparent',
  editor: 'text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-300 dark:bg-blue-900/30 dark:border-blue-700',
  viewer: 'text-gray-500 bg-transparent border-transparent dark:text-gray-400',
}

const ROLE_BG: Record<string, string> = {
  admin:  '#1B3A6B',
  editor: '',
  viewer: '',
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'admin', editor: 'editor', viewer: 'viewer',
}

function formatThaiDate(dateStr: string) {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '—'
  const thYear = d.getFullYear() + 543
  const day    = d.getDate()
  const month  = d.getMonth() + 1
  const hh     = String(d.getHours()).padStart(2, '0')
  const mm     = String(d.getMinutes()).padStart(2, '0')
  const ss     = String(d.getSeconds()).padStart(2, '0')
  return `${day}/${month}/${thYear} ${hh}:${mm}:${ss}`
}

function Avatar({ name, role }: { name: string; role: string }) {
  const bg =
    role === 'admin'  ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300' :
    role === 'editor' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' :
    'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold uppercase shrink-0 ${bg}`}>
      {name[0]}
    </div>
  )
}

export default function AdminUsersPage() {
  const [users,      setUsers]      = useState<UserItem[]>([])
  const [orgData,    setOrgData]    = useState<OrgData>({ ministries: [], departments: [], divisions: [], groups: [] })
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [modal,      setModal]      = useState<'none' | 'create' | 'edit'>('none')
  const [selected,   setSelected]   = useState<UserItem | null>(null)
  const [form,       setForm]       = useState({ ...EMPTY_FORM })
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')
  const [deleting,   setDeleting]   = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState<UserItem | null>(null)

  async function loadUsers(q = search) {
    setLoading(true)
    const r = await apiFetch(`/api/admin/users?search=${encodeURIComponent(q)}`)
    if (r.ok) { const d = await r.json(); setUsers(d.users) }
    setLoading(false)
  }

  async function loadOrg() {
    const r = await apiFetch('/api/admin/org')
    if (r.ok) { const d = await r.json(); setOrgData(d) }
  }

  useEffect(() => { loadUsers(); loadOrg() }, [])

  function openCreate() {
    setForm({ ...EMPTY_FORM }); setSelected(null); setError(''); setModal('create')
  }

  function openEdit(u: UserItem) {
    setForm({
      username: u.username, email: u.email || '', password: '', role: u.role,
      isActive: u.isActive,
      ministryId:   u.ministry?.id   || '',
      departmentId: u.department?.id || '',
      divisionId:   u.division?.id   || '',
      groupId:      u.group?.id      || '',
    })
    setSelected(u); setError(''); setModal('edit')
  }

  async function handleSubmit() {
    if (modal === 'create' && (!form.username.trim() || !form.password)) {
      setError('กรุณากรอก Username และ Password')
      return
    }
    setSaving(true); setError('')
    const body: Record<string, unknown> = {
      email:    form.email     || null,
      role:     form.role,
      isActive: form.isActive,
      ministryId:   form.ministryId   || null,
      departmentId: form.departmentId || null,
      divisionId:   form.divisionId   || null,
      groupId:      form.groupId      || null,
    }
    if (modal === 'create') {
      body.username = form.username.trim()
      body.password = form.password
    } else if (form.password) {
      body.password = form.password
    }

    const r = modal === 'create'
      ? await apiFetch('/api/admin/users', { method: 'POST', body: JSON.stringify(body) })
      : await apiFetch(`/api/admin/users/${selected!.id}`, { method: 'PATCH', body: JSON.stringify(body) })

    const d = await r.json()
    if (r.ok) { setModal('none'); loadUsers() }
    else setError(d.error || 'เกิดข้อผิดพลาด')
    setSaving(false)
  }

  async function handleDelete() {
    if (!confirmDel) return
    setDeleting(confirmDel.id)
    setConfirmDel(null)
    const r = await apiFetch(`/api/admin/users/${confirmDel.id}`, { method: 'DELETE' })
    const d = await r.json()
    if (r.ok) setUsers(u => u.filter(x => x.id !== confirmDel.id))
    else setError(d.error || 'ลบไม่ได้')
    setDeleting(null)
  }

  const filteredDepts = orgData.departments.filter(d => !form.ministryId  || d.ministryId   === form.ministryId)
  const filteredDivs  = orgData.divisions.filter(d  => !form.departmentId || d.departmentId === form.departmentId)
  const filteredGrps  = orgData.groups.filter(g     => !form.divisionId   || g.divisionId   === form.divisionId)

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold" style={{ color: '#111827' }}>
          {loading ? 'ผู้ใช้งานทั้งหมด' : `ผู้ใช้งานทั้งหมด (${users.length})`}
        </h2>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all"
          style={{ background: '#1B3A6B' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#0F2349' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#1B3A6B' }}
        >
          + เพิ่มผู้ใช้งาน
        </button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="🔍  ค้นหา username หรือ email..."
          className="input-field w-72"
          value={search}
          onChange={e => { setSearch(e.target.value); loadUsers(e.target.value) }}
        />
      </div>

      {error && !modal && (
        <div className="mb-4 p-3 rounded-lg text-sm border bg-red-50 border-red-200 text-red-700 dark:bg-red-900/30 dark:border-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              <th className="px-4 py-3 text-left font-medium">ชื่อผู้ใช้</th>
              <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">อีเมล</th>
              <th className="px-4 py-3 text-left font-medium">บทบาท</th>
              <th className="px-4 py-3 text-left font-medium hidden md:table-cell">เข้าใช้ล่าสุด</th>
              <th className="px-4 py-3 text-center font-medium">สถานะ</th>
              <th className="px-4 py-3 text-right font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {loading && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400 dark:text-gray-500">
                <span className="inline-block animate-pulse">กำลังโหลด...</span>
              </td></tr>
            )}
            {!loading && users.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-12 text-center">
                <div className="text-3xl mb-2">👤</div>
                <div className="text-gray-500 dark:text-gray-400 text-sm">ไม่พบผู้ใช้</div>
                {search && <div className="text-gray-400 dark:text-gray-500 text-xs mt-1">ลองค้นหาด้วยคำอื่น</div>}
              </td></tr>
            )}
            {users.map(u => (
              <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={u.username} role={u.role} />
                    <div>
                      <div className="font-medium text-gray-800 dark:text-gray-100 leading-tight">{u.username}</div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 sm:hidden">{u.email || '—'}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs hidden sm:table-cell">
                  {u.email || <span className="text-gray-300 dark:text-gray-600">—</span>}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`badge text-xs ${ROLE_STYLE[u.role] || ROLE_STYLE.viewer}`}
                    style={ROLE_BG[u.role] ? { background: ROLE_BG[u.role] } : undefined}
                  >
                    {ROLE_LABEL[u.role] || u.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 hidden md:table-cell">
                  {formatThaiDate(u.createdAt)}
                </td>
                <td className="px-4 py-3 text-center">
                  {u.isActive ? (
                    <span className="badge text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-900/30 dark:border-emerald-700 text-xs">
                      ใช้งาน
                    </span>
                  ) : (
                    <span className="badge text-gray-500 bg-gray-100 border-gray-200 dark:text-gray-400 dark:bg-gray-700 dark:border-gray-600 text-xs">
                      ปิดใช้งาน
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => openEdit(u)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      แก้ไข
                    </button>
                    <button
                      onClick={() => setConfirmDel(u)}
                      disabled={deleting === u.id}
                      className="text-xs px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-800 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors disabled:opacity-40"
                    >
                      {deleting === u.id ? '...' : 'ลบ'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create / Edit Modal */}
      {modal !== 'none' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setModal('none')} />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                {modal === 'edit' && selected && <Avatar name={selected.username} role={selected.role} />}
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  {modal === 'create' ? '👤 สร้างผู้ใช้ใหม่' : `แก้ไข: ${selected?.username}`}
                </h2>
              </div>
              <button
                onClick={() => setModal('none')}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-lg leading-none"
              >×</button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4 overflow-y-auto">
              {/* Account section */}
              <SectionLabel>ข้อมูลบัญชี</SectionLabel>
              {modal === 'create' && (
                <FormField label="Username *">
                  <input
                    className="input-field"
                    placeholder="กำหนด username"
                    autoComplete="off"
                    value={form.username}
                    onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  />
                </FormField>
              )}
              <FormField label="Email">
                <input
                  type="email"
                  className="input-field"
                  placeholder="example@mail.com"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                />
              </FormField>
              <FormField label={modal === 'create' ? 'Password *' : 'Password ใหม่'}>
                <input
                  type="password"
                  className="input-field"
                  placeholder={modal === 'edit' ? 'เว้นว่างถ้าไม่ต้องการเปลี่ยน' : 'กำหนดรหัสผ่าน'}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                />
              </FormField>
              <FormField label="Role">
                <select
                  className="input-field"
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                >
                  <option value="viewer">👁 Viewer — ดูข้อมูลได้</option>
                  <option value="editor">✏️ Editor — แก้ไขได้</option>
                  <option value="admin">👑 Admin — จัดการทั้งหมด</option>
                </select>
              </FormField>
              <FormField label="สถานะ">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <div className="relative">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={form.isActive}
                      onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                    />
                    <div className="w-9 h-5 rounded-full bg-gray-200 dark:bg-gray-600 peer-checked:bg-blue-500 transition-colors" />
                    <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
                  </div>
                  <span className="text-sm text-gray-700 dark:text-gray-200">
                    {form.isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                  </span>
                </label>
              </FormField>

              {/* Org section */}
              <SectionLabel>ขอบเขตองค์กร</SectionLabel>
              <FormField label="กระทรวง">
                <select
                  className="input-field"
                  value={form.ministryId}
                  onChange={e => setForm(f => ({ ...f, ministryId: e.target.value, departmentId: '', divisionId: '', groupId: '' }))}
                >
                  <option value="">— ไม่ระบุ —</option>
                  {orgData.ministries.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </FormField>
              <FormField label="กรม">
                <select
                  className="input-field"
                  value={form.departmentId}
                  disabled={!form.ministryId}
                  onChange={e => setForm(f => ({ ...f, departmentId: e.target.value, divisionId: '', groupId: '' }))}
                >
                  <option value="">— ไม่ระบุ —</option>
                  {filteredDepts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </FormField>
              <FormField label="ศูนย์/กอง">
                <select
                  className="input-field"
                  value={form.divisionId}
                  disabled={!form.departmentId}
                  onChange={e => setForm(f => ({ ...f, divisionId: e.target.value, groupId: '' }))}
                >
                  <option value="">— ไม่ระบุ —</option>
                  {filteredDivs.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </FormField>
              <FormField label="กลุ่ม">
                <select
                  className="input-field"
                  value={form.groupId}
                  disabled={!form.divisionId}
                  onChange={e => setForm(f => ({ ...f, groupId: e.target.value }))}
                >
                  <option value="">— ไม่ระบุ —</option>
                  {filteredGrps.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </FormField>

              {error && (
                <div className="p-3 rounded-lg text-sm bg-red-50 border border-red-200 text-red-700 dark:bg-red-900/30 dark:border-red-700 dark:text-red-300">
                  {error}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3 bg-gray-50 dark:bg-gray-800/80 shrink-0">
              <button onClick={() => setModal('none')} className="btn-secondary text-sm">ยกเลิก</button>
              <button onClick={handleSubmit} disabled={saving} className="btn-primary text-sm min-w-[80px] justify-center">
                {saving ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    บันทึก...
                  </span>
                ) : 'บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setConfirmDel(null)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="text-center mb-4">
              <div className="flex justify-center mb-3">
                <Avatar name={confirmDel.username} role={confirmDel.role} />
              </div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">ยืนยันการลบผู้ใช้</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
                ต้องการลบ <span className="font-semibold text-gray-800 dark:text-gray-200">{confirmDel.username}</span> ใช่หรือไม่?
                <br />การกระทำนี้ไม่สามารถยกเลิกได้
              </p>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setConfirmDel(null)} className="btn-secondary text-sm flex-1 justify-center">
                ยกเลิก
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 text-sm px-4 py-2 rounded-lg font-medium bg-red-600 hover:bg-red-700 text-white transition-colors"
              >
                ลบผู้ใช้
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700 pb-1.5">
      {children}
    </div>
  )
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <label className="text-xs text-gray-500 dark:text-gray-400 w-28 pt-2.5 shrink-0 font-medium">{label}</label>
      <div className="flex-1">{children}</div>
    </div>
  )
}
