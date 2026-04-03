'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Eye, EyeOff } from 'lucide-react'

type Course = { id: string; name: string; color: string | null }
type Achievement = { name: string; category: string; issuer: string; year: string }

const CATEGORIES = [
  { value: 'pelatihan',   label: 'Pelatihan',   color: '#EEEDFE', textColor: '#3C3489' },
  { value: 'sertifikasi', label: 'Sertifikasi', color: '#E6F4EC', textColor: '#1A5C36' },
  { value: 'prestasi',    label: 'Prestasi',    color: '#FEF3E2', textColor: '#92400E' },
  { value: 'komunitas',   label: 'Komunitas',   color: '#E6F1FB', textColor: '#185FA5' },
]

const EDU_LEVELS = ['SMA/SMK', 'D3', 'S1', 'S2', 'S3']

export default function TutorEditPage() {
  const params   = useParams()
  const router   = useRouter()
  const tutorId  = params.id as string
  const supabase = createClient()

  const [courses,         setCourses]         = useState<Course[]>([])
  const [selectedCourses, setSelectedCourses] = useState<string[]>([])
  const [achievements,    setAchievements]    = useState<Achievement[]>([])
  const [subjects,        setSubjects]        = useState<string[]>([])
  const [subjectInput,    setSubjectInput]    = useState('')
  const [profileId,       setProfileId]       = useState('')
  const [loading,         setLoading]         = useState(true)
  const [saving,          setSaving]          = useState(false)
  const [error,           setError]           = useState('')
  const [success,         setSuccess]         = useState(false)

  // Password reset state
  const [tutorPassword,   setTutorPassword]   = useState('')
  const [showPassword,    setShowPassword]    = useState(false)
  const [savingPassword,  setSavingPassword]  = useState(false)
  const [passwordError,   setPasswordError]   = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')

  const [form, setForm] = useState({
    full_name:                 '',
    phone:                     '',
    email:                     '',
    rate_per_session:          '',
    bank_name:                 '',
    bank_account:              '',
    bank_holder:               '',
    is_active:                 true,
    tutor_type:                'internal',
    is_owner:                  false,
    bimbel_name:               '',
    education_level:           '',
    education_major:           '',
    education_university:      '',
    education_year:            '',
    teaching_experience_years: '',
    previous_workplaces:       '',
    bio:                       '',
  })

  const [newAch, setNewAch] = useState<Achievement>({ name: '', category: 'pelatihan', issuer: '', year: '' })

  useEffect(() => { fetchData() }, [tutorId])

  async function fetchData() {
    setLoading(true)

    // Fetch semua kursus
    const { data: allCourses } = await supabase.from('courses').select('id, name, color').eq('is_active', true)
    setCourses(allCourses ?? [])

    // Fetch tutor
    const { data: tRaw } = await supabase
      .from('tutors')
      .select(`id, profile_id, rate_per_session, bank_name, bank_account, bank_holder, is_active,
        education_level, education_major, education_university, education_year,
        subjects, teaching_experience_years, previous_workplaces, bio, achievements,
        profiles:profile_id(full_name, phone, email),
        tutor_courses(course_id)`)
      .eq('id', tutorId).single()
    const t = tRaw as any

    if (!t) { setLoading(false); return }

    setProfileId(t.profile_id)
    setSelectedCourses(t.tutor_courses?.map((tc: any) => tc.course_id) ?? [])
    setAchievements(t.achievements ?? [])
    setSubjects(t.subjects ?? [])

    setForm({
      full_name:                 t.profiles?.full_name ?? '',
      phone:                     t.profiles?.phone ?? '',
      email:                     t.profiles?.email ?? '',
      rate_per_session:          t.rate_per_session?.toString() ?? '',
      bank_name:                 t.bank_name ?? '',
      bank_account:              t.bank_account ?? '',
      bank_holder:               t.bank_holder ?? '',
      is_active:                 t.is_active ?? true,
      tutor_type:                t.tutor_type ?? 'internal',
      is_owner:                  t.is_owner ?? false,
      bimbel_name:               t.bimbel_name ?? '',
      education_level:           t.education_level ?? '',
      education_major:           t.education_major ?? '',
      education_university:      t.education_university ?? '',
      education_year:            t.education_year?.toString() ?? '',
      teaching_experience_years: t.teaching_experience_years?.toString() ?? '',
      previous_workplaces:       t.previous_workplaces ?? '',
      bio:                       t.bio ?? '',
    })

    setLoading(false)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value, type } = e.target
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }))
  }

  function toggleCourse(id: string) {
    setSelectedCourses(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])
  }

  function addSubject() {
    const s = subjectInput.trim()
    if (s && !subjects.includes(s)) setSubjects(prev => [...prev, s])
    setSubjectInput('')
  }

  function removeSubject(s: string) { setSubjects(prev => prev.filter(x => x !== s)) }

  function addAchievement() {
    if (!newAch.name.trim()) return
    setAchievements(prev => [...prev, { ...newAch }])
    setNewAch({ name: '', category: 'pelatihan', issuer: '', year: '' })
  }

  function removeAchievement(idx: number) { setAchievements(prev => prev.filter((_, i) => i !== idx)) }

  async function handleResetPassword() {
    if (!tutorPassword || tutorPassword.length < 6) {
      setPasswordError('Password baru minimal 6 karakter.')
      return
    }
    setSavingPassword(true)
    setPasswordError('')
    setPasswordSuccess('')

    try {
      const res = await fetch('/api/admin/create-user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_id: profileId, password: tutorPassword }),
      })
      const json = await res.json()
      if (!res.ok) {
        setPasswordError(json.error ?? 'Gagal reset password.')
        setSavingPassword(false)
        return
      }
      setTutorPassword('')
      setPasswordSuccess('Password tutor berhasil direset!')
    } catch (err: any) {
      setPasswordError(err.message ?? 'Terjadi kesalahan.')
    }
    setSavingPassword(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.full_name.trim()) { setError('Nama tutor wajib diisi.'); return }
    if (selectedCourses.length === 0) { setError('Pilih minimal 1 kursus.'); return }

    setSaving(true); setError('')

    // Update profile
    const { error: profileErr } = await supabase
      .from('profiles')
      .update({ full_name: form.full_name.trim(), phone: form.phone.trim() || null, email: form.email.trim() || null })
      .eq('id', profileId)

    if (profileErr) { setError(profileErr.message); setSaving(false); return }

    // Update tutor
    const { error: tutorErr } = await supabase
      .from('tutors')
      .update({
        rate_per_session:          form.rate_per_session ? parseInt(form.rate_per_session) : 0,
        bank_name:                 form.bank_name.trim() || null,
        bank_account:              form.bank_account.trim() || null,
        bank_holder:               form.bank_holder.trim() || null,
        is_active:                 form.is_active,
        tutor_type:                form.tutor_type,
        is_owner:                  form.is_owner,
        bimbel_name:               form.bimbel_name.trim() || null,
        education_level:           form.education_level || null,
        education_major:           form.education_major.trim() || null,
        education_university:      form.education_university.trim() || null,
        education_year:            form.education_year ? parseInt(form.education_year) : null,
        subjects:                  subjects.length > 0 ? subjects : null,
        teaching_experience_years: form.teaching_experience_years ? parseInt(form.teaching_experience_years) : null,
        previous_workplaces:       form.previous_workplaces.trim() || null,
        bio:                       form.bio.trim() || null,
        achievements:              achievements,
      })
      .eq('id', tutorId)

    if (tutorErr) { setError(tutorErr.message); setSaving(false); return }

    // Update kursus — hapus lama, insert baru
    await supabase.from('tutor_courses').delete().eq('tutor_id', tutorId)
    if (selectedCourses.length > 0) {
      await supabase.from('tutor_courses').insert(selectedCourses.map(courseId => ({ tutor_id: tutorId, course_id: courseId })))
    }

    setSaving(false); setSuccess(true)
    setTimeout(() => router.push(`/admin/tutor/${tutorId}`), 1200)
  }

  const inputCls = "w-full px-3.5 py-2.5 border border-[#E5E3FF] rounded-xl text-sm bg-[#F7F6FF] text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] focus:bg-white transition"
  const labelCls = "block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5"
  const sectionCls = "bg-white rounded-2xl border border-[#E5E3FF] p-6 space-y-4"

  if (loading) return <div className="p-6 text-sm text-[#7B78A8]">Memuat data tutor...</div>

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/admin/tutor/${tutorId}`} className="text-[#7B78A8] hover:text-[#5C4FE5] transition-colors">← Kembali</Link>
        <h1 className="text-2xl font-black text-[#1A1640]" style={{fontFamily:'Sora,sans-serif'}}>Edit Tutor</h1>
      </div>

      {success && (
        <div className="mb-4 px-4 py-3 bg-[#E6F4EC] border border-green-200 rounded-xl text-sm text-green-700 font-semibold">
          ✅ Data tutor berhasil diperbarui! Mengalihkan...
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* JENIS TUTOR */}
        <div className={sectionCls}>
          <p className="text-xs font-bold text-[#7B78A8] uppercase tracking-wide">Jenis Tutor</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: 'owner',    label: '👑 Owner',      desc: 'Akses penuh semua materi',   color: 'border-purple-400 bg-purple-50' },
              { value: 'internal', label: '👤 Freelancer', desc: 'Akses terbatas waktu kelas', color: 'border-green-400 bg-green-50' },
              { value: 'b2b',      label: '🏢 B2B',        desc: 'Tutor dari bimbel mitra',    color: 'border-blue-400 bg-blue-50' },
            ].map(opt => (
              <button type="button" key={opt.value}
                onClick={() => setForm(prev => ({
                  ...prev,
                  tutor_type: opt.value,
                  is_owner: opt.value === 'owner',
                }))}
                className={`p-3 rounded-xl border-2 text-left transition-all
                  ${form.tutor_type === opt.value ? opt.color + ' ring-2 ring-offset-1 ring-[#5C4FE5]' : 'border-[#E5E3FF] hover:border-[#5C4FE5]'}`}>
                <p className="font-bold text-sm text-[#1A1640]">{opt.label}</p>
                <p className="text-xs text-[#7B78A8] mt-0.5">{opt.desc}</p>
              </button>
            ))}
          </div>
          {form.tutor_type === 'b2b' && (
            <div>
              <label className={labelCls}>Nama Bimbel *</label>
              <input name="bimbel_name" value={form.bimbel_name} onChange={handleChange}
                placeholder="Nama bimbel mitra..." className={inputCls} />
            </div>
          )}
        </div>

        {/* DATA PRIBADI */}
        <div className={sectionCls}>
          <p className="text-xs font-bold text-[#7B78A8] uppercase tracking-wide">Data Pribadi</p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Nama Lengkap <span className="text-red-500">*</span></label>
              <input type="text" name="full_name" value={form.full_name} onChange={handleChange} placeholder="Nama tutor" className={inputCls}/>
            </div>
            <div>
              <label className={labelCls}>Nomor HP</label>
              <input type="tel" name="phone" value={form.phone} onChange={handleChange} placeholder="08xxxxxxxxxx" className={inputCls}/>
            </div>
          </div>

          <div>
            <label className={labelCls}>Email <span className="normal-case font-normal text-[#7B78A8]">(opsional)</span></label>
            <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="email@contoh.com" className={inputCls}/>
          </div>

          {/* Kursus */}
          <div>
            <label className={labelCls}>Kursus yang Dikuasai <span className="text-red-500">*</span></label>
            <div className="flex flex-wrap gap-2">
              {courses.map(c => (
                <button key={c.id} type="button" onClick={() => toggleCourse(c.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${selectedCourses.includes(c.id) ? 'text-white border-transparent' : 'bg-white border-[#E5E3FF] text-[#4A4580]'}`}
                  style={selectedCourses.includes(c.id) ? { background: c.color ?? '#5C4FE5', borderColor: c.color ?? '#5C4FE5' } : {}}>
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* Mata pelajaran unggulan */}
          <div>
            <label className={labelCls}>Mata Pelajaran Unggulan <span className="normal-case font-normal text-[#7B78A8]">(opsional)</span></label>
            <div className="flex gap-2 mb-2">
              <input type="text" value={subjectInput} onChange={e => setSubjectInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSubject() } }}
                placeholder="Contoh: TOEFL Prep, Speaking..." className={`${inputCls} flex-1`}/>
              <button type="button" onClick={addSubject}
                className="px-3 py-2 bg-[#5C4FE5] text-white rounded-xl text-sm font-bold hover:bg-[#3D34C4] transition">
                <Plus size={14}/>
              </button>
            </div>
            {subjects.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {subjects.map(s => (
                  <span key={s} className="flex items-center gap-1.5 pl-3 pr-2 py-1 rounded-full text-xs font-semibold bg-[#EEEDFE] text-[#3C3489]">
                    {s}
                    <button type="button" onClick={() => removeSubject(s)} className="hover:opacity-60 transition"><Trash2 size={10}/></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <input type="checkbox" id="is_active" name="is_active" checked={form.is_active} onChange={handleChange} className="w-4 h-4 accent-[#5C4FE5]"/>
            <label htmlFor="is_active" className="text-sm font-semibold text-[#4A4580]">Tutor aktif</label>
          </div>
        </div>

        {/* RESET PASSWORD TUTOR */}
        <div className={sectionCls}>
          <p className="text-xs font-bold text-[#7B78A8] uppercase tracking-wide">Reset Password Tutor</p>
          
          <div className="px-4 py-3 bg-[#F7F6FF] border border-[#E5E3FF] rounded-xl">
            <p className="text-xs text-[#7B78A8]">
              Gunakan fitur ini untuk set password login tutor ke dashboard tutor.
            </p>
          </div>

          <div>
            <label className={labelCls}>Password Baru</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={tutorPassword}
                onChange={e => setTutorPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                className={inputCls}
              />
              <button type="button" onClick={() => setShowPassword(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7B78A8] hover:text-[#5C4FE5]">
                {showPassword ? <EyeOff size={15}/> : <Eye size={15}/>}
              </button>
            </div>
          </div>

          {passwordError   && <p className="text-xs text-red-600 font-semibold">{passwordError}</p>}
          {passwordSuccess && <p className="text-xs text-green-600 font-semibold">✅ {passwordSuccess}</p>}

          <button type="button" onClick={handleResetPassword} disabled={savingPassword}
            className="w-full py-2.5 border border-[#5C4FE5] text-[#5C4FE5] font-bold rounded-xl text-sm hover:bg-[#EAE8FD] transition disabled:opacity-60">
            {savingPassword ? 'Menyimpan...' : 'Reset Password Tutor'}
          </button>
        </div>

        {/* REKENING */}
        <div className={sectionCls}>
          <p className="text-xs font-bold text-[#7B78A8] uppercase tracking-wide">Info Rekening <span className="normal-case font-normal">(opsional)</span></p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Nama Bank</label>
              <input type="text" name="bank_name" value={form.bank_name} onChange={handleChange} placeholder="BCA, BRI..." className={inputCls}/>
            </div>
            <div>
              <label className={labelCls}>No. Rekening</label>
              <input type="text" name="bank_account" value={form.bank_account} onChange={handleChange} placeholder="1234567890" className={inputCls}/>
            </div>
            <div>
              <label className={labelCls}>Atas Nama</label>
              <input type="text" name="bank_holder" value={form.bank_holder} onChange={handleChange} placeholder="Nama pemilik" className={inputCls}/>
            </div>
          </div>
          <div>
            <label className={labelCls}>Tarif per Sesi (Rp)</label>
            <input type="number" name="rate_per_session" value={form.rate_per_session} onChange={handleChange} placeholder="150000" className={inputCls}/>
          </div>
        </div>

        {/* AKADEMIK */}
        <div className={sectionCls}>
          <p className="text-xs font-bold text-[#7B78A8] uppercase tracking-wide">Riwayat Akademik <span className="normal-case font-normal">(opsional)</span></p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Jenjang Pendidikan</label>
              <select name="education_level" value={form.education_level} onChange={handleChange} className={inputCls}>
                <option value="">-- Pilih --</option>
                {EDU_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Jurusan</label>
              <input type="text" name="education_major" value={form.education_major} onChange={handleChange} placeholder="Pendidikan Bahasa Inggris" className={inputCls}/>
            </div>
            <div>
              <label className={labelCls}>Universitas/Institusi</label>
              <input type="text" name="education_university" value={form.education_university} onChange={handleChange} placeholder="Nama universitas" className={inputCls}/>
            </div>
            <div>
              <label className={labelCls}>Tahun Lulus</label>
              <input type="number" name="education_year" value={form.education_year} onChange={handleChange} placeholder="2020" className={inputCls}/>
            </div>
          </div>
        </div>

        {/* PENGALAMAN */}
        <div className={sectionCls}>
          <p className="text-xs font-bold text-[#7B78A8] uppercase tracking-wide">Pengalaman Mengajar <span className="normal-case font-normal">(opsional)</span></p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Lama Mengajar (tahun)</label>
              <input type="number" name="teaching_experience_years" value={form.teaching_experience_years} onChange={handleChange} placeholder="5" className={inputCls}/>
            </div>
            <div>
              <label className={labelCls}>Tempat Mengajar Sebelumnya</label>
              <input type="text" name="previous_workplaces" value={form.previous_workplaces} onChange={handleChange} placeholder="SMPN 1 Ternate..." className={inputCls}/>
            </div>
          </div>
          <div>
            <label className={labelCls}>Bio / Deskripsi Singkat</label>
            <textarea name="bio" value={form.bio} onChange={handleChange}
              placeholder="Ceritakan tentang tutor ini..." rows={3}
              className={`${inputCls} resize-none`}/>
          </div>
        </div>

        {/* PELATIHAN, SERTIFIKASI & PRESTASI */}
        <div className={sectionCls}>
          <p className="text-xs font-bold text-[#7B78A8] uppercase tracking-wide">Pelatihan, Sertifikasi & Prestasi <span className="normal-case font-normal">(opsional)</span></p>

          <div className="bg-[#F7F6FF] border border-[#E5E3FF] rounded-xl p-4 space-y-3">
            <p className="text-xs font-bold text-[#7B78A8]">Tambah item baru</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Nama</label>
                <input type="text" value={newAch.name} onChange={e => setNewAch(p => ({...p, name: e.target.value}))}
                  placeholder="Contoh: TOEFL Score 550" className={inputCls}/>
              </div>
              <div>
                <label className={labelCls}>Kategori</label>
                <select value={newAch.category} onChange={e => setNewAch(p => ({...p, category: e.target.value}))} className={inputCls}>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Lembaga/Penyelenggara</label>
                <input type="text" value={newAch.issuer} onChange={e => setNewAch(p => ({...p, issuer: e.target.value}))}
                  placeholder="ETS, Kemdikbud..." className={inputCls}/>
              </div>
              <div>
                <label className={labelCls}>Tahun</label>
                <input type="text" value={newAch.year} onChange={e => setNewAch(p => ({...p, year: e.target.value}))}
                  placeholder="2021" className={inputCls}/>
              </div>
            </div>
            <button type="button" onClick={addAchievement}
              className="flex items-center gap-2 px-4 py-2 bg-[#5C4FE5] text-white rounded-xl text-sm font-bold hover:bg-[#3D34C4] transition">
              <Plus size={13}/> Tambah
            </button>
          </div>

          {achievements.length > 0 && (
            <div className="space-y-2">
              {achievements.map((a, idx) => {
                const cat = CATEGORIES.find(c => c.value === a.category) ?? CATEGORIES[0]
                return (
                  <div key={idx} className="flex items-center justify-between gap-3 px-4 py-3 bg-white border border-[#E5E3FF] rounded-xl">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[#1A1640]">{a.name}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                          style={{background: cat.color, color: cat.textColor}}>
                          {cat.label}
                        </span>
                      </div>
                      <p className="text-xs text-[#7B78A8] mt-0.5">{[a.issuer, a.year].filter(Boolean).join(' · ')}</p>
                    </div>
                    <button type="button" onClick={() => removeAchievement(idx)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition flex-shrink-0">
                      <Trash2 size={13}/>
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 font-semibold">{error}</div>
        )}

        <div className="flex gap-3">
          <button type="submit" disabled={saving || success}
            className="flex-1 py-3 bg-[#5C4FE5] hover:bg-[#3D34C4] text-white font-bold rounded-xl text-sm transition disabled:opacity-60">
            {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
          <Link href={`/admin/tutor/${tutorId}`}
            className="px-6 py-3 border border-[#E5E3FF] text-[#4A4580] font-bold rounded-xl text-sm hover:bg-[#F0EFFF] transition text-center">
            Batal
          </Link>
        </div>
      </form>
    </div>
  )
}
