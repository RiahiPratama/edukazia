'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2 } from 'lucide-react'

type Course = { id: string; name: string; color: string | null }
type Achievement = { name: string; category: string; issuer: string; year: string }

const CATEGORIES = [
  { value: 'pelatihan',   label: 'Pelatihan',   color: '#EEEDFE', textColor: '#3C3489' },
  { value: 'sertifikasi', label: 'Sertifikasi', color: '#E6F4EC', textColor: '#1A5C36' },
  { value: 'prestasi',    label: 'Prestasi',    color: '#FEF3E2', textColor: '#92400E' },
  { value: 'komunitas',   label: 'Komunitas',   color: '#E6F1FB', textColor: '#185FA5' },
]

const EDU_LEVELS = ['SMA/SMK', 'D3', 'S1', 'S2', 'S3']

export default function TambahTutorPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [courses,         setCourses]         = useState<Course[]>([])
  const [selectedCourses, setSelectedCourses] = useState<string[]>([])
  const [achievements,    setAchievements]    = useState<Achievement[]>([])
  const [subjects,        setSubjects]        = useState<string[]>([])
  const [subjectInput,    setSubjectInput]    = useState('')
  const [loading,         setLoading]         = useState(false)
  const [error,           setError]           = useState('')
  const [success,         setSuccess]         = useState(false)

  const [bimbels, setBimbels] = useState<{id: string; name: string}[]>([])
  const [b2bType, setB2bType] = useState<'solo' | 'bimbel'>('solo')
  const [selectedBimbelId, setSelectedBimbelId] = useState('')

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
    bimbel_id:                 '',
    education_level:           '',
    education_major:           '',
    education_university:      '',
    education_year:            '',
    teaching_experience_years: '',
    previous_workplaces:       '',
    bio:                       '',
  })

  const [newAch, setNewAch] = useState<Achievement>({ name: '', category: 'pelatihan', issuer: '', year: '' })

  useEffect(() => {
    supabase.from('courses').select('id, name, color').eq('is_active', true).then(({ data }) => {
      if (data) setCourses(data)
    })
    supabase.from('bimbels').select('id, name').eq('subscription_status', 'active').then(({ data }) => {
      if (data) setBimbels(data)
    })
  }, [])

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.full_name.trim())  { setError('Nama tutor wajib diisi.'); return }
    if (!form.phone.trim())      { setError('Nomor HP wajib diisi.'); return }
    if (!form.email.trim())      { setError('Email wajib diisi — dipakai untuk login tutor.'); return }
    if (selectedCourses.length === 0) { setError('Pilih minimal 1 kursus.'); return }

    setLoading(true); setError('')

    const res = await fetch('/api/tutor/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        bimbel_id: b2bType === 'bimbel' ? selectedBimbelId : null,
        b2b_type: form.tutor_type === 'b2b' ? b2bType : null,
        subjects,
        achievements,
        selectedCourses,
      }),
    })

    const result = await res.json()

    if (!res.ok || result.error) {
      setError(result.error ?? 'Terjadi kesalahan.')
      setLoading(false)
      return
    }

    // Berhasil — tampilkan notifikasi lalu redirect
    setSuccess(true)
    setTimeout(() => {
      router.push('/admin/tutor')
      router.refresh()
    }, 2000)
  }

  const inputCls   = "w-full px-3.5 py-2.5 border border-[#E5E3FF] rounded-xl text-sm bg-[#F7F6FF] text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] focus:bg-white transition"
  const labelCls   = "block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5"
  const sectionCls = "bg-white rounded-2xl border border-[#E5E3FF] p-6 space-y-4"

  // ── Tampilan sukses ──
  if (success) {
    return (
      <div className="max-w-2xl">
        <div className="bg-white rounded-2xl border border-green-200 p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h2 className="text-lg font-black text-[#1A1640] mb-2">Tutor Berhasil Ditambahkan!</h2>
          <p className="text-sm text-[#7B78A8]">
            Email invite telah dikirim ke <span className="font-semibold text-[#5C4FE5]">{form.email}</span>.<br/>
            Tutor perlu klik link di email untuk set password dan bisa login.
          </p>
          <p className="text-xs text-[#7B78A8] mt-3">Mengalihkan ke daftar tutor...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/tutor" className="text-[#7B78A8] hover:text-[#5C4FE5] transition-colors">← Kembali</Link>
        <h1 className="text-2xl font-black text-[#1A1640]" style={{ fontFamily: 'Sora,sans-serif' }}>Tambah Tutor</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* JENIS TUTOR */}
        <div className={sectionCls}>
          <p className="text-xs font-bold text-[#7B78A8] uppercase tracking-wide">Jenis Tutor</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: 'owner',    label: '👑 Owner',      desc: 'Akses penuh semua materi',          color: 'border-purple-400 bg-purple-50' },
              { value: 'internal', label: '👤 Freelancer', desc: 'Akses terbatas waktu kelas',        color: 'border-green-400 bg-green-50' },
              { value: 'b2b',      label: '🏢 B2B',        desc: 'Tutor dari bimbel mitra',           color: 'border-blue-400 bg-blue-50' },
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
            <div className="space-y-3 p-4 bg-blue-50 rounded-xl border border-blue-200">
              <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">Tipe B2B</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'solo',   label: '👤 Solo',   desc: 'Tutor individu dengan murid sendiri' },
                  { value: 'bimbel', label: '🏢 Bimbel',  desc: 'Bagian dari institusi bimbel' },
                ].map(opt => (
                  <button type="button" key={opt.value}
                    onClick={() => setB2bType(opt.value as 'solo' | 'bimbel')}
                    className={`p-3 rounded-xl border-2 text-left transition-all
                      ${b2bType === opt.value ? 'border-blue-500 bg-blue-100 ring-2 ring-offset-1 ring-blue-400' : 'border-blue-200 bg-white hover:border-blue-400'}`}>
                    <p className="font-bold text-sm text-[#1A1640]">{opt.label}</p>
                    <p className="text-xs text-[#7B78A8] mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>

              {b2bType === 'solo' && (
                <div>
                  <label className={labelCls}>Nama Usaha / Brand (opsional)</label>
                  <input name="bimbel_name" value={form.bimbel_name} onChange={handleChange}
                    placeholder="Contoh: Les Privat Bu Ani..." className={inputCls} />
                </div>
              )}

              {b2bType === 'bimbel' && (
                <div>
                  <label className={labelCls}>Pilih Bimbel *</label>
                  {bimbels.length === 0 ? (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-xs text-yellow-700">
                      ⚠️ Belum ada bimbel aktif. Tambah bimbel dulu di menu <strong>Bimbel (B2B)</strong>.
                    </div>
                  ) : (
                    <select value={selectedBimbelId} onChange={e => setSelectedBimbelId(e.target.value)}
                      className={inputCls}>
                      <option value="">Pilih bimbel...</option>
                      {bimbels.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}
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
              <label className={labelCls}>Nomor HP <span className="text-red-500">*</span></label>
              <input type="tel" name="phone" value={form.phone} onChange={handleChange} placeholder="08xxxxxxxxxx" className={inputCls}/>
            </div>
          </div>

          {/* Email sekarang WAJIB */}
          <div>
            <label className={labelCls}>
              Email <span className="text-red-500">*</span>
              <span className="normal-case font-normal text-[#7B78A8] ml-1">— dipakai untuk login tutor</span>
            </label>
            <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="email@contoh.com" className={inputCls}/>
            <p className="text-xs text-[#7B78A8] mt-1">
              Tutor akan menerima email invite untuk set password dan bisa login ke dashboard.
            </p>
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

        {/* REKENING */}
        <div className={sectionCls}>
          <p className="text-xs font-bold text-[#7B78A8] uppercase tracking-wide">Info Rekening <span className="normal-case font-normal">(opsional)</span></p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Nama Bank</label>
              <input type="text" name="bank_name" value={form.bank_name} onChange={handleChange} placeholder="BCA, BRI, dll" className={inputCls}/>
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
            <input type="number" name="rate_per_session" value={form.rate_per_session} onChange={handleChange} placeholder="Contoh: 150000" className={inputCls}/>
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
              <input type="text" name="previous_workplaces" value={form.previous_workplaces} onChange={handleChange} placeholder="SMPN 1 Ternate, LBB..." className={inputCls}/>
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
                <input type="text" value={newAch.name} onChange={e => setNewAch(p => ({ ...p, name: e.target.value }))}
                  placeholder="Contoh: TOEFL Score 550" className={inputCls}/>
              </div>
              <div>
                <label className={labelCls}>Kategori</label>
                <select value={newAch.category} onChange={e => setNewAch(p => ({ ...p, category: e.target.value }))} className={inputCls}>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Lembaga/Penyelenggara</label>
                <input type="text" value={newAch.issuer} onChange={e => setNewAch(p => ({ ...p, issuer: e.target.value }))}
                  placeholder="ETS, Kemdikbud..." className={inputCls}/>
              </div>
              <div>
                <label className={labelCls}>Tahun</label>
                <input type="text" value={newAch.year} onChange={e => setNewAch(p => ({ ...p, year: e.target.value }))}
                  placeholder="2021" className={inputCls}/>
              </div>
            </div>
            <button type="button" onClick={addAchievement}
              className="flex items-center gap-2 px-4 py-2 bg-[#5C4FE5] text-white rounded-xl text-sm font-bold hover:bg-[#3D34C4] transition">
              <Plus size={13}/> Tambah
            </button>
          </div>
          {achievements.length > 0 && (
            <div className="space-y-2 mt-2">
              {achievements.map((a, idx) => {
                const cat = CATEGORIES.find(c => c.value === a.category) ?? CATEGORIES[0]
                return (
                  <div key={idx} className="flex items-center justify-between gap-3 px-4 py-3 bg-white border border-[#E5E3FF] rounded-xl">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[#1A1640]">{a.name}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                          style={{ background: cat.color, color: cat.textColor }}>
                          {cat.label}
                        </span>
                      </div>
                      <div className="text-xs text-[#7B78A8] mt-0.5">{a.issuer}{a.year ? ` · ${a.year}` : ''}</div>
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
          <button type="submit" disabled={loading}
            className="flex-1 py-3 bg-[#5C4FE5] hover:bg-[#3D34C4] text-white font-bold rounded-xl text-sm transition disabled:opacity-60">
            {loading ? 'Menyimpan & Mengirim Invite...' : 'Simpan & Kirim Invite Email'}
          </button>
          <Link href="/admin/tutor"
            className="px-6 py-3 border border-[#E5E3FF] text-[#4A4580] font-bold rounded-xl text-sm hover:bg-[#F0EFFF] transition text-center">
            Batal
          </Link>
        </div>
      </form>
    </div>
  )
}
