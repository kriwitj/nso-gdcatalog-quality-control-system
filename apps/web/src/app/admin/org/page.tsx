'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/apiClient'

interface OrgItem { id: string; name: string; code?: string | null }
interface Ministry   extends OrgItem {}
interface Department extends OrgItem { ministryId: string }
interface Division   extends OrgItem { departmentId: string }
interface OrgGroup   extends OrgItem { divisionId: string }

interface OrgData {
  ministries:  Ministry[]
  departments: Department[]
  divisions:   Division[]
  groups:      OrgGroup[]
}

type OrgType = 'ministries' | 'departments' | 'divisions' | 'groups'

export default function AdminOrgPage() {
  const [data,    setData]    = useState<OrgData>({ ministries: [], departments: [], divisions: [], groups: [] })
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [adding,   setAdding]   = useState<{ type: OrgType; parentId: string } | null>(null)
  const [newName,  setNewName]  = useState('')
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')

  async function loadOrg() {
    setLoading(true)
    const r = await apiFetch('/api/admin/org')
    if (r.ok) { const d = await r.json(); setData(d) }
    setLoading(false)
  }

  useEffect(() => { loadOrg() }, [])

  function toggle(id: string) {
    setExpanded(e => ({ ...e, [id]: !e[id] }))
  }

  function startAdd(type: OrgType, parentId: string) {
    setAdding({ type, parentId }); setNewName(''); setError('')
    // Auto-expand parent so the inline form is visible
    if (parentId) setExpanded(e => ({ ...e, [parentId]: true }))
  }

  async function handleAdd() {
    if (!newName.trim() || !adding) return
    setSaving(true); setError('')
    const body: Record<string, unknown> = { name: newName.trim() }
    if (adding.parentId) body.parentId = adding.parentId

    const r = await apiFetch(`/api/admin/org/${adding.type}`, {
      method: 'POST', body: JSON.stringify(body),
    })
    const d = await r.json()
    if (r.ok) { setAdding(null); loadOrg() }
    else setError(d.error || 'เกิดข้อผิดพลาด')
    setSaving(false)
  }

  async function handleDelete(type: OrgType, id: string, name: string) {
    if (!confirm(`ลบ "${name}"?\nข้อมูลลูกทั้งหมดจะถูกลบหรือตัดการเชื่อมต่อด้วย`)) return
    const r = await apiFetch(`/api/admin/org/${type}/${id}`, { method: 'DELETE' })
    const d = await r.json()
    if (r.ok) loadOrg()
    else alert(d.error || 'ลบไม่ได้')
  }

  const AddForm = ({ type, parentId }: { type: OrgType; parentId: string }) => (
    <div className="mt-2 flex gap-2 items-center">
      <input
        autoFocus
        className="input-field flex-1 text-xs py-1"
        placeholder="ชื่อหน่วยงาน..."
        value={newName}
        onChange={e => setNewName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAdding(null) }}
      />
      <button onClick={handleAdd} disabled={saving} className="btn-primary text-xs py-1 px-2">
        {saving ? '...' : 'เพิ่ม'}
      </button>
      <button onClick={() => setAdding(null)} className="btn-secondary text-xs py-1 px-2">ยกเลิก</button>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  )

  if (loading) return <div className="p-6 text-center text-gray-400">กำลังโหลด...</div>

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">โครงสร้างองค์กร</h1>
        <button
          onClick={() => startAdd('ministries', '')}
          className="btn-secondary text-sm"
        >+ เพิ่มกระทรวง</button>
      </div>

      {adding?.type === 'ministries' && <AddForm type="ministries" parentId="" />}

      <div className="space-y-2 mt-4">
        {data.ministries.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">ยังไม่มีข้อมูลองค์กร — เริ่มต้นด้วยการเพิ่มกระทรวง</p>
        )}
        {data.ministries.map(m => {
          const depts = data.departments.filter(d => d.ministryId === m.id)
          const isOpen = expanded[m.id]
          return (
            <div key={m.id} className="card">
              <div className="flex items-center gap-2 px-4 py-3">
                <button onClick={() => toggle(m.id)} className="text-gray-400 w-4 text-center shrink-0">
                  {depts.length > 0 ? (isOpen ? '▾' : '▸') : '·'}
                </button>
                <span className="flex-1 font-medium text-gray-800 text-sm">{m.name}</span>
                <OrgBadge label="กระทรวง" />
                <button onClick={() => startAdd('departments', m.id)} className="text-xs text-blue-500 hover:underline">+ กรม</button>
                <button onClick={() => handleDelete('ministries', m.id, m.name)} className="text-xs text-red-400 hover:text-red-600">×</button>
              </div>

              {isOpen && (
                <div className="border-t border-gray-100 pb-2 px-4">
                  {adding?.type === 'departments' && adding.parentId === m.id && (
                    <div className="mt-2"><AddForm type="departments" parentId={m.id} /></div>
                  )}
                  <div className="mt-1 space-y-1">
                    {depts.map(dept => {
                      const divs = data.divisions.filter(d => d.departmentId === dept.id)
                      const deptOpen = expanded[dept.id]
                      return (
                        <div key={dept.id} className="ml-4 border-l-2 border-gray-100 pl-3">
                          <div className="flex items-center gap-2 py-2">
                            <button onClick={() => toggle(dept.id)} className="text-gray-400 w-4 text-center shrink-0">
                              {divs.length > 0 ? (deptOpen ? '▾' : '▸') : '·'}
                            </button>
                            <span className="flex-1 text-sm text-gray-700">{dept.name}</span>
                            <OrgBadge label="กรม" color="purple" />
                            <button onClick={() => startAdd('divisions', dept.id)} className="text-xs text-blue-500 hover:underline">+ ศูนย์/กอง</button>
                            <button onClick={() => handleDelete('departments', dept.id, dept.name)} className="text-xs text-red-400 hover:text-red-600">×</button>
                          </div>
                          {adding?.type === 'divisions' && adding.parentId === dept.id && (
                            <div className="ml-4"><AddForm type="divisions" parentId={dept.id} /></div>
                          )}
                          {deptOpen && divs.map(div => {
                            const grps = data.groups.filter(g => g.divisionId === div.id)
                            const divOpen = expanded[div.id]
                            return (
                              <div key={div.id} className="ml-4 border-l-2 border-gray-100 pl-3">
                                <div className="flex items-center gap-2 py-1.5">
                                  <button onClick={() => toggle(div.id)} className="text-gray-400 w-4 text-center shrink-0">
                                    {grps.length > 0 ? (divOpen ? '▾' : '▸') : '·'}
                                  </button>
                                  <span className="flex-1 text-sm text-gray-600">{div.name}</span>
                                  <OrgBadge label="ศูนย์/กอง" color="green" />
                                  <button onClick={() => startAdd('groups', div.id)} className="text-xs text-blue-500 hover:underline">+ กลุ่ม</button>
                                  <button onClick={() => handleDelete('divisions', div.id, div.name)} className="text-xs text-red-400 hover:text-red-600">×</button>
                                </div>
                                {adding?.type === 'groups' && adding.parentId === div.id && (
                                  <div className="ml-4"><AddForm type="groups" parentId={div.id} /></div>
                                )}
                                {divOpen && grps.map(g => (
                                  <div key={g.id} className="ml-8 flex items-center gap-2 py-1">
                                    <span className="w-4 text-center text-gray-300">·</span>
                                    <span className="flex-1 text-xs text-gray-500">{g.name}</span>
                                    <OrgBadge label="กลุ่ม" color="orange" />
                                    <button onClick={() => handleDelete('groups', g.id, g.name)} className="text-xs text-red-400 hover:text-red-600">×</button>
                                  </div>
                                ))}
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function OrgBadge({ label, color = 'blue' }: { label: string; color?: string }) {
  const colors: Record<string, string> = {
    blue:   'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
    green:  'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600',
  }
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded ${colors[color] || colors.blue}`}>{label}</span>
  )
}
