'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { ChevronDown, X, Search, Check } from 'lucide-react'

interface Tutor {
  id: string
  profile_id: string
  profiles: { full_name: string } | null
}

interface Siswa {
  id: string
  profile_id: string
  profiles: { full_name: string } | null
}

interface Kursus {
  id: string
  name: string
}

const TIPE_KELAS = [
  { value: 'Reguler', label: 'Reguler (maks 8 siswa)' },
  { value: 'Semi Privat', label: 'Semi Privat (maks 4 siswa)' },
  { value: 'Privat', label: 'Privat (1 siswa)' },
]

const STATUS_KELAS = ['Aktif', 'Tidak Aktif', 'Selesai']

export default function KelasBaruPage() {
  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Form state
  const [namaKelas, setNamaKelas] = useState('')
  const [kursusId, setKursusId] = useState('')
  const [tipeKelas, setTipeKelas] = useState('')
  const [tutorId, setTutorId] = useState('')
  const [zoomLink, setZoomLink] = useState('')
  const [status, setStatus] = useState('Aktif')
  const [selectedSiswa, setSelectedSiswa] = useState<string[]>([])

  // Data
  const [kursusList, setKursusList] = useState<Kursus[]>([])
  const [tutorList, setTutorList] = useState<Tutor[]>([])
  const [siswaList, setSiswaList] = useState<Siswa[]>([])

  // UI state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [siswaOpen, setSiswaOpen] = useState(false)
  const [siswaSearch, setSiswaSearch] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    // Fetch kursus
    const { data: kursus } = await supabase.from('courses').select('id, name').order('name')
    setKursusList((kursus as Kursus[]) ?? [])

    // Fetch tutors — two step (FK not registered in Supabase)
    const { data: tutors } = await supabase.from('tutors').select('id, profile_id')
    if (tutors && tutors.length > 0) {
      const tIds = (tutors as any[]).map(t => t.profile_id).filter(Boolean)
      const { data: tProfiles } = await supabase.from('profiles').select('id, full_name').in('id', tIds)
      const tMap = Object.fromEntries(((tProfiles ?? []) as any[]).map(p => [p.id, p]))
      setTutorList((tutors as any[]).map(t => ({ ...t, profiles: tMap[t.profile_id] ?? null })))
    }

    // Fetch students — two step (FK not registered in Supabase)
    const { data: students } = await supabase.from('students').select('id, profile_id')
    if (students && students.length > 0) {
      const sIds = (students as any[]).map(s => s.profile_id).filter(Boolean)
      const { data: sProfiles } = await supabase.from('profiles').select('id, full_name').in('id', sIds)
      const sMap = Object.fromEntries(((sProfiles ?? []) as any[]).map(p => [p.id, p]))
      setSiswaList((students as any[]).map(s => ({ ...s, profiles: sMap[s.profile_id] ?? null })))
    }
  }

  const filteredSiswa = siswaList.filter(s =>
    s.profiles?.full_name?.toLowerCase().includes(siswaSearch.toLowerCase())
  )

  function toggleSiswa(id: string) {
    setSelectedSiswa(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  function getSiswaName(id: string) {
    return siswaList.find(s => s.id === id)?.profiles?.full_name ?? id
  }

  async function handleSubmit() {
    if (!namaKelas || !kursusId || !tipeKelas || !tutorId) {
      setError('Nama kelas, mata pelajaran, tipe kelas, dan tutor wajib diisi.')
      return
    }
    setLoading(true)
    setError(null)

    const maxMap: Record<string, number> = {
      Reguler: 8,
      'Semi Privat': 4,
      Privat: 1,
    }

    const { data: kelas, error: kelasErr } = await supabase
      .from('class_groups')
      .insert({
        name: namaKelas,
        course_id: kursusId,
        class_type: tipeKelas,
        tutor_id: tutorId,
        zoom_link: zoomLink || null,
        status,
        max_participants: maxMap[tipeKelas] ?? 8,
      })
      .select()
      .single()

    if (kelasErr) {
      setError(kelasErr.message)
      setLoading(false)
      return
    }

    // Enroll selected siswa
    if (selectedSiswa.length > 0) {
      const enrollments = selectedSiswa.map(studentId => ({
        class_group_id: kelas.id,
        student_id: studentId,
      }))
      await supabase.from('enrollments').insert(enrollments)
    }

    setLoading(false)
    router.push('/admin/kelas')
  }

  const inputClass = `
    w-full px-4 py-2.5 text-sm rounded-xl border outline-none transition-all
    focus:ring-2 focus:ring-[#5C4FE5]/30 focus:border-[#5C4FE5]
    bg-[#F7F6FF] border-[#E5E3FF] text-gray-800
  `

  const labelClass = "block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5"

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Buat Kelas Baru</h1>
        <p className="text-sm text-gray-500 mt-0.5">Isi detail kelas yang akan dibuat</p>
      </div>

      <div className="bg-white rounded-2xl border p-6 space-y-5" style={{ borderColor: '#E5E3FF' }}>

        {/* Nama Kelas */}
        <div>
          <label className={labelClass}>Nama Kelas <span className="text-red-400">*</span></label>
          <input
            type="text"
            placeholder="Contoh: Inggris Reguler A — Maret 2026"
            value={namaKelas}
            onChange={e => setNamaKelas(e.target.value)}
            className={inputClass}
          />
          <p className="text-xs text-gray-400 mt-1">Nama unik untuk mengidentifikasi kelas ini</p>
        </div>

        {/* Mata Pelajaran + Tipe Kelas */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Mata Pelajaran <span className="text-red-400">*</span></label>
            <select value={kursusId} onChange={e => setKursusId(e.target.value)} className={inputClass}>
              <option value="">-- Pilih Kursus --</option>
              {kursusList.map(k => (
                <option key={k.id} value={k.id}>{k.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Tipe Kelas <span className="text-red-400">*</span></label>
            <select value={tipeKelas} onChange={e => setTipeKelas(e.target.value)} className={inputClass}>
              <option value="">-- Pilih Tipe --</option>
              {TIPE_KELAS.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Tutor */}
        <div>
          <label className={labelClass}>Tutor <span className="text-red-400">*</span></label>
          <select value={tutorId} onChange={e => setTutorId(e.target.value)} className={inputClass}>
            <option value="">-- Pilih Tutor --</option>
            {tutorList.map(t => (
              <option key={t.id} value={t.id}>{t.profiles?.full_name}</option>
            ))}
          </select>
        </div>

        {/* Link Zoom */}
        <div>
          <label className={labelClass}>Link Zoom <span className="text-gray-400 normal-case font-normal">(Opsional)</span></label>
          <input
            type="text"
            placeholder="https://zoom.us/j/xxxxxxxxxxx"
            value={zoomLink}
            onChange={e => setZoomLink(e.target.value)}
            className={inputClass}
          />
        </div>

        {/* Status Kelas */}
        <div>
          <label className={labelClass}>Status Kelas</label>
          <select value={status} onChange={e => setStatus(e.target.value)} className={inputClass}>
            {STATUS_KELAS.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Daftarkan Siswa — multi-select dropdown */}
        <div>
          <label className={labelClass}>
            Daftarkan Siswa{' '}
            <span className="text-gray-400 normal-case font-normal">(Opsional)</span>
          </label>

          {/* Dropdown trigger */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setSiswaOpen(o => !o)}
              className="w-full px-4 py-2.5 text-sm rounded-xl border outline-none text-left flex items-center justify-between transition-all bg-[#F7F6FF] border-[#E5E3FF] focus:ring-2 focus:ring-[#5C4FE5]/30 focus:border-[#5C4FE5]"
            >
              <span className={selectedSiswa.length === 0 ? 'text-gray-400' : 'text-gray-800'}>
                {selectedSiswa.length === 0
                  ? '-- Pilih Siswa --'
                  : `${selectedSiswa.length} siswa dipilih`}
              </span>
              <ChevronDown
                size={16}
                className={`text-gray-400 transition-transform ${siswaOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {/* Dropdown panel */}
            {siswaOpen && (
              <div
                className="absolute z-20 mt-1.5 w-full bg-white rounded-xl border shadow-lg overflow-hidden"
                style={{ borderColor: '#E5E3FF' }}
              >
                {/* Search inside dropdown */}
                <div className="p-2 border-b" style={{ borderColor: '#E5E3FF' }}>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Cari siswa..."
                      value={siswaSearch}
                      onChange={e => setSiswaSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border outline-none bg-[#F7F6FF] border-[#E5E3FF] focus:border-[#5C4FE5]"
                      autoFocus
                    />
                  </div>
                </div>

                {/* Options */}
                <div className="max-h-52 overflow-y-auto">
                  {filteredSiswa.length === 0 ? (
                    <p className="text-center text-sm text-gray-400 py-6">Siswa tidak ditemukan</p>
                  ) : (
                    filteredSiswa.map(s => {
                      const selected = selectedSiswa.includes(s.id)
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => toggleSiswa(s.id)}
                          className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-left hover:bg-[#F7F6FF] transition-colors"
                        >
                          <span className={selected ? 'font-medium text-[#5C4FE5]' : 'text-gray-700'}>
                            {s.profiles?.full_name}
                          </span>
                          {selected && <Check size={15} className="text-[#5C4FE5] flex-shrink-0" />}
                        </button>
                      )
                    })
                  )}
                </div>

                {/* Footer */}
                {selectedSiswa.length > 0 && (
                  <div
                    className="px-4 py-2 border-t flex items-center justify-between"
                    style={{ borderColor: '#E5E3FF', backgroundColor: '#F7F6FF' }}
                  >
                    <span className="text-xs text-gray-500">{selectedSiswa.length} dipilih</span>
                    <button
                      type="button"
                      onClick={() => setSelectedSiswa([])}
                      className="text-xs text-red-400 hover:text-red-600 font-medium"
                    >
                      Hapus semua
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Selected siswa chips */}
          {selectedSiswa.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {selectedSiswa.map(id => (
                <span
                  key={id}
                  className="flex items-center gap-1.5 pl-3 pr-2 py-1 text-xs font-medium rounded-full text-white"
                  style={{ backgroundColor: '#5C4FE5' }}
                >
                  {getSiswaName(id)}
                  <button
                    type="button"
                    onClick={() => toggleSiswa(id)}
                    className="hover:opacity-75 transition-opacity"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600">
            ⚠️ {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-60"
            style={{ backgroundColor: '#5C4FE5' }}
          >
            {loading ? 'Menyimpan...' : 'Buat Kelas'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/admin/kelas')}
            className="px-6 py-3 rounded-xl text-sm font-semibold text-gray-600 border transition-colors hover:bg-gray-50"
            style={{ borderColor: '#E5E3FF' }}
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  )
}
