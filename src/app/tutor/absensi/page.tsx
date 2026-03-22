'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CalendarDays, Check, MessageCircle, AlertTriangle, Clock, FileText, X, Send } from 'lucide-react'

type StatusAbsen = 'hadir' | 'izin' | 'sakit' | 'alpha'

const STATUS_OPTIONS: { value: StatusAbsen; label: string; color: string; active: string }[] = [
  { value: 'hadir', label: 'Hadir', color: 'border-[#E5E3FF] text-[#4A4580] hover:border-green-400 hover:text-green-600',    active: 'border-green-500 bg-green-50 text-green-700 font-bold' },
  { value: 'izin',  label: 'Izin',  color: 'border-[#E5E3FF] text-[#4A4580] hover:border-blue-400 hover:text-blue-600',     active: 'border-blue-500 bg-blue-50 text-blue-700 font-bold' },
  { value: 'sakit', label: 'Sakit', color: 'border-[#E5E3FF] text-[#4A4580] hover:border-yellow-400 hover:text-yellow-600', active: 'border-yellow-500 bg-yellow-50 text-yellow-700 font-bold' },
  { value: 'alpha', label: 'Alpha', color: 'border-[#E5E3FF] text-[#4A4580] hover:border-red-400 hover:text-red-600',       active: 'border-red-500 bg-red-50 text-red-700 font-bold' },
]

const AVATAR_COLORS = [
  { bg: '#EEEDFE', text: '#3C3489' },
  { bg: '#E6F1FB', text: '#0C447C' },
  { bg: '#EAF3DE', text: '#3B6D11' },
  { bg: '#FAEEDA', text: '#633806' },
  { bg: '#FCEBEB', text: '#791F1F' },
  { bg: '#FBEAF0', text: '#72243E' },
]

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase()
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('id-ID', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jayapura'
  })
}
function fmtTanggal() {
  return new Date().toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jayapura'
  })
}
function getTodayWITRangeUTC() {
  const now = new Date()
  const today = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Jayapura' })
  const prevDateObj = new Date(today + 'T00:00:00+09:00')
  prevDateObj.setDate(prevDateObj.getDate() - 1)
  const prevDateStr = prevDateObj.toLocaleDateString('en-CA')
  return {
    startUtc: `${prevDateStr}T15:00:00+00:00`,
    endUtc:   `${today}T14:59:59+00:00`,
  }
}
function isSesiDimulai(scheduledAt: string): boolean {
  const nowWIT  = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jayapura' }))
  const sesiWIT = new Date(new Date(scheduledAt).toLocaleString('en-US', { timeZone: 'Asia/Jayapura' }))
  return nowWIT >= sesiWIT
}

// ── Countdown Badge ────────────────────────────────────────────────────────
function CountdownBadge({ scheduledAt, isSelected }: { scheduledAt: string; isSelected: boolean }) {
  const [diffMs, setDiffMs] = useState(() => new Date(scheduledAt).getTime() - Date.now())

  useEffect(() => {
    const interval = setInterval(() => {
      setDiffMs(new Date(scheduledAt).getTime() - Date.now())
    }, 1000)
    return () => clearInterval(interval)
  }, [scheduledAt])

  if (diffMs < -90 * 60 * 1000) return null
  if (diffMs > 3 * 60 * 60 * 1000) return null

  if (diffMs <= 0) {
    return (
      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-1 w-fit ${
        isSelected ? 'bg-white/20 text-white' : 'bg-green-100 text-green-700'
      }`}>
        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
        Berlangsung
      </span>
    )
  }

  const totalSec = Math.floor(diffMs / 1000)
  const jam      = Math.floor(totalSec / 3600)
  const menit    = Math.floor((totalSec % 3600) / 60)
  const detik    = totalSec % 60
  const pad      = (n: number) => String(n).padStart(2, '0')
  const label    = jam > 0 ? `${pad(jam)}:${pad(menit)}:${pad(detik)}` : `${pad(menit)}:${pad(detik)}`

  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-semibold w-fit ${
      isSelected ? 'bg-white/20 text-white' : 'bg-amber-50 text-amber-700 border border-amber-200'
    }`}>
      ⏱ {label}
    </span>
  )
}

