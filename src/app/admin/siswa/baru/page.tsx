'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PROVINCES, getCities } from '@/lib/wilayah'

export default function SiswaBaruPage() {
  const router   = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

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

  // State untuk akun login
  const [buatAkunOrtu, setBuatAkunOrtu]   = useState(false)
  const [buatAkunSiswa, setBuatAkunSiswa] = useState(false)
  const [akunOrtu, setAkunOrtu] = useState({ email: '', password: '' })
  const [akunSiswa, setAkunSiswa] = useState({ email: '', password: '' })

  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const RELATION_ROLES = ['Orang Tua', 'Wali', 'Diri Sendiri']
  const isSelf  = form.relation_role === 'Diri Sendiri'
  const cities  = form.province ? getCities(form.province) : []

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target
    if (name === 'province') {
      setForm(prev => ({ ...prev, province: value, city: '' }))
    } else {
      setForm(prev => ({ ...prev, [name]: value }))
    }
    // Reset toggle akun ortu kalau ganti ke Diri Sendiri
    if (name === 'relation_role' && value === 'Diri Sendiri') {
      setBuatAkunOrtu(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.full_name.trim()) { setError('Nama siswa wajib diisi.'); return }

    // Validasi akun ortu
    if (buatAkunOrtu) {
      if (!akunOrtu.email.trim())    { setError('Email akun ortu wajib diisi.'); return }
      if (akunOrtu.password.length < 8) { setError('Password akun ortu minimal 8 karakter.'); return }
    }

    // Validasi akun siswa
    if (buatAkunSiswa) {
      if (!akunSiswa.email.trim())    { setError('Email akun siswa wajib diisi.'); return }
      if (akunSiswa.password.length < 8) { setError('Password akun siswa minimal 8 karakter.'); return }
    }

    setLoading(true); setError('')

    let profileSiswaId: string | null = null

    try {
      // -------------------------------------------------------
      // 1. Buat profile siswa (tanpa auth dulu)
      // -------------------------------------------------------
      const { data: profileSiswa, error: errProfileSiswa } = await supabase
        .from('profiles')
        .insert({
          full_name: form.full_name.trim(),
          phone:     form.phone.trim()  || null,
          email:     form.email.trim()  || null,
          role:      'student',
        })
        .select('id').single()

      if (errProfileSiswa) throw new Error(`Gagal buat profil siswa: ${errProfileSiswa.message}`)
      profileSiswaId = profileSiswa.id

      // -------------------------------------------------------
      // 2. Buat akun auth siswa (jika diaktifkan)
      // -------------------------------------------------------
      if (buatAkunSiswa) {
        const res = await fetch('/api/admin/create-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email:      akunSiswa.email.trim(),
            password:   akunSiswa.password,
            profile_id: profileSiswa.id,
            role:       'student',
          }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(`Gagal buat akun siswa: ${json.error}`)
      }

      // -------------------------------------------------------
      // 3. Buat akun auth + profile ortu (jika diaktifkan)
      // -------------------------------------------------------
      let parentProfileId: string | null = null

      if (buatAkunOrtu && !isSelf) {
        // Cek email ortu sudah ada di profiles belum
        const { data: existingParent } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', akunOrtu.email.trim())
          .single()

        if (existingParent) {
          // Email sudah ada → pakai profile yang sudah ada
          parentProfileId = existingParent.id
        } else {
          // Buat akun baru untuk ortu
          const res = await fetch('/api/admin/create-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email:    akunOrtu.email.trim(),
              password: akunOrtu.password,
              role:     'parent',
              full_name: form.relation_name.trim() || null,
              phone:    form.relation_phone.trim()  || null,
            }),
          })
          const json = await res.json()
          if (!res.ok) throw new Error(`Gagal buat akun ortu: ${json.error}`)
          parentProfileId = json.profile_id
        }
      }

      // -------------------------------------------------------
      // 4. Insert ke tabel students
      // -------------------------------------------------------
      const { error: errStudent } = await supabase.from('students').insert({
        profile_id:        profileSiswa.id,
        parent_profile_id: parentProfileId,
        birth_date:        form.birth_date        || null,
        province:          form.province          || null,
        city:              form.city              || null,
        relation_name:     isSelf ? form.full_name.trim() : (form.relation_name.trim()  || null),
        relation_role:     form.relation_role     || null,
        relation_phone:    isSelf ? form.phone.trim()     : (form.relation_phone.trim() || null),
        relation_email:    isSelf ? form.email.trim()     : (form.relation_email.trim() || null),
        school:            form.school.trim()     || null,
        grade:             form.grade.trim()      || null,
        notes:             form.notes.trim()      || null,
      })

      if (errStudent) throw new Error(`Gagal simpan data siswa: ${errStudent.message}`)

      router.push('/admin/siswa')

    } catch (err: any) {
      // Rollback: hapus profile siswa jika sudah dibuat
      if (profileSiswaId) {
        await supabase.from('profiles').delete().eq('id', profileSiswaId)
      }
      setError(err.message ?? 'Terjadi kesalahan.')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = "w-full px-3.5 py-2.5 border border-[#E5E3FF] rounded-xl text-sm bg-[#F7F6FF] text-[#1A1640] placeholder:text-[#7B78A8] focus:outline-none focus:border-[#5C4FE5] focus:bg-white transition"
  const labelCls = "block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5"

  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/siswa" className="text-[#7B78A8] hover:text-[#5C4FE5] transition-colors">
          ← Kembali
        </Link>
        <h1 className="text-2xl font-black text-[#1A1640]" style={{ fontFamily: 'Sora,sans-serif' }}>
          Tambah Siswa
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ── DATA SISWA ── */}
        <div className="bg-white rounded-2xl border border-[#E5E3FF] p-6 space-y-4">
          <p className="text-xs font-bold text-[#7B78A8] uppercase tracking-wide">Data Siswa</p>

          <div>
            <label className={labelCls}>Nama Lengkap <span className="text-red-500">*</span></label>
            <input type="text" name="full_name" value={form.full_name} onChange={handleChange}
              placeholder="Nama lengkap siswa" className={inputCls} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>No. HP Siswa</label>
              <input type="text" name="phone" value={form.phone} onChange={handleChange}
                placeholder="08xxxxxxxxxx" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Email <span className="normal-case font-normal text-[#7B78A8]">(opsional)</span></label>
              <input type="email" name="email" value={form.email} onChange={handleChange}
                placeholder="email@contoh.com" className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Tanggal Lahir <span className="normal-case font-normal text-[#7B78A8]">(opsional)</span></label>
            <input type="date" name="birth_date" value={form.birth_date} onChange={handleChange} className={inputCls} />
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
                disabled={!form.province}
                className={`${inputCls} ${!form.province ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <option value="">-- Pilih Kab/Kota --</option>
                {cities.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Sekolah <span className="normal-case font-normal text-[#7B78A8]">(opsional)</span></label>
              <input type="text" name="school" value={form.school} onChange={handleChange}
                placeholder="Nama sekolah" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Kelas/Tingkat <span className="normal-case font-normal text-[#7B78A8]">(opsional)</span></label>
              <input type="text" name="grade" value={form.grade} onChange={handleChange}
                placeholder="Kelas 10 / Semester 3" className={inputCls} />
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

          {!isSelf ? (
            <>
              <div>
                <label className={labelCls}>Nama {form.relation_role}</label>
                <input type="text" name="relation_name" value={form.relation_name} onChange={handleChange}
                  placeholder={`Nama ${form.relation_role.toLowerCase()} siswa`} className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>No. HP {form.relation_role}</label>
                  <input type="text" name="relation_phone" value={form.relation_phone} onChange={handleChange}
                    placeholder="08xxxxxxxxxx" className={inputCls} />
                  <p className="text-xs text-[#7B78A8] mt-1">Untuk notifikasi WhatsApp</p>
                </div>
                <div>
                  <label className={labelCls}>Email {form.relation_role} <span className="normal-case font-normal text-[#7B78A8]">(opsional)</span></label>
                  <input type="email" name="relation_email" value={form.relation_email} onChange={handleChange}
                    placeholder="email@contoh.com" className={inputCls} />
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

        {/* ── AKUN LOGIN ── */}
        <div className="bg-white rounded-2xl border border-[#E5E3FF] p-6 space-y-4">
          <div>
            <p className="text-xs font-bold text-[#7B78A8] uppercase tracking-wide">Akun Login Portal</p>
            <p className="text-xs text-[#7B78A8] mt-0.5">Opsional — buat akun agar bisa mengakses portal siswa</p>
          </div>

          {/* Toggle akun siswa */}
          <div className="flex items-center justify-between p-3 bg-[#F7F6FF] rounded-xl border border-[#E5E3FF]">
            <div>
              <p className="text-sm font-semibold text-[#1A1640]">Akun untuk Siswa</p>
              <p className="text-xs text-[#7B78A8] mt-0.5">Siswa bisa login langsung ke portal</p>
            </div>
            <button
              type="button"
              onClick={() => setBuatAkunSiswa(v => !v)}
              className={`relative w-11 h-6 rounded-full transition-colors ${buatAkunSiswa ? 'bg-[#5C4FE5]' : 'bg-[#D1CFE8]'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${buatAkunSiswa ? 'left-5' : 'left-0.5'}`} />
            </button>
          </div>

          {buatAkunSiswa && (
            <div className="grid grid-cols-2 gap-4 pl-1">
              <div>
                <label className={labelCls}>Email Siswa <span className="text-red-500">*</span></label>
                <input type="email" value={akunSiswa.email}
                  onChange={e => setAkunSiswa(v => ({ ...v, email: e.target.value }))}
                  placeholder="email@siswa.com" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Password <span className="text-red-500">*</span></label>
                <input type="password" value={akunSiswa.password}
                  onChange={e => setAkunSiswa(v => ({ ...v, password: e.target.value }))}
                  placeholder="Min. 8 karakter" className={inputCls} />
              </div>
            </div>
          )}

          {/* Toggle akun ortu — hanya muncul jika bukan Diri Sendiri */}
          {!isSelf && (
            <>
              <div className="flex items-center justify-between p-3 bg-[#F7F6FF] rounded-xl border border-[#E5E3FF]">
                <div>
                  <p className="text-sm font-semibold text-[#1A1640]">
                    Akun untuk {form.relation_role}
                  </p>
                  <p className="text-xs text-[#7B78A8] mt-0.5">
                    {form.relation_role} bisa login dan memantau perkembangan siswa
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setBuatAkunOrtu(v => !v)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${buatAkunOrtu ? 'bg-[#5C4FE5]' : 'bg-[#D1CFE8]'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${buatAkunOrtu ? 'left-5' : 'left-0.5'}`} />
                </button>
              </div>

              {buatAkunOrtu && (
                <>
                  <div className="grid grid-cols-2 gap-4 pl-1">
                    <div>
                      <label className={labelCls}>Email {form.relation_role} <span className="text-red-500">*</span></label>
                      <input type="email" value={akunOrtu.email}
                        onChange={e => setAkunOrtu(v => ({ ...v, email: e.target.value }))}
                        placeholder="email@ortu.com" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Password <span className="text-red-500">*</span></label>
                      <input type="password" value={akunOrtu.password}
                        onChange={e => setAkunOrtu(v => ({ ...v, password: e.target.value }))}
                        placeholder="Min. 8 karakter" className={inputCls} />
                    </div>
                  </div>
                  <div className="px-4 py-3 bg-[#EEEDFE] rounded-xl">
                    <p className="text-xs font-semibold text-[#3C3489]">
                      💡 Jika email ini sudah terdaftar, akun yang ada akan dipakai dan siswa ini
                      akan ditambahkan ke daftar anak di akun tersebut.
                    </p>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* ── CATATAN ── */}
        <div className="bg-white rounded-2xl border border-[#E5E3FF] p-6">
          <label className={labelCls}>Catatan <span className="normal-case font-normal text-[#7B78A8]">(opsional)</span></label>
          <textarea name="notes" value={form.notes} onChange={handleChange}
            placeholder="Catatan tambahan tentang siswa ini..."
            rows={3} className={`${inputCls} resize-none`} />
        </div>

        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 font-semibold">
            {error}
          </div>
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
