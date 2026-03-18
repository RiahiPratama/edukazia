'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const COLORS = [
  { label: 'Ungu (Bahasa Inggris)', value: '#5C4FE5' },
  { label: 'Hijau (Bahasa Arab)', value: '#16A34A' },
  { label: 'Merah (Mandarin)', value: '#DC2626' },
  { label: 'Kuning (Matematika)', value: '#C8A000' },
  { label: 'Biru', value: '#2563EB' },
  { label: 'Orange', value: '#EA580C' },
]

export default function TambahKursusPage() {
  const router = useRouter()
  const supabase = createClient()

  const [form, setForm] = useState({
    name: '',
    description: '',
    color: '#5C4FE5',
    is_active: true,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value, type } = e.target
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Nama kursus wajib diisi.'); return }
    setLoading(true); setError('')

    const { error: err } = await supabase.from('courses').insert({
      name: form.name.trim(),
      description: form.description.trim() || null,
      color: form.color,
      is_active: form.is_active,
      sort_order: 99,
    })

    if (err) { setError(err.message); setLoading(false); return }
    router.push('/admin/kursus')
    router.refresh()
  }

  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/kursus" className="text-[#7B78A8] hover:text-[#5C4FE5] transition-colors">
          ← Kembali
        </Link>
        <h1 className="text-2xl font-black text-[#1A1640]" style={{fontFamily:'Sora,sans-serif'}}>
          Tambah Kursus
        </h1>
      </div>

      <div className="bg-white rounded-2xl border border-[#E5E3FF] p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">
              Nama Kursus <span className="text-red-500">*</span>
            </label>
            <input
              type="text" name="name" value={form.name} onChange={handleChange}
              placeholder="Contoh: Bahasa Inggris"
              className="w-full px-3.5 py-2.5 border border-[#E5E3FF] rounded-xl text-sm bg-[#F7F6FF] text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] focus:bg-white transition"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">
              Deskripsi
            </label>
            <textarea
              name="description" value={form.description} onChange={handleChange}
              placeholder="Deskripsi singkat kursus..."
              rows={3}
              className="w-full px-3.5 py-2.5 border border-[#E5E3FF] rounded-xl text-sm bg-[#F7F6FF] text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] focus:bg-white transition resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">
              Warna Identitas
            </label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, color: c.value }))}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${form.color === c.value ? 'border-[#1A1640] scale-110' : 'border-transparent'}`}
                  style={{ background: c.value }}
                  title={c.label}
                />
              ))}
            </div>
            <div className="mt-2 text-xs text-[#7B78A8] flex items-center gap-2">
              <div className="w-4 h-4 rounded-full" style={{ background: form.color }}/>
              {COLORS.find(c => c.value === form.color)?.label ?? form.color}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox" id="is_active" name="is_active"
              checked={form.is_active}
              onChange={handleChange}
              className="w-4 h-4 accent-[#5C4FE5]"
            />
            <label htmlFor="is_active" className="text-sm font-semibold text-[#4A4580]">
              Kursus aktif (tampil di sistem)
            </label>
          </div>

          {error && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 font-semibold">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit" disabled={loading}
              className="flex-1 py-3 bg-[#5C4FE5] hover:bg-[#3D34C4] text-white font-bold rounded-xl text-sm transition disabled:opacity-60"
            >
              {loading ? 'Menyimpan...' : 'Simpan Kursus'}
            </button>
            <Link
              href="/admin/kursus"
              className="px-6 py-3 border border-[#E5E3FF] text-[#4A4580] font-bold rounded-xl text-sm hover:bg-[#F0EFFF] transition text-center"
            >
              Batal
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
