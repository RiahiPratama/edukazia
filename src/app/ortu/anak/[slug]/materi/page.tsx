import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import MateriClient from '@/app/siswa/materi/MateriClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Materi Belajar · EduKazia' }

export default async function OrtuAnakMateriPage({ params }: { params: Promise<{ slug: string }> }) {
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

  // Lookup studentId dari slug + verifikasi milik ortu ini
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

  // Enrollments
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('id, status, end_date, expired_at, status_override, class_group_id')
    .eq('student_id', studentId)

  const activeEnrollments = (enrollments ?? []).filter((e: any) => {
    const now = new Date()
    if (e.status_override === 'active')   return true
    if (e.status_override === 'expired')  return false
    if (e.end_date   && new Date(e.end_date)   < now) return false
    if (e.expired_at && new Date(e.expired_at) < now) return false
    return e.status === 'active'
  })

  if (activeEnrollments.length === 0) {
    return (
      <div className="px-4 py-8 text-center">
        <p className="text-[13px] text-stone-400">Tidak ada kelas aktif</p>
      </div>
    )
  }

  const classGroupIds = activeEnrollments.map((e: any) => e.class_group_id).filter(Boolean)

  // Courses
  const { data: cgData } = classGroupIds.length > 0
    ? await supabase.from('class_groups').select('id, course_id').in('id', classGroupIds)
    : { data: [] }
  const cIds = (cgData ?? []).map((cg: any) => cg.course_id).filter(Boolean)
  const { data: cData } = cIds.length > 0
    ? await supabase.from('courses').select('id, name, color').in('id', cIds)
    : { data: [] }
  const activeCourses = (cData ?? []).filter(
    (c: any, i: number, arr: any[]) => arr.findIndex(x => x.id === c.id) === i
  )

  // Materi
  const { data: materiList } = classGroupIds.length > 0
    ? await supabase
        .from('materials')
        .select(`id, title, type, order_number, content, url, is_published, created_at,
          courses(id, name, color), class_groups(id, label), sessions(id, scheduled_at),
          profiles!materials_created_by_fkey(full_name),
          material_progress(id, is_read, read_at, student_id)`)
        .eq('is_published', true)
        .or(`class_group_id.is.null,class_group_id.in.(${classGroupIds.join(',')})`)
        .order('order_number')
    : { data: [] }

  const materiWithProgress = (materiList ?? []).map((m: any) => ({
    ...m,
    courses:      Array.isArray(m.courses)      ? m.courses[0]      ?? null : m.courses,
    class_groups: Array.isArray(m.class_groups) ? m.class_groups[0] ?? null : m.class_groups,
    profiles:     Array.isArray(m.profiles)     ? m.profiles[0]     ?? null : m.profiles,
    is_read:      m.material_progress?.some((p: any) => p.student_id === studentId && p.is_read) ?? false,
    progress_id:  m.material_progress?.find((p: any) => p.student_id === studentId)?.id ?? null,
    material_progress: undefined,
  }))

  return (
    <MateriClient
      materi={materiWithProgress}
      courses={activeCourses}
      studentId={studentId}
      studentName={studentName}
      stats={{
        totalMateri: materiWithProgress.length,
        totalRead:   materiWithProgress.filter((m: any) => m.is_read).length,
        totalBacaan: materiWithProgress.filter((m: any) => m.type === 'bacaan').length,
        totalZoom:   materiWithProgress.filter((m: any) => m.type === 'live_zoom').length,
      }}
    />
  )
}
