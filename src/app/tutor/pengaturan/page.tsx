'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Save, Eye, EyeOff, CheckCircle2, AlertCircle, Mail, Camera } from 'lucide-react'

const HARI = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']
const JAM  = ['06:00','07:00','08:00','09:00','10:00','11:00','12:00','13:00',
               '14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00','22:00','23:00']

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
}

async function compressAndUpload(file: File, path: string, supabase: any): Promise<string | null> {
  if (file.size > 1024 * 1024) return null
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = async () => {
      const SIZE = 400
      const canvas = document.createElement('canvas')
      canvas.width = SIZE; canvas.height = SIZE
      const ctx = canvas.getContext('2d')!
      const min = Math.min(img.width, img.height)
      ctx.drawImage(img, (img.width - min) / 2, (img.height - min) / 2, min, min, 0, 0, SIZE, SIZE)
      URL.revokeObjectURL(url)
      canvas.toBlob(async (blob) => {
        if (!blob) { resolve(null); return }
        const { error } = await supabase.storage
          .from('avatars').upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
        if (error) { resolve(null); return }
        const { data } = supabase.storage.from('avatars').getPublicUrl(path)
        resolve(data.publicUrl + '?t=' + Date.now())
      }, 'image/jpeg', 0.85)
    }
    img.src = url
  })
}

function Msg({ msg }: { msg: { type: 'ok'|'err'; text: string } | null }) {
  if (!msg) return null
  return (
    <div className={`flex items-start gap-2 text-[11px] px-3 py-2 rounded-xl border ${
      msg.type === 'ok' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-600 border-red-200'
    }`}>
      {msg.type === 'ok'
        ? <CheckCircle2 size={13} className="mt-0.5 flex-shrink-0"/>
        : <AlertCircle size={13} className="mt-0.5 flex-shrink-0"/>}
      <span>{msg.text}</span>
    </div>
  )
}

