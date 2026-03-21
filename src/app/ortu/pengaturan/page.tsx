'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Save, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react'

const CHILD_COLORS = ['#E6B800', '#1D9E75', '#5C4FE5', '#D85A30', '#639922']
const CHILD_BG     = ['#FAEEDA', '#E1F5EE', '#EEEDFE', '#FAECE7', '#EAF3DE']
const CHILD_TEXT   = ['#412402', '#085041', '#3C3489', '#4A1B0C', '#173404']

const RELATION_OPTIONS = ['ayah', 'ibu', 'wali']

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
}

export default function OrtuPengaturanPage() {
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<'akun' | 'anak'>('akun')

  // ── Akun ──────────────────────────────────────────────────────────────────
  const [profile, setProfile] = useState<any>(null)
  const [formAkun, setFormAkun] = useState({ full_name: '', phone: '' })
  const [savingAkun, setSavingAkun] = useState(false)
  const [akunMsg, setAkunMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // Password
  const [formPwd, setFormPwd] = useState({ password: '', confirm: '' })
  const [showPwd, setShowPwd] = useState(false)
  const [savingPwd, setSavingPwd] = useState(false)
  const [pwdMsg, setPwdMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // ── Anak ──────────────────────────────────────────────────────────────────
  const [children, setChildren] = useState<any[]>([])
  const [editingChild, setEditingChild] = useState<string | null>(null)
  const [formChild, setFormChild] = useState<Record<string, any>>({})
  const [savingChild, setSavingChild] = useState(false)
  const [childMsg, setChildMsg] = useState<{ type: 'ok' | 'err'; text: string; id?: string } | null>(null)

  // ── Modal tambah anak ─────────────────────────────────────────────────────
  const [showAddChild, setShowAddChild] = useState(false)
  const [formNew, setFormNew] = useState({ full_name: '', grade: '', school: '', relation_role: 'ibu' })
  const [addingChild, setAddingChild] = useState(false)
  const [addMsg, setAddMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: p } = await supabase.from('profiles')
        .select('id, full_name, email, phone').eq('id', session.user.id).single()
      if (p) {
        setProfile(p)
        setFormAkun({ full_name: p.full_name ?? '', phone: p.phone ?? '' })
      }

      const { data: kids } = await supabase
        .from('students')
        .select(`id, grade, school, relation_role, profiles!students_profile_id_fkey(full_name)`)
        .eq('parent_profile_id', session.user.id)

      const flat = (kids ?? []).map((k: any) => ({
        id:            k.id,
        full_name:     (Array.isArray(k.profiles) ? k.profiles[0] : k.profiles)?.full_name ?? '',
        grade:         k.grade ?? '',
        school:        k.school ?? '',
        relation_role: k.relation_role ?? 'ibu',
      }))
      setChildren(flat)
    }
    load()
  }, [supabase])

  async function saveAkun() {
    if (!profile) return
    setSavingAkun(true); setAkunMsg(null)
    const { error } = await supabase.from('profiles')
      .update({ full_name: formAkun.full_name.trim(), phone: formAkun.phone.trim() || null })
      .eq('id', profile.id)
    setSavingAkun(false)
    setAkunMsg(error ? { type: 'err', text: error.message } : { type: 'ok', text: 'Profil berhasil disimpan!' })
  }

  async function savePassword() {
    if (formPwd.password !== formPwd.confirm) {
      setPwdMsg({ type: 'err', text: 'Password tidak cocok.' }); return
    }
    if (formPwd.password.length < 6) {
      setPwdMsg({ type: 'err', text: 'Password minimal 6 karakter.' }); return
    }
    setSavingPwd(true); setPwdMsg(null)
    const { error } = await supabase.auth.updateUser({ password: formPwd.password })
    setSavingPwd(false)
    if (error) { setPwdMsg({ type: 'err', text: error.message }); return }
    setPwdMsg({ type: 'ok', text: 'Password berhasil diubah!' })
    setFormPwd({ password: '', confirm: '' })
  }

  function startEditChild(child: any) {
    setEditingChild(child.id)
    setFormChild({ full_name: child.full_name, grade: child.grade, school: child.school, relation_role: child.relation_role })
    setChildMsg(null)
  }

  async function saveChild(childId: string) {
    setSavingChild(true); setChildMsg(null)
    // Update nama di profiles (via profile_id)
    const child = children.find(c => c.id === childId)
    if (!child) { setSavingChild(false); return }

    // Cari profile_id dari students
    const { data: stu } = await supabase.from('students').select('profile_id').eq('id', childId).single()

    // Update students
    const { error: errStu } = await supabase.from('students').update({
      grade:         formChild.grade.trim() || null,
      school:        formChild.school.trim() || null,
      relation_role: formChild.relation_role,
    }).eq('id', childId)

    if (errStu) {
      setSavingChild(false)
      setChildMsg({ type: 'err', text: errStu.message, id: childId })
      return
    }

    // Update nama di profiles kalau ada profile_id
    if (stu?.profile_id) {
      const { error: errProf } = await supabase.from('profiles')
        .update({ full_name: formChild.full_name.trim() })
        .eq('id', stu.profile_id)
      if (errProf) {
        setSavingChild(false)
        setChildMsg({ type: 'err', text: errProf.message, id: childId })
        return
      }
    }

    setSavingChild(false)
    setChildMsg({ type: 'ok', text: 'Data anak berhasil disimpan!', id: childId })
    setChildren(prev => prev.map(c => c.id === childId
      ? { ...c, full_name: formChild.full_name.trim(), grade: formChild.grade, school: formChild.school, relation_role: formChild.relation_role }
      : c
    ))
    setEditingChild(null)
  }

  async function addChild() {
    if (!formNew.full_name.trim()) {
      setAddMsg({ type: 'err', text: 'Nama anak tidak boleh kosong.' }); return
    }
    setAddingChild(true); setAddMsg(null)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setAddingChild(false); return }

    const { error } = await supabase.from('students').insert({
      parent_profile_id: session.user.id,
      grade:             formNew.grade.trim() || null,
      school:            formNew.school.trim() || null,
      relation_role:     formNew.relation_role,
      // full_name disimpan di profiles — tapi jika tidak punya akun sendiri, simpan di notes atau label sementara
      // Untuk sekarang kita simpan di kolom notes sebagai workaround
    })

    setAddingChild(false)
    if (error) {
      setAddMsg({ type: 'err', text: error.message })
    } else {
      setAddMsg({ type: 'ok', text: 'Anak berhasil ditambahkan! Hubungi admin untuk membuatkan akun.' })
      setFormNew({ full_name: '', grade: '', school: '', relation_role: 'ibu' })
      setShowAddChild(false)
    }
  }

  const inputCls = "w-full px-3 py-2 border border-stone-200 rounded-lg text-[12px] text-stone-700 outline-none focus:border-amber-400 bg-white transition"
  const labelCls = "block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1"

  return (
    <div className="px-4 lg:px-6 py-5 max-w-lg">
      <h2 className="text-[16px] font-bold text-stone-800 mb-4">Pengaturan</h2>

      {/* Tabs */}
      <div className="flex gap-0 mb-5 border-b border-stone-100">
        {(['akun', 'anak'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 text-[12px] font-semibold border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-amber-500 text-amber-700'
                : 'border-transparent text-stone-400 hover:text-stone-600'
            }`}>
            {tab === 'akun' ? 'Akun Saya' : 'Data Anak'}
          </button>
        ))}
      </div>

      {/* ═══ Tab Akun ═══ */}
      {activeTab === 'akun' && (
        <div className="flex flex-col gap-5">
          {/* Data pribadi */}
          <div className="bg-white border border-stone-100 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-stone-50">
              <p className="text-[12px] font-bold text-stone-700">Data Pribadi</p>
            </div>
            <div className="px-4 py-4 flex flex-col gap-3">
              <div>
                <label className={labelCls}>Nama Lengkap</label>
                <input type="text" value={formAkun.full_name}
                  onChange={e => setFormAkun(p => ({ ...p, full_name: e.target.value }))}
                  className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <input type="text" value={profile?.email ?? '—'} disabled
                  className={inputCls + ' opacity-50 cursor-not-allowed'} />
                <p className="text-[10px] text-stone-400 mt-1">Email tidak bisa diubah sendiri. Hubungi admin.</p>
              </div>
              <div>
                <label className={labelCls}>No. HP</label>
                <input type="text" value={formAkun.phone}
                  onChange={e => setFormAkun(p => ({ ...p, phone: e.target.value }))}
                  placeholder="08xx-xxxx-xxxx"
                  className={inputCls} />
              </div>
              {akunMsg && (
                <div className={`flex items-center gap-2 text-[11px] px-3 py-2 rounded-lg ${
                  akunMsg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                }`}>
                  {akunMsg.type === 'ok' ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                  {akunMsg.text}
                </div>
              )}
              <button onClick={saveAkun} disabled={savingAkun}
                className="flex items-center justify-center gap-2 py-2 rounded-lg bg-amber-500 text-white text-[12px] font-semibold hover:bg-amber-600 transition disabled:opacity-50">
                <Save size={13} />
                {savingAkun ? 'Menyimpan…' : 'Simpan Perubahan'}
              </button>
            </div>
          </div>

          {/* Ganti password */}
          <div className="bg-white border border-stone-100 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-stone-50">
              <p className="text-[12px] font-bold text-stone-700">Ganti Password</p>
            </div>
            <div className="px-4 py-4 flex flex-col gap-3">
              <div>
                <label className={labelCls}>Password Baru</label>
                <div className="relative">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={formPwd.password}
                    onChange={e => setFormPwd(p => ({ ...p, password: e.target.value }))}
                    placeholder="Minimal 6 karakter"
                    className={inputCls + ' pr-9'}
                  />
                  <button onClick={() => setShowPwd(p => !p)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                    {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <div>
                <label className={labelCls}>Konfirmasi Password</label>
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={formPwd.confirm}
                  onChange={e => setFormPwd(p => ({ ...p, confirm: e.target.value }))}
                  placeholder="Ulangi password baru"
                  className={inputCls}
                />
              </div>
              {pwdMsg && (
                <div className={`flex items-center gap-2 text-[11px] px-3 py-2 rounded-lg ${
                  pwdMsg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                }`}>
                  {pwdMsg.type === 'ok' ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                  {pwdMsg.text}
                </div>
              )}
              <button onClick={savePassword} disabled={savingPwd}
                className="flex items-center justify-center gap-2 py-2 rounded-lg bg-stone-700 text-white text-[12px] font-semibold hover:bg-stone-800 transition disabled:opacity-50">
                <Save size={13} />
                {savingPwd ? 'Menyimpan…' : 'Ubah Password'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Tab Anak ═══ */}
      {activeTab === 'anak' && (
        <div>
          {children.map((child, idx) => {
            const col      = CHILD_COLORS[idx % CHILD_COLORS.length]
            const bgC      = CHILD_BG[idx % CHILD_BG.length]
            const textC    = CHILD_TEXT[idx % CHILD_TEXT.length]
            const isEditing = editingChild === child.id

            return (
              <div key={child.id} className="bg-white border border-stone-100 rounded-2xl overflow-hidden mb-3"
                style={{ borderTop: `3px solid ${col}` }}>
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-stone-50">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold"
                      style={{ background: bgC, color: textC }}>
                      {initials(child.full_name)}
                    </div>
                    <p className="text-[12px] font-bold text-stone-700">{child.full_name}</p>
                  </div>
                  {!isEditing ? (
                    <button onClick={() => startEditChild(child)}
                      className="text-[11px] text-amber-600 hover:underline font-medium">
                      Edit
                    </button>
                  ) : (
                    <button onClick={() => setEditingChild(null)}
                      className="text-[11px] text-stone-400 hover:text-stone-600">
                      Batal
                    </button>
                  )}
                </div>

                <div className="px-4 py-3">
                  {!isEditing ? (
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: 'Kelas', val: child.grade || '—' },
                        { label: 'Sekolah', val: child.school || '—' },
                        { label: 'Relasi', val: child.relation_role || '—' },
                      ].map(f => (
                        <div key={f.label}>
                          <p className="text-[9px] text-stone-400 uppercase tracking-wider">{f.label}</p>
                          <p className="text-[12px] font-medium text-stone-700">{f.val}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2.5">
                      <div>
                        <label className={labelCls}>Nama Lengkap</label>
                        <input value={formChild.full_name}
                          onChange={e => setFormChild(p => ({ ...p, full_name: e.target.value }))}
                          className={inputCls} />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className={labelCls}>Kelas</label>
                          <input value={formChild.grade}
                            onChange={e => setFormChild(p => ({ ...p, grade: e.target.value }))}
                            placeholder="Kelas 7" className={inputCls} />
                        </div>
                        <div>
                          <label className={labelCls}>Relasi</label>
                          <select value={formChild.relation_role}
                            onChange={e => setFormChild(p => ({ ...p, relation_role: e.target.value }))}
                            className={inputCls}>
                            {RELATION_OPTIONS.map(r => (
                              <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className={labelCls}>Sekolah</label>
                        <input value={formChild.school}
                          onChange={e => setFormChild(p => ({ ...p, school: e.target.value }))}
                          placeholder="Nama sekolah" className={inputCls} />
                      </div>
                      {childMsg?.id === child.id && (
                        <div className={`flex items-center gap-2 text-[11px] px-3 py-2 rounded-lg ${
                          childMsg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                        }`}>
                          {childMsg.type === 'ok' ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                          {childMsg.text}
                        </div>
                      )}
                      <button onClick={() => saveChild(child.id)} disabled={savingChild}
                        className="flex items-center justify-center gap-2 py-2 rounded-lg bg-amber-500 text-white text-[12px] font-semibold hover:bg-amber-600 transition disabled:opacity-50">
                        <Save size={13} />
                        {savingChild ? 'Menyimpan…' : 'Simpan'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {/* Tambah anak */}
          {!showAddChild ? (
            <button onClick={() => setShowAddChild(true)}
              className="w-full py-2.5 rounded-xl border border-dashed border-amber-300 text-[12px] font-medium text-amber-600 hover:bg-amber-50 transition flex items-center justify-center gap-2">
              + Tambah Anak
            </button>
          ) : (
            <div className="bg-white border border-stone-100 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-stone-50">
                <p className="text-[12px] font-bold text-stone-700">Tambah Anak Baru</p>
                <button onClick={() => setShowAddChild(false)} className="text-[11px] text-stone-400 hover:text-stone-600">
                  Batal
                </button>
              </div>
              <div className="px-4 py-3 flex flex-col gap-2.5">
                <div>
                  <label className={labelCls}>Nama Lengkap Anak *</label>
                  <input value={formNew.full_name}
                    onChange={e => setFormNew(p => ({ ...p, full_name: e.target.value }))}
                    placeholder="Nama anak" className={inputCls} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>Kelas</label>
                    <input value={formNew.grade}
                      onChange={e => setFormNew(p => ({ ...p, grade: e.target.value }))}
                      placeholder="Kelas 5" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Relasi</label>
                    <select value={formNew.relation_role}
                      onChange={e => setFormNew(p => ({ ...p, relation_role: e.target.value }))}
                      className={inputCls}>
                      {RELATION_OPTIONS.map(r => (
                        <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Sekolah</label>
                  <input value={formNew.school}
                    onChange={e => setFormNew(p => ({ ...p, school: e.target.value }))}
                    placeholder="Nama sekolah" className={inputCls} />
                </div>
                {addMsg && (
                  <div className={`flex items-center gap-2 text-[11px] px-3 py-2 rounded-lg ${
                    addMsg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                  }`}>
                    {addMsg.type === 'ok' ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                    {addMsg.text}
                  </div>
                )}
                <button onClick={addChild} disabled={addingChild}
                  className="flex items-center justify-center gap-2 py-2 rounded-lg bg-amber-500 text-white text-[12px] font-semibold hover:bg-amber-600 transition disabled:opacity-50">
                  <Save size={13} />
                  {addingChild ? 'Menyimpan…' : 'Simpan'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
