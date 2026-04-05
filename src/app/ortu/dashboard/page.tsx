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

  // Ambil nomor WhatsApp admin
  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('phone')
    .eq('role', 'admin')
    .not('phone', 'is', null)
    .single()
  const adminPhone = adminProfile?.phone ?? null

  // Ambil daftar anak
  const { data: studentRows } = await supabase
    .from('students')
    .select(`id, slug, grade, school, relation_role,
      profiles!students_profile_id_fkey(id, full_name)`)
    .eq('parent_profile_id', userId)

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

  // Ambil class_groups
  const { data: classGroups } = classGroupIds.length > 0
    ? await supabase
        .from('class_groups')
        .select('id, label, status, class_type_id, course_id, tutor_id, zoom_link')
        .in('id', classGroupIds)
    : { data: [] }

  // Ambil durasi per class_type
  const classTypeIds = [...new Set((classGroups ?? []).map((cg: any) => cg.class_type_id).filter(Boolean))]
  const { data: durations } = classTypeIds.length > 0
    ? await supabase
        .from('course_type_durations')
        .select('class_type_id, course_id, duration_minutes')
        .in('class_type_id', classTypeIds)
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
        .in('status', ['scheduled', 'rescheduled'])
        .gte('scheduled_at', toUTC(nowWIT))
        .lte('scheduled_at', toUTC(plus7))
        .order('scheduled_at')
    : { data: [] }

  // Ambil semua sesi completed — filter per enrollment dilakukan di JS by enrolled_at
  const startMonth = new Date(nowWIT.getFullYear(), nowWIT.getMonth(), 1)
  const allSessionIds_month = classGroupIds.length > 0
    ? (await supabase
        .from('sessions')
        .select('id, class_group_id, scheduled_at')
        .in('class_group_id', classGroupIds)
        .eq('status', 'completed')
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

  // Ambil laporan terbaru (activity feed) — termasuk recording_url
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
        .select('session_id, student_id, materi, perkembangan, saran_ortu, recording_url, created_at')
        .in('session_id', completedIds)
        .in('student_id', studentIds)
        .order('created_at', { ascending: false })
        .limit(10)
    : { data: [] }

  // Susun data per anak
  const childrenData = students.map(student => {
    const studentEnrollments = (enrollments ?? []).filter((e: any) => e.student_id === student.id)
    const activeEnrollments = studentEnrollments // sudah difilter active di query

    const enrollmentsWithProgress = activeEnrollments.map((e: any) => {
      const cg    = (classGroups ?? []).find((c: any) => c.id === e.class_group_id)
      const tutor = (tutors ?? []).find((t: any) => t.id === cg?.tutor_id)
      const dur   = (durations ?? []).find((d: any) =>
        d.class_type_id === cg?.class_type_id && d.course_id === cg?.course_id
      )
      const durationMinutes = dur?.duration_minutes ?? 60
      // FIX: hitung hadir hanya dari sesi SETELAH enrolled_at
      const enrolledAt = e.enrolled_at ? new Date(e.enrolled_at) : new Date(0)
      const sessIdsForCG = allSessionIds_month
        .filter((s: any) =>
          s.class_group_id === e.class_group_id &&
          new Date(s.scheduled_at ?? 0) >= enrolledAt
        )
        .map((s: any) => s.id)
      const hadirCount = (attendances ?? []).filter(
        (a: any) => a.student_id === student.id && sessIdsForCG.includes(a.session_id) && a.status === 'hadir'
      ).length

      // ── Keterangan angka teks ──
      // Siswa baru (offset=0): trial tidak dihitung → teks = hadirCount
      // Siswa lama (offset>=1): teks = offset + hadirCount
      const progress = e.session_start_offset === 0
        ? Math.min(hadirCount, e.sessions_total ?? 8)
        : Math.min((e.session_start_offset ?? 1) + hadirCount, e.sessions_total ?? 8)

      // ── Bar visual ──
      // Siswa baru (offset=0): bar = max(hadirCount - 1, 0) → trial tidak naikan bar
      // Siswa lama (offset>=1): bar = (offset-1) + hadirCount
      // Kalau ada scheduled hari ini → cap di total-1
      const todayWITStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jayapura' })
      const hasScheduledToday = (upcomingSessions ?? []).some((s: any) =>
        s.class_group_id === e.class_group_id &&
        new Date(s.scheduled_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Jayapura' }) === todayWITStr &&
        s.status === 'scheduled'
      )
      const rawBar = e.session_start_offset === 0
        ? Math.max(hadirCount - 1, 0)
        : Math.max((e.session_start_offset - 1) + hadirCount, 0)
      const barProgress = hasScheduledToday
        ? Math.min(rawBar, (e.sessions_total ?? 8) - 1)
        : Math.min(rawBar, e.sessions_total ?? 8)
      const total    = e.sessions_total ?? 8

      // Prefer scheduled, fallback to rescheduled
      const nextSesi = (upcomingSessions ?? []).find((s: any) => s.class_group_id === e.class_group_id && s.status === 'scheduled')
        ?? (upcomingSessions ?? []).find((s: any) => s.class_group_id === e.class_group_id && s.status === 'rescheduled')

      return {
        enrollmentId:     e.id,
        classGroupId:     e.class_group_id,
        classLabel:       cg?.label ?? '—',
        tutorName:        tutor?.full_name ?? '—',
        durationMinutes,
        progress,
        barProgress,
        total,
        nextSession:      nextSesi?.scheduled_at ?? null,
        nextStatus:       nextSesi?.status ?? null,
        zoomLink:         nextSesi?.zoom_link ?? cg?.zoom_link ?? null,
      }
    })

    const studentAttendances = (attendances ?? []).filter((a: any) => a.student_id === student.id)
    const hadirCount  = studentAttendances.filter((a: any) => a.status === 'hadir').length
    const totalAtt    = studentAttendances.length
    const hadirPct    = totalAtt > 0 ? Math.round((hadirCount / totalAtt) * 100) : 0

    // Sesi hari ini untuk anak ini — flat, no nested join
    const todayWITStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jayapura' })
    const studentCGIds = activeEnrollments.map((e: any) => e.class_group_id)
    const todaySessions = (upcomingSessions ?? [])
      .filter((s: any) =>
        studentCGIds.includes(s.class_group_id) &&
        new Date(s.scheduled_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Jayapura' }) === todayWITStr
      )
      .map((s: any) => {
        const cg    = (classGroups ?? []).find((c: any) => c.id === s.class_group_id)
        const tutor = (tutors ?? []).find((t: any) => t.id === cg?.tutor_id)
        const dur   = (durations ?? []).find((d: any) =>
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
    const cg      = (classGroups ?? []).find((c: any) => c.id === sesi?.class_group_id)
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

  const totalSesiMingguIni = (upcomingSessions ?? []).length
  const allHadir = (attendances ?? []).filter((a: any) => a.status === 'hadir').length
  const allTotal = (attendances ?? []).length
  const avgKehadiran = allTotal > 0 ? Math.round((allHadir / allTotal) * 100) : 0

  // ── Kelas Arsip (class_groups.status = 'inactive') ──
  const { data: allEnrollmentsForArsip } = await supabase
    .from('enrollments')
    .select('id, student_id, class_group_id, sessions_total, status')
    .in('student_id', studentIds)
    .in('status', ['completed', 'inactive'])

  const arsipCGIds = [...new Set((allEnrollmentsForArsip ?? [])
    .map((e: any) => e.class_group_id).filter(Boolean))]

  const { data: allClassGroupsForArsip } = arsipCGIds.length > 0
    ? await supabase
        .from('class_groups')
        .select('id, label, status, tutor_id')
        .in('id', arsipCGIds)
        .eq('status', 'inactive')
    : { data: [] }

  const arsipTutorIds = [...new Set((allClassGroupsForArsip ?? [])
    .map((cg: any) => cg.tutor_id).filter(Boolean)
    .filter((id: string) => !(tutors ?? []).some((t: any) => t.id === id))
  )]
  const { data: arsipTutors } = arsipTutorIds.length > 0
    ? await supabase.from('profiles').select('id, full_name').in('id', arsipTutorIds)
    : { data: [] }
  const allTutors = [...(tutors ?? []), ...(arsipTutors ?? [])]

  const archivedData = students.map(student => {
    const studentArchived = (allEnrollmentsForArsip ?? [])
      .filter((e: any) => {
        if (e.student_id !== student.id) return false
        return (allClassGroupsForArsip ?? []).some((c: any) => c.id === e.class_group_id)
      })
      .map((e: any) => {
        const cg    = (allClassGroupsForArsip ?? []).find((c: any) => c.id === e.class_group_id)
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
