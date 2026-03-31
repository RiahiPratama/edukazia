'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { UserCheck, UserPlus, Eye, EyeOff } from 'lucide-react'
import ArchiveEnrollmentManager from '@/components/admin/ArchiveEnrollmentManager'
import EnrollmentLevelManager from '@/components/admin/EnrollmentLevelManager'

import { WILAYAH, PROVINCES, getCities } from '@/lib/wilayah'
const RELATION_ROLES = ['Orang Tua', 'Wali', 'Diri Sendiri']

export default function SiswaEditPage() {
  const params   = useParams()
  const router   = useRouter()
  const siswaId  = params.id as string
  const supabase = createClient()

  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')
  const [success,   setSuccess]   = useState(false)
  const [profileId, setProfileId] = useState('')

  // Parent account state
  const [parentProfileId,   setParentProfileId]   = useState<string | null>(null)
  const [parentEmail,       setParentEmail]       = useState('')
  const [parentHasAuth,     setParentHasAuth]     = useState(false)
  const [parentEmailInput,  setParentEmailInput]  = useState('')
  const [parentPassword,    setParentPassword]    = useState('')
  const [showPassword,      setShowPassword]      = useState(false)
  const [savingParent,      setSavingParent]      = useState(false)
  const [parentError,       setParentError]       = useState('')
  const [parentSuccess,     setParentSuccess]     = useState('')

  const [form, setForm] = useState({
    full_name:      '',
    phone:          '',
    email:          '',
    birth_date:     '',
    province:       '',
    city:           '',
    relation_name:  '',
    relation_role:  'Orang Tua',
    relation_phone: '',
    relation_email: '',
    school:         '',
    grade:          '',
    notes:          '',
  })

  const cities = form.province ? getCities(form.province) : []

  useEffect(() => { fetchSiswa() }, [siswaId])

  async function fetchSiswa() {
    setLoading(true)
    const { data: student } = await supabase
      .from('students')
      .select('id, profile_id, parent_profile_id, birth_date, province, city, relation_name, relation_role, relation_phone, relation_email, school, grade, notes')
      .eq('id', siswaId)
      .single()

    if (!student) { setError('Siswa tidak ditemukan.'); setLoading(false); return }

    setProfileId(student.profile_id)

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email, phone')
      .eq('id', student.profile_id)
      .single()

    setForm({
      full_name:      profile?.full_name ?? '',
      phone:          profile?.phone ?? '',
      email:          profile?.email ?? '',
      birth_date:     student.birth_date ?? '',
      province:       student.province ?? '',
      city:           student.city ?? '',
      relation_name:  student.relation_name ?? '',
      relation_role:  student.relation_role ?? 'Orang Tua',
      relation_phone: student.relation_phone ?? '',
      relation_email: student.relation_email ?? '',
      school:         student.school ?? '',
      grade:          student.grade ?? '',
      notes:          student.notes ?? '',
    })

    // Cek apakah akun ortu sudah ada
    if (student.parent_profile_id) {
      setParentProfileId(student.parent_profile_id)
      const { data: parentProfile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', student.parent_profile_id)
        .single()
      const emailOrtu = parentProfile?.email ?? ''
      setParentEmail(emailOrtu)

      // Verifikasi apakah auth user benar-benar ada via API
      try {
        const checkRes = await fetch(`/api/admin/create-user?profile_id=${student.parent_profile_id}`)
        const checkData = await checkRes.json()
        if (checkData.has_auth) {
          setParentHasAuth(true)
        } else {
          // Profile ada di DB tapi auth user belum dibuat — tampilkan form buat akun
          setParentHasAuth(false)
          setParentEmailInput(emailOrtu || student.relation_email || '')
        }
      } catch {
        // Jika gagal cek, fallback ke show form reset (lebih aman)
        setParentHasAuth(true)
      }
    } else if (student.relation_role === 'Diri Sendiri') {
      // Dewasa yang les sendiri — akun login adalah profile siswa itu sendiri
      setParentProfileId(student.profile_id)
      const { data: selfProfile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', student.profile_id)
        .single()
      setParentEmail(selfProfile?.email ?? '')
      setParentHasAuth(true)
    } else {
      // Ortu belum punya akun — pre-fill email dari relation_email jika ada
      setParentHasAuth(false)
      if (student.relation_email) {
        setParentEmailInput(student.relation_email)
      }
    }

    setLoading(false)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = e.target
    if (name === 'province') {
      setForm(prev => ({ ...prev, province: value, city: '' }))
    } else {
      setForm(prev => ({ ...prev, [name]: value }))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.full_name.trim()) { setError('Nama siswa wajib diisi.'); return }
    setSaving(true); setError('')

    const { error: profileErr } = await supabase
      .from('profiles')
      .update({
        full_name: form.full_name.trim(),
        phone:     form.phone.trim() || null,
        email:     form.email.trim() || null,
      })
      .eq('id', profileId)

    if (profileErr) { setError(profileErr.message); setSaving(false); return }

    const { error: studentErr } = await supabase
      .from('students')
      .update({
        birth_date:     form.birth_date || null,
        province:       form.province || null,
        city:           form.city || null,
        relation_name:  form.relation_name.trim() || null,
        relation_role:  form.relation_role || null,
        relation_phone: form.relation_phone.trim() || null,
        relation_email: form.relation_email.trim() || null,
        school:         form.school.trim() || null,
        grade:          form.grade.trim() || null,
        notes:          form.notes.trim() || null,
      })
      .eq('id', siswaId)

    if (studentErr) { setError(studentErr.message); setSaving(false); return }

    setSaving(false); setSuccess(true)
    setTimeout(() => router.push('/admin/siswa'), 1200)
  }

  async function handleBuatAkunOrtu() {
    if (!parentEmailInput.trim()) { setParentError('Email ortu wajib diisi.'); return }
    if (parentPassword.length < 6) { setParentError('Password minimal 6 karakter.'); return }
    setSavingParent(true); setParentError(''); setParentSuccess('')

    try {
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email:     parentEmailInput.trim(),
          password:  parentPassword,
          role:      'parent',
          full_name: form.relation_name.trim() || null,
          phone:     form.relation_phone.trim() || null,
        }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal membuat akun')

      // Update students.parent_profile_id
      await supabase
        .from('students')
        .update({ parent_profile_id: json.profile_id })
        .eq('id', siswaId)

      setParentProfileId(json.profile_id)
      setParentEmail(parentEmailInput.trim())
      setParentHasAuth(true)
      setParentSuccess('Akun orang tua berhasil dibuat!')
      setParentEmailInput('')
      setParentPassword('')

      setTimeout(() => setParentSuccess(''), 3000)
    } catch (err: any) {
      setParentError(err.message)
    }
    setSavingParent(false)
  }

  async function handleResetPassword() {
    if (!parentPassword.trim()) { setParentError('Password baru wajib diisi.'); return }
    if (parentPassword.length < 6) { setParentError('Password minimal 6 karakter.'); return }
    setSavingParent(true); setParentError(''); setParentSuccess('')

    try {
      const res = await fetch('/api/admin/create-user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_id: parentProfileId,
          password:   parentPassword,
        }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal reset password')

      setParentSuccess('Password berhasil direset!')
      setParentPassword('')
      setTimeout(() => setParentSuccess(''), 3000)
    } catch (err: any) {
      setParentError(err.message)
    }
    setSavingParent(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <p className="text-gray-600">Memuat data siswa...</p>
      </div>
    )
  }

  const labelCls = 'block text-xs font-bold text-[#1A1640] uppercase tracking-wide mb-2'
  const inputCls = 'w-full px-4 py-2.5 border-2 border-[#E5E3FF] rounded-xl text-sm text-[#1A1640] font-semibold placeholder:text-[#C4BFFF] placeholder:font-normal focus:outline-none focus:border-[#5C4FE5] transition'

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto mb-6">
        <h1 className="text-2xl font-black text-[#1A1640]">Edit Data Siswa</h1>
        <p className="text-sm text-[#7B78A8] mt-1">Perbarui informasi siswa dan akun orang tua</p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-6">
        {success && (
          <div className="px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-600 font-semibold">
            ✅ Data berhasil disimpan! Mengalihkan...
          </div>
        )}

        {/* DATA SISWA */}
        <div className="bg-white rounded-2xl border border-[#E5E3FF] p-6 space-y-4">
          <div>
            <p className="text-xs font-bold text-[#7B78A8] uppercase tracking-wide">Data Siswa</p>
            <p className="text-xs text-[#7B78A8] mt-0.5">Informasi dasar tentang siswa</p>
          </div>

          <div>
            <label className={labelCls}>Nama Lengkap Siswa <span className="text-red-500">*</span></label>
            <input type="text" name="full_name" value={form.full_name} onChange={handleChange}
              placeholder="Nama lengkap siswa" className={inputCls} required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>No. HP Siswa <span className="normal-case font-normal text-[#7B78A8]">(opsional)</span></label>
              <input type="text" name="phone" value={form.phone} onChange={handleChange}
                placeholder="08xxxxxxxxxx" className={inputCls}/>
            </div>
            <div>
              <label className={labelCls}>Email Siswa <span className="normal-case font-normal text-[#7B78A8]">(opsional)</span></label>
              <input type="email" name="email" value={form.email} onChange={handleChange}
                placeholder="email@siswa.com" className={inputCls}/>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Tanggal Lahir <span className="normal-case font-normal text-[#7B78A8]">(opsional)</span></label>
              <input type="date" name="birth_date" value={form.birth_date} onChange={handleChange} className={inputCls}/>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Provinsi <span className="normal-case font-normal text-[#7B78A8]">(opsional)</span></label>
              <select name="province" value={form.province} onChange={handleChange} className={inputCls}>
                <option value="">-- Pilih Provinsi --</option>
                {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Kabupaten/Kota <span className="normal-case font-normal text-[#7B78A8]">(opsional)</span></label>
              <select name="city" value={form.city} onChange={handleChange} className={inputCls} disabled={!form.province}>
                <option value="">-- Pilih Kab/Kota --</option>
                {cities.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Sekolah <span className="normal-case font-normal text-[#7B78A8]">(opsional)</span></label>
              <input type="text" name="school" value={form.school} onChange={handleChange}
                placeholder="Nama sekolah" className={inputCls}/>
            </div>
            <div>
              <label className={labelCls}>Kelas/Tingkat <span className="normal-case font-normal text-[#7B78A8]">(opsional)</span></label>
              <input type="text" name="grade" value={form.grade} onChange={handleChange}
                placeholder="Level Pre-Starter" className={inputCls}/>
            </div>
          </div>
        </div>

        {/* PIHAK BERELASI */}
        <div className="bg-white rounded-2xl border border-[#E5E3FF] p-6 space-y-4">
          <div>
            <p className="text-xs font-bold text-[#7B78A8] uppercase tracking-wide">Pihak Berelasi</p>
            <p className="text-xs text-[#7B78A8] mt-0.5">Orang tua, wali, atau siswa sendiri jika sudah dewasa</p>
          </div>

          <div>
            <label className={labelCls}>Hubungan</label>
            <select name="relation_role" value={form.relation_role} onChange={handleChange} className={inputCls}>
              {RELATION_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {form.relation_role !== 'Diri Sendiri' ? (
            <>
              <div>
                <label className={labelCls}>Nama {form.relation_role}</label>
                <input type="text" name="relation_name" value={form.relation_name} onChange={handleChange}
                  placeholder={`Nama ${form.relation_role.toLowerCase()} siswa`} className={inputCls}/>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>No. HP {form.relation_role}</label>
                  <input type="text" name="relation_phone" value={form.relation_phone} onChange={handleChange}
                    placeholder="08xxxxxxxxxx" className={inputCls}/>
                  <p className="text-xs text-[#7B78A8] mt-1">Untuk notifikasi WhatsApp</p>
                </div>
                <div>
                  <label className={labelCls}>Email {form.relation_role} <span className="normal-case font-normal text-[#7B78A8]">(opsional)</span></label>
                  <input type="email" name="relation_email" value={form.relation_email} onChange={handleChange}
                    placeholder="email@contoh.com" className={inputCls}/>
                  <p className="text-xs text-[#7B78A8] mt-1">Untuk akses Google Drive</p>
                </div>
              </div>
            </>
          ) : (
            <div className="px-4 py-3 bg-[#EEEDFE] rounded-xl">
              <p className="text-xs font-semibold text-[#3C3489]">
                💡 Notifikasi WA dan akses Google Drive akan menggunakan data kontak siswa di atas.
              </p>
            </div>
          )}
        </div>

        {/* AKUN ORANG TUA */}
        <div className="bg-white rounded-2xl border border-[#E5E3FF] p-6 space-y-4">
          <div className="flex items-center gap-2">
            {parentProfileId
              ? <UserCheck size={16} className="text-green-600 flex-shrink-0"/>
              : <UserPlus size={16} className="text-[#7B78A8] flex-shrink-0"/>
            }
            <p className="text-xs font-bold text-[#7B78A8] uppercase tracking-wide">Akun Orang Tua / Portal Siswa</p>
          </div>

          {parentProfileId && parentHasAuth ? (
            // Akun sudah ada DAN auth user terkonfirmasi
            <>
              <div className="flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-xl">
                <UserCheck size={16} className="text-green-600 flex-shrink-0"/>
                <div>
                  <p className="text-xs font-bold text-green-700">Akun aktif</p>
                  <p className="text-xs text-green-600 mt-0.5">{parentEmail}</p>
                </div>
              </div>

              <div>
                <label className={labelCls}>Reset Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={parentPassword}
                    onChange={e => setParentPassword(e.target.value)}
                    placeholder="Password baru (min. 6 karakter)"
                    className={inputCls}
                  />
                  <button type="button" onClick={() => setShowPassword(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7B78A8] hover:text-[#5C4FE5]">
                    {showPassword ? <EyeOff size={15}/> : <Eye size={15}/>}
                  </button>
                </div>
              </div>

              {parentError   && <p className="text-xs text-red-600 font-semibold">{parentError}</p>}
              {parentSuccess && <p className="text-xs text-green-600 font-semibold">✅ {parentSuccess}</p>}

              <button type="button" onClick={handleResetPassword} disabled={savingParent}
                className="w-full py-2.5 border border-[#5C4FE5] text-[#5C4FE5] font-bold rounded-xl text-sm hover:bg-[#EAE8FD] transition disabled:opacity-60">
                {savingParent ? 'Menyimpan...' : 'Reset Password Orang Tua'}
              </button>
            </>
          ) : (
            // Akun belum ada — form buat akun baru
            <>
              <div className="px-4 py-3 bg-[#F7F6FF] border border-[#E5E3FF] rounded-xl">
                <p className="text-xs text-[#7B78A8]">
                  Buat akun agar orang tua bisa login ke <span className="font-semibold text-[#5C4FE5]">portal siswa</span> dan memantau perkembangan belajar.
                </p>
              </div>

              <div>
                <label className={labelCls}>Email Login Orang Tua</label>
                <input type="email" value={parentEmailInput}
                  onChange={e => setParentEmailInput(e.target.value)}
                  placeholder="email@contoh.com" className={inputCls}/>
              </div>

              <div>
                <label className={labelCls}>Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={parentPassword}
                    onChange={e => setParentPassword(e.target.value)}
                    placeholder="Min. 6 karakter"
                    className={inputCls}
                  />
                  <button type="button" onClick={() => setShowPassword(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7B78A8] hover:text-[#5C4FE5]">
                    {showPassword ? <EyeOff size={15}/> : <Eye size={15}/>}
                  </button>
                </div>
              </div>

              {parentError   && <p className="text-xs text-red-600 font-semibold">{parentError}</p>}
              {parentSuccess && <p className="text-xs text-green-600 font-semibold">✅ {parentSuccess}</p>}

              <button type="button" onClick={handleBuatAkunOrtu} disabled={savingParent}
                className="w-full py-2.5 bg-[#5C4FE5] hover:bg-[#3D34C4] text-white font-bold rounded-xl text-sm transition disabled:opacity-60 flex items-center justify-center gap-2">
                <UserPlus size={15}/>
                {savingParent ? 'Membuat akun...' : 'Buat Akun Orang Tua'}
              </button>
            </>
          )}
        </div>

        {/* ENROLLMENT & LEVEL MANAGER */}
        <ArchiveEnrollmentManager studentId={siswaId} />
        <EnrollmentLevelManager studentId={siswaId} />

        {/* CATATAN */}
        <div className="bg-white rounded-2xl border border-[#E5E3FF] p-6">
          <label className={labelCls}>Catatan <span className="normal-case font-normal text-[#7B78A8]">(opsional)</span></label>
          <textarea name="notes" value={form.notes} onChange={handleChange}
            placeholder="Catatan tambahan tentang siswa ini..."
            rows={3} className={`${inputCls} resize-none`}/>
        </div>

        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 font-semibold">{error}</div>
        )}

        <div className="flex gap-3">
          <button type="submit" disabled={saving || success}
            className="flex-1 py-3 bg-[#5C4FE5] hover:bg-[#3D34C4] text-white font-bold rounded-xl text-sm transition disabled:opacity-60">
            {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
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
