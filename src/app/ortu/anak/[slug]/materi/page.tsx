import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import MateriContent from './MateriContent'

type PageProps = {
  params: Promise<{ slug: string }>
}

export default async function MateriPage({ params }: PageProps) {
  const { slug } = await params
  const supabase = await createClient()

  // 1. Get student by slug
  const { data: student } = await supabase
    .from('students')
    .select('id, relation_name, profile_id')
    .eq('slug', slug)
    .single()

  if (!student) {
    notFound()
  }

  // 2. Get active enrollments with course info
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select(`
      id,
      class_groups!inner(
        course_id,
        courses!inner(
          id,
          name,
          color
        )
      )
    `)
    .eq('student_id', student.id)
    .eq('status', 'active')

  if (!enrollments || enrollments.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl border border-[#E5E3FF] p-8 text-center">
            <h1 className="text-xl font-black text-[#1A1640] mb-2">
              Belum Ada Enrollment
            </h1>
            <p className="text-sm text-[#7B78A8]">
              {student.relation_name} belum terdaftar di kelas manapun.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // 3. Get enrolled levels for this student
  const enrollmentIds = enrollments.map((e: any) => e.id)
  const { data: enrolledLevels } = await supabase
    .from('enrollment_levels')
    .select('level_id')
    .in('enrollment_id', enrollmentIds)

  const levelIds = (enrolledLevels ?? []).map((el: any) => el.level_id)

  if (levelIds.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl border border-[#E5E3FF] p-8 text-center">
            <h1 className="text-xl font-black text-[#1A1640] mb-2">
              Belum Ada Level Terpilih
            </h1>
            <p className="text-sm text-[#7B78A8]">
              Hubungi admin untuk mengatur level untuk {student.relation_name}.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // 4. Get materials for enrolled levels
  const { data: materials } = await supabase
    .from('juduls')
    .select(`
      id,
      title,
      description,
      level_id,
      sort_order,
      levels!inner(
        id,
        name,
        course_id,
        courses!inner(
          name,
          color
        )
      ),
      materials(
        id,
        title,
        description,
        file_url,
        file_type,
        created_at
      )
    `)
    .in('level_id', levelIds)
    .order('sort_order', { ascending: true })

  // 5. Get progress for this student
  const { data: progressData } = await supabase
    .from('materi_progress')
    .select('material_id, completed_at')
    .eq('student_id', student.id)

  const completedMaterialIds = new Set(
    (progressData ?? []).map((p: any) => p.material_id)
  )

  // 6. Transform data for client component
  const materialsWithProgress = (materials ?? []).map((judul: any) => ({
    ...judul,
    materials: (judul.materials ?? []).map((mat: any) => ({
      ...mat,
      isCompleted: completedMaterialIds.has(mat.id),
    })),
  }))

  return (
    <MateriContent
      studentName={student.relation_name}
      studentId={student.id}
      materials={materialsWithProgress}
    />
  )
}
