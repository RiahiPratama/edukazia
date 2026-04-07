'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BookOpen, ChevronDown, ChevronUp, Users, FileText, Pencil, Save, X, Archive, BarChart2, Clock, AlertTriangle } from 'lucide-react'
import BilingualReport from '@/components/shared/BilingualReport'
import { LaporanEditor } from '@/components/shared/LaporanEditor'

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

type ReportForm = { materi: string; perkembangan: string; saranSiswa: string; saranOrtu: string; recordingUrl: string }
type ActiveTab  = 'ringkasan' | 'perkelas' | 'timeline'

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
function fmtRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (d > 0) return `${d} hari lalu`
  if (h > 0) return `${h} jam lalu`
  return 'Baru saja'
}

const textareaCls = "w-full px-3 py-2 border border-[#E5E3FF] rounded-xl text-xs bg-white text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] transition resize-none"

export default function TutorLaporanPage() {
  const supabase = createClient()

  const [tutorId,        setTutorId]        = useState<string | null>(null)
  const [activeTab,      setActiveTab]      = useState<ActiveTab>('ringkasan')
  const [kelasList,      setKelasList]      = useState<any[]>([])
  const [selectedKelas,  setSelectedKelas]  = useState<any | null>(null)
  const [laporanData,    setLaporanData]    = useState<any[]>([])
  const [expandedSiswa,  setExpandedSiswa]  = useState<Record<string, boolean>>({})
  const [expandedSesi,   setExpandedSesi]   = useState<Record<string, boolean>>({})
  const [showArsip,      setShowArsip]      = useState(false)
  const [editingKey,     setEditingKey]     = useState<string | null>(null)
  const [editForm,       setEditForm]       = useState<ReportForm>({ materi: '', perkembangan: '', saranSiswa: '', saranOrtu: '', recordingUrl: '' })
  const [savingKey,      setSavingKey]      = useState<string | null>(null)
  const [saveSuccess,    setSaveSuccess]    = useState<string | null>(null)
  const [loading,        setLoading]        = useState(true)
  const [loadingLaporan, setLoadingLaporan] = useState(false)

  // Filter tanggal
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo,   setFilterTo]   = useState('')

  // Data ringkasan & timeline
  const [ringkasan,    setRingkasan]    = useState<any | null>(null)
  const [timeline,     setTimeline]     = useState<any[]>([])
  const [belumDiisi,   setBelumDiisi]   = useState<any[]>([])
  const [loadingExtra, setLoadingExtra] = useState(false)

  // Modal isi laporan dari ringkasan/timeline
  const [modalLaporan, setModalLaporan] = useState<{ sessionId: string; studentId: string; studentName: string; kelasLabel: string; scheduledAt: string } | null>(null)
  const [modalForm,    setModalForm]    = useState<ReportForm>({ materi: '', perkembangan: '', saranSiswa: '', saranOrtu: '', recordingUrl: '' })
  const [modalSaving,  setModalSaving]  = useState(false)
  const [modalMsg,     setModalMsg]     = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

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

    setKelasList((kelas ?? []).sort((a: any, b: any) => a.label.localeCompare(b.label, 'id')))
    setLoading(false)

    // Load ringkasan & timeline
    await fetchRingkasan(tutor.id, kelas ?? [])
  }

  async function fetchRingkasan(tId: string, kelas: any[]) {
    setLoadingExtra(true)
    const kelasIds = kelas.map((k: any) => k.id)
    if (kelasIds.length === 0) { setLoadingExtra(false); return }

    // Ambil semua sessions completed
    const { data: sessions } = await supabase
      .from('sessions')
      .select('id, class_group_id, scheduled_at')
      .in('class_group_id', kelasIds)
      .eq('status', 'completed')
      .order('scheduled_at', { ascending: false })

    const sessionIds = (sessions ?? []).map((s: any) => s.id)

    const [
      { data: reports },
      { data: attendances },
      { data: enrollments },
    ] = await Promise.all([
      sessionIds.length > 0
        ? supabase.from('session_reports')
            .select('session_id, student_id, materi, perkembangan, saran_ortu, recording_url, created_at')
            .in('session_id', sessionIds)
            .order('created_at', { ascending: false })
        : { data: [] },
      sessionIds.length > 0
        ? supabase.from('attendances')
            .select('session_id, student_id, status')
            .in('session_id', sessionIds)
        : { data: [] },
      supabase.from('enrollments')
        .select('student_id, class_group_id')
        .in('class_group_id', kelasIds)
        .eq('status', 'active'),
    ])

    // Profil siswa
    const studentIds = [...new Set((enrollments ?? []).map((e: any) => e.student_id))]
    const { data: students } = studentIds.length > 0
      ? await supabase.from('students').select('id, profile_id').in('id', studentIds)
      : { data: [] }
    const profileIds = (students ?? []).map((s: any) => s.profile_id).filter(Boolean)
    const { data: profiles } = profileIds.length > 0
      ? await supabase.from('profiles').select('id, full_name').in('id', profileIds)
      : { data: [] }
    const profMap    = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p.full_name]))
    const studentMap = Object.fromEntries((students ?? []).map((s: any) => [s.id, profMap[s.profile_id] ?? 'Siswa']))

    // ── Ringkasan stats ──
    const totalSesi     = (sessions ?? []).length
    const totalLaporan  = (reports ?? []).length
    const totalHadir    = (attendances ?? []).filter((a: any) => a.status === 'hadir').length
    const totalAbsensi  = (attendances ?? []).length
    const pctHadir      = totalAbsensi > 0 ? Math.round((totalHadir / totalAbsensi) * 100) : 0
    const kelasAktif    = kelas.filter(k => k.status === 'active').length

    // Laporan belum diisi: sesi completed + diabsen tapi belum ada laporan
    const reportSet = new Set((reports ?? []).map((r: any) => `${r.session_id}-${r.student_id}`))
    const belum: any[] = []
    ;(attendances ?? []).filter((a: any) => a.status === 'hadir').forEach((a: any) => {
      const key = `${a.session_id}-${a.student_id}`
      if (!reportSet.has(key)) {
        const sesi   = (sessions ?? []).find((s: any) => s.id === a.session_id)
        const kls    = kelas.find((k: any) => k.id === sesi?.class_group_id)
        const jamLalu = sesi ? Math.floor((Date.now() - new Date(sesi.scheduled_at).getTime()) / (1000 * 60 * 60)) : 0
        belum.push({
          sessionId:   a.session_id,
          studentId:   a.student_id,
          studentName: studentMap[a.student_id] ?? 'Siswa',
          kelasLabel:  kls?.label ?? '—',
          scheduledAt: sesi?.scheduled_at ?? '',
          jamLalu,
        })
      }
    })
    belum.sort((a, b) => b.jamLalu - a.jamLalu)
    setBelumDiisi(belum)

    setRingkasan({ totalSesi, totalLaporan, totalHadir, totalAbsensi, pctHadir, kelasAktif, totalSiswa: studentIds.length })

    // ── Timeline: 20 laporan terbaru lintas kelas ──
    const timelineItems = (reports ?? []).slice(0, 20).map((r: any) => {
      const sesi = (sessions ?? []).find((s: any) => s.id === r.session_id)
      const kls  = kelas.find((k: any) => k.id === sesi?.class_group_id)
      return {
        sessionId:   r.session_id,
        studentId:   r.student_id,
        studentName: studentMap[r.student_id] ?? 'Siswa',
        kelasLabel:  kls?.label ?? '—',
        courseName:  kls?.courses?.name ?? '—',
        scheduledAt: sesi?.scheduled_at ?? r.created_at,
        materi:      r.materi ?? '',
        perkembangan: r.perkembangan ?? '',
        saranOrtu:   r.saran_ortu ?? '',
        recordingUrl: r.recording_url ?? '',
        createdAt:   r.created_at,
      }
    })
    setTimeline(timelineItems)
    setLoadingExtra(false)
  }

  async function selectKelas(k: any) {
    setSelectedKelas(k)
    setExpandedSiswa({})
    setExpandedSesi({})
    setEditingKey(null)
    setLoadingLaporan(true)

    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('id, student_id, session_start_offset, sessions_total, enrolled_at')
      .eq('class_group_id', k.id)
      .eq('status', 'active')

    if (!enrollments || enrollments.length === 0) {
      setLaporanData([]); setLoadingLaporan(false); return
    }

    const studentIds = enrollments.map((e: any) => e.student_id)

    // Filter tanggal
    let sessionQuery = supabase
      .from('sessions')
      .select('id, scheduled_at, status')
      .eq('class_group_id', k.id)
      .in('status', ['completed', 'scheduled', 'rescheduled'])
      .order('scheduled_at')

    if (filterFrom) sessionQuery = sessionQuery.gte('scheduled_at', filterFrom + 'T00:00:00+09:00')
    if (filterTo)   sessionQuery = sessionQuery.lte('scheduled_at', filterTo + 'T23:59:59+09:00')

    const { data: sessions } = await sessionQuery
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
        ? supabase.from('session_reports').select('session_id, student_id, materi, perkembangan, saran_siswa, saran_ortu, recording_url').in('session_id', sessionIds).in('student_id', studentIds)
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
        recordingUrl: r.recording_url ?? '',
      }
    })

    const laporan = enrollments.map((e: any) => {
      const nama     = studentMap[e.student_id] ?? 'Siswa'
      const siswaAtt = attMap[e.student_id] ?? {}
      const siswaRep = repMap[e.student_id] ?? {}

      // FIX: hanya hitung sesi SETELAH enrolled_at enrollment active ini
      const enrolledAt   = e.enrolled_at ? new Date(e.enrolled_at) : new Date(0)
      const sessiRelevan = (sessions ?? []).filter((s: any) => new Date(s.scheduled_at) >= enrolledAt)
      const totalSesi    = sessiRelevan.length

      // Hitung absensi hanya dari sesi relevan
      const hadir  = sessiRelevan.filter((s: any) => siswaAtt[s.id]?.status === 'hadir').length
      const izin   = sessiRelevan.filter((s: any) => siswaAtt[s.id]?.status === 'izin').length
      const sakit  = sessiRelevan.filter((s: any) => siswaAtt[s.id]?.status === 'sakit').length
      const alpha  = sessiRelevan.filter((s: any) => !siswaAtt[s.id] && s.status === 'completed').length
      const completedCount = sessiRelevan.filter((s: any) => s.status === 'completed').length
      // Kehadiran % = hadir / sesi yang sudah terjadi (untuk teks)
      const pctHadir = completedCount > 0 ? Math.round((hadir / completedCount) * 100) : 0
      // Progress bar = sesi completed / total sesi sejak enrolled (untuk bar visual)
      const progressPct = sessiRelevan.length > 0 ? Math.round((completedCount / sessiRelevan.length) * 100) : 0

      // FIX progress: session_start_offset + hadir, cap at sessions_total
      const sessionDone = Math.min(
        (e.session_start_offset ?? 1) + hadir,
        e.sessions_total ?? 8
      )

      const detailSesi = sessiRelevan.map((s: any) => ({
        sessionId:     s.id,
        sessionStatus: s.status,
        scheduledAt:   s.scheduled_at,
        absenStatus:   siswaAtt[s.id]?.status ?? null,
        absenNotes:    siswaAtt[s.id]?.notes ?? '',
        materi:        siswaRep[s.id]?.materi ?? '',
        perkembangan:  siswaRep[s.id]?.perkembangan ?? '',
        saranSiswa:    siswaRep[s.id]?.saranSiswa ?? '',
        saranOrtu:     siswaRep[s.id]?.saranOrtu ?? '',
        recordingUrl:  siswaRep[s.id]?.recordingUrl ?? '',
        hasReport:     !!siswaRep[s.id],
      }))

      return {
        studentId: e.student_id, nama,
        sessionOffset: sessionDone,
        sessionTotal:  e.sessions_total,
        totalSesi, hadir, izin, sakit, alpha, pctHadir, progressPct, completedCount, detailSesi,
      }
    })

    // FIX: sort alfabet by nama
    laporan.sort((a: any, b: any) => a.nama.localeCompare(b.nama, 'id'))

    setLaporanData(laporan)
    setLoadingLaporan(false)
  }

  function toggleSiswa(id: string) { setExpandedSiswa(prev => ({ ...prev, [id]: !prev[id] })) }
  function toggleSesi(id: string)  { setExpandedSesi(prev => ({ ...prev, [id]: !prev[id] })) }

  function startEdit(key: string, existing: ReportForm) {
    setEditingKey(key)
    setEditForm({ ...existing })
    setExpandedSesi(prev => ({ ...prev, [key]: false }))
  }
  function cancelEdit() {
    setEditingKey(null)
    setEditForm({ materi: '', perkembangan: '', saranSiswa: '', saranOrtu: '', recordingUrl: '' })
  }

  async function saveReport(studentId: string, sessionId: string, key: string) {
    if (!tutorId) return
    setSavingKey(key)
    const { error } = await supabase.from('session_reports').upsert({
      session_id:    sessionId,
      student_id:    studentId,
      materi:        editForm.materi || null,
      perkembangan:  editForm.perkembangan || null,
      saran_siswa:   editForm.saranSiswa || null,
      saran_ortu:    editForm.saranOrtu || null,
      recording_url: editForm.recordingUrl || null,
      recorded_by:   tutorId,
    }, { onConflict: 'session_id,student_id' })

    if (!error) {
      setLaporanData(prev => prev.map(siswa => {
        if (siswa.studentId !== studentId) return siswa
        return {
          ...siswa,
          detailSesi: siswa.detailSesi.map((s: any) => {
            if (s.sessionId !== sessionId) return s
            return { ...s, ...editForm, hasReport: true }
          })
        }
      }))
      setSaveSuccess(key)
      setTimeout(() => setSaveSuccess(null), 3000)
      setEditingKey(null)
      // Kirim WA ke ortu — fire and forget
      fetch('/api/wa/notify-report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: sessionId, student_id: studentId, materi: editForm.materi }) }).catch(() => {})
    }
    setSavingKey(null)
  }

  async function openModalLaporan(item: any) {
    setModalLaporan(item)
    setModalMsg(null)
    setModalForm({ materi: '', perkembangan: '', saranSiswa: '', saranOrtu: '', recordingUrl: '' })
    // Cek existing
    const { data } = await supabase.from('session_reports')
      .select('materi, perkembangan, saran_siswa, saran_ortu, recording_url')
      .eq('session_id', item.sessionId)
      .eq('student_id', item.studentId)
      .single()
    if (data) {
      setModalForm({
        materi:       data.materi ?? '',
        perkembangan: data.perkembangan ?? '',
        saranSiswa:   data.saran_siswa ?? '',
        saranOrtu:    data.saran_ortu ?? '',
        recordingUrl: data.recording_url ?? '',
      })
    }
  }

  async function saveModalLaporan() {
    if (!modalLaporan || !tutorId) return
    if (!modalForm.materi.trim()) { setModalMsg({ type: 'err', text: 'Materi tidak boleh kosong.' }); return }
    setModalSaving(true); setModalMsg(null)
    const { error } = await supabase.from('session_reports').upsert({
      session_id:    modalLaporan.sessionId,
      student_id:    modalLaporan.studentId,
      materi:        modalForm.materi || null,
      perkembangan:  modalForm.perkembangan || null,
      saran_siswa:   modalForm.saranSiswa || null,
      saran_ortu:    modalForm.saranOrtu || null,
      recording_url: modalForm.recordingUrl || null,
      recorded_by:   tutorId,
    }, { onConflict: 'session_id,student_id' })
    setModalSaving(false)
    if (error) { setModalMsg({ type: 'err', text: error.message }); return }
    // Update belumDiisi
    setBelumDiisi(prev => prev.filter(b => !(b.sessionId === modalLaporan.sessionId && b.studentId === modalLaporan.studentId)))
    setTimeline(prev => prev.map(t => t.sessionId === modalLaporan.sessionId && t.studentId === modalLaporan.studentId
      ? { ...t, materi: modalForm.materi, perkembangan: modalForm.perkembangan, saranOrtu: modalForm.saranOrtu, recordingUrl: modalForm.recordingUrl }
      : t
    ))
    // Kirim WA ke ortu — fire and forget
    fetch('/api/wa/notify-report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: modalLaporan.sessionId, student_id: modalLaporan.studentId, materi: modalForm.materi }) }).catch(() => {})
    setModalLaporan(null)
  }

  const TABS = [
    { id: 'ringkasan', label: 'Ringkasan', icon: <BarChart2 size={13}/> },
    { id: 'perkelas',  label: 'Per Kelas',  icon: <BookOpen size={13}/> },
    { id: 'timeline',  label: 'Timeline',   icon: <Clock size={13}/> },
  ] as const

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="text-sm text-[#7B78A8]">Memuat data...</div>
    </div>
  )

  return (
    <div>
      {/* Modal isi laporan */}
      {modalLaporan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E3FF] bg-[#F7F6FF] rounded-t-2xl">
              <div>
                <h3 className="font-bold text-[#1A1640] text-sm">Input Laporan Belajar</h3>
                <p className="text-xs text-[#7B78A8] mt-0.5">{modalLaporan.kelasLabel} · {modalLaporan.studentName} · {fmtDate(modalLaporan.scheduledAt)}</p>
              </div>
              <button onClick={() => setModalLaporan(null)} className="p-1.5 rounded-lg hover:bg-[#E5E3FF]">
                <X size={16} className="text-[#7B78A8]"/>
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              {[
                { field: 'materi' as keyof ReportForm, label: 'Materi yang Diajarkan *', placeholder: 'Contoh: Persamaan kuadrat...' },
                { field: 'perkembangan' as keyof ReportForm, label: 'Perkembangan Siswa', placeholder: 'Catatan perkembangan...' },
                { field: 'saranSiswa' as keyof ReportForm, label: 'Saran untuk Siswa', placeholder: 'Saran untuk siswa...' },
                { field: 'saranOrtu' as keyof ReportForm, label: 'Saran untuk Orang Tua', placeholder: 'Pesan untuk orang tua...' },
              ].map(({ field, label, placeholder }) => (
                <div key={field}>
                  <label className="block text-[10px] font-bold text-[#7B78A8] uppercase tracking-wide mb-1">{label}</label>
                  <textarea rows={2} placeholder={placeholder} value={modalForm[field]}
                    onChange={e => setModalForm(p => ({ ...p, [field]: e.target.value }))}
                    className={textareaCls} />
                </div>
              ))}
              <div>
                <label className="block text-[10px] font-bold text-[#7B78A8] uppercase tracking-wide mb-1">Link Rekaman <span className="normal-case font-normal">(opsional)</span></label>
                <input type="url" placeholder="https://drive.google.com/..." value={modalForm.recordingUrl}
                  onChange={e => setModalForm(p => ({ ...p, recordingUrl: e.target.value }))}
                  className="w-full px-3 py-2 border border-[#E5E3FF] rounded-xl text-xs bg-white text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] transition" />
              </div>
              {modalMsg && (
                <div className={`flex items-center gap-2 text-[11px] px-3 py-2 rounded-xl ${modalMsg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                  {modalMsg.type === 'ok' ? '✅' : '⚠️'} {modalMsg.text}
                </div>
              )}
              <button onClick={saveModalLaporan} disabled={modalSaving}
                className="w-full py-3 bg-[#5C4FE5] hover:bg-[#3D34C4] text-white font-bold rounded-xl text-sm transition disabled:opacity-50 flex items-center justify-center gap-2">
                <Save size={14}/>{modalSaving ? 'Menyimpan...' : 'Simpan Laporan'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-5">
        <h1 className="text-2xl font-black text-[#1A1640] font-['Sora']">Laporan Siswa</h1>
        <p className="text-sm text-[#7B78A8] mt-1">Rekap kehadiran dan laporan belajar</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-[#F0EFFF] p-1 rounded-xl w-fit">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); if (tab.id === 'perkelas' && !selectedKelas && kelasList.length > 0) selectKelas(kelasList.find(k => k.status === 'active') ?? kelasList[0]) }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === tab.id ? 'bg-[#5C4FE5] text-white shadow' : 'text-[#7B78A8] hover:text-[#1A1640]'
            }`}>
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {/* ══════ TAB RINGKASAN ══════ */}
      {activeTab === 'ringkasan' && (
        <div className="space-y-4">
          {loadingExtra ? (
            <div className="text-center py-12 text-sm text-[#7B78A8]">Memuat ringkasan...</div>
          ) : ringkasan ? (
            <>
              {/* Stats grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { num: ringkasan.kelasAktif,    lbl: 'Kelas Aktif',      color: 'bg-purple-50 text-[#5C4FE5]' },
                  { num: ringkasan.totalSiswa,    lbl: 'Total Siswa',      color: 'bg-blue-50 text-blue-600' },
                  { num: ringkasan.totalSesi,     lbl: 'Total Sesi',       color: 'bg-green-50 text-green-600' },
                  { num: `${ringkasan.pctHadir}%`, lbl: 'Rata-rata Hadir', color: 'bg-amber-50 text-amber-600' },
                ].map((s, i) => (
                  <div key={i} className="bg-white border border-[#E5E3FF] rounded-2xl p-4">
                    <div className={`text-2xl font-black mb-1 ${s.color.split(' ')[1]}`}>{s.num}</div>
                    <div className="text-xs text-[#7B78A8] font-semibold">{s.lbl}</div>
                  </div>
                ))}
              </div>

              {/* Laporan progress */}
              <div className="bg-white border border-[#E5E3FF] rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-sm text-[#1A1640]">Progress Laporan</h3>
                  <span className="text-xs text-[#7B78A8]">{ringkasan.totalLaporan} dari {ringkasan.totalHadir} sesi hadir</span>
                </div>
                <div className="w-full h-3 bg-[#E5E3FF] rounded-full overflow-hidden mb-2">
                  <div className="h-full rounded-full bg-[#5C4FE5] transition-all"
                    style={{ width: `${ringkasan.totalHadir > 0 ? Math.round(ringkasan.totalLaporan / ringkasan.totalHadir * 100) : 0}%` }} />
                </div>
                <p className="text-xs text-[#7B78A8]">
                  {ringkasan.totalHadir > 0 ? Math.round(ringkasan.totalLaporan / ringkasan.totalHadir * 100) : 0}% laporan sudah diisi
                </p>
              </div>

              {/* Laporan belum diisi */}
              {belumDiisi.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle size={15} className="text-amber-600"/>
                    <h3 className="font-bold text-sm text-amber-800">{belumDiisi.length} laporan belum diisi</h3>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {belumDiisi.map((item, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 bg-white rounded-xl px-3 py-2 border border-amber-100">
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold text-amber-900 truncate">{item.kelasLabel} · {item.studentName}</p>
                          <p className="text-[10px] text-amber-600">{fmtDate(item.scheduledAt)} · {item.jamLalu > 0 ? `${item.jamLalu} jam lalu` : 'Hari ini'}</p>
                        </div>
                        <button onClick={() => openModalLaporan(item)}
                          className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 bg-amber-500 text-white rounded-lg text-[10px] font-semibold hover:bg-amber-600 transition">
                          <Pencil size={10}/> Input
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {belumDiisi.length === 0 && ringkasan.totalSesi > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 flex items-center gap-2">
                  <span className="text-green-600 text-sm">✅</span>
                  <p className="text-sm font-semibold text-green-700">Semua laporan sudah diisi!</p>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-sm text-[#7B78A8]">Belum ada data</div>
          )}
        </div>
      )}

      {/* ══════ TAB PER KELAS ══════ */}
      {activeTab === 'perkelas' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Kolom kiri */}
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
                  {kelasList.filter(k => k.status === 'active').map((k: any) => {
                    const isSelected = selectedKelas?.id === k.id
                    return (
                      <button key={k.id} onClick={() => selectKelas(k)}
                        className={['w-full text-left px-4 py-3 transition-colors', isSelected ? 'bg-[#5C4FE5] text-white' : 'hover:bg-[#F7F6FF]'].join(' ')}>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: isSelected ? 'white' : (k.courses?.color ?? '#5C4FE5') }}/>
                          <div className="min-w-0">
                            <div className={`text-sm font-bold truncate ${isSelected ? 'text-white' : 'text-[#1A1640]'}`}>{k.label}</div>
                            <div className={`text-xs ${isSelected ? 'text-white/70' : 'text-[#7B78A8]'}`}>{k.courses?.name ?? '—'}</div>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                  {kelasList.filter(k => k.status === 'inactive').length > 0 && (
                    <>
                      <button onClick={() => setShowArsip(prev => !prev)}
                        className="w-full flex items-center gap-2 px-4 py-2.5 bg-gray-50 text-[#9B97B2] text-xs font-semibold hover:bg-gray-100 transition-colors">
                        <Archive size={12}/> Arsip Kelas
                        <span className="ml-1 bg-gray-200 text-gray-600 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                          {kelasList.filter(k => k.status === 'inactive').length}
                        </span>
                        <span className="ml-auto">{showArsip ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}</span>
                      </button>
                      {showArsip && kelasList.filter(k => k.status === 'inactive').map((k: any) => {
                        const isSelected = selectedKelas?.id === k.id
                        return (
                          <button key={k.id} onClick={() => selectKelas(k)}
                            className={['w-full text-left px-4 py-3 transition-colors', isSelected ? 'bg-[#5C4FE5] text-white' : 'hover:bg-[#F7F6FF]'].join(' ')}>
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full flex-shrink-0 opacity-50" style={{ background: isSelected ? 'white' : (k.courses?.color ?? '#5C4FE5') }}/>
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

          {/* Kolom kanan */}
          <div className="lg:col-span-2">
            {/* Filter tanggal */}
            {selectedKelas && (
              <div className="bg-white border border-[#E5E3FF] rounded-2xl px-4 py-3 mb-3 flex items-center gap-3 flex-wrap">
                <span className="text-xs font-bold text-[#7B78A8]">Filter tanggal:</span>
                <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
                  className="px-2.5 py-1.5 border border-[#E5E3FF] rounded-lg text-xs text-[#1A1640] focus:outline-none focus:border-[#5C4FE5]" />
                <span className="text-xs text-[#7B78A8]">s/d</span>
                <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)}
                  className="px-2.5 py-1.5 border border-[#E5E3FF] rounded-lg text-xs text-[#1A1640] focus:outline-none focus:border-[#5C4FE5]" />
                <button onClick={() => selectKelas(selectedKelas)}
                  className="px-3 py-1.5 bg-[#5C4FE5] text-white text-xs font-bold rounded-lg hover:bg-[#3D34C4] transition">
                  Terapkan
                </button>
                {(filterFrom || filterTo) && (
                  <button onClick={() => { setFilterFrom(''); setFilterTo(''); setTimeout(() => selectKelas(selectedKelas), 100) }}
                    className="px-3 py-1.5 border border-[#E5E3FF] text-[#7B78A8] text-xs font-bold rounded-lg hover:bg-[#F0EFFF] transition">
                    Reset
                  </button>
                )}
              </div>
            )}

            {!selectedKelas ? (
              <div className="bg-white rounded-2xl border border-[#E5E3FF] p-12 text-center flex flex-col items-center justify-center min-h-[300px]">
                <Users size={36} strokeWidth={1.5} className="text-[#C4BFFF] mb-3"/>
                <p className="text-sm font-semibold text-[#7B78A8]">Pilih kelas di sebelah kiri</p>
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
                  const laporanBelum = siswa.detailSesi.filter((s: any) => s.sessionStatus === 'completed' && s.absenStatus && !s.hasReport).length

                  return (
                    <div key={siswa.studentId} className="bg-white rounded-2xl border border-[#E5E3FF] overflow-hidden">
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
                            <div className="text-[10px] text-[#7B78A8]">
                              {siswa.hadir}/{siswa.completedCount ?? siswa.totalSesi} sesi selesai
                            </div>
                            {(siswa.totalSesi - (siswa.completedCount ?? siswa.totalSesi)) > 0 && (
                              <div className="text-[10px] text-amber-500 font-semibold">
                                +{siswa.totalSesi - (siswa.completedCount ?? siswa.totalSesi)} menunggu
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 flex-wrap mb-3">
                          <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-green-50 text-green-700">✓ {siswa.hadir} Hadir</span>
                          <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700">{siswa.izin} Izin</span>
                          <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-yellow-50 text-yellow-700">{siswa.sakit} Sakit</span>
                          <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-red-50 text-red-700">{siswa.alpha} Alpha</span>
                          {laporanBelum > 0 && (
                            <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700">✏ {laporanBelum} belum diisi</span>
                          )}
                        </div>
                        <div className="w-full h-2 bg-[#E5E3FF] rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-[#5C4FE5] transition-all"
                            style={{ width: `${typeof siswa.progressPct === 'number' ? siswa.progressPct : siswa.pctHadir}%` }}/>
                        </div>
                      </div>

                      <button onClick={() => toggleSiswa(siswa.studentId)}
                        className="w-full flex items-center justify-between px-5 py-3 border-t border-[#F0EFFF] hover:bg-[#F7F6FF] transition-colors">
                        <span className="text-[10px] font-bold text-[#7B78A8] uppercase tracking-widest">Detail per Sesi</span>
                        <span className="flex items-center gap-1 text-xs text-[#5C4FE5] font-semibold">
                          {siswa.totalSesi} sesi {isOpen ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
                        </span>
                      </button>

                      {isOpen && (
                        <div className="border-t border-[#F0EFFF] divide-y divide-[#F0EFFF]">
                          {siswa.detailSesi.map((sesi: any, i: number) => {
                            const key       = `${siswa.studentId}-${sesi.sessionId}`
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
                                    {sesi.absenNotes && <div className="text-[10px] text-[#7B78A8] mt-0.5 italic">"{sesi.absenNotes}"</div>}
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    {sesi.absenStatus ? (
                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLOR[sesi.absenStatus]}`}>
                                        {STATUS_LABEL[sesi.absenStatus]}
                                      </span>
                                    ) : (
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">Belum diabsen</span>
                                    )}
                                    {sesi.sessionStatus === 'completed' && sesi.absenStatus && !isEditing && (
                                      <button onClick={() => hasReport ? toggleSesi(key) : startEdit(key, { materi: sesi.materi, perkembangan: sesi.perkembangan, saranSiswa: sesi.saranSiswa, saranOrtu: sesi.saranOrtu, recordingUrl: sesi.recordingUrl })}
                                        className="flex items-center gap-1 text-[10px] font-semibold text-[#5C4FE5] hover:underline">
                                        {hasReport ? <><FileText size={11}/>{isSesiOpen ? 'Tutup' : 'Lihat'}</> : <><Pencil size={11}/>Isi</>}
                                      </button>
                                    )}
                                    {sesi.sessionStatus === 'completed' && hasReport && isSesiOpen && !isEditing && (
                                      <button onClick={() => startEdit(key, { materi: sesi.materi, perkembangan: sesi.perkembangan, saranSiswa: sesi.saranSiswa, saranOrtu: sesi.saranOrtu, recordingUrl: sesi.recordingUrl })}
                                        className="flex items-center gap-1 text-[10px] font-semibold text-[#5C4FE5] hover:underline">
                                        <Pencil size={11}/> Edit
                                      </button>
                                    )}
                                    {justSaved && <span className="text-[10px] font-bold text-green-600">✓ Tersimpan</span>}
                                  </div>
                                </div>
                                {isSesiOpen && hasReport && !isEditing && (
                                  <div className="mx-5 mb-3">
                                    <BilingualReport
                                      laporan={{
                                        materi:       sesi.materi,
                                        perkembangan: sesi.perkembangan,
                                        saranSiswa:   sesi.saranSiswa,
                                        saranOrtu:    sesi.saranOrtu,
                                        recordingUrl: sesi.recordingUrl,
                                      }}
                                      audience="tutor"
                                      defaultOpen={true}
                                    />
                                  </div>
                                )}
                                {isEditing && (
                                  <div className="mx-5 mb-3 bg-[#F7F6FF] rounded-xl border border-[#5C4FE5] p-4 space-y-3">
                                    <div className="flex items-center justify-between mb-1">
                                      <p className="text-[11px] font-bold text-[#5C4FE5] uppercase tracking-wide">{hasReport ? 'Edit Laporan' : 'Isi Laporan'}</p>
                                      <button onClick={cancelEdit} className="text-[#9B97B2] hover:text-red-500"><X size={14}/></button>
                                    </div>
                                    <LaporanEditor
                                      label="Materi"
                                      value={editForm.materi}
                                      onChange={v => setEditForm(prev => ({ ...prev, materi: v }))}
                                      placeholder="Contoh:&#10;---ID---&#10;* Grammar: Present Tense&#10;* Kosakata: hewan&#10;---EN---&#10;* Grammar: Present Tense&#10;* Vocabulary: animals"
                                      rows={5}
                                    />
                                    <LaporanEditor
                                      label="Perkembangan Siswa"
                                      value={editForm.perkembangan}
                                      onChange={v => setEditForm(prev => ({ ...prev, perkembangan: v }))}
                                      placeholder="Catatan perkembangan siswa..."
                                      rows={4}
                                    />
                                    <LaporanEditor
                                      label="Saran untuk Siswa"
                                      value={editForm.saranSiswa}
                                      onChange={v => setEditForm(prev => ({ ...prev, saranSiswa: v }))}
                                      placeholder="Saran latihan mandiri untuk siswa..."
                                      rows={3}
                                    />
                                    <LaporanEditor
                                      label="Saran untuk Orang Tua"
                                      value={editForm.saranOrtu}
                                      onChange={v => setEditForm(prev => ({ ...prev, saranOrtu: v }))}
                                      placeholder="Saran untuk orang tua mendampingi belajar..."
                                      rows={3}
                                    />
                                    <div>
                                      <label className="block text-[10px] font-bold text-[#7B78A8] uppercase tracking-wide mb-1">Link Rekaman <span className="normal-case font-normal">(opsional)</span></label>
                                      <input type="url" placeholder="https://drive.google.com/..." value={editForm.recordingUrl}
                                        onChange={e => setEditForm(prev => ({ ...prev, recordingUrl: e.target.value }))}
                                        className="w-full px-3 py-2 border border-[#E5E3FF] rounded-xl text-xs bg-white text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] transition" />
                                    </div>
                                    <button onClick={() => saveReport(siswa.studentId, sesi.sessionId, key)} disabled={isSaving}
                                      className="w-full py-2.5 bg-[#5C4FE5] hover:bg-[#3D34C4] text-white font-bold rounded-xl text-xs transition disabled:opacity-60 flex items-center justify-center gap-2">
                                      <Save size={13}/>{isSaving ? 'Menyimpan...' : 'Simpan Laporan'}
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
      )}

      {/* ══════ TAB TIMELINE ══════ */}
      {activeTab === 'timeline' && (
        <div>
          {loadingExtra ? (
            <div className="text-center py-12 text-sm text-[#7B78A8]">Memuat timeline...</div>
          ) : timeline.length === 0 ? (
            <div className="text-center py-12 text-sm text-[#7B78A8]">Belum ada laporan yang diisi</div>
          ) : (
            <div className="space-y-3">
              {timeline.map((item, idx) => {
                const avatarColor = AVATAR_COLORS[idx % AVATAR_COLORS.length]
                return (
                  <div key={`${item.sessionId}-${item.studentId}`}
                    className="bg-white border border-[#E5E3FF] rounded-2xl p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                        style={{ background: avatarColor.bg, color: avatarColor.text }}>
                        {getInitials(item.studentName)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-sm font-bold text-[#1A1640]">{item.studentName}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-[#EEEDFE] text-[#3C3489]">{item.kelasLabel}</span>
                          <span className="text-[10px] text-[#7B78A8]">{item.courseName}</span>
                        </div>
                        <p className="text-[10px] text-[#7B78A8] mb-2">
                          {fmtDate(item.scheduledAt)} · {fmtTime(item.scheduledAt)} WIT · {fmtRelative(item.createdAt)}
                        </p>
                        {item.materi && (
                          <div className="mb-1.5">
                            <span className="text-[9px] font-bold text-[#7B78A8] uppercase tracking-wider">Materi · </span>
                            <span className="text-xs text-[#1A1640]">{item.materi}</span>
                          </div>
                        )}
                        {item.perkembangan && (
                          <div className="mb-1.5">
                            <span className="text-[9px] font-bold text-[#7B78A8] uppercase tracking-wider">Perkembangan · </span>
                            <span className="text-xs text-[#1A1640]">{item.perkembangan}</span>
                          </div>
                        )}
                        {item.saranOrtu && (
                          <div className="mt-2 px-3 py-2 rounded-lg bg-[#F7F6FF] border-l-2 border-[#5C4FE5]">
                            <p className="text-[9px] font-bold text-[#7B78A8] uppercase tracking-wider mb-1">Saran untuk Ortu</p>
                            <p className="text-xs text-[#1A1640]">{item.saranOrtu}</p>
                          </div>
                        )}
                        {item.recordingUrl && (
                          <a href={item.recordingUrl} target="_blank" rel="noopener noreferrer"
                            className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[#5C4FE5] hover:underline">
                            ▶ Rekaman tersedia
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
              {timeline.length >= 20 && (
                <p className="text-center text-xs text-[#9B97B2] py-2">Menampilkan 20 laporan terbaru</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
