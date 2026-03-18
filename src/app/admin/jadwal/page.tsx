'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft, ChevronRight, Plus, X, Check, Pencil, Trash2, ExternalLink, Minus, ChevronDown, ChevronUp, Users } from 'lucide-react'

type Session = {
  id: string
  class_group_id: string
  scheduled_at: string
  status: string
  zoom_link: string | null
  class_group?: { label: string; tutor_name: string; course_name: string; color: string }
}

type ClassGroup = { id: string; label: string; tutor_id: string; course_id: string }

type SiswaItem = {
  id: string
  name: string
  sessionsTotal: number
  sessionStartOffset: number
  sessionNumber: number  // calculated: urutan sesi ini untuk siswa tsb
}

type JadwalRow = { date: string; time: string; repeat: number }

const STATUS_MAP: Record<string, { label: string; pill: string }> = {
  scheduled:   { label: 'Terjadwal',      pill: 'bg-[#EEEDFE] text-[#3C3489]' },
  completed:   { label: 'Selesai',        pill: 'bg-[#E6F4EC] text-[#1A5C36]' },
  cancelled:   { label: 'Dibatalkan',     pill: 'bg-[#FEE9E9] text-[#991B1B]' },
  rescheduled: { label: 'Dijadwal Ulang', pill: 'bg-[#FEF3E2] text-[#92400E]' },
}

const COURSE_COLORS  = ['#5C4FE5','#27A05A','#D97706','#DC2626','#0891B2','#7C3AED']
const AVATAR_COLORS  = ['#5C4FE5','#27A05A','#D97706','#DC2626','#0891B2','#7C3AED','#BE185D','#065F46','#92400E','#1E40AF']
const MAX_ROWS   = 5
const MAX_REPEAT = 16
const DAY_NAMES  = ['Sen','Sel','Rab','Kam','Jum','Sab','Min']

function getWeekDates(base: Date) {
  const day = base.getDay()
  const monday = new Date(base)
  monday.setDate(base.getDate() - (day === 0 ? 6 : day - 1))
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d })
}
function fmtDate(d: Date) { return d.toISOString().split('T')[0] }
function fmtTime(iso: string) { return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }) }
function fmtDayLabel(d: Date) { return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) }
function getInitials(name: string) { return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase() }
function generateSessions(row: JadwalRow): string[] {
  return Array.from({ length: row.repeat }, (_, i) => {
    const d = new Date(`${row.date}T${row.time}:00`)
    d.setDate(d.getDate() + i * 7)
    return d.toISOString()
  })
}

