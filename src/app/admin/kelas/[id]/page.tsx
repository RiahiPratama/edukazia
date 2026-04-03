'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Calendar, Users, CreditCard, ExternalLink, Check, Pencil, Trash2, ChevronLeft, X, BookOpen, Plus, Trash } from 'lucide-react'
import PerpanjangModal from '@/components/admin/PerpanjangModal'

type KelasDetail = {
  id: string
  label: string
  status: string
  max_participants: number
  zoom_link: string | null
  courses: { name: string } | null
  class_types: { name: string } | null
  tutors: { id: string; profiles: { full_name: string } | null } | null
}

type Enrollment = {
  id: string
  student_id: string
  sessions_total: number
  session_start_offset: number
  sessions_used: number
  status: string
  student_name: string
}

type Session = {
  id: string
  scheduled_at: string
  status: string
  zoom_link: string | null
}

type Payment = {
  id: string
  amount: number
  status: string
  period_label: string | null
  method: string
  created_at: string
  student_name: string
}

type Level = {
  id: string
  name: string
  description: string | null
  target_age: string | null
  sort_order: number
}


type ClassGroupLevel = {
  id: string
  level_id: string
  level: Level
}

const STATUS_SESI: Record<string, { label: string; cls: string }> = {
  scheduled:   { label: 'Terjadwal',      cls: 'bg-[#EEEDFE] text-[#3C3489]' },
  completed:   { label: 'Selesai',        cls: 'bg-[#E6F4EC] text-[#1A5C36]' },
  cancelled:   { label: 'Dibatalkan',     cls: 'bg-[#FEE9E9] text-[#991B1B]' },
  rescheduled: { label: 'Dijadwal Ulang', cls: 'bg-[#FEF3E2] text-[#92400E]' },
}

const STATUS_BAYAR: Record<string, { label: string; cls: string }> = {
  unpaid:  { label: 'Belum Bayar',        cls: 'bg-[#FEE9E9] text-[#991B1B]' },
  pending: { label: 'Menunggu',           cls: 'bg-[#FEF3E2] text-[#92400E]' },
  paid:    { label: 'Lunas',              cls: 'bg-[#E6F4EC] text-[#1A5C36]' },
  overdue: { label: 'Terlambat',          cls: 'bg-[#FEE9E9] text-[#7F1D1D]' },
}

const AVATAR_COLORS = ['#5C4FE5','#27A05A','#D97706','#DC2626','#0891B2','#7C3AED','#BE185D','#065F46']

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })
}
function fmtRp(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}
function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

