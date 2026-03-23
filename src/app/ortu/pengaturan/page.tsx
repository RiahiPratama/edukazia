'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Save, Eye, EyeOff, CheckCircle2, AlertCircle, Mail, Camera } from 'lucide-react'

const CHILD_COLORS = ['#E6B800', '#1D9E75', '#5C4FE5', '#D85A30', '#639922']
const CHILD_BG     = ['#FAEEDA', '#E1F5EE', '#EEEDFE', '#FAECE7', '#EAF3DE']
const CHILD_TEXT   = ['#412402', '#085041', '#3C3489', '#4A1B0C', '#173404']
const RELATION_OPTIONS = ['ayah', 'ibu', 'wali']

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
      const sx  = (img.width  - min) / 2
      const sy  = (img.height - min) / 2
      ctx.drawImage(img, sx, sy, min, min, 0, 0, SIZE, SIZE)
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

function AvatarUpload({ name, avatarUrl, onUpload, uploading, color = '#E6B800', bg = '#FAEEDA', text = '#412402', size = 80 }: {
  name: string; avatarUrl: string | null; onUpload: (f: File) => void
  uploading?: boolean; color?: string; bg?: string; text?: string; size?: number
}) {
  const ref = useRef<HTMLInputElement>(null)
  const fs = `${Math.round(size * 0.22)}px`
  return (
    <div className="flex flex-col items-center gap-1.5 mb-3">
      <div className="relative cursor-pointer" onClick={() => ref.current?.click()}>
        {avatarUrl
          ? <img src={avatarUrl} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${color}` }}/>
          : <div style={{ width: size, height: size, borderRadius: '50%', background: bg, color: text, border: `2px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: fs, fontWeight: 700 }}>{initials(name)}</div>
        }
        <div style={{ position: 'absolute', bottom: 0, right: 0, width: 22, height: 22, borderRadius: '50%', background: color, border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Camera size={10} color="white"/>
        </div>
      </div>
      <p className="text-[10px] text-stone-400">{uploading ? 'Mengupload...' : 'Klik untuk ganti foto (maks. 1MB)'}</p>
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
        onChange={e => { if (e.target.files?.[0]) onUpload(e.target.files[0]); e.target.value = '' }}/>
    </div>
  )
}

