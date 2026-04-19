'use client'

import { useEffect, useState, type ReactNode } from 'react'
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
  const [sources,    setSources]    = useState<SourceItem[]>([])
  const [orgData,    setOrgData]    = useState<OrgData>({ ministries: [], departments: [], divisions: [] })
  const [loading,    setLoading]    = useState(true)
  const [modal,      setModal]      = useState<'none' | 'create' | 'edit'>('none')
  const [selected,   setSelected]   = useState<SourceItem | null>(null)
  const [form,       setForm]       = useState({ ...EMPTY_FORM })
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')
  const [deleting,   setDeleting]   = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState<SourceItem | null>(null)

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
    if (!form.name.trim() || !form.url.trim()) {
      setError('กรุณากรอกชื่อและ URL')
      return
    }
    setSaving(true); setError('')
    const body: Record<string, unknown> = {
      name: form.name.trim(), url: form.url.trim(), isActive: form.isActive,
      ministryId:   form.ministryId   || null,
      departmentId: form.departmentId || null,
      divisionId:   form.divisionId   || null,
    }
    if (form.apiKey) body.apiKey = form.apiKey

    const r = modal === 'create'
      ? await apiFetch('/api/admin/ckan-sources', { method: 'POST', body: JSON.stringify(body) })
      : await apiFetch(`/api/admin/ckan-sources/${selected!.id}`, { method: 'PATCH', body: JSON.stringify(body) })

    const d = await r.json()
    if (r.ok) { setModal('none'); loadSources() }
    else setError(d.error || 'เกิดข้อผิดพลาด')
    setSaving(false)
  }

  async function handleDelete() {
    if (!confirmDel) return
    setDeleting(confirmDel.id)
    setConfirmDel(null)
    const r = await apiFetch(`/api/admin/ckan-sources/${confirmDel.id}`, { method: 'DELETE' })
    const d = await r.json()
    if (r.ok) setSources(s => s.filter(x => x.id !== confirmDel.id))
    else setError(d.error || 'ลบไม่ได้')
    setDeleting(null)
  }

  const filteredDepts = orgData.departments.filter(d => !form.ministryId  || d.ministryId   === form.ministryId)
  const filteredDivs  = orgData.divisions.filter(d  => !form.departmentId || d.departmentId === form.departmentId)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">CKAN Sources</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">จัดการแหล่งข้อมูล CKAN สำหรับซิงค์</p>
        </div>
        <button onClick={openCreate} className="btn-primary text-sm gap-1.5">
          <span className="text-base leading-none">+</span> เพิ่ม Source
        </button>
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
              <th className="px-4 py-3 text-left font-medium">ชื่อ</th>
              <th className="px-4 py-3 text-left font-medium">URL</th>
              <th className="px-4 py-3 text-left font-medium hidden md:table-cell">ขอบเขต</th>
              <th className="px-4 py-3 text-center font-medium">สถานะ</th>
              <th className="px-4 py-3 text-right font-medium">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {loading && (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-400 dark:text-gray-500">
                <span className="inline-block animate-pulse">กำลังโหลด...</span>
              </td></tr>
            )}
            {!loading && sources.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-12 text-center">
                <div className="text-gray-400 dark:text-gray-500 text-3xl mb-2">🔗</div>
                <div className="text-gray-500 dark:text-gray-400 text-sm">ยังไม่มี CKAN Source</div>
                <div className="text-gray-400 dark:text-gray-500 text-xs mt-1">กดปุ่ม "เพิ่ม Source" เพื่อเริ่มต้น</div>
              </td></tr>
            )}
            {sources.map(s => (
              <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-800 dark:text-gray-100">{s.name}</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 md:hidden">
                    {s.division?.name || s.department?.name || s.ministry?.name || 'ทั้งระบบ'}
                  </div>
                </td>
                <td className="px-4 py-3 max-w-xs">
                  <a
                    href={s.url} target="_blank" rel="noreferrer"
                    className="text-blue-500 dark:text-blue-400 hover:underline text-xs truncate block"
                    title={s.url}
                  >
                    {s.url}
                  </a>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {s.division?.name || s.department?.name || s.ministry?.name || (
                      <span className="text-gray-400 dark:text-gray-500 italic">ทั้งระบบ</span>
                    )}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  {s.isActive ? (
                    <span className="badge text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-900/30 dark:border-emerald-700 text-xs">
                      ✓ เปิด
                    </span>
                  ) : (
                    <span className="badge text-gray-500 bg-gray-100 border-gray-200 dark:text-gray-400 dark:bg-gray-700 dark:border-gray-600 text-xs">
                      ปิด
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => openEdit(s)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      แก้ไข
                    </button>
                    <button
                      onClick={() => setConfirmDel(s)}
                      disabled={deleting === s.id}
                      className="text-xs px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-800 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors disabled:opacity-40"
                    >
                      {deleting === s.id ? '...' : 'ลบ'}
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
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            {/* Modal header */}
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                {modal === 'create' ? '🔗 เพิ่ม CKAN Source ใหม่' : `✏️ แก้ไข: ${selected?.name}`}
              </h2>
              <button
                onClick={() => setModal('none')}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-lg leading-none"
              >
                ×
              </button>
            </div>

            {/* Modal body */}
            <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <FormField label="ชื่อ *">
                <input
                  className="input-field"
                  placeholder="เช่น CKAN สถิติจังหวัด"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </FormField>
              <FormField label="URL *">
                <input
                  type="url"
                  className="input-field"
                  placeholder="https://catalog.example.go.th"
                  value={form.url}
                  onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                />
              </FormField>
              <FormField label="API Key">
                <input
                  className="input-field"
                  placeholder="เว้นว่างถ้าไม่มี"
                  value={form.apiKey}
                  onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))}
                />
              </FormField>

              <div className="border-t border-gray-100 dark:border-gray-700 pt-3">
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">ขอบเขตองค์กร</div>
                <div className="space-y-3">
                  <FormField label="กระทรวง">
                    <select
                      className="input-field"
                      value={form.ministryId}
                      onChange={e => setForm(f => ({ ...f, ministryId: e.target.value, departmentId: '', divisionId: '' }))}
                    >
                      <option value="">— ทั้งระบบ —</option>
                      {orgData.ministries.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </FormField>
                  <FormField label="กรม">
                    <select
                      className="input-field"
                      value={form.departmentId}
                      onChange={e => setForm(f => ({ ...f, departmentId: e.target.value, divisionId: '' }))}
                      disabled={!form.ministryId}
                    >
                      <option value="">— ทั้งกระทรวง —</option>
                      {filteredDepts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </FormField>
                  <FormField label="ศูนย์/กอง">
                    <select
                      className="input-field"
                      value={form.divisionId}
                      onChange={e => setForm(f => ({ ...f, divisionId: e.target.value }))}
                      disabled={!form.departmentId}
                    >
                      <option value="">— ทั้งกรม —</option>
                      {filteredDivs.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </FormField>
                </div>
              </div>

              <FormField label="สถานะ">
                <label className="flex items-center gap-2.5 cursor-pointer group">
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

              {error && (
                <div className="p-3 rounded-lg text-sm bg-red-50 border border-red-200 text-red-700 dark:bg-red-900/30 dark:border-red-700 dark:text-red-300">
                  {error}
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3 bg-gray-50 dark:bg-gray-800/80">
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
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center text-2xl mx-auto mb-3">
                🗑️
              </div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">ยืนยันการลบ</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
                ต้องการลบ <span className="font-semibold text-gray-800 dark:text-gray-200">{confirmDel.name}</span> ใช่หรือไม่?
                <br />การกระทำนี้ไม่สามารถยกเลิกได้
              </p>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setConfirmDel(null)} className="btn-secondary text-sm flex-1 justify-center">
                ยกเลิก
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 text-sm px-4 py-2 rounded-lg font-medium bg-red-600 hover:bg-red-700 text-white transition-colors justify-center"
              >
                ลบ Source
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <label className="text-xs text-gray-500 dark:text-gray-400 w-24 pt-2.5 shrink-0 font-medium">{label}</label>
      <div className="flex-1">{children}</div>
    </div>
  )
}
