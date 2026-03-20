import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getActiveChild, getEnrollmentStatus } from '@/lib/siswa/helpers'
import MateriClient from './MateriClient'

export const metadata = { title: 'Materi Belajar · EduKazia' }

export default async function MateriPage() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
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

  const activeChild = getActiveChild((childrenList ?? []).map(c => ({ ...c, enrollments: [] })))
  if (!activeChild) {
    return (
      <div className="px-4 pt-6 text-center">
        <p className="text-sm text-[#9B97B2]">Tidak ada data siswa ditemukan.</p>
      </div>
    )
  }

  // Step 2: Ambil enrollments
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('id, status, end_date, expired_at, status_override, class_group_id')
    .eq('student_id', activeChild.id)

  const isExpired = (enrollments ?? []).length > 0 && (enrollments ?? []).every(e => getEnrollmentStatus(e) === 'expired')

  if (isExpired) {
    return (
      <div className="px-4 pt-6">
        <h2 className="text-[16px] font-bold text-[#1A1530] mb-1">Materi Belajar</h2>
        <p className="text-[12px] text-[#9B97B2] mb-6">{activeChild.profile.full_name}</p>
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
          <p className="text-[32px] mb-3">🔒</p>
          <p className="text-[14px] font-bold text-red-700 mb-1">Akses Materi Terkunci</p>
          <p className="text-[12px] text-red-500 mb-4">Paket belajar telah berakhir.</p>
          <a
            href={`https://wa.me/${process.env.NEXT_PUBLIC_WA_NUMBER}?text=Halo Admin EduKazia, saya ingin memperpanjang paket untuk ${activeChild.profile.full_name}`}
            target="_blank" rel="noopener noreferrer"
            className="inline-block bg-red-500 text-white text-[12px] font-bold px-5 py-2.5 rounded-xl"
          >
            Hubungi Admin untuk Perpanjang
          </a>
        </div>
      </div>
    )
  }

  const activeEnrollments = (enrollments ?? []).filter(e => getEnrollmentStatus(e) === 'active')
  // Ambil courses terpisah
  const cgIds = classGroupIds
  const { data: cgData } = cgIds.length > 0
    ? await supabase.from('class_groups').select('id, course_id').in('id', cgIds)
    : { data: [] }
  const cIds = (cgData ?? []).map((cg: any) => cg.course_id).filter(Boolean)
  const { data: cData } = cIds.length > 0
    ? await supabase.from('courses').select('id, name, color').in('id', cIds)
    : { data: [] }
  const activeCourses = (cData ?? []).filter(
    (c: any, i: number, arr: any[]) => arr.findIndex(x => x.id === c.id) === i
  )
  const classGroupIds = activeEnrollments.map((e: any) => e.class_group_id).filter(Boolean)

  // Step 3: Ambil materi
  const { data: materiList } = classGroupIds.length > 0
    ? await supabase
        .from('materials')
        .select(`id, title, type, order_number, content, url, is_published, created_at, courses(id, name, color), class_groups(id, label), sessions(id, scheduled_at), profiles!materials_created_by_fkey(full_name), material_progress(id, is_read, read_at, student_id)`)
        .eq('is_published', true)
        .or(`class_group_id.is.null,class_group_id.in.(${classGroupIds.join(',')})`)
        .order('order_number')
    : { data: [] }

  const materiWithProgress = (materiList ?? []).map((m: any) => ({
    ...m,
    is_read: m.material_progress?.some((p: any) => p.student_id === activeChild.id && p.is_read) ?? false,
    progress_id: m.material_progress?.find((p: any) => p.student_id === activeChild.id)?.id ?? null,
    material_progress: undefined,
  }))

  return (
    <MateriClient
      materi={materiWithProgress}
      courses={activeCourses}
      studentId={activeChild.id}
      studentName={activeChild.profile.full_name}
      stats={{
        totalMateri: materiWithProgress.length,
        totalRead: materiWithProgress.filter(m => m.is_read).length,
        totalBacaan: materiWithProgress.filter(m => m.type === 'bacaan').length,
        totalZoom: materiWithProgress.filter(m => m.type === 'live_zoom').length,
      }}
    />
  )
}
