import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getActiveChild, getEnrollmentStatus } from '@/lib/siswa/helpers'
import JadwalClient from './JadwalClient'

export const metadata = { title: 'Jadwal · EduKazia' }

export default async function JadwalPage() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {}
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('id, role').eq('id', session.user.id).single()

  if (!profile || !['student', 'parent'].includes(profile.role)) redirect('/login')

  const isParent = profile.role === 'parent'

  // Step 1: Ambil data siswa
  const { data: childrenList } = await supabase
    .from('students')
    .select(`
      id, grade, school, status, relation_role,
      profile:profiles!students_profile_id_fkey(id, full_name)
    `)
    .eq(isParent ? 'parent_profile_id' : 'profile_id', session.user.id)

  // FIX: flatten profile array + cast any
  const activeChild = getActiveChild(
    (childrenList ?? []).map((c: any) => ({
      ...c,
      enrollments: [],
      profile: Array.isArray(c.profile) ? c.profile[0] ?? null : c.profile,
    }))
  )

  if (!activeChild) {
    return (
      <div className="px-4 pt-6 text-center">
        <p className="text-sm text-[#9B97B2]">Tidak ada data siswa ditemukan.</p>
      </div>
    )
  }

  // Step 2: Ambil enrollments terpisah
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('id, status, end_date, expired_at, status_override, class_group_id')
    .eq('student_id', activeChild.id)

  // FIX: cast (e: any)
  const isExpired = (enrollments ?? []).length > 0 && (enrollments ?? []).every((e: any) => getEnrollmentStatus(e) === 'expired')
  const activeEnrollments = (enrollments ?? []).filter((e: any) => getEnrollmentStatus(e) === 'active')
  const classGroupIds = activeEnrollments.map((e: any) => e.class_group_id).filter(Boolean)

  // Step 3: Ambil sesi
  const nowWIT = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jayapura' }))
  const rangeStart = new Date(nowWIT); rangeStart.setDate(rangeStart.getDate() - 7); rangeStart.setHours(0,0,0,0)
  const rangeEnd   = new Date(nowWIT); rangeEnd.setDate(rangeEnd.getDate() + 28);    rangeEnd.setHours(23,59,59,999)
  const toUTC = (d: Date) => new Date(d.getTime() - 9*60*60*1000).toISOString()

  const { data: sessions } = classGroupIds.length > 0
    ? await supabase
        .from('sessions')
        .select('id, scheduled_at, status, zoom_link, reschedule_reason, rescheduled_at, original_scheduled_at, class_group_id')
        .in('class_group_id', classGroupIds)
        .gte('scheduled_at', toUTC(rangeStart))
        .lte('scheduled_at', toUTC(rangeEnd))
        .order('scheduled_at')
    : { data: [] }

  // Ambil class_groups info terpisah
  const { data: cgForSessions } = classGroupIds.length > 0
    ? await supabase
        .from('class_groups')
        .select('id, label, zoom_link, course_id, tutor_id')
        .in('id', classGroupIds)
    : { data: [] }

  const cgCourseIds = (cgForSessions ?? []).map((cg: any) => cg.course_id).filter(Boolean)
  const cgTutorIds  = (cgForSessions ?? []).map((cg: any) => cg.tutor_id).filter(Boolean)

  const { data: cgCourses } = cgCourseIds.length > 0
    ? await supabase.from('courses').select('id, name, color').in('id', cgCourseIds)
    : { data: [] }

  const { data: cgTutors } = cgTutorIds.length > 0
    ? await supabase.from('profiles').select('id, full_name').in('id', cgTutorIds)
    : { data: [] }

  const cgSessionMap: Record<string, any> = {}
  ;(cgForSessions ?? []).forEach((cg: any) => {
    cgSessionMap[cg.id] = {
      ...cg,
      courses: (cgCourses ?? []).find((c: any) => c.id === cg.course_id) ?? null,
      profiles: (cgTutors ?? []).find((p: any) => p.id === cg.tutor_id) ?? null,
    }
  })

  // Gabungkan sessions dengan class_groups info
  const sessionsWithCG = (sessions ?? []).map((s: any) => ({
    ...s,
    class_groups: cgSessionMap[s.class_group_id] ?? null
  }))

  // Step 4: Ambil attendances
  const sessionIds = (sessionsWithCG ?? []).map((s: any) => s.id)
  const { data: attendances } = sessionIds.length > 0
    ? await supabase
        .from('attendances')
        .select('id, session_id, status, notes')
        .eq('student_id', activeChild.id)
        .in('session_id', sessionIds)
    : { data: [] }

  const sessionsWithAtt = (sessionsWithCG ?? []).map((s: any) => ({
    ...s,
    attendance: (attendances ?? []).find((a: any) => a.session_id === s.id) ?? null,
  }))

  return (
    <JadwalClient
      sessions={sessionsWithAtt}
      isExpired={isExpired}
      studentName={activeChild.profile.full_name}
    />
  )
}
