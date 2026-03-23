'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft, Plus, Check, UserPlus, BookOpen, CreditCard } from 'lucide-react'

const REGISTRATION_FEE_DEFAULT = 100000

function formatRp(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
}

const inputCls = "w-full px-3.5 py-2.5 border border-[#E5E3FF] rounded-xl text-sm bg-[#F7F6FF] text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] focus:bg-white transition"
const labelCls = "block text-[10px] font-bold text-[#7B78A8] uppercase tracking-wider mb-1.5"

export default function DaftarkanSiswaPage() {
  const supabase = createClient()
  const router   = useRouter()

  const [step, setStep] = useState(1)

  // ── Data referensi ──────────────────────────────────────────────────────
  const [allStudents,   setAllStudents]   = useState<any[]>([])
  const [allKelas,      setAllKelas]      = useState<any[]>([])
  const [allTutors,     setAllTutors]     = useState<any[]>([])
  const [allCourses,    setAllCourses]    = useState<any[]>([])
  const [allClassTypes, setAllClassTypes] = useState<any[]>([])
  const [loading,       setLoading]       = useState(true)

  // ── Step 1: Siswa ───────────────────────────────────────────────────────
  const [studentSearch,   setStudentSearch]   = useState('')
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null)
  const [showNewStudent,  setShowNewStudent]  = useState(false)
  const [nSiswaName,      setNSiswaName]      = useState('')
  const [nSiswaGrade,     setNSiswaGrade]     = useState('')
  const [nSiswaSchool,    setNSiswaSchool]    = useState('')
  const [nSiswaWa,        setNSiswaWa]        = useState('')
  const [savingSiswa,     setSavingSiswa]     = useState(false)
  const [siswaError,      setSiswaError]      = useState('')

  // ── Step 2: Kelas ───────────────────────────────────────────────────────
  const [selectedKelas,  setSelectedKelas]  = useState<any | null>(null)
  const [sessionTotal,   setSessionTotal]   = useState(8)
  const [sessionOffset,  setSessionOffset]  = useState(1)
  const [showNewKelas,   setShowNewKelas]   = useState(false)
  const [nKelasLabel,    setNKelasLabel]    = useState('')
  const [nKelasCourse,   setNKelasCourse]   = useState('')
  const [nKelasType,     setNKelasType]     = useState('')
  const [nKelasTutor,    setNKelasTutor]    = useState('')
  const [nKelasZoom,     setNKelasZoom]     = useState('')
  const [savingKelas,    setSavingKelas]    = useState(false)
  const [kelasError,     setKelasError]     = useState('')

  // ── Step 3: Tagihan ─────────────────────────────────────────────────────
  const [withTagihan,    setWithTagihan]    = useState(true)
  const [periodLabel,    setPeriodLabel]    = useState('')
  const [baseAmount,     setBaseAmount]     = useState(0)
  const [regFee,         setRegFee]         = useState(0)
  const [isNewStudent,   setIsNewStudent]   = useState(false)
  const [discount,       setDiscount]       = useState(0)
  const [discountNote,   setDiscountNote]   = useState('')
  const [method,         setMethod]         = useState('transfer')
  const [statusAwal,     setStatusAwal]     = useState('unpaid')
  const [waPhone,        setWaPhone]        = useState('')
  const [saving,         setSaving]         = useState(false)
  const [error,          setError]          = useState('')

  const totalTagihan = baseAmount + regFee - discount

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [
      { data: studs },
      { data: kelas },
      { data: tutors },
      { data: courses },
      { data: classTypes },
    ] = await Promise.all([
      supabase.from('students').select('id, profile_id, grade, school, relation_phone').order('created_at', { ascending: false }),
      supabase.from('class_groups').select('id, label, status, tutor_id, zoom_link, class_type_id, course_id, courses(name), class_types(name, base_price), tutors(profile_id, profiles(full_name))').eq('status', 'active').order('label'),
      supabase.from('tutors').select('id, profile_id, profiles(full_name)').eq('is_active', true),
      supabase.from('courses').select('id, name').order('name'),
      supabase.from('class_types').select('id, name, base_price').order('name'),
    ])

    // Resolve student names
    const profIds = [...new Set((studs ?? []).map((s: any) => s.profile_id).filter(Boolean))]
    const { data: profs } = profIds.length > 0
      ? await supabase.from('profiles').select('id, full_name').in('id', profIds)
      : { data: [] }
    const profMap = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.full_name]))
    const studentsWithName = (studs ?? []).map((s: any) => ({
      ...s,
      full_name: profMap[s.profile_id] ?? 'Siswa',
    }))

    setAllStudents(studentsWithName)
    setAllKelas(kelas ?? [])
    setAllTutors(tutors ?? [])
    setAllCourses(courses ?? [])
    setAllClassTypes(classTypes ?? [])
    setLoading(false)
  }

  // ── Step 1 handlers ──────────────────────────────────────────────────────
  function selectStudent(s: any) {
    setSelectedStudent(s)
    setStudentSearch('')
    setWaPhone(s.relation_phone ?? '')
    setShowNewStudent(false)
  }

  async function handleBuatSiswa() {
    if (!nSiswaName.trim()) { setSiswaError('Nama siswa tidak boleh kosong.'); return }
    setSavingSiswa(true); setSiswaError('')

    // Buat profile baru
    const { data: profile, error: profErr } = await supabase
      .from('profiles').insert({ full_name: nSiswaName.trim(), role: 'student' }).select('id').single()
    if (profErr || !profile) { setSiswaError(profErr?.message ?? 'Gagal buat profil'); setSavingSiswa(false); return }

    // Buat student
    const { data: newStudent, error: stuErr } = await supabase
      .from('students').insert({
        profile_id:     profile.id,
        grade:          nSiswaGrade.trim() || null,
        school:         nSiswaSchool.trim() || null,
        relation_phone: nSiswaWa.trim() || null,
      }).select('id, profile_id, grade, school, relation_phone').single()

    setSavingSiswa(false)
    if (stuErr || !newStudent) { setSiswaError(stuErr?.message ?? 'Gagal buat siswa'); return }

    const studentWithName = { ...newStudent, full_name: nSiswaName.trim() }
    setAllStudents(prev => [studentWithName, ...prev])
    selectStudent(studentWithName)
    setNSiswaName(''); setNSiswaGrade(''); setNSiswaSchool(''); setNSiswaWa('')
    setShowNewStudent(false)
  }

  // ── Step 2 handlers ──────────────────────────────────────────────────────
  function selectKelas(k: any) {
    setSelectedKelas(k)
    const basePrice = k.class_types?.base_price ?? 0
    setBaseAmount(basePrice)
    setShowNewKelas(false)
  }

  async function handleBuatKelas() {
    if (!nKelasLabel.trim()) { setKelasError('Nama kelas tidak boleh kosong.'); return }
    if (!nKelasCourse)       { setKelasError('Pilih mata pelajaran.'); return }
    if (!nKelasType)         { setKelasError('Pilih tipe kelas.'); return }
    setSavingKelas(true); setKelasError('')

    const { data: newKelas, error } = await supabase
      .from('class_groups').insert({
        label:         nKelasLabel.trim(),
        course_id:     nKelasCourse,
        class_type_id: nKelasType,
        tutor_id:      nKelasTutor || null,
        zoom_link:     nKelasZoom.trim() || null,
        status:        'active',
      }).select('id, label, status, tutor_id, zoom_link, class_type_id, course_id, courses(name), class_types(name, base_price), tutors(profile_id, profiles(full_name))').single()

    setSavingKelas(false)
    if (error || !newKelas) { setKelasError(error?.message ?? 'Gagal buat kelas'); return }

    setAllKelas(prev => [newKelas, ...prev])
    selectKelas(newKelas)
    setNKelasLabel(''); setNKelasCourse(''); setNKelasType(''); setNKelasTutor(''); setNKelasZoom('')
    setShowNewKelas(false)
  }

  // ── Step 3: Final submit ─────────────────────────────────────────────────
  async function handleSubmit(buatTagihan: boolean) {
    if (!selectedStudent || !selectedKelas) return
    setSaving(true); setError('')

    // 1. Enroll siswa ke kelas
    const { data: enrollment, error: enrollErr } = await supabase
      .from('enrollments').insert({
        student_id:           selectedStudent.id,
        class_group_id:       selectedKelas.id,
        sessions_total:       sessionTotal,
        session_start_offset: sessionOffset - 1,
        status:               'active',
      }).select('id').single()

    if (enrollErr || !enrollment) {
      setError(enrollErr?.message ?? 'Gagal mendaftarkan siswa'); setSaving(false); return
    }

    // 2. Buat tagihan kalau diminta
    if (buatTagihan) {
      if (!periodLabel) { setError('Isi periode tagihan.'); setSaving(false); return }
      if (totalTagihan <= 0) { setError('Total tagihan tidak valid.'); setSaving(false); return }

      const { error: payErr } = await supabase.from('payments').insert({
        student_id:       selectedStudent.id,
        enrollment_id:    enrollment.id,
        amount:           totalTagihan,
        base_amount:      baseAmount,
        registration_fee: regFee,
        discount_amount:  discount,
        discount_note:    discountNote || null,
        method,
        status:           statusAwal,
        period_label:     periodLabel,
        is_new_student:   isNewStudent,
        wa_phone:         waPhone || null,
      })

      if (payErr) { setError(payErr.message); setSaving(false); return }
    }

    setSaving(false)

    // Redirect ke jadwal kelas yang baru di-enroll
    router.push(`/admin/kelas/${selectedKelas.id}`)
  }

  const filteredStudents = allStudents.filter(s =>
    s.full_name.toLowerCase().includes(studentSearch.toLowerCase())
  ).slice(0, 8)

  // ── Stepper UI ───────────────────────────────────────────────────────────
  const steps = [
    { n: 1, label: 'Siswa',   icon: UserPlus },
    { n: 2, label: 'Kelas',   icon: BookOpen },
    { n: 3, label: 'Tagihan', icon: CreditCard },
  ]

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="text-sm text-[#7B78A8]">Memuat data...</div>
    </div>
  )

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()}
          className="p-2 rounded-xl hover:bg-[#F0EFFF] transition text-[#7B78A8]">
          <ChevronLeft size={18}/>
        </button>
        <div>
          <h1 className="text-xl font-black text-[#1A1640] font-['Sora']">Daftarkan Siswa</h1>
          <p className="text-xs text-[#7B78A8] mt-0.5">Enroll siswa ke kelas dan buat tagihan sekaligus</p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center mb-6">
        {steps.map((s, i) => (
          <div key={s.n} className="flex items-center flex-1">
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                step > s.n ? 'bg-[#5C4FE5] text-white' :
                step === s.n ? 'bg-[#5C4FE5] text-white ring-4 ring-[#EEEDFE]' :
                'bg-[#F0EFFF] text-[#7B78A8]'
              }`}>
                {step > s.n
                  ? <Check size={12}/>
                  : <s.icon size={12}/>
                }
              </div>
              <span className={`text-xs font-semibold ${step === s.n ? 'text-[#5C4FE5]' : 'text-[#7B78A8]'}`}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-px mx-3 ${step > s.n ? 'bg-[#5C4FE5]' : 'bg-[#E5E3FF]'}`}/>
            )}
          </div>
        ))}
      </div>

      {/* ════ STEP 1: SISWA ════ */}
      {step === 1 && (
        <div className="bg-white rounded-2xl border border-[#E5E3FF] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#F0EFFF] bg-[#F7F6FF] flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#5C4FE5] flex items-center justify-center">
              <UserPlus size={14} color="white"/>
            </div>
            <div>
              <p className="text-sm font-bold text-[#1A1640]">Pilih siswa</p>
              <p className="text-[10px] text-[#7B78A8]">Cari siswa yang sudah terdaftar atau tambah baru</p>
            </div>
          </div>
          <div className="px-5 py-4 space-y-4">

            {/* Siswa terpilih */}
            {selectedStudent ? (
              <div className="flex items-center gap-3 px-4 py-3 bg-[#EEEDFE] border border-[#CECBF6] rounded-xl">
                <div className="w-9 h-9 rounded-full bg-[#5C4FE5] flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                  {initials(selectedStudent.full_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[#3C3489] truncate">{selectedStudent.full_name}</p>
                  <p className="text-[10px] text-[#534AB7]">
                    {selectedStudent.grade ?? '—'}{selectedStudent.school ? ` · ${selectedStudent.school}` : ''}
                  </p>
                </div>
                <button onClick={() => setSelectedStudent(null)}
                  className="text-[10px] text-[#5C4FE5] font-semibold hover:underline flex-shrink-0">
                  Ganti
                </button>
              </div>
            ) : (
              <div>
                <label className={labelCls}>Cari siswa terdaftar</label>
                <input
                  type="text"
                  value={studentSearch}
                  onChange={e => setStudentSearch(e.target.value)}
                  placeholder="Ketik nama siswa..."
                  className={inputCls}
                />
                {studentSearch && filteredStudents.length > 0 && (
                  <div className="mt-1 border border-[#E5E3FF] rounded-xl overflow-hidden">
                    {filteredStudents.map(s => (
                      <button key={s.id} onClick={() => selectStudent(s)}
                        className="w-full text-left px-4 py-2.5 hover:bg-[#F7F6FF] transition flex items-center gap-3 border-b border-[#F0EFFF] last:border-0">
                        <div className="w-7 h-7 rounded-full bg-[#EEEDFE] flex items-center justify-center text-[10px] font-bold text-[#3C3489] flex-shrink-0">
                          {initials(s.full_name)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#1A1640] truncate">{s.full_name}</p>
                          <p className="text-[10px] text-[#7B78A8]">{s.grade ?? '—'}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {studentSearch && filteredStudents.length === 0 && (
                  <p className="text-xs text-[#7B78A8] mt-2 text-center py-2">Tidak ditemukan</p>
                )}
              </div>
            )}

            {/* Form siswa baru */}
            <div>
              <button onClick={() => setShowNewStudent(p => !p)}
                className="flex items-center gap-1.5 text-xs font-semibold text-[#5C4FE5] hover:underline">
                <Plus size={12}/>
                {showNewStudent ? 'Batal tambah siswa baru' : 'Tambah siswa baru'}
              </button>

              {showNewStudent && (
                <div className="mt-3 border border-[#E5E3FF] rounded-xl p-4 space-y-3 bg-[#F7F6FF]">
                  <div>
                    <label className={labelCls}>Nama lengkap *</label>
                    <input type="text" value={nSiswaName} onChange={e => setNSiswaName(e.target.value)}
                      placeholder="Nama siswa" className={inputCls}/>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Kelas</label>
                      <input type="text" value={nSiswaGrade} onChange={e => setNSiswaGrade(e.target.value)}
                        placeholder="Kelas 7" className={inputCls}/>
                    </div>
                    <div>
                      <label className={labelCls}>No. WA ortu</label>
                      <input type="text" value={nSiswaWa} onChange={e => setNSiswaWa(e.target.value)}
                        placeholder="628xxx" className={inputCls}/>
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Sekolah</label>
                    <input type="text" value={nSiswaSchool} onChange={e => setNSiswaSchool(e.target.value)}
                      placeholder="Nama sekolah" className={inputCls}/>
                  </div>
                  {siswaError && (
                    <p className="text-xs text-red-600 px-3 py-2 bg-red-50 rounded-lg border border-red-200">{siswaError}</p>
                  )}
                  <button onClick={handleBuatSiswa} disabled={savingSiswa}
                    className="w-full py-2.5 bg-[#5C4FE5] hover:bg-[#3D34C4] text-white font-bold rounded-xl text-sm transition disabled:opacity-60">
                    {savingSiswa ? 'Menyimpan...' : '+ Tambah & Pilih Siswa Ini'}
                  </button>
                </div>
              )}
            </div>

            {/* No. WA kalau siswa terpilih */}
            {selectedStudent && (
              <div>
                <label className={labelCls}>No. WhatsApp orang tua</label>
                <input type="text" value={waPhone} onChange={e => setWaPhone(e.target.value)}
                  placeholder="628xxx" className={inputCls}/>
              </div>
            )}
          </div>

          <div className="px-5 pb-5 flex gap-3">
            <button onClick={() => router.back()}
              className="px-5 py-2.5 border border-[#E5E3FF] text-[#7B78A8] font-semibold rounded-xl text-sm hover:bg-[#F7F6FF] transition">
              Batal
            </button>
            <button onClick={() => setStep(2)} disabled={!selectedStudent}
              className="flex-1 py-2.5 bg-[#5C4FE5] hover:bg-[#3D34C4] text-white font-bold rounded-xl text-sm transition disabled:opacity-40">
              Lanjut ke Kelas →
            </button>
          </div>
        </div>
      )}

      {/* ════ STEP 2: KELAS ════ */}
      {step === 2 && (
        <div className="bg-white rounded-2xl border border-[#E5E3FF] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#F0EFFF] bg-[#F7F6FF] flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#5C4FE5] flex items-center justify-center">
              <BookOpen size={14} color="white"/>
            </div>
            <div>
              <p className="text-sm font-bold text-[#1A1640]">Pilih kelas</p>
              <p className="text-[10px] text-[#7B78A8]">Pilih kelas yang ada atau buat kelas baru</p>
            </div>
          </div>
          <div className="px-5 py-4 space-y-4">

            {/* Kelas terpilih */}
            {selectedKelas ? (
              <div className="flex items-center gap-3 px-4 py-3 bg-[#E1F5EE] border border-[#9FE1CB] rounded-xl">
                <div className="w-9 h-9 rounded-xl bg-[#1D9E75] flex items-center justify-center flex-shrink-0">
                  <BookOpen size={14} color="white"/>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[#085041] truncate">{selectedKelas.label}</p>
                  <p className="text-[10px] text-[#0F6E56]">
                    {selectedKelas.class_types?.name ?? '—'}
                    {selectedKelas.courses?.name ? ` · ${selectedKelas.courses.name}` : ''}
                  </p>
                </div>
                <button onClick={() => setSelectedKelas(null)}
                  className="text-[10px] text-[#1D9E75] font-semibold hover:underline flex-shrink-0">
                  Ganti
                </button>
              </div>
            ) : (
              <div>
                <label className={labelCls}>Pilih kelas aktif</label>
                <select value="" onChange={e => {
                  const k = allKelas.find(k => k.id === e.target.value)
                  if (k) selectKelas(k)
                }} className={inputCls}>
                  <option value="">-- Pilih Kelas --</option>
                  {allKelas.map(k => (
                    <option key={k.id} value={k.id}>
                      {k.label} ({k.class_types?.name ?? '—'})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Form kelas baru */}
            <div>
              <button onClick={() => setShowNewKelas(p => !p)}
                className="flex items-center gap-1.5 text-xs font-semibold text-[#5C4FE5] hover:underline">
                <Plus size={12}/>
                {showNewKelas ? 'Batal buat kelas baru' : 'Buat kelas baru'}
              </button>

              {showNewKelas && (
                <div className="mt-3 border border-[#E5E3FF] rounded-xl p-4 space-y-3 bg-[#F7F6FF]">
                  <div>
                    <label className={labelCls}>Nama kelas *</label>
                    <input type="text" value={nKelasLabel} onChange={e => setNKelasLabel(e.target.value)}
                      placeholder="Contoh: Privat Matematika Kelas 8" className={inputCls}/>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Mata pelajaran *</label>
                      <select value={nKelasCourse} onChange={e => setNKelasCourse(e.target.value)} className={inputCls}>
                        <option value="">-- Pilih --</option>
                        {allCourses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Tipe kelas *</label>
                      <select value={nKelasType} onChange={e => {
                        setNKelasType(e.target.value)
                        const t = allClassTypes.find(t => t.id === e.target.value)
                        if (t) setBaseAmount(t.base_price ?? 0)
                      }} className={inputCls}>
                        <option value="">-- Pilih --</option>
                        {allClassTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Tutor (opsional)</label>
                    <select value={nKelasTutor} onChange={e => setNKelasTutor(e.target.value)} className={inputCls}>
                      <option value="">-- Pilih Tutor --</option>
                      {allTutors.map(t => {
                        const name = Array.isArray(t.profiles) ? t.profiles[0]?.full_name : t.profiles?.full_name
                        return <option key={t.id} value={t.id}>{name ?? 'Tutor'}</option>
                      })}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Link Zoom (opsional)</label>
                    <input type="url" value={nKelasZoom} onChange={e => setNKelasZoom(e.target.value)}
                      placeholder="https://zoom.us/..." className={inputCls}/>
                  </div>
                  {kelasError && (
                    <p className="text-xs text-red-600 px-3 py-2 bg-red-50 rounded-lg border border-red-200">{kelasError}</p>
                  )}
                  <button onClick={handleBuatKelas} disabled={savingKelas}
                    className="w-full py-2.5 bg-[#5C4FE5] hover:bg-[#3D34C4] text-white font-bold rounded-xl text-sm transition disabled:opacity-60">
                    {savingKelas ? 'Membuat kelas...' : '+ Buat & Pilih Kelas Ini'}
                  </button>
                </div>
              )}
            </div>

            {/* Paket sesi */}
            {selectedKelas && (
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#F0EFFF]">
                <div>
                  <label className={labelCls}>Jumlah sesi paket</label>
                  <input type="number" min={1} max={100} value={sessionTotal}
                    onChange={e => setSessionTotal(Number(e.target.value))} className={inputCls}/>
                </div>
                <div>
                  <label className={labelCls}>Mulai dari sesi ke</label>
                  <input type="number" min={1} max={sessionTotal} value={sessionOffset}
                    onChange={e => setSessionOffset(Number(e.target.value))} className={inputCls}/>
                </div>
              </div>
            )}
          </div>

          <div className="px-5 pb-5 flex gap-3">
            <button onClick={() => setStep(1)}
              className="px-5 py-2.5 border border-[#E5E3FF] text-[#7B78A8] font-semibold rounded-xl text-sm hover:bg-[#F7F6FF] transition">
              ← Kembali
            </button>
            <button onClick={() => setStep(3)} disabled={!selectedKelas}
              className="flex-1 py-2.5 bg-[#5C4FE5] hover:bg-[#3D34C4] text-white font-bold rounded-xl text-sm transition disabled:opacity-40">
              Lanjut ke Tagihan →
            </button>
          </div>
        </div>
      )}

      {/* ════ STEP 3: TAGIHAN ════ */}
      {step === 3 && (
        <div className="bg-white rounded-2xl border border-[#E5E3FF] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#F0EFFF] bg-[#F7F6FF] flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#1D9E75] flex items-center justify-center">
              <CreditCard size={14} color="white"/>
            </div>
            <div>
              <p className="text-sm font-bold text-[#1A1640]">Buat tagihan</p>
              <p className="text-[10px] text-[#7B78A8]">Opsional — bisa dibuat nanti dari menu Pembayaran</p>
            </div>
          </div>
          <div className="px-5 py-4 space-y-4">

            {/* Ringkasan */}
            <div className="bg-[#F7F6FF] border border-[#E5E3FF] rounded-xl p-4 space-y-2">
              <p className="text-[10px] font-bold text-[#7B78A8] uppercase tracking-wider mb-2">Ringkasan</p>
              {[
                { label: 'Siswa', value: selectedStudent?.full_name },
                { label: 'Kelas', value: selectedKelas?.label },
                { label: 'Paket', value: `${sessionTotal} sesi · Mulai sesi ${sessionOffset}` },
              ].map(r => (
                <div key={r.label} className="flex justify-between">
                  <span className="text-xs text-[#7B78A8]">{r.label}</span>
                  <span className="text-xs font-semibold text-[#1A1640]">{r.value}</span>
                </div>
              ))}
            </div>

            {/* Toggle tagihan */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={withTagihan}
                onChange={e => setWithTagihan(e.target.checked)}
                className="accent-[#5C4FE5] w-4 h-4"/>
              <span className="text-sm font-semibold text-[#1A1640]">Buat tagihan sekarang</span>
            </label>

            {withTagihan && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Periode *</label>
                    <input type="text" value={periodLabel} onChange={e => setPeriodLabel(e.target.value)}
                      placeholder="April 2026" className={inputCls}/>
                  </div>
                  <div>
                    <label className={labelCls}>Metode</label>
                    <select value={method} onChange={e => setMethod(e.target.value)} className={inputCls}>
                      <option value="transfer">Transfer Bank</option>
                      <option value="cash">Tunai</option>
                    </select>
                  </div>
                </div>

                <div className="bg-[#F7F6FF] border border-[#E5E3FF] rounded-xl p-4 space-y-3">
                  <p className="text-[10px] font-bold text-[#7B78A8] uppercase tracking-wider">Rincian biaya</p>
                  <div>
                    <label className={labelCls}>Biaya paket</label>
                    <input type="number" value={baseAmount} onChange={e => setBaseAmount(Number(e.target.value))} className={inputCls}/>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[10px] font-bold text-[#7B78A8] uppercase tracking-wider">Biaya pendaftaran</label>
                      <label className="flex items-center gap-1.5 text-xs text-[#7B78A8] cursor-pointer">
                        <input type="checkbox" checked={isNewStudent}
                          onChange={e => { setIsNewStudent(e.target.checked); setRegFee(e.target.checked ? REGISTRATION_FEE_DEFAULT : 0) }}
                          className="accent-[#5C4FE5]"/>
                        Siswa baru
                      </label>
                    </div>
                    <input type="number" value={regFee} onChange={e => setRegFee(Number(e.target.value))}
                      disabled={!isNewStudent} className={`${inputCls} ${!isNewStudent ? 'opacity-40' : ''}`}/>
                  </div>
                  <div>
                    <label className={labelCls}>Diskon <span className="normal-case font-normal">(opsional)</span></label>
                    <input type="number" value={discount} onChange={e => setDiscount(Number(e.target.value))}
                      placeholder="0" className={inputCls}/>
                    {discount > 0 && (
                      <input type="text" value={discountNote} onChange={e => setDiscountNote(e.target.value)}
                        placeholder="Alasan diskon" className={`${inputCls} mt-2`}/>
                    )}
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-[#E5E3FF]">
                    <span className="text-sm font-bold text-[#1A1640]">Total tagihan</span>
                    <span className="text-lg font-black text-[#5C4FE5]">{formatRp(totalTagihan)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Status awal</label>
                    <select value={statusAwal} onChange={e => setStatusAwal(e.target.value)} className={inputCls}>
                      <option value="unpaid">Belum Bayar</option>
                      <option value="pending">Menunggu Konfirmasi</option>
                      <option value="paid">Lunas</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>No. WA ortu</label>
                    <input type="text" value={waPhone} onChange={e => setWaPhone(e.target.value)}
                      placeholder="628xxx" className={inputCls}/>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 font-semibold">
                {error}
              </div>
            )}
          </div>

          <div className="px-5 pb-5 flex gap-3">
            <button onClick={() => setStep(2)}
              className="px-5 py-2.5 border border-[#E5E3FF] text-[#7B78A8] font-semibold rounded-xl text-sm hover:bg-[#F7F6FF] transition">
              ← Kembali
            </button>
            <button onClick={() => handleSubmit(false)} disabled={saving}
              className="flex-1 py-2.5 border border-[#5C4FE5] text-[#5C4FE5] font-bold rounded-xl text-sm hover:bg-[#F0EFFF] transition disabled:opacity-40">
              {saving ? '...' : 'Daftarkan Saja'}
            </button>
            <button onClick={() => handleSubmit(true)} disabled={saving}
              className="flex-1 py-2.5 bg-[#5C4FE5] hover:bg-[#3D34C4] text-white font-bold rounded-xl text-sm transition disabled:opacity-40">
              {saving ? 'Menyimpan...' : 'Daftarkan + Tagih'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