export default function JadwalPage() {
  const supabase = createClient()

  const [sessions, setSessions]         = useState<Session[]>([])
  const [classGroups, setClassGroups]   = useState<ClassGroup[]>([])
  const [weekBase, setWeekBase]         = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(fmtDate(new Date()))
  const [loading, setLoading]           = useState(true)

  const [expandedId, setExpandedId]     = useState<string | null>(null)
  const [siswaMap, setSiswaMap]         = useState<Record<string, SiswaItem[]>>({})
  const [loadingSiswa, setLoadingSiswa] = useState<string | null>(null)

  const [showModal, setShowModal]     = useState(false)
  const [editSession, setEditSession] = useState<Session | null>(null)
  const [delConfirm, setDelConfirm]   = useState<string | null>(null)
  const [saving, setSaving]           = useState(false)
  const [formError, setFormError]     = useState('')

  const [fClassGroup, setFClassGroup] = useState('')
  const [fStatus, setFStatus]         = useState('scheduled')
  const [fZoom, setFZoom]             = useState('')
  const [fDate, setFDate]             = useState(fmtDate(new Date()))
  const [fTime, setFTime]             = useState('08:00')
  const [jadwalRows, setJadwalRows]   = useState<JadwalRow[]>([{ date: fmtDate(new Date()), time: '08:00', repeat: 1 }])

  const weekDates  = getWeekDates(weekBase)
  const isEditMode = !!editSession
  const totalSesi  = jadwalRows.reduce((acc, r) => acc + r.repeat, 0)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const start = new Date(weekBase); start.setMonth(start.getMonth() - 1)
    const end   = new Date(weekBase); end.setMonth(end.getMonth() + 2)

    const { data: sess } = await supabase
      .from('sessions')
      .select('id, class_group_id, scheduled_at, status, zoom_link')
      .gte('scheduled_at', start.toISOString())
      .lte('scheduled_at', end.toISOString())
      .order('scheduled_at', { ascending: true })

    const { data: cg } = await supabase.from('class_groups').select('id, label, tutor_id, course_id')
    const cgList = (cg ?? []) as ClassGroup[]
    setClassGroups(cgList)

    const tutorIds = [...new Set(cgList.map(c => c.tutor_id).filter(Boolean))]
    let tutorMap: Record<string, string> = {}
    if (tutorIds.length > 0) {
      const { data: tutors } = await supabase.from('tutors').select('id, profile_id').in('id', tutorIds)
      const profIds = (tutors ?? []).map((t: any) => t.profile_id).filter(Boolean)
      if (profIds.length > 0) {
        const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', profIds)
        const profMap = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.full_name]))
        tutorMap = Object.fromEntries((tutors ?? []).map((t: any) => [t.id, profMap[t.profile_id] ?? 'Tutor']))
      }
    }

    const courseIds = [...new Set(cgList.map(c => c.course_id).filter(Boolean))]
    let courseMap: Record<string, string> = {}
    const courseColorMap: Record<string, string> = {}
    if (courseIds.length > 0) {
      const { data: courses } = await supabase.from('courses').select('id, name').in('id', courseIds)
      courseMap = Object.fromEntries((courses ?? []).map((c: any) => [c.id, c.name]))
      courseIds.forEach((id, i) => { courseColorMap[id] = COURSE_COLORS[i % COURSE_COLORS.length] })
    }

    const cgMap = Object.fromEntries(cgList.map(c => [c.id, {
      label: c.label,
      tutor_name: tutorMap[c.tutor_id] ?? '—',
      course_name: courseMap[c.course_id] ?? '—',
      color: courseColorMap[c.course_id] ?? '#5C4FE5',
    }]))

    setSessions((sess ?? []).map((s: any) => ({ ...s, class_group: cgMap[s.class_group_id] })))
    setLoading(false)
  }

  // ── Fetch siswa dengan perhitungan sesi ke-X dari Y ──
  async function fetchSiswa(session: Session) {
    const sid = session.id
    if (siswaMap[sid]) { setExpandedId(prev => prev === sid ? null : sid); return }

    setLoadingSiswa(sid)
    setExpandedId(sid)

    // 1. Ambil semua sessions untuk class_group ini, urut by scheduled_at
    const { data: allSessions } = await supabase
      .from('sessions')
      .select('id, scheduled_at')
      .eq('class_group_id', session.class_group_id)
      .order('scheduled_at', { ascending: true })

    // Urutan sesi ini (1-based)
    const sessionOrder = (allSessions ?? []).findIndex((s: any) => s.id === sid) + 1

    // 2. Ambil enrollments untuk class_group ini
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('id, student_id, sessions_total, session_start_offset')
      .eq('class_group_id', session.class_group_id)

    if (!enrollments || enrollments.length === 0) {
      setSiswaMap(prev => ({ ...prev, [sid]: [] }))
      setLoadingSiswa(null)
      return
    }

    // 3. Ambil nama siswa
    const studentIds = enrollments.map((e: any) => e.student_id).filter(Boolean)
    const { data: students } = await supabase.from('students').select('id, profile_id').in('id', studentIds)
    const profIds = (students ?? []).map((s: any) => s.profile_id).filter(Boolean)
    let nameMap: Record<string, string> = {}
    if (profIds.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', profIds)
      const profMap = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.full_name]))
      nameMap = Object.fromEntries((students ?? []).map((s: any) => [s.id, profMap[s.profile_id] ?? 'Siswa']))
    }

    // 4. Merge + hitung sessionNumber
    const merged: SiswaItem[] = enrollments.map((e: any) => {
      const offset      = e.session_start_offset ?? 1
      const sessionNum  = sessionOrder + (offset - 1)
      return {
        id:                 e.student_id,
        name:               nameMap[e.student_id] ?? 'Siswa',
        sessionsTotal:      e.sessions_total ?? 8,
        sessionStartOffset: offset,
        sessionNumber:      sessionNum,
      }
    })

    setSiswaMap(prev => ({ ...prev, [sid]: merged }))
    setLoadingSiswa(null)
  }

  const sessionsOnDate   = (date: string) => sessions.filter(s => fmtDate(new Date(s.scheduled_at)) === date)
  const selectedSessions = sessionsOnDate(selectedDate)

  function addRow() {
    if (jadwalRows.length >= MAX_ROWS) return
    const last = jadwalRows[jadwalRows.length - 1]
    const next = new Date(`${last.date}T00:00:00`); next.setDate(next.getDate() + 7)
    setJadwalRows(prev => [...prev, { date: fmtDate(next), time: last.time, repeat: 1 }])
  }
  function removeRow(idx: number) { setJadwalRows(prev => prev.filter((_, i) => i !== idx)) }
  function updateRow(idx: number, field: keyof JadwalRow, value: string | number) {
    setJadwalRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r))
  }

  function openAdd() {
    setEditSession(null); setFClassGroup(classGroups[0]?.id ?? ''); setFStatus('scheduled')
    setFZoom(''); setJadwalRows([{ date: selectedDate, time: '08:00', repeat: 1 }]); setFormError(''); setShowModal(true)
  }
  function openEdit(s: Session) {
    setEditSession(s); setFClassGroup(s.class_group_id)
    const dt = new Date(s.scheduled_at)
    setFDate(fmtDate(dt)); setFTime(dt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }))
    setFStatus(s.status); setFZoom(s.zoom_link ?? ''); setFormError(''); setShowModal(true)
  }

  async function handleSave() {
    if (!fClassGroup) { setFormError('Pilih kelas terlebih dahulu.'); return }
    setSaving(true); setFormError('')
    if (isEditMode && editSession) {
      const { error } = await supabase.from('sessions').update({
        class_group_id: fClassGroup,
        scheduled_at: new Date(`${fDate}T${fTime}:00`).toISOString(),
        status: fStatus, zoom_link: fZoom || null,
      }).eq('id', editSession.id)
      if (error) { setFormError(error.message); setSaving(false); return }
    } else {
      const all: any[] = []
      for (const row of jadwalRows) {
        if (!row.date || !row.time) continue
        for (const scheduled_at of generateSessions(row)) {
          all.push({ class_group_id: fClassGroup, scheduled_at, status: fStatus, zoom_link: fZoom || null })
        }
      }
      if (all.length === 0) { setFormError('Isi minimal satu jadwal.'); setSaving(false); return }
      const { error } = await supabase.from('sessions').insert(all)
      if (error) { setFormError(error.message); setSaving(false); return }
    }
    // Reset cached siswa for affected class
    setSiswaMap(prev => { const n = {...prev}; delete n[editSession?.id ?? '']; return n })
    setSaving(false); setShowModal(false); fetchAll()
  }

  async function handleDelete(id: string) {
    await supabase.from('sessions').delete().eq('id', id)
    setDelConfirm(null); fetchAll()
  }
  async function markComplete(id: string) {
    await supabase.from('sessions').update({ status: 'completed' }).eq('id', id); fetchAll()
  }

  const inputCls = "w-full px-3.5 py-2.5 border border-[#E5E3FF] rounded-xl text-sm bg-[#F7F6FF] text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] transition"

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-[#1A1640]" style={{ fontFamily: 'Sora, sans-serif' }}>Jadwal</h1>
          <p className="text-sm text-[#7B78A8] mt-0.5">Kelola sesi kelas mingguan</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 bg-[#5C4FE5] text-white text-sm font-semibold rounded-xl hover:bg-[#3D34C4] transition active:scale-95">
          <Plus size={15} /> Tambah Sesi
        </button>
      </div>

      {/* Week strip */}
      <div className="bg-white rounded-2xl border border-[#E5E3FF] p-4 mb-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => { const d = new Date(weekBase); d.setDate(d.getDate()-7); setWeekBase(d) }} className="p-2 rounded-lg hover:bg-[#F7F6FF] text-[#5C4FE5] transition"><ChevronLeft size={18}/></button>
          <span className="text-sm font-semibold text-[#1A1640]">
            {weekDates[0].toLocaleDateString('id-ID',{day:'numeric',month:'long'})} – {weekDates[6].toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})}
          </span>
          <button onClick={() => { const d = new Date(weekBase); d.setDate(d.getDate()+7); setWeekBase(d) }} className="p-2 rounded-lg hover:bg-[#F7F6FF] text-[#5C4FE5] transition"><ChevronRight size={18}/></button>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {weekDates.map((d, i) => {
            const key = fmtDate(d); const isToday = key === fmtDate(new Date()); const isSelected = key === selectedDate; const count = sessionsOnDate(key).length
            return (
              <button key={key} onClick={() => { setSelectedDate(key); setExpandedId(null) }}
                className={['flex flex-col items-center py-2.5 px-1 rounded-xl border transition-all',
                  isSelected?'bg-[#5C4FE5] border-[#5C4FE5]':isToday?'bg-[#F0EEFF] border-[#C4BFFF]':'bg-[#F7F6FF] border-[#E5E3FF] hover:border-[#C4BFFF]'].join(' ')}>
                <span className={`text-[10px] font-semibold mb-1 ${isSelected?'text-white/70':'text-[#7B78A8]'}`}>{DAY_NAMES[i]}</span>
                <span className={`text-sm font-bold ${isSelected?'text-white':isToday?'text-[#5C4FE5]':'text-[#1A1640]'}`}>{d.getDate()}</span>
                {count > 0
                  ? <div className="flex gap-0.5 mt-1.5">{Array.from({length:Math.min(count,3)}).map((_,j)=><div key={j} className={`w-1.5 h-1.5 rounded-full ${isSelected?'bg-white':'bg-[#5C4FE5]'}`}/>)}</div>
                  : <div className="h-3.5 mt-1"/>}
              </button>
            )
          })}
        </div>
      </div>

      {/* Session list */}
      <div className="bg-white rounded-2xl border border-[#E5E3FF] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#E5E3FF] bg-[#F7F6FF]">
          <span className="text-xs font-bold uppercase tracking-wider text-[#7B78A8]">{fmtDayLabel(new Date(selectedDate+'T00:00:00'))}</span>
        </div>
        {loading ? (
          <div className="px-5 py-12 text-center text-sm text-[#7B78A8]">Memuat jadwal...</div>
        ) : selectedSessions.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <div className="text-3xl mb-3">📅</div>
            <p className="text-sm font-semibold text-[#7B78A8]">Tidak ada sesi pada hari ini</p>
            <button onClick={openAdd} className="mt-3 text-sm text-[#5C4FE5] font-semibold hover:underline">+ Tambah sesi baru</button>
          </div>
        ) : (
          selectedSessions.map((s, idx) => {
            const st = STATUS_MAP[s.status] ?? { label: s.status, pill: 'bg-gray-100 text-gray-600' }
            const isExpanded = expandedId === s.id
            const siswaList  = siswaMap[s.id] ?? []
            const isLoading  = loadingSiswa === s.id
            const isLast     = idx === selectedSessions.length - 1
            return (
              <div key={s.id} className={!isLast || isExpanded ? 'border-b border-[#E5E3FF]' : ''}>
                <div className={`flex items-center gap-4 px-5 py-4 transition-colors ${isExpanded?'bg-[#F0EEFF] border-l-4 border-l-[#5C4FE5]':'hover:bg-[#F7F6FF]'}`}>
                  <div className="min-w-[44px] text-sm font-bold text-[#5C4FE5]">{fmtTime(s.scheduled_at)}</div>
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{backgroundColor: s.class_group?.color ?? '#5C4FE5'}}/>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-[#1A1640] truncate">{s.class_group?.label ?? '—'}</div>
                    <div className="text-xs text-[#7B78A8] mt-0.5">{s.class_group?.tutor_name} · {s.class_group?.course_name}</div>
                  </div>
                  {s.zoom_link && <a href={s.zoom_link} target="_blank" rel="noopener noreferrer" className="text-[#5C4FE5] hover:opacity-70 transition"><ExternalLink size={14}/></a>}
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${st.pill}`}>{st.label}</span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => fetchSiswa(s)}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${isExpanded?'bg-[#5C4FE5] text-white':'bg-[#F0EEFF] text-[#5C4FE5] hover:bg-[#E0DCFF]'}`}>
                      <Users size={12}/>{isExpanded?<ChevronUp size={12}/>:<ChevronDown size={12}/>}
                    </button>
                    {s.status === 'scheduled' && (
                      <button onClick={() => markComplete(s.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition" title="Tandai Selesai"><Check size={14}/></button>
                    )}
                    <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg text-gray-400 hover:text-[#5C4FE5] hover:bg-[#F0EEFF] transition"><Pencil size={14}/></button>
                    <button onClick={() => setDelConfirm(s.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition"><Trash2 size={14}/></button>
                  </div>
                </div>

                {/* Expand panel */}
                {isExpanded && (
                  <div className="px-5 py-4 bg-[#F7F6FF] border-t border-[#E5E3FF]">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#7B78A8] mb-3">
                      Siswa terdaftar{siswaList.length > 0 && <span className="ml-1 normal-case font-normal">({siswaList.length} siswa)</span>}
                    </p>
                    {isLoading ? (
                      <p className="text-sm text-[#7B78A8]">Memuat data siswa...</p>
                    ) : siswaList.length === 0 ? (
                      <p className="text-sm text-[#7B78A8]">Belum ada siswa terdaftar di kelas ini.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {siswaList.map((siswa, si) => (
                          <div key={siswa.id} className="flex items-center gap-2.5 bg-white border border-[#E5E3FF] rounded-xl px-3 py-2.5">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                              style={{backgroundColor: AVATAR_COLORS[si % AVATAR_COLORS.length]}}>
                              {getInitials(siswa.name)}
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-[#1A1640]">{siswa.name}</div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                {/* Progress bar */}
                                <div className="w-20 h-1.5 bg-[#E5E3FF] rounded-full overflow-hidden">
                                  <div className="h-full rounded-full bg-[#5C4FE5] transition-all"
                                    style={{width: `${Math.min((siswa.sessionNumber / siswa.sessionsTotal) * 100, 100)}%`}}/>
                                </div>
                                <span className="text-[10px] font-bold text-[#5C4FE5]">
                                  {siswa.sessionNumber}/{siswa.sessionsTotal}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E3FF] sticky top-0 bg-white z-10">
              <h2 className="text-base font-bold text-[#1A1640]">{isEditMode?'Edit Sesi':'Tambah Sesi Baru'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-[#F7F6FF] text-[#7B78A8] transition"><X size={16}/></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">Kelas <span className="text-red-500">*</span></label>
                <select value={fClassGroup} onChange={e => setFClassGroup(e.target.value)} className={inputCls}>
                  <option value="">-- Pilih Kelas --</option>
                  {classGroups.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              {isEditMode && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">Tanggal</label>
                    <input type="date" value={fDate} onChange={e => setFDate(e.target.value)} className={inputCls}/>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">Jam Mulai</label>
                    <input type="time" value={fTime} onChange={e => setFTime(e.target.value)} className={inputCls}/>
                  </div>
                </div>
              )}
              {!isEditMode && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-[#7B78A8] uppercase tracking-wide">Jadwal</label>
                    <span className="text-xs text-[#7B78A8]">{jadwalRows.length}/{MAX_ROWS} jadwal</span>
                  </div>
                  <div className="space-y-3">
                    {jadwalRows.map((row, idx) => (
                      <div key={idx} className="bg-[#F7F6FF] rounded-xl border border-[#E5E3FF] p-3">
                        <div className="flex items-center justify-between mb-2.5">
                          <span className="text-xs font-semibold text-[#5C4FE5]">Jadwal {idx+1}</span>
                          {jadwalRows.length > 1 && <button onClick={() => removeRow(idx)} className="p-1 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition"><Minus size={13}/></button>}
                        </div>
                        <div className="grid grid-cols-2 gap-2 mb-2">
                          <div>
                            <label className="block text-[10px] font-bold text-[#7B78A8] uppercase tracking-wide mb-1">Tanggal</label>
                            <input type="date" value={row.date} onChange={e => updateRow(idx,'date',e.target.value)} className="w-full px-3 py-2 border border-[#E5E3FF] rounded-lg text-sm bg-white text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] transition"/>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-[#7B78A8] uppercase tracking-wide mb-1">Jam Mulai</label>
                            <input type="time" value={row.time} onChange={e => updateRow(idx,'time',e.target.value)} className="w-full px-3 py-2 border border-[#E5E3FF] rounded-lg text-sm bg-white text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] transition"/>
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-[#7B78A8] uppercase tracking-wide mb-1">
                            Ulangi setiap minggu <span className="normal-case font-normal text-[#7B78A8]">(1 = sekali saja, maks {MAX_REPEAT})</span>
                          </label>
                          <div className="flex items-center gap-3">
                            <input type="range" min={1} max={MAX_REPEAT} value={row.repeat} onChange={e => updateRow(idx,'repeat',Number(e.target.value))} className="flex-1 accent-[#5C4FE5]"/>
                            <span className="text-sm font-bold text-[#5C4FE5] min-w-[60px] text-right">
                              {row.repeat}x{row.repeat>1&&<span className="text-[10px] font-normal text-[#7B78A8] block">≈ {Math.ceil(row.repeat/4)} bln</span>}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {jadwalRows.length < MAX_ROWS && (
                    <button onClick={addRow} className="mt-3 w-full py-2.5 border-2 border-dashed border-[#C4BFFF] rounded-xl text-sm font-semibold text-[#5C4FE5] hover:bg-[#F0EEFF] transition flex items-center justify-center gap-2">
                      <Plus size={14}/> Tambah Jadwal Lain
                    </button>
                  )}
                  <div className="mt-3 flex items-center justify-between px-4 py-2.5 bg-[#EEEDFE] rounded-xl">
                    <span className="text-xs font-semibold text-[#3C3489]">Total sesi yang akan dibuat</span>
                    <span className="text-sm font-bold text-[#5C4FE5]">
                      {totalSesi} sesi{totalSesi>=8&&<span className="text-[10px] font-normal ml-1">(≈ {Math.ceil(totalSesi/8)} periode)</span>}
                    </span>
                  </div>
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">Status</label>
                <select value={fStatus} onChange={e => setFStatus(e.target.value)} className={inputCls}>
                  <option value="scheduled">Terjadwal</option>
                  <option value="completed">Selesai</option>
                  <option value="cancelled">Dibatalkan</option>
                  <option value="rescheduled">Dijadwal Ulang</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">Link Zoom <span className="normal-case font-normal text-[#7B78A8]">(opsional)</span></label>
                <input type="url" placeholder="https://zoom.us/j/..." value={fZoom} onChange={e => setFZoom(e.target.value)} className={inputCls}/>
              </div>
              {formError && <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 font-semibold">{formError}</div>}
            </div>
            <div className="px-6 pb-5 flex gap-3 sticky bottom-0 bg-white border-t border-[#E5E3FF] pt-4">
              <button onClick={handleSave} disabled={saving} className="flex-1 py-3 bg-[#5C4FE5] hover:bg-[#3D34C4] text-white font-bold rounded-xl text-sm transition disabled:opacity-60">
                {saving?'Menyimpan...':isEditMode?'Simpan Perubahan':`Tambah ${totalSesi} Sesi`}
              </button>
              <button onClick={() => setShowModal(false)} className="px-5 py-3 border border-[#E5E3FF] text-[#4A4580] font-bold rounded-xl text-sm hover:bg-[#F0EFFF] transition">Batal</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {delConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 shadow-xl max-w-sm w-full">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4"><Trash2 size={22} className="text-red-500"/></div>
            <h3 className="text-lg font-bold text-[#1A1640] mb-1">Hapus Sesi?</h3>
            <p className="text-sm text-[#7B78A8] mb-6">Data sesi ini akan dihapus permanen.</p>
            <div className="flex gap-3">
              <button onClick={() => setDelConfirm(null)} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-[#7B78A8] border border-[#E5E3FF] hover:bg-[#F7F6FF] transition">Batal</button>
              <button onClick={() => handleDelete(delConfirm)} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 transition">Ya, Hapus</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
