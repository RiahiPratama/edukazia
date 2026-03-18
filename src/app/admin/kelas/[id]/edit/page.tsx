'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { X, ArrowRightLeft, UserMinus, Pencil } from 'lucide-react'

type Enrollment = {
  id: string
  student_id: string
  sessions_total: number
  session_start_offset: number
  sessions_used: number
  status: string
  notes: string | null
  student_name: string
}

type ClassGroup = {
  id: string; label: string; course_id: string; tutor_id: string
  class_type_id: string; zoom_link: string | null; status: string
  max_participants: number
  courses: { name: string } | null
  class_types: { name: string } | null
}

type OtherClass = { id: string; label: string }

export default function EditKelasPage() {
  const router   = useRouter()
  const params   = useParams()
  const kelasId  = params.id as string
  const supabase = createClient()

  const [kelas,        setKelas]        = useState<ClassGroup | null>(null)
  const [enrollments,  setEnrollments]  = useState<Enrollment[]>([])
  const [otherClasses, setOtherClasses] = useState<OtherClass[]>([])
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState('')
  const [success,      setSuccess]      = useState('')

  const [fLabel,  setFLabel]  = useState('')
  const [fZoom,   setFZoom]   = useState('')
  const [fStatus, setFStatus] = useState('active')

  // Modal — tambah tipe 'edit'
  const [modalType,        setModalType]        = useState<'transfer' | 'stop' | 'edit' | null>(null)
  const [selectedEnroll,   setSelectedEnroll]   = useState<Enrollment | null>(null)
  const [transferTargetId, setTransferTargetId] = useState('')
  const [modalSaving,      setModalSaving]      = useState(false)
  const [modalError,       setModalError]       = useState('')

  // Edit sesi form
  const [editSessionsTotal,      setEditSessionsTotal]      = useState(8)
  const [editSessionStartOffset, setEditSessionStartOffset] = useState(1)

  useEffect(() => { fetchAll() }, [kelasId])

  async function fetchAll() {
    setLoading(true)

    const { data: k } = await supabase
      .from('class_groups')
      .select('id, label, course_id, tutor_id, class_type_id, zoom_link, status, max_participants, courses(name), class_types(name)')
      .eq('id', kelasId).single()

    if (k) {
      setKelas(k as any); setFLabel((k as any).label)
      setFZoom((k as any).zoom_link ?? ''); setFStatus((k as any).status)
    }

    const { data: enr } = await supabase
      .from('enrollments')
      .select('id, student_id, sessions_total, session_start_offset, sessions_used, status, notes')
      .eq('class_group_id', kelasId)

    if (enr && enr.length > 0) {
      const studentIds = enr.map((e: any) => e.student_id).filter(Boolean)
      const { data: students } = await supabase.from('students').select('id, profile_id').in('id', studentIds)
      const profIds = (students ?? []).map((s: any) => s.profile_id).filter(Boolean)
      let nameMap: Record<string, string> = {}
      if (profIds.length > 0) {
        const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', profIds)
        const profMap = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.full_name]))
        nameMap = Object.fromEntries((students ?? []).map((s: any) => [s.id, profMap[s.profile_id] ?? 'Siswa']))
      }
      setEnrollments(enr.map((e: any) => ({ ...e, student_name: nameMap[e.student_id] ?? 'Siswa' })))
    } else {
      setEnrollments([])
    }

    const { data: others } = await supabase
      .from('class_groups').select('id, label')
      .eq('status', 'active').neq('id', kelasId).order('label')
    setOtherClasses((others ?? []) as OtherClass[])
    setLoading(false)
  }

  async function handleSaveKelas(e: React.FormEvent) {
    e.preventDefault()
    if (!fLabel.trim()) { setError('Label kelas wajib diisi.'); return }
    setSaving(true); setError(''); setSuccess('')
    const { error: err } = await supabase
      .from('class_groups')
      .update({ label: fLabel.trim(), zoom_link: fZoom || null, status: fStatus })
      .eq('id', kelasId)
    if (err) { setError(err.message); setSaving(false); return }
    setSuccess('Perubahan kelas berhasil disimpan.')
    setSaving(false); fetchAll()
  }

  // ── Buka modal edit sesi ──
  function openEdit(enr: Enrollment) {
    setSelectedEnroll(enr)
    setEditSessionsTotal(enr.sessions_total)
    setEditSessionStartOffset(enr.session_start_offset)
    setModalError('')
    setModalType('edit')
  }

  // ── Simpan edit sesi ──
  async function handleEditSesi() {
    if (!selectedEnroll) return
    if (editSessionStartOffset > editSessionsTotal) {
      setModalError('Mulai dari sesi ke- tidak boleh melebihi total sesi.')
      return
    }
    setModalSaving(true); setModalError('')
    const { error: err } = await supabase
      .from('enrollments')
      .update({
        sessions_total:       editSessionsTotal,
        session_start_offset: editSessionStartOffset,
      })
      .eq('id', selectedEnroll.id)
    if (err) { setModalError(err.message); setModalSaving(false); return }
    setModalSaving(false); setModalType(null); fetchAll()
  }

  function openTransfer(enr: Enrollment) {
    setSelectedEnroll(enr); setTransferTargetId(''); setModalError(''); setModalType('transfer')
  }
  function openStop(enr: Enrollment) {
    setSelectedEnroll(enr); setModalError(''); setModalType('stop')
  }

  async function handleTransfer() {
    if (!selectedEnroll || !transferTargetId) { setModalError('Pilih kelas tujuan.'); return }
    setModalSaving(true); setModalError('')
    const newOffset = selectedEnroll.session_start_offset + (selectedEnroll.sessions_used ?? 0)
    const { error: e1 } = await supabase.from('enrollments')
      .update({ status: 'transferred', notes: `Pindah ke kelas: ${otherClasses.find(c => c.id === transferTargetId)?.label ?? transferTargetId}` })
      .eq('id', selectedEnroll.id)
    if (e1) { setModalError(e1.message); setModalSaving(false); return }
    const { error: e2 } = await supabase.from('enrollments').insert({
      student_id:           selectedEnroll.student_id,
      class_group_id:       transferTargetId,
      sessions_total:       selectedEnroll.sessions_total,
      sessions_used:        selectedEnroll.sessions_used ?? 0,
      session_start_offset: newOffset,
      status:               'active',
      notes:                `Pindahan dari kelas: ${kelas?.label}`,
    })
    if (e2) { setModalError(e2.message); setModalSaving(false); return }
    setModalSaving(false); setModalType(null); fetchAll()
  }

  async function handleStop() {
    if (!selectedEnroll) return
    setModalSaving(true); setModalError('')
    const { error: err } = await supabase.from('enrollments')
      .update({ status: 'inactive', notes: 'Siswa berhenti' })
      .eq('id', selectedEnroll.id)
    if (err) { setModalError(err.message); setModalSaving(false); return }
    setModalSaving(false); setModalType(null); fetchAll()
  }

  function getInitials(name: string) {
    return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
  }

  const AVATAR_COLORS = ['#5C4FE5','#27A05A','#D97706','#DC2626','#0891B2','#7C3AED','#BE185D','#065F46']
  const statusEnrollLabel: Record<string, { label: string; cls: string }> = {
    active:      { label: 'Aktif',        cls: 'bg-[#E6F4EC] text-[#1A5C36]' },
    completed:   { label: 'Selesai',      cls: 'bg-[#EEEDFE] text-[#3C3489]' },
    inactive:    { label: 'Berhenti',     cls: 'bg-[#FEE9E9] text-[#991B1B]' },
    transferred: { label: 'Pindah Kelas', cls: 'bg-[#FEF3E2] text-[#92400E]' },
    paused:      { label: 'Dijeda',       cls: 'bg-gray-100 text-gray-600' },
  }
  const inputCls = "w-full px-3.5 py-2.5 border border-[#E5E3FF] rounded-xl text-sm bg-[#F7F6FF] text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] focus:bg-white transition"

  if (loading) return <div className="p-6 text-sm text-[#7B78A8]">Memuat data kelas...</div>

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/kelas" className="text-[#7B78A8] hover:text-[#5C4FE5] transition-colors">← Kembali</Link>
        <h1 className="text-2xl font-black text-[#1A1640]" style={{fontFamily:'Sora,sans-serif'}}>Edit Kelas</h1>
      </div>

      {/* FORM EDIT KELAS */}
      <div className="bg-white rounded-2xl border border-[#E5E3FF] p-6 mb-5">
        <p className="text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-4">Detail Kelas</p>
        <form onSubmit={handleSaveKelas} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">Label Kelas <span className="text-red-500">*</span></label>
            <input type="text" value={fLabel} onChange={e => setFLabel(e.target.value)} className={inputCls}/>
          </div>
          <div>
            <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">Mata Pelajaran</label>
            <input type="text" value={kelas?.courses?.name ?? '—'} disabled className={`${inputCls} opacity-60 cursor-not-allowed`}/>
            <p className="text-xs text-[#7B78A8] mt-1">Mata pelajaran tidak bisa diubah setelah kelas dibuat</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">Tipe Kelas</label>
              <input type="text" value={kelas?.class_types?.name ?? '—'} disabled className={`${inputCls} opacity-60 cursor-not-allowed`}/>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">Status Kelas</label>
              <select value={fStatus} onChange={e => setFStatus(e.target.value)} className={inputCls}>
                <option value="active">Aktif</option>
                <option value="inactive">Nonaktif</option>
                <option value="completed">Selesai</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">Link Zoom <span className="normal-case font-normal text-[#7B78A8]">(opsional)</span></label>
            <input type="url" value={fZoom} onChange={e => setFZoom(e.target.value)} placeholder="https://zoom.us/j/..." className={inputCls}/>
          </div>
          {error   && <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 font-semibold">{error}</div>}
          {success && <div className="px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 font-semibold">✅ {success}</div>}
          <button type="submit" disabled={saving}
            className="w-full py-3 bg-[#5C4FE5] hover:bg-[#3D34C4] text-white font-bold rounded-xl text-sm transition disabled:opacity-60">
            {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </form>
      </div>

      {/* DAFTAR SISWA */}
      <div className="bg-white rounded-2xl border border-[#E5E3FF] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E5E3FF] bg-[#F7F6FF]">
          <p className="text-xs font-bold text-[#7B78A8] uppercase tracking-wide">Daftar Siswa</p>
          <p className="text-xs text-[#7B78A8] mt-0.5">Kelola siswa yang terdaftar di kelas ini</p>
        </div>
        {enrollments.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-[#7B78A8]">Belum ada siswa terdaftar di kelas ini.</div>
        ) : (
          enrollments.map((enr, idx) => {
            const st = statusEnrollLabel[enr.status] ?? { label: enr.status, cls: 'bg-gray-100 text-gray-600' }
            const isActive = enr.status === 'active'
            return (
              <div key={enr.id} className={`flex items-center gap-3 px-5 py-4 ${idx < enrollments.length - 1 ? 'border-b border-[#E5E3FF]' : ''} hover:bg-[#F7F6FF] transition-colors`}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                  style={{backgroundColor: AVATAR_COLORS[idx % AVATAR_COLORS.length]}}>
                  {getInitials(enr.student_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-[#1A1640] truncate">{enr.student_name}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-[#7B78A8]">
                      Mulai sesi ke-{enr.session_start_offset} · Total {enr.sessions_total} sesi
                    </span>
                    {enr.notes && (
                      <span className="text-[10px] text-[#7B78A8] italic truncate max-w-[160px]">· {enr.notes}</span>
                    )}
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${st.cls}`}>{st.label}</span>
                {isActive && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {/* Tombol Edit Sesi */}
                    <button onClick={() => openEdit(enr)}
                      title="Edit pengaturan sesi"
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#EEEDFE] text-[#5C4FE5] hover:bg-[#E0DCFF] transition">
                      <Pencil size={12}/> Edit Sesi
                    </button>
                    <button onClick={() => openTransfer(enr)}
                      title="Pindah ke kelas lain"
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#FEF3E2] text-[#92400E] hover:bg-[#FDE9BF] transition">
                      <ArrowRightLeft size={12}/> Pindah
                    </button>
                    <button onClick={() => openStop(enr)}
                      title="Tandai siswa berhenti"
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#FEE9E9] text-[#991B1B] hover:bg-[#FECACA] transition">
                      <UserMinus size={12}/> Berhenti
                    </button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* MODAL EDIT SESI */}
      {modalType === 'edit' && selectedEnroll && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-[#1A1640]">Edit Pengaturan Sesi</h2>
              <button onClick={() => setModalType(null)} className="p-1.5 rounded-lg hover:bg-[#F7F6FF] text-[#7B78A8]"><X size={16}/></button>
            </div>

            <div className="bg-[#F7F6FF] rounded-xl px-4 py-3 mb-4">
              <p className="text-xs text-[#7B78A8] mb-0.5">Siswa</p>
              <p className="text-sm font-bold text-[#1A1640]">{selectedEnroll.student_name}</p>
            </div>

            <div className="space-y-4 mb-4">
              <div>
                <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">Total Sesi</label>
                <input type="number" min={1} max={100} value={editSessionsTotal}
                  onChange={e => setEditSessionsTotal(Number(e.target.value))} className={inputCls}/>
                <p className="text-xs text-[#7B78A8] mt-1">1 paket normal = 8 sesi</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">Mulai dari Sesi ke-</label>
                <input type="number" min={1} max={editSessionsTotal} value={editSessionStartOffset}
                  onChange={e => setEditSessionStartOffset(Number(e.target.value))} className={inputCls}/>
                <p className="text-xs text-[#7B78A8] mt-1">
                  {editSessionStartOffset === 1
                    ? 'Paket mulai dari awal'
                    : `Sesi pertama tampil sebagai sesi ke-${editSessionStartOffset} dari ${editSessionsTotal}`}
                </p>
              </div>
            </div>

            {modalError && <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 font-semibold mb-4">{modalError}</div>}

            <div className="flex gap-3">
              <button onClick={handleEditSesi} disabled={modalSaving}
                className="flex-1 py-3 bg-[#5C4FE5] hover:bg-[#3D34C4] text-white font-bold rounded-xl text-sm transition disabled:opacity-60">
                {modalSaving ? 'Menyimpan...' : 'Simpan'}
              </button>
              <button onClick={() => setModalType(null)}
                className="px-5 py-3 border border-[#E5E3FF] text-[#4A4580] font-bold rounded-xl text-sm hover:bg-[#F0EFFF] transition">
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TRANSFER */}
      {modalType === 'transfer' && selectedEnroll && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-[#1A1640]">Pindah Kelas</h2>
              <button onClick={() => setModalType(null)} className="p-1.5 rounded-lg hover:bg-[#F7F6FF] text-[#7B78A8]"><X size={16}/></button>
            </div>
            <div className="bg-[#F7F6FF] rounded-xl p-3 mb-4">
              <p className="text-xs text-[#7B78A8] mb-1">Siswa</p>
              <p className="text-sm font-bold text-[#1A1640]">{selectedEnroll.student_name}</p>
              <p className="text-xs text-[#7B78A8] mt-1">
                Sisa sesi: {selectedEnroll.sessions_total - (selectedEnroll.sessions_used ?? 0)} dari {selectedEnroll.sessions_total}
              </p>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">Kelas Tujuan <span className="text-red-500">*</span></label>
              <select value={transferTargetId} onChange={e => setTransferTargetId(e.target.value)} className={inputCls}>
                <option value="">-- Pilih Kelas --</option>
                {otherClasses.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div className="bg-[#EEEDFE] rounded-xl px-4 py-3 mb-4">
              <p className="text-xs font-semibold text-[#3C3489]">
                💡 Enrollment lama akan ditandai <strong>"Pindah ke kelas lain"</strong> dan enrollment baru akan dibuat di kelas tujuan dengan sisa sesi yang sama.
              </p>
            </div>
            {modalError && <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 font-semibold mb-4">{modalError}</div>}
            <div className="flex gap-3">
              <button onClick={handleTransfer} disabled={modalSaving}
                className="flex-1 py-3 bg-[#5C4FE5] hover:bg-[#3D34C4] text-white font-bold rounded-xl text-sm transition disabled:opacity-60">
                {modalSaving ? 'Memproses...' : 'Pindahkan Siswa'}
              </button>
              <button onClick={() => setModalType(null)}
                className="px-5 py-3 border border-[#E5E3FF] text-[#4A4580] font-bold rounded-xl text-sm hover:bg-[#F0EFFF] transition">
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL BERHENTI */}
      {modalType === 'stop' && selectedEnroll && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
              <UserMinus size={22} className="text-red-500"/>
            </div>
            <h3 className="text-lg font-bold text-[#1A1640] mb-1">Siswa Berhenti?</h3>
            <p className="text-sm text-[#7B78A8] mb-2"><strong>{selectedEnroll.student_name}</strong> akan ditandai berhenti dari kelas ini.</p>
            <div className="bg-[#FEE9E9] rounded-xl px-4 py-3 mb-6">
              <p className="text-xs font-semibold text-[#991B1B]">
                Data enrollment akan ditandai <strong>"Siswa berhenti"</strong> dan tidak dihapus — riwayat tetap tersimpan.
              </p>
            </div>
            {modalError && <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 font-semibold mb-4">{modalError}</div>}
            <div className="flex gap-3">
              <button onClick={() => setModalType(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-[#7B78A8] border border-[#E5E3FF] hover:bg-[#F7F6FF] transition">
                Batal
              </button>
              <button onClick={handleStop} disabled={modalSaving}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 transition disabled:opacity-60">
                {modalSaving ? 'Memproses...' : 'Ya, Berhenti'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
