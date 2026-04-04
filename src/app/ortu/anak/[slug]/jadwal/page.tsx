import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('id-ID', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jayapura',
  })
}

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

export default async function OrtuAnakSlugJadwalPage({ params }: { params: Promise<{ slug: string }> }) {
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

  const { slug } = await params

  // Lookup student by slug + verifikasi milik ortu ini
  const { data: slugRow } = await supabase
    .from('students')
    .select('id')
    .eq('slug', slug)
    .eq('parent_profile_id', session.user.id)
    .single()

  const studentId = slugRow?.id ?? null
  if (!studentId) redirect('/ortu/dashboard')

  // Verifikasi siswa milik ortu ini
  const { data: student } = await supabase
    .from('students')
    .select(`id, grade, profiles!students_profile_id_fkey(full_name)`)
    .eq('id', studentId)
    .single()

  if (!student) redirect('/ortu/dashboard')

  const studentName = (Array.isArray(student.profiles) ? student.profiles[0] : student.profiles)?.full_name ?? '(Tanpa nama)'

  // Enrollments aktif saja
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('id, class_group_id, status')
    .eq('student_id', studentId)
    .eq('status', 'active')

  const cgIds = [...new Set((enrollments ?? []).map((e: any) => e.class_group_id).filter(Boolean))]

  const { data: classGroups } = cgIds.length > 0
    ? await supabase.from('class_groups').select('id, label, tutor_id, zoom_link').in('id', cgIds)
    : { data: [] }

  const tutorIds = [...new Set((classGroups ?? []).map((cg: any) => cg.tutor_id).filter(Boolean))]
  const { data: tutors } = tutorIds.length > 0
    ? await supabase.from('profiles').select('id, full_name').in('id', tutorIds)
    : { data: [] }

  // Sessions: hari ini s/d 28 hari ke depan
  const nowWIT = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jayapura' }))
  const rangeS = new Date(nowWIT); rangeS.setHours(0, 0, 0, 0)
  const rangeE = new Date(nowWIT); rangeE.setDate(rangeE.getDate() + 28)
  const toUTC  = (d: Date) => new Date(d.getTime() - 9 * 60 * 60 * 1000).toISOString()

  const { data: sessions } = cgIds.length > 0
    ? await supabase
        .from('sessions')
        .select('id, class_group_id, scheduled_at, status, zoom_link')
        .in('class_group_id', cgIds)
        .gte('scheduled_at', toUTC(rangeS))
        .lte('scheduled_at', toUTC(rangeE))
        .order('scheduled_at')
    : { data: [] }

  const sessionIds = (sessions ?? []).map((s: any) => s.id)
  const { data: attendances } = sessionIds.length > 0
    ? await supabase
        .from('attendances')
        .select('session_id, status')
        .eq('student_id', studentId)
        .in('session_id', sessionIds)
    : { data: [] }

  const sessionsWithInfo = (sessions ?? []).map((s: any) => {
    const cg    = (classGroups ?? []).find((c: any) => c.id === s.class_group_id)
    const tutor = (tutors ?? []).find((t: any) => t.id === cg?.tutor_id)
    const att   = (attendances ?? []).find((a: any) => a.session_id === s.id)
    return {
      id:          s.id,
      scheduledAt: s.scheduled_at,
      status:      s.status,
      classLabel:  cg?.label ?? '—',
      tutorName:   tutor?.full_name ?? '—',
      zoomLink:    s.zoom_link ?? cg?.zoom_link ?? null,
      attendance:  att?.status ?? null,
    }
  })

  const byDate: Record<string, typeof sessionsWithInfo> = {}
  sessionsWithInfo.forEach(s => {
    const key = new Date(s.scheduledAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Jayapura' })
    if (!byDate[key]) byDate[key] = []
    byDate[key].push(s)
  })

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jayapura' })

  return (
    <div className="px-4 lg:px-6 py-5 max-w-xl">
      <div className="mb-4">
        <h2 className="text-[15px] font-bold text-stone-800">Jadwal</h2>
        <p className="text-[11px] text-stone-400 mt-0.5">{studentName} · 4 minggu ke depan</p>
      </div>

      {Object.keys(byDate).length === 0 ? (
        <div className="bg-white border border-stone-100 rounded-2xl py-12 text-center">
          <p className="text-[12px] text-stone-400">Tidak ada jadwal dalam rentang ini</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {Object.entries(byDate).map(([date, items]) => {
            const isToday = date === today
            return (
              <div key={date}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold ${
                    isToday ? 'bg-[#5C4FE5] text-white' : 'bg-stone-100 text-stone-500'
                  }`}>
                    {isToday ? 'Hari ini' : new Date(date + 'T00:00:00').toLocaleDateString('id-ID', {
                      weekday: 'short', day: 'numeric', month: 'short',
                    })}
                  </div>
                  <div className="flex-1 h-px bg-stone-100" />
                </div>

                {items.map(item => {
                  const badge = item.attendance
                    ? attBadge[item.attendance]
                    : statusBadge[item.status] ?? statusBadge.scheduled
                  return (
                    <div key={item.id}
                      className="bg-white border border-stone-100 rounded-xl overflow-hidden mb-2"
                      style={{ borderLeft: '3px solid #5C4FE5' }}>
                      <div className="flex items-center gap-3 px-3 py-2.5">
                        <div className="w-12 text-right flex-shrink-0">
                          <p className="text-[11px] font-semibold text-stone-700">{fmtTime(item.scheduledAt)}</p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-semibold text-stone-700">{item.classLabel}</p>
                          <p className="text-[10px] text-stone-400 mt-0.5">{item.tutorName}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                            style={{ background: badge.bg, color: badge.text }}>
                            {badge.label}
                          </span>
                          {item.zoomLink && item.status === 'scheduled' && (
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
            )
          })}
        </div>
      )}
    </div>
  )
}