function Msg({ msg }: { msg: { type: 'ok'|'err'; text: string } | null }) {
  if (!msg) return null
  return (
    <div className={`flex items-start gap-2 text-[11px] px-3 py-2 rounded-lg ${msg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
      {msg.type === 'ok' ? <CheckCircle2 size={13} className="mt-0.5 flex-shrink-0"/> : <AlertCircle size={13} className="mt-0.5 flex-shrink-0"/>}
      <span>{msg.text}</span>
    </div>
  )
}

export default function OrtuPengaturanPage() {
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<'akun' | 'anak'>('akun')

  const [profile,         setProfile]         = useState<any>(null)
  const [formAkun,        setFormAkun]        = useState({ full_name: '', phone: '' })
  const [avatarUrl,       setAvatarUrl]       = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [savingAkun,      setSavingAkun]      = useState(false)
  const [akunMsg,         setAkunMsg]         = useState<{ type: 'ok'|'err'; text: string } | null>(null)

  const [formPwd,    setFormPwd]    = useState({ password: '', confirm: '' })
  const [showPwd,    setShowPwd]    = useState(false)
  const [savingPwd,  setSavingPwd]  = useState(false)
  const [pwdMsg,     setPwdMsg]     = useState<{ type: 'ok'|'err'; text: string } | null>(null)

  const [formEmail,   setFormEmail]   = useState({ newEmail: '' })
  const [savingEmail, setSavingEmail] = useState(false)
  const [emailMsg,    setEmailMsg]    = useState<{ type: 'ok'|'err'; text: string } | null>(null)

  const [children,       setChildren]       = useState<any[]>([])
  const [editingChild,   setEditingChild]   = useState<string | null>(null)
  const [formChild,      setFormChild]      = useState<Record<string, any>>({})
  const [savingChild,    setSavingChild]    = useState(false)
  const [childMsg,       setChildMsg]       = useState<{ type: 'ok'|'err'; text: string; id?: string } | null>(null)
  const [childAvatars,   setChildAvatars]   = useState<Record<string, string | null>>({})
  const [uploadingChild, setUploadingChild] = useState<string | null>(null)

  const [showAddChild, setShowAddChild] = useState(false)
  const [formNew,      setFormNew]      = useState({ full_name: '', grade: '', school: '', relation_role: 'ibu' })
  const [addingChild,  setAddingChild]  = useState(false)
  const [addMsg,       setAddMsg]       = useState<{ type: 'ok'|'err'; text: string } | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data: p } = await supabase.from('profiles')
        .select('id, full_name, email, phone, avatar_url').eq('id', session.user.id).single()
      if (p) { setProfile(p); setFormAkun({ full_name: p.full_name ?? '', phone: p.phone ?? '' }); setAvatarUrl(p.avatar_url ?? null) }

      const { data: kids } = await supabase
        .from('students')
        .select('id, grade, school, relation_role, profile_id, profiles!students_profile_id_fkey(full_name, avatar_url)')
        .eq('parent_profile_id', session.user.id)

      const flat = (kids ?? []).map((k: any) => {
        const prof = Array.isArray(k.profiles) ? k.profiles[0] : k.profiles
        return { id: k.id, profile_id: k.profile_id, full_name: prof?.full_name ?? '', grade: k.grade ?? '', school: k.school ?? '', relation_role: k.relation_role ?? 'ibu', avatar_url: prof?.avatar_url ?? null }
      })
      setChildren(flat)
      const avMap: Record<string, string | null> = {}
      flat.forEach(c => { avMap[c.id] = c.avatar_url })
      setChildAvatars(avMap)
    }
    load()
  }, [])

  async function handleAvatarUpload(file: File) {
    if (!profile) return
    if (file.size > 1024 * 1024) { setAkunMsg({ type: 'err', text: 'Ukuran foto maksimal 1MB.' }); return }
    setUploadingAvatar(true); setAkunMsg(null)
    const url = await compressAndUpload(file, `parents/${profile.id}.jpg`, supabase)
    setUploadingAvatar(false)
    if (!url) { setAkunMsg({ type: 'err', text: 'Gagal upload foto.' }); return }
    await supabase.from('profiles').update({ avatar_url: url }).eq('id', profile.id)
    setAvatarUrl(url)
    setAkunMsg({ type: 'ok', text: 'Foto profil berhasil diperbarui!' })
  }

  async function handleChildAvatarUpload(file: File, childId: string, profileId: string) {
    if (file.size > 1024 * 1024) { setChildMsg({ type: 'err', text: 'Ukuran foto maksimal 1MB.', id: childId }); return }
    setUploadingChild(childId)
    const url = await compressAndUpload(file, `students/${childId}.jpg`, supabase)
    setUploadingChild(null)
    if (!url) { setChildMsg({ type: 'err', text: 'Gagal upload foto.', id: childId }); return }
    await supabase.from('profiles').update({ avatar_url: url }).eq('id', profileId)
    setChildAvatars(prev => ({ ...prev, [childId]: url }))
    setChildMsg({ type: 'ok', text: 'Foto anak berhasil diperbarui!', id: childId })
  }

  async function saveAkun() {
    if (!profile) return
    setSavingAkun(true); setAkunMsg(null)
    const { error } = await supabase.from('profiles')
      .update({ full_name: formAkun.full_name.trim(), phone: formAkun.phone.trim() || null }).eq('id', profile.id)
    setSavingAkun(false)
    setAkunMsg(error ? { type: 'err', text: error.message } : { type: 'ok', text: 'Profil berhasil disimpan!' })
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

  async function saveChild(childId: string) {
    setSavingChild(true); setChildMsg(null)
    const child = children.find(c => c.id === childId)
    if (!child) { setSavingChild(false); return }
    await supabase.from('students').update({ grade: formChild.grade.trim() || null, school: formChild.school.trim() || null, relation_role: formChild.relation_role }).eq('id', childId)
    if (child.profile_id) await supabase.from('profiles').update({ full_name: formChild.full_name.trim() }).eq('id', child.profile_id)
    setSavingChild(false)
    setChildMsg({ type: 'ok', text: 'Data anak berhasil disimpan!', id: childId })
    setChildren(prev => prev.map(c => c.id === childId ? { ...c, full_name: formChild.full_name.trim(), grade: formChild.grade, school: formChild.school, relation_role: formChild.relation_role } : c))
    setEditingChild(null)
  }

  async function addChild() {
    if (!formNew.full_name.trim()) { setAddMsg({ type: 'err', text: 'Nama anak tidak boleh kosong.' }); return }
    setAddingChild(true); setAddMsg(null)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setAddingChild(false); return }
    const { error } = await supabase.from('students').insert({ parent_profile_id: session.user.id, grade: formNew.grade.trim() || null, school: formNew.school.trim() || null, relation_role: formNew.relation_role })
    setAddingChild(false)
    if (error) { setAddMsg({ type: 'err', text: error.message }) }
    else { setAddMsg({ type: 'ok', text: 'Anak ditambahkan! Hubungi admin untuk membuatkan akun.' }); setFormNew({ full_name: '', grade: '', school: '', relation_role: 'ibu' }); setShowAddChild(false) }
  }

  const inputCls = "w-full px-3 py-2 border border-stone-200 rounded-lg text-[12px] text-stone-700 outline-none focus:border-amber-400 bg-white transition"
  const labelCls = "block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1"

  return (
    <div className="px-4 lg:px-6 py-5 max-w-lg">
      <h2 className="text-[16px] font-bold text-stone-800 mb-4">Pengaturan</h2>
      <div className="flex gap-0 mb-5 border-b border-stone-100">
        {(['akun', 'anak'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 text-[12px] font-semibold border-b-2 transition-colors ${activeTab === tab ? 'border-amber-500 text-amber-700' : 'border-transparent text-stone-400 hover:text-stone-600'}`}>
            {tab === 'akun' ? 'Akun Saya' : 'Data Anak'}
          </button>
        ))}
      </div>

      {activeTab === 'akun' && (
        <div className="flex flex-col gap-5">
          {/* Data Pribadi */}
          <div className="bg-white border border-stone-100 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-stone-50"><p className="text-[12px] font-bold text-stone-700">Data Pribadi</p></div>
            <div className="px-4 py-4 flex flex-col gap-3">
              {profile && <AvatarUpload name={formAkun.full_name || profile.full_name} avatarUrl={avatarUrl} onUpload={handleAvatarUpload} uploading={uploadingAvatar}/>}
              <div><label className={labelCls}>Nama Lengkap</label><input type="text" value={formAkun.full_name} onChange={e => setFormAkun(p => ({ ...p, full_name: e.target.value }))} className={inputCls}/></div>
              <div><label className={labelCls}>Email Saat Ini</label><input type="text" value={profile?.email ?? '—'} disabled className={inputCls + ' opacity-50 cursor-not-allowed'}/></div>
              <div><label className={labelCls}>No. HP</label><input type="text" value={formAkun.phone} onChange={e => setFormAkun(p => ({ ...p, phone: e.target.value }))} placeholder="08xx-xxxx-xxxx" className={inputCls}/></div>
              <Msg msg={akunMsg}/>
              <button onClick={saveAkun} disabled={savingAkun} className="flex items-center justify-center gap-2 py-2 rounded-lg bg-amber-500 text-white text-[12px] font-semibold hover:bg-amber-600 transition disabled:opacity-50">
                <Save size={13}/>{savingAkun ? 'Menyimpan…' : 'Simpan Perubahan'}
              </button>
            </div>
          </div>

          {/* Ganti Email */}
          <div className="bg-white border border-stone-100 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-stone-50"><p className="text-[12px] font-bold text-stone-700">Ganti Email</p></div>
            <div className="px-4 py-4 flex flex-col gap-3">
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-blue-50 border border-blue-100">
                <Mail size={13} className="text-blue-500 mt-0.5 flex-shrink-0"/>
                <p className="text-[10px] text-blue-700 leading-relaxed">Link konfirmasi dikirim ke email baru. Klik link untuk menyelesaikan perubahan.</p>
              </div>
              <div><label className={labelCls}>Email Baru</label><input type="email" value={formEmail.newEmail} onChange={e => setFormEmail({ newEmail: e.target.value })} placeholder="emailbaru@contoh.com" className={inputCls}/></div>
              <Msg msg={emailMsg}/>
              <button onClick={saveEmail} disabled={savingEmail} className="flex items-center justify-center gap-2 py-2 rounded-lg bg-blue-600 text-white text-[12px] font-semibold hover:bg-blue-700 transition disabled:opacity-50">
                <Mail size={13}/>{savingEmail ? 'Mengirim…' : 'Kirim Link Konfirmasi'}
              </button>
            </div>
          </div>

          {/* Ganti Password */}
          <div className="bg-white border border-stone-100 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-stone-50"><p className="text-[12px] font-bold text-stone-700">Ganti Password</p></div>
            <div className="px-4 py-4 flex flex-col gap-3">
              <div><label className={labelCls}>Password Baru</label>
                <div className="relative">
                  <input type={showPwd ? 'text' : 'password'} value={formPwd.password} onChange={e => setFormPwd(p => ({ ...p, password: e.target.value }))} placeholder="Minimal 6 karakter" className={inputCls + ' pr-9'}/>
                  <button onClick={() => setShowPwd(p => !p)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400">{showPwd ? <EyeOff size={14}/> : <Eye size={14}/>}</button>
                </div>
              </div>
              <div><label className={labelCls}>Konfirmasi Password</label><input type={showPwd ? 'text' : 'password'} value={formPwd.confirm} onChange={e => setFormPwd(p => ({ ...p, confirm: e.target.value }))} placeholder="Ulangi password baru" className={inputCls}/></div>
              <Msg msg={pwdMsg}/>
              <button onClick={savePassword} disabled={savingPwd} className="flex items-center justify-center gap-2 py-2 rounded-lg bg-stone-700 text-white text-[12px] font-semibold hover:bg-stone-800 transition disabled:opacity-50">
                <Save size={13}/>{savingPwd ? 'Menyimpan…' : 'Ubah Password'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'anak' && (
        <div>
          {children.map((child, idx) => {
            const col = CHILD_COLORS[idx % CHILD_COLORS.length]
            const bgC = CHILD_BG[idx % CHILD_BG.length]
            const textC = CHILD_TEXT[idx % CHILD_TEXT.length]
            const isEditing = editingChild === child.id
            const av = childAvatars[child.id]

            return (
              <div key={child.id} className="bg-white border border-stone-100 rounded-2xl overflow-hidden mb-3" style={{ borderTop: `3px solid ${col}` }}>
                <div className="flex items-center justify-between px-4 py-3 border-b border-stone-50">
                  <div className="flex items-center gap-2">
                    {av ? <img src={av} alt={child.full_name} className="w-7 h-7 rounded-lg object-cover"/>
                      : <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold" style={{ background: bgC, color: textC }}>{initials(child.full_name)}</div>}
                    <p className="text-[12px] font-bold text-stone-700">{child.full_name}</p>
                  </div>
                  {!isEditing
                    ? <button onClick={() => { setEditingChild(child.id); setFormChild({ full_name: child.full_name, grade: child.grade, school: child.school, relation_role: child.relation_role }); setChildMsg(null) }} className="text-[11px] text-amber-600 hover:underline font-medium">Edit</button>
                    : <button onClick={() => setEditingChild(null)} className="text-[11px] text-stone-400">Batal</button>}
                </div>
                <div className="px-4 py-3">
                  {/* Foto anak */}
                  <div className="flex flex-col items-center mb-3">
                    <AvatarUpload name={child.full_name} avatarUrl={av} color={col} bg={bgC} text={textC} size={64}
                      uploading={uploadingChild === child.id}
                      onUpload={(f) => child.profile_id && handleChildAvatarUpload(f, child.id, child.profile_id)}/>
                    {childMsg?.id === child.id && !isEditing && <Msg msg={childMsg}/>}
                  </div>
                  {!isEditing ? (
                    <div className="grid grid-cols-2 gap-2">
                      {[{ label: 'Kelas', val: child.grade || '—' }, { label: 'Sekolah', val: child.school || '—' }, { label: 'Relasi', val: child.relation_role || '—' }].map(f => (
                        <div key={f.label}><p className="text-[9px] text-stone-400 uppercase tracking-wider">{f.label}</p><p className="text-[12px] font-medium text-stone-700">{f.val}</p></div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2.5">
                      <div><label className={labelCls}>Nama Lengkap</label><input value={formChild.full_name} onChange={e => setFormChild(p => ({ ...p, full_name: e.target.value }))} className={inputCls}/></div>
                      <div className="grid grid-cols-2 gap-2">
                        <div><label className={labelCls}>Kelas</label><input value={formChild.grade} onChange={e => setFormChild(p => ({ ...p, grade: e.target.value }))} placeholder="Kelas 7" className={inputCls}/></div>
                        <div><label className={labelCls}>Relasi</label><select value={formChild.relation_role} onChange={e => setFormChild(p => ({ ...p, relation_role: e.target.value }))} className={inputCls}>{RELATION_OPTIONS.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}</select></div>
                      </div>
                      <div><label className={labelCls}>Sekolah</label><input value={formChild.school} onChange={e => setFormChild(p => ({ ...p, school: e.target.value }))} placeholder="Nama sekolah" className={inputCls}/></div>
                      {childMsg?.id === child.id && <Msg msg={childMsg}/>}
                      <button onClick={() => saveChild(child.id)} disabled={savingChild} className="flex items-center justify-center gap-2 py-2 rounded-lg bg-amber-500 text-white text-[12px] font-semibold hover:bg-amber-600 transition disabled:opacity-50">
                        <Save size={13}/>{savingChild ? 'Menyimpan…' : 'Simpan'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {!showAddChild ? (
            <button onClick={() => setShowAddChild(true)} className="w-full py-2.5 rounded-xl border border-dashed border-amber-300 text-[12px] font-medium text-amber-600 hover:bg-amber-50 transition flex items-center justify-center gap-2">+ Tambah Anak</button>
          ) : (
            <div className="bg-white border border-stone-100 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-stone-50">
                <p className="text-[12px] font-bold text-stone-700">Tambah Anak Baru</p>
                <button onClick={() => setShowAddChild(false)} className="text-[11px] text-stone-400">Batal</button>
              </div>
              <div className="px-4 py-3 flex flex-col gap-2.5">
                <div><label className={labelCls}>Nama Lengkap Anak *</label><input value={formNew.full_name} onChange={e => setFormNew(p => ({ ...p, full_name: e.target.value }))} placeholder="Nama anak" className={inputCls}/></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className={labelCls}>Kelas</label><input value={formNew.grade} onChange={e => setFormNew(p => ({ ...p, grade: e.target.value }))} placeholder="Kelas 5" className={inputCls}/></div>
                  <div><label className={labelCls}>Relasi</label><select value={formNew.relation_role} onChange={e => setFormNew(p => ({ ...p, relation_role: e.target.value }))} className={inputCls}>{RELATION_OPTIONS.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}</select></div>
                </div>
                <div><label className={labelCls}>Sekolah</label><input value={formNew.school} onChange={e => setFormNew(p => ({ ...p, school: e.target.value }))} placeholder="Nama sekolah" className={inputCls}/></div>
                <Msg msg={addMsg}/>
                <button onClick={addChild} disabled={addingChild} className="flex items-center justify-center gap-2 py-2 rounded-lg bg-amber-500 text-white text-[12px] font-semibold hover:bg-amber-600 transition disabled:opacity-50">
                  <Save size={13}/>{addingChild ? 'Menyimpan…' : 'Simpan'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
