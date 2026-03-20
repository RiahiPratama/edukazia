'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BookOpen, ChevronDown, ChevronUp, Users, FileText, Pencil, Save, X, Archive } from 'lucide-react'

const STATUS_COLOR: Record<string, string> = {
  hadir: 'bg-green-100 text-green-700',
  izin:  'bg-blue-100 text-blue-700',
  sakit: 'bg-yellow-100 text-yellow-700',
  alpha: 'bg-red-100 text-red-700',
}
const STATUS_LABEL: Record<string, string> = {
  hadir: 'Hadir', izin: 'Izin', sakit: 'Sakit', alpha: 'Alpha'
}

const AVATAR_COLORS = [
  { bg: '#EEEDFE', text: '#3C3489' },
  { bg: '#E6F1FB', text: '#0C447C' },
  { bg: '#EAF3DE', text: '#3B6D11' },
  { bg: '#FAEEDA', text: '#633806' },
  { bg: '#FCEBEB', text: '#791F1F' },
  { bg: '#FBEAF0', text: '#72243E' },
]

type ReportForm = { materi: string; perkembangan: string; saranSiswa: string; saranOrtu: string }

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase()
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jayapura'
  })
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('id-ID', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jayapura'
  })
}

const textareaCls = "w-full px-3 py-2 border border-[#E5E3FF] rounded-xl text-xs bg-white text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] transition resize-none"

