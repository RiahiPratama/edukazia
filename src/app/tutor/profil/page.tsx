'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Camera, Plus, Trash2, Save, Mail } from 'lucide-react'

const EDU_LEVELS = ['SMA/SMK', 'D3', 'S1', 'S2', 'S3']

export default function TutorProfilPage() {
  const supabase = createClient()

  const [loading,       setLoading]       = useState(true)
  const [saving,        setSaving]        = useState(false)
  const [savingEmail,   setSavingEmail]   = useState(false)
  const [uploadingFoto, setUploadingFoto] = useState(false)
  const [error,         setError]         = useState('')
  const [success,       setSuccess]       = useState('')
  const [successEmail,  setSuccessEmail]  = useState('')
  const [errorEmail,    setErrorEmail]    = useState('')

  const [tutorId,       setTutorId]       = useState('')
  const [profileId,     setProfileId]     = useState('')
  const [avatarUrl,     setAvatarUrl]     = useState<string | null>(null)
  const [currentEmail,  setCurrentEmail]  = useState('')
  const [newEmail,      setNewEmail]      = useState('')
  const [courses,       setCourses]       = useState<any[]>([])
  const [selectedCourses, setSelectedCourses] = useState<string[]>([])
  const [subjects,      setSubjects]      = useState<string[]>([])
  const [subjectInput,  setSubjectInput]  = useState('')

  const [form, setForm] = useState({
    full_name:                 '',
    phone:                     '',
    bio:                       '',
    bank_name:                 '',
    bank_account:              '',
    bank_holder:               '',
    education_level:           '',
    education_major:           '',
    education_university:      '',
    education_year:            '',
    teaching_experience_years: '',
    previous_workplaces:       '',
  })

  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    setCurrentEmail(user.email ?? '')
    setProfileId(user.id)

    const [
      { data: profile },
      { data: tutor },
      { data: allCourses },
    ] = await Promise.all([
      supabase.from('profiles').select('full_name, phone, avatar_url').eq('id', user.id).single(),
      supabase.from('tutors').select('id, bio, bank_name, bank_account, bank_holder, education_level, education_major, education_university, education_year, teaching_experience_years, previous_workplaces, subjects').eq('profile_id', user.id).single(),
      supabase.from('courses').select('id, name, color').eq('is_active', true),
    ])

    setCourses(allCourses ?? [])
    setAvatarUrl(profile?.avatar_url ?? null)

    if (tutor?.id) {
      setTutorId(tutor.id)
      setSubjects(tutor.subjects ?? [])

      // Ambil kursus tutor
      const { data: tutorCourses } = await supabase
        .from('tutor_courses').select('course_id').eq('tutor_id', tutor.id)
      setSelectedCourses((tutorCourses ?? []).map((tc: any) => tc.course_id))
    }

    setForm({
      full_name:                 profile?.full_name ?? '',
      phone:                     profile?.phone ?? '',
      bio:                       tutor?.bio ?? '',
      bank_name:                 tutor?.bank_name ?? '',
      bank_account:              tutor?.bank_account ?? '',
      bank_holder:               tutor?.bank_holder ?? '',
      education_level:           tutor?.education_level ?? '',
      education_major:           tutor?.education_major ?? '',
      education_university:      tutor?.education_university ?? '',
      education_year:            tutor?.education_year?.toString() ?? '',
      teaching_experience_years: tutor?.teaching_experience_years?.toString() ?? '',
      previous_workplaces:       tutor?.previous_workplaces ?? '',
    })

    setLoading(false)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  function toggleCourse(id: string) {
    setSelectedCourses(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])
  }

  function addSubject() {
    const s = subjectInput.trim()
    if (s && !subjects.includes(s)) setSubjects(prev => [...prev, s])
    setSubjectInput('')
  }

  async function handleUploadFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingFoto(true)

    const ext      = file.name.split('.').pop()
    const fileName = `tutor-${profileId}-${Date.now()}.${ext}`

    const { error: upErr } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, { upsert: true })

    if (upErr) { setError('Gagal upload foto: ' + upErr.message); setUploadingFoto(false); return }

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName)
    const publicUrl = urlData.publicUrl

    await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', profileId)
    setAvatarUrl(publicUrl)
    setUploadingFoto(false)
  }

  async function handleSimpan() {
    if (!form.full_name.trim()) { setError('Nama lengkap wajib diisi.'); return }
    setSaving(true); setError(''); setSuccess('')

    // Update profiles
    const { error: profErr } = await supabase
      .from('profiles')
      .update({ full_name: form.full_name.trim(), phone: form.phone.trim() || null })
      .eq('id', profileId)
    if (profErr) { setError(profErr.message); setSaving(false); return }

    // Update tutors
    const { error: tutorErr } = await supabase
      .from('tutors')
      .update({
        bio:                       form.bio.trim() || null,
        bank_name:                 form.bank_name.trim() || null,
        bank_account:              form.bank_account.trim() || null,
        bank_holder:               form.bank_holder.trim() || null,
        education_level:           form.education_level || null,
        education_major:           form.education_major.trim() || null,
        education_university:      form.education_university.trim() || null,
        education_year:            form.education_year ? parseInt(form.education_year) : null,
        teaching_experience_years: form.teaching_experience_years ? parseInt(form.teaching_experience_years) : null,
        previous_workplaces:       form.previous_workplaces.trim() || null,
        subjects:                  subjects.length > 0 ? subjects : null,
      })
      .eq('id', tutorId)
    if (tutorErr) { setError(tutorErr.message); setSaving(false); return }

    // Update kursus
    await supabase.from('tutor_courses').delete().eq('tutor_id', tutorId)
    if (selectedCourses.length > 0) {
      await supabase.from('tutor_courses').insert(
        selectedCourses.map(courseId => ({ tutor_id: tutorId, course_id: courseId }))
      )
    }

    setSuccess('Profil berhasil diperbarui!')
    setSaving(false)
  }

  async function handleUbahEmail() {
    if (!newEmail.trim()) { setErrorEmail('Email baru wajib diisi.'); return }
    if (newEmail === currentEmail) { setErrorEmail('Email baru sama dengan email saat ini.'); return }
    setSavingEmail(true); setErrorEmail(''); setSuccessEmail('')

    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() })
    if (error) { setErrorEmail(error.message); setSavingEmail(false); return }

    // Update juga di tabel profiles
    await supabase.from('profiles').update({ email: newEmail.trim() }).eq('id', profileId)

    setSuccessEmail(`Link verifikasi dikirim ke ${newEmail}. Cek email untuk konfirmasi.`)
    setNewEmail('')
    setSavingEmail(false)
  }

  const inputCls   = "w-full px-3.5 py-2.5 border border-[#E5E3FF] rounded-xl text-sm bg-[#F7F6FF] text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] focus:bg-white transition"
  const labelCls   = "block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5"
  const sectionCls = "bg-white rounded-2xl border border-[#E5E3FF] p-6 space-y-4"

  function getInitials(name: string) {
    return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="text-sm text-[#7B78A8]">Memuat profil...</div>
    </div>
  )

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-[#1A1640] font-['Sora']">Profil Saya</h1>
        <p className="text-sm text-[#7B78A8] mt-1">Kelola data dan informasi pribadimu</p>
      </div>

      <div className="space-y-5">

        {/* FOTO PROFIL */}
        <div className={sectionCls}>
          <p className="text-xs font-bold text-[#7B78A8] uppercase tracking-wide">Foto Profil</p>
          <div className="flex items-center gap-5">
            <div className="relative flex-shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Foto profil"
                  className="w-20 h-20 rounded-full object-cover border-2 border-[#E5E3FF]"/>
              ) : (
                <div className="w-20 h-20 rounded-full bg-[#5C4FE5] flex items-center justify-center text-white text-xl font-bold">
                  {getInitials(form.full_name || 'T')}
                </div>
              )}
              <button onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#5C4FE5] text-white flex items-center justify-center hover:bg-[#3D34C4] transition shadow">
                <Camera size={13}/>
              </button>
            </div>
            <div>
              <p className="text-sm font-semibold text-[#1A1640]">{form.full_name || 'Nama Tutor'}</p>
              <p className="text-xs text-[#7B78A8] mt-0.5">{currentEmail}</p>
              <button onClick={() => fileRef.current?.click()}
                className="mt-2 text-xs text-[#5C4FE5] font-semibold hover:underline">
                {uploadingFoto ? 'Mengupload...' : 'Ganti foto'}
              </button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={handleUploadFoto}/>
          </div>
        </div>

        {/* DATA PRIBADI */}
        <div className={sectionCls}>
          <p className="text-xs font-bold text-[#7B78A8] uppercase tracking-wide">Data Pribadi</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Nama Lengkap <span className="text-red-500">*</span></label>
              <input type="text" name="full_name" value={form.full_name} onChange={handleChange}
                placeholder="Nama lengkap" className={inputCls}/>
            </div>
            <div>
              <label className={labelCls}>Nomor HP</label>
              <input type="tel" name="phone" value={form.phone} onChange={handleChange}
                placeholder="08xxxxxxxxxx" className={inputCls}/>
            </div>
          </div>
          <div>
            <label className={labelCls}>Bio / Deskripsi Singkat</label>
            <textarea name="bio" value={form.bio} onChange={handleChange} rows={3}
              placeholder="Ceritakan tentang dirimu sebagai tutor..."
              className={`${inputCls} resize-none`}/>
          </div>

          {/* Kursus */}
          <div>
            <label className={labelCls}>Kursus yang Dikuasai</label>
            <div className="flex flex-wrap gap-2">
              {courses.map((c: any) => (
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
                className="px-3 py-2 bg-[#5C4FE5] text-white rounded-xl hover:bg-[#3D34C4] transition">
                <Plus size={14}/>
              </button>
            </div>
            {subjects.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {subjects.map(s => (
                  <span key={s} className="flex items-center gap-1.5 pl-3 pr-2 py-1 rounded-full text-xs font-semibold bg-[#EEEDFE] text-[#3C3489]">
                    {s}
                    <button type="button" onClick={() => setSubjects(prev => prev.filter(x => x !== s))}
                      className="hover:opacity-60 transition"><Trash2 size={10}/></button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* REKENING */}
        <div className={sectionCls}>
          <p className="text-xs font-bold text-[#7B78A8] uppercase tracking-wide">Info Rekening <span className="normal-case font-normal">(untuk pembayaran honor)</span></p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Nama Bank</label>
              <input type="text" name="bank_name" value={form.bank_name} onChange={handleChange}
                placeholder="BCA, BRI, dll" className={inputCls}/>
            </div>
            <div>
              <label className={labelCls}>No. Rekening</label>
              <input type="text" name="bank_account" value={form.bank_account} onChange={handleChange}
                placeholder="1234567890" className={inputCls}/>
            </div>
            <div>
              <label className={labelCls}>Atas Nama</label>
              <input type="text" name="bank_holder" value={form.bank_holder} onChange={handleChange}
                placeholder="Nama pemilik" className={inputCls}/>
            </div>
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
              <input type="text" name="education_major" value={form.education_major} onChange={handleChange}
                placeholder="Pendidikan Bahasa Inggris" className={inputCls}/>
            </div>
            <div>
              <label className={labelCls}>Universitas</label>
              <input type="text" name="education_university" value={form.education_university} onChange={handleChange}
                placeholder="Nama universitas" className={inputCls}/>
            </div>
            <div>
              <label className={labelCls}>Tahun Lulus</label>
              <input type="number" name="education_year" value={form.education_year} onChange={handleChange}
                placeholder="2020" className={inputCls}/>
            </div>
            <div>
              <label className={labelCls}>Lama Mengajar (tahun)</label>
              <input type="number" name="teaching_experience_years" value={form.teaching_experience_years} onChange={handleChange}
                placeholder="5" className={inputCls}/>
            </div>
            <div>
              <label className={labelCls}>Tempat Mengajar Sebelumnya</label>
              <input type="text" name="previous_workplaces" value={form.previous_workplaces} onChange={handleChange}
                placeholder="SMPN 1 Ternate, LBB..." className={inputCls}/>
            </div>
          </div>
        </div>

        {/* Error & Success */}
        {error   && <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 font-semibold">{error}</div>}
        {success && <div className="px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 font-semibold">✅ {success}</div>}

        {/* Tombol Simpan */}
        <button onClick={handleSimpan} disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-3 bg-[#5C4FE5] hover:bg-[#3D34C4] text-white font-bold rounded-xl text-sm transition disabled:opacity-60">
          <Save size={16}/>
          {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
        </button>

        {/* UBAH EMAIL */}
        <div className={sectionCls}>
          <p className="text-xs font-bold text-[#7B78A8] uppercase tracking-wide">Ubah Email Login</p>
          <div className="p-3 bg-[#F7F6FF] rounded-xl border border-[#E5E3FF]">
            <p className="text-xs text-[#7B78A8]">Email saat ini:</p>
            <p className="text-sm font-semibold text-[#1A1640]">{currentEmail}</p>
          </div>
          <div>
            <label className={labelCls}>Email Baru</label>
            <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
              placeholder="email-baru@contoh.com" className={inputCls}/>
            <p className="text-xs text-[#7B78A8] mt-1">
              Link verifikasi akan dikirim ke email baru. Email lama tetap aktif sampai dikonfirmasi.
            </p>
          </div>
          {errorEmail   && <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 font-semibold">{errorEmail}</div>}
          {successEmail && <div className="px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 font-semibold">✅ {successEmail}</div>}
          <button onClick={handleUbahEmail} disabled={savingEmail}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#F0EFFF] hover:bg-[#5C4FE5] text-[#5C4FE5] hover:text-white font-bold rounded-xl text-sm transition disabled:opacity-60">
            <Mail size={14}/>
            {savingEmail ? 'Mengirim...' : 'Kirim Link Verifikasi'}
          </button>
        </div>

      </div>
    </div>
  )
}
