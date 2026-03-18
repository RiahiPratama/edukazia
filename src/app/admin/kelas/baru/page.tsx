'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Course    = { id: string; name: string; color: string | null }
type Tutor     = { id: string; profiles: { full_name: string } | null }
type ClassType = { id: string; name: string; max_participants: number }
type Student   = { id: string; profiles: { full_name: string } | null }

export default function BuatKelasPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [courses,    setCourses]    = useState<Course[]>([])
  const [tutors,     setTutors]     = useState<Tutor[]>([])
  const [classTypes, setClassTypes] = useState<ClassType[]>([])
  const [students,   setStudents]   = useState<Student[]>([])
  const [selectedStudents, setSelectedStudents] = useState<string[]>([])

  const [form, setForm] = useState({
    label:         '',
    course_id:     '',
    tutor_id:      '',
    class_type_id: '',
    zoom_link:     '',
    status:        'active',
  })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  useEffect(() => {
    Promise.all([
      supabase.from('courses').select('id, name, color').eq('is_active', true),
      supabase.from('tutors').select('id, profiles:profile_id(full_name)').eq('is_active', true),
      supabase.from('class_types').select('id, name, max_participants').order('max_participants'),
      supabase.from('students').select('id, profiles:profile_id(full_name)'),
    ]).then(([c, t, ct, s]) => {
      if (c.data)  setCourses(c.data)
      if (t.data)  setTutors(t.data as any)
      if (ct.data) setClassTypes(ct.data)
      if (s.data)  setStudents(s.data as any)
    })
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  function toggleStudent(id: string) {
    const classType = classTypes.find(ct => ct.id === form.class_type_id)
    const max = classType?.max_participants ?? 8
    if (selectedStudents.includes(id)) {
      setSelectedStudents(prev => prev.filter(s => s !== id))
    } else {
      if (selectedStudents.length >= max) {
        setError(`Maksimal ${max} siswa untuk tipe kelas ini.`)
        return
      }
      setSelectedStudents(prev => [...prev, id])
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.label.trim())   { setError('Label kelas wajib diisi.'); return }
    if (!form.course_id)      { setError('Pilih mata pelajaran.'); return }
    if (!form.tutor_id)       { setError('Pilih tutor.'); return }
    if (!form.class_type_id)  { setError('Pilih tipe kelas.'); return }

    setLoading(true); setError('')

    const classType = classTypes.find(ct => ct.id === form.class_type_id)

    const { data: classGroupData, error: err } = await supabase
      .from('class_groups')
      .insert({
        label:            form.label.trim(),
        course_id:        form.course_id,
        tutor_id:         form.tutor_id,
        class_type_id:    form.class_type_id,
        zoom_link:        form.zoom_link.trim() || null,
        max_participants: classType?.max_participants ?? 8,
        status:           form.status,
      })
      .select('id')
      .single()

    if (err) { setError(err.message); setLoading(false); return }

    // Enrollment siswa yang dipilih
    if (selectedStudents.length > 0 && classGroupData) {
      await supabase.from('enrollments').insert(
        selectedStudents.map(studentId => ({
          student_id:     studentId,
          class_group_id: classGroupData.id,
          sessions_total: 8,
          sessions_used:  0,
          start_date:     new Date().toISOString().split('T')[0],
          status:         'active',
        }))
      )
    }

    router.push('/admin/kelas')
    router.refresh()
  }

  const inputClass = "w-full px-3.5 py-2.5 border border-[#E5E3FF] rounded-xl text-sm bg-[#F7F6FF] text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] focus:bg-white transition"

  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/kelas" className="text-[#7B78A8] hover:text-[#5C4FE5] transition-colors">
          ← Kembali
        </Link>
        <h1 className="text-2xl font-black text-[#1A1640]" style={{fontFamily:'Sora,sans-serif'}}>
          Buat Kelas Baru
        </h1>
      </div>

      <div className="bg-white rounded-2xl border border-[#E5E3FF] p-6">
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Label */}
          <div>
            <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">
              Label Kelas <span className="text-red-500">*</span>
            </label>
            <input type="text" name="label" value={form.label} onChange={handleChange}
              placeholder="Contoh: Inggris Reguler A — Maret 2026"
              className={inputClass}/>
            <p className="text-xs text-[#7B78A8] mt-1">Nama unik untuk mengidentifikasi kelas ini</p>
          </div>

          {/* Kursus & Tipe */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">
                Mata Pelajaran <span className="text-red-500">*</span>
              </label>
              <select name="course_id" value={form.course_id} onChange={handleChange} className={inputClass}>
                <option value="">-- Pilih Kursus --</option>
                {courses.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">
                Tipe Kelas <span className="text-red-500">*</span>
              </label>
              <select name="class_type_id" value={form.class_type_id} onChange={handleChange} className={inputClass}>
                <option value="">-- Pilih Tipe --</option>
                {classTypes.map(ct => (
                  <option key={ct.id} value={ct.id}>{ct.name} (maks. {ct.max_participants} orang)</option>
                ))}
              </select>
            </div>
          </div>

          {/* Tutor */}
          <div>
            <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">
              Tutor <span className="text-red-500">*</span>
            </label>
            <select name="tutor_id" value={form.tutor_id} onChange={handleChange} className={inputClass}>
              <option value="">-- Pilih Tutor --</option>
              {tutors.map((t: any) => (
                <option key={t.id} value={t.id}>{t.profiles?.full_name ?? 'Tutor'}</option>
              ))}
            </select>
          </div>

          {/* Zoom */}
          <div>
            <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">
              Link Zoom (opsional)
            </label>
            <input type="url" name="zoom_link" value={form.zoom_link} onChange={handleChange}
              placeholder="https://zoom.us/j/xxxxxxxxxxxx"
              className={inputClass}/>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">
              Status Kelas
            </label>
            <select name="status" value={form.status} onChange={handleChange} className={inputClass}>
              <option value="active">Aktif</option>
              <option value="inactive">Tidak Aktif</option>
              <option value="completed">Selesai</option>
            </select>
          </div>

          {/* Pilih Siswa */}
          <div>
            <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-2">
              Daftarkan Siswa (opsional)
              {form.class_type_id && (
                <span className="ml-2 text-[#5C4FE5] normal-case font-normal">
                  {selectedStudents.length}/{classTypes.find(ct => ct.id === form.class_type_id)?.max_participants ?? '?'} dipilih
                </span>
              )}
            </label>
            <div className="flex flex-wrap gap-2">
              {students.map((s: any) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleStudent(s.id)}
                  className={[
                    'px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all',
                    selectedStudents.includes(s.id)
                      ? 'bg-[#5C4FE5] text-white border-[#5C4FE5]'
                      : 'bg-white border-[#E5E3FF] text-[#4A4580] hover:border-[#5C4FE5]'
                  ].join(' ')}
                >
                  {s.profiles?.full_name ?? 'Siswa'}
                </button>
              ))}
              {students.length === 0 && (
                <p className="text-sm text-[#7B78A8]">Belum ada siswa. Tambah siswa dulu.</p>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 font-semibold">
              {error}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading}
              className="flex-1 py-3 bg-[#5C4FE5] hover:bg-[#3D34C4] text-white font-bold rounded-xl text-sm transition disabled:opacity-60">
              {loading ? 'Menyimpan...' : 'Buat Kelas'}
            </button>
            <Link href="/admin/kelas"
              className="px-6 py-3 border border-[#E5E3FF] text-[#4A4580] font-bold rounded-xl text-sm hover:bg-[#F0EFFF] transition text-center">
              Batal
            </Link>
          </div>

        </form>
      </div>
    </div>
  )
}
