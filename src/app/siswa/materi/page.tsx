import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MateriListClient from './MateriListClient'

export default async function SiswaMateriPage() {
  const supabase = await createClient()

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get student record
  const { data: student } = await supabase
    .from('students')
    .select('id, full_name, parent_profile_id')
    .eq('profile_id', user.id)
    .single()

  if (!student) redirect('/siswa')

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
