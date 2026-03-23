'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import AnnouncementBanner from '@/components/AnnouncementBanner'

type Announcement = {
  id: string
  title: string
  description: string | null
  start_date: string
  end_date: string
  priority: 'high' | 'medium' | 'low'
  is_active: boolean
}

const inputCls = "w-full px-3 py-2.5 border border-[#E5E3FF] rounded-xl text-sm bg-[#F7F6FF] text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] transition"

export default function AnnouncementSection({ announcements: initial }: { announcements: Announcement[] }) {
  const [list,       setList]       = useState<Announcement[]>(initial)
  const [showForm,   setShowForm]   = useState(false)
  const [editAnn,    setEditAnn]    = useState<Announcement | null>(null)
  const [fTitle,     setFTitle]     = useState('')
  const [fDesc,      setFDesc]      = useState('')
  const [fStart,     setFStart]     = useState('')
  const [fEnd,       setFEnd]       = useState('')
  const [fPriority,  setFPriority]  = useState<'high'|'medium'|'low'>('medium')
  const [saving,     setSaving]     = useState(false)
  const [err,        setErr]        = useState('')

  function openNew() {
    setEditAnn(null)
    setFTitle(''); setFDesc(''); setFStart(''); setFEnd(''); setFPriority('medium'); setErr('')
    setShowForm(true)
  }

  function openEdit(ann: Announcement) {
    setEditAnn(ann)
    setFTitle(ann.title); setFDesc(ann.description ?? ''); setFStart(ann.start_date)
    setFEnd(ann.end_date); setFPriority(ann.priority); setErr('')
    setShowForm(true)
  }

  async function handleSave() {
    if (!fTitle.trim()) { setErr('Judul tidak boleh kosong'); return }
    if (!fStart || !fEnd) { setErr('Tanggal harus diisi'); return }
    if (fStart > fEnd) { setErr('Tanggal mulai harus sebelum tanggal selesai'); return }
    setSaving(true); setErr('')

    const body = { title: fTitle.trim(), description: fDesc.trim() || null, start_date: fStart, end_date: fEnd, priority: fPriority }

    if (editAnn) {
      const res = await fetch('/api/announcements', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editAnn.id, ...body }),
      })
      const data = await res.json()
      setSaving(false)
      if (!res.ok) { setErr(data.error ?? 'Gagal'); return }
      setList(prev => prev.map(a => a.id === editAnn.id ? data.announcement : a))
    } else {
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      setSaving(false)
      if (!res.ok) { setErr(data.error ?? 'Gagal'); return }
      setList(prev => [data.announcement, ...prev])
    }
    setShowForm(false)
  }

  async function handleDelete(id: string) {
    const res = await fetch('/api/announcements', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) setList(prev => prev.filter(a => a.id !== id))
  }

  const PRIORITY_OPTS: { value: 'high'|'medium'|'low'; label: string; cls: string }[] = [
    { value: 'high',   label: 'Penting',  cls: 'bg-[#FCEBEB] text-[#791F1F] border-[#F09595]' },
    { value: 'medium', label: 'Liburan',  cls: 'bg-[#FAEEDA] text-[#633806] border-[#EF9F27]' },
    { value: 'low',    label: 'Info',     cls: 'bg-[#E6F1FB] text-[#0C447C] border-[#85B7EB]' },
  ]

  return (
    <div className="mb-4">
      {/* Banner list */}
      {list.length > 0 && (
        <AnnouncementBanner
          announcements={list}
          isAdmin
          onEdit={openEdit}
          onDelete={handleDelete}
        />
      )}

      {/* Tombol tambah */}
      {!showForm && (
        <button onClick={openNew}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-[#E5E3FF] text-xs text-[#7B78A8] hover:border-[#5C4FE5] hover:text-[#5C4FE5] transition mb-2">
          <Plus size={12}/> Tambah Pengumuman
        </button>
      )}

      {/* Form tambah/edit */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-[#E5E3FF] overflow-hidden mb-2">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#F0EFFF] bg-[#F7F6FF]">
            <p className="text-sm font-bold text-[#1A1640]">
              {editAnn ? 'Edit Pengumuman' : 'Buat Pengumuman Baru'}
            </p>
            <button onClick={() => setShowForm(false)} className="p-1 rounded-lg hover:bg-[#E5E3FF] text-[#7B78A8]">
              <X size={14}/>
            </button>
          </div>
          <div className="px-4 py-4 space-y-3">
            <div>
              <label className="block text-[10px] font-bold text-[#7B78A8] uppercase tracking-wider mb-1.5">Judul *</label>
              <input type="text" value={fTitle} onChange={e => setFTitle(e.target.value)}
                placeholder="Contoh: Libur Lebaran 2026" className={inputCls}/>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-[#7B78A8] uppercase tracking-wider mb-1.5">Tanggal mulai *</label>
                <input type="date" value={fStart} onChange={e => setFStart(e.target.value)} className={inputCls}/>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#7B78A8] uppercase tracking-wider mb-1.5">Tanggal selesai *</label>
                <input type="date" value={fEnd} onChange={e => setFEnd(e.target.value)} className={inputCls}/>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-[#7B78A8] uppercase tracking-wider mb-1.5">Keterangan <span className="normal-case font-normal">(opsional)</span></label>
              <input type="text" value={fDesc} onChange={e => setFDesc(e.target.value)}
                placeholder="Contoh: Semua kelas libur selama periode ini" className={inputCls}/>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-[#7B78A8] uppercase tracking-wider mb-1.5">Prioritas</label>
              <div className="grid grid-cols-3 gap-2">
                {PRIORITY_OPTS.map(opt => (
                  <button key={opt.value} onClick={() => setFPriority(opt.value)}
                    className={`py-2 rounded-xl text-xs font-semibold border transition ${opt.cls} ${fPriority === opt.value ? 'ring-2 ring-offset-1 ring-[#5C4FE5]' : 'opacity-60 hover:opacity-100'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            {err && <p className="text-xs text-red-600 px-3 py-2 bg-red-50 rounded-xl border border-red-200">{err}</p>}
            <div className="flex gap-2 pt-1">
              <button onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 border border-[#E5E3FF] text-[#7B78A8] font-semibold rounded-xl text-sm hover:bg-[#F7F6FF] transition">
                Batal
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2.5 bg-[#5C4FE5] hover:bg-[#3D34C4] text-white font-bold rounded-xl text-sm transition disabled:opacity-60">
                {saving ? 'Menyimpan...' : editAnn ? 'Update' : 'Simpan & Berlakukan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
