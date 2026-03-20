import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getActiveChild } from '@/lib/siswa/helpers'
import LaporanClient from './LaporanClient'

export const metadata = { title: 'Laporan Belajar · EduKazia' }

export default async function LaporanPage() {
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

  // Step 1: Ambil siswa
  const { data: childrenList } = await supabase
    .from('students')
    .select(`id, grade, school, status, relation_role, profile:profiles!students_profile_id_fkey(id, full_name)`)
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

  // Step 2: Ambil enrollments untuk filter courses
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('id, class_group_id')
    .eq('student_id', activeChild.id)

  const enrollCgIds = (enrollments ?? []).map((e: any) => e.class_group_id).filter(Boolean)
  const { data: enrollCg } = enrollCgIds.length > 0
    ? await supabase.from('class_groups').select('id, course_id').in('id', enrollCgIds)
    : { data: [] }
  const enrollCourseIds = (enrollCg ?? []).map((cg: any) => cg.course_id).filter(Boolean)
  const { data: enrollCourses } = enrollCourseIds.length > 0
    ? await supabase.from('courses').select('id, name, color').in('id', enrollCourseIds)
    : { data: [] }
  const allCourses = (enrollCourses ?? []).filter(
    (c: any, i: number, arr: any[]) => arr.findIndex(x => x.id === c.id) === i
  )

  // Step 3: Ambil laporan (flat)
  const { data: laporan } = await supabase
    .from('session_reports')
    .select('id, materi, perkembangan, saran_siswa, saran_ortu, created_at, session_id')
    .eq('student_id', activeChild.id)
    .order('created_at', { ascending: false })

  const laporanSessionIds = (laporan ?? []).map((l: any) => l.session_id).filter(Boolean)
  const { data: laporanSessions } = laporanSessionIds.length > 0
    ? await supabase.from('sessions').select('id, scheduled_at, class_group_id').in('id', laporanSessionIds)
    : { data: [] }

  const laporanCgIds = (laporanSessions ?? []).map((s: any) => s.class_group_id).filter(Boolean)
  const { data: laporanCg } = laporanCgIds.length > 0
    ? await supabase.from('class_groups').select('id, label, course_id, tutor_id').in('id', laporanCgIds)
    : { data: [] }

  const laporanCourseIds = (laporanCg ?? []).map((cg: any) => cg.course_id).filter(Boolean)
  const laporanTutorIds  = (laporanCg ?? []).map((cg: any) => cg.tutor_id).filter(Boolean)

  const { data: laporanCourses } = laporanCourseIds.length > 0
    ? await supabase.from('courses').select('id, name, color').in('id', laporanCourseIds)
    : { data: [] }

  const { data: laporanTutors } = laporanTutorIds.length > 0
    ? await supabase.from('profiles').select('id, full_name').in('id', laporanTutorIds)
    : { data: [] }

  const laporanCgMap: Record<string, any> = {}
  ;(laporanCg ?? []).forEach((cg: any) => {
    laporanCgMap[cg.id] = {
      ...cg,
      courses: (laporanCourses ?? []).find((c: any) => c.id === cg.course_id) ?? null,
      profiles: (laporanTutors ?? []).find((p: any) => p.id === cg.tutor_id) ?? null,
    }
  })

  const laporanSessionMap: Record<string, any> = {}
  ;(laporanSessions ?? []).forEach((s: any) => {
    laporanSessionMap[s.id] = { ...s, class_groups: laporanCgMap[s.class_group_id] ?? null }
  })

  const laporanWithSessions = (laporan ?? []).map((l: any) => ({
    ...l,
    sessions: laporanSessionMap[l.session_id] ?? null
  }))

  // Step 4: Ambil kehadiran
  const { data: attendances } = await supabase
    .from('attendances').select('id, session_id, status, notes').eq('student_id', activeChild.id)

  const summary = { hadir: 0, izin: 0, sakit: 0, alpha: 0 }
  attendances?.forEach(a => { if (a.status in summary) summary[a.status as keyof typeof summary]++ })

  const laporanWithAtt = laporanWithSessions.map((l: any) => ({
    ...l,
    attendance: attendances?.find((a: any) => a.session_id === l.session_id) ?? null,
  }))

  // FIX: flatten profile di childrenList sebelum di-pass ke client
  const childrenListFlat = (childrenList ?? []).map((c: any) => ({
    ...c,
    profile: Array.isArray(c.profile) ? c.profile[0] ?? null : c.profile,
  }))

  return (
    <LaporanClient
      laporan={laporanWithAtt}
      courses={allCourses}
      summary={summary}
      studentName={activeChild.profile.full_name}
      childrenList={childrenListFlat}
      activeChildId={activeChild.id}
      isParent={isParent}
    />
  )
}
