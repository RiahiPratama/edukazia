'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BookOpen, Users, Clock, ChevronDown, ExternalLink } from 'lucide-react'

const AVATAR_COLORS = [
  { bg: '#EEEDFE', text: '#3C3489' },
  { bg: '#E6F1FB', text: '#0C447C' },
  { bg: '#EAF3DE', text: '#3B6D11' },
  { bg: '#FAEEDA', text: '#633806' },
  { bg: '#FCEBEB', text: '#791F1F' },
  { bg: '#FBEAF0', text: '#72243E' },
  { bg: '#E1F5EE', text: '#085041' },
]

const statusLabel: Record<string, string> = {
  active: 'Aktif', inactive: 'Nonaktif', completed: 'Selesai'
}
const statusColor: Record<string, string> = {
  active:    'bg-green-100 text-green-700',
  inactive:  'bg-gray-100 text-gray-500',
  completed: 'bg-blue-100 text-blue-700',
}

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

export default function TutorKelasPage() {
  const supabase = createClient()

  const [kelasList,  setKelasList]  = useState<any[]>([])
  const [enrollMap,  setEnrollMap]  = useState<Record<string, any[]>>({})
  const [sessionMap, setSessionMap] = useState<Record<string, any[]>>({})
  const [studentMap, setStudentMap] = useState<Record<string, string>>({})
  const [courseMap,  setCourseMap]  = useState<Record<string, any>>({})
  const [typeMap,    setTypeMap]    = useState<Record<string, string>>({})
  const [expanded,   setExpanded]   = useState<Record<string, boolean>>({})
  const [loading,    setLoading]    = useState(true)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: tutor } = await supabase
      .from('tutors').select('id').eq('profile_id', user.id).single()
    if (!tutor?.id) { setLoading(false); return }

    const { data: kelas } = await supabase
      .from('class_groups')
      .select('id, label, status, max_participants, zoom_link, course_id, class_type_id')
      .eq('tutor_id', tutor.id)
      .order('created_at', { ascending: false })

    if (!kelas || kelas.length === 0) { setLoading(false); return }
    setKelasList(kelas)

    const kelasIds  = kelas.map((k: any) => k.id)
    const courseIds = [...new Set(kelas.map((k: any) => k.course_id).filter(Boolean))] as string[]
    const typeIds   = [...new Set(kelas.map((k: any) => k.class_type_id).filter(Boolean))] as string[]

    const [
      { data: courses },
      { data: classTypes },
      { data: enrollments },
      { data: sessions },
    ] = await Promise.all([
      supabase.from('courses').select('id, name, color').in('id', courseIds),
      supabase.from('class_types').select('id, name').in('id', typeIds),
      supabase.from('enrollments').select('id, class_group_id, session_start_offset, sessions_total, student_id').in('class_group_id', kelasIds),
      supabase.from('sessions').select('id, class_group_id, scheduled_at, status').in('class_group_id', kelasIds).order('scheduled_at'),
    ])

    const studentIds = [...new Set((enrollments ?? []).map((e: any) => e.student_id).filter(Boolean))] as string[]
    const { data: students } = studentIds.length > 0
      ? await supabase.from('students').select('id, profile_id').in('id', studentIds)
      : { data: [] }

    const profileIds = [...new Set((students ?? []).map((s: any) => s.profile_id).filter(Boolean))] as string[]
    const { data: profiles } = profileIds.length > 0
      ? await supabase.from('profiles').select('id, full_name').in('id', profileIds)
      : { data: [] }

    const profMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p.full_name]))
    const stuMap  = Object.fromEntries((students ?? []).map((s: any) => [s.id, profMap[s.profile_id] ?? 'Siswa']))

    const eMap: Record<string, any[]> = {}
    const sMap: Record<string, any[]> = {}
    ;(enrollments ?? []).forEach((e: any) => {
      if (!eMap[e.class_group_id]) eMap[e.class_group_id] = []
      eMap[e.class_group_id].push(e)
    })
    ;(sessions ?? []).forEach((s: any) => {
      if (!sMap[s.class_group_id]) sMap[s.class_group_id] = []
      sMap[s.class_group_id].push(s)
    })

    setCourseMap(Object.fromEntries((courses ?? []).map((c: any) => [c.id, c])))
    setTypeMap(Object.fromEntries((classTypes ?? []).map((t: any) => [t.id, t.name])))
    setEnrollMap(eMap)
    setSessionMap(sMap)
    setStudentMap(stuMap)
    setLoading(false)
  }

  function toggleExpand(id: string) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="text-sm text-[#7B78A8]">Memuat data kelas...</div>
    </div>
  )

  if (kelasList.length === 0) return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-black text-[#1A1640] font-['Sora']">Kelas & Siswa</h1>
        <p className="text-sm text-[#7B78A8] mt-1">Daftar kelas yang kamu ampu</p>
      </div>
      <div className="bg-white rounded-2xl border border-[#E5E3FF] p-12 text-center">
        <div className="flex justify-center mb-3">
          <BookOpen size={36} strokeWidth={1.5} className="text-[#C4BFFF]"/>
        </div>
        <p className="text-sm font-semibold text-[#7B78A8]">Belum ada kelas yang diampu</p>
        <p className="text-xs text-[#7B78A8] mt-1">Kelas akan muncul setelah admin menugaskan kamu</p>
      </div>
    </div>
  )

  const now = new Date()

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-black text-[#1A1640] font-['Sora']">Kelas & Siswa</h1>
        <p className="text-sm text-[#7B78A8] mt-1">Daftar kelas yang kamu ampu ({kelasList.length} kelas)</p>
      </div>

      <div className="space-y-4">
        {kelasList.map((k: any) => {
          const course        = courseMap[k.course_id]
          const typeName      = typeMap[k.class_type_id] ?? '—'
          const kelasEnroll   = enrollMap[k.id] ?? []
          const kelasSessions = sessionMap[k.id] ?? []
          const isFull        = kelasEnroll.length >= k.max_participants
          const isOpen        = expanded[k.id] ?? false

          const nextSesi = kelasSessions
            .filter((s: any) => s.status === 'scheduled' && new Date(s.scheduled_at) > now)
            .sort((a: any, b: any) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())[0] ?? null

          const completedSesi = kelasSessions.filter((s: any) => s.status === 'completed').length
          const totalSesi     = kelasSessions.length

          return (
            <div key={k.id} className="bg-white rounded-2xl border border-[#E5E3FF] overflow-hidden">
              {/* Header */}
              <div className="px-5 py-4" style={{ borderLeft: `3px solid ${course?.color ?? '#5C4FE5'}` }}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base font-black text-[#1A1640]">{k.label}</h2>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColor[k.status] ?? 'bg-gray-100 text-gray-500'}`}>
                        {statusLabel[k.status] ?? k.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-[#7B78A8]">{course?.name ?? '—'}</span>
                      <span className="text-xs text-[#7B78A8]">·</span>
                      <span className="text-xs text-[#7B78A8]">{typeName}</span>
                    </div>
                  </div>
                  {k.zoom_link && (
                    <a href={k.zoom_link} target="_blank" rel="noopener noreferrer"
                      className="flex-shrink-0 flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-50 text-blue-700 rounded-xl font-semibold hover:bg-blue-100 transition">
                      <ExternalLink size={11}/> Buka Zoom
                    </a>
                  )}
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <Users size={13} className="text-[#7B78A8]"/>
                    <span className={`text-xs font-bold ${isFull ? 'text-red-600' : 'text-[#4A4580]'}`}>
                      {kelasEnroll.length}/{k.max_participants} siswa
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock size={13} className="text-[#7B78A8]"/>
                    <span className="text-xs font-bold text-[#4A4580]">
                      {completedSesi}/{totalSesi} sesi selesai
                    </span>
                  </div>
                  {nextSesi && (
                    <div className="px-2.5 py-1 bg-[#EEEDFE] rounded-lg">
                      <span className="text-[10px] font-bold text-[#5C4FE5]">
                        Berikutnya: {fmtDate(nextSesi.scheduled_at)} · {fmtTime(nextSesi.scheduled_at)} WIT
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-3 w-full h-1 bg-[#E5E3FF] rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-[#5C4FE5] transition-all"
                    style={{ width: `${totalSesi > 0 ? Math.min((completedSesi / totalSesi) * 100, 100) : 0}%` }}/>
                </div>
              </div>

              {/* Toggle siswa */}
              <button
                onClick={() => toggleExpand(k.id)}
                className="w-full flex items-center justify-between px-5 py-3 border-t border-[#F0EFFF] hover:bg-[#F7F6FF] transition-colors"
              >
                <span className="text-[10px] font-bold text-[#7B78A8] uppercase tracking-widest">Siswa</span>
                <span className="flex items-center gap-1.5 text-xs font-semibold text-[#5C4FE5]">
                  {kelasEnroll.length} siswa
                  <ChevronDown
                    size={14}
                    style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                  />
                </span>
              </button>

              {/* Daftar siswa collapsible */}
              {isOpen && (
                <div className="px-5 pb-4 border-t border-[#F0EFFF]">
                  {kelasEnroll.length === 0 ? (
                    <p className="text-xs text-[#7B78A8] py-3">Belum ada siswa terdaftar</p>
                  ) : (
                    <div className="divide-y divide-[#F0EFFF]">
                      {kelasEnroll.map((e: any, idx: number) => {
                        const nama          = studentMap[e.student_id] ?? 'Siswa'
                        const avatarColor   = AVATAR_COLORS[idx % AVATAR_COLORS.length]
                        const sessionOffset = e.session_start_offset ?? 1
                        const sessionTotal  = e.sessions_total ?? 8
                        return (
                          <div key={e.id} className="flex items-center gap-3 py-3">
                            <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                              style={{ background: avatarColor.bg, color: avatarColor.text }}>
                              {getInitials(nama)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-[#1A1640] truncate">{nama}</div>
                              <div className="flex items-center gap-2 mt-1">
                                <div className="flex-1 h-1 bg-[#E5E3FF] rounded-full overflow-hidden">
                                  <div className="h-full rounded-full bg-[#5C4FE5]"
                                    style={{ width: `${Math.min((sessionOffset / sessionTotal) * 100, 100)}%` }}/>
                                </div>
                                <span className="text-[10px] font-bold text-[#5C4FE5] flex-shrink-0">
                                  {sessionOffset}/{sessionTotal}
                                </span>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
