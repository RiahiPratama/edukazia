'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BookOpen, ChevronDown, ChevronUp, Users } from 'lucide-react'

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

export default function TutorLaporanPage() {
  const supabase = createClient()

  const [kelasList,    setKelasList]    = useState<any[]>([])
  const [selectedKelas, setSelectedKelas] = useState<any | null>(null)
  const [laporanData,  setLaporanData]  = useState<any[]>([])
  const [expandedSiswa, setExpandedSiswa] = useState<Record<string, boolean>>({})
  const [loading,      setLoading]      = useState(true)
  const [loadingLaporan, setLoadingLaporan] = useState(false)

  useEffect(() => { fetchKelas() }, [])

  async function fetchKelas() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: tutor } = await supabase
      .from('tutors').select('id').eq('profile_id', user.id).single()
    if (!tutor?.id) { setLoading(false); return }

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
    setLoadingLaporan(true)

    // Ambil enrollments + siswa
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('id, student_id, session_start_offset, sessions_total')
      .eq('class_group_id', k.id)

    if (!enrollments || enrollments.length === 0) {
      setLaporanData([])
      setLoadingLaporan(false)
      return
    }

    const studentIds = enrollments.map((e: any) => e.student_id)

    // Ambil sessions kelas ini yang sudah selesai atau terjadwal
    const { data: sessions } = await supabase
      .from('sessions')
      .select('id, scheduled_at, status')
      .eq('class_group_id', k.id)
      .in('status', ['completed', 'scheduled'])
      .order('scheduled_at')

    // Ambil semua attendances untuk sessions ini
    const sessionIds = (sessions ?? []).map((s: any) => s.id)
    const { data: attendances } = sessionIds.length > 0
      ? await supabase
          .from('attendances')
          .select('session_id, student_id, status, notes')
          .in('session_id', sessionIds)
          .in('student_id', studentIds)
      : { data: [] }

    // Ambil nama siswa
    const { data: students } = await supabase
      .from('students').select('id, profile_id').in('id', studentIds)

    const profileIds = (students ?? []).map((s: any) => s.profile_id).filter(Boolean)
    const { data: profiles } = profileIds.length > 0
      ? await supabase.from('profiles').select('id, full_name').in('id', profileIds)
      : { data: [] }

    const profMap    = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p.full_name]))
    const studentMap = Object.fromEntries((students ?? []).map((s: any) => [s.id, profMap[s.profile_id] ?? 'Siswa']))

    // Build attendance map: studentId -> sessionId -> status
    const attMap: Record<string, Record<string, { status: string; notes: string }>> = {}
    ;(attendances ?? []).forEach((a: any) => {
      if (!attMap[a.student_id]) attMap[a.student_id] = {}
      attMap[a.student_id][a.session_id] = { status: a.status, notes: a.notes ?? '' }
    })

    // Build laporan per siswa
    const laporan = enrollments.map((e: any) => {
      const nama       = studentMap[e.student_id] ?? 'Siswa'
      const siswaAtt   = attMap[e.student_id] ?? {}
      const totalSesi  = (sessions ?? []).length
      const hadir      = Object.values(siswaAtt).filter((a: any) => a.status === 'hadir').length
      const izin       = Object.values(siswaAtt).filter((a: any) => a.status === 'izin').length
      const sakit      = Object.values(siswaAtt).filter((a: any) => a.status === 'sakit').length
      const alpha      = Object.values(siswaAtt).filter((a: any) => a.status === 'alpha').length
      const diabsen    = hadir + izin + sakit + alpha
      const pctHadir   = totalSesi > 0 ? Math.round((hadir / totalSesi) * 100) : 0

      // Detail per sesi
      const detailSesi = (sessions ?? []).map((s: any) => ({
        sessionId:    s.id,
        scheduledAt:  s.scheduled_at,
        sessionStatus: s.status,
        absenStatus:  siswaAtt[s.id]?.status ?? null,
        notes:        siswaAtt[s.id]?.notes ?? '',
      }))

      return {
        studentId:     e.student_id,
        enrollId:      e.id,
        nama,
        sessionOffset: e.session_start_offset,
        sessionTotal:  e.sessions_total,
        totalSesi,
        diabsen,
        hadir,
        izin,
        sakit,
        alpha,
        pctHadir,
        detailSesi,
      }
    })

    setLaporanData(laporan)
    setLoadingLaporan(false)
  }

  function toggleSiswa(id: string) {
    setExpandedSiswa(prev => ({ ...prev, [id]: !prev[id] }))
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
        <p className="text-sm text-[#7B78A8] mt-1">Rekap kehadiran siswa per kelas</p>
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
                {kelasList.map((k: any) => {
                  const isSelected = selectedKelas?.id === k.id
                  return (
                    <button key={k.id} onClick={() => selectKelas(k)}
                      className={[
                        'w-full text-left px-4 py-3 transition-colors',
                        isSelected ? 'bg-[#5C4FE5] text-white' : 'hover:bg-[#F7F6FF]'
                      ].join(' ')}>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ background: isSelected ? 'white' : (k.courses?.color ?? '#5C4FE5') }}/>
                        <div className="min-w-0">
                          <div className={`text-sm font-bold truncate ${isSelected ? 'text-white' : 'text-[#1A1640]'}`}>
                            {k.label}
                          </div>
                          <div className={`text-xs ${isSelected ? 'text-white/70' : 'text-[#7B78A8]'}`}>
                            {k.courses?.name ?? '—'}
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                })}
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
              <p className="text-xs text-[#7B78A8] mt-1">untuk melihat rekap kehadiran siswa</p>
            </div>
          ) : loadingLaporan ? (
            <div className="bg-white rounded-2xl border border-[#E5E3FF] p-12 text-center">
              <p className="text-sm text-[#7B78A8]">Memuat laporan...</p>
            </div>
          ) : laporanData.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#E5E3FF] p-12 text-center">
              <p className="text-sm text-[#7B78A8]">Belum ada siswa atau data absensi di kelas ini</p>
            </div>
          ) : (
            <div className="space-y-3">
              {laporanData.map((siswa: any, idx: number) => {
                const avatarColor = AVATAR_COLORS[idx % AVATAR_COLORS.length]
                const isOpen      = expandedSiswa[siswa.studentId] ?? false

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
                          <div className="text-xs text-[#7B78A8]">
                            Progress sesi: {siswa.sessionOffset}/{siswa.sessionTotal}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-lg font-black text-[#5C4FE5]">{siswa.pctHadir}%</div>
                          <div className="text-[10px] text-[#7B78A8]">kehadiran</div>
                        </div>
                      </div>

                      {/* Summary pills */}
                      <div className="flex gap-2 flex-wrap mb-3">
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-green-50 text-green-700">
                          ✓ {siswa.hadir} Hadir
                        </span>
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700">
                          {siswa.izin} Izin
                        </span>
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-yellow-50 text-yellow-700">
                          {siswa.sakit} Sakit
                        </span>
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-red-50 text-red-700">
                          {siswa.alpha} Alpha
                        </span>
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-[#F0EFFF] text-[#7B78A8]">
                          {siswa.totalSesi - siswa.diabsen} Belum diabsen
                        </span>
                      </div>

                      {/* Progress bar kehadiran */}
                      <div className="w-full h-2 bg-[#E5E3FF] rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-[#5C4FE5] transition-all"
                          style={{ width: `${siswa.pctHadir}%` }}/>
                      </div>
                    </div>

                    {/* Toggle detail sesi */}
                    <button
                      onClick={() => toggleSiswa(siswa.studentId)}
                      className="w-full flex items-center justify-between px-5 py-3 border-t border-[#F0EFFF] hover:bg-[#F7F6FF] transition-colors"
                    >
                      <span className="text-[10px] font-bold text-[#7B78A8] uppercase tracking-widest">
                        Detail per Sesi
                      </span>
                      <span className="flex items-center gap-1 text-xs text-[#5C4FE5] font-semibold">
                        {siswa.totalSesi} sesi
                        {isOpen ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
                      </span>
                    </button>

                    {/* Detail sesi */}
                    {isOpen && (
                      <div className="border-t border-[#F0EFFF]">
                        {siswa.detailSesi.length === 0 ? (
                          <p className="text-xs text-[#7B78A8] px-5 py-3">Belum ada sesi</p>
                        ) : (
                          <div className="divide-y divide-[#F0EFFF]">
                            {siswa.detailSesi.map((sesi: any, i: number) => (
                              <div key={sesi.sessionId} className="flex items-center gap-3 px-5 py-3 hover:bg-[#F7F6FF] transition-colors">
                                <div className="w-6 h-6 rounded-full bg-[#F0EFFF] flex items-center justify-center text-[10px] font-bold text-[#7B78A8] flex-shrink-0">
                                  {i + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-semibold text-[#1A1640]">
                                    {fmtDate(sesi.scheduledAt)} · {fmtTime(sesi.scheduledAt)} WIT
                                  </div>
                                  {sesi.notes && (
                                    <div className="text-[10px] text-[#7B78A8] mt-0.5 italic">"{sesi.notes}"</div>
                                  )}
                                </div>
                                <div className="flex-shrink-0">
                                  {sesi.absenStatus ? (
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLOR[sesi.absenStatus]}`}>
                                      {STATUS_LABEL[sesi.absenStatus]}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">
                                      Belum diabsen
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
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
