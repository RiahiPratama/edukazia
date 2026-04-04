'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FileText, CheckCircle, XCircle, ChevronDown, ChevronRight, ExternalLink, Users, Clock } from 'lucide-react'
import Link from 'next/link'

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    timeZone: 'Asia/Jayapura',
  })
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('id-ID', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jayapura',
  })
}

type SesiRow = {
  sessionId:   string
  classId:     string
  scheduledAt: string
  hasReport:   boolean
  studentName: string | null
  materi:      string | null
}

type KelasRow = {
  kelasId:    string
  kelasLabel: string
  sessions:   SesiRow[]
  sudah:      number
  belum:      number
}

type TutorRow = {
  tutorId:   string
  tutorName: string
  kelas:     KelasRow[]
  sudah:     number
  belum:     number
}

export default function AdminLaporanPage() {
  const supabase = createClient()

  const [data,     setData]     = useState<TutorRow[]>([])
  const [loading,  setLoading]  = useState(true)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [filter,   setFilter]   = useState<'semua' | 'belum'>('semua')

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)

    // Ambil semua kelas aktif beserta tutor
    const { data: kelas } = await supabase
      .from('class_groups')
      .select('id, label, tutor_id, course_id')
      .eq('status', 'active')
      .order('label')

    if (!kelas || kelas.length === 0) { setLoading(false); return }

    const tutorIds  = [...new Set(kelas.map((k: any) => k.tutor_id).filter(Boolean))] as string[]
    const kelasIds  = kelas.map((k: any) => k.id) as string[]

    // Ambil nama tutor
    const { data: tutorProfiles } = await supabase
      .from('tutors')
      .select('id, profiles!tutors_profile_id_fkey(full_name)')
      .in('id', tutorIds)

    const tutorNameMap: Record<string, string> = {}
    ;(tutorProfiles ?? []).forEach((t: any) => {
      const name = Array.isArray(t.profiles) ? t.profiles[0]?.full_name : t.profiles?.full_name
      if (name) tutorNameMap[t.id] = name
    })

    // Ambil sesi completed dalam 60 hari terakhir
    const since = new Date()
    since.setDate(since.getDate() - 60)

    const { data: sessions } = await supabase
      .from('sessions')
      .select('id, class_group_id, scheduled_at')
      .in('class_group_id', kelasIds)
      .eq('status', 'completed')
      .gte('scheduled_at', since.toISOString())
      .order('scheduled_at', { ascending: false })

    if (!sessions || sessions.length === 0) { setLoading(false); return }

    const sessionIds = sessions.map((s: any) => s.id)

    // Ambil laporan yang sudah ada
    const { data: reports } = await supabase
      .from('session_reports')
      .select('session_id, student_id, materi')
      .in('session_id', sessionIds)

    // Ambil enrollment active per kelas untuk tahu nama siswa
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('student_id, class_group_id')
      .in('class_group_id', kelasIds)
      .eq('status', 'active')

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

    // Enrollment map: classGroupId → student names
    const enrollMap: Record<string, string[]> = {}
    ;(enrollments ?? []).forEach((e: any) => {
      if (!enrollMap[e.class_group_id]) enrollMap[e.class_group_id] = []
      enrollMap[e.class_group_id].push(stuMap[e.student_id] ?? 'Siswa')
    })

    // Report set: sessionId_studentId
    const reportSet = new Set((reports ?? []).map((r: any) => r.session_id))
    const reportMap = Object.fromEntries((reports ?? []).map((r: any) => [r.session_id, r.materi]))

    // Build struktur per tutor → per kelas → per sesi
    const tutorMap: Record<string, TutorRow> = {}

    sessions.forEach((s: any) => {
      const kls  = kelas.find((k: any) => k.id === s.class_group_id)
      if (!kls) return

      const tutorId   = kls.tutor_id
      const tutorName = tutorNameMap[tutorId] ?? 'Tutor'
      const hasReport = reportSet.has(s.id)
      const siswaList = enrollMap[s.class_group_id] ?? []

      if (!tutorMap[tutorId]) {
        tutorMap[tutorId] = { tutorId, tutorName, kelas: [], sudah: 0, belum: 0 }
      }
      const tutorRow = tutorMap[tutorId]

      let kelasRow = tutorRow.kelas.find(k => k.kelasId === s.class_group_id)
      if (!kelasRow) {
        kelasRow = { kelasId: s.class_group_id, kelasLabel: kls.label, sessions: [], sudah: 0, belum: 0 }
        tutorRow.kelas.push(kelasRow)
      }

      kelasRow.sessions.push({
        sessionId:   s.id,
        classId:     s.class_group_id,
        scheduledAt: s.scheduled_at,
        hasReport,
        studentName: siswaList.length === 1 ? siswaList[0] : siswaList.length > 1 ? `${siswaList.length} siswa` : null,
        materi:      reportMap[s.id] ?? null,
      })

      if (hasReport) { kelasRow.sudah++; tutorRow.sudah++ }
      else           { kelasRow.belum++; tutorRow.belum++ }
    })

    // Sort tutor: yang paling banyak belum laporan di atas
    const tutorList = Object.values(tutorMap).sort((a, b) => b.belum - a.belum)
    tutorList.forEach(t => {
      t.kelas.sort((a, b) => b.belum - a.belum)
    })

    // Auto-expand tutor yang punya belum laporan
    const autoExpand: Record<string, boolean> = {}
    tutorList.forEach(t => { if (t.belum > 0) autoExpand[t.tutorId] = true })
    setExpanded(autoExpand)

    setData(tutorList)
    setLoading(false)
  }

  const totalSudah = data.reduce((s, t) => s + t.sudah, 0)
  const totalBelum = data.reduce((s, t) => s + t.belum, 0)
  const totalSesi  = totalSudah + totalBelum

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-[#1A1640] font-['Sora']">Laporan Siswa</h1>
        <p className="text-sm text-[#7B78A8] mt-1">Monitor laporan tutor per kelas · 60 hari terakhir</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Sesi', val: totalSesi, color: 'bg-[#F7F6FF] text-[#5C4FE5]', icon: Clock },
          { label: 'Sudah Laporan', val: totalSudah, color: 'bg-green-50 text-green-700', icon: CheckCircle },
          { label: 'Belum Laporan', val: totalBelum, color: 'bg-red-50 text-red-600', icon: XCircle },
        ].map(({ label, val, color, icon: Icon }) => (
          <div key={label} className={`${color} rounded-2xl p-4 border border-[#E5E3FF]`}>
            <div className="flex items-center gap-2 mb-1">
              <Icon size={14}/>
              <span className="text-xs font-bold uppercase tracking-wide">{label}</span>
            </div>
            <div className="text-3xl font-black">{val}</div>
            {totalSesi > 0 && (
              <div className="text-xs mt-1 opacity-70">
                {Math.round(val / totalSesi * 100)}% dari total
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        {[
          { id: 'semua', label: 'Semua Sesi' },
          { id: 'belum', label: '⚠ Belum Laporan' },
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id as any)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filter === f.id
                ? 'bg-[#5C4FE5] text-white'
                : 'bg-white border border-[#E5E3FF] text-[#7B78A8] hover:bg-[#F0EFFF]'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-[#E5E3FF] p-12 text-center">
          <p className="text-sm text-[#7B78A8]">Memuat data laporan...</p>
        </div>
      ) : data.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E5E3FF] p-12 text-center">
          <FileText size={36} strokeWidth={1.5} className="text-[#C4BFFF] mx-auto mb-3"/>
          <p className="text-sm font-semibold text-[#7B78A8]">Belum ada sesi selesai dalam 60 hari terakhir</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.map(tutor => {
            const isOpen = expanded[tutor.tutorId] ?? false
            const pct    = tutor.sudah + tutor.belum > 0
              ? Math.round(tutor.sudah / (tutor.sudah + tutor.belum) * 100)
              : 0

            return (
              <div key={tutor.tutorId} className="bg-white rounded-2xl border border-[#E5E3FF] overflow-hidden">
                {/* Tutor header */}
                <button
                  onClick={() => setExpanded(prev => ({ ...prev, [tutor.tutorId]: !prev[tutor.tutorId] }))}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-[#F7F6FF] transition-colors text-left"
                >
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-[#EEEDFE] flex items-center justify-center text-xs font-bold text-[#5C4FE5] flex-shrink-0">
                    {tutor.tutorName.split(' ').slice(0,2).map(n => n[0]).join('')}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-[#1A1640]">{tutor.tutorName}</span>
                      <span className="text-xs text-[#7B78A8]">· {tutor.kelas.length} kelas</span>
                    </div>
                    {/* Progress bar */}
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="flex-1 h-1.5 bg-[#F0EFFF] rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, background: pct === 100 ? '#16a34a' : pct >= 70 ? '#5C4FE5' : '#f59e0b' }}/>
                      </div>
                      <span className="text-[10px] font-bold text-[#7B78A8] flex-shrink-0">
                        {tutor.sudah}/{tutor.sudah + tutor.belum}
                      </span>
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {tutor.sudah > 0 && (
                      <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-green-100 text-green-700">
                        ✓ {tutor.sudah}
                      </span>
                    )}
                    {tutor.belum > 0 && (
                      <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-red-100 text-red-600">
                        ! {tutor.belum}
                      </span>
                    )}
                    {isOpen ? <ChevronDown size={14} className="text-[#7B78A8]"/> : <ChevronRight size={14} className="text-[#7B78A8]"/>}
                  </div>
                </button>

                {/* Kelas list */}
                {isOpen && (
                  <div className="border-t border-[#F0EFFF]">
                    {tutor.kelas.map((kls, ki) => {
                      const filteredSessions = filter === 'belum'
                        ? kls.sessions.filter(s => !s.hasReport)
                        : kls.sessions
                      if (filteredSessions.length === 0) return null

                      return (
                        <div key={kls.kelasId} className={ki > 0 ? 'border-t border-[#F0EFFF]' : ''}>
                          {/* Kelas header */}
                          <div className="flex items-center justify-between px-5 py-2.5 bg-[#FAFAFE]">
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-[#5C4FE5]"/>
                              <span className="text-xs font-bold text-[#1A1640]">{kls.kelasLabel}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-green-700 font-semibold">✓ {kls.sudah}</span>
                              <span className="text-[10px] text-red-600 font-semibold">! {kls.belum}</span>
                              <Link href={`/admin/kelas/${kls.kelasId}`}
                                className="text-[10px] font-bold text-[#5C4FE5] hover:underline flex items-center gap-0.5">
                                Lihat Kelas <ExternalLink size={10}/>
                              </Link>
                            </div>
                          </div>

                          {/* Session rows */}
                          {filteredSessions.map((sesi, si) => (
                            <div key={sesi.sessionId}
                              className={`flex items-center gap-3 px-5 py-2.5 ${si > 0 ? 'border-t border-[#F7F6FF]' : ''} ${
                                !sesi.hasReport ? 'bg-red-50/30' : ''
                              }`}>

                              {/* Status icon */}
                              {sesi.hasReport
                                ? <CheckCircle size={14} className="text-green-500 flex-shrink-0"/>
                                : <XCircle size={14} className="text-red-400 flex-shrink-0"/>
                              }

                              {/* Tanggal & waktu */}
                              <div className="w-40 flex-shrink-0">
                                <span className="text-xs text-[#1A1640] font-semibold">{fmtDate(sesi.scheduledAt)}</span>
                                <span className="text-[10px] text-[#7B78A8] ml-1.5">{fmtTime(sesi.scheduledAt)}</span>
                              </div>

                              {/* Siswa */}
                              {sesi.studentName && (
                                <span className="text-[10px] text-[#7B78A8] flex-shrink-0 flex items-center gap-1">
                                  <Users size={10}/> {sesi.studentName}
                                </span>
                              )}

                              {/* Materi (kalau ada laporan) */}
                              {sesi.hasReport && sesi.materi ? (
                                <span className="text-[10px] text-[#7B78A8] truncate flex-1 italic">
                                  "{sesi.materi.replace(/---ID---|---EN---/g, '').trim().slice(0, 60)}..."
                                </span>
                              ) : !sesi.hasReport ? (
                                <span className="text-[10px] text-red-500 font-semibold flex-1">
                                  Laporan belum diisi tutor
                                </span>
                              ) : null}
                            </div>
                          ))}
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
}
