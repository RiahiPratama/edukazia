import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Jadwal · Portal Orang Tua · EduKazia' }

function fmtWIT(iso: string, opts?: Intl.DateTimeFormatOptions) {
  return new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jayapura', ...opts })
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'Asia/Jayapura',
  })
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('id-ID', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jayapura',
  })
}

const CHILD_COLORS = ['#E6B800', '#1D9E75', '#5C4FE5', '#D85A30', '#639922']
const CHILD_BG     = ['#FAEEDA', '#E1F5EE', '#EEEDFE', '#FAECE7', '#EAF3DE']
const CHILD_TEXT   = ['#412402', '#085041', '#3C3489', '#4A1B0C', '#173404']

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
}

export default async function OrtuJadwalPage() {
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
    id:         s.id,
    full_name:  (Array.isArray(s.profiles) ? s.profiles[0] : s.profiles)?.full_name ?? '(Tanpa nama)',
    grade:      s.grade,
    color:      CHILD_COLORS[idx % CHILD_COLORS.length],
    bgColor:    CHILD_BG[idx % CHILD_BG.length],
    textColor:  CHILD_TEXT[idx % CHILD_TEXT.length],
  }))

  const studentIds = students.map(s => s.id)

  // Enrollments aktif
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('id, student_id, class_group_id, status, end_date, expired_at, status_override, paid_at')
    .in('student_id', studentIds)

  const activeEnrollments = (enrollments ?? []).filter((e: any) => {
    const now = new Date()
    if (e.status_override === 'active') return true
    if (e.status_override === 'expired') return false
    if (e.end_date && new Date(e.end_date) < now) return false
    if (e.expired_at && new Date(e.expired_at) < now) return false
    return e.status === 'active'
  })

  const classGroupIds = [...new Set(activeEnrollments.map((e: any) => e.class_group_id).filter(Boolean))]

  // Class groups
  const { data: classGroups } = classGroupIds.length > 0
    ? await supabase.from('class_groups').select('id, label, tutor_id, zoom_link').in('id', classGroupIds)
    : { data: [] }

  // Tutor names
  const tutorIds = [...new Set((classGroups ?? []).map((cg: any) => cg.tutor_id).filter(Boolean))]
  const { data: tutors } = tutorIds.length > 0
    ? await supabase.from('profiles').select('id, full_name').in('id', tutorIds)
    : { data: [] }

  // Sessions: hari ini s/d 28 hari ke depan
  const nowWIT   = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jayapura' }))
  const rangeS   = new Date(nowWIT); rangeS.setHours(0, 0, 0, 0)
  const rangeE   = new Date(nowWIT); rangeE.setDate(rangeE.getDate() + 28)
  const toUTC    = (d: Date) => new Date(d.getTime() - 9 * 60 * 60 * 1000).toISOString()

  const { data: sessions } = classGroupIds.length > 0
    ? await supabase
        .from('sessions')
        .select('id, class_group_id, scheduled_at, status, zoom_link')
        .in('class_group_id', classGroupIds)
        .gte('scheduled_at', toUTC(rangeS))
        .lte('scheduled_at', toUTC(rangeE))
        .order('scheduled_at')
    : { data: [] }

  // Attendances
  const sessionIds = (sessions ?? []).map((s: any) => s.id)
  const { data: attendances } = sessionIds.length > 0
    ? await supabase
        .from('attendances')
        .select('session_id, student_id, status')
        .in('session_id', sessionIds)
        .in('student_id', studentIds)
    : { data: [] }

  // Susun sessions dengan info lengkap
  const sessionsWithInfo = (sessions ?? []).map((s: any) => {
    const cg      = (classGroups ?? []).find((c: any) => c.id === s.class_group_id)
    const tutor   = (tutors ?? []).find((t: any) => t.id === cg?.tutor_id)
    // cari enrollment untuk kelas ini (dan siapa siswa-nya)
    const enroll  = activeEnrollments.find((e: any) => e.class_group_id === s.class_group_id)
    const student = students.find(st => st.id === enroll?.student_id)
    const att     = (attendances ?? []).find((a: any) => a.session_id === s.id && a.student_id === enroll?.student_id)
    const locked  = enroll && !enroll.paid_at

    return {
      id:          s.id,
      scheduledAt: s.scheduled_at,
      status:      s.status,
      classLabel:  cg?.label ?? '—',
      tutorName:   tutor?.full_name ?? '—',
      zoomLink:    s.zoom_link ?? cg?.zoom_link ?? null,
      student:     student ?? null,
      attendance:  att?.status ?? null,
      locked,
    }
  })

  // Group by tanggal
  const byDate: Record<string, typeof sessionsWithInfo> = {}
  sessionsWithInfo.forEach(s => {
    const key = new Date(s.scheduledAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Jayapura' })
    if (!byDate[key]) byDate[key] = []
    byDate[key].push(s)
  })

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jayapura' })

  const attBadge: Record<string, { bg: string; text: string; label: string }> = {
    hadir: { bg: '#EAF3DE', text: '#27500A', label: 'Hadir' },
    izin:  { bg: '#E6F1FB', text: '#0C447C', label: 'Izin' },
    sakit: { bg: '#FAEEDA', text: '#412402', label: 'Sakit' },
    alpha: { bg: '#FCEBEB', text: '#791F1F', label: 'Alpha' },
  }
  const statusBadge: Record<string, { bg: string; text: string; label: string }> = {
    scheduled:  { bg: '#EEEDFE', text: '#3C3489', label: 'Terjadwal' },
    completed:  { bg: '#EAF3DE', text: '#27500A', label: 'Selesai' },
    cancelled:  { bg: '#FCEBEB', text: '#791F1F', label: 'Dibatalkan' },
  }

  return (
    <div className="px-4 lg:px-6 py-5 max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[16px] font-bold text-stone-800">Jadwal Semua Anak</h2>
          <p className="text-[11px] text-stone-400 mt-0.5">
            {students.length} anak · 4 minggu ke depan
          </p>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-3 mb-4 flex-wrap">
        {students.map(s => (
          <div key={s.id} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
            <span className="text-[10px] text-stone-500">{s.full_name.split(' ')[0]}</span>
          </div>
        ))}
      </div>

      {Object.keys(byDate).length === 0 ? (
        <div className="bg-white border border-stone-100 rounded-2xl py-12 text-center">
          <p className="text-[13px] font-semibold text-stone-400">Tidak ada jadwal</p>
          <p className="text-[11px] text-stone-300 mt-1">dalam rentang waktu ini</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {Object.entries(byDate).map(([date, items]) => {
            const isToday = date === today
            return (
              <div key={date}>
                {/* Date header */}
                <div className="flex items-center gap-2 mb-2">
                  <div className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold ${
                    isToday
                      ? 'bg-amber-500 text-white'
                      : 'bg-stone-100 text-stone-500'
                  }`}>
                    {isToday ? 'Hari ini' : new Date(date + 'T00:00:00').toLocaleDateString('id-ID', {
                      weekday: 'short', day: 'numeric', month: 'short',
                    })}
                  </div>
                  <div className="flex-1 h-px bg-stone-100" />
                </div>

                {/* Sessions */}
                <div className="flex flex-col gap-2">
                  {items.map(item => {
                    const badge = item.attendance
                      ? attBadge[item.attendance]
                      : statusBadge[item.status] ?? statusBadge.scheduled
                    return (
                      <div key={item.id} className={`bg-white border rounded-xl overflow-hidden ${
                        item.locked ? 'opacity-70' : ''
                      }`} style={{
                        borderLeft: `3px solid ${item.student?.color ?? '#ccc'}`,
                        borderTop: '0.5px solid #f0f0f0',
                        borderRight: '0.5px solid #f0f0f0',
                        borderBottom: '0.5px solid #f0f0f0',
                      }}>
                        <div className="flex items-center gap-3 px-3 py-2.5">
                          {/* Time */}
                          <div className="w-12 text-right flex-shrink-0">
                            <p className="text-[11px] font-semibold text-stone-700">
                              {fmtTime(item.scheduledAt)}
                            </p>
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className="text-[12px] font-semibold text-stone-700">{item.classLabel}</p>
                              {item.locked && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-500 border border-red-200">
                                  Terkunci
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {item.student && (
                                <div className="flex items-center gap-1">
                                  <div className="w-3.5 h-3.5 rounded-sm flex items-center justify-center text-[7px] font-bold"
                                    style={{ background: item.student.bgColor, color: item.student.textColor }}>
                                    {item.student.full_name[0]}
                                  </div>
                                  <span className="text-[10px] text-stone-400">{item.student.full_name.split(' ')[0]}</span>
                                </div>
                              )}
                              <span className="text-[10px] text-stone-300">·</span>
                              <span className="text-[10px] text-stone-400">{item.tutorName}</span>
                            </div>
                          </div>

                          {/* Badge & Zoom */}
                          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                              style={{ background: badge.bg, color: badge.text }}>
                              {badge.label}
                            </span>
                            {item.zoomLink && item.status === 'scheduled' && !item.locked && (
                              <a href={item.zoomLink} target="_blank" rel="noopener noreferrer"
                                className="text-[10px] text-blue-500 hover:underline">
                                Zoom →
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
