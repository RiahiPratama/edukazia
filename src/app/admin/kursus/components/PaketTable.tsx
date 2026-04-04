'use client'

import { useState } from 'react'
import { Pencil, X, Loader2 } from 'lucide-react'

type Paket = {
  id: string
  name: string
  price: number
  total_sessions: number
  is_active: boolean
  courses: { name: string } | null
  class_types: { name: string; max_participants: number } | null
}

function formatRupiah(n: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', maximumFractionDigits: 0
  }).format(n)
}

export default function PaketTable({ paket }: { paket: Paket[] }) {
  const [editData, setEditData]     = useState<Paket | null>(null)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')

  // Form state
  const [formName,     setFormName]     = useState('')
  const [formPrice,    setFormPrice]    = useState('')
  const [formSessions, setFormSessions] = useState('')
  const [formActive,   setFormActive]   = useState(true)

  // Local state untuk reflect perubahan tanpa reload
  const [localPaket, setLocalPaket] = useState<Paket[]>(paket)

  function openEdit(p: Paket) {
    setEditData(p)
    setFormName(p.name)
    setFormPrice(p.price.toString())
    setFormSessions(p.total_sessions.toString())
    setFormActive(p.is_active)
    setError('')
  }

  function closeEdit() {
    setEditData(null)
    setError('')
  }

  async function handleSave() {
    if (!editData) return
    if (!formName.trim()) { setError('Nama paket tidak boleh kosong'); return }
    if (!formPrice || parseInt(formPrice) < 0) { setError('Harga tidak valid'); return }
    if (!formSessions || parseInt(formSessions) < 1) { setError('Jumlah sesi minimal 1'); return }

    setSaving(true); setError('')
    try {
      const res = await fetch(`/api/admin/packages/${editData.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:           formName.trim(),
          price:          parseInt(formPrice),
          total_sessions: parseInt(formSessions),
          is_active:      formActive,
        }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error ?? 'Gagal update paket')

      // Update local state tanpa reload halaman
      setLocalPaket(prev => prev.map(p =>
        p.id === editData.id
          ? { ...p, name: formName.trim(), price: parseInt(formPrice), total_sessions: parseInt(formSessions), is_active: formActive }
          : p
      ))

      closeEdit()
    } catch (err: any) {
      setError(err.message ?? 'Terjadi kesalahan')
    }
    setSaving(false)
  }

  if (localPaket.length === 0) {
    return (
      <div className="text-center py-10 text-[#7B78A8]">
        <div className="text-4xl mb-3">📦</div>
        <p className="font-semibold mb-1">Belum ada paket belajar</p>
      </div>
    )
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E5E3FF]">
              {['Nama Paket', 'Kursus', 'Tipe', 'Sesi', 'Harga', 'Status', ''].map(h => (
                <th key={h} className="text-left py-3 px-4 text-xs font-bold text-[#7B78A8] uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {localPaket.map((p) => (
              <tr key={p.id} className="border-b border-[#F0EFFF] hover:bg-[#F7F6FF] transition-colors">
                <td className="py-3 px-4 font-semibold text-[#1A1640]">{p.name}</td>
                <td className="py-3 px-4 text-[#4A4580]">{p.courses?.name ?? '—'}</td>
                <td className="py-3 px-4 text-[#4A4580]">{p.class_types?.name ?? '—'}</td>
                <td className="py-3 px-4 text-[#4A4580]">{p.total_sessions} sesi</td>
                <td className="py-3 px-4 font-semibold text-[#1A1640]">{formatRupiah(p.price)}</td>
                <td className="py-3 px-4">
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {p.is_active ? 'Aktif' : 'Nonaktif'}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <button
                    onClick={() => openEdit(p)}
                    className="flex items-center gap-1 text-xs text-[#5C4FE5] font-semibold hover:underline"
                  >
                    <Pencil size={12}/> Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Edit Paket */}
      {editData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E3FF]">
              <div>
                <h2 className="font-bold text-[#1A1640]">Edit Paket</h2>
                <p className="text-xs text-[#7B78A8] mt-0.5">
                  {editData.courses?.name} · {editData.class_types?.name}
                </p>
              </div>
              <button onClick={closeEdit} className="p-2 rounded-lg hover:bg-[#F0EFFF] text-[#7B78A8] transition">
                <X size={16}/>
              </button>
            </div>

            {/* Form */}
            <div className="px-6 py-5 space-y-4">

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 font-medium">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">
                  Nama Paket
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  className="w-full px-3 py-2.5 border border-[#E5E3FF] rounded-xl text-sm bg-[#F7F6FF] text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] focus:bg-white transition"
                  placeholder="Contoh: Privat 8 Sesi"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">
                    Harga (Rp)
                  </label>
                  <input
                    type="number"
                    value={formPrice}
                    onChange={e => setFormPrice(e.target.value)}
                    min="0"
                    className="w-full px-3 py-2.5 border border-[#E5E3FF] rounded-xl text-sm bg-[#F7F6FF] text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] focus:bg-white transition"
                    placeholder="500000"
                  />
                  {formPrice && (
                    <p className="text-xs text-[#7B78A8] mt-1">{formatRupiah(parseInt(formPrice) || 0)}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">
                    Jumlah Sesi
                  </label>
                  <input
                    type="number"
                    value={formSessions}
                    onChange={e => setFormSessions(e.target.value)}
                    min="1"
                    className="w-full px-3 py-2.5 border border-[#E5E3FF] rounded-xl text-sm bg-[#F7F6FF] text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] focus:bg-white transition"
                    placeholder="8"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-[#F7F6FF] rounded-xl border border-[#E5E3FF]">
                <input
                  type="checkbox"
                  id="paket-active"
                  checked={formActive}
                  onChange={e => setFormActive(e.target.checked)}
                  className="w-4 h-4 text-[#5C4FE5] rounded border-[#E5E3FF]"
                />
                <label htmlFor="paket-active" className="text-sm font-semibold text-[#1A1640] cursor-pointer">
                  Paket Aktif
                  <span className="text-xs text-[#7B78A8] font-normal ml-1">(muncul di pilihan perpanjang kelas)</span>
                </label>
              </div>

              {/* Info — kursus & tipe tidak bisa diubah */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-xs text-yellow-800">
                ⚠️ Kursus dan tipe kelas tidak bisa diubah. Buat paket baru jika perlu tipe yang berbeda.
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-6 py-4 border-t border-[#E5E3FF]">
              <button
                onClick={closeEdit}
                className="flex-1 py-2.5 border border-[#E5E3FF] text-[#7B78A8] rounded-xl text-sm font-semibold hover:bg-[#F7F6FF] transition"
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 bg-[#5C4FE5] text-white rounded-xl text-sm font-semibold hover:bg-[#4a3ec7] disabled:opacity-50 transition flex items-center justify-center gap-2"
              >
                {saving ? <><Loader2 size={14} className="animate-spin"/> Menyimpan...</> : '💾 Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
