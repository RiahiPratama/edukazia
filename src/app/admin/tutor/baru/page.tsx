'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Course = { id: string; name: string; color: string | null }

export default function TambahTutorPage() {
  const router = useRouter()
  const supabase = createClient()

  const [courses, setCourses] = useState<Course[]>([])
  const [selectedCourses, setSelectedCourses] = useState<string[]>([])
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    rate_per_session: '',
    bank_name: '',
    bank_account: '',
    bank_holder: '',
    is_active: true,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('courses').select('id, name, color').eq('is_active', true).then(({ data }) => {
      if (data) setCourses(data)
    })
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value, type } = e.target
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }))
  }

  function toggleCourse(id: string) {
    setSelectedCourses(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.full_name.trim()) { setError('Nama tutor wajib diisi.'); return }
    if (!form.phone.trim()) { setError('Nomor HP wajib diisi.'); return }
    if (!form.rate_per_session) { setError('Tarif per sesi wajib diisi.'); return }
    if (selectedCourses.length === 0) { setError('Pilih minimal 1 kursus.'); return }

    setLoading(true); setError('')

    // 1. Buat profile dulu
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .insert({
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        role: 'tutor',
      })
      .select('id')
      .single()

    if (profileErr || !profile) {
      setError(profileErr?.message ?? 'Gagal membuat profil.')
      setLoading(false); return
    }

    // 2. Buat tutor
    const { data: tutor, error: tutorErr } = await supabase
      .from('tutors')
      .insert({
        profile_id: profile.id,
        rate_per_session: parseInt(form.rate_per_session),
        bank_name: form.bank_name.trim() || null,
        bank_account: form.bank_account.trim() || null,
        bank_holder: form.bank_holder.trim() || null,
        is_active: form.is_active,
      })
      .select('id')
      .single()

    if (tutorErr || !tutor) {
      setError(tutorErr?.message ?? 'Gagal menyimpan tutor.')
      setLoading(false); return
    }

    // 3. Simpan kursus yang dikuasai
    if (selectedCourses.length > 0) {
      await supabase.from('tutor_courses').insert(
        selectedCourses.map(courseId => ({ tutor_id: tutor.id, course_id: courseId }))
      )
    }

    router.push('/admin/tutor')
    router.refresh()
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/tutor" className="text-[#7B78A8] hover:text-[#5C4FE5] transition-colors">
          ← Kembali
        </Link>
        <h1 className="text-2xl font-black text-[#1A1640]" style={{fontFamily:'Sora,sans-serif'}}>
          Tambah Tutor
        </h1>
      </div>

      <div className="bg-white rounded-2xl border border-[#E5E3FF] p-6">
        <form onSubmit={handleSubmit} className="space-y-5">

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">
                Nama Lengkap <span className="text-red-500">*</span>
              </label>
              <input type="text" name="full_name" value={form.full_name} onChange={handleChange}
                placeholder="Nama tutor"
                className="w-full px-3.5 py-2.5 border border-[#E5E3FF] rounded-xl text-sm bg-[#F7F6FF] text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] focus:bg-white transition"/>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">
                Nomor HP <span className="text-red-500">*</span>
              </label>
              <input type="tel" name="phone" value={form.phone} onChange={handleChange}
                placeholder="08xx xxxx xxxx"
                className="w-full px-3.5 py-2.5 border border-[#E5E3FF] rounded-xl text-sm bg-[#F7F6FF] text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] focus:bg-white transition"/>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">
              Tarif per Sesi (Rp) <span className="text-red-500">*</span>
            </label>
            <input type="number" name="rate_per_session" value={form.rate_per_session} onChange={handleChange}
              placeholder="Contoh: 150000"
              className="w-full px-3.5 py-2.5 border border-[#E5E3FF] rounded-xl text-sm bg-[#F7F6FF] text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] focus:bg-white transition"/>
          </div>

          {/* Rekening bank */}
          <div className="border border-[#E5E3FF] rounded-xl p-4">
            <div className="text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-3">Info Rekening (opsional)</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#4A4580] mb-1">Nama Bank</label>
                <input type="text" name="bank_name" value={form.bank_name} onChange={handleChange}
                  placeholder="BCA, BRI, dll"
                  className="w-full px-3 py-2 border border-[#E5E3FF] rounded-lg text-sm bg-[#F7F6FF] focus:outline-none focus:border-[#5C4FE5] transition"/>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#4A4580] mb-1">Nomor Rekening</label>
                <input type="text" name="bank_account" value={form.bank_account} onChange={handleChange}
                  placeholder="1234567890"
                  className="w-full px-3 py-2 border border-[#E5E3FF] rounded-lg text-sm bg-[#F7F6FF] focus:outline-none focus:border-[#5C4FE5] transition"/>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#4A4580] mb-1">Atas Nama</label>
                <input type="text" name="bank_holder" value={form.bank_holder} onChange={handleChange}
                  placeholder="Nama pemilik rekening"
                  className="w-full px-3 py-2 border border-[#E5E3FF] rounded-lg text-sm bg-[#F7F6FF] focus:outline-none focus:border-[#5C4FE5] transition"/>
              </div>
            </div>
          </div>

          {/* Kursus yang dikuasai */}
          <div>
            <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-2">
              Kursus yang Dikuasai <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {courses.map(c => (
                <button
                  key={c.id} type="button" onClick={() => toggleCourse(c.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
                    selectedCourses.includes(c.id)
                      ? 'text-white border-transparent'
                      : 'bg-white border-[#E5E3FF] text-[#4A4580]'
                  }`}
                  style={selectedCourses.includes(c.id) ? { background: c.color ?? '#5C4FE5', borderColor: c.color ?? '#5C4FE5' } : {}}
                >
                  {c.name}
                </button>
              ))}
              {courses.length === 0 && (
                <p className="text-sm text-[#7B78A8]">Belum ada kursus. Tambah kursus dulu.</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input type="checkbox" id="is_active" name="is_active" checked={form.is_active} onChange={handleChange}
              className="w-4 h-4 accent-[#5C4FE5]"/>
            <label htmlFor="is_active" className="text-sm font-semibold text-[#4A4580]">
              Tutor aktif
            </label>
          </div>

          {error && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 font-semibold">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading}
              className="flex-1 py-3 bg-[#5C4FE5] hover:bg-[#3D34C4] text-white font-bold rounded-xl text-sm transition disabled:opacity-60">
              {loading ? 'Menyimpan...' : 'Simpan Tutor'}
            </button>
            <Link href="/admin/tutor"
              className="px-6 py-3 border border-[#E5E3FF] text-[#4A4580] font-bold rounded-xl text-sm hover:bg-[#F0EFFF] transition text-center">
              Batal
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
