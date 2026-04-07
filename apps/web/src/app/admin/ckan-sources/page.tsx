'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/apiClient'

interface OrgItem { id: string; name: string }
interface OrgData {
  ministries:  OrgItem[]
  departments: (OrgItem & { ministryId: string })[]
  divisions:   (OrgItem & { departmentId: string })[]
}
interface SourceItem {
  id: string; name: string; url: string; isActive: boolean; createdAt: string
  ministry: OrgItem | null; department: OrgItem | null; division: OrgItem | null
}

const EMPTY_FORM = {
  name: '', url: '', apiKey: '', isActive: true,
  ministryId: '', departmentId: '', divisionId: '',
}

export default function AdminCkanSourcesPage() {
  const [sources,  setSources]  = useState<SourceItem[]>([])
  const [orgData,  setOrgData]  = useState<OrgData>({ ministries: [], departments: [], divisions: [] })
  const [loading,  setLoading]  = useState(true)
  const [modal,    setModal]    = useState<'none' | 'create' | 'edit'>('none')
  const [selected, setSelected] = useState<SourceItem | null>(null)
  const [form,     setForm]     = useState({ ...EMPTY_FORM })
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)

  async function loadSources() {
    setLoading(true)
    const r = await apiFetch('/api/admin/ckan-sources')
    if (r.ok) { const d = await r.json(); setSources(d.sources) }
    setLoading(false)
  }

  async function loadOrg() {
    const r = await apiFetch('/api/admin/org')
    if (r.ok) { const d = await r.json(); setOrgData(d) }
  }

  useEffect(() => { loadSources(); loadOrg() }, [])

  function openCreate() {
    setForm({ ...EMPTY_FORM }); setSelected(null); setError(''); setModal('create')
  }

  function openEdit(s: SourceItem) {
    setForm({
      name: s.name, url: s.url, apiKey: '', isActive: s.isActive,
      ministryId:   s.ministry?.id   || '',
      departmentId: s.department?.id || '',
      divisionId:   s.division?.id   || '',
    })
    setSelected(s); setError(''); setModal('edit')
  }

  async function handleSubmit() {
    setSaving(true); setError('')
    const body: Record<string, unknown> = {
      name: form.name, url: form.url, isActive: form.isActive,
      ministryId:   form.ministryId   || null,
      departmentId: form.departmentId || null,
      divisionId:   form.divisionId   || null,
    }
    if (form.apiKey) body.apiKey = form.apiKey

    let r: Response
    if (modal === 'create') {
      r = await apiFetch('/api/admin/ckan-sources', { method: 'POST', body: JSON.stringify(body) })
    } else {
      r = await apiFetch(`/api/admin/ckan-sources/${selected!.id}`, { method: 'PATCH', body: JSON.stringify(body) })
    }

    const d = await r.json()
    if (r.ok) { setModal('none'); loadSources() }
    else setError(d.error || 'เกิดข้อผิดพลาด')
    setSaving(false)
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`ต้องการลบ "${name}"?`)) return
    setDeleting(id)
    const r = await apiFetch(`/api/admin/ckan-sources/${id}`, { method: 'DELETE' })
    const d = await r.json()
    if (r.ok) setSources(s => s.filter(x => x.id !== id))
    else alert(d.error || 'ลบไม่ได้')
    setDeleting(null)
  }

  const filteredDepts = orgData.departments.filter(d => !form.ministryId  || d.ministryId   === form.ministryId)
  const filteredDivs  = orgData.divisions.filter(d  => !form.departmentId || d.departmentId === form.departmentId)

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">จัดการ CKAN Sources</h1>
        <button onClick={openCreate} className="btn-primary text-sm">+ เพิ่ม Source</button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">ชื่อ</th>
              <th className="px-4 py-3 text-left">URL</th>
              <th className="px-4 py-3 text-left">ขอบเขต</th>
              <th className="px-4 py-3 text-center">สถานะ</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">กำลังโหลด...</td></tr>}
            {!loading && sources.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">ไม่พบ CKAN source</td></tr>}
            {sources.map(s => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800">{s.name}</td>
                <td className="px-4 py-3 text-gray-500 text-xs truncate max-w-xs">
                  <a href={s.url} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">{s.url}</a>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {s.division?.name || s.department?.name || s.ministry?.name || 'ทั้งระบบ'}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block w-2 h-2 rounded-full ${s.isActive ? 'bg-green-400' : 'bg-gray-300'}`} />
                </td>
                <td className="px-4 py-3 text-right space-x-3">
                  <button onClick={() => openEdit(s)} className="text-xs text-blue-600 hover:underline">แก้ไข</button>
                  <button
                    onClick={() => handleDelete(s.id, s.name)}
                    disabled={deleting === s.id}
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h2 className="text-base font-semibold mb-5">
              {modal === 'create' ? 'เพิ่ม CKAN Source ใหม่' : `แก้ไข: ${selected?.name}`}
            </h2>
            <div className="space-y-3">
              <FormField label="ชื่อ *">
                <input className="input-field" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </FormField>
              <FormField label="URL *">
                <input type="url" className="input-field" value={form.url}
                  onChange={e => setForm(f => ({ ...f, url: e.target.value }))} />
              </FormField>
              <FormField label="API Key">
                <input className="input-field" placeholder="เว้นว่างถ้าไม่มี" value={form.apiKey}
                  onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))} />
              </FormField>
              <FormField label="กระทรวง">
                <select className="input-field" value={form.ministryId}
                  onChange={e => setForm(f => ({ ...f, ministryId: e.target.value, departmentId: '', divisionId: '' }))}>
                  <option value="">— ทั้งระบบ —</option>
                  {orgData.ministries.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </FormField>
              <FormField label="กรม">
                <select className="input-field" value={form.departmentId}
                  onChange={e => setForm(f => ({ ...f, departmentId: e.target.value, divisionId: '' }))}>
                  <option value="">— ทั้งระบบ —</option>
                  {filteredDepts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </FormField>
              <FormField label="ศูนย์/กอง">
                <select className="input-field" value={form.divisionId}
                  onChange={e => setForm(f => ({ ...f, divisionId: e.target.value }))}>
                  <option value="">— ทั้งระบบ —</option>
                  {filteredDivs.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </FormField>
              <FormField label="สถานะ">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={form.isActive}
                    onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />
                  เปิดใช้งาน
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
      <label className="text-xs text-gray-500 w-24 pt-2.5 shrink-0">{label}</label>
      <div className="flex-1">{children}</div>
    </div>
  )
}
