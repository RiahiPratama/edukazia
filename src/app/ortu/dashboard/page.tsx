import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import OrtuDashboardClient from './DashboardClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Beranda Orang Tua · EduKazia' }

export default async function OrtuDashboardPage() {
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

  // Ambil profil
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone, role')
    .eq('id', userId)
    .single()

  if (!profile) redirect('/login')

  // Ambil daftar anak
  const { data: studentRows } = await supabase
    .from('students')
    .select(`id, grade, school, relation_role,
      profiles!students_profile_id_fkey(id, full_name)`)
    .eq('parent_profile_id', userId)

  if (!studentRows || studentRows.length === 0) redirect('/login')

  const students = (studentRows as any[]).map(s => ({
    id:            s.id,
    full_name:     (Array.isArray(s.profiles) ? s.profiles[0] : s.profiles)?.full_name ?? '(Tanpa nama)',
    grade:         s.grade,
    school:        s.school,
    relation_role: s.relation_role,
  }))

  const studentIds = students.map(s => s.id)

  // Ambil enrollments semua anak
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select(`id, student_id, status, end_date, expired_at, status_override,
      session_start_offset, sessions_total, package_id,
      class_group_id`)
    .in('student_id', studentIds)

  const classGroupIds = [...new Set((enrollments ?? []).map((e: any) => e.class_group_id).filter(Boolean))]

  // Ambil class_groups
  const { data: classGroups } = classGroupIds.length > 0
    ? await supabase
        .from('class_groups')
        .select('id, label, status, class_type_id, tutor_id, zoom_link')
        .in('id', classGroupIds)
    : { data: [] }

  // Ambil courses dan tutors
  const tutorIds = [...new Set((classGroups ?? []).map((cg: any) => cg.tutor_id).filter(Boolean))]
  const { data: tutors } = tutorIds.length > 0
    ? await supabase.from('profiles').select('id, full_name').in('id', tutorIds)
    : { data: [] }

  // Ambil sessions upcoming (7 hari ke depan) untuk semua kelas
  const nowWIT = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jayapura' }))
  const plus7  = new Date(nowWIT); plus7.setDate(plus7.getDate() + 7)
  const toUTC  = (d: Date) => new Date(d.getTime() - 9 * 60 * 60 * 1000).toISOString()

  const { data: upcomingSessions } = classGroupIds.length > 0
    ? await supabase
        .from('sessions')
        .select('id, class_group_id, scheduled_at, status, zoom_link')
        .in('class_group_id', classGroupIds)
        .eq('status', 'scheduled')
        .gte('scheduled_at', toUTC(nowWIT))
        .lte('scheduled_at', toUTC(plus7))
        .order('scheduled_at')
    : { data: [] }

  // Ambil attendances bulan ini untuk kehadiran
  const startMonth = new Date(nowWIT.getFullYear(), nowWIT.getMonth(), 1)
  const allSessionIds_month = classGroupIds.length > 0
    ? (await supabase
        .from('sessions')
        .select('id, class_group_id')
        .in('class_group_id', classGroupIds)
        .eq('status', 'completed')
        .gte('scheduled_at', toUTC(startMonth))
      ).data ?? []
    : []

  const allSessionIds = allSessionIds_month.map((s: any) => s.id)
  const { data: attendances } = allSessionIds.length > 0
    ? await supabase
        .from('attendances')
        .select('session_id, student_id, status')
        .in('session_id', allSessionIds)
        .in('student_id', studentIds)
    : { data: [] }

  // Ambil laporan terbaru (activity feed)
  const allCompletedIds = classGroupIds.length > 0
    ? (await supabase
        .from('sessions')
        .select('id, class_group_id, scheduled_at')
        .in('class_group_id', classGroupIds)
        .eq('status', 'completed')
        .order('scheduled_at', { ascending: false })
        .limit(20)
      ).data ?? []
    : []

  const completedIds = allCompletedIds.map((s: any) => s.id)
  const { data: recentReports } = completedIds.length > 0
    ? await supabase
        .from('session_reports')
        .select('session_id, student_id, materi, perkembangan, saran_ortu, created_at')
        .in('session_id', completedIds)
        .in('student_id', studentIds)
        .order('created_at', { ascending: false })
        .limit(10)
    : { data: [] }

  // Susun data per anak
  const childrenData = students.map(student => {
    const studentEnrollments = (enrollments ?? []).filter((e: any) => e.student_id === student.id)
    const activeEnrollments = studentEnrollments.filter((e: any) => {
      const now = new Date()
      if (e.status_override === 'active') return true
      if (e.status_override === 'expired') return false
      if (e.end_date && new Date(e.end_date) < now) return false
      if (e.expired_at && new Date(e.expired_at) < now) return false
      return e.status === 'active'
    })

    // Progress per enrollment
    const enrollmentsWithProgress = activeEnrollments.map((e: any) => {
      const cg = (classGroups ?? []).find((c: any) => c.id === e.class_group_id)
      const tutor = (tutors ?? []).find((t: any) => t.id === cg?.tutor_id)
      const sessIdsForCG = allSessionIds_month
        .filter((s: any) => s.class_group_id === e.class_group_id)
        .map((s: any) => s.id)
      const hadirCount = (attendances ?? []).filter(
        (a: any) => a.student_id === student.id && sessIdsForCG.includes(a.session_id) && a.status === 'hadir'
      ).length
      const progress = (e.session_start_offset ?? 0) + hadirCount
      const total    = e.sessions_total ?? 8

      // Sesi berikutnya
      const nextSesi = (upcomingSessions ?? []).find((s: any) => s.class_group_id === e.class_group_id)

      return {
        enrollmentId: e.id,
        classGroupId: e.class_group_id,
        classLabel:   cg?.label ?? '—',
        tutorName:    tutor?.full_name ?? '—',
        progress,
        total,
        nextSession:  nextSesi?.scheduled_at ?? null,
        zoomLink:     nextSesi?.zoom_link ?? cg?.zoom_link ?? null,
      }
    })

    // Kehadiran bulan ini
    const studentAttendances = (attendances ?? []).filter((a: any) => a.student_id === student.id)
    const hadirCount  = studentAttendances.filter((a: any) => a.status === 'hadir').length
    const totalAtt    = studentAttendances.length
    const hadirPct    = totalAtt > 0 ? Math.round((hadirCount / totalAtt) * 100) : 0

    return {
      ...student,
      enrollments:   enrollmentsWithProgress,
      hadirCount,
      totalAtt,
      hadirPct,
    }
  })

  // Activity feed
  const activityFeed = (recentReports ?? []).map((r: any) => {
    const student = students.find(s => s.id === r.student_id)
    const sesi    = allCompletedIds.find((s: any) => s.id === r.session_id)
    const cg      = (classGroups ?? []).find((c: any) => c.id === sesi?.class_group_id)
    return {
      studentName: student?.full_name ?? '—',
      studentId:   r.student_id,
      classLabel:  cg?.label ?? '—',
      materi:      r.materi,
      saranOrtu:   r.saran_ortu,
      createdAt:   r.created_at,
    }
  })

  // Summary stats
  const totalSesiMingguIni = (upcomingSessions ?? []).length
  const allHadir = (attendances ?? []).filter((a: any) => a.status === 'hadir').length
  const allTotal = (attendances ?? []).length
  const avgKehadiran = allTotal > 0 ? Math.round((allHadir / allTotal) * 100) : 0

  return (
    <OrtuDashboardClient
      profile={profile as any}
      childrenData={childrenData}
      activityFeed={activityFeed}
      stats={{
        totalAnak:             students.length,
        totalSesiMingguIni,
        avgKehadiran,
        totalTagihanBelumBayar: 0,
      }}
    />
  )
}