export default function TutorPengaturanPage() {
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<'akun' | 'ketersediaan'>('akun')

  const [profile,         setProfile]         = useState<any>(null)
  const [tutorId,         setTutorId]         = useState<string | null>(null)
  const [formAkun,        setFormAkun]        = useState({ full_name: '', phone: '' })
  const [avatarUrl,       setAvatarUrl]       = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [savingAkun,      setSavingAkun]      = useState(false)
  const [akunMsg,         setAkunMsg]         = useState<{ type: 'ok'|'err'; text: string } | null>(null)

  const [formEmail,   setFormEmail]   = useState({ newEmail: '' })
  const [savingEmail, setSavingEmail] = useState(false)
  const [emailMsg,    setEmailMsg]    = useState<{ type: 'ok'|'err'; text: string } | null>(null)

  const [formPwd,   setFormPwd]   = useState({ password: '', confirm: '' })
  const [showPwd,   setShowPwd]   = useState(false)
  const [savingPwd, setSavingPwd] = useState(false)
  const [pwdMsg,    setPwdMsg]    = useState<{ type: 'ok'|'err'; text: string } | null>(null)

  // Ketersediaan: { Senin: ['08:00','09:00'], ... }
  const [availability, setAvailability] = useState<Record<string, string[]>>({})
  const [savingAvail,  setSavingAvail]  = useState(false)
  const [availMsg,     setAvailMsg]     = useState<{ type: 'ok'|'err'; text: string } | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: p } = await supabase.from('profiles')
        .select('id, full_name, email, phone, avatar_url').eq('id', session.user.id).single()
      if (p) {
        setProfile(p)
        setFormAkun({ full_name: p.full_name ?? '', phone: p.phone ?? '' })
        setAvatarUrl(p.avatar_url ?? null)
      }

      const { data: tutor } = await supabase.from('tutors')
        .select('id, availability, timezone').eq('profile_id', session.user.id).single()
      if (tutor) {
        setTutorId(tutor.id)
        setAvailability(tutor.availability ?? {})
        setTimezone(tutor.timezone ?? 'WIT')
      }
    }
    load()
  }, [])

  async function handleAvatarUpload(file: File) {
    if (!profile) return
    if (file.size > 1024 * 1024) { setAkunMsg({ type: 'err', text: 'Ukuran foto maksimal 1MB.' }); return }
    setUploadingAvatar(true); setAkunMsg(null)
    const url = await compressAndUpload(file, `tutors/${profile.id}.jpg`, supabase)
    setUploadingAvatar(false)
    if (!url) { setAkunMsg({ type: 'err', text: 'Gagal upload foto.' }); return }
    await supabase.from('profiles').update({ avatar_url: url }).eq('id', profile.id)
    setAvatarUrl(url)
    setAkunMsg({ type: 'ok', text: 'Foto profil berhasil diperbarui!' })
  }

  async function saveAkun() {
    if (!profile) return
    setSavingAkun(true); setAkunMsg(null)
    const { error } = await supabase.from('profiles')
      .update({ full_name: formAkun.full_name.trim(), phone: formAkun.phone.trim() || null })
      .eq('id', profile.id)
    setSavingAkun(false)
    setAkunMsg(error ? { type: 'err', text: error.message } : { type: 'ok', text: 'Profil berhasil disimpan!' })
  }

  async function saveEmail() {
    const newEmail = formEmail.newEmail.trim().toLowerCase()
    if (!newEmail) { setEmailMsg({ type: 'err', text: 'Email tidak boleh kosong.' }); return }
    if (newEmail === profile?.email) { setEmailMsg({ type: 'err', text: 'Email sama dengan yang sekarang.' }); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) { setEmailMsg({ type: 'err', text: 'Format email tidak valid.' }); return }
    setSavingEmail(true); setEmailMsg(null)
    const { error } = await supabase.auth.updateUser({ email: newEmail })
    setSavingEmail(false)
    if (error) { setEmailMsg({ type: 'err', text: error.message }); return }
    setEmailMsg({ type: 'ok', text: `Link konfirmasi dikirim ke ${newEmail}.` })
    setFormEmail({ newEmail: '' })
  }

  async function savePassword() {
    if (formPwd.password !== formPwd.confirm) { setPwdMsg({ type: 'err', text: 'Password tidak cocok.' }); return }
    if (formPwd.password.length < 6) { setPwdMsg({ type: 'err', text: 'Password minimal 6 karakter.' }); return }
    setSavingPwd(true); setPwdMsg(null)
    const { error } = await supabase.auth.updateUser({ password: formPwd.password })
    setSavingPwd(false)
    if (error) { setPwdMsg({ type: 'err', text: error.message }); return }
    setPwdMsg({ type: 'ok', text: 'Password berhasil diubah!' })
    setFormPwd({ password: '', confirm: '' })
  }

  function toggleJam(hari: string, jam: string) {
    setAvailability(prev => {
      const list = prev[hari] ?? []
      const exists = list.includes(jam)
      return {
        ...prev,
        [hari]: exists ? list.filter(j => j !== jam) : [...list, jam].sort(),
      }
    })
  }

  async function saveAvailability() {
    if (!tutorId) return
    setSavingAvail(true); setAvailMsg(null)
    const { error } = await supabase.from('tutors')
      .update({ availability, timezone }).eq('id', tutorId)
    setSavingAvail(false)
    setAvailMsg(error ? { type: 'err', text: error.message } : { type: 'ok', text: 'Ketersediaan berhasil disimpan!' })
  }

  const inputCls = "w-full px-3.5 py-2.5 border border-[#E5E3FF] rounded-xl text-sm bg-[#F7F6FF] text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] focus:bg-white transition"
  const labelCls = "block text-[10px] font-bold text-[#7B78A8] uppercase tracking-wider mb-1.5"

  const TABS = [
    { key: 'akun',          label: 'Akun' },
    { key: 'ketersediaan',  label: 'Ketersediaan' },
  ] as const

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-[#1A1640] font-['Sora']">Pengaturan</h1>
        <p className="text-sm text-[#7B78A8] mt-1">Kelola profil dan ketersediaan mengajar</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#F7F6FF] p-1 rounded-xl mb-5 border border-[#E5E3FF]">
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === tab.key ? 'bg-white text-[#5C4FE5] shadow-sm' : 'text-[#7B78A8] hover:text-[#1A1640]'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══ Tab Akun ═══ */}
      {activeTab === 'akun' && (
        <div className="flex flex-col gap-5">

          {/* Data Pribadi */}
          <div className="bg-white rounded-2xl border border-[#E5E3FF] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#F0EFFF] bg-[#F7F6FF]">
              <p className="text-sm font-bold text-[#1A1640]">Data Pribadi</p>
            </div>
            <div className="px-5 py-5 flex flex-col gap-4">
              {/* Avatar */}
              <div className="flex flex-col items-center gap-2">
                <div className="relative cursor-pointer" onClick={() => fileRef.current?.click()}>
                  {avatarUrl
                    ? <img src={avatarUrl} alt={formAkun.full_name}
                        className="w-20 h-20 rounded-full object-cover border-2 border-[#5C4FE5]"/>
                    : <div className="w-20 h-20 rounded-full flex items-center justify-center text-xl font-bold border-2 border-[#5C4FE5] bg-[#EEEDFE] text-[#3C3489]">
                        {initials(formAkun.full_name || 'T')}
                      </div>
                  }
                  <div className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-[#5C4FE5] border-2 border-white flex items-center justify-center">
                    <Camera size={10} color="white"/>
                  </div>
                </div>
                <p className="text-[10px] text-[#7B78A8]">
                  {uploadingAvatar ? 'Mengupload...' : 'Klik untuk ganti foto (maks. 1MB)'}
                </p>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                  onChange={e => { if (e.target.files?.[0]) handleAvatarUpload(e.target.files[0]); e.target.value = '' }}/>
              </div>

              <div>
                <label className={labelCls}>Nama Lengkap</label>
                <input type="text" value={formAkun.full_name}
                  onChange={e => setFormAkun(p => ({ ...p, full_name: e.target.value }))} className={inputCls}/>
              </div>
              <div>
                <label className={labelCls}>Email Saat Ini</label>
                <input type="text" value={profile?.email ?? '—'} disabled
                  className={inputCls + ' opacity-50 cursor-not-allowed'}/>
              </div>
              <div>
                <label className={labelCls}>No. HP</label>
                <input type="text" value={formAkun.phone}
                  onChange={e => setFormAkun(p => ({ ...p, phone: e.target.value }))}
                  placeholder="08xx-xxxx-xxxx" className={inputCls}/>
              </div>
              <Msg msg={akunMsg}/>
              <button onClick={saveAkun} disabled={savingAkun}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#5C4FE5] hover:bg-[#3D34C4] text-white text-sm font-bold transition disabled:opacity-50">
                <Save size={14}/>{savingAkun ? 'Menyimpan…' : 'Simpan Perubahan'}
              </button>
            </div>
          </div>

          {/* Ganti Email */}
          <div className="bg-white rounded-2xl border border-[#E5E3FF] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#F0EFFF] bg-[#F7F6FF]">
              <p className="text-sm font-bold text-[#1A1640]">Ganti Email</p>
            </div>
            <div className="px-5 py-5 flex flex-col gap-4">
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-blue-50 border border-blue-100">
                <Mail size={13} className="text-blue-500 mt-0.5 flex-shrink-0"/>
                <p className="text-[11px] text-blue-700 leading-relaxed">
                  Link konfirmasi dikirim ke email baru. Klik link untuk menyelesaikan perubahan.
                </p>
              </div>
              <div>
                <label className={labelCls}>Email Baru</label>
                <input type="email" value={formEmail.newEmail}
                  onChange={e => setFormEmail({ newEmail: e.target.value })}
                  placeholder="emailbaru@contoh.com" className={inputCls}/>
              </div>
              <Msg msg={emailMsg}/>
              <button onClick={saveEmail} disabled={savingEmail}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition disabled:opacity-50">
                <Mail size={14}/>{savingEmail ? 'Mengirim…' : 'Kirim Link Konfirmasi'}
              </button>
            </div>
          </div>

          {/* Ganti Password */}
          <div className="bg-white rounded-2xl border border-[#E5E3FF] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#F0EFFF] bg-[#F7F6FF]">
              <p className="text-sm font-bold text-[#1A1640]">Ganti Password</p>
            </div>
            <div className="px-5 py-5 flex flex-col gap-4">
              <div>
                <label className={labelCls}>Password Baru</label>
                <div className="relative">
                  <input type={showPwd ? 'text' : 'password'} value={formPwd.password}
                    onChange={e => setFormPwd(p => ({ ...p, password: e.target.value }))}
                    placeholder="Minimal 6 karakter" className={inputCls + ' pr-10'}/>
                  <button onClick={() => setShowPwd(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7B78A8] hover:text-[#1A1640]">
                    {showPwd ? <EyeOff size={15}/> : <Eye size={15}/>}
                  </button>
                </div>
              </div>
              <div>
                <label className={labelCls}>Konfirmasi Password</label>
                <input type={showPwd ? 'text' : 'password'} value={formPwd.confirm}
                  onChange={e => setFormPwd(p => ({ ...p, confirm: e.target.value }))}
                  placeholder="Ulangi password baru" className={inputCls}/>
              </div>
              <Msg msg={pwdMsg}/>
              <button onClick={savePassword} disabled={savingPwd}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#1A1640] hover:bg-[#0D0C20] text-white text-sm font-bold transition disabled:opacity-50">
                <Save size={14}/>{savingPwd ? 'Menyimpan…' : 'Ubah Password'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Tab Ketersediaan ═══ */}
      {activeTab === 'ketersediaan' && (
        <div className="flex flex-col gap-4">
          <div className="bg-[#F7F6FF] border border-[#E5E3FF] rounded-xl px-4 py-3">
            <p className="text-xs text-[#5C4FE5] font-semibold mb-1">ℹ️ Info</p>
            <p className="text-[11px] text-[#7B78A8] leading-relaxed">
              Tandai jam dan hari kamu tersedia untuk mengajar. Admin akan menggunakan info ini saat menjadwalkan kelas.
            </p>
          </div>

          {/* Pilihan Timezone */}
          <div className="bg-white rounded-2xl border border-[#E5E3FF] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#F0EFFF] bg-[#F7F6FF]">
              <p className="text-sm font-bold text-[#1A1640]">Zona Waktu Kamu</p>
              <p className="text-[11px] text-[#7B78A8] mt-0.5">Jam ketersediaan akan dicatat dalam zona waktu ini</p>
            </div>
            <div className="px-4 py-4">
              <div className="grid grid-cols-3 gap-2">
                {(['WIB', 'WITA', 'WIT'] as const).map(tz => (
                  <button key={tz} onClick={() => setTimezone(tz)}
                    className={`py-2.5 rounded-xl text-sm font-bold border transition-all ${
                      timezone === tz
                        ? 'bg-[#5C4FE5] text-white border-[#5C4FE5]'
                        : 'bg-white text-[#7B78A8] border-[#E5E3FF] hover:border-[#5C4FE5] hover:text-[#5C4FE5]'
                    }`}>
                    {tz}
                    <span className="block text-[10px] font-normal mt-0.5 opacity-70">
                      {tz === 'WIB' ? 'UTC+7' : tz === 'WITA' ? 'UTC+8' : 'UTC+9'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {HARI.map(hari => {
            const jamDipilih = availability[hari] ?? []
            const adaJam     = jamDipilih.length > 0
            return (
              <div key={hari} className="bg-white rounded-2xl border border-[#E5E3FF] overflow-hidden">
                <div className={`px-4 py-3 border-b border-[#F0EFFF] flex items-center justify-between ${adaJam ? 'bg-[#EEEDFE]' : 'bg-[#F7F6FF]'}`}>
                  <p className={`text-sm font-bold ${adaJam ? 'text-[#3C3489]' : 'text-[#7B78A8]'}`}>{hari}</p>
                  {adaJam && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#5C4FE5] text-white">
                      {jamDipilih.length} jam
                    </span>
                  )}
                </div>
                <div className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {JAM.map(jam => {
                      const active = jamDipilih.includes(jam)
                      return (
                        <button key={jam} onClick={() => toggleJam(hari, jam)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                            active
                              ? 'bg-[#5C4FE5] text-white border-[#5C4FE5]'
                              : 'bg-white text-[#7B78A8] border-[#E5E3FF] hover:border-[#5C4FE5] hover:text-[#5C4FE5]'
                          }`}>
                          {jam}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })}

          <Msg msg={availMsg}/>
          <button onClick={saveAvailability} disabled={savingAvail}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#5C4FE5] hover:bg-[#3D34C4] text-white font-bold text-sm transition disabled:opacity-50">
            <Save size={14}/>{savingAvail ? 'Menyimpan…' : 'Simpan Ketersediaan'}
          </button>
        </div>
      )}
    </div>
  )
}
