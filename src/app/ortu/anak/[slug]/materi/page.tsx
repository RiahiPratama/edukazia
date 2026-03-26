import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import MateriListClient from './MateriListClient'

export default async function OrtuAnakMateriPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get parent profile
  const { data: parentProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .single()

  if (!parentProfile) redirect('/login')

  // Get student record by slug & verify relationship
  const { data: student } = await supabase
    .from('students')
    .select('id, full_name, parent_profile_id, profile_id, slug')
    .eq('slug', slug)
    .single()

  if (!student) notFound()

  // Verify: ortu harus punya akses ke anak ini
  // Either: parent_profile_id match ATAU student Diri Sendiri (parent_profile_id = profile_id)
  const isParent = student.parent_profile_id === parentProfile.id
  const isDiriSendiri = student.parent_profile_id === student.profile_id && student.profile_id === user.id

  if (!isParent && !isDiriSendiri) {
    redirect('/ortu')
  }

  // Query materi from view - otomatis filter by enrolled levels!
  const { data: materials } = await supabase
    .from('student_accessible_materials')
    .select('*')
    .eq('student_id', student.id)
    .order('course_name')
    .order('level_sort_order')
    .order('unit_number')
    .order('lesson_number')

  // Get enrolled levels untuk info/filter
  const { data: enrolledLevels } = await supabase.rpc(
    'get_student_enrolled_levels',
    { student_uuid: student.id }
  )

  return (
    <MateriListClient
      materials={materials ?? []}
      enrolledLevels={enrolledLevels ?? []}
      studentName={student.full_name}
    />
  )
}