export default function KelasDetailPage() {
  const params  = useParams()
  const kelasId = params.id as string
  const supabase = createClient()

  const [kelas,       setKelas]       = useState<KelasDetail | null>(null)
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [sessions,    setSessions]    = useState<Session[]>([])
  const [payments,    setPayments]    = useState<Payment[]>([])
  const [loading,     setLoading]     = useState(true)
  const [activeTab,   setActiveTab]   = useState<'siswa' | 'jadwal' | 'pembayaran' | 'level' | 'progress'>('siswa')

  // Progress state
  const [classType,        setClassType]        = useState<string>('')
  const [classCurrentUnit, setClassCurrentUnit] = useState<number>(1)
  const [studentProgress,  setStudentProgress]  = useState<Record<string, number>>({})
  const [units,            setUnits]            = useState<{id: string; unit_name: string; position: number}[]>([])
  const [savingProgress,   setSavingProgress]   = useState(false)

  // Perpanjang state
  const [showPerpanjang,    setShowPerpanjang]    = useState(false)
  const [perpanjangEnr,     setPerpanjangEnr]     = useState<Enrollment | null>(null)

  // Level state
  const [classLevels,     setClassLevels]     = useState<ClassGroupLevel[]>([])
  const [availableLevels, setAvailableLevels] = useState<Level[]>([])
  const [selectedLevelId, setSelectedLevelId] = useState('')
  const [addingLevel,     setAddingLevel]     = useState(false)
  const [removingLevelId, setRemovingLevelId] = useState<string | null>(null)

  // Edit sesi
  const [editSession,  setEditSession]  = useState<Session | null>(null)
  const [eDate,        setEDate]        = useState('')
  const [eTime,        setETime]        = useState('')
  const [eZoom,        setEZoom]        = useState('')
  const [eStatus,      setEStatus]      = useState('')
  const [eSaving,      setESaving]      = useState(false)
  const [eErr,         setEErr]         = useState('')
  const [eOk,          setEOk]          = useState(false)

  useEffect(() => { fetchAll() }, [kelasId])
  useEffect(() => { if (kelasId) fetchLevels() }, [kelasId])
  useEffect(() => { if (kelasId) fetchProgress() }, [kelasId])

  async function fetchProgress() {
    // Get class type & current_unit_position
    const { data: cg } = await supabase
      .from('class_groups')
      .select('current_unit_position, class_types(name), class_group_levels(level_id)')
      .eq('id', kelasId)
      .single()

    if (!cg) return
    setClassCurrentUnit(cg.current_unit_position ?? 1)
    const typeName = (cg.class_types as any)?.name ?? ''
    setClassType(typeName)

    // Get units dari level yang terkait
    const levelIds = (cg.class_group_levels as any[])?.map((l: any) => l.level_id) || []
    if (levelIds.length > 0) {
      const { data: u } = await supabase
        .from('units')
        .select('id, unit_name, position')
        .in('level_id', levelIds)
        .order('position')
      setUnits(u ?? [])
    }

    // Kalau Privat, fetch per-siswa progress
    if (typeName === 'Privat') {
      const { data: sp } = await supabase
        .from('student_unit_progress')
        .select('student_id, current_unit_position')
        .eq('class_group_id', kelasId)
      const map: Record<string, number> = {}
      sp?.forEach((p: any) => { map[p.student_id] = p.current_unit_position })
      setStudentProgress(map)
    }
  }

  async function saveClassProgress() {
    setSavingProgress(true)
    await supabase.from('class_groups')
      .update({ current_unit_position: classCurrentUnit })
      .eq('id', kelasId)
    setSavingProgress(false)
    alert('✅ Progress kelas disimpan!')
  }

  async function saveStudentProgress(studentId: string, unitPos: number) {
    setSavingProgress(true)
    await supabase.from('student_unit_progress')
      .upsert({
        student_id: studentId,
        class_group_id: kelasId,
        current_unit_position: unitPos,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'student_id,class_group_id' })
    setStudentProgress(prev => ({ ...prev, [studentId]: unitPos }))
    setSavingProgress(false)
  }

  async function fetchAll() {
    setLoading(true)

    // Fetch kelas
    const { data: k } = await supabase
      .from('class_groups')
      .select('id, label, status, max_participants, zoom_link, courses(name), class_types(name), tutors(id, profiles(full_name))')
      .eq('id', kelasId).single()
    setKelas(k as any)

    // Fetch enrollments + nama siswa
    const { data: enr } = await supabase
      .from('enrollments')
      .select('id, student_id, sessions_total, session_start_offset, sessions_used, status')
      .eq('class_group_id', kelasId)

    if (enr && enr.length > 0) {
      const sIds = enr.map((e: any) => e.student_id)
      const { data: studs } = await supabase.from('students').select('id, profile_id').in('id', sIds)
      const profIds = (studs ?? []).map((s: any) => s.profile_id).filter(Boolean)
      let nameMap: Record<string, string> = {}
      if (profIds.length > 0) {
        const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', profIds)
        const profMap = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.full_name]))
        nameMap = Object.fromEntries((studs ?? []).map((s: any) => [s.id, profMap[s.profile_id] ?? 'Siswa']))
      }
      setEnrollments(enr.map((e: any) => ({ ...e, student_name: nameMap[e.student_id] ?? 'Siswa' })))
    }

    // Fetch sessions
    const { data: sess } = await supabase
      .from('sessions')
      .select('id, scheduled_at, status, zoom_link')
      .eq('class_group_id', kelasId)
      .order('scheduled_at', { ascending: true })
    setSessions((sess ?? []) as Session[])

    // Fetch payments
    const { data: pays } = await supabase
      .from('payments')
      .select('id, amount, status, period_label, method, created_at, student_id')
      .eq('enrollment_id', kelasId) // fallback, coba via enrollment
      .order('created_at', { ascending: false })

    // Fetch via enrollments jika perlu
    const enrollIds = (enr ?? []).map((e: any) => e.id)
    let payList: any[] = []
    if (enrollIds.length > 0) {
      const { data: pays2 } = await supabase
        .from('payments')
        .select('id, amount, status, period_label, method, created_at, student_id')
        .in('enrollment_id', enrollIds)
        .order('created_at', { ascending: false })
      payList = pays2 ?? []
    }

    // Nama siswa untuk payment
    const sIds2 = [...new Set(payList.map((p: any) => p.student_id))]
    let payNameMap: Record<string, string> = {}
    if (sIds2.length > 0) {
      const { data: studs2 } = await supabase.from('students').select('id, profile_id').in('id', sIds2)
      const profIds2 = (studs2 ?? []).map((s: any) => s.profile_id).filter(Boolean)
      if (profIds2.length > 0) {
        const { data: profs2 } = await supabase.from('profiles').select('id, full_name').in('id', profIds2)
        const profMap2 = Object.fromEntries((profs2 ?? []).map((p: any) => [p.id, p.full_name]))
        payNameMap = Object.fromEntries((studs2 ?? []).map((s: any) => [s.id, profMap2[s.profile_id] ?? 'Siswa']))
      }
    }
    setPayments(payList.map((p: any) => ({ ...p, student_name: payNameMap[p.student_id] ?? '—' })))

    setLoading(false)
  }

  async function fetchLevels() {
    // Fetch level yang sudah di-assign ke kelas ini
    const { data: cgl } = await supabase
      .from('class_group_levels')
      .select('id, level_id, levels(id, name, description, target_age, sort_order)')
      .eq('class_group_id', kelasId)
      .order('levels(sort_order)')
    setClassLevels((cgl ?? []).map((c: any) => ({ id: c.id, level_id: c.level_id, level: c.levels })))

    // Fetch semua level dari kursus yang sama dengan kelas ini
    const { data: k } = await supabase
      .from('class_groups')
      .select('course_id')
      .eq('id', kelasId)
      .single()
    if (k?.course_id) {
      const assignedIds = (cgl ?? []).map((c: any) => c.level_id)
      const { data: allLevels } = await supabase
        .from('levels')
        .select('id, name, description, target_age, sort_order')
        .eq('course_id', k.course_id)
        .eq('is_active', true)
        .order('sort_order')
      // Filter: hanya tampilkan yang belum di-assign
      setAvailableLevels((allLevels ?? []).filter((l: any) => !assignedIds.includes(l.id)))
    }
  }

  async function handleAddLevel() {
    if (!selectedLevelId) return
    setAddingLevel(true)
    const res = await fetch('/api/admin/class-group-levels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ class_group_id: kelasId, level_id: selectedLevelId }),
    })
    if (res.ok) {
      setSelectedLevelId('')
      await fetchLevels()
    }
    setAddingLevel(false)
  }

  async function handleRemoveLevel(cglId: string) {
    setRemovingLevelId(cglId)
    await fetch(`/api/admin/class-group-levels/${cglId}`, { method: 'DELETE' })
    await fetchLevels()
    setRemovingLevelId(null)
  }

  function openEditSession(s: Session) {
    const dt     = new Date(s.scheduled_at)
    const witStr = dt.toLocaleString('en-CA', { timeZone: 'Asia/Jayapura', hour12: false })
    const [datePart, timePart] = witStr.split(', ')
    setEDate(datePart)
    setETime(timePart.slice(0, 5))
    setEZoom(s.zoom_link ?? '')
    setEStatus(s.status)
    setEErr('')
    setEOk(false)
    setEditSession(s)
  }

  async function handleSaveSession() {
    if (!editSession) return
    setESaving(true); setEErr(''); setEOk(false)
    const newScheduledAt = new Date(`${eDate}T${eTime}:00+09:00`).toISOString()
    const { error } = await supabase.from('sessions').update({
      scheduled_at: newScheduledAt,
      zoom_link:    eZoom || null,
      status:       eStatus,
    }).eq('id', editSession.id)
    setESaving(false)
    if (error) { setEErr(error.message); return }
    setSessions(prev => prev.map(s => s.id === editSession.id
      ? { ...s, scheduled_at: newScheduledAt, zoom_link: eZoom || null, status: eStatus }
      : s
    ))
    setEOk(true)
    setTimeout(() => setEditSession(null), 700)
  }

  async function markSessionComplete(id: string) {
    await supabase.from('sessions').update({ status: 'completed' }).eq('id', id)

    // Cek auto-arsip: semua sesi sudah completed/cancelled?
    const { data: remainingSessions } = await supabase
      .from('sessions')
      .select('id')
      .eq('class_group_id', kelasId)
      .in('status', ['scheduled', 'rescheduled'])
      .neq('id', id)

    if (!remainingSessions || remainingSessions.length === 0) {
      // Semua sesi selesai → arsip kelas otomatis
      await supabase.from('class_groups')
        .update({ status: 'inactive' })
        .eq('id', kelasId)
    }

    fetchAll()
  }

  function openPerpanjang(enr: Enrollment) {
    setPerpanjangEnr(enr)
    setPerpanjangForm({
      package_id: '',
      sessions_total: '8',
      start_date: '',
      zoom_link: kelas?.zoom_link ?? '',
    })
    setPerpanjangError('')
    setShowPerpanjang(true)
  }

  async function deleteSession(id: string) {
    await supabase.from('sessions').delete().eq('id', id)
    fetchAll()
  }

  const statusLabel: Record<string, string> = { active: 'Aktif', inactive: 'Nonaktif', completed: 'Selesai' }
  const statusColor: Record<string, string>  = {
    active: 'bg-green-100 text-green-700', inactive: 'bg-gray-100 text-gray-500', completed: 'bg-blue-100 text-blue-700'
  }

  const selesai    = sessions.filter(s => s.status === 'completed').length
  const terjadwal  = sessions.filter(s => s.status === 'scheduled').length
  const totalLunas = payments.filter(p => p.status === 'paid').reduce((a, p) => a + p.amount, 0)

  if (loading) return <div className="p-6 text-sm text-[#7B78A8]">Memuat detail kelas...</div>
  if (!kelas)  return <div className="p-6 text-sm text-red-500">Kelas tidak ditemukan.</div>

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/kelas" className="text-[#7B78A8] hover:text-[#5C4FE5] transition-colors">
          <ChevronLeft size={20}/>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-[#1A1640] truncate" style={{fontFamily:'Sora,sans-serif'}}>{kelas.label}</h1>
            <span className={`text-xs font-semibold px-2 py-1 rounded-full flex-shrink-0 ${statusColor[kelas.status] ?? 'bg-gray-100 text-gray-500'}`}>
              {statusLabel[kelas.status] ?? kelas.status}
            </span>
          </div>
          <p className="text-sm text-[#7B78A8] mt-0.5">
            {kelas.courses?.name} · {kelas.class_types?.name} · {(kelas.tutors as any)?.profiles?.full_name ?? '—'}
          </p>
        </div>
        <Link href={`/admin/kelas/${kelasId}/edit`}
          className="flex items-center gap-1.5 px-3 py-2 bg-[#5C4FE5] text-white text-xs font-bold rounded-lg hover:bg-[#3D34C4] transition">
          <Pencil size={12}/> Edit
        </Link>
      </div>

      {/* Info bar */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white rounded-2xl border border-[#E5E3FF] p-4 text-center">
          <div className="text-2xl font-black text-[#5C4FE5]">{enrollments.filter(e => e.status === 'active').length}/{kelas.max_participants}</div>
          <div className="text-xs text-[#7B78A8] mt-0.5 font-semibold">Peserta Aktif</div>
        </div>
        <div className="bg-white rounded-2xl border border-[#E5E3FF] p-4 text-center">
          <div className="text-2xl font-black text-[#27A05A]">{selesai}</div>
          <div className="text-xs text-[#7B78A8] mt-0.5 font-semibold">Sesi Selesai</div>
        </div>
        <div className="bg-white rounded-2xl border border-[#E5E3FF] p-4 text-center">
          <div className="text-2xl font-black text-[#1A1640]">{fmtRp(totalLunas)}</div>
          <div className="text-xs text-[#7B78A8] mt-0.5 font-semibold">Total Lunas</div>
        </div>
      </div>

      {/* Zoom link */}
      {kelas.zoom_link && (
        <div className="bg-[#EEEDFE] rounded-xl px-4 py-3 mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[#3C3489]">Link Zoom</p>
            <p className="text-xs text-[#5C4FE5] truncate max-w-[280px]">{kelas.zoom_link}</p>
          </div>
          <a href={kelas.zoom_link} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 px-3 py-1.5 bg-[#5C4FE5] text-white text-xs font-bold rounded-lg hover:bg-[#3D34C4] transition">
            <ExternalLink size={12}/> Buka
          </a>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-[#F7F6FF] p-1 rounded-xl mb-5 border border-[#E5E3FF]">
        {([
          { key: 'siswa',      label: 'Siswa',      icon: <Users size={13}/>,       count: enrollments.length },
          { key: 'jadwal',     label: 'Jadwal',     icon: <Calendar size={13}/>,    count: sessions.length },
          { key: 'pembayaran', label: 'Pembayaran', icon: <CreditCard size={13}/>,  count: payments.length },
          { key: 'level',      label: 'Level',      icon: <BookOpen size={13}/>,    count: classLevels.length },
          { key: 'progress',   label: '📍 Progress', icon: <BookOpen size={13}/>,   count: units.length },
        ] as const).map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={[
              'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all',
              activeTab === tab.key ? 'bg-white text-[#5C4FE5] shadow-sm' : 'text-[#7B78A8] hover:text-[#1A1640]'
            ].join(' ')}>
            {tab.icon} {tab.label}
            {tab.count > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${activeTab === tab.key ? 'bg-[#EEEDFE] text-[#5C4FE5]' : 'bg-[#E5E3FF] text-[#7B78A8]'}`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab: Siswa */}
      {activeTab === 'siswa' && (
        <div className="bg-white rounded-2xl border border-[#E5E3FF] overflow-hidden">
          {enrollments.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-[#7B78A8]">Belum ada siswa terdaftar.</div>
          ) : (
            enrollments.map((enr, idx) => {
              const pct = Math.min(((enr.session_start_offset - 1 + (enr.sessions_used ?? 0)) / enr.sessions_total) * 100, 100)
              const st  = enr.status === 'active' ? { label: 'Aktif', cls: 'bg-[#E6F4EC] text-[#1A5C36]' }
                        : enr.status === 'inactive' ? { label: 'Berhenti', cls: 'bg-[#FEE9E9] text-[#991B1B]' }
                        : { label: enr.status, cls: 'bg-gray-100 text-gray-600' }
              return (
                <div key={enr.id} className={`flex items-center gap-3 px-5 py-4 ${idx < enrollments.length - 1 ? 'border-b border-[#E5E3FF]' : ''}`}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{backgroundColor: AVATAR_COLORS[idx % AVATAR_COLORS.length]}}>
                    {getInitials(enr.student_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-[#1A1640]">{enr.student_name}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-24 h-1.5 bg-[#E5E3FF] rounded-full overflow-hidden">
                        <div className="h-full bg-[#5C4FE5] rounded-full" style={{width: `${pct}%`}}/>
                      </div>
                      <span className="text-[10px] font-bold text-[#5C4FE5]">
                        {enr.session_start_offset}/{enr.sessions_total} sesi
                      </span>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${st.cls}`}>{st.label}</span>
                  {enr.status === 'active' && (
                    <button onClick={() => openPerpanjang(enr)}
                      className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-[#F0EFFF] text-[#5C4FE5] hover:bg-[#5C4FE5] hover:text-white transition-colors flex-shrink-0">
                      🔄 Perpanjang
                    </button>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Tab: Jadwal */}
      {activeTab === 'jadwal' && (
        <div className="bg-white rounded-2xl border border-[#E5E3FF] overflow-hidden">
          {sessions.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#F0EFFF] flex items-center justify-center mx-auto mb-3">
                <Calendar size={20} className="text-[#C4BFFF]"/>
              </div>
              <p className="text-sm text-[#7B78A8] font-semibold">Belum ada sesi dijadwalkan</p>
              <p className="text-xs text-[#7B78A8] mt-1">Gunakan tombol <strong>Jadwal</strong> di halaman Manajemen Kelas</p>
            </div>
          ) : (
            <>
              {/* Summary sesi */}
              <div className="px-5 py-3 bg-[#F7F6FF] border-b border-[#E5E3FF] flex items-center gap-4 text-xs">
                <span className="text-[#7B78A8]">Total: <strong className="text-[#1A1640]">{sessions.length} sesi</strong></span>
                <span className="text-[#7B78A8]">Selesai: <strong className="text-[#27A05A]">{selesai}</strong></span>
                <span className="text-[#7B78A8]">Terjadwal: <strong className="text-[#5C4FE5]">{terjadwal}</strong></span>
              </div>
              {sessions.map((s, idx) => {
                const st = STATUS_SESI[s.status] ?? { label: s.status, cls: 'bg-gray-100 text-gray-600' }
                return (
                  <div key={s.id} className={`flex items-center gap-4 px-5 py-3.5 hover:bg-[#F7F6FF] transition-colors ${idx < sessions.length - 1 ? 'border-b border-[#E5E3FF]' : ''}`}>
                    <div className="min-w-[36px] text-center">
                      <div className="text-xs font-bold text-[#5C4FE5]">{idx + 1}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-[#1A1640]">{fmtDate(s.scheduled_at)}</div>
                      <div className="text-xs text-[#7B78A8]">{fmtTime(s.scheduled_at)}</div>
                    </div>
                    {s.zoom_link && (
                      <a href={s.zoom_link} target="_blank" rel="noopener noreferrer"
                        className="text-[#5C4FE5] hover:opacity-70 transition">
                        <ExternalLink size={13}/>
                      </a>
                    )}
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${st.cls}`}>{st.label}</span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {s.status === 'scheduled' && (
                        <button onClick={() => markSessionComplete(s.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition" title="Tandai Selesai">
                          <Check size={13}/>
                        </button>
                      )}
                      <button onClick={() => openEditSession(s)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-[#5C4FE5] hover:bg-[#F0EFFF] transition" title="Edit Sesi">
                        <Pencil size={13}/>
                      </button>
                      <button onClick={() => deleteSession(s.id)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition" title="Hapus">
                        <Trash2 size={13}/>
                      </button>
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </div>
      )}

      {/* Tab: Pembayaran */}
      {activeTab === 'pembayaran' && (
        <div className="bg-white rounded-2xl border border-[#E5E3FF] overflow-hidden">
          {payments.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#F0EFFF] flex items-center justify-center mx-auto mb-3">
                <CreditCard size={20} className="text-[#C4BFFF]"/>
              </div>
              <p className="text-sm text-[#7B78A8] font-semibold">Belum ada data pembayaran</p>
              <Link href="/admin/pembayaran"
                className="mt-3 inline-block text-sm text-[#5C4FE5] font-semibold hover:underline">
                + Buat tagihan di menu Pembayaran
              </Link>
            </div>
          ) : (
            payments.map((p, idx) => {
              const st = STATUS_BAYAR[p.status] ?? { label: p.status, cls: 'bg-gray-100 text-gray-600' }
              return (
                <div key={p.id} className={`flex items-center gap-4 px-5 py-4 hover:bg-[#F7F6FF] transition-colors ${idx < payments.length - 1 ? 'border-b border-[#E5E3FF]' : ''}`}>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-[#1A1640]">{p.student_name}</div>
                    <div className="text-xs text-[#7B78A8] mt-0.5">
                      {p.period_label ?? '—'} · {p.method === 'transfer' ? 'Transfer Bank' : 'Tunai'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-[#1A1640]">{fmtRp(p.amount)}</div>
                    <div className="text-xs text-[#7B78A8]">{new Date(p.created_at).toLocaleDateString('id-ID', {day:'numeric',month:'short',year:'numeric'})}</div>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${st.cls}`}>{st.label}</span>
                </div>
              )
            })
          )}
        </div>
      )}
      {/* Tab: Progress */}
      {activeTab === 'progress' && (
        <div className="space-y-4">
          <div className="bg-[#F0EFFF] rounded-xl p-4 border border-[#E5E3FF]">
            <p className="text-sm text-[#4A4580]">{classType === 'Privat' ? '🎯 Kelas Privat — progress diset per siswa' : '👥 Kelas Grup — progress berlaku semua siswa'}</p>
          </div>
          {units.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#E5E3FF] p-8 text-center text-gray-400">Belum ada unit. Tambahkan level ke kelas ini terlebih dahulu.</div>
          ) : classType === 'Privat' ? (
            <div className="space-y-3">
              {enrollments.filter(e => e.status === 'active').map(enr => {
                const currentPos = studentProgress[enr.student_id] ?? 1
                return (
                  <div key={enr.student_id} className="bg-white rounded-xl border border-[#E5E3FF] p-4">
                    <p className="font-bold text-[#1A1640] mb-3">{enr.student_name}</p>
                    <div className="space-y-2">
                      {units.map(unit => {
                        const isDone = unit.position < currentPos
                        const isActive = unit.position === currentPos
                        return (
                          <div key={unit.id} className={`flex items-center justify-between p-3 rounded-lg border ${isDone ? 'bg-green-50 border-green-200' : isActive ? 'bg-purple-50 border-[#5C4FE5]' : 'bg-gray-50 border-gray-200'}`}>
                            <div className="flex items-center gap-2">
                              <span>{isDone ? '✅' : isActive ? '📖' : '🔒'}</span>
                              <span className={`text-sm font-medium ${unit.position > currentPos ? 'text-gray-400' : 'text-[#1A1640]'}`}>{unit.unit_name}</span>
                            </div>
                            {isActive && <button onClick={() => saveStudentProgress(enr.student_id, Math.min(currentPos + 1, units.length))} disabled={savingProgress || currentPos >= units.length} className="text-xs px-3 py-1 bg-[#5C4FE5] text-white rounded-lg hover:bg-[#4a3ec7] disabled:opacity-40 font-semibold">Naik Unit →</button>}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-[#E5E3FF] p-4">
              <p className="font-bold text-[#1A1640] mb-3">Unit Progress Kelas</p>
              <div className="space-y-2 mb-4">
                {units.map(unit => {
                  const isDone = unit.position < classCurrentUnit
                  const isActive = unit.position === classCurrentUnit
                  return (
                    <div key={unit.id} onClick={() => setClassCurrentUnit(unit.position)} className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${isDone ? 'bg-green-50 border-green-200' : isActive ? 'bg-purple-50 border-[#5C4FE5]' : 'bg-gray-50 border-gray-200 hover:border-gray-300'}`}>
                      <div className="flex items-center gap-2">
                        <span>{isDone ? '✅' : isActive ? '📖' : '🔒'}</span>
                        <span className={`text-sm font-medium ${unit.position > classCurrentUnit ? 'text-gray-400' : 'text-[#1A1640]'}`}>{unit.unit_name}</span>
                      </div>
                      {isActive && <span className="text-xs font-bold text-[#5C4FE5] bg-purple-100 px-2 py-0.5 rounded-full">Aktif</span>}
                    </div>
                  )
                })}
              </div>
              <button onClick={saveClassProgress} disabled={savingProgress} className="w-full py-2.5 bg-[#5C4FE5] text-white rounded-xl font-semibold text-sm hover:bg-[#4a3ec7] disabled:opacity-50">{savingProgress ? 'Menyimpan...' : '💾 Simpan Progress'}</button>
            </div>
          )}
        </div>
      )}

      {/* Tab: Level */}
      {activeTab === 'level' && (
        <div className="bg-white rounded-2xl border border-[#E5E3FF] overflow-hidden">
          {/* Tambah level */}
          <div className="px-5 py-4 border-b border-[#E5E3FF] bg-[#F7F6FF]">
            <p className="text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-2">Tambah Level ke Kelas Ini</p>
            {availableLevels.length === 0 ? (
              <p className="text-xs text-[#7B78A8]">
                {classLevels.length > 0
                  ? 'Semua level kursus ini sudah di-assign.'
                  : 'Belum ada level tersedia. Tambahkan level di menu Kursus & Paket.'}
              </p>
            ) : (
              <div className="flex gap-2">
                <select
                  value={selectedLevelId}
                  onChange={e => setSelectedLevelId(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border border-[#E5E3FF] text-sm text-[#1A1640] bg-white focus:outline-none focus:border-[#5C4FE5]"
                >
                  <option value="">Pilih level...</option>
                  {availableLevels.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
                <button
                  onClick={handleAddLevel}
                  disabled={!selectedLevelId || addingLevel}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#5C4FE5] text-white text-sm font-semibold rounded-xl hover:bg-[#3D34C4] transition disabled:opacity-50"
                >
                  <Plus size={14}/>
                  {addingLevel ? 'Menambah...' : 'Tambah'}
                </button>
              </div>
            )}
          </div>

          {/* Daftar level yang sudah di-assign */}
          {classLevels.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#F0EFFF] flex items-center justify-center mx-auto mb-3">
                <BookOpen size={20} className="text-[#C4BFFF]"/>
              </div>
              <p className="text-sm text-[#7B78A8] font-semibold">Belum ada level</p>
              <p className="text-xs text-[#7B78A8] mt-1">Pilih level di atas untuk ditambahkan ke kelas ini</p>
            </div>
          ) : (
            classLevels.map((cgl, idx) => (
              <div key={cgl.id} className={`flex items-center gap-3 px-5 py-4 ${idx < classLevels.length - 1 ? 'border-b border-[#E5E3FF]' : ''}`}>
                <div className="w-7 h-7 rounded-lg bg-[#E5E3FF] flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-black text-[#5C4FE5]">{idx + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-[#1A1640]">{cgl.level?.name ?? '—'}</div>
                  {cgl.level?.description && (
                    <div className="text-xs text-[#7B78A8] truncate">{cgl.level.description}</div>
                  )}
                </div>
                {cgl.level?.target_age && (
                  <span className="text-xs bg-[#E5E3FF] text-[#5C4FE5] font-semibold px-2 py-0.5 rounded-full flex-shrink-0">
                    {cgl.level.target_age === 'all'        ? 'Semua Usia'
                    : cgl.level.target_age === 'kids'      ? 'Anak-anak'
                    : cgl.level.target_age === 'teen'      ? 'Remaja'
                    : cgl.level.target_age === 'adult'     ? 'Dewasa'
                    : cgl.level.target_age === 'kids_teen' ? 'Anak & Remaja'
                    : 'Remaja & Dewasa'}
                  </span>
                )}
                <button
                  onClick={() => handleRemoveLevel(cgl.id)}
                  disabled={removingLevelId === cgl.id}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition disabled:opacity-50"
                  title="Hapus dari kelas"
                >
                  <Trash size={14}/>
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal Edit Sesi */}
      {editSession && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E3FF]">
              <div>
                <h3 className="font-bold text-[#1A1640] text-sm">Edit Sesi</h3>
                <p className="text-xs text-[#7B78A8] mt-0.5">{kelas?.label}</p>
              </div>
              <button onClick={() => setEditSession(null)} className="p-1.5 rounded-lg hover:bg-[#F7F6FF] text-[#7B78A8]">
                <X size={16}/>
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-[#7B78A8] uppercase tracking-wider mb-1.5">Tanggal</label>
                  <input type="date" value={eDate} onChange={e => setEDate(e.target.value)}
                    className="w-full px-3 py-2.5 border border-[#E5E3FF] rounded-xl text-sm bg-[#F7F6FF] text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] transition"/>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#7B78A8] uppercase tracking-wider mb-1.5">Jam (WIT)</label>
                  <input type="time" value={eTime} onChange={e => setETime(e.target.value)}
                    className="w-full px-3 py-2.5 border border-[#E5E3FF] rounded-xl text-sm bg-[#F7F6FF] text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] transition"/>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#7B78A8] uppercase tracking-wider mb-1.5">Status</label>
                <select value={eStatus} onChange={e => setEStatus(e.target.value)}
                  className="w-full px-3 py-2.5 border border-[#E5E3FF] rounded-xl text-sm bg-[#F7F6FF] text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] transition">
                  <option value="scheduled">Terjadwal</option>
                  <option value="completed">Selesai</option>
                  <option value="cancelled">Dibatalkan</option>
                  <option value="rescheduled">Dijadwal Ulang</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#7B78A8] uppercase tracking-wider mb-1.5">
                  Link Zoom <span className="normal-case font-normal">(opsional)</span>
                </label>
                <input type="url" value={eZoom} onChange={e => setEZoom(e.target.value)}
                  placeholder="https://zoom.us/j/..."
                  className="w-full px-3 py-2.5 border border-[#E5E3FF] rounded-xl text-sm bg-[#F7F6FF] text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] transition"/>
              </div>
              {eErr && (
                <p className="text-[11px] text-red-600 px-3 py-2 bg-red-50 rounded-xl border border-red-200">{eErr}</p>
              )}
              {eOk && (
                <p className="text-[11px] text-green-700 px-3 py-2 bg-green-50 rounded-xl border border-green-200 flex items-center gap-1.5">
                  <Check size={12}/> Berhasil disimpan!
                </p>
              )}
              <div className="flex gap-2 pt-1">
                <button onClick={() => setEditSession(null)}
                  className="flex-1 py-2.5 border border-[#E5E3FF] text-[#7B78A8] font-semibold rounded-xl text-sm hover:bg-[#F7F6FF] transition">
                  Batal
                </button>
                <button onClick={handleSaveSession} disabled={eSaving}
                  className="flex-1 py-2.5 bg-[#5C4FE5] hover:bg-[#3D34C4] text-white font-bold rounded-xl text-sm transition disabled:opacity-60">
                  {eSaving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Modal Perpanjang */}
      {showPerpanjang && perpanjangEnr && kelas && (
        <PerpanjangModal
          kelasId={kelasId}
          kelasLabel={kelas.label}
          kelasZoomLink={kelas.zoom_link}
          kelasClassTypeId={(kelas as any).class_type_id ?? ''}
          enrollment={perpanjangEnr}
          onClose={() => setShowPerpanjang(false)}
          onSuccess={() => { setShowPerpanjang(false); fetchAll() }}
        />
      )}
    </div>
  )
}
