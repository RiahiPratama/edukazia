import { createClient } from '@/lib/supabase/server'
import { CheckCircle, Clock, AlertCircle, MessageCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'

const STATUS_COLOR: Record<string, string> = {
  hadir: 'bg-green-50 text-green-700 border-green-200',
  izin:  'bg-blue-50 text-blue-700 border-blue-200',
  sakit: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  alpha: 'bg-red-50 text-red-700 border-red-200',
}
const STATUS_LABEL: Record<string, string> = {
  hadir: 'Hadir', izin: 'Izin', sakit: 'Sakit', alpha: 'Alpha'
}

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

export default async function AdminAbsensiPage() {
  const supabase = await createClient()

  // Tanggal hari ini WIT
  const now    = new Date()
  const offset = 9 * 60
  const witNow = new Date(now.getTime() + (offset - now.getTimezoneOffset()) * 60000)
  const today  = witNow.toISOString().split('T')[0]

  // Ambil semua sesi hari ini
  const { data: sessions } = await supabase
    .from('sessions')
    .select(`
      id, scheduled_at, status, zoom_link,
      class_groups(id, label, tutor_id, max_participants,
        courses(name),
        tutors(profile_id, profiles(full_name))
      )
    `)
    .gte('scheduled_at', `${today}T00:00:00`)
    .lte('scheduled_at', `${today}T23:59:59`)
    .order('scheduled_at')

  const sessionIds = (sessions ?? []).map((s: any) => s.id)
  const classIds   = [...new Set((sessions ?? []).map((s: any) => s.class_groups?.id).filter(Boolean))]

  // Ambil enrollments untuk kelas yang punya sesi hari ini
  const { data: enrollments } = classIds.length > 0
    ? await supabase
        .from('enrollments')
        .select('id, student_id, class_group_id')
        .in('class_group_id', classIds)
    : { data: [] }

  // Ambil absensi hari ini
  const { data: attendances } = sessionIds.length > 0
    ? await supabase
        .from('attendances')
        .select('session_id, student_id, status, notes')
        .in('session_id', sessionIds)
    : { data: [] }

  // Ambil nama siswa
  const studentIds = [...new Set((enrollments ?? []).map((e: any) => e.student_id).filter(Boolean))]
  const { data: students } = studentIds.length > 0
    ? await supabase.from('students').select('id, profile_id, relation_phone, relation_name').in('id', studentIds as string[])
    : { data: [] }

  const profileIds = [...new Set((students ?? []).map((s: any) => s.profile_id).filter(Boolean))]
  const { data: profiles } = profileIds.length > 0
    ? await supabase.from('profiles').select('id, full_name').in('id', profileIds as string[])
    : { data: [] }

  const profMap    = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p.full_name]))
  const studentMap = Object.fromEntries((students ?? []).map((s: any) => [s.id, {
    name:  profMap[s.profile_id] ?? 'Siswa',
    phone: s.relation_phone ?? '',
  }]))

  // Build attendance map: sessionId -> studentId -> status
  const attMap: Record<string, Record<string, any>> = {}
  ;(attendances ?? []).forEach((a: any) => {
    if (!attMap[a.session_id]) attMap[a.session_id] = {}
    attMap[a.session_id][a.student_id] = { status: a.status, notes: a.notes ?? '' }
  })

  // Build enroll map: classId -> studentIds
  const enrollMap: Record<string, string[]> = {}
  ;(enrollments ?? []).forEach((e: any) => {
    if (!enrollMap[e.class_group_id]) enrollMap[e.class_group_id] = []
    enrollMap[e.class_group_id].push(e.student_id)
  })

  // Summary hitung
  let totalHadir = 0, totalIzin = 0, totalSakit = 0, totalAlpha = 0, totalBelum = 0
  ;(sessions ?? []).forEach((s: any) => {
    const kelasId  = s.class_groups?.id
    const siswaIds = enrollMap[kelasId] ?? []
    const sesAtt   = attMap[s.id] ?? {}
    siswaIds.forEach((sid: string) => {
      const a = sesAtt[sid]
      if (!a)                        totalBelum++
      else if (a.status === 'hadir') totalHadir++
      else if (a.status === 'izin')  totalIzin++
      else if (a.status === 'sakit') totalSakit++
      else if (a.status === 'alpha') totalAlpha++
    })
  })

  const WA_ADMIN = process.env.NEXT_PUBLIC_WA_NUMBER?.replace(/\D/g, '') ?? ''

  function buildWAOrtu(siswaName: string, kelasLabel: string, waktu: string, status: string, notes: string) {
    const statusText = status === 'izin' ? 'izin' : status === 'sakit' ? 'sakit' : 'tidak hadir (tanpa keterangan)'
    const notesText  = notes ? ` Keterangan: ${notes}.` : ''
    return encodeURIComponent(
      `Halo, kami dari EduKazia ingin menginformasikan bahwa ${siswaName} ${statusText} pada sesi ${kelasLabel} hari ini pukul ${waktu} WIT.${notesText} Terima kasih.`
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-[#1A1640] font-['Sora']">Rekap Absensi</h1>
        <p className="text-sm text-[#7B78A8] mt-1">{fmtTanggal()}</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <div className="bg-white rounded-2xl border border-green-100 p-4">
          <div className="text-2xl font-black text-green-600">{totalHadir}</div>
          <div className="text-xs text-[#7B78A8] font-semibold mt-1">Hadir</div>
        </div>
        <div className="bg-white rounded-2xl border border-blue-100 p-4">
          <div className="text-2xl font-black text-blue-600">{totalIzin}</div>
          <div className="text-xs text-[#7B78A8] font-semibold mt-1">Izin</div>
        </div>
        <div className="bg-white rounded-2xl border border-yellow-100 p-4">
          <div className="text-2xl font-black text-yellow-600">{totalSakit}</div>
          <div className="text-xs text-[#7B78A8] font-semibold mt-1">Sakit</div>
        </div>
        <div className="bg-white rounded-2xl border border-red-100 p-4">
          <div className="text-2xl font-black text-red-600">{totalAlpha}</div>
          <div className="text-xs text-[#7B78A8] font-semibold mt-1">Alpha</div>
        </div>
        <div className="bg-white rounded-2xl border border-[#E5E3FF] p-4">
          <div className="text-2xl font-black text-[#7B78A8]">{totalBelum}</div>
          <div className="text-xs text-[#7B78A8] font-semibold mt-1">Belum Diabsen</div>
        </div>
      </div>

      {/* Daftar Sesi */}
      {!sessions || sessions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E5E3FF] p-12 text-center">
          <Clock size={36} strokeWidth={1.5} className="text-[#C4BFFF] mx-auto mb-3"/>
          <p className="text-sm font-semibold text-[#7B78A8]">Tidak ada sesi hari ini</p>
        </div>
      ) : (
        <div className="space-y-4">
          {(sessions as any[]).map((s: any) => {
            const kelasId    = s.class_groups?.id
            const kelasLabel = s.class_groups?.label ?? '—'
            const tutorName  = s.class_groups?.tutors?.profiles?.full_name ?? '—'
            const courseName = s.class_groups?.courses?.name ?? '—'
            const siswaIds   = enrollMap[kelasId] ?? []
            const sesAtt     = attMap[s.id] ?? {}
            const sudahDiabsen = Object.keys(sesAtt).length > 0
            const waktu      = fmtTime(s.scheduled_at)

            const alphaList = siswaIds.filter((sid: string) => sesAtt[sid]?.status === 'alpha')

            return (
              <div key={s.id} className="bg-white rounded-2xl border border-[#E5E3FF] overflow-hidden">
                {/* Header sesi */}
                <div className="px-5 py-4 border-b border-[#F0EFFF]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-black text-[#5C4FE5]">{waktu} WIT</span>
                        <span className="text-sm font-bold text-[#1A1640]">{kelasLabel}</span>
                        {sudahDiabsen ? (
                          <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-700">
                            <CheckCircle size={10}/> Sudah diabsen
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F0EFFF] text-[#7B78A8]">
                            <Clock size={10}/> Belum diabsen
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[#7B78A8] mt-1">
                        {courseName} · Tutor: {tutorName}
                      </div>
                    </div>
                    {s.zoom_link && (
                      <a href={s.zoom_link} target="_blank" rel="noopener noreferrer"
                        className="flex-shrink-0 text-xs px-3 py-1.5 bg-blue-50 text-blue-700 rounded-xl font-semibold hover:bg-blue-100 transition">
                        Buka Zoom
                      </a>
                    )}
                  </div>
                </div>

                {/* Daftar siswa */}
                <div className="divide-y divide-[#F0EFFF]">
                  {siswaIds.length === 0 ? (
                    <div className="px-5 py-3 text-xs text-[#7B78A8]">Belum ada siswa terdaftar</div>
                  ) : (
                    siswaIds.map((sid: string) => {
                      const siswa  = studentMap[sid] ?? { name: 'Siswa', phone: '' }
                      const att    = sesAtt[sid]
                      const status = att?.status ?? null
                      const notes  = att?.notes ?? ''
                      const isAbsen = status && status !== 'hadir'

                      return (
                        <div key={sid} className="flex items-center gap-3 px-5 py-3 hover:bg-[#F7F6FF] transition-colors">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                            style={{ background: '#EEEDFE', color: '#3C3489' }}>
                            {getInitials(siswa.name)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-[#1A1640] truncate">{siswa.name}</div>
                            {notes && <div className="text-xs text-[#7B78A8] italic">"{notes}"</div>}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {status ? (
                              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${STATUS_COLOR[status]}`}>
                                {STATUS_LABEL[status]}
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full border border-gray-200 bg-gray-50 text-gray-400">
                                Belum diabsen
                              </span>
                            )}
                            {isAbsen && siswa.phone && (
                              <a
                                href={`https://wa.me/${siswa.phone.replace(/\D/g, '')}?text=${buildWAOrtu(siswa.name, kelasLabel, waktu, status, notes)}`}
                                target="_blank" rel="noopener noreferrer"
                                title="Kirim WA ke Ortu"
                                className="flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded-lg text-[10px] font-semibold hover:bg-green-100 transition">
                                <MessageCircle size={11}/> WA Ortu
                              </a>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>

                {/* Alert alpha */}
                {alphaList.length > 0 && (
                  <div className="mx-4 mb-4 flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl">
                    <AlertCircle size={14} className="text-red-600 flex-shrink-0"/>
                    <span className="text-xs font-semibold text-red-700">
                      {alphaList.length} siswa alpha — segera hubungi orang tua
                    </span>
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
