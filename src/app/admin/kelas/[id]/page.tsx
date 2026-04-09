'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Calendar, Users, CreditCard, ExternalLink, Check, Pencil, Trash2, ChevronLeft, ChevronDown, ChevronRight, X, BookOpen, Plus, Trash } from 'lucide-react'
import PerpanjangModal from '@/components/admin/PerpanjangModal'

type KelasDetail = {
  id: string
  label: string
  status: string
  max_participants: number
  zoom_link: string | null
  class_type_id: string          // ← FIX: tambah ini
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
  status: 'active' | 'renewed' | 'inactive' | 'completed' | 'paused' | 'transferred'
  student_name: string
  attended_count: number
}

type SessionAttendance = {
  student_id: string
  student_name: string
  status: string
  notes: string | null
}

type SessionReport = {
  student_id: string
  student_name: string
  materi: string | null
  perkembangan: string | null
  saran_siswa: string | null
  saran_ortu: string | null
  recording_url: string | null
}

type SessionDetail = {
  attendances: SessionAttendance[]
  reports: SessionReport[]
  loading: boolean
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
  unpaid:  { label: 'Belum Bayar', cls: 'bg-[#FEE9E9] text-[#991B1B]' },
  pending: { label: 'Menunggu',    cls: 'bg-[#FEF3E2] text-[#92400E]' },
  paid:    { label: 'Lunas',       cls: 'bg-[#E6F4EC] text-[#1A5C36]' },
  overdue: { label: 'Terlambat',   cls: 'bg-[#FEE9E9] text-[#7F1D1D]' },
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
  const params   = useParams()
  const kelasId  = params.id as string
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
  const [units,            setUnits]            = useState<{id: string; unit_name: string; position: number; chapter_id: string | null; level_id: string}[]>([])
  const [chapters,         setChapters]         = useState<{id: string; chapter_title: string; order_number: number; level_id: string}[]>([])
  const [openChapters,     setOpenChapters]     = useState<Set<string>>(new Set())
  const [savingProgress,   setSavingProgress]   = useState(false)
  const [lessons,          setLessons]          = useState<{id: string; lesson_name: string; position: number; unit_id: string}[]>([])
  const [openUnits,        setOpenUnits]        = useState<Set<string>>(new Set())
  const [classCurrentLesson, setClassCurrentLesson] = useState<number>(1)
  const [studentLessonProgress, setStudentLessonProgress] = useState<Record<string, number>>({})
  const [progressLogs, setProgressLogs] = useState<{id: string; student_id: string | null; from_unit: number; from_lesson: number; to_unit: number; to_lesson: number; action: string; created_at: string}[]>([])
  const [confirmDialog, setConfirmDialog] = useState<{message: string; onConfirm: () => void} | null>(null)
  const [showJumpDropdown, setShowJumpDropdown] = useState<string | null>(null)

  // Session detail expand (absensi + laporan)
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null)
  const [sessionDetails,    setSessionDetails]    = useState<Record<string, SessionDetail>>({})

  // Perpanjang state
  const [showPerpanjang, setShowPerpanjang] = useState(false)
  const [perpanjangEnr,  setPerpanjangEnr]  = useState<Enrollment | null>(null)

  // Level state
  const [classLevels,     setClassLevels]     = useState<ClassGroupLevel[]>([])
  const [availableLevels, setAvailableLevels] = useState<Level[]>([])
  const [selectedLevelId, setSelectedLevelId] = useState('')
  const [addingLevel,     setAddingLevel]     = useState(false)
  const [removingLevelId, setRemovingLevelId] = useState<string | null>(null)

  // Edit sesi
  const [editSession, setEditSession] = useState<Session | null>(null)
  const [eDate,       setEDate]       = useState('')
  const [eTime,       setETime]       = useState('')
  const [eZoom,       setEZoom]       = useState('')
  const [eStatus,     setEStatus]     = useState('')
  const [eSaving,     setESaving]     = useState(false)
  const [eErr,        setEErr]        = useState('')
  const [eOk,         setEOk]         = useState(false)

  // Edit absensi
  const [editAbsensiSessionId, setEditAbsensiSessionId] = useState<string | null>(null)
  const [editAbsensiData,      setEditAbsensiData]      = useState<Record<string, string>>({})
  const [absensiSaving,        setAbsensiSaving]        = useState(false)
  const [absensiErr,           setAbsensiErr]           = useState('')

  useEffect(() => { fetchAll() }, [kelasId, activeTab])
  useEffect(() => { if (kelasId) fetchLevels() }, [kelasId, activeTab])
  useEffect(() => { if (kelasId) fetchProgress() }, [kelasId, activeTab])

  async function fetchProgress() {
    const { data: cg } = await supabase
      .from('class_groups')
      .select('current_unit_position, current_lesson_position, class_types(name), class_group_levels(level_id)')
      .eq('id', kelasId)
      .single()

    if (!cg) return
    setClassCurrentUnit(cg.current_unit_position ?? 1)
    setClassCurrentLesson(cg.current_lesson_position ?? 1)
    const typeName = (cg.class_types as any)?.name ?? ''
    setClassType(typeName)

    const levelIds = (cg.class_group_levels as any[])?.map((l: any) => l.level_id) || []
    if (levelIds.length > 0) {
      // Fetch units dengan chapter_id dan level_id
      const { data: u } = await supabase
        .from('units')
        .select('id, unit_name, position, chapter_id, level_id')
        .in('level_id', levelIds)
        .order('position')

      // Fetch levels sort_order for proper ordering
      const { data: lvls } = await supabase
        .from('levels')
        .select('id, sort_order')
        .in('id', levelIds)
        .order('sort_order')
      const levelOrderMap: Record<string, number> = {}
      lvls?.forEach((l: any) => { levelOrderMap[l.id] = l.sort_order ?? 0 })

      // Fetch chapters untuk grouping
      const chapterIds = [...new Set((u ?? []).map(u => u.chapter_id).filter(Boolean))] as string[]
      let chapterOrderMap: Record<string, number> = {}
      if (chapterIds.length > 0) {
        const { data: ch } = await supabase
          .from('chapters')
          .select('id, chapter_title, order_number, level_id')
          .in('id', chapterIds)
        // Sort chapters by level sort_order first, then order_number
        const sortedCh = (ch ?? []).sort((a: any, b: any) => {
          const la = levelOrderMap[a.level_id] ?? 0
          const lb = levelOrderMap[b.level_id] ?? 0
          if (la !== lb) return la - lb
          return (a.order_number ?? 0) - (b.order_number ?? 0)
        })
        setChapters(sortedCh)
        setOpenChapters(new Set(sortedCh.map((c: any) => c.id)))
        sortedCh.forEach((c: any) => { chapterOrderMap[c.id] = (levelOrderMap[c.level_id] ?? 0) * 1000 + (c.order_number ?? 0) })
      }

      // Sort units by: level sort_order → chapter order_number → unit position
      const sorted = (u ?? []).sort((a, b) => {
        const la = levelOrderMap[a.level_id] ?? 0
        const lb = levelOrderMap[b.level_id] ?? 0
        if (la !== lb) return la - lb
        const ca = a.chapter_id ? (chapterOrderMap[a.chapter_id] ?? 0) : 999
        const cb = b.chapter_id ? (chapterOrderMap[b.chapter_id] ?? 0) : 999
        if (ca !== cb) return ca - cb
        return (a.position ?? 0) - (b.position ?? 0)
      })
      setUnits(sorted)

      // Fetch lessons untuk semua unit
      const unitIds = sorted.map(unit => unit.id)
      if (unitIds.length > 0) {
        const { data: ls } = await supabase
          .from('lessons')
          .select('id, lesson_name, position, unit_id')
          .in('unit_id', unitIds)
          .order('position')
        setLessons(ls ?? [])
      }
    }

    if (typeName === 'Privat') {
      const { data: sp } = await supabase
        .from('student_unit_progress')
        .select('student_id, current_unit_position, current_lesson_position')
        .eq('class_group_id', kelasId)
      const map: Record<string, number> = {}
      const lessonMap: Record<string, number> = {}
      sp?.forEach((p: any) => {
        map[p.student_id] = p.current_unit_position
        lessonMap[p.student_id] = p.current_lesson_position ?? 1
      })
      setStudentProgress(map)
      setStudentLessonProgress(lessonMap)
    }

    // Fetch progress logs
    const { data: logs } = await supabase
      .from('progress_logs')
      .select('id, student_id, from_unit, from_lesson, to_unit, to_lesson, action, created_at')
      .eq('class_group_id', kelasId)
      .order('created_at', { ascending: false })
      .limit(20)
    setProgressLogs(logs ?? [])
  }

  async function logProgress(studentId: string | null, fromUnit: number, fromLesson: number, toUnit: number, toLesson: number, action: string) {
    await supabase.from('progress_logs').insert({
      class_group_id: kelasId,
      student_id: studentId,
      from_unit: fromUnit,
      from_lesson: fromLesson,
      to_unit: toUnit,
      to_lesson: toLesson,
      action,
    })
  }

  function confirmAction(message: string, onConfirm: () => void) {
    setConfirmDialog({ message, onConfirm })
  }

  async function saveClassProgress() {
    setSavingProgress(true)
    await supabase.from('class_groups')
      .update({ current_unit_position: classCurrentUnit, current_lesson_position: classCurrentLesson })
      .eq('id', kelasId)
    setSavingProgress(false)
    alert('✅ Progress kelas disimpan!')
  }

  async function advanceStudentLesson(studentId: string, unitId: string, totalLessons: number) {
    setSavingProgress(true)
    const currentLesson = studentLessonProgress[studentId] ?? 1
    const currentUnit = studentProgress[studentId] ?? 1

    if (currentLesson >= totalLessons) {
      const newUnitPos = Math.min(currentUnit + 1, units.length + 1)
      await supabase.from('student_unit_progress')
        .upsert({ student_id: studentId, class_group_id: kelasId, current_unit_position: newUnitPos, current_lesson_position: 1, updated_at: new Date().toISOString() }, { onConflict: 'student_id,class_group_id' })
      await logProgress(studentId, currentUnit, currentLesson, newUnitPos, 1, 'naik_unit')
      setStudentProgress(prev => ({ ...prev, [studentId]: newUnitPos }))
      setStudentLessonProgress(prev => ({ ...prev, [studentId]: 1 }))
    } else {
      const newLesson = currentLesson + 1
      await supabase.from('student_unit_progress')
        .upsert({ student_id: studentId, class_group_id: kelasId, current_unit_position: currentUnit, current_lesson_position: newLesson, updated_at: new Date().toISOString() }, { onConflict: 'student_id,class_group_id' })
      await logProgress(studentId, currentUnit, currentLesson, currentUnit, newLesson, 'naik_lesson')
      setStudentLessonProgress(prev => ({ ...prev, [studentId]: newLesson }))
    }
    setSavingProgress(false)
  }

  async function advanceClassLesson(unitId: string, totalLessons: number) {
    setSavingProgress(true)
    if (classCurrentLesson >= totalLessons) {
      const newUnit = Math.min(classCurrentUnit + 1, units.length + 1)
      await supabase.from('class_groups').update({ current_unit_position: newUnit, current_lesson_position: 1 }).eq('id', kelasId)
      await logProgress(null, classCurrentUnit, classCurrentLesson, newUnit, 1, 'naik_unit_kelas')
      setClassCurrentUnit(newUnit)
      setClassCurrentLesson(1)
    } else {
      const newLesson = classCurrentLesson + 1
      await supabase.from('class_groups').update({ current_lesson_position: newLesson }).eq('id', kelasId)
      await logProgress(null, classCurrentUnit, classCurrentLesson, classCurrentUnit, newLesson, 'naik_lesson_kelas')
      setClassCurrentLesson(newLesson)
    }
    setSavingProgress(false)
  }

  async function unlockAllStudentLessons(studentId: string) {
    const currentUnit = studentProgress[studentId] ?? 1
    const currentLesson = studentLessonProgress[studentId] ?? 1
    confirmAction(`Selesaikan semua lesson di unit ini dan naik ke unit berikutnya?`, async () => {
      setSavingProgress(true)
      const newUnitPos = currentUnit + 1
      await supabase.from('student_unit_progress')
        .upsert({ student_id: studentId, class_group_id: kelasId, current_unit_position: newUnitPos, current_lesson_position: 1, updated_at: new Date().toISOString() }, { onConflict: 'student_id,class_group_id' })
      await logProgress(studentId, currentUnit, currentLesson, newUnitPos, 1, 'selesaikan_unit')
      setStudentProgress(prev => ({ ...prev, [studentId]: newUnitPos }))
      setStudentLessonProgress(prev => ({ ...prev, [studentId]: 1 }))
      setSavingProgress(false)
    })
  }

  async function unlockAllClassLessons() {
    confirmAction(`Selesaikan semua lesson di unit ini dan naik ke unit berikutnya?`, async () => {
      setSavingProgress(true)
      const newUnit = classCurrentUnit + 1
      await supabase.from('class_groups').update({ current_unit_position: newUnit, current_lesson_position: 1 }).eq('id', kelasId)
      await logProgress(null, classCurrentUnit, classCurrentLesson, newUnit, 1, 'selesaikan_unit_kelas')
      setClassCurrentUnit(newUnit)
      setClassCurrentLesson(1)
      setSavingProgress(false)
    })
  }

  async function revertStudentTo(studentId: string, unitPos: number, lessonPos: number) {
    const currentUnit = studentProgress[studentId] ?? 1
    const currentLesson = studentLessonProgress[studentId] ?? 1
    const unitName = units.find(u => u.position === unitPos)?.unit_name ?? `Unit ${unitPos}`
    const lessonName = lessons.find(l => {
      const u = units.find(u => u.position === unitPos)
      return u && l.unit_id === u.id && l.position === lessonPos
    })?.lesson_name ?? `Lesson ${lessonPos}`
    confirmAction(`Kembalikan progress ke "${unitName}" — ${lessonName}?`, async () => {
      setSavingProgress(true)
      await supabase.from('student_unit_progress')
        .upsert({ student_id: studentId, class_group_id: kelasId, current_unit_position: unitPos, current_lesson_position: lessonPos, updated_at: new Date().toISOString() }, { onConflict: 'student_id,class_group_id' })
      await logProgress(studentId, currentUnit, currentLesson, unitPos, lessonPos, 'revert')
      setStudentProgress(prev => ({ ...prev, [studentId]: unitPos }))
      setStudentLessonProgress(prev => ({ ...prev, [studentId]: lessonPos }))
      setSavingProgress(false)
    })
  }

  async function revertClassTo(unitPos: number, lessonPos: number) {
    const unitName = units.find(u => u.position === unitPos)?.unit_name ?? `Unit ${unitPos}`
    confirmAction(`Kembalikan progress kelas ke "${unitName}" — Lesson ${lessonPos}?`, async () => {
      setSavingProgress(true)
      await supabase.from('class_groups').update({ current_unit_position: unitPos, current_lesson_position: lessonPos }).eq('id', kelasId)
      await logProgress(null, classCurrentUnit, classCurrentLesson, unitPos, lessonPos, 'revert_kelas')
      setClassCurrentUnit(unitPos)
      setClassCurrentLesson(lessonPos)
      setSavingProgress(false)
    })
  }

  function jumpStudentTo(studentId: string, unitPos: number, lessonPos: number) {
    const currentUnit = studentProgress[studentId] ?? 1
    const currentLesson = studentLessonProgress[studentId] ?? 1
    if (unitPos === currentUnit && lessonPos === currentLesson) return
    const unitName = units.find(u => u.position === unitPos)?.unit_name ?? `Unit ${unitPos}`
    confirmAction(`Pindahkan progress ke "${unitName}" — Lesson ${lessonPos}?`, async () => {
      setSavingProgress(true)
      await supabase.from('student_unit_progress')
        .upsert({ student_id: studentId, class_group_id: kelasId, current_unit_position: unitPos, current_lesson_position: lessonPos, updated_at: new Date().toISOString() }, { onConflict: 'student_id,class_group_id' })
      await logProgress(studentId, currentUnit, currentLesson, unitPos, lessonPos, 'jump')
      setStudentProgress(prev => ({ ...prev, [studentId]: unitPos }))
      setStudentLessonProgress(prev => ({ ...prev, [studentId]: lessonPos }))
      setSavingProgress(false)
      setShowJumpDropdown(null)
    })
  }

  async function bulkSetProgress(unitPos: number, lessonPos: number) {
    const activeEnrollments = enrollments.filter(e => e.status === 'active')
    if (activeEnrollments.length === 0) return
    confirmAction(`Terapkan progress (Unit ${unitPos}, Lesson ${lessonPos}) ke semua ${activeEnrollments.length} siswa aktif?`, async () => {
      setSavingProgress(true)
      for (const enr of activeEnrollments) {
        const oldUnit = studentProgress[enr.student_id] ?? 1
        const oldLesson = studentLessonProgress[enr.student_id] ?? 1
        await supabase.from('student_unit_progress')
          .upsert({ student_id: enr.student_id, class_group_id: kelasId, current_unit_position: unitPos, current_lesson_position: lessonPos, updated_at: new Date().toISOString() }, { onConflict: 'student_id,class_group_id' })
        await logProgress(enr.student_id, oldUnit, oldLesson, unitPos, lessonPos, 'bulk_set')
        setStudentProgress(prev => ({ ...prev, [enr.student_id]: unitPos }))
        setStudentLessonProgress(prev => ({ ...prev, [enr.student_id]: lessonPos }))
      }
      setSavingProgress(false)
    })
  }

  async function saveStudentProgress(studentId: string, unitPos: number) {
    setSavingProgress(true)
    await supabase.from('student_unit_progress')
      .upsert({
        student_id:            studentId,
        class_group_id:        kelasId,
        current_unit_position: unitPos,
        current_lesson_position: 1,
        updated_at:            new Date().toISOString(),
      }, { onConflict: 'student_id,class_group_id' })
    setStudentProgress(prev => ({ ...prev, [studentId]: unitPos }))
    setStudentLessonProgress(prev => ({ ...prev, [studentId]: 1 }))
    setSavingProgress(false)
  }

  async function fetchAll() {
    setLoading(true)

    // FIX: tambah class_type_id ke select supaya bisa dikirim ke PerpanjangModal
    const { data: k } = await supabase
      .from('class_groups')
      .select('id, label, status, max_participants, zoom_link, class_type_id, courses(name), class_types(name), tutors(id, profiles(full_name))')
      .eq('id', kelasId)
      .single()
    setKelas(k as any)

    // Fetch enrollments — include 'renewed' supaya history perpanjang tetap tampil
    const { data: enr } = await supabase
      .from('enrollments')
      .select('id, student_id, sessions_total, session_start_offset, sessions_used, status, enrolled_at')
      .eq('class_group_id', kelasId)

    if (enr && enr.length > 0) {
      // Fetch nama siswa
      const sIds = enr.map((e: any) => e.student_id)
      const { data: studs } = await supabase.from('students').select('id, profile_id').in('id', sIds)
      const profIds = (studs ?? []).map((s: any) => s.profile_id).filter(Boolean)
      let nameMap: Record<string, string> = {}
      if (profIds.length > 0) {
        const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', profIds)
        const profMap = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.full_name]))
        nameMap = Object.fromEntries((studs ?? []).map((s: any) => [s.id, profMap[s.profile_id] ?? 'Siswa']))
      }

      // FIX A: attended_count hanya dari sessions SETELAH enrollment aktif terbaru
      // Ini mencegah sesi lama ikut terhitung di enrollment baru
      const allCompletedSessions = await supabase
        .from('sessions')
        .select('id, scheduled_at')
        .eq('class_group_id', kelasId)
        .eq('status', 'completed')

      // Build attended map per enrollment — filter by enrolled_at
      const attendedMap: Record<string, number> = {}
      for (const e of enr) {
        const enrolledAt = e.enrolled_at ? new Date(e.enrolled_at) : new Date(0)
        // Sessions yang terjadi SETELAH enrollment ini dibuat
        const relevantSessionIds = (allCompletedSessions.data ?? [])
          .filter((s: any) => new Date(s.scheduled_at) >= enrolledAt)
          .map((s: any) => s.id)

        if (relevantSessionIds.length > 0) {
          const { data: att } = await supabase
            .from('attendances')
            .select('student_id')
            .in('session_id', relevantSessionIds)
            .eq('student_id', e.student_id)
          // Hitung semua sesi yang ada absensinya (apapun statusnya = sesi berlangsung)
          attendedMap[`${e.id}`] = (att ?? []).length
        } else {
          attendedMap[`${e.id}`] = 0
        }
      }

      setEnrollments(enr.map((e: any) => ({
        ...e,
        student_name:   nameMap[e.student_id] ?? 'Siswa',
        attended_count: attendedMap[e.id] ?? 0,
      })))
    } else {
      setEnrollments([])
    }

    // Fetch sessions — hanya sesi dari periode enrollment ACTIVE
    // Cari enrolled_at dari enrollment yang statusnya active
    const activeEnrollment = (enr ?? []).find((e: any) => e.status === 'active')
    const activeEnrolledAt = activeEnrollment?.enrolled_at ?? null

    const sessQuery = supabase
      .from('sessions')
      .select('id, scheduled_at, status, zoom_link')
      .eq('class_group_id', kelasId)
      .order('scheduled_at', { ascending: true })

    // Kalau ada enrollment active dengan enrolled_at, filter sesi dari tanggal itu
    const { data: sess } = activeEnrolledAt
      ? await sessQuery.gte('scheduled_at', activeEnrolledAt)
      : await sessQuery

    setSessions((sess ?? []) as Session[])

    // Fetch payments via enrollments
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
    const { data: cgl } = await supabase
      .from('class_group_levels')
      .select('id, level_id, levels(id, name, description, target_age, sort_order)')
      .eq('class_group_id', kelasId)
      .order('levels(sort_order)')
    setClassLevels((cgl ?? []).map((c: any) => ({ id: c.id, level_id: c.level_id, level: c.levels })))

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
    setEErr(''); setEOk(false)
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
    const { data: remainingSessions } = await supabase
      .from('sessions')
      .select('id')
      .eq('class_group_id', kelasId)
      .in('status', ['scheduled', 'rescheduled'])
      .neq('id', id)
    if (!remainingSessions || remainingSessions.length === 0) {
      await supabase.from('class_groups').update({ status: 'inactive' }).eq('id', kelasId)
    }
    fetchAll()
  }

  async function toggleSessionDetail(sessionId: string) {
    if (expandedSessionId === sessionId) {
      setExpandedSessionId(null)
      return
    }
    setExpandedSessionId(sessionId)
    if (sessionDetails[sessionId]) return
    setSessionDetails(prev => ({ ...prev, [sessionId]: { attendances: [], reports: [], loading: true } }))
    const { data: attData } = await supabase
      .from('attendances')
      .select('student_id, status, notes')
      .eq('session_id', sessionId)
    const { data: repData } = await supabase
      .from('session_reports')
      .select('student_id, materi, perkembangan, saran_siswa, saran_ortu, recording_url')
      .eq('session_id', sessionId)
    const studentIdSet = new Set([
      ...(attData ?? []).map((a: any) => a.student_id),
      ...(repData ?? []).map((r: any) => r.student_id),
    ])
    const nameMap: Record<string, string> = {}
    enrollments.forEach(e => {
      if (studentIdSet.has(e.student_id)) nameMap[e.student_id] = e.student_name
    })
    const attendances: SessionAttendance[] = (attData ?? []).map((a: any) => ({
      student_id:   a.student_id,
      student_name: nameMap[a.student_id] ?? 'Siswa',
      status:       a.status,
      notes:        a.notes,
    }))
    const reports: SessionReport[] = (repData ?? []).map((r: any) => ({
      student_id:    r.student_id,
      student_name:  nameMap[r.student_id] ?? 'Siswa',
      materi:        r.materi,
      perkembangan:  r.perkembangan,
      saran_siswa:   r.saran_siswa,
      saran_ortu:    r.saran_ortu,
      recording_url: r.recording_url,
    }))
    setSessionDetails(prev => ({ ...prev, [sessionId]: { attendances, reports, loading: false } }))
  }

  function openEditAbsensi(sessionId: string) {
    const detail = sessionDetails[sessionId]
    if (!detail) return
    const initial: Record<string, string> = {}
    detail.attendances.forEach(a => { initial[a.student_id] = a.status })
    // Kalau ada siswa di enrollment tapi belum ada absensi, default tidak_hadir
    enrollments.forEach(e => {
      if (!initial[e.student_id]) initial[e.student_id] = 'tidak_hadir'
    })
    setEditAbsensiData(initial)
    setEditAbsensiSessionId(sessionId)
    setAbsensiErr('')
  }

  async function saveAbsensi() {
    if (!editAbsensiSessionId) return
    setAbsensiSaving(true)
    setAbsensiErr('')
    try {
      // Upsert satu per satu per siswa
      for (const [studentId, status] of Object.entries(editAbsensiData)) {
        const { error } = await supabase
          .from('attendances')
          .upsert({
            session_id: editAbsensiSessionId,
            student_id: studentId,
            status,
          }, { onConflict: 'session_id,student_id' })
        if (error) throw error
      }
      // Refresh session detail
      setSessionDetails(prev => {
        const old = prev[editAbsensiSessionId]
        if (!old) return prev
        const updated = old.attendances.map(a => ({
          ...a,
          status: editAbsensiData[a.student_id] ?? a.status,
        }))
        // Tambah siswa baru yang belum ada absensi
        const existingIds = new Set(old.attendances.map(a => a.student_id))
        enrollments.forEach(e => {
          if (!existingIds.has(e.student_id) && editAbsensiData[e.student_id]) {
            updated.push({
              student_id:   e.student_id,
              student_name: e.student_name,
              status:       editAbsensiData[e.student_id],
              notes:        null,
            })
          }
        })
        return { ...prev, [editAbsensiSessionId]: { ...old, attendances: updated } }
      })
      setEditAbsensiSessionId(null)
    } catch (err: any) {
      setAbsensiErr(err.message ?? 'Gagal menyimpan absensi')
    } finally {
      setAbsensiSaving(false)
    }
  }

  async function konfirmasiPembayaran(paymentId: string) {
    if (!confirm('Konfirmasi pembayaran ini sudah LUNAS?')) return
    const { error } = await supabase
      .from('payments')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', paymentId)
    if (error) { alert('Gagal konfirmasi: ' + error.message); return }
    fetchAll()
  }

  function openPerpanjang(enr: Enrollment) {
    setPerpanjangEnr(enr)
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
          { key: 'siswa',      label: 'Siswa',       icon: <Users size={13}/>,      count: new Set(enrollments.map(e => e.student_id)).size },
          { key: 'jadwal',     label: 'Jadwal',      icon: <Calendar size={13}/>,   count: sessions.length },
          { key: 'pembayaran', label: 'Pembayaran',  icon: <CreditCard size={13}/>, count: payments.length },
          { key: 'level',      label: 'Level',       icon: <BookOpen size={13}/>,   count: classLevels.length },
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

      {/* Tab: Siswa — group by student, bukan per enrollment */}
      {activeTab === 'siswa' && (
        <div className="bg-white rounded-2xl border border-[#E5E3FF] overflow-hidden">
          {enrollments.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-[#7B78A8]">Belum ada siswa terdaftar.</div>
          ) : (() => {
            // Group enrollments by student_id
            const studentMap = new Map<string, Enrollment[]>()
            enrollments.forEach(enr => {
              if (!studentMap.has(enr.student_id)) studentMap.set(enr.student_id, [])
              studentMap.get(enr.student_id)!.push(enr)
            })

            // Sort tiap siswa: renewed dulu (periode lama), active terakhir (periode baru)
            studentMap.forEach(enrs => {
              enrs.sort((a, b) => {
                const order = { renewed: 0, completed: 1, inactive: 2, active: 3, paused: 4, transferred: 5 }
                return (order[a.status as keyof typeof order] ?? 9) - (order[b.status as keyof typeof order] ?? 9)
              })
            })

            const uniqueStudents = [...studentMap.entries()]

            return uniqueStudents.map(([studentId, enrs], sidx) => {
              const hasMultiple = enrs.length > 1
              const avatarColor = AVATAR_COLORS[sidx % AVATAR_COLORS.length]
              const firstName = enrs[0].student_name

              return (
                <div key={studentId} className={`${sidx < uniqueStudents.length - 1 ? 'border-b border-[#E5E3FF]' : ''}`}>
                  {hasMultiple ? (
                    /* Siswa dengan riwayat perpanjang — tampil accordion */
                    <div>
                      {/* Header siswa */}
                      <div className="flex items-center gap-3 px-5 py-3 bg-[#F7F6FF]">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                          style={{ backgroundColor: avatarColor }}>
                          {getInitials(firstName)}
                        </div>
                        <span className="text-sm font-bold text-[#1A1640]">{firstName}</span>
                        <span className="text-[10px] text-[#7B78A8] font-medium">{enrs.length} periode</span>
                      </div>

                      {/* List periode */}
                      {enrs.map((enr, pidx) => {
                        // FIX formula: current = session_start_offset + attended (bukan -1)
                        // session_start_offset=1, attended=0 → 1/8 ✅ "sedang di sesi ke-1"
                        const attended = enr.attended_count ?? 0
                        const current = attended
                        const pct = attended === 0 ? 0 : Math.min((attended / enr.sessions_total) * 100, 100)
                        const isActive  = enr.status === 'active'
                        const isRenewed = enr.status === 'renewed'
                        const barColor  = isRenewed ? 'bg-[#C4BFFF]' : 'bg-[#5C4FE5]'

                        return (
                          <div key={enr.id}
                            className={`flex items-center gap-3 pl-14 pr-5 py-3 ${isRenewed ? 'bg-[#FAFAFE] opacity-70' : ''} ${pidx < enrs.length - 1 ? 'border-b border-[#F0EFFE]' : ''}`}>

                            {/* Connector line */}
                            <span className="text-[10px] text-[#7B78A8] font-semibold flex-shrink-0 w-16">
                              {pidx === enrs.length - 1 ? '└──' : '├──'} P{pidx + 1}
                            </span>

                            {/* Progress */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <div className="w-20 h-1.5 bg-[#E5E3FF] rounded-full overflow-hidden flex-shrink-0">
                                  <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }}/>
                                </div>
                                <span className={`text-[10px] font-bold ${isRenewed ? 'text-[#C4BFFF]' : 'text-[#5C4FE5]'}`}>
                                  {current}/{enr.sessions_total} sesi
                                </span>
                              </div>
                            </div>

                            {/* Status badge */}
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                              isActive  ? 'bg-[#E6F4EC] text-[#1A5C36]' :
                              isRenewed ? 'bg-[#EEEDFE] text-[#5C4FE5]' :
                              'bg-gray-100 text-gray-500'
                            }`}>
                              {isActive ? 'Aktif' : isRenewed ? 'Diperpanjang' : enr.status}
                            </span>

                            {/* Tombol perpanjang untuk active & completed */}
                            {(isActive || enr.status === 'completed') && (
                              <button onClick={() => openPerpanjang(enr)}
                                className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-[#F0EFFF] text-[#5C4FE5] hover:bg-[#5C4FE5] hover:text-white transition-colors flex-shrink-0">
                                🔄 Perpanjang
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    /* Siswa dengan 1 enrollment — tampil flat */
                    (() => {
                      const enr = enrs[0]
                      const attended = enr.attended_count ?? 0
                      const current = attended
                      const pct     = attended === 0 ? 0 : Math.min((attended / enr.sessions_total) * 100, 100)
                      const isActive = enr.status === 'active'
                      const st = isActive ? { label: 'Aktif', cls: 'bg-[#E6F4EC] text-[#1A5C36]' }
                               : enr.status === 'inactive' ? { label: 'Berhenti', cls: 'bg-[#FEE9E9] text-[#991B1B]' }
                               : enr.status === 'completed' ? { label: 'Selesai', cls: 'bg-blue-100 text-blue-700' }
                               : { label: enr.status, cls: 'bg-gray-100 text-gray-600' }

                      return (
                        <div className="flex items-center gap-3 px-5 py-4">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                            style={{ backgroundColor: avatarColor }}>
                            {getInitials(enr.student_name)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-[#1A1640]">{enr.student_name}</div>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="w-24 h-1.5 bg-[#E5E3FF] rounded-full overflow-hidden">
                                <div className="h-full bg-[#5C4FE5] rounded-full transition-all" style={{ width: `${pct}%` }}/>
                              </div>
                              <span className="text-[10px] font-bold text-[#5C4FE5]">
                                {current}/{enr.sessions_total} sesi
                              </span>
                            </div>
                            {units.length > 0 && (() => {
                              const uPos = classType === 'Privat' ? (studentProgress[enr.student_id] ?? 1) : classCurrentUnit
                              const lPos = classType === 'Privat' ? (studentLessonProgress[enr.student_id] ?? 1) : classCurrentLesson
                              const unitName = units.find(u => u.position === uPos)?.unit_name
                              const activeUnit = units.find(u => u.position === uPos)
                              const lessonName = activeUnit ? lessons.find(l => l.unit_id === activeUnit.id && l.position === lPos)?.lesson_name : null
                              return unitName ? (
                                <div className="text-[10px] text-[#7B78A8] mt-0.5">📖 {unitName}{lessonName ? ` — ${lessonName}` : ''}</div>
                              ) : null
                            })()}
                          </div>
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${st.cls}`}>
                            {st.label}
                          </span>
                          {(isActive || enr.status === 'completed') && (
                            <button onClick={() => openPerpanjang(enr)}
                              className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-[#F0EFFF] text-[#5C4FE5] hover:bg-[#5C4FE5] hover:text-white transition-colors flex-shrink-0">
                              🔄 Perpanjang
                            </button>
                          )}
                        </div>
                      )
                    })()
                  )}
                </div>
              )
            })
          })()}
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
              {/* Summary */}
              <div className="px-5 py-3 bg-[#F7F6FF] border-b border-[#E5E3FF] flex items-center gap-4 text-xs">
                <span className="text-[#7B78A8]">Total: <strong className="text-[#1A1640]">{sessions.length} sesi</strong></span>
                <span className="text-[#7B78A8]">Selesai: <strong className="text-[#27A05A]">{selesai}</strong></span>
                <span className="text-[#7B78A8]">Terjadwal: <strong className="text-[#5C4FE5]">{terjadwal}</strong></span>
              </div>

              {/* Semua sesi periode aktif — nomor mulai dari 1 */}
              {sessions.map((s, idx) => {
                const st = STATUS_SESI[s.status] ?? { label: s.status, cls: 'bg-gray-100 text-gray-600' }
                const isCompleted = s.status === 'completed' || s.status === 'cancelled'
                const isExpanded  = expandedSessionId === s.id
                const detail      = sessionDetails[s.id]

                return (
                  <div key={s.id} className="border-b border-[#E5E3FF] last:border-0">
                    {/* Row sesi */}
                    <div
                      className={`flex items-center gap-4 px-5 py-3.5 transition-colors
                        ${isCompleted ? (isExpanded ? 'bg-[#F0EFFF]' : 'bg-[#FAFAFE] hover:bg-[#F0EFFF] cursor-pointer') : 'hover:bg-[#F7F6FF]'}
                      `}
                      onClick={isCompleted ? () => toggleSessionDetail(s.id) : undefined}
                    >
                      <div className="min-w-[28px] text-center">
                        <div className={`text-xs font-bold ${isCompleted ? 'text-[#C4BFFF]' : 'text-[#5C4FE5]'}`}>
                          {idx + 1}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-semibold ${isCompleted ? 'text-[#7B78A8]' : 'text-[#1A1640]'}`}>
                          {fmtDate(s.scheduled_at)}
                        </div>
                        <div className="text-xs text-[#7B78A8]">{fmtTime(s.scheduled_at)}</div>
                      </div>
                      {s.zoom_link && !isCompleted && (
                        <a href={s.zoom_link} target="_blank" rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="text-[#5C4FE5] hover:opacity-70 transition">
                          <ExternalLink size={13}/>
                        </a>
                      )}
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${st.cls}`}>
                        {st.label}
                      </span>
                      {/* Icon expand untuk completed */}
                      {isCompleted ? (
                        <div className="flex-shrink-0 text-[#7B78A8]">
                          {isExpanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {s.status === 'scheduled' && (
                            <button onClick={e => { e.stopPropagation(); markSessionComplete(s.id) }}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition"
                              title="Tandai Selesai">
                              <Check size={13}/>
                            </button>
                          )}
                          {!isCompleted && (
                            <button onClick={e => { e.stopPropagation(); openEditSession(s) }}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-[#5C4FE5] hover:bg-[#F0EFFF] transition"
                              title="Edit Sesi">
                              <Pencil size={13}/>
                            </button>
                          )}
                          <button onClick={e => { e.stopPropagation(); deleteSession(s.id) }}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition"
                            title="Hapus">
                            <Trash2 size={13}/>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Expand panel — absensi + laporan */}
                    {isCompleted && isExpanded && (
                      <div className="px-5 pb-4 bg-[#F7F6FF] border-t border-[#E5E3FF]">
                        {!detail || detail.loading ? (
                          <div className="flex items-center gap-2 py-4 text-xs text-[#7B78A8]">
                            <div className="w-3 h-3 border-2 border-[#5C4FE5] border-t-transparent rounded-full animate-spin"/>
                            Memuat data...
                          </div>
                        ) : (
                          <div className="pt-3 space-y-3">

                            {/* ABSENSI */}
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-[10px] font-bold text-[#7B78A8] uppercase tracking-wide">Absensi</p>
                                <button
                                  onClick={() => openEditAbsensi(expandedSessionId!)}
                                  className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EEEDFE] text-[#5C4FE5] hover:bg-[#5C4FE5] hover:text-white transition-colors">
                                  <Pencil size={9}/> Edit
                                </button>
                              </div>
                              {detail.attendances.length === 0 ? (
                                <p className="text-xs text-[#7B78A8] italic">Belum ada data absensi</p>
                              ) : (
                                <div className="space-y-1.5">
                                  {detail.attendances.map(a => (
                                    <div key={a.student_id} className="flex items-center gap-2.5">
                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                                        a.status === 'hadir'        ? 'bg-green-100 text-green-700' :
                                        a.status === 'izin'         ? 'bg-yellow-100 text-yellow-700' :
                                        a.status === 'tidak_hadir'  ? 'bg-red-100 text-red-700' :
                                        'bg-gray-100 text-gray-600'
                                      }`}>
                                        {a.status === 'hadir' ? '✓ Hadir' : a.status === 'izin' ? '~ Izin' : '✗ Tidak Hadir'}
                                      </span>
                                      <span className="text-xs font-semibold text-[#1A1640]">{a.student_name}</span>
                                      {a.notes && (
                                        <span className="text-xs text-[#7B78A8] truncate">— {a.notes}</span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* LAPORAN TUTOR — cukup status sudah/belum */}
                            <div className="border-t border-[#E5E3FF] pt-3 flex items-center gap-3">
                              <p className="text-[10px] font-bold text-[#7B78A8] uppercase tracking-wide">Laporan Tutor</p>
                              {detail.reports.length > 0 ? (
                                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-green-100 text-green-700">
                                  ✓ Sudah diinput
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-red-50 text-red-600">
                                  ✗ Belum diinput
                                </span>
                              )}
                            </div>

                            {/* LINK REKAMAN */}
                            <div className="border-t border-[#E5E3FF] pt-3 flex items-center gap-3">
                              <p className="text-[10px] font-bold text-[#7B78A8] uppercase tracking-wide">Link Rekaman</p>
                              {detail.reports[0]?.recording_url ? (
                                <a href={detail.reports[0].recording_url} target="_blank" rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 transition">
                                  <ExternalLink size={10}/> Tersedia — Buka
                                </a>
                              ) : (
                                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">
                                  Belum tersedia
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
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
                  {/* FIX C: Tombol konfirmasi lunas untuk payment pending */}
                  {p.status === 'pending' && (
                    <button
                      onClick={() => konfirmasiPembayaran(p.id)}
                      className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white transition-colors flex-shrink-0 border border-emerald-200"
                    >
                      ✓ Konfirmasi Lunas
                    </button>
                  )}
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
                const currentLessonPos = studentLessonProgress[enr.student_id] ?? 1

                const chapterMap = new Map<string, typeof units>()
                const noChapterUnits: typeof units = []
                units.forEach(unit => {
                  if (unit.chapter_id) {
                    if (!chapterMap.has(unit.chapter_id)) chapterMap.set(unit.chapter_id, [])
                    chapterMap.get(unit.chapter_id)!.push(unit)
                  } else {
                    noChapterUnits.push(unit)
                  }
                })

                const renderUnit = (unit: typeof units[0]) => {
                  const isDone   = unit.position < currentPos
                  const isActive = unit.position === currentPos
                  const isLocked = unit.position > currentPos
                  const unitLessons = lessons.filter(l => l.unit_id === unit.id)
                  const isUnitOpen = openUnits.has(`${enr.student_id}_${unit.id}`)
                  const hasLessons = unitLessons.length > 0

                  return (
                    <div key={unit.id} className="rounded-lg overflow-hidden">
                      <div
                        onClick={() => {
                          if (hasLessons && (isDone || isActive)) {
                            const key = `${enr.student_id}_${unit.id}`
                            setOpenUnits(prev => {
                              const next = new Set(prev)
                              next.has(key) ? next.delete(key) : next.add(key)
                              return next
                            })
                          }
                        }}
                        className={`flex items-center justify-between px-3 py-2.5 border ${isDone ? 'bg-green-50 border-green-200' : isActive ? 'bg-purple-50 border-[#5C4FE5]' : 'bg-gray-50 border-gray-200'} ${hasLessons && !isLocked ? 'cursor-pointer' : ''}`}
                      >
                        <div className="flex items-center gap-2">
                          {hasLessons && !isLocked && (
                            isUnitOpen ? <ChevronDown size={12} className="text-[#5C4FE5]"/> : <ChevronRight size={12} className="text-gray-400"/>
                          )}
                          <span>{isDone ? '✅' : isActive ? '📖' : '🔒'}</span>
                          <span className={`text-sm font-medium ${isLocked ? 'text-gray-400' : 'text-[#1A1640]'}`}>{unit.unit_name}</span>
                          {hasLessons && <span className="text-[10px] text-[#7B78A8]">({unitLessons.length} lesson)</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          {isDone && (
                            <button
                              onClick={(e) => { e.stopPropagation(); revertStudentTo(enr.student_id, unit.position, 1) }}
                              disabled={savingProgress}
                              className="text-[10px] px-2 py-0.5 text-orange-500 hover:text-orange-700 hover:bg-orange-50 rounded-lg transition-colors font-semibold">
                              ↩ Kembali
                            </button>
                          )}
                          {isActive && !hasLessons && (
                            <button
                              onClick={(e) => { e.stopPropagation(); saveStudentProgress(enr.student_id, Math.min(currentPos + 1, units.length)) }}
                              disabled={savingProgress || currentPos >= units.length}
                              className="text-xs px-3 py-1 bg-[#5C4FE5] text-white rounded-lg hover:bg-[#4a3ec7] disabled:opacity-40 font-semibold">
                              Naik Unit →
                            </button>
                          )}
                          {isActive && hasLessons && (
                            <button
                              onClick={(e) => { e.stopPropagation(); unlockAllStudentLessons(enr.student_id) }}
                              disabled={savingProgress}
                              className="text-[10px] px-2.5 py-1 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-60 font-bold shadow-sm">
                              Selesaikan Unit ✓
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Lessons inside unit */}
                      {isUnitOpen && hasLessons && (
                        <div className="pl-8 pr-3 py-2 space-y-1 border-x border-b border-[#E5E3FF] bg-white">
                          {unitLessons.map(lesson => {
                            const lessonDone   = isDone || (isActive && lesson.position < currentLessonPos)
                            const lessonActive = isActive && lesson.position === currentLessonPos
                            const canRevert    = (isActive || isDone) && lessonDone
                            return (
                              <div key={lesson.id}
                                onClick={() => canRevert && revertStudentTo(enr.student_id, unit.position, lesson.position)}
                                className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                                lessonDone ? 'bg-green-50 text-[#1A1640]' : lessonActive ? 'bg-[#F0EFFF] text-[#1A1640] border border-[#5C4FE5]' : 'bg-gray-50 text-gray-400'} ${canRevert ? 'cursor-pointer hover:bg-green-100 transition-colors' : ''}`}>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs">{lessonDone ? '✅' : lessonActive ? '▶️' : '🔒'}</span>
                                  <span className={`font-medium ${lessonActive ? 'text-[#5C4FE5]' : ''}`}>{lesson.lesson_name}</span>
                                </div>
                                {lessonActive && (
                                  <button
                                    onClick={() => advanceStudentLesson(enr.student_id, unit.id, unitLessons.length)}
                                    disabled={savingProgress}
                                    className="text-xs px-3 py-1 bg-[#5C4FE5] text-white rounded-lg hover:bg-[#4a3ec7] disabled:opacity-40 font-semibold">
                                    {currentLessonPos >= unitLessons.length ? 'Naik Unit →' : 'Naik Lesson →'}
                                  </button>
                                )}
                                {canRevert && <span className="text-[10px] text-green-600 opacity-50">↩ klik untuk kembali</span>}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                }

                return (
                  <div key={enr.student_id} className="bg-white rounded-xl border border-[#E5E3FF] p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="font-bold text-[#1A1640]">{enr.student_name}</p>
                      <div className="relative">
                        <button
                          onClick={() => setShowJumpDropdown(showJumpDropdown === enr.student_id ? null : enr.student_id)}
                          className="text-[10px] px-2.5 py-1 bg-[#F0EFFF] text-[#5C4FE5] rounded-lg hover:bg-[#5C4FE5] hover:text-white transition-colors font-bold">
                          🎯 Pindah ke...
                        </button>
                        {showJumpDropdown === enr.student_id && (
                          <div className="absolute right-0 top-8 z-30 w-64 bg-white rounded-xl border border-[#E5E3FF] shadow-lg max-h-60 overflow-y-auto">
                            {units.map(u => {
                              const unitLessons = lessons.filter(l => l.unit_id === u.id)
                              return (
                                <div key={u.id}>
                                  <div className="px-3 py-1.5 bg-[#F7F6FF] text-xs font-bold text-[#4A4580] sticky top-0">{u.unit_name}</div>
                                  {unitLessons.length > 0 ? unitLessons.map(l => (
                                    <button key={l.id}
                                      onClick={() => jumpStudentTo(enr.student_id, u.position, l.position)}
                                      className={`w-full text-left px-4 py-1.5 text-xs hover:bg-[#F0EFFF] transition-colors ${u.position === currentPos && l.position === currentLessonPos ? 'text-[#5C4FE5] font-bold bg-[#F0EFFF]' : 'text-[#1A1640]'}`}>
                                      {l.lesson_name} {u.position === currentPos && l.position === currentLessonPos ? '← saat ini' : ''}
                                    </button>
                                  )) : (
                                    <button
                                      onClick={() => jumpStudentTo(enr.student_id, u.position, 1)}
                                      className={`w-full text-left px-4 py-1.5 text-xs hover:bg-[#F0EFFF] transition-colors ${u.position === currentPos ? 'text-[#5C4FE5] font-bold bg-[#F0EFFF]' : 'text-gray-400'}`}>
                                      (tanpa lesson)
                                    </button>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {chapters.map(chapter => {
                        const chapterUnits = chapterMap.get(chapter.id) ?? []
                        if (chapterUnits.length === 0) return null
                        const isChOpen = openChapters.has(chapter.id)
                        const doneCh = chapterUnits.filter(u => u.position < currentPos).length

                        return (
                          <div key={chapter.id} className="rounded-xl border border-[#E5E3FF] overflow-hidden">
                            <button
                              onClick={() => {
                                setOpenChapters(prev => {
                                  const next = new Set(prev)
                                  next.has(chapter.id) ? next.delete(chapter.id) : next.add(chapter.id)
                                  return next
                                })
                              }}
                              className="w-full flex items-center justify-between px-4 py-2.5 bg-[#F7F6FF] hover:bg-[#EEEDFE] transition-colors text-left"
                            >
                              <div className="flex items-center gap-2">
                                {isChOpen ? <ChevronDown size={14} className="text-[#5C4FE5]"/> : <ChevronRight size={14} className="text-gray-400"/>}
                                <span className="text-sm font-bold text-[#1A1640]">{chapter.chapter_title}</span>
                              </div>
                              <span className="text-xs text-[#7B78A8]">{doneCh}/{chapterUnits.length} unit selesai</span>
                            </button>
                            {isChOpen && <div className="p-2 space-y-1.5">{chapterUnits.map(renderUnit)}</div>}
                          </div>
                        )
                      })}
                      {noChapterUnits.map(renderUnit)}
                    </div>
                  </div>
                )
              })}

            {/* Bulk action for Privat */}
            {enrollments.filter(e => e.status === 'active').length > 1 && (
              <div className="bg-[#F7F6FF] rounded-xl border border-[#E5E3FF] p-3 flex items-center justify-between">
                <span className="text-xs text-[#4A4580] font-semibold">🎯 Terapkan progress yang sama ke semua siswa</span>
                <div className="flex gap-2">
                  {(() => {
                    const firstStudent = enrollments.find(e => e.status === 'active')
                    if (!firstStudent) return null
                    const uPos = studentProgress[firstStudent.student_id] ?? 1
                    const lPos = studentLessonProgress[firstStudent.student_id] ?? 1
                    const unitName = units.find(u => u.position === uPos)?.unit_name ?? `Unit ${uPos}`
                    return (
                      <button onClick={() => bulkSetProgress(uPos, lPos)} disabled={savingProgress}
                        className="text-[10px] px-3 py-1.5 bg-[#5C4FE5] text-white rounded-lg hover:bg-[#4a3ec7] disabled:opacity-40 font-bold">
                        Samakan ke: {unitName}, L{lPos}
                      </button>
                    )
                  })()}
                </div>
              </div>
            )}

            {/* Progress History */}
            {progressLogs.length > 0 && (
              <div className="bg-white rounded-xl border border-[#E5E3FF] p-4">
                <p className="text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-2">📋 Riwayat Perubahan</p>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {progressLogs.map(log => {
                    const studentName = log.student_id ? enrollments.find(e => e.student_id === log.student_id)?.student_name ?? '—' : 'Kelas'
                    const actionLabels: Record<string, string> = {
                      naik_lesson: '⬆️ Naik Lesson', naik_unit: '⬆️ Naik Unit', selesaikan_unit: '✅ Selesaikan Unit',
                      revert: '↩ Kembali', jump: '🎯 Pindah', bulk_set: '👥 Bulk Set',
                      naik_lesson_kelas: '⬆️ Naik Lesson', naik_unit_kelas: '⬆️ Naik Unit',
                      selesaikan_unit_kelas: '✅ Selesaikan Unit', revert_kelas: '↩ Kembali',
                    }
                    return (
                      <div key={log.id} className="flex items-center gap-2 text-[10px] text-[#7B78A8] py-1 border-b border-[#F0EFFF] last:border-0">
                        <span className="font-semibold text-[#1A1640]">{studentName}</span>
                        <span>{actionLabels[log.action] ?? log.action}</span>
                        <span>U{log.from_unit}.L{log.from_lesson} → U{log.to_unit}.L{log.to_lesson}</span>
                        <span className="ml-auto">{new Date(log.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            </div>
          ) : (
            /* Kelas Grup */
            <div className="bg-white rounded-xl border border-[#E5E3FF] p-4">
              <p className="font-bold text-[#1A1640] mb-3">Unit Progress Kelas</p>
              <div className="space-y-1.5 mb-4">
                {chapters.map(chapter => {
                  const chapterUnits = units.filter(u => u.chapter_id === chapter.id)
                  if (chapterUnits.length === 0) return null
                  const isChOpen = openChapters.has(chapter.id)
                  const doneCh = chapterUnits.filter(u => u.position < classCurrentUnit).length

                  return (
                    <div key={chapter.id} className="rounded-xl border border-[#E5E3FF] overflow-hidden">
                      <button
                        onClick={() => {
                          setOpenChapters(prev => {
                            const next = new Set(prev)
                            next.has(chapter.id) ? next.delete(chapter.id) : next.add(chapter.id)
                            return next
                          })
                        }}
                        className="w-full flex items-center justify-between px-4 py-2.5 bg-[#F7F6FF] hover:bg-[#EEEDFE] transition-colors text-left"
                      >
                        <div className="flex items-center gap-2">
                          {isChOpen ? <ChevronDown size={14} className="text-[#5C4FE5]"/> : <ChevronRight size={14} className="text-gray-400"/>}
                          <span className="text-sm font-bold text-[#1A1640]">{chapter.chapter_title}</span>
                        </div>
                        <span className="text-xs text-[#7B78A8]">{doneCh}/{chapterUnits.length} unit selesai</span>
                      </button>

                      {isChOpen && (
                        <div className="p-2 space-y-1.5">
                          {chapterUnits.map(unit => {
                            const isDone   = unit.position < classCurrentUnit
                            const isActive = unit.position === classCurrentUnit
                            const isLocked = unit.position > classCurrentUnit
                            const unitLessons = lessons.filter(l => l.unit_id === unit.id)
                            const hasLessons = unitLessons.length > 0
                            const isUnitOpen = openUnits.has(`class_${unit.id}`)

                            return (
                              <div key={unit.id} className="rounded-lg overflow-hidden">
                                <div
                                  onClick={() => {
                                    if (hasLessons && !isLocked) {
                                      const key = `class_${unit.id}`
                                      setOpenUnits(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })
                                    }
                                  }}
                                  className={`flex items-center justify-between px-3 py-2.5 border ${isDone ? 'bg-green-50 border-green-200' : isActive ? 'bg-purple-50 border-[#5C4FE5]' : 'bg-gray-50 border-gray-200'} ${hasLessons && !isLocked ? 'cursor-pointer' : ''}`}
                                >
                                  <div className="flex items-center gap-2">
                                    {hasLessons && !isLocked && (
                                      isUnitOpen ? <ChevronDown size={12} className="text-[#5C4FE5]"/> : <ChevronRight size={12} className="text-gray-400"/>
                                    )}
                                    <span>{isDone ? '✅' : isActive ? '📖' : '🔒'}</span>
                                    <span className={`text-sm font-medium ${isLocked ? 'text-gray-400' : 'text-[#1A1640]'}`}>{unit.unit_name}</span>
                                    {hasLessons && <span className="text-[10px] text-[#7B78A8]">({unitLessons.length} lesson)</span>}
                                  </div>
                                  {isActive && !hasLessons && <span className="text-xs font-bold text-[#5C4FE5] bg-purple-100 px-2 py-0.5 rounded-full">Aktif</span>}
                                  {isActive && hasLessons && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); unlockAllClassLessons() }}
                                      disabled={savingProgress}
                                      className="text-[10px] px-2.5 py-1 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-60 font-bold shadow-sm">
                                      Selesaikan Unit ✓
                                    </button>
                                  )}
                                </div>

                                {isUnitOpen && hasLessons && (
                                  <div className="pl-8 pr-3 py-2 space-y-1 border-x border-b border-[#E5E3FF] bg-white">
                                    {unitLessons.map(lesson => {
                                      const lessonDone   = isDone || (isActive && lesson.position < classCurrentLesson)
                                      const lessonActive = isActive && lesson.position === classCurrentLesson
                                      const canRevert    = (isActive || isDone) && lessonDone
                                      return (
                                        <div key={lesson.id}
                                          onClick={() => canRevert && revertClassTo(unit.position, lesson.position)}
                                          className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                                          lessonDone ? 'bg-green-50 text-[#1A1640]' : lessonActive ? 'bg-[#F0EFFF] text-[#1A1640] border border-[#5C4FE5]' : 'bg-gray-50 text-gray-400'} ${canRevert ? 'cursor-pointer hover:bg-green-100 transition-colors' : ''}`}>
                                          <div className="flex items-center gap-2">
                                            <span className="text-xs">{lessonDone ? '✅' : lessonActive ? '▶️' : '🔒'}</span>
                                            <span className={`font-medium ${lessonActive ? 'text-[#5C4FE5]' : ''}`}>{lesson.lesson_name}</span>
                                          </div>
                                          {lessonActive && (
                                            <button
                                              onClick={() => advanceClassLesson(unit.id, unitLessons.length)}
                                              disabled={savingProgress}
                                              className="text-xs px-3 py-1 bg-[#5C4FE5] text-white rounded-lg hover:bg-[#4a3ec7] disabled:opacity-40 font-semibold">
                                              {classCurrentLesson >= unitLessons.length ? 'Naik Unit →' : 'Naik Lesson →'}
                                            </button>
                                          )}
                                          {canRevert && <span className="text-[10px] text-green-600 opacity-50">↩ klik untuk kembali</span>}
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
                  )
                })}

                {/* Fallback: units tanpa chapter */}
                {units.filter(u => !u.chapter_id).map(unit => {
                  const isDone   = unit.position < classCurrentUnit
                  const isActive = unit.position === classCurrentUnit
                  return (
                    <div key={unit.id} onClick={() => { setClassCurrentUnit(unit.position); setClassCurrentLesson(1) }}
                      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${isDone ? 'bg-green-50 border-green-200' : isActive ? 'bg-purple-50 border-[#5C4FE5]' : 'bg-gray-50 border-gray-200 hover:border-gray-300'}`}>
                      <div className="flex items-center gap-2">
                        <span>{isDone ? '✅' : isActive ? '📖' : '🔒'}</span>
                        <span className={`text-sm font-medium ${unit.position > classCurrentUnit ? 'text-gray-400' : 'text-[#1A1640]'}`}>{unit.unit_name}</span>
                      </div>
                      {isActive && <span className="text-xs font-bold text-[#5C4FE5] bg-purple-100 px-2 py-0.5 rounded-full">Aktif</span>}
                    </div>
                  )
                })}
              </div>
              <button onClick={saveClassProgress} disabled={savingProgress}
                className="w-full py-2.5 bg-[#5C4FE5] text-white rounded-xl font-semibold text-sm hover:bg-[#4a3ec7] disabled:opacity-50">
                {savingProgress ? 'Menyimpan...' : '💾 Simpan Progress'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab: Level */}
      {activeTab === 'level' && (
        <div className="bg-white rounded-2xl border border-[#E5E3FF] overflow-hidden">
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
                <select value={selectedLevelId} onChange={e => setSelectedLevelId(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border border-[#E5E3FF] text-sm text-[#1A1640] bg-white focus:outline-none focus:border-[#5C4FE5]">
                  <option value="">Pilih level...</option>
                  {availableLevels.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
                <button onClick={handleAddLevel} disabled={!selectedLevelId || addingLevel}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#5C4FE5] text-white text-sm font-semibold rounded-xl hover:bg-[#3D34C4] transition disabled:opacity-50">
                  <Plus size={14}/>
                  {addingLevel ? 'Menambah...' : 'Tambah'}
                </button>
              </div>
            )}
          </div>
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
                <button onClick={() => handleRemoveLevel(cgl.id)} disabled={removingLevelId === cgl.id}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition disabled:opacity-50" title="Hapus dari kelas">
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
              {eErr && <p className="text-[11px] text-red-600 px-3 py-2 bg-red-50 rounded-xl border border-red-200">{eErr}</p>}
              {eOk  && <p className="text-[11px] text-green-700 px-3 py-2 bg-green-50 rounded-xl border border-green-200 flex items-center gap-1.5"><Check size={12}/> Berhasil disimpan!</p>}
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
          kelasClassTypeId={kelas.class_type_id}   // ← FIX: pakai field langsung, bukan as any
          enrollment={perpanjangEnr}
          onClose={() => setShowPerpanjang(false)}
          onSuccess={() => { setShowPerpanjang(false); fetchAll() }}
        />
      )}
      {/* ── MODAL EDIT ABSENSI ── */}
      {editAbsensiSessionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E3FF]">
              <div>
                <p className="text-[14px] font-extrabold text-[#1A1640]">Edit Absensi</p>
                <p className="text-[11px] text-[#7B78A8] mt-0.5">
                  {sessions.find(s => s.id === editAbsensiSessionId)
                    ? new Date(sessions.find(s => s.id === editAbsensiSessionId)!.scheduled_at)
                        .toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Jayapura' })
                    : ''}
                </p>
              </div>
              <button onClick={() => setEditAbsensiSessionId(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#F7F6FF] transition-colors">
                <X size={16} className="text-[#7B78A8]"/>
              </button>
            </div>

            {/* List siswa */}
            <div className="px-5 py-4 space-y-3 max-h-72 overflow-y-auto">
              {enrollments.map(e => (
                <div key={e.student_id} className="flex items-center justify-between gap-3">
                  <span className="text-[13px] font-semibold text-[#1A1640] flex-1 truncate">
                    {e.student_name}
                  </span>
                  <select
                    value={editAbsensiData[e.student_id] ?? 'tidak_hadir'}
                    onChange={ev => setEditAbsensiData(prev => ({ ...prev, [e.student_id]: ev.target.value }))}
                    className="text-[12px] font-semibold px-2 py-1.5 rounded-lg border border-[#E5E3FF] bg-[#F7F6FF] text-[#1A1640] focus:outline-none focus:border-[#5C4FE5]">
                    <option value="hadir">✓ Hadir</option>
                    <option value="tidak_hadir">✗ Tidak Hadir</option>
                  </select>
                </div>
              ))}
            </div>

            {/* Error */}
            {absensiErr && (
              <p className="px-5 text-[11px] text-red-500 font-semibold">{absensiErr}</p>
            )}

            {/* Footer */}
            <div className="px-5 py-4 border-t border-[#E5E3FF] flex gap-2">
              <button onClick={() => setEditAbsensiSessionId(null)}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-[#7B78A8] bg-[#F7F6FF] hover:bg-[#EEEDFE] transition-colors">
                Batal
              </button>
              <button onClick={saveAbsensi} disabled={absensiSaving}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-white bg-[#5C4FE5] hover:bg-[#4338CA] disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                {absensiSaving ? (
                  <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"/> Menyimpan...</>
                ) : 'Simpan Absensi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-[#E5E3FF] shadow-xl p-6 max-w-sm w-full mx-4">
            <p className="text-sm font-semibold text-[#1A1640] mb-4">{confirmDialog.message}</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDialog(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-[#4A4580] border border-[#E5E3FF] hover:bg-[#F7F6FF] transition-colors">
                Batal
              </button>
              <button onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null) }}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-[#5C4FE5] hover:bg-[#4338CA] transition-colors">
                Ya, Lanjutkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
