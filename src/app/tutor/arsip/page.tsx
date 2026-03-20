'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Archive, Users, ChevronDown, ChevronUp, FileText } from 'lucide-react'

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

export default function TutorArsipPage() {
  const supabase = createClient()

  const [kelasList,     setKelasList]     = useState<any[]>([])
  const [loading,       setLoading]       = useState(true)
  const [expandedKelas, setExpandedKelas] = useState<Record<string, boolean>>({})
  const [kelasData,     setKelasData]     = useState<Record<string, any>>({})
  const [loadingKelas,  setLoadingKelas]  = useState<string | null>(null)
  const [expandedSiswa, setExpandedSiswa] = useState<Record<string, boolean>>({})
  const [expandedSesi,  setExpandedSesi]  = useState<Record<string, boolean>>({})

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
      .select('id, label, status, max_participants, course_id, courses(name, color), class_types(name), enrollments(id, status)')
      .eq('tutor_id', tutor.id)
      .eq('status', 'inactive')
      .order('created_at', { ascending: false })

    setKelasList(kelas ?? [])
    setLoading(false)
  }

  async function toggleKelas(k: any) {
    const isOpen = expandedKelas[k.id] ?? false
    setExpandedKelas(prev => ({ ...prev, [k.id]: !isOpen }))
    if (isOpen || kelasData[k.id]) return

    setLoadingKelas(k.id)

    const { data: enrollments } = await supabase
      .from('enrollments').select('id, student_id, session_start_offset, sessions_total').eq('class_group_id', k.id)

    if (!enrollments || enrollments.length === 0) {
      setKelasData(prev => ({ ...prev, [k.id]: [] }))
      setLoadingKelas(null)
      return
    }

    const studentIds = enrollments.map((e: any) => e.student_id)
    const { data: sessions } = await supabase
      .from('sessions').select('id, scheduled_at, status').eq('class_group_id', k.id).order('scheduled_at')
    const sessionIds = (sessions ?? []).map((s: any) => s.id)

    const [{ data: attendances }, { data: sessionReports }, { data: students }] = await Promise.all([
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
        materi: r.materi ?? '', perkembangan: r.perkembangan ?? '',
        saranSiswa: r.saran_siswa ?? '', saranOrtu: r.saran_ortu ?? '',
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
      const pctHadir = totalSesi > 0 ? Math.round((hadir / totalSesi) * 100) : 0
      const detailSesi = (sessions ?? []).map((s: any) => ({
        sessionId:    s.id,
        scheduledAt:  s.scheduled_at,
        absenStatus:  siswaAtt[s.id]?.status ?? null,
        absenNotes:   siswaAtt[s.id]?.notes ?? '',
        materi:       siswaRep[s.id]?.materi ?? '',
        perkembangan: siswaRep[s.id]?.perkembangan ?? '',
        saranSiswa:   siswaRep[s.id]?.saranSiswa ?? '',
        saranOrtu:    siswaRep[s.id]?.saranOrtu ?? '',
        hasReport:    !!siswaRep[s.id],
      }))
      return { studentId: e.student_id, nama, sessionTotal: e.sessions_total, totalSesi, hadir, izin, sakit, alpha, pctHadir, detailSesi }
    })

    setKelasData(prev => ({ ...prev, [k.id]: laporan }))
    setLoadingKelas(null)
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="text-sm text-[#7B78A8]">Memuat arsip kelas...</div>
    </div>
  )

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-black text-[#1A1640] font-['Sora']">Arsip Kelas</h1>
        <p className="text-sm text-[#7B78A8] mt-1">Riwayat kelas yang sudah selesai</p>
      </div>

      {kelasList.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E5E3FF] p-12 text-center">
          <Archive size={40} strokeWidth={1.5} className="text-[#C4BFFF] mx-auto mb-3"/>
          <p className="font-bold text-[#1A1640] mb-1">Belum ada kelas diarsipkan</p>
          <p className="text-sm text-[#7B78A8]">Kelas yang sudah selesai akan muncul di sini</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {kelasList.map((k: any) => {
            const totalEnroll = k.enrollments?.length ?? 0
            const isOpen      = expandedKelas[k.id] ?? false
            const isLoading   = loadingKelas === k.id
            const siswaData   = kelasData[k.id] ?? []

            return (
              <div key={k.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden opacity-90 hover:opacity-100 transition-all">
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-[#7B78A8] truncate">{k.label}</div>
                      <div className="text-xs text-[#9B97B2] mt-0.5">{k.courses?.name} · {k.class_types?.name ?? '—'}</div>
                    </div>
                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-gray-100 text-gray-500 flex-shrink-0 ml-2">Arsip</span>
                  </div>

                  <div className="flex items-center text-xs text-[#9B97B2] mb-4">
                    <Users size={12} className="mr-1"/>{totalEnroll} siswa terdaftar
                  </div>

                  <button onClick={() => toggleKelas(k)}
                    className="w-full flex items-center justify-center gap-2 py-2 border border-[#E5E3FF] text-[#5C4FE5] text-xs font-bold rounded-lg hover:bg-[#F0EFFF] transition-colors">
                    {isOpen ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
                    {isOpen ? 'Sembunyikan Laporan' : 'Lihat Laporan Siswa'}
                  </button>
                </div>

                {isOpen && (
                  <div className="border-t border-[#E5E3FF] bg-[#F7F6FF]">
                    {isLoading ? (
                      <div className="p-6 text-center text-sm text-[#7B78A8]">Memuat laporan...</div>
                    ) : siswaData.length === 0 ? (
                      <div className="p-6 text-center text-sm text-[#7B78A8]">Belum ada data siswa</div>
                    ) : (
                      <div className="divide-y divide-[#E5E3FF]">
                        {siswaData.map((siswa: any, idx: number) => {
                          const avatarColor = AVATAR_COLORS[idx % AVATAR_COLORS.length]
                          const isSiswaOpen = expandedSiswa[`${k.id}-${siswa.studentId}`] ?? false

                          return (
                            <div key={siswa.studentId}>
                              <div className="px-5 py-3">
                                <div className="flex items-center gap-3 mb-2">
                                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                                    style={{ background: avatarColor.bg, color: avatarColor.text }}>
                                    {getInitials(siswa.nama)}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-xs font-bold text-[#1A1640]">{siswa.nama}</div>
                                    <div className="text-[10px] text-[#7B78A8]">{siswa.totalSesi} sesi terlaksana</div>
                                  </div>
                                  <div className="text-right flex-shrink-0">
                                    <div className="text-sm font-black text-[#5C4FE5]">{siswa.pctHadir}%</div>
                                    <div className="text-[10px] text-[#7B78A8]">hadir</div>
                                  </div>
                                </div>
                                <div className="flex gap-1.5 flex-wrap mb-2">
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-green-50 text-green-700">✓ {siswa.hadir}</span>
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700">{siswa.izin} Izin</span>
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-yellow-50 text-yellow-700">{siswa.sakit} Sakit</span>
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-red-50 text-red-700">{siswa.alpha} Alpha</span>
                                </div>
                                <button
                                  onClick={() => setExpandedSiswa(prev => ({ ...prev, [`${k.id}-${siswa.studentId}`]: !prev[`${k.id}-${siswa.studentId}`] }))}
                                  className="text-[10px] font-semibold text-[#5C4FE5] hover:underline flex items-center gap-1">
                                  {isSiswaOpen ? <ChevronUp size={11}/> : <ChevronDown size={11}/>}
                                  {isSiswaOpen ? 'Sembunyikan' : 'Detail Sesi'}
                                </button>
                              </div>

                              {isSiswaOpen && (
                                <div className="border-t border-[#E5E3FF] divide-y divide-[#E5E3FF] bg-white">
                                  {siswa.detailSesi.map((sesi: any, i: number) => {
                                    const key        = `${k.id}-${siswa.studentId}-${sesi.sessionId}`
                                    const isSesiOpen = expandedSesi[key] ?? false
                                    return (
                                      <div key={sesi.sessionId}>
                                        <div className="flex items-center gap-3 px-5 py-2.5">
                                          <div className="w-5 h-5 rounded-full bg-[#F0EFFF] flex items-center justify-center text-[9px] font-bold text-[#7B78A8] flex-shrink-0">
                                            {i + 1}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="text-[11px] font-semibold text-[#1A1640]">
                                              {fmtDate(sesi.scheduledAt)} · {fmtTime(sesi.scheduledAt)} WIT
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-1.5 flex-shrink-0">
                                            {sesi.absenStatus ? (
                                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${STATUS_COLOR[sesi.absenStatus]}`}>
                                                {STATUS_LABEL[sesi.absenStatus]}
                                              </span>
                                            ) : (
                                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400">—</span>
                                            )}
                                            {sesi.hasReport && (
                                              <button
                                                onClick={() => setExpandedSesi(prev => ({ ...prev, [key]: !prev[key] }))}
                                                className="flex items-center gap-0.5 text-[9px] font-semibold text-[#5C4FE5] hover:underline">
                                                <FileText size={10}/>{isSesiOpen ? 'Tutup' : 'Lap.'}
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                        {isSesiOpen && sesi.hasReport && (
                                          <div className="mx-5 mb-3 bg-[#F7F6FF] rounded-xl border border-[#E5E3FF] p-3 space-y-2">
                                            {sesi.materi && <div><p className="text-[9px] font-bold text-[#7B78A8] uppercase mb-0.5">Materi</p><p className="text-[11px] text-[#1A1640]">{sesi.materi}</p></div>}
                                            {sesi.perkembangan && <div><p className="text-[9px] font-bold text-[#7B78A8] uppercase mb-0.5">Perkembangan</p><p className="text-[11px] text-[#1A1640]">{sesi.perkembangan}</p></div>}
                                            {sesi.saranSiswa && <div><p className="text-[9px] font-bold text-[#7B78A8] uppercase mb-0.5">Saran Siswa</p><p className="text-[11px] text-[#1A1640]">{sesi.saranSiswa}</p></div>}
                                            {sesi.saranOrtu && <div><p className="text-[9px] font-bold text-[#7B78A8] uppercase mb-0.5">Saran Ortu</p><p className="text-[11px] text-[#1A1640]">{sesi.saranOrtu}</p></div>}
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
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
