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

  // ✅ OPTIMIZATION: Jalankan profile + adminPhone secara paralel
  const [profileResult, adminResult, studentRowsResult] = await Promise.all([
    supabase.from('profiles').select('id, full_name, email, phone, role').eq('id', userId).single(),
    supabase.from('profiles').select('phone').eq('role', 'admin').not('phone', 'is', null).single(),
    supabase.from('students').select(`id, slug, grade, school, relation_role, profiles!students_profile_id_fkey(id, full_name)`).eq('parent_profile_id', userId)
  ])

  const profile      = profileResult.data
  const adminPhone   = adminResult.data?.phone ?? null
  const studentRows  = studentRowsResult.data

  if (!profile) redirect('/login')

  if (!studentRows || studentRows.length === 0) redirect('/login')

  const students = (studentRows as any[]).map(s => ({
    id:            s.id,
    slug:          s.slug ?? s.id,
    full_name:     (Array.isArray(s.profiles) ? s.profiles[0] : s.profiles)?.full_name ?? '(Tanpa nama)',
    grade:         s.grade,
    school:        s.school,
    relation_role: s.relation_role,
  }))

  const studentIds = students.map(s => s.id)

  // Ambil enrollments aktif saja
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select(`id, student_id, status, enrolled_at,
      session_start_offset, sessions_total, package_id,
      class_group_id`)
    .in('student_id', studentIds)
    .eq('status', 'active')

  const classGroupIds = [...new Set((enrollments ?? []).map((e: any) => e.class_group_id).filter(Boolean))]

  // Timezone helpers
  const nowWIT = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jayapura' }))
  const toUTC  = (d: Date) => new Date(d.getTime() - 9 * 60 * 60 * 1000).toISOString()
  const minus90 = new Date(Date.now() - 90 * 60 * 1000)

  // ✅ OPTIMIZATION: classGroups, durations, tutors paralel
  const [classGroupsResult, upcomingResult, completedResult, arsipEnrollResult] = await Promise.all([
    // class_groups
    classGroupIds.length > 0
      ? supabase.from('class_groups').select('id, label, status, class_type_id, course_id, tutor_id, zoom_link').in('id', classGroupIds)
      : Promise.resolve({ data: [] }),
    // upcoming sessions (mundur 90 menit)
    classGroupIds.length > 0
      ? supabase.from('sessions').select('id, class_group_id, scheduled_at, status, zoom_link')
          .in('class_group_id', classGroupIds)
          .in('status', ['scheduled', 'rescheduled'])
          .gte('scheduled_at', toUTC(minus90))
          .order('scheduled_at')
      : Promise.resolve({ data: [] }),
    // ALL completed sessions (gabung 3 query jadi 1!)
    classGroupIds.length > 0
      ? supabase.from('sessions').select('id, class_group_id, scheduled_at')
          .in('class_group_id', classGroupIds)
          .eq('status', 'completed')
          .order('scheduled_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    // arsip enrollments
    supabase.from('enrollments').select('id, student_id, class_group_id, sessions_total, status')
      .in('student_id', studentIds)
      .in('status', ['completed', 'inactive']),
  ])

  const classGroups    = classGroupsResult.data ?? []
  const upcomingSessions = upcomingResult.data ?? []
  const allCompletedSessions = completedResult.data ?? []
  const allEnrollmentsForArsip = arsipEnrollResult.data ?? []

  // Ambil durations + tutors + attendances + reports + arsip classgroups paralel
  const classTypeIds = [...new Set(classGroups.map((cg: any) => cg.class_type_id).filter(Boolean))]
  const tutorIds     = [...new Set(classGroups.map((cg: any) => cg.tutor_id).filter(Boolean))]
  const allCompletedSessions = allCompletedSessions.map((s: any) => s.id)
  const arsipCGIds   = [...new Set(allEnrollmentsForArsip.map((e: any) => e.class_group_id).filter(Boolean))]

  const [durationsResult, tutorsResult, attendancesResult, recentReportsResult, arsipCGResult] = await Promise.all([
    classTypeIds.length > 0
      ? supabase.from('course_type_durations').select('class_type_id, course_id, duration_minutes').in('class_type_id', classTypeIds)
      : Promise.resolve({ data: [] }),
    tutorIds.length > 0
      ? supabase.from('profiles').select('id, full_name').in('id', tutorIds)
      : Promise.resolve({ data: [] }),
    allCompletedSessions.length > 0
      ? supabase.from('attendances').select('session_id, student_id, status').in('session_id', allCompletedSessions).in('student_id', studentIds)
      : Promise.resolve({ data: [] }),
    allCompletedSessions.length > 0
      ? supabase.from('session_reports').select('session_id, student_id, materi, perkembangan, saran_ortu, recording_url, created_at')
          .in('session_id', allCompletedSessions.slice(0, 20))
          .in('student_id', studentIds)
          .order('created_at', { ascending: false })
          .limit(10)
      : Promise.resolve({ data: [] }),
    arsipCGIds.length > 0
      ? supabase.from('class_groups').select('id, label, status, tutor_id').in('id', arsipCGIds).eq('status', 'inactive')
      : Promise.resolve({ data: [] }),
  ])

  const durations            = durationsResult.data ?? []
  const tutors               = tutorsResult.data ?? []
  const attendances          = attendancesResult.data ?? []
  const recentReports        = recentReportsResult.data ?? []
  const allClassGroupsForArsip = arsipCGResult.data ?? []

  // Arsip tutors yang belum ada di tutors
  const arsipTutorIds = [...new Set(allClassGroupsForArsip
    .map((cg: any) => cg.tutor_id).filter(Boolean)
    .filter((id: string) => !tutors.some((t: any) => t.id === id))
  )]
  const { data: arsipTutors } = arsipTutorIds.length > 0
    ? await supabase.from('profiles').select('id, full_name').in('id', arsipTutorIds)
    : { data: [] }
  const allTutors = [...tutors, ...(arsipTutors ?? [])]

  // Untuk activity feed - ambil 20 completed terbaru
  const allCompletedIds = allCompletedSessions.slice(0, 20)

  // Susun data per anak
  const childrenData = students.map(student => {
    const studentEnrollments = (enrollments ?? []).filter((e: any) => e.student_id === student.id)
    const activeEnrollments = studentEnrollments // sudah difilter active di query

    const enrollmentsWithProgress = activeEnrollments.map((e: any) => {
      const cg    = (classGroups).find((c: any) => c.id === e.class_group_id)
      const tutor = (tutors).find((t: any) => t.id === cg?.tutor_id)
      const dur   = (durations).find((d: any) =>
        d.class_type_id === cg?.class_type_id && d.course_id === cg?.course_id
      )
      const durationMinutes = dur?.duration_minutes ?? 60
      // FIX: hitung sesi COMPLETED setelah enrolled_at (apapun status absensi)
      const enrolledAt = e.enrolled_at ? new Date(e.enrolled_at) : new Date(0)
      const sessIdsForCG = allCompletedSessions
        .filter((s: any) =>
          s.class_group_id === e.class_group_id &&
          new Date(s.scheduled_at ?? 0) >= enrolledAt
        )
        .map((s: any) => s.id)

      // completedCount = jumlah sesi completed (ada absensi = sesi berlangsung)
      const completedCount = (attendances).filter(
        (a: any) => a.student_id === student.id && sessIdsForCG.includes(a.session_id)
      ).length

      // hadirCount tetap untuk % kehadiran saja
      const hadirCount = (attendances).filter(
        (a: any) => a.student_id === student.id && sessIdsForCG.includes(a.session_id) && a.status === 'hadir'
      ).length

      // ── Keterangan angka teks ──
      // Siswa baru (offset=0): teks = completedCount
      // Siswa lama (offset>=1): teks = offset + completedCount
      const progress = e.session_start_offset === 0
        ? Math.min(completedCount, e.sessions_total ?? 8)
        : Math.min((e.session_start_offset ?? 1) + completedCount, e.sessions_total ?? 8)

      // ── Bar visual ──
      const todayWITStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jayapura' })
      const hasScheduledToday = (upcomingSessions).some((s: any) =>
        s.class_group_id === e.class_group_id &&
        new Date(s.scheduled_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Jayapura' }) === todayWITStr &&
        s.status === 'scheduled'
      )
      const rawBar = e.session_start_offset === 0
        ? Math.max(completedCount - 1, 0)
        : Math.max((e.session_start_offset - 1) + completedCount, 0)
      const barProgress = hasScheduledToday
        ? Math.min(rawBar, (e.sessions_total ?? 8) - 1)
        : Math.min(rawBar, e.sessions_total ?? 8)
      const total = e.sessions_total ?? 8

      // Prefer scheduled, fallback to rescheduled
      const nextSesi = (upcomingSessions).find((s: any) => s.class_group_id === e.class_group_id && s.status === 'scheduled')
        ?? (upcomingSessions).find((s: any) => s.class_group_id === e.class_group_id && s.status === 'rescheduled')

      // Hitung sesi scheduled yang masih antrian
      const pendingCount = (upcomingSessions).filter(
        (s: any) => s.class_group_id === e.class_group_id
      ).length

      return {
        enrollmentId:     e.id,
        classGroupId:     e.class_group_id,
        classLabel:       cg?.label ?? '—',
        tutorName:        tutor?.full_name ?? '—',
        durationMinutes,
        progress,
        barProgress,
        pendingCount,
        total,
        nextSession:      nextSesi?.scheduled_at ?? null,
        nextStatus:       nextSesi?.status ?? null,
        zoomLink:         nextSesi?.zoom_link ?? cg?.zoom_link ?? null,
      }
    })

    const studentAttendances = (attendances).filter((a: any) => a.student_id === student.id)
    const hadirCount  = studentAttendances.filter((a: any) => a.status === 'hadir').length
    const totalAtt    = studentAttendances.length
    const hadirPct    = totalAtt > 0 ? Math.round((hadirCount / totalAtt) * 100) : 0

    // Sesi hari ini untuk anak ini — flat, no nested join
    const todayWITStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jayapura' })
    const studentCGIds = activeEnrollments.map((e: any) => e.class_group_id)
    const todaySessions = (upcomingSessions)
      .filter((s: any) =>
        studentCGIds.includes(s.class_group_id) &&
        new Date(s.scheduled_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Jayapura' }) === todayWITStr
      )
      .map((s: any) => {
        const cg    = (classGroups).find((c: any) => c.id === s.class_group_id)
        const tutor = (tutors).find((t: any) => t.id === cg?.tutor_id)
        const dur   = (durations).find((d: any) =>
          d.class_type_id === cg?.class_type_id && d.course_id === cg?.course_id
        )
        return {
          id:              s.id,
          scheduled_at:    s.scheduled_at,
          status:          s.status,
          zoom_link:       s.zoom_link ?? cg?.zoom_link ?? null,
          classLabel:      cg?.label ?? '—',
          tutorName:       tutor?.full_name ?? '—',
          durationMinutes: dur?.duration_minutes ?? 60,
          classGroupId:    s.class_group_id,
        }
      })

    return {
      ...student,
      enrollments:   enrollmentsWithProgress,
      todaySessions,
      hadirCount,
      totalAtt,
      hadirPct,
    }
  })

  // Activity feed — sertakan recording_url
  const activityFeed = (recentReports ?? []).map((r: any) => {
    const student = students.find(s => s.id === r.student_id)
    const sesi    = allCompletedIds.find((s: any) => s.id === r.session_id)
    const cg      = (classGroups).find((c: any) => c.id === sesi?.class_group_id)
    return {
      studentName:  student?.full_name ?? '—',
      studentId:    r.student_id,
      classLabel:   cg?.label ?? '—',
      materi:       r.materi,
      saranOrtu:    r.saran_ortu,
      recordingUrl: r.recording_url ?? null,
      createdAt:    r.created_at,
    }
  })

  const totalSesiMingguIni = (upcomingSessions).length
  const allHadir = (attendances).filter((a: any) => a.status === 'hadir').length
  const allTotal = (attendances).length
  const avgKehadiran = allTotal > 0 ? Math.round((allHadir / allTotal) * 100) : 0

  // ── Arsip data sudah dihitung di atas via Promise.all ──
  const archivedData = students.map(student => {
    const studentArchived = (allEnrollmentsForArsip)
      .filter((e: any) => {
        if (e.student_id !== student.id) return false
        return (allClassGroupsForArsip).some((c: any) => c.id === e.class_group_id)
      })
      .map((e: any) => {
        const cg    = (allClassGroupsForArsip).find((c: any) => c.id === e.class_group_id)
        const tutor = allTutors.find((t: any) => t.id === cg?.tutor_id)
        return {
          enrollmentId: e.id,
          classLabel:   cg?.label ?? '—',
          tutorName:    tutor?.full_name ?? '—',
          total:        e.sessions_total ?? 8,
        }
      })
    return {
      studentId:   student.id,
      studentName: student.full_name,
      studentSlug: student.slug ?? student.id,
      archived:    studentArchived,
    }
  }).filter(s => s.archived.length > 0)

  return (
    <OrtuDashboardClient
      profile={profile as any}
      childrenData={childrenData}
      activityFeed={activityFeed}
      adminPhone={adminPhone}
      archivedData={archivedData}
      stats={{
        totalAnak:             students.length,
        totalSesiMingguIni,
        avgKehadiran,
        totalTagihanBelumBayar: 0,
      }}
    />
  )
}
