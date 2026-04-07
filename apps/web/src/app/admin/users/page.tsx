'use client'

import { useEffect, useState } from 'react'
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

export default function AdminUsersPage() {
  const [users,    setUsers]    = useState<UserItem[]>([])
  const [orgData,  setOrgData]  = useState<OrgData>({ ministries: [], departments: [], divisions: [], groups: [] })
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [modal,    setModal]    = useState<'none' | 'create' | 'edit'>('none')
  const [selected, setSelected] = useState<UserItem | null>(null)
  const [form,     setForm]     = useState({ ...EMPTY_FORM })
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)

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

    let r: Response
    if (modal === 'create') {
      body.username = form.username; body.password = form.password
      r = await apiFetch('/api/admin/users', { method: 'POST', body: JSON.stringify(body) })
    } else {
      if (form.password) body.password = form.password
      r = await apiFetch(`/api/admin/users/${selected!.id}`, { method: 'PATCH', body: JSON.stringify(body) })
    }

    const d = await r.json()
    if (r.ok) { setModal('none'); loadUsers() }
    else setError(d.error || 'เกิดข้อผิดพลาด')
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('ต้องการลบผู้ใช้นี้?')) return
    setDeleting(id)
    const r = await apiFetch(`/api/admin/users/${id}`, { method: 'DELETE' })
    const d = await r.json()
    if (r.ok) setUsers(u => u.filter(x => x.id !== id))
    else alert(d.error || 'ลบไม่ได้')
    setDeleting(null)
  }

  const filteredDepts = orgData.departments.filter(d => !form.ministryId   || d.ministryId   === form.ministryId)
  const filteredDivs  = orgData.divisions.filter(d  => !form.departmentId  || d.departmentId === form.departmentId)
  const filteredGrps  = orgData.groups.filter(g     => !form.divisionId    || g.divisionId   === form.divisionId)

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">จัดการผู้ใช้</h1>
        <button onClick={openCreate} className="btn-primary text-sm">+ สร้างผู้ใช้</button>
      </div>

      <div className="mb-4 flex gap-3">
        <input
          type="text" placeholder="ค้นหา username / email..."
          className="input-field w-64"
          value={search}
          onChange={e => { setSearch(e.target.value); loadUsers(e.target.value) }}
        />
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">Username</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">หน่วยงาน</th>
              <th className="px-4 py-3 text-center">สถานะ</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">กำลังโหลด...</td></tr>}
            {!loading && users.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">ไม่พบผู้ใช้</td></tr>}
            {users.map(u => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800">{u.username}</td>
                <td className="px-4 py-3 text-gray-500">{u.email || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                    u.role === 'admin'  ? 'bg-red-100 text-red-700' :
                    u.role === 'editor' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>{u.role}</span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {u.division?.name || u.department?.name || u.ministry?.name || '—'}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block w-2 h-2 rounded-full ${u.isActive ? 'bg-green-400' : 'bg-gray-300'}`} />
                </td>
                <td className="px-4 py-3 text-right space-x-3">
                  <button onClick={() => openEdit(u)} className="text-xs text-blue-600 hover:underline">แก้ไข</button>
                  <button
                    onClick={() => handleDelete(u.id)}
                    disabled={deleting === u.id}
                    className="text-xs text-red-500 hover:underline disabled:opacity-40"
                  >ลบ</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modal !== 'none' && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-base font-semibold mb-5">
              {modal === 'create' ? 'สร้างผู้ใช้ใหม่' : `แก้ไข: ${selected?.username}`}
            </h2>
            <div className="space-y-3">
              {modal === 'create' && (
                <FormField label="Username *">
                  <input className="input-field" value={form.username}
                    onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
                </FormField>
              )}
              <FormField label="Email">
                <input type="email" className="input-field" value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </FormField>
              <FormField label={modal === 'create' ? 'Password *' : 'Password ใหม่'}>
                <input type="password" className="input-field" value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
              </FormField>
              <FormField label="Role">
                <select className="input-field" value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                </select>
              </FormField>
              <FormField label="กระทรวง">
                <select className="input-field" value={form.ministryId}
                  onChange={e => setForm(f => ({ ...f, ministryId: e.target.value, departmentId: '', divisionId: '', groupId: '' }))}>
                  <option value="">— ไม่ระบุ —</option>
                  {orgData.ministries.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </FormField>
              <FormField label="กรม">
                <select className="input-field" value={form.departmentId}
                  onChange={e => setForm(f => ({ ...f, departmentId: e.target.value, divisionId: '', groupId: '' }))}>
                  <option value="">— ไม่ระบุ —</option>
                  {filteredDepts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </FormField>
              <FormField label="ศูนย์/กอง">
                <select className="input-field" value={form.divisionId}
                  onChange={e => setForm(f => ({ ...f, divisionId: e.target.value, groupId: '' }))}>
                  <option value="">— ไม่ระบุ —</option>
                  {filteredDivs.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </FormField>
              <FormField label="กลุ่ม">
                <select className="input-field" value={form.groupId}
                  onChange={e => setForm(f => ({ ...f, groupId: e.target.value }))}>
                  <option value="">— ไม่ระบุ —</option>
                  {filteredGrps.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </FormField>
              <FormField label="สถานะ">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={form.isActive}
                    onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />
                  ใช้งานอยู่
                </label>
              </FormField>
            </div>
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setModal('none')} className="btn-secondary text-sm">ยกเลิก</button>
              <button onClick={handleSubmit} disabled={saving} className="btn-primary text-sm">
                {saving ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <label className="text-xs text-gray-500 w-28 pt-2.5 shrink-0">{label}</label>
      <div className="flex-1">{children}</div>
    </div>
  )
}
