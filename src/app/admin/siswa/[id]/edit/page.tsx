'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

import { WILAYAH, PROVINCES, getCities } from '@/lib/wilayah'
const RELATION_ROLES = ['Orang Tua', 'Wali', 'Diri Sendiri']

export default function SiswaEditPage() {
  const params   = useParams()
  const router   = useRouter()
  const siswaId  = params.id as string
  const supabase = createClient()

  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState(false)
  const [profileId, setProfileId] = useState('')

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
    const { data: student, error: sErr } = await supabase
      .from('students')
      .select('id, profile_id, birth_date, province, city, relation_name, relation_role, relation_phone, relation_email, school, grade, notes')
      .eq('id', siswaId)
      .single()

    if (sErr || !student) { setError('Siswa tidak ditemukan.'); setLoading(false); return }

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

    // Update profile
    const { error: profileErr } = await supabase
      .from('profiles')
      .update({
        full_name: form.full_name.trim(),
        phone:     form.phone.trim() || null,
        email:     form.email.trim() || null,
      })
      .eq('id', profileId)

    if (profileErr) { setError(profileErr.message); setSaving(false); return }

    // Update student
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

  const inputCls = "w-full px-3.5 py-2.5 border border-[#E5E3FF] rounded-xl text-sm bg-[#F7F6FF] text-[#1A1640] placeholder:text-[#7B78A8] focus:outline-none focus:border-[#5C4FE5] focus:bg-white transition"
  const labelCls = "block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5"

  if (loading) return <div className="p-6 text-sm text-[#7B78A8]">Memuat data siswa...</div>

  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/siswa" className="text-[#7B78A8] hover:text-[#5C4FE5] transition-colors">← Kembali</Link>
        <h1 className="text-2xl font-black text-[#1A1640]" style={{fontFamily:'Sora,sans-serif'}}>Edit Siswa</h1>
      </div>

      {success && (
        <div className="mb-4 px-4 py-3 bg-[#E6F4EC] border border-green-200 rounded-xl text-sm text-green-700 font-semibold">
          ✅ Data siswa berhasil diperbarui! Mengalihkan...
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* DATA SISWA */}
        <div className="bg-white rounded-2xl border border-[#E5E3FF] p-6 space-y-4">
          <p className="text-xs font-bold text-[#7B78A8] uppercase tracking-wide">Data Siswa</p>

          <div>
            <label className={labelCls}>Nama Lengkap <span className="text-red-500">*</span></label>
            <input type="text" name="full_name" value={form.full_name} onChange={handleChange}
              placeholder="Nama lengkap siswa" className={inputCls}/>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>No. HP Siswa</label>
              <input type="text" name="phone" value={form.phone} onChange={handleChange}
                placeholder="08xxxxxxxxxx" className={inputCls}/>
            </div>
            <div>
              <label className={labelCls}>Email <span className="normal-case font-normal text-[#7B78A8]">(opsional)</span></label>
              <input type="email" name="email" value={form.email} onChange={handleChange}
                placeholder="email@contoh.com" className={inputCls}/>
            </div>
          </div>

          <div>
            <label className={labelCls}>Tanggal Lahir <span className="normal-case font-normal text-[#7B78A8]">(opsional)</span></label>
            <input type="date" name="birth_date" value={form.birth_date} onChange={handleChange} className={inputCls}/>
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
              <select name="city" value={form.city} onChange={handleChange}
                disabled={!form.province} className={`${inputCls} ${!form.province ? 'opacity-50 cursor-not-allowed' : ''}`}>
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
                placeholder="Kelas 10 / Semester 3" className={inputCls}/>
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
