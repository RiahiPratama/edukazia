'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function TambahSiswaPage() {
  const router = useRouter()
  const supabase = createClient()

  const [form, setForm] = useState({
    // Data siswa
    full_name: '',
    phone: '',
    birth_date: '',
    school: '',
    grade: '',
    // Data orang tua
    parent_name: '',
    parent_phone: '',
    parent_relation: 'Ayah',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.full_name.trim()) { setError('Nama siswa wajib diisi.'); return }
    if (!form.parent_name.trim()) { setError('Nama orang tua wajib diisi.'); return }
    if (!form.parent_phone.trim()) { setError('Nomor HP orang tua wajib diisi.'); return }

    setLoading(true); setError('')

    // 1. Buat profile orang tua
    const { data: parentProfile, error: parentErr } = await supabase
      .from('profiles')
      .insert({
        id: crypto.randomUUID(),
        full_name: form.parent_name.trim(),
        phone: form.parent_phone.trim(),
        role: 'student'
      })
      .select('id').single()

    if (parentErr || !parentProfile) {
      setError(parentErr?.message ?? 'Gagal membuat profil orang tua.')
      setLoading(false); return
    }

    // 2. Buat profile siswa
    const { data: studentProfile, error: studentProfileErr } = await supabase
      .from('profiles')
      .insert({
        id: crypto.randomUUID(),
        full_name: form.full_name.trim(),
        phone: form.phone.trim() || null,
        birth_date: form.birth_date || null,
        role: 'student',
      })
      .select('id').single()

    if (studentProfileErr || !studentProfile) {
      setError(studentProfileErr?.message ?? 'Gagal membuat profil siswa.')
      setLoading(false); return
    }

    // 3. Buat record siswa
    const { error: studentErr } = await supabase.from('students').insert({
      profile_id: studentProfile.id,
      parent_profile_id: parentProfile.id,
      school: form.school.trim() || null,
      grade: form.grade.trim() || null,
    })

    if (studentErr) {
      setError(studentErr.message)
      setLoading(false); return
    }

    router.push('/admin/siswa')
    router.refresh()
  }

  const inputClass = "w-full px-3.5 py-2.5 border border-[#E5E3FF] rounded-xl text-sm bg-[#F7F6FF] text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] focus:bg-white transition"

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/siswa" className="text-[#7B78A8] hover:text-[#5C4FE5] transition-colors">
          ← Kembali
        </Link>
        <h1 className="text-2xl font-black text-[#1A1640]" style={{ fontFamily: 'Sora,sans-serif' }}>
          Tambah Siswa
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Data Siswa */}
        <div className="bg-white rounded-2xl border border-[#E5E3FF] p-6">
          <h2 className="font-bold text-[#1A1640] mb-4 flex items-center gap-2">
            <span>👨‍🎓</span> Data Siswa
          </h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">
                  Nama Lengkap <span className="text-red-500">*</span>
                </label>
                <input type="text" name="full_name" value={form.full_name} onChange={handleChange}
                  placeholder="Nama lengkap siswa" className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">
                  Nomor HP Siswa
                </label>
                <input type="tel" name="phone" value={form.phone} onChange={handleChange}
                  placeholder="(opsional)" className={inputClass} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">
                  Tanggal Lahir
                </label>
                <input type="date" name="birth_date" value={form.birth_date} onChange={handleChange}
                  className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">
                  Sekolah
                </label>
                <input type="text" name="school" value={form.school} onChange={handleChange}
                  placeholder="Nama sekolah" className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">
                  Kelas / Level
                </label>
                <input type="text" name="grade" value={form.grade} onChange={handleChange}
                  placeholder="Contoh: Kelas 5, SMA" className={inputClass} />
              </div>
            </div>
          </div>
        </div>

        {/* Data Orang Tua */}
        <div className="bg-white rounded-2xl border border-[#E5E3FF] p-6">
          <h2 className="font-bold text-[#1A1640] mb-4 flex items-center gap-2">
            <span>👨‍👩‍👧</span> Data Orang Tua / Wali
          </h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">
                  Hubungan <span className="text-red-500">*</span>
                </label>
                <select name="parent_relation" value={form.parent_relation} onChange={handleChange}
                  className={inputClass}>
                  <option>Ayah</option>
                  <option>Ibu</option>
                  <option>Wali</option>
                  <option>Kakak</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">
                  Nama <span className="text-red-500">*</span>
                </label>
                <input type="text" name="parent_name" value={form.parent_name} onChange={handleChange}
                  placeholder="Nama orang tua" className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">
                  Nomor HP <span className="text-red-500">*</span>
                </label>
                <input type="tel" name="parent_phone" value={form.parent_phone} onChange={handleChange}
                  placeholder="08xx xxxx xxxx" className={inputClass} />
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 font-semibold">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button type="submit" disabled={loading}
            className="flex-1 py-3 bg-[#5C4FE5] hover:bg-[#3D34C4] text-white font-bold rounded-xl text-sm transition disabled:opacity-60">
            {loading ? 'Menyimpan...' : 'Simpan Data Siswa'}
          </button>
          <Link href="/admin/siswa"
            className="px-6 py-3 border border-[#E5E3FF] text-[#4A4580] font-bold rounded-xl text-sm hover:bg-[#F0EFFF] transition text-center">
            Batal
          </Link>
        </div>
      </form>
    </div>
  )
}
