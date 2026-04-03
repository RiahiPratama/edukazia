'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Building2, Phone, Calendar, CheckCircle2, XCircle, Clock, Edit, Trash2, X, Save, Loader2 } from 'lucide-react'

type Bimbel = {
  id: string
  name: string
  contact_wa: string | null
  email: string | null
  address: string | null
  subscription_status: string | null
  subscription_start: string | null
  subscription_end: string | null
  notes: string | null
  created_at: string
  tutors?: { id: string; profiles: { full_name: string }[] | null }[]
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  active:   { label: 'Aktif',    color: 'bg-green-100 text-green-700 border-green-300',  icon: CheckCircle2 },
  inactive: { label: 'Nonaktif', color: 'bg-gray-100 text-gray-600 border-gray-300',     icon: XCircle },
  trial:    { label: 'Trial',    color: 'bg-yellow-100 text-yellow-700 border-yellow-300', icon: Clock },
  expired:  { label: 'Expired',  color: 'bg-red-100 text-red-600 border-red-300',         icon: XCircle },
}

const EMPTY_FORM = {
  name: '',
  contact_wa: '',
  email: '',
  address: '',
  subscription_status: 'trial',
  subscription_start: '',
  subscription_end: '',
  notes: '',
}

export default function BimbelPage() {
  const supabase = createClient()
  const [bimbels, setBimbels] = useState<Bimbel[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)

  useEffect(() => { fetchBimbels() }, [])

  async function fetchBimbels() {
    setLoading(true)
    const { data } = await supabase
      .from('bimbels')
      .select(`
        id, name, contact_wa, email, address,
        subscription_status, subscription_start, subscription_end,
        notes, created_at,
        tutors(id, profiles:profile_id(full_name))
      `)
      .order('created_at', { ascending: false })
    setBimbels(data ?? [])
    setLoading(false)
  }

  function openAdd() {
    setForm(EMPTY_FORM)
    setEditId(null)
    setShowForm(true)
  }

  function openEdit(b: Bimbel) {
    setForm({
      name: b.name,
      contact_wa: b.contact_wa ?? '',
      email: b.email ?? '',
      address: b.address ?? '',
      subscription_status: b.subscription_status ?? 'trial',
      subscription_start: b.subscription_start ?? '',
      subscription_end: b.subscription_end ?? '',
      notes: b.notes ?? '',
    })
    setEditId(b.id)
    setShowForm(true)
  }

  async function handleSave() {
    if (!form.name.trim()) { alert('Nama bimbel wajib diisi'); return }
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        contact_wa: form.contact_wa.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        subscription_status: form.subscription_status,
        subscription_start: form.subscription_start || null,
        subscription_end: form.subscription_end || null,
        notes: form.notes.trim() || null,
      }

      if (editId) {
        await supabase.from('bimbels').update(payload).eq('id', editId)
      } else {
        await supabase.from('bimbels').insert(payload)
      }

      setShowForm(false)
      fetchBimbels()
    } catch { alert('❌ Gagal menyimpan') }
    setSaving(false)
  }

  async function handleDelete() {
    if (!deleteId) return
    await supabase.from('bimbels').delete().eq('id', deleteId)
    setDeleteId(null)
    fetchBimbels()
  }

  const inputCls = "w-full px-3 py-2.5 border border-[#E5E3FF] rounded-xl text-sm bg-[#F7F6FF] text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] focus:bg-white transition"
  const labelCls = "block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5"

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-[#1A1640]" style={{ fontFamily: 'Sora, sans-serif' }}>
            Bimbel (B2B)
          </h1>
          <p className="text-sm text-[#7B78A8] mt-1">
            {bimbels.filter(b => b.subscription_status === 'active').length} bimbel aktif
          </p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 bg-[#5C4FE5] text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-[#4a3ec7] transition-colors">
          <Plus size={16} /> Tambah Bimbel
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center p-16">
          <Loader2 className="w-8 h-8 animate-spin text-[#5C4FE5]" />
        </div>
      ) : bimbels.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E5E3FF] p-12 text-center">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="font-bold text-[#1A1640] mb-1">Belum ada bimbel terdaftar</p>
          <p className="text-sm text-[#7B78A8] mb-4">Tambahkan bimbel mitra untuk mulai program B2B</p>
          <button onClick={openAdd}
            className="inline-flex items-center gap-2 bg-[#5C4FE5] text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-[#4a3ec7] transition-colors">
            + Tambah Bimbel Pertama
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bimbels.map(b => {
            const status = STATUS_CONFIG[b.subscription_status ?? 'inactive'] ?? STATUS_CONFIG.inactive
            const StatusIcon = status.icon
            const tutorList = (b.tutors ?? []) as any[]
            const isExpiringSoon = b.subscription_end &&
              new Date(b.subscription_end) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) &&
              b.subscription_status === 'active'

            return (
              <div key={b.id} className="bg-white rounded-2xl border border-[#E5E3FF] p-5 hover:shadow-sm transition-all">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#5C4FE5]/10 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-5 h-5 text-[#5C4FE5]" />
                    </div>
                    <div>
                      <p className="font-bold text-[#1A1640]">{b.name}</p>
                      {b.contact_wa && (
                        <p className="text-xs text-[#7B78A8] flex items-center gap-1">
                          <Phone size={10} /> {b.contact_wa}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(b)} className="p-1.5 text-gray-400 hover:text-[#5C4FE5] hover:bg-purple-50 rounded-lg transition-colors">
                      <Edit size={13} />
                    </button>
                    <button onClick={() => setDeleteId(b.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Status badge */}
                <div className="flex items-center gap-2 mb-3">
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${status.color}`}>
                    <StatusIcon size={11} /> {status.label}
                  </span>
                  {isExpiringSoon && (
                    <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200">
                      ⚠️ Hampir expired
                    </span>
                  )}
                </div>

                {/* Subscription dates */}
                {(b.subscription_start || b.subscription_end) && (
                  <div className="flex items-center gap-2 text-xs text-[#7B78A8] mb-3">
                    <Calendar size={11} />
                    <span>
                      {b.subscription_start ? new Date(b.subscription_start).toLocaleDateString('id-ID') : '?'}
                      {' → '}
                      {b.subscription_end ? new Date(b.subscription_end).toLocaleDateString('id-ID') : '?'}
                    </span>
                  </div>
                )}

                {/* Tutors */}
                <div className="border-t border-[#F0EFFF] pt-3">
                  <p className="text-xs text-[#7B78A8] mb-1">Tutor B2B:</p>
                  {tutorList.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">Belum ada tutor</p>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {tutorList.map((t: any) => (
                        <span key={t.id} className="text-xs bg-[#F0EFFF] text-[#5C4FE5] px-2 py-0.5 rounded-full font-medium">
                          {Array.isArray(t.profiles) ? t.profiles[0]?.full_name : t.profiles?.full_name ?? '—'}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Notes */}
                {b.notes && (
                  <p className="text-xs text-gray-400 mt-2 italic truncate">{b.notes}</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E3FF] sticky top-0 bg-white">
              <h2 className="text-lg font-black text-[#1A1640]">
                {editId ? 'Edit Bimbel' : 'Tambah Bimbel'}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Nama */}
              <div>
                <label className={labelCls}>Nama Bimbel *</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Bimbel Cerdas Bangsa..." className={inputCls} />
              </div>

              {/* Kontak */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>WhatsApp</label>
                  <input value={form.contact_wa} onChange={e => setForm(p => ({ ...p, contact_wa: e.target.value }))}
                    placeholder="628123..." className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Email</label>
                  <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                    placeholder="admin@bimbel.com" className={inputCls} />
                </div>
              </div>

              {/* Alamat */}
              <div>
                <label className={labelCls}>Alamat</label>
                <input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                  placeholder="Jl. ..." className={inputCls} />
              </div>

              {/* Subscription */}
              <div>
                <label className={labelCls}>Status Subscription</label>
                <div className="grid grid-cols-4 gap-2">
                  {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                    <button type="button" key={key}
                      onClick={() => setForm(p => ({ ...p, subscription_status: key }))}
                      className={`py-2 rounded-xl border-2 text-xs font-bold transition-all
                        ${form.subscription_status === key
                          ? `${cfg.color} ring-2 ring-offset-1 ring-[#5C4FE5]`
                          : 'border-[#E5E3FF] text-gray-500 hover:border-[#5C4FE5]'}`}>
                      {cfg.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tanggal subscription */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Mulai Subscription</label>
                  <input type="date" value={form.subscription_start}
                    onChange={e => setForm(p => ({ ...p, subscription_start: e.target.value }))}
                    className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Akhir Subscription</label>
                  <input type="date" value={form.subscription_end}
                    onChange={e => setForm(p => ({ ...p, subscription_end: e.target.value }))}
                    className={inputCls} />
                </div>
              </div>

              {/* Catatan */}
              <div>
                <label className={labelCls}>Catatan</label>
                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Catatan internal..." rows={3} className={inputCls + ' resize-none'} />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[#E5E3FF] flex gap-3 sticky bottom-0 bg-white">
              <button onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 border-2 border-[#E5E3FF] text-[#7B78A8] rounded-xl font-semibold text-sm hover:bg-gray-50 transition-colors">
                Batal
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#5C4FE5] text-white rounded-xl font-semibold text-sm hover:bg-[#4a3ec7] disabled:opacity-50 transition-colors">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={15} />}
                {editId ? 'Update' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full text-center">
            <Trash2 className="w-10 h-10 text-red-500 mx-auto mb-3" />
            <p className="font-bold text-[#1A1640] mb-1">Hapus Bimbel?</p>
            <p className="text-sm text-gray-500 mb-4">Data bimbel akan dihapus permanen.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)}
                className="flex-1 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">
                Batal
              </button>
              <button onClick={handleDelete}
                className="flex-1 py-2 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600">
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