export default function TutorLaporanPage() {
  const supabase = createClient()

  const [tutorId,        setTutorId]        = useState<string | null>(null)
  const [kelasList,      setKelasList]      = useState<any[]>([])
  const [selectedKelas,  setSelectedKelas]  = useState<any | null>(null)
  const [laporanData,    setLaporanData]    = useState<any[]>([])
  const [expandedSiswa,  setExpandedSiswa]  = useState<Record<string, boolean>>({})
  const [expandedSesi,   setExpandedSesi]   = useState<Record<string, boolean>>({})
  const [showArsip,      setShowArsip]      = useState(false)  const [editingKey,     setEditingKey]     = useState<string | null>(null)
  const [editForm,       setEditForm]       = useState<ReportForm>({ materi: '', perkembangan: '', saranSiswa: '', saranOrtu: '' })
  const [savingKey,      setSavingKey]      = useState<string | null>(null)
  const [saveSuccess,    setSaveSuccess]    = useState<string | null>(null)
  const [loading,        setLoading]        = useState(true)
  const [loadingLaporan, setLoadingLaporan] = useState(false)

  useEffect(() => { fetchKelas() }, [])

  async function fetchKelas() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: tutor } = await supabase
      .from('tutors').select('id').eq('profile_id', user.id).single()
    if (!tutor?.id) { setLoading(false); return }
    setTutorId(tutor.id)

    const { data: kelas } = await supabase
      .from('class_groups')
      .select('id, label, status, course_id, courses(name, color)')
      .eq('tutor_id', tutor.id)
      .order('created_at', { ascending: false })

    setKelasList(kelas ?? [])
    setLoading(false)
  }

  async function selectKelas(k: any) {
    setSelectedKelas(k)
    setExpandedSiswa({})
    setExpandedSesi({})
    setEditingKey(null)
    setLoadingLaporan(true)

    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('id, student_id, session_start_offset, sessions_total')
      .eq('class_group_id', k.id)

    if (!enrollments || enrollments.length === 0) {
      setLaporanData([]); setLoadingLaporan(false); return
    }

    const studentIds = enrollments.map((e: any) => e.student_id)

    // Ambil semua sesi (completed dan scheduled) untuk info lengkap
    const { data: sessions } = await supabase
      .from('sessions')
      .select('id, scheduled_at, status')
      .eq('class_group_id', k.id)
      .in('status', ['completed', 'scheduled'])
      .order('scheduled_at')

    const sessionIds = (sessions ?? []).map((s: any) => s.id)

    const [
      { data: attendances },
      { data: sessionReports },
      { data: students },
    ] = await Promise.all([
      sessionIds.length > 0
        ? supabase.from('attendances').select('session_id, student_id, status, notes').in('session_id', sessionIds).in('student_id', studentIds)
        : { data: [] },
      sessionIds.length > 0
        ? supabase.from('session_reports').select('session_id, student_id, materi, perkembangan, saran_siswa, saran_ortu').in('session_id', sessionIds).in('student_id', studentIds)
        : { data: [] },
      supabase.from('students').select('id, profile_id').in('id', studentIds),
    ])

    const profileIds = (students ?? []).map((s: any) => s.profile_id).filter(Boolean)
    const { data: profiles } = profileIds.length > 0
      ? await supabase.from('profiles').select('id, full_name').in('id', profileIds)
      : { data: [] }

    const profMap    = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p.full_name]))
    const studentMap = Object.fromEntries((students ?? []).map((s: any) => [s.id, profMap[s.profile_id] ?? 'Siswa']))

    const attMap: Record<string, Record<string, any>> = {}
    ;(attendances ?? []).forEach((a: any) => {
      if (!attMap[a.student_id]) attMap[a.student_id] = {}
      attMap[a.student_id][a.session_id] = { status: a.status, notes: a.notes ?? '' }
    })

    const repMap: Record<string, Record<string, any>> = {}
    ;(sessionReports ?? []).forEach((r: any) => {
      if (!repMap[r.student_id]) repMap[r.student_id] = {}
      repMap[r.student_id][r.session_id] = {
        materi:       r.materi ?? '',
        perkembangan: r.perkembangan ?? '',
        saranSiswa:   r.saran_siswa ?? '',
        saranOrtu:    r.saran_ortu ?? '',
      }
    })

    const laporan = enrollments.map((e: any) => {
      const nama     = studentMap[e.student_id] ?? 'Siswa'
      const siswaAtt = attMap[e.student_id] ?? {}
      const siswaRep = repMap[e.student_id] ?? {}
      const totalSesi = (sessions ?? []).length
      const hadir  = Object.values(siswaAtt).filter((a: any) => a.status === 'hadir').length
      const izin   = Object.values(siswaAtt).filter((a: any) => a.status === 'izin').length
      const sakit  = Object.values(siswaAtt).filter((a: any) => a.status === 'sakit').length
      const alpha  = Object.values(siswaAtt).filter((a: any) => a.status === 'alpha').length
      const diabsen   = hadir + izin + sakit + alpha
      const pctHadir  = totalSesi > 0 ? Math.round((hadir / totalSesi) * 100) : 0

      const detailSesi = (sessions ?? []).map((s: any) => ({
        sessionId:    s.id,
        sessionStatus: s.status,
        scheduledAt:  s.scheduled_at,
        absenStatus:  siswaAtt[s.id]?.status ?? null,
        absenNotes:   siswaAtt[s.id]?.notes ?? '',
        materi:       siswaRep[s.id]?.materi ?? '',
        perkembangan: siswaRep[s.id]?.perkembangan ?? '',
        saranSiswa:   siswaRep[s.id]?.saranSiswa ?? '',
        saranOrtu:    siswaRep[s.id]?.saranOrtu ?? '',
        hasReport:    !!siswaRep[s.id],
      }))

      return {
        studentId: e.student_id, nama,
        sessionOffset: e.session_start_offset,
        sessionTotal: e.sessions_total,
        totalSesi, diabsen, hadir, izin, sakit, alpha, pctHadir, detailSesi,
      }
    })

    setLaporanData(laporan)
    setLoadingLaporan(false)
  }

  function toggleSiswa(id: string) {
    setExpandedSiswa(prev => ({ ...prev, [id]: !prev[id] }))
  }
  function toggleSesi(id: string) {
    setExpandedSesi(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function startEdit(key: string, existing: ReportForm) {
    setEditingKey(key)
    setEditForm({ ...existing })
    setExpandedSesi(prev => ({ ...prev, [key]: false }))
  }
  function cancelEdit() {
    setEditingKey(null)
    setEditForm({ materi: '', perkembangan: '', saranSiswa: '', saranOrtu: '' })
  }

  async function saveReport(studentId: string, sessionId: string, key: string) {
    if (!tutorId) return
    setSavingKey(key)

    const record = {
      session_id:   sessionId,
      student_id:   studentId,
      materi:       editForm.materi || null,
      perkembangan: editForm.perkembangan || null,
      saran_siswa:  editForm.saranSiswa || null,
      saran_ortu:   editForm.saranOrtu || null,
      recorded_by:  tutorId,
    }

    const { error } = await supabase
      .from('session_reports')
      .upsert(record, { onConflict: 'session_id,student_id' })

    if (!error) {
      // Update local state
      setLaporanData(prev => prev.map(siswa => {
        if (siswa.studentId !== studentId) return siswa
        return {
          ...siswa,
          detailSesi: siswa.detailSesi.map((s: any) => {
            if (s.sessionId !== sessionId) return s
            return {
              ...s,
              materi:       editForm.materi,
              perkembangan: editForm.perkembangan,
              saranSiswa:   editForm.saranSiswa,
              saranOrtu:    editForm.saranOrtu,
              hasReport:    true,
            }
          })
        }
      }))
      setSaveSuccess(key)
      setTimeout(() => setSaveSuccess(null), 3000)
      setEditingKey(null)
    }
    setSavingKey(null)
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="text-sm text-[#7B78A8]">Memuat data kelas...</div>
    </div>
  )

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-black text-[#1A1640] font-['Sora']">Laporan Siswa</h1>
        <p className="text-sm text-[#7B78A8] mt-1">Rekap kehadiran dan laporan belajar per kelas</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Kolom kiri — pilih kelas */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-[#E5E3FF] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#E5E3FF]">
              <h2 className="font-bold text-sm text-[#1A1640]">Pilih Kelas</h2>
            </div>
            {kelasList.length === 0 ? (
              <div className="p-6 text-center">
                <BookOpen size={28} strokeWidth={1.5} className="text-[#C4BFFF] mx-auto mb-2"/>
                <p className="text-xs text-[#7B78A8]">Belum ada kelas</p>
              </div>
            ) : (
              <div className="divide-y divide-[#F0EFFF]">
                {/* Kelas Aktif */}
                {kelasList.filter(k => k.status === 'active').map((k: any) => {
                  const isSelected = selectedKelas?.id === k.id
                  return (
                    <button key={k.id} onClick={() => selectKelas(k)}
                      className={['w-full text-left px-4 py-3 transition-colors',
                        isSelected ? 'bg-[#5C4FE5] text-white' : 'hover:bg-[#F7F6FF]'
                      ].join(' ')}>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ background: isSelected ? 'white' : (k.courses?.color ?? '#5C4FE5') }}/>
                        <div className="min-w-0">
                          <div className={`text-sm font-bold truncate ${isSelected ? 'text-white' : 'text-[#1A1640]'}`}>{k.label}</div>
                          <div className={`text-xs ${isSelected ? 'text-white/70' : 'text-[#7B78A8]'}`}>{k.courses?.name ?? '—'}</div>
                        </div>
                      </div>
                    </button>
                  )
                })}

                {/* Arsip Kelas */}
                {kelasList.filter(k => k.status === 'inactive').length > 0 && (
                  <>
                    <button
                      onClick={() => setShowArsip(prev => !prev)}
                      className="w-full flex items-center gap-2 px-4 py-2.5 bg-gray-50 text-[#9B97B2] text-xs font-semibold hover:bg-gray-100 transition-colors">
                      <Archive size={12}/>
                      Arsip Kelas
                      <span className="ml-1 bg-gray-200 text-gray-600 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                        {kelasList.filter(k => k.status === 'inactive').length}
                      </span>
                      <span className="ml-auto">
                        {showArsip ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
                      </span>
                    </button>
                    {showArsip && kelasList.filter(k => k.status === 'inactive').map((k: any) => {
                      const isSelected = selectedKelas?.id === k.id
                      return (
                        <button key={k.id} onClick={() => selectKelas(k)}
                          className={['w-full text-left px-4 py-3 transition-colors',
                            isSelected ? 'bg-[#5C4FE5] text-white' : 'hover:bg-[#F7F6FF]'
                          ].join(' ')}>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full flex-shrink-0 opacity-50"
                              style={{ background: isSelected ? 'white' : (k.courses?.color ?? '#5C4FE5') }}/>
                            <div className="min-w-0">
                              <div className={`text-sm font-bold truncate ${isSelected ? 'text-white' : 'text-[#7B78A8]'}`}>{k.label}</div>
                              <div className={`text-xs ${isSelected ? 'text-white/70' : 'text-[#9B97B2]'}`}>{k.courses?.name ?? '—'} · Arsip</div>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Kolom kanan — laporan */}
        <div className="lg:col-span-2">
          {!selectedKelas ? (
            <div className="bg-white rounded-2xl border border-[#E5E3FF] p-12 text-center flex flex-col items-center justify-center min-h-[300px]">
              <Users size={36} strokeWidth={1.5} className="text-[#C4BFFF] mb-3"/>
              <p className="text-sm font-semibold text-[#7B78A8]">Pilih kelas di sebelah kiri</p>
              <p className="text-xs text-[#7B78A8] mt-1">untuk melihat rekap kehadiran dan laporan belajar</p>
            </div>
          ) : loadingLaporan ? (
            <div className="bg-white rounded-2xl border border-[#E5E3FF] p-12 text-center">
              <p className="text-sm text-[#7B78A8]">Memuat laporan...</p>
            </div>
          ) : laporanData.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#E5E3FF] p-12 text-center">
              <p className="text-sm text-[#7B78A8]">Belum ada data di kelas ini</p>
            </div>
          ) : (
            <div className="space-y-3">
              {laporanData.map((siswa: any, idx: number) => {
                const avatarColor = AVATAR_COLORS[idx % AVATAR_COLORS.length]
                const isOpen      = expandedSiswa[siswa.studentId] ?? false
                const laporanBelumDiisi = siswa.detailSesi.filter((s: any) => s.sessionStatus === 'completed' && s.absenStatus && !s.hasReport).length

                return (
                  <div key={siswa.studentId} className="bg-white rounded-2xl border border-[#E5E3FF] overflow-hidden">
                    {/* Header siswa */}
                    <div className="px-5 py-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ background: avatarColor.bg, color: avatarColor.text }}>
                          {getInitials(siswa.nama)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-[#1A1640]">{siswa.nama}</div>
                          <div className="text-xs text-[#7B78A8]">Progress: {siswa.sessionOffset}/{siswa.sessionTotal} sesi</div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-lg font-black text-[#5C4FE5]">{siswa.pctHadir}%</div>
                          <div className="text-[10px] text-[#7B78A8]">kehadiran</div>
                        </div>
                      </div>

                      <div className="flex gap-2 flex-wrap mb-3">
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-green-50 text-green-700">✓ {siswa.hadir} Hadir</span>
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700">{siswa.izin} Izin</span>
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-yellow-50 text-yellow-700">{siswa.sakit} Sakit</span>
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-red-50 text-red-700">{siswa.alpha} Alpha</span>
                        {laporanBelumDiisi > 0 && (
                          <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-yellow-50 text-yellow-700">
                            ✏ {laporanBelumDiisi} laporan belum diisi
                          </span>
                        )}
                      </div>

                      <div className="w-full h-2 bg-[#E5E3FF] rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-[#5C4FE5] transition-all" style={{ width: `${siswa.pctHadir}%` }}/>
                      </div>
                    </div>

                    {/* Toggle detail */}
                    <button onClick={() => toggleSiswa(siswa.studentId)}
                      className="w-full flex items-center justify-between px-5 py-3 border-t border-[#F0EFFF] hover:bg-[#F7F6FF] transition-colors">
                      <span className="text-[10px] font-bold text-[#7B78A8] uppercase tracking-widest">Detail per Sesi</span>
                      <span className="flex items-center gap-1 text-xs text-[#5C4FE5] font-semibold">
                        {siswa.totalSesi} sesi
                        {isOpen ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
                      </span>
                    </button>

                    {/* Detail sesi */}
                    {isOpen && (
                      <div className="border-t border-[#F0EFFF] divide-y divide-[#F0EFFF]">
                        {siswa.detailSesi.map((sesi: any, i: number) => {
                          const key        = `${siswa.studentId}-${sesi.sessionId}`
                          const isSesiOpen = expandedSesi[key] ?? false
                          const isEditing  = editingKey === key
                          const isSaving   = savingKey === key
                          const justSaved  = saveSuccess === key
                          const hasReport  = sesi.hasReport

                          return (
                            <div key={sesi.sessionId}>
                              <div className="flex items-center gap-3 px-5 py-3 hover:bg-[#F7F6FF] transition-colors">
                                <div className="w-6 h-6 rounded-full bg-[#F0EFFF] flex items-center justify-center text-[10px] font-bold text-[#7B78A8] flex-shrink-0">
                                  {i + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-semibold text-[#1A1640]">
                                    {fmtDate(sesi.scheduledAt)} · {fmtTime(sesi.scheduledAt)} WIT
                                  </div>
                                  {sesi.absenNotes && (
                                    <div className="text-[10px] text-[#7B78A8] mt-0.5 italic">"{sesi.absenNotes}"</div>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  {sesi.absenStatus ? (
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLOR[sesi.absenStatus]}`}>
                                      {STATUS_LABEL[sesi.absenStatus]}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">
                                      Belum diabsen
                                    </span>
                                  )}

                                  {/* Tombol laporan — hanya muncul kalau sesi completed & sudah diabsen */}
                                  {sesi.sessionStatus === 'completed' && sesi.absenStatus && !isEditing && (
                                    <button
                                      onClick={() => hasReport
                                        ? toggleSesi(key)
                                        : startEdit(key, { materi: sesi.materi, perkembangan: sesi.perkembangan, saranSiswa: sesi.saranSiswa, saranOrtu: sesi.saranOrtu })
                                      }
                                      className="flex items-center gap-1 text-[10px] font-semibold text-[#5C4FE5] hover:underline">
                                      {hasReport
                                        ? <><FileText size={11}/>{isSesiOpen ? 'Tutup' : 'Lihat'}</>
                                        : <><Pencil size={11}/>Isi Laporan</>
                                      }
                                    </button>
                                  )}

                                  {/* Tombol edit kalau laporan sudah ada */}
                                  {sesi.sessionStatus === 'completed' && hasReport && isSesiOpen && !isEditing && (
                                    <button
                                      onClick={() => startEdit(key, { materi: sesi.materi, perkembangan: sesi.perkembangan, saranSiswa: sesi.saranSiswa, saranOrtu: sesi.saranOrtu })}
                                      className="flex items-center gap-1 text-[10px] font-semibold text-[#5C4FE5] hover:underline">
                                      <Pencil size={11}/> Edit
                                    </button>
                                  )}

                                  {justSaved && (
                                    <span className="text-[10px] font-bold text-green-600">✓ Tersimpan</span>
                                  )}
                                </div>
                              </div>

                              {/* View laporan */}
                              {isSesiOpen && hasReport && !isEditing && (
                                <div className="mx-5 mb-3 bg-[#F7F6FF] rounded-xl border border-[#E5E3FF] p-4 space-y-3">
                                  {sesi.materi && (
                                    <div>
                                      <p className="text-[10px] font-bold text-[#7B78A8] uppercase tracking-wide mb-1">Materi Diajarkan</p>
                                      <p className="text-xs text-[#1A1640]">{sesi.materi}</p>
                                    </div>
                                  )}
                                  {sesi.perkembangan && (
                                    <div>
                                      <p className="text-[10px] font-bold text-[#7B78A8] uppercase tracking-wide mb-1">Perkembangan Siswa</p>
                                      <p className="text-xs text-[#1A1640]">{sesi.perkembangan}</p>
                                    </div>
                                  )}
                                  {sesi.saranSiswa && (
                                    <div>
                                      <p className="text-[10px] font-bold text-[#7B78A8] uppercase tracking-wide mb-1">Saran untuk Siswa</p>
                                      <p className="text-xs text-[#1A1640]">{sesi.saranSiswa}</p>
                                    </div>
                                  )}
                                  {sesi.saranOrtu && (
                                    <div>
                                      <p className="text-[10px] font-bold text-[#7B78A8] uppercase tracking-wide mb-1">Saran untuk Orang Tua</p>
                                      <p className="text-xs text-[#1A1640]">{sesi.saranOrtu}</p>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Form edit/input inline */}
                              {isEditing && (
                                <div className="mx-5 mb-3 bg-[#F7F6FF] rounded-xl border border-[#5C4FE5] p-4 space-y-3">
                                  <div className="flex items-center justify-between mb-1">
                                    <p className="text-[11px] font-bold text-[#5C4FE5] uppercase tracking-wide">
                                      {hasReport ? 'Edit Laporan' : 'Isi Laporan Belajar'}
                                    </p>
                                    <button onClick={cancelEdit} className="text-[#9B97B2] hover:text-red-500 transition">
                                      <X size={14}/>
                                    </button>
                                  </div>

                                  {[
                                    { field: 'materi' as keyof ReportForm, label: 'Materi yang Diajarkan', placeholder: 'Contoh: Phonics level 3, blending CVC words...' },
                                    { field: 'perkembangan' as keyof ReportForm, label: 'Perkembangan & Pemahaman Siswa', placeholder: 'Contoh: Sudah bisa membaca 3 huruf...' },
                                    { field: 'saranSiswa' as keyof ReportForm, label: 'Saran untuk Siswa', placeholder: 'Contoh: Rajin membaca buku cerita bergambar...' },
                                    { field: 'saranOrtu' as keyof ReportForm, label: 'Saran untuk Orang Tua', placeholder: 'Contoh: Mohon dampingi latihan membaca 10 menit setiap hari...' },
                                  ].map(({ field, label, placeholder }) => (
                                    <div key={field}>
                                      <label className="block text-[10px] font-bold text-[#7B78A8] uppercase tracking-wide mb-1">{label}</label>
                                      <textarea rows={2} placeholder={placeholder}
                                        value={editForm[field]}
                                        onChange={e => setEditForm(prev => ({ ...prev, [field]: e.target.value }))}
                                        className={textareaCls}
                                      />
                                    </div>
                                  ))}

                                  <button
                                    onClick={() => saveReport(siswa.studentId, sesi.sessionId, key)}
                                    disabled={isSaving}
                                    className="w-full py-2.5 bg-[#5C4FE5] hover:bg-[#3D34C4] text-white font-bold rounded-xl text-xs transition disabled:opacity-60 flex items-center justify-center gap-2">
                                    <Save size={13}/>
                                    {isSaving ? 'Menyimpan...' : 'Simpan Laporan'}
                                  </button>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