// ── Modal Laporan Belajar ─────────────────────────────────────────────────
function ModalLaporan({
  sesi,
  onClose,
  onSaved,
}: {
  sesi: any
  onClose: () => void
  onSaved: () => void
}) {
  const supabase = createClient()
  const [form, setForm] = useState({
    materi:       '',
    perkembangan: '',
    saran_ortu:   '',
    recording_url: '',
  })
  const [loading, setLoading]   = useState(true)
  const [saving,  setSaving]    = useState(false)
  const [msg,     setMsg]       = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [siswaList, setSiswaList] = useState<any[]>([])
  const [selectedSiswa, setSelectedSiswa] = useState<string>('')

  useEffect(() => {
    async function load() {
      // Ambil siswa dari enrollments
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('student_id')
        .eq('class_group_id', sesi.class_groups.id)

      if (!enrollments || enrollments.length === 0) { setLoading(false); return }

      const studentIds = enrollments.map((e: any) => e.student_id)
      const { data: students } = await supabase
        .from('students').select('id, profile_id').in('id', studentIds)

      const profileIds = (students ?? []).map((s: any) => s.profile_id).filter(Boolean)
      const { data: profiles } = profileIds.length > 0
        ? await supabase.from('profiles').select('id, full_name').in('id', profileIds)
        : { data: [] }

      const profMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p.full_name]))
      const list = (students ?? []).map((s: any) => ({
        id:   s.id,
        name: profMap[s.profile_id] ?? 'Siswa',
      }))
      setSiswaList(list)

      // Default ke siswa pertama
      if (list.length > 0) {
        setSelectedSiswa(list[0].id)
        // Cek apakah sudah ada laporan
        const { data: existing } = await supabase
          .from('session_reports')
          .select('materi, perkembangan, saran_ortu, recording_url')
          .eq('session_id', sesi.id)
          .eq('student_id', list[0].id)
          .single()
        if (existing) {
          setForm({
            materi:        existing.materi ?? '',
            perkembangan:  existing.perkembangan ?? '',
            saran_ortu:    existing.saran_ortu ?? '',
            recording_url: existing.recording_url ?? '',
          })
        }
      }
      setLoading(false)
    }
    load()
  }, [sesi])

  async function loadLaporanSiswa(studentId: string) {
    setSelectedSiswa(studentId)
    setForm({ materi: '', perkembangan: '', saran_ortu: '', recording_url: '' })
    const { data: existing } = await supabase
      .from('session_reports')
      .select('materi, perkembangan, saran_ortu, recording_url')
      .eq('session_id', sesi.id)
      .eq('student_id', studentId)
      .single()
    if (existing) {
      setForm({
        materi:        existing.materi ?? '',
        perkembangan:  existing.perkembangan ?? '',
        saran_ortu:    existing.saran_ortu ?? '',
        recording_url: existing.recording_url ?? '',
      })
    }
  }

  async function handleSimpan() {
    if (!selectedSiswa) return
    if (!form.materi.trim()) { setMsg({ type: 'err', text: 'Materi tidak boleh kosong.' }); return }
    setSaving(true); setMsg(null)

    const { error } = await supabase
      .from('session_reports')
      .upsert({
        session_id:    sesi.id,
        student_id:    selectedSiswa,
        materi:        form.materi.trim(),
        perkembangan:  form.perkembangan.trim() || null,
        saran_ortu:    form.saran_ortu.trim() || null,
        recording_url: form.recording_url.trim() || null,
      }, { onConflict: 'session_id,student_id' })

    setSaving(false)
    if (error) { setMsg({ type: 'err', text: error.message }); return }
    setMsg({ type: 'ok', text: 'Laporan berhasil disimpan!' })
    onSaved()
  }

  const inputCls = "w-full px-3 py-2 border border-[#E5E3FF] rounded-xl text-xs bg-[#F7F6FF] text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] transition"
  const labelCls = "block text-[10px] font-bold text-[#7B78A8] uppercase tracking-wider mb-1"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E3FF] bg-[#F7F6FF] rounded-t-2xl">
          <div>
            <h3 className="font-bold text-[#1A1640] text-sm">Input Laporan Belajar</h3>
            <p className="text-xs text-[#7B78A8] mt-0.5">{sesi.class_groups?.label} · {fmtTime(sesi.scheduled_at)} WIT</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#E5E3FF] transition">
            <X size={16} className="text-[#7B78A8]"/>
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-[#7B78A8]">Memuat...</div>
        ) : siswaList.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#7B78A8]">Tidak ada siswa di kelas ini</div>
        ) : (
          <div className="px-5 py-4 flex flex-col gap-4">
            {/* Pilih siswa */}
            {siswaList.length > 1 && (
              <div>
                <label className={labelCls}>Siswa</label>
                <select value={selectedSiswa} onChange={e => loadLaporanSiswa(e.target.value)} className={inputCls}>
                  {siswaList.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className={labelCls}>Materi yang diajarkan *</label>
              <input
                type="text"
                value={form.materi}
                onChange={e => setForm(p => ({ ...p, materi: e.target.value }))}
                placeholder="Contoh: Persamaan kuadrat dan faktorisasi"
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Perkembangan siswa</label>
              <textarea
                value={form.perkembangan}
                onChange={e => setForm(p => ({ ...p, perkembangan: e.target.value }))}
                placeholder="Catatan perkembangan pemahaman siswa..."
                rows={3}
                className={inputCls + ' resize-none'}
              />
            </div>

            <div>
              <label className={labelCls}>Catatan / saran untuk orang tua</label>
              <textarea
                value={form.saran_ortu}
                onChange={e => setForm(p => ({ ...p, saran_ortu: e.target.value }))}
                placeholder="Pesan atau saran untuk orang tua siswa..."
                rows={3}
                className={inputCls + ' resize-none'}
              />
            </div>

            <div>
              <label className={labelCls}>Link rekaman Google Drive (opsional)</label>
              <input
                type="url"
                value={form.recording_url}
                onChange={e => setForm(p => ({ ...p, recording_url: e.target.value }))}
                placeholder="https://drive.google.com/..."
                className={inputCls}
              />
            </div>

            {msg && (
              <div className={`flex items-center gap-2 text-[11px] px-3 py-2 rounded-xl ${
                msg.type === 'ok' ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-600 border border-red-200'
              }`}>
                {msg.type === 'ok' ? '✅' : '⚠️'} {msg.text}
              </div>
            )}

            <button
              onClick={handleSimpan}
              disabled={saving}
              className="flex items-center justify-center gap-2 w-full py-3 bg-[#5C4FE5] hover:bg-[#3D34C4] text-white font-bold rounded-xl text-sm transition disabled:opacity-50">
              <Send size={14}/>
              {saving ? 'Menyimpan...' : 'Simpan Laporan'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function TutorAbsensiPage() {
  const supabase   = createClient()
  const adminPhone = (process.env.NEXT_PUBLIC_WA_NUMBER ?? '').replace(/\D/g, '')

  const [tutorId,        setTutorId]        = useState<string | null>(null)
  const [sesiHariIni,    setSesiHariIni]    = useState<any[]>([])
  const [selectedSesi,   setSelectedSesi]   = useState<any | null>(null)
  const [siswaList,      setSiswaList]      = useState<any[]>([])
  const [absensiMap,     setAbsensiMap]     = useState<Record<string, StatusAbsen>>({})
  const [notesMap,       setNotesMap]       = useState<Record<string, string>>({})
  const [savedSesiIds,   setSavedSesiIds]   = useState<Set<string>>(new Set())
  const [laporanSesiIds, setLaporanSesiIds] = useState<Set<string>>(new Set())
  const [reminderSesi,   setReminderSesi]   = useState<any[]>([])
  const [loading,        setLoading]        = useState(true)
  const [loadingSiswa,   setLoadingSiswa]   = useState(false)
  const [saving,         setSaving]         = useState(false)
  const [error,          setError]          = useState('')
  const [success,        setSuccess]        = useState('')
  const [showLaporan,    setShowLaporan]    = useState(false)

  useEffect(() => { fetchSesiHariIni() }, [])

  async function fetchSesiHariIni() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: tutor } = await supabase
      .from('tutors').select('id').eq('profile_id', user.id).single()
    if (!tutor?.id) { setLoading(false); return }
    setTutorId(tutor.id)

    const { startUtc, endUtc } = getTodayWITRangeUTC()

    const { data: sesi } = await supabase
      .from('sessions')
      .select(`id, scheduled_at, status, zoom_link, class_groups!inner(id, label, tutor_id, courses(name))`)
      .eq('class_groups.tutor_id', tutor.id)
      .gte('scheduled_at', startUtc)
      .lte('scheduled_at', endUtc)
      .order('scheduled_at')

    setSesiHariIni(sesi ?? [])

    if (sesi && sesi.length > 0) {
      const sesiIds = sesi.map((s: any) => s.id)

      // Cek absensi yang sudah ada
      const { data: existing } = await supabase
        .from('attendances').select('session_id').in('session_id', sesiIds)
      setSavedSesiIds(new Set((existing ?? []).map((a: any) => a.session_id)) as Set<string>)

      // Cek laporan yang sudah diisi
      const { data: reports } = await supabase
        .from('session_reports').select('session_id').in('session_id', sesiIds)
      setLaporanSesiIds(new Set((reports ?? []).map((r: any) => r.session_id)) as Set<string>)

      // Reminder: sesi completed > 5 jam tanpa laporan
      const completedSesi = (sesi ?? []).filter((s: any) => s.status === 'completed')
      const reminderList = completedSesi.filter((s: any) => {
        const hasLaporan = (reports ?? []).some((r: any) => r.session_id === s.id)
        if (hasLaporan) return false
        const diffJam = (Date.now() - new Date(s.scheduled_at).getTime()) / (1000 * 60 * 60)
        return diffJam >= 5
      })
      setReminderSesi(reminderList)
    }

    setLoading(false)
  }

  async function selectSesi(sesi: any) {
    setSelectedSesi(sesi)
    setAbsensiMap({})
    setNotesMap({})
    setError('')
    setSuccess('')
    setLoadingSiswa(true)

    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('id, student_id, session_start_offset, sessions_total')
      .eq('class_group_id', sesi.class_groups.id)

    if (!enrollments || enrollments.length === 0) {
      setSiswaList([]); setLoadingSiswa(false); return
    }

    const studentIds = enrollments.map((e: any) => e.student_id)
    const { data: students } = await supabase
      .from('students').select('id, profile_id, relation_phone').in('id', studentIds)

    const profileIds = (students ?? []).map((s: any) => s.profile_id).filter(Boolean)
    const { data: profiles } = profileIds.length > 0
      ? await supabase.from('profiles').select('id, full_name').in('id', profileIds)
      : { data: [] }

    const profMap    = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p.full_name]))
    const studentMap = Object.fromEntries((students ?? []).map((s: any) => [s.id, {
      name:  profMap[s.profile_id] ?? 'Siswa',
      phone: s.relation_phone ?? '',
    }]))

    const { data: existAbsen } = await supabase
      .from('attendances').select('student_id, status, notes').eq('session_id', sesi.id)

    const preAbsen: Record<string, StatusAbsen> = {}
    const preNotes: Record<string, string>      = {}
    ;(existAbsen ?? []).forEach((a: any) => {
      preAbsen[a.student_id] = a.status
      preNotes[a.student_id] = a.notes ?? ''
    })
    setAbsensiMap(preAbsen)
    setNotesMap(preNotes)

    const { data: completedSess } = await supabase
      .from('sessions').select('id')
      .eq('class_group_id', sesi.class_groups.id)
      .eq('status', 'completed')

    const completedIds = (completedSess ?? []).map((s: any) => s.id)
    const { data: hadirAtts } = completedIds.length > 0
      ? await supabase.from('attendances').select('student_id')
          .in('session_id', completedIds).eq('status', 'hadir')
      : { data: [] }

    const hadirPerSiswa: Record<string, number> = {}
    ;(hadirAtts ?? []).forEach((a: any) => {
      hadirPerSiswa[a.student_id] = (hadirPerSiswa[a.student_id] ?? 0) + 1
    })

    setSiswaList(enrollments.map((e: any) => ({
      studentId:    e.student_id,
      name:         studentMap[e.student_id]?.name ?? 'Siswa',
      phone:        studentMap[e.student_id]?.phone ?? '',
      sessionDone:  (e.session_start_offset ?? 0) + (hadirPerSiswa[e.student_id] ?? 0),
      sessionTotal: e.sessions_total ?? 8,
    })))

    setLoadingSiswa(false)
  }

  function setStatus(studentId: string, status: StatusAbsen) {
    setAbsensiMap(prev => ({ ...prev, [studentId]: status }))
  }
  function setNotes(studentId: string, val: string) {
    setNotesMap(prev => ({ ...prev, [studentId]: val }))
  }

  async function handleSimpan() {
    if (!selectedSesi || !tutorId) return
    if (siswaList.some(s => !absensiMap[s.studentId])) {
      setError('Lengkapi status absensi semua siswa terlebih dahulu.')
      return
    }
    if (!isSesiDimulai(selectedSesi.scheduled_at)) {
      setError('Kelas belum dimulai. Absensi bisa dilakukan saat jam kelas.')
      return
    }

    setSaving(true); setError(''); setSuccess('')

    const absenRecords = siswaList.map(s => ({
      session_id:  selectedSesi.id,
      student_id:  s.studentId,
      status:      absensiMap[s.studentId],
      notes:       notesMap[s.studentId] || null,
      recorded_by: tutorId,
    }))

    const { data: absenData, error: absenErr } = await supabase
      .from('attendances').upsert(absenRecords, { onConflict: 'session_id,student_id' })
      .select()
    if (absenErr) { setError(`Error: ${absenErr.message}`); setSaving(false); return }
    if (!absenData || absenData.length === 0) { setError('Absensi gagal disimpan. Coba lagi.'); setSaving(false); return }

    await supabase.from('sessions').update({ status: 'completed' }).eq('id', selectedSesi.id)

    setSavedSesiIds(prev => new Set([...prev, selectedSesi.id]))
    setSuccess('Absensi berhasil disimpan!')
    setSaving(false)
  }

  function buildWAAdmin(keterangan: string) {
    const sesiLabel = selectedSesi?.class_groups?.label ?? 'kelas'
    const waktu     = fmtTime(selectedSesi?.scheduled_at ?? '')
    return encodeURIComponent(`Halo Admin EduKazia, ada siswa ${keterangan} di sesi ${sesiLabel} pukul ${waktu} WIT. Mohon ditindaklanjuti. Terima kasih.`)
  }

  function buildWAAdminSiswa(siswa: any) {
    const status     = absensiMap[siswa.studentId]
    const sesiLabel  = selectedSesi?.class_groups?.label ?? 'kelas'
    const waktu      = fmtTime(selectedSesi?.scheduled_at ?? '')
    const statusText = status === 'izin' ? 'izin' : 'sakit'
    const notes      = notesMap[siswa.studentId] ? ` Keterangan: ${notesMap[siswa.studentId]}.` : ''
    return encodeURIComponent(`Halo Admin EduKazia, siswa ${siswa.name} ${statusText} pada sesi ${sesiLabel} pukul ${waktu} WIT.${notes} Mohon ditindaklanjuti. Terima kasih.`)
  }

  const statusColor: Record<string, string> = {
    scheduled: 'bg-blue-50 text-blue-700', completed: 'bg-green-50 text-green-700',
    cancelled: 'bg-red-50 text-red-700', rescheduled: 'bg-yellow-50 text-yellow-700',
  }
  const statusSesiLabel: Record<string, string> = {
    scheduled: 'Terjadwal', completed: 'Selesai', cancelled: 'Dibatalkan', rescheduled: 'Reschedule'
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="text-sm text-[#7B78A8]">Memuat sesi hari ini...</div>
    </div>
  )

  return (
    <div>
      {/* Modal Laporan */}
      {showLaporan && selectedSesi && (
        <ModalLaporan
          sesi={selectedSesi}
          onClose={() => setShowLaporan(false)}
          onSaved={() => {
            setLaporanSesiIds(prev => new Set([...prev, selectedSesi.id]))
            // Hapus dari reminder jika ada
            setReminderSesi(prev => prev.filter(s => s.id !== selectedSesi.id))
          }}
        />
      )}

      <div className="mb-4">
        <h1 className="text-2xl font-black text-[#1A1640] font-['Sora']">Absensi</h1>
        <p className="text-sm text-[#7B78A8] mt-1">{fmtTanggal()}</p>
      </div>

      {/* ── Banner Reminder Laporan Belum Diisi > 5 jam ── */}
      {reminderSesi.length > 0 && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={15} className="text-amber-600 flex-shrink-0"/>
            <p className="text-[12px] font-bold text-amber-800">Laporan belajar belum diisi!</p>
          </div>
          <div className="flex flex-col gap-1.5">
            {reminderSesi.map((s: any) => {
              const jamLalu = Math.floor((Date.now() - new Date(s.scheduled_at).getTime()) / (1000 * 60 * 60))
              return (
                <div key={s.id} className="flex items-center justify-between gap-3 bg-white rounded-xl px-3 py-2 border border-amber-100">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-amber-900 truncate">{s.class_groups?.label ?? '—'}</p>
                    <p className="text-[10px] text-amber-600">Sudah {jamLalu} jam sejak sesi selesai</p>
                  </div>
                  <button
                    onClick={() => { setSelectedSesi(s); setShowLaporan(true) }}
                    className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 bg-amber-500 text-white rounded-lg text-[10px] font-semibold hover:bg-amber-600 transition">
                    <FileText size={11}/>
                    Input Sekarang
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ── Panel Kiri: Daftar Sesi ── */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-[#E5E3FF] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#E5E3FF]">
              <h2 className="font-bold text-sm text-[#1A1640]">Sesi Hari Ini</h2>
            </div>
            {sesiHariIni.length === 0 ? (
              <div className="p-6 text-center">
                <CalendarDays size={28} strokeWidth={1.5} className="text-[#C4BFFF] mx-auto mb-2"/>
                <p className="text-xs text-[#7B78A8] font-semibold">Tidak ada sesi hari ini</p>
              </div>
            ) : (
              <div className="divide-y divide-[#F0EFFF]">
                {sesiHariIni.map((s: any) => {
                  const isSelected  = selectedSesi?.id === s.id
                  const isDone      = savedSesiIds.has(s.id)
                  const hasLaporan  = laporanSesiIds.has(s.id)
                  return (
                    <button key={s.id} onClick={() => selectSesi(s)}
                      className={['w-full text-left px-4 py-3 transition-colors', isSelected ? 'bg-[#5C4FE5] text-white' : 'hover:bg-[#F7F6FF]'].join(' ')}>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="min-w-0">
                          <div className={`text-sm font-bold truncate ${isSelected ? 'text-white' : 'text-[#1A1640]'}`}>
                            {s.class_groups?.label ?? '—'}
                          </div>
                          <div className={`text-xs mt-0.5 ${isSelected ? 'text-white/70' : 'text-[#7B78A8]'}`}>
                            {fmtTime(s.scheduled_at)} WIT · {s.class_groups?.courses?.name ?? '—'}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {isDone && (
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center ${isSelected ? 'bg-white/20' : 'bg-green-100'}`}>
                              <Check size={11} className={isSelected ? 'text-white' : 'text-green-600'}/>
                            </div>
                          )}
                          {hasLaporan && (
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center ${isSelected ? 'bg-white/20' : 'bg-purple-100'}`}>
                              <FileText size={11} className={isSelected ? 'text-white' : 'text-purple-600'}/>
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Countdown */}
                      <CountdownBadge scheduledAt={s.scheduled_at} isSelected={isSelected} />
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Panel Kanan: Absensi ── */}
        <div className="lg:col-span-2">
          {!selectedSesi ? (
            <div className="bg-white rounded-2xl border border-[#E5E3FF] p-12 text-center flex flex-col items-center justify-center min-h-[300px]">
              <CalendarDays size={36} strokeWidth={1.5} className="text-[#C4BFFF] mb-3"/>
              <p className="text-sm font-semibold text-[#7B78A8]">Pilih sesi di sebelah kiri</p>
              <p className="text-xs text-[#7B78A8] mt-1">untuk mulai mencatat absensi</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#E5E3FF] overflow-hidden">
              {/* Header sesi */}
              <div className="px-5 py-4 border-b border-[#E5E3FF] bg-[#F7F6FF]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-bold text-[#1A1640]">{selectedSesi.class_groups?.label}</h2>
                    <p className="text-xs text-[#7B78A8] mt-0.5">{fmtTime(selectedSesi.scheduled_at)} WIT · {selectedSesi.class_groups?.courses?.name}</p>
                  </div>
                  {adminPhone && (
                    <a href={`https://wa.me/${adminPhone}?text=${buildWAAdmin('belum hadir setelah 3 menit sesi dimulai')}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-2 bg-[#5C4FE5] hover:bg-[#3D34C4] text-white rounded-xl text-xs font-semibold transition flex-shrink-0">
                      <AlertTriangle size={13}/><MessageCircle size={13}/> Laporkan ke Admin
                    </a>
                  )}
                </div>
                <p className="text-[10px] text-[#7B78A8] mt-2 italic">
                  Gunakan tombol "Laporkan ke Admin" jika ada siswa yang belum hadir setelah 3 menit sesi dimulai.
                </p>
              </div>

              {/* Banner belum mulai */}
              {!isSesiDimulai(selectedSesi.scheduled_at) && (
                <div className="mx-4 mt-4 flex items-center gap-3 px-4 py-3 bg-yellow-50 border border-yellow-200 rounded-xl">
                  <Clock size={16} className="text-yellow-600 flex-shrink-0"/>
                  <div>
                    <p className="text-[12px] font-bold text-yellow-800">Kelas belum dimulai</p>
                    <p className="text-[11px] text-yellow-600 mt-0.5">Absensi bisa dilakukan mulai pukul {fmtTime(selectedSesi.scheduled_at)} WIT</p>
                  </div>
                </div>
              )}

              {loadingSiswa ? (
                <div className="p-8 text-center text-sm text-[#7B78A8]">Memuat daftar siswa...</div>
              ) : siswaList.length === 0 ? (
                <div className="p-8 text-center text-sm text-[#7B78A8]">Belum ada siswa terdaftar di kelas ini</div>
              ) : (
                <>
                  <div className="divide-y divide-[#F0EFFF]">
                    {siswaList.map((s, idx) => {
                      const currentStatus = absensiMap[s.studentId]
                      const avatarColor   = AVATAR_COLORS[idx % AVATAR_COLORS.length]
                      const isIzinSakit   = currentStatus === 'izin' || currentStatus === 'sakit'
                      const canAbsen      = isSesiDimulai(selectedSesi.scheduled_at)
                      return (
                        <div key={s.studentId} className="px-5 py-4">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                              style={{ background: avatarColor.bg, color: avatarColor.text }}>
                              {getInitials(s.name)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-[#1A1640]">{s.name}</div>
                              <div className="text-xs text-[#7B78A8]">Sesi {s.sessionDone}/{s.sessionTotal}</div>
                            </div>
                            {/* Izin/sakit → WA Admin (bukan WA Ortu) */}
                            {isIzinSakit && adminPhone && canAbsen && (
                              <a href={`https://wa.me/${adminPhone}?text=${buildWAAdminSiswa(s)}`}
                                target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl text-xs font-semibold hover:bg-amber-100 transition flex-shrink-0">
                                <MessageCircle size={12}/> WA Admin
                              </a>
                            )}
                          </div>
                          <div className={`flex gap-2 flex-wrap mb-3 ${!canAbsen ? 'opacity-40 pointer-events-none' : ''}`}>
                            {STATUS_OPTIONS.map(opt => (
                              <button key={opt.value} onClick={() => setStatus(s.studentId, opt.value)} disabled={!canAbsen}
                                className={['px-3 py-1.5 rounded-xl text-xs border transition-all', currentStatus === opt.value ? opt.active : opt.color].join(' ')}>
                                {opt.label}
                              </button>
                            ))}
                          </div>
                          {isIzinSakit && canAbsen && (
                            <input type="text" placeholder="Keterangan izin/sakit (opsional)..."
                              value={notesMap[s.studentId] ?? ''}
                              onChange={e => setNotes(s.studentId, e.target.value)}
                              className="w-full px-3 py-2 border border-[#E5E3FF] rounded-xl text-xs bg-[#F7F6FF] text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] transition"
                            />
                          )}
                        </div>
                      )
                    })}
                  </div>

                  <div className="px-5 py-4 border-t border-[#E5E3FF] bg-[#F7F6FF] flex flex-col gap-3">
                    {error   && <p className="text-xs text-red-600 font-semibold">{error}</p>}
                    {success && <p className="text-xs text-green-600 font-semibold">✅ {success}</p>}

                    <button onClick={handleSimpan}
                      disabled={saving || !isSesiDimulai(selectedSesi.scheduled_at)}
                      className="w-full py-3 bg-[#5C4FE5] hover:bg-[#3D34C4] text-white font-bold rounded-xl text-sm transition disabled:opacity-50 disabled:cursor-not-allowed">
                      {saving ? 'Menyimpan...' : 'Simpan Absensi'}
                    </button>

                    {!isSesiDimulai(selectedSesi.scheduled_at) && (
                      <p className="text-[11px] text-[#9B97B2] text-center">
                        Tombol aktif saat kelas dimulai pukul {fmtTime(selectedSesi.scheduled_at)} WIT
                      </p>
                    )}

                    {/* Tombol Input/Lihat Laporan — inline modal */}
                    <button
                      onClick={() => setShowLaporan(true)}
                      className="w-full py-2.5 border border-[#5C4FE5] text-[#5C4FE5] font-bold rounded-xl text-sm transition hover:bg-[#EAE8FD] flex items-center justify-center gap-2">
                      <FileText size={14}/>
                      {laporanSesiIds.has(selectedSesi.id) ? 'Lihat / Edit Laporan Belajar' : 'Input Laporan Belajar'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
