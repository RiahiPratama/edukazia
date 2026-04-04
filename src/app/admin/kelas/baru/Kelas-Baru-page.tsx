'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ChevronDown, Search, Check, X } from 'lucide-react'

type Course    = { id: string; name: string; color: string | null }
type Tutor     = { id: string; profiles: { full_name: string } | null }
type ClassType = { id: string; name: string; max_participants: number; base_price: number }
type Student   = { id: string; profiles: { full_name: string } | null; is_new: boolean }
type Level     = { id: string; name: string; description: string | null; target_age: string | null }

export default function BuatKelasPage() {
  const router   = useRouter()
  const supabase = createClient()
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [courses,    setCourses]    = useState<Course[]>([])
  const [tutors,     setTutors]     = useState<Tutor[]>([])
  const [classTypes, setClassTypes] = useState<ClassType[]>([])
  const [students,   setStudents]   = useState<Student[]>([])
  const [selectedStudents, setSelectedStudents] = useState<string[]>([])

  const [levels,         setLevels]         = useState<Level[]>([])
  const [selectedLevels, setSelectedLevels] = useState<string[]>([])

  const [siswaOpen,   setSiswaOpen]   = useState(false)
  const [siswaSearch, setSiswaSearch] = useState('')

  const [sessionsTotal,      setSessionsTotal]      = useState(8)
  const [sessionStartOffset, setSessionStartOffset] = useState(0)

  const [form, setForm] = useState({
    label: '', course_id: '', tutor_id: '', class_type_id: '', zoom_link: '', status: 'active', price: '',
  })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  useEffect(() => {
    Promise.all([
      supabase.from('courses').select('id, name, color').eq('is_active', true),
      supabase.from('tutors').select('id, profiles:profile_id(full_name)').eq('is_active', true),
      supabase.from('class_types').select('id, name, max_participants, base_price').order('max_participants'),
      supabase.from('students').select('id, profiles:profile_id(full_name)'),
    ]).then(async ([c, t, ct, s]) => {
      if (c.data)  setCourses(c.data)
      if (t.data)  setTutors(t.data as any)
      if (ct.data) setClassTypes(ct.data)
      if (s.data) {
        const { data: existingEnrollments } = await supabase
          .from('enrollments')
          .select('student_id')
        const enrolledIds = new Set((existingEnrollments ?? []).map((e: any) => e.student_id))
        setStudents((s.data as any[]).map(st => ({
          ...st,
          is_new: !enrolledIds.has(st.id)
        })))
      }
    })
  }, [])

  // Fetch levels saat course_id berubah
  useEffect(() => {
    if (!form.course_id) {
      setLevels([])
      setSelectedLevels([])
      return
    }
    supabase
      .from('levels')
      .select('id, name, description, target_age')
      .eq('course_id', form.course_id)
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => {
        setLevels(data ?? [])
        setSelectedLevels([])
      })
  }, [form.course_id])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setSiswaOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function toggleLevel(id: string) {
    setSelectedLevels(prev =>
      prev.includes(id) ? prev.filter(l => l !== id) : [...prev, id]
    )
  }

  function getLevelTargetAge(val: string | null) {
    if (!val) return ''
    const map: Record<string, string> = {
      all: 'Semua', kids: 'Anak', teen: 'Remaja',
      adult: 'Dewasa', kids_teen: 'Anak & Remaja', teen_adult: 'Remaja & Dewasa',
    }
    return map[val] ?? val
  }

  function toggleStudent(id: string) {
    const classType = classTypes.find(ct => ct.id === form.class_type_id)
    const max = classType?.max_participants ?? 8
    let newSelected: string[]
    if (selectedStudents.includes(id)) {
      newSelected = selectedStudents.filter(s => s !== id)
    } else {
      if (selectedStudents.length >= max) {
        setError(`Maksimal ${max} siswa untuk tipe kelas ini.`)
        return
      }
      newSelected = [...selectedStudents, id]
    }
    setSelectedStudents(newSelected)
    setError('')
    if (newSelected.length > 0) {
      const allNew = newSelected.every(sid => students.find(s => s.id === sid)?.is_new)
      setSessionStartOffset(allNew ? 0 : 1)
    } else {
      setSessionStartOffset(0)
    }
  }

  function getStudentName(id: string) {
    return (students.find(s => s.id === id) as any)?.profiles?.full_name ?? 'Siswa'
  }

  function isStudentNew(id: string) {
    return students.find(s => s.id === id)?.is_new ?? false
  }

  const filteredStudents = students.filter(s =>
    ((s as any).profiles?.full_name ?? '').toLowerCase().includes(siswaSearch.toLowerCase())
  )

  const maxParticipants = classTypes.find(ct => ct.id === form.class_type_id)?.max_participants ?? 8

  const allSelectedAreNew = selectedStudents.length > 0 &&
    selectedStudents.every(id => students.find(s => s.id === id)?.is_new)

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target
    setForm(prev => {
      const next = { ...prev, [name]: value }
      if (name === 'class_type_id' && value) {
        const ct = classTypes.find(c => c.id === value)
        if (ct?.base_price) next.price = String(ct.base_price)
      }
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.label.trim())  { setError('Label kelas wajib diisi.'); return }
    if (!form.course_id)     { setError('Pilih mata pelajaran.'); return }
    if (!form.tutor_id)      { setError('Pilih tutor.'); return }
    if (!form.class_type_id) { setError('Pilih tipe kelas.'); return }

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
        price:            form.price ? parseInt(form.price) : null,
      })
      .select('id').single()

    if (err) { setError(err.message); setLoading(false); return }

    if (selectedStudents.length > 0 && classGroupData) {
      await supabase.from('enrollments').insert(
        selectedStudents.map(studentId => ({
          student_id:           studentId,
          class_group_id:       classGroupData.id,
          sessions_total:       sessionsTotal,
          sessions_used:        0,
          session_start_offset: sessionStartOffset,
          status:               'active',
        }))
      )
    }

    // Insert class_group_levels
    if (selectedLevels.length > 0 && classGroupData) {
      await supabase.from('class_group_levels').insert(
        selectedLevels.map(levelId => ({
          class_group_id: classGroupData.id,
          level_id:       levelId,
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
        <Link href="/admin/kelas" className="text-[#7B78A8] hover:text-[#5C4FE5] transition-colors">← Kembali</Link>
        <h1 className="text-2xl font-black text-[#1A1640]" style={{fontFamily:'Sora,sans-serif'}}>Buat Kelas Baru</h1>
      </div>

      <div className="bg-white rounded-2xl border border-[#E5E3FF] p-6">
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Label Kelas */}
          <div>
            <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">Label Kelas <span className="text-red-500">*</span></label>
            <input type="text" name="label" value={form.label} onChange={handleChange}
              placeholder="Contoh: Inggris Reguler A — Maret 2026" className={inputClass}/>
            <p className="text-xs text-[#7B78A8] mt-1">Nama unik untuk mengidentifikasi kelas ini</p>
          </div>

          {/* Mata Pelajaran + Tipe Kelas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">Mata Pelajaran <span className="text-red-500">*</span></label>
              <select name="course_id" value={form.course_id} onChange={handleChange} className={inputClass}>
                <option value="">-- Pilih Kursus --</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">Tipe Kelas <span className="text-red-500">*</span></label>
              <select name="class_type_id" value={form.class_type_id} onChange={handleChange} className={inputClass}>
                <option value="">-- Pilih Tipe --</option>
                {classTypes.map(ct => <option key={ct.id} value={ct.id}>{ct.name} (maks. {ct.max_participants} orang)</option>)}
              </select>
            </div>
          </div>

          {/* Level Kurikulum — muncul setelah mata pelajaran dipilih */}
          {form.course_id && (
            <div>
              <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">
                Level Kurikulum
                <span className="normal-case font-normal text-[#7B78A8] ml-1">(opsional, bisa diatur nanti)</span>
              </label>
              {levels.length === 0 ? (
                <div className="px-4 py-3 rounded-xl border border-dashed border-[#E5E3FF] text-xs text-[#7B78A8]">
                  Belum ada level untuk kursus ini. Tambahkan di menu Kursus &amp; Paket.
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {levels.map(l => {
                    const isSelected = selectedLevels.includes(l.id)
                    return (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => toggleLevel(l.id)}
                        className={[
                          'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all',
                          isSelected
                            ? 'bg-[#5C4FE5] text-white border-[#5C4FE5]'
                            : 'bg-[#F7F6FF] text-[#4A4580] border-[#E5E3FF] hover:border-[#5C4FE5]'
                        ].join(' ')}
                      >
                        {isSelected && <Check size={11}/>}
                        {l.name}
                        {l.target_age && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isSelected ? 'bg-white/20' : 'bg-[#E5E3FF] text-[#7B78A8]'}`}>
                            {getLevelTargetAge(l.target_age)}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
              {selectedLevels.length > 0 && (
                <p className="text-xs text-[#5C4FE5] font-semibold mt-2">
                  ✓ {selectedLevels.length} level dipilih
                </p>
              )}
            </div>
          )}

          {/* Tarif per siswa */}
          <div>
            <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">
              Tarif per Siswa <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7B78A8] text-sm font-semibold">Rp</span>
              <input
                type="number"
                name="price"
                value={form.price}
                onChange={handleChange}
                placeholder="500000"
                min={0}
                className="w-full pl-10 pr-3.5 py-2.5 border border-[#E5E3FF] rounded-xl text-sm bg-[#F7F6FF] text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] focus:bg-white transition"
              />
            </div>
            <p className="text-xs text-[#7B78A8] mt-1">
              Auto-diisi dari tarif tipe kelas, bisa diubah sesuai angkatan siswa
            </p>
          </div>

          {/* Tutor */}
          <div>
            <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">Tutor <span className="text-red-500">*</span></label>
            <select name="tutor_id" value={form.tutor_id} onChange={handleChange} className={inputClass}>
              <option value="">-- Pilih Tutor --</option>
              {tutors.map((t: any) => <option key={t.id} value={t.id}>{t.profiles?.full_name ?? 'Tutor'}</option>)}
            </select>
          </div>

          {/* Link Zoom */}
          <div>
            <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">Link Zoom (opsional)</label>
            <input type="url" name="zoom_link" value={form.zoom_link} onChange={handleChange}
              placeholder="https://zoom.us/j/xxxxxxxxxxxx" className={inputClass}/>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">Status Kelas</label>
            <select name="status" value={form.status} onChange={handleChange} className={inputClass}>
              <option value="active">Aktif</option>
              <option value="inactive">Tidak Aktif</option>
              <option value="completed">Selesai</option>
            </select>
          </div>

          {/* Pilih Siswa */}
          <div>
            <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">
              Daftarkan Siswa <span className="normal-case font-normal text-[#7B78A8]">(opsional)</span>
              {form.class_type_id && <span className="ml-2 text-[#5C4FE5] normal-case font-normal">{selectedStudents.length}/{maxParticipants} dipilih</span>}
            </label>

            <div className="relative" ref={dropdownRef}>
              <button type="button" onClick={() => setSiswaOpen(o => !o)}
                className="w-full px-3.5 py-2.5 border border-[#E5E3FF] rounded-xl text-sm bg-[#F7F6FF] text-left flex items-center justify-between focus:outline-none focus:border-[#5C4FE5] transition">
                <span className={selectedStudents.length === 0 ? 'text-[#7B78A8]' : 'text-[#1A1640] font-medium'}>
                  {selectedStudents.length === 0 ? '-- Pilih Siswa --' : `${selectedStudents.length} siswa dipilih`}
                </span>
                <ChevronDown size={16} className={`text-[#7B78A8] transition-transform duration-200 ${siswaOpen ? 'rotate-180' : ''}`}/>
              </button>

              {siswaOpen && (
                <div className="absolute z-30 mt-1.5 w-full bg-white rounded-xl border border-[#E5E3FF] shadow-lg overflow-hidden">
                  <div className="p-2 border-b border-[#E5E3FF]">
                    <div className="relative">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7B78A8]"/>
                      <input type="text" placeholder="Cari siswa..." value={siswaSearch}
                        onChange={e => setSiswaSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-[#E5E3FF] bg-[#F7F6FF] text-[#1A1640] placeholder:text-[#7B78A8] focus:outline-none focus:border-[#5C4FE5] transition"
                        autoFocus/>
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {filteredStudents.length === 0 ? (
                      <p className="text-center text-sm text-[#7B78A8] py-5">
                        {students.length === 0 ? 'Belum ada siswa terdaftar' : 'Siswa tidak ditemukan'}
                      </p>
                    ) : (
                      filteredStudents.map((s: any) => {
                        const isSelected = selectedStudents.includes(s.id)
                        const isDisabled = !isSelected && selectedStudents.length >= maxParticipants && !!form.class_type_id
                        return (
                          <button key={s.id} type="button"
                            onClick={() => !isDisabled && toggleStudent(s.id)}
                            disabled={isDisabled}
                            className={['w-full flex items-center justify-between px-4 py-2.5 text-sm text-left transition-colors',
                              isSelected ? 'bg-[#F0EEFF]' : 'hover:bg-[#F7F6FF]',
                              isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'].join(' ')}>
                            <div className="flex items-center gap-2">
                              <span className={isSelected ? 'font-semibold text-[#5C4FE5]' : 'text-[#1A1640]'}>
                                {s.profiles?.full_name ?? 'Siswa'}
                              </span>
                              {s.is_new && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#E6F4EC] text-[#1A5C36]">Baru</span>
                              )}
                            </div>
                            {isSelected && <Check size={15} className="text-[#5C4FE5] flex-shrink-0"/>}
                          </button>
                        )
                      })
                    )}
                  </div>
                  {selectedStudents.length > 0 && (
                    <div className="px-4 py-2 border-t border-[#E5E3FF] bg-[#F7F6FF] flex items-center justify-between">
                      <span className="text-xs text-[#7B78A8]">{selectedStudents.length} dipilih</span>
                      <button type="button" onClick={() => { setSelectedStudents([]); setSessionStartOffset(0) }}
                        className="text-xs text-red-400 hover:text-red-600 font-semibold transition-colors">
                        Hapus semua
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Chips */}
            {selectedStudents.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {selectedStudents.map(id => (
                  <span key={id} className="flex items-center gap-1.5 pl-3 pr-2 py-1 rounded-full text-xs font-semibold text-white bg-[#5C4FE5]">
                    {getStudentName(id)}
                    {isStudentNew(id) && <span className="text-[9px] bg-white/20 px-1 rounded-full">baru</span>}
                    <button type="button" onClick={() => toggleStudent(id)} className="hover:opacity-75 transition-opacity">
                      <X size={11}/>
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Pengaturan Paket */}
          {selectedStudents.length > 0 && (
            <div className="bg-[#F7F6FF] border border-[#E5E3FF] rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-[#7B78A8] uppercase tracking-wide">Pengaturan Paket Siswa</p>
                {allSelectedAreNew && (
                  <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-[#E6F4EC] text-[#1A5C36]">
                    ✓ Termasuk sesi perkenalan
                  </span>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">
                  Total Sesi dalam Paket <span className="normal-case font-normal text-[#7B78A8]">(default 8)</span>
                </label>
                <input type="number" min={1} max={100} value={sessionsTotal}
                  onChange={e => setSessionsTotal(Number(e.target.value))} className={inputClass}/>
                <p className="text-xs text-[#7B78A8] mt-1">1 paket normal = 8 sesi (seminggu 2x selama 1 bulan)</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">
                  Mulai dari Sesi ke- <span className="normal-case font-normal text-[#7B78A8]">(auto)</span>
                </label>
                <input type="number" min={0} max={sessionsTotal} value={sessionStartOffset}
                  onChange={e => setSessionStartOffset(Number(e.target.value))} className={inputClass}/>
                <p className="text-xs text-[#7B78A8] mt-1">
                  {sessionStartOffset === 0
                    ? '✨ Siswa baru — sesi pertama tampil sebagai 0/8 (perkenalan bonus)'
                    : sessionStartOffset === 1
                    ? 'Paket mulai dari awal (1/8)'
                    : `Lanjutan paket — sesi pertama tampil sebagai ${sessionStartOffset}/${sessionsTotal}`}
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 font-semibold">{error}</div>
          )}

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
