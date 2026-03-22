import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Laporan · Portal Orang Tua · EduKazia' }

const CHILD_COLORS = ['#E6B800', '#1D9E75', '#5C4FE5', '#D85A30', '#639922']
const CHILD_BG     = ['#FAEEDA', '#E1F5EE', '#EEEDFE', '#FAECE7', '#EAF3DE']
const CHILD_TEXT   = ['#412402', '#085041', '#3C3489', '#4A1B0C', '#173404']

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jayapura',
  })
}

export default async function OrtuLaporanPage() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cs) { try { cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {} },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const userId = session.user.id

  // Siswa
  const { data: studentRows } = await supabase
    .from('students')
    .select(`id, grade, school, profiles!students_profile_id_fkey(full_name)`)
    .eq('parent_profile_id', userId)

  if (!studentRows || studentRows.length === 0) redirect('/login')

  const students = (studentRows as any[]).map((s, idx) => ({
    id:        s.id,
    full_name: (Array.isArray(s.profiles) ? s.profiles[0] : s.profiles)?.full_name ?? '(Tanpa nama)',
    grade:     s.grade,
    color:     CHILD_COLORS[idx % CHILD_COLORS.length],
    bgColor:   CHILD_BG[idx % CHILD_BG.length],
    textColor: CHILD_TEXT[idx % CHILD_TEXT.length],
  }))

  const studentIds = students.map(s => s.id)

  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('student_id, class_group_id')
    .in('student_id', studentIds)

  const classGroupIds = [...new Set((enrollments ?? []).map((e: any) => e.class_group_id).filter(Boolean))]

  const { data: sessions } = classGroupIds.length > 0
    ? await supabase
        .from('sessions')
        .select('id, class_group_id, scheduled_at, status')
        .in('class_group_id', classGroupIds)
        .eq('status', 'completed')
        .order('scheduled_at', { ascending: false })
        .limit(100)
    : { data: [] }

  const sessionIds = (sessions ?? []).map((s: any) => s.id)

  // Reports — termasuk recording_url
  const { data: reports } = sessionIds.length > 0
    ? await supabase
        .from('session_reports')
        .select('session_id, student_id, materi, perkembangan, saran_ortu, recording_url, created_at')
        .in('session_id', sessionIds)
        .in('student_id', studentIds)
        .order('created_at', { ascending: false })
    : { data: [] }

  const { data: attendances } = sessionIds.length > 0
    ? await supabase
        .from('attendances')
        .select('session_id, student_id, status')
        .in('session_id', sessionIds)
        .in('student_id', studentIds)
    : { data: [] }

  const { data: classGroups } = classGroupIds.length > 0
    ? await supabase.from('class_groups').select('id, label, tutor_id').in('id', classGroupIds)
    : { data: [] }

  const tutorIds = [...new Set((classGroups ?? []).map((cg: any) => cg.tutor_id).filter(Boolean))]
  const { data: tutors } = tutorIds.length > 0
    ? await supabase.from('profiles').select('id, full_name').in('id', tutorIds)
    : { data: [] }

  const reportsBySiswaThenClass: Record<string, Record<string, any[]>> = {}
  students.forEach(s => { reportsBySiswaThenClass[s.id] = {} })

  ;(reports ?? []).forEach((r: any) => {
    const sesi    = (sessions ?? []).find((s: any) => s.id === r.session_id)
    const cg      = (classGroups ?? []).find((c: any) => c.id === sesi?.class_group_id)
    const tutor   = (tutors ?? []).find((t: any) => t.id === cg?.tutor_id)
    const att     = (attendances ?? []).find((a: any) => a.session_id === r.session_id && a.student_id === r.student_id)
    const cgId    = cg?.id ?? 'unknown'

    if (!reportsBySiswaThenClass[r.student_id]) return
    if (!reportsBySiswaThenClass[r.student_id][cgId]) {
      reportsBySiswaThenClass[r.student_id][cgId] = []
    }
    reportsBySiswaThenClass[r.student_id][cgId].push({
      sessionId:    r.session_id,
      scheduledAt:  sesi?.scheduled_at ?? r.created_at,
      classLabel:   cg?.label ?? '—',
      tutorName:    tutor?.full_name ?? '—',
      materi:       r.materi,
      perkembangan: r.perkembangan,
      saranOrtu:    r.saran_ortu,
      recordingUrl: r.recording_url ?? null,
      attendance:   att?.status ?? null,
      createdAt:    r.created_at,
    })
  })

  const attBadge: Record<string, string> = {
    hadir: 'bg-green-50 text-green-700 border-green-200',
    izin:  'bg-blue-50  text-blue-700  border-blue-200',
    sakit: 'bg-amber-50 text-amber-700 border-amber-200',
    alpha: 'bg-red-50   text-red-600   border-red-200',
  }
  const attLabel: Record<string, string> = {
    hadir: 'Hadir', izin: 'Izin', sakit: 'Sakit', alpha: 'Alpha',
  }

  return (
    <div className="px-4 lg:px-6 py-5 max-w-2xl">
      <div className="mb-5">
        <h2 className="text-[16px] font-bold text-stone-800">Laporan Perkembangan</h2>
        <p className="text-[11px] text-stone-400 mt-0.5">Catatan tutor untuk semua anak</p>
      </div>

      {students.map(student => {
        const classBuckets = reportsBySiswaThenClass[student.id] ?? {}
        const totalReports = Object.values(classBuckets).flat().length
        return (
          <div key={student.id} className="mb-6">
            {/* Student header */}
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                style={{ background: student.bgColor, color: student.textColor }}>
                {initials(student.full_name)}
              </div>
              <span className="text-[12px] font-bold text-stone-700">{student.full_name}</span>
              <div className="flex-1 h-px bg-stone-100" />
              {student.grade && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                  style={{ background: student.bgColor, color: student.textColor }}>
                  {student.grade}
                </span>
              )}
            </div>

            {totalReports === 0 ? (
              <div className="bg-white border border-stone-100 rounded-xl py-6 text-center mb-3">
                <p className="text-[11px] text-stone-300">Belum ada laporan dari tutor</p>
              </div>
            ) : (
              Object.entries(classBuckets).map(([cgId, reps]) => (
                <div key={cgId} className="bg-white border border-stone-100 rounded-xl overflow-hidden mb-3">
                  {/* Class header */}
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-stone-50"
                    style={{ borderLeft: `3px solid ${student.color}` }}>
                    <div>
                      <p className="text-[12px] font-semibold text-stone-700">{reps[0].classLabel}</p>
                      <p className="text-[10px] text-stone-400">{reps[0].tutorName}</p>
                    </div>
                    <span className="text-[10px] text-stone-300">{reps.length} laporan</span>
                  </div>

                  {/* Reports */}
                  {reps.map((rep, ridx) => (
                    <div key={ridx} className={`px-4 py-3 ${ridx > 0 ? 'border-t border-stone-50' : ''}`}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[11px] font-semibold text-stone-500">
                          {fmtDate(rep.scheduledAt)}
                        </p>
                        {rep.attendance && (
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${attBadge[rep.attendance] ?? 'bg-stone-50 text-stone-500 border-stone-200'}`}>
                            {attLabel[rep.attendance] ?? rep.attendance}
                          </span>
                        )}
                      </div>

                      {rep.materi && (
                        <div className="mb-1.5">
                          <span className="text-[9px] font-bold text-stone-400 uppercase tracking-wider">Materi · </span>
                          <span className="text-[11px] text-stone-600">{rep.materi}</span>
                        </div>
                      )}
                      {rep.perkembangan && (
                        <div className="mb-1.5">
                          <span className="text-[9px] font-bold text-stone-400 uppercase tracking-wider">Perkembangan · </span>
                          <span className="text-[11px] text-stone-600">{rep.perkembangan}</span>
                        </div>
                      )}
                      {rep.saranOrtu && (
                        <div className="mt-2 px-3 py-2 rounded-lg"
                          style={{ background: student.bgColor + '60', borderLeft: `2px solid ${student.color}` }}>
                          <p className="text-[9px] font-bold uppercase tracking-wider mb-1"
                            style={{ color: student.textColor }}>
                            Catatan untuk Orang Tua
                          </p>
                          <p className="text-[11px]" style={{ color: student.textColor }}>
                            {rep.saranOrtu}
                          </p>
                        </div>
                      )}

                      {/* ── Banner Rekaman ── */}
                      {rep.recordingUrl && (
                        <div className="mt-2 flex items-center gap-2.5 px-3 py-2 rounded-lg"
                          style={{ background: '#F0F4FF', border: '0.5px solid #C7D4F7' }}>
                          {/* Icon kamera */}
                          <div className="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center"
                            style={{ background: '#5C4FE5' }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                              <path d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/>
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-semibold text-[#3C3489]">
                              Rekaman kelas tersedia
                            </p>
                            <p className="text-[9px] text-[#5C4FE5]">
                              Download untuk review materi di rumah
                            </p>
                          </div>
                          <a
                            href={rep.recordingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            download
                            className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold"
                            style={{ background: '#5C4FE5', color: '#fff' }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="white">
                              <path d="M12 16l-6-6h4V4h4v6h4l-6 6z"/>
                              <path d="M20 18H4v2h16v-2z"/>
                            </svg>
                            Download
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        )
      })}
    </div>
  )
}
