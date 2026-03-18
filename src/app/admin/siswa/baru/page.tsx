'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SiswaBaruPage() {
  const router   = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [form, setForm] = useState({
    full_name:        '',
    phone:            '',
    email:            '',
    // Pihak berelasi (orang tua/wali)
    relation_name:    '',
    relation_role:    'Orang Tua',
    relation_phone:   '',
    // Info tambahan
    school:           '',
    grade:            '',
    notes:            '',
  })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const RELATION_ROLES = ['Orang Tua', 'Wali', 'Diri Sendiri']

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.full_name.trim()) { setError('Nama siswa wajib diisi.'); return }
    setLoading(true); setError('')

    // 1. Buat profile
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .insert({
        full_name: form.full_name.trim(),
        phone:     form.phone.trim() || null,
        email:     form.email.trim() || null,
      })
      .select('id')
      .single()

    if (profileErr) { setError(profileErr.message); setLoading(false); return }

    // 2. Buat student record
    const { error: studentErr } = await supabase
      .from('students')
      .insert({
        profile_id:     profile.id,
        relation_name:  form.relation_name.trim() || null,
        relation_role:  form.relation_role || null,
        relation_phone: form.relation_phone.trim() || null,
        school:         form.school.trim() || null,
        grade:          form.grade.trim() || null,
        notes:          form.notes.trim() || null,
      })

    if (studentErr) {
      // Hapus profile kalau student gagal
      await supabase.from('profiles').delete().eq('id', profile.id)
      setError(studentErr.message); setLoading(false); return
    }

    setLoading(false)
    router.push('/admin/siswa')
  }

  const inputCls = "w-full px-3.5 py-2.5 border border-[#E5E3FF] rounded-xl text-sm bg-[#F7F6FF] text-[#1A1640] placeholder:text-[#7B78A8] focus:outline-none focus:border-[#5C4FE5] focus:bg-white transition"
  const labelCls = "block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5"

  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/siswa" className="text-[#7B78A8] hover:text-[#5C4FE5] transition-colors">← Kembali</Link>
        <h1 className="text-2xl font-black text-[#1A1640]" style={{fontFamily:'Sora,sans-serif'}}>Tambah Siswa</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ── DATA SISWA ── */}
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Sekolah <span className="normal-case font-normal text-[#7B78A8]">(opsional)</span></label>
              <input type="text" name="school" value={form.school} onChange={handleChange}
                placeholder="Nama sekolah" className={inputCls}/>
            </div>
            <div>
              <label className={labelCls}>Kelas/Tingkat <span className="normal-case font-normal text-[#7B78A8]">(opsional)</span></label>
              <input type="text" name="grade" value={form.grade} onChange={handleChange}
                placeholder="Contoh: Kelas 10, Semester 3" className={inputCls}/>
            </div>
          </div>
        </div>

        {/* ── PIHAK BERELASI ── */}
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

          {form.relation_role !== 'Diri Sendiri' && (
            <>
              <div>
                <label className={labelCls}>Nama {form.relation_role}</label>
                <input type="text" name="relation_name" value={form.relation_name} onChange={handleChange}
                  placeholder={`Nama ${form.relation_role.toLowerCase()} siswa`} className={inputCls}/>
              </div>
              <div>
                <label className={labelCls}>No. HP {form.relation_role}</label>
                <input type="text" name="relation_phone" value={form.relation_phone} onChange={handleChange}
                  placeholder="08xxxxxxxxxx" className={inputCls}/>
                <p className="text-xs text-[#7B78A8] mt-1">Nomor ini digunakan untuk notifikasi WhatsApp</p>
              </div>
            </>
          )}

          {form.relation_role === 'Diri Sendiri' && (
            <div className="px-4 py-3 bg-[#EEEDFE] rounded-xl">
              <p className="text-xs font-semibold text-[#3C3489]">
                💡 Notifikasi WhatsApp akan dikirim ke nomor HP siswa yang diisi di atas.
              </p>
            </div>
          )}
        </div>

        {/* ── CATATAN ── */}
        <div className="bg-white rounded-2xl border border-[#E5E3FF] p-6">
          <label className={labelCls}>Catatan <span className="normal-case font-normal text-[#7B78A8]">(opsional)</span></label>
          <textarea name="notes" value={form.notes} onChange={handleChange}
            placeholder="Catatan tambahan tentang siswa ini..."
            rows={3}
            className={`${inputCls} resize-none`}/>
        </div>

        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 font-semibold">{error}</div>
        )}

        <div className="flex gap-3">
          <button type="submit" disabled={loading}
            className="flex-1 py-3 bg-[#5C4FE5] hover:bg-[#3D34C4] text-white font-bold rounded-xl text-sm transition disabled:opacity-60">
            {loading ? 'Menyimpan...' : 'Tambah Siswa'}
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
