import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getActiveChild, getEnrollmentStatus } from '@/lib/siswa/helpers'
import ProfilClient from './ProfilClient'

export const metadata = { title: 'Profil · EduKazia' }

export default async function ProfilPage() {
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
    .from('profiles').select('id, full_name, role, phone, email, avatar_url').eq('id', session.user.id).single()

  if (!profile || !['student', 'parent'].includes(profile.role)) redirect('/login')

  const isParent = profile.role === 'parent'

  // Step 1: Ambil siswa
  const { data: childrenList } = await supabase
    .from('students')
    .select(`id, grade, school, status, relation_role, relation_name, relation_phone, relation_email, birth_date, province, city, notes, profile:profiles!students_profile_id_fkey(id, full_name, phone, email, avatar_url)`)
    .eq(isParent ? 'parent_profile_id' : 'profile_id', session.user.id)

  const activeChild = getActiveChild((childrenList ?? []).map(c => ({ ...c, enrollments: [] })))

  // Step 2: Ambil enrollments untuk semua anak
  const studentIds = (childrenList ?? []).map(c => c.id)
  const { data: enrollments } = studentIds.length > 0
    ? await supabase
        .from('enrollments')
        .select(`id, student_id, status, end_date, expired_at, status_override, class_groups(id, label, courses(id, name, color))`)
        .in('student_id', studentIds)
    : { data: [] }

  // Gabungkan enrollments ke masing-masing anak
  const childrenWithEnrollments = (childrenList ?? []).map(child => ({
    ...child,
    enrollments: (enrollments ?? []).filter((e: any) => e.student_id === child.id),
  }))

  const activeChildWithEnrollments = childrenWithEnrollments.find(c => c.id === activeChild?.id) ?? activeChild

  return (
    <ProfilClient
      profile={profile}
      childrenList={childrenWithEnrollments}
      activeChild={activeChildWithEnrollments}
      isParent={isParent}
    />
  )
}
