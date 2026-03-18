'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Student = {
  id: string
  profiles: { full_name: string } | null
}

type Package = {
  id: string
  name: string
  total_sessions: number
  price: number
}

type ClassGroup = {
  id: string
  label: string
  max_participants: number
  courses: { name: string } | null
  class_types: { name: string } | null
  enrollments: { id: string }[]
}

export default function EnrollPage() {
  const router  = useRouter()
  const params  = useParams()
  const kelasId = params.id as string
  const supabase = createClient()

  const [kelas, setKelas]     = useState<ClassGroup | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [packages, setPackages] = useState<Package[]>([])
  const [enrolled, setEnrolled] = useState<string[]>([])

  const [form, setForm] = useState({
    student_id: '',
    package_id: '',
    start_date: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (!kelasId) return

    Promise.all([
      // Fetch kelas detail
      supabase.from('class_groups').select(`
        id, label, max_participants,
        courses(name), class_types(name),
        enrollments(id)
      `).eq('id', kelasId).single(),

      // Fetch semua siswa
      supabase.from('students').select('id, profiles(full_name)'),

      // Fetch paket yang sesuai kursus kelas ini
      supabase.from('packages').select('id, name, total_sessions, price').eq('is_active', true),

      // Fetch siswa yang sudah enrolled di kelas ini
      supabase.from('enrollments').select('student_id').eq('class_group_id', kelasId).eq('status', 'active'),
    ]).then(([k, s, p, e]) => {
      if (k.data) setKelas(k.data as any)
      if (s.data) setStudents(s.data as any)
      if (p.data) setPackages(p.data)
      if (e.data) setEnrolled(e.data.map((x: any) => x.student_id))
    })
  }, [kelasId])

  function handleChange(e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.student_id) { setError('Pilih siswa.'); return }
    if (!form.package_id) { setError('Pilih paket.'); return }
    if (!form.start_date) { setError('Pilih tanggal mulai.'); return }

    if (enrolled.includes(form.student_id)) {
      setError('Siswa ini sudah terdaftar di kelas ini.')
      return
    }

    setLoading(true); setError(''); setSuccess('')

    const pkg = packages.find(p => p.id === form.package_id)

    const { error: err } = await supabase.from('enrollments').insert({
      student_id:     form.student_id,
      class_group_id: kelasId,
      package_id:     form.package_id,
      sessions_total: pkg?.total_sessions ?? 8,
      sessions_used:  0,
      start_date:     form.start_date,
      status:         'active',
    })

    if (err) { setError(err.message); setLoading(false); return }

    setSuccess('Siswa berhasil didaftarkan!')
    setEnrolled(prev => [...prev, form.student_id])
    setForm(prev => ({ ...prev, student_id: '', package_id: '' }))
    setLoading(false)
    router.refresh()
  }

  function formatRupiah(n: number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
  }

  const availableStudents = students.filter(s => !enrolled.includes(s.id))
  const slotsLeft = kelas ? kelas.max_participants - (kelas.enrollments?.length ?? 0) : 0

  const inputClass = "w-full px-3.5 py-2.5 border border-[#E5E3FF] rounded-xl text-sm bg-[#F7F6FF] text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] focus:bg-white transition"

  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/kelas" className="text-[#7B78A8] hover:text-[#5C4FE5] transition-colors">
          ← Kembali ke Kelas
        </Link>
        <h1 className="text-2xl font-black text-[#1A1640]" style={{fontFamily:'Sora,sans-serif'}}>
          Daftarkan Siswa
        </h1>
      </div>

      {/* Info kelas */}
      {kelas && (
        <div className="bg-[#F0EFFF] border border-[#5C4FE5]/20 rounded-2xl p-4 mb-4">
          <div className="text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1">Kelas</div>
          <div className="font-bold text-[#1A1640]">{kelas.label}</div>
          <div className="text-sm text-[#4A4580] mt-1">
            {kelas.courses?.name} · {kelas.class_types?.name} ·{' '}
            <span className={slotsLeft === 0 ? 'text-red-600 font-bold' : 'text-green-600 font-bold'}>
              {slotsLeft === 0 ? 'Kelas penuh' : `${slotsLeft} slot tersisa`}
            </span>
          </div>
        </div>
      )}

      {slotsLeft === 0 ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
          <div className="text-3xl mb-2">🚫</div>
          <p className="font-bold text-red-700 mb-1">Kelas sudah penuh</p>
          <p className="text-sm text-red-600">Tidak ada slot tersisa untuk mendaftarkan siswa baru.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E5E3FF] p-6">
          <form onSubmit={handleSubmit} className="space-y-5">

            <div>
              <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">
                Siswa <span className="text-red-500">*</span>
              </label>
              <select name="student_id" value={form.student_id} onChange={handleChange} className={inputClass}>
                <option value="">-- Pilih Siswa --</option>
                {availableStudents.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.profiles?.full_name ?? 'Siswa'}</option>
                ))}
              </select>
              {availableStudents.length === 0 && (
                <p className="text-xs text-[#7B78A8] mt-1">Semua siswa sudah terdaftar di kelas ini.</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">
                Paket Belajar <span className="text-red-500">*</span>
              </label>
              <select name="package_id" value={form.package_id} onChange={handleChange} className={inputClass}>
                <option value="">-- Pilih Paket --</option>
                {packages.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.total_sessions} sesi — {formatRupiah(p.price)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">
                Tanggal Mulai <span className="text-red-500">*</span>
              </label>
              <input type="date" name="start_date" value={form.start_date} onChange={handleChange}
                className={inputClass}/>
            </div>

            {error && (
              <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 font-semibold">
                {error}
              </div>
            )}

            {success && (
              <div className="px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 font-semibold">
                ✅ {success}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={loading || availableStudents.length === 0}
                className="flex-1 py-3 bg-[#5C4FE5] hover:bg-[#3D34C4] text-white font-bold rounded-xl text-sm transition disabled:opacity-60">
                {loading ? 'Mendaftarkan...' : 'Daftarkan Siswa'}
              </button>
              <Link href="/admin/kelas"
                className="px-6 py-3 border border-[#E5E3FF] text-[#4A4580] font-bold rounded-xl text-sm hover:bg-[#F0EFFF] transition text-center">
                Selesai
              </Link>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
