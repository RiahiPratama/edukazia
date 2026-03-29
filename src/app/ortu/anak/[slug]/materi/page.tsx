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

  // 2. Get active enrollments
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('id, class_group_id')
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

  // 3. Get enrolled levels
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

  // 4. Get juduls with nested materials
  const { data: judulsData } = await supabase
    .from('juduls')
    .select(`
      id,
      name,
      description,
      sort_order,
      level_id,
      levels!inner(
        id,
        name,
        course_id,
        courses!inner(
          name,
          color
        )
      )
    `)
    .in('level_id', levelIds)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  // 5. Get materials for these juduls
  const judulIds = (judulsData ?? []).map((j: any) => j.id)
  
  let materialsData: any[] = []
  if (judulIds.length > 0) {
    const { data } = await supabase
      .from('materials')
      .select('id, judul_id, title, lesson_name, category, gdrive_url, component_id, thumbnail_url, lesson_number')
      .in('judul_id', judulIds)
      .eq('is_published', true)
      .order('lesson_number', { ascending: true })
    
    materialsData = data ?? []
  }

  // 6. Get student progress
  const materialIds = materialsData.map((m: any) => m.id)
  let progressData: any[] = []
  
  if (materialIds.length > 0) {
    const { data } = await supabase
      .from('materi_progress')
      .select('material_id, completed_at')
      .eq('student_id', student.id)
      .in('material_id', materialIds)
    
    progressData = data ?? []
  }

  const completedMaterialIds = new Set(
    progressData.map((p: any) => p.material_id)
  )

  // 7. Nest materials under juduls
  const judulsWithMaterials = (judulsData ?? []).map((judul: any) => {
    const judulMaterials = materialsData
      .filter((m: any) => m.judul_id === judul.id)
      .map((m: any) => ({
        ...m,
        isCompleted: completedMaterialIds.has(m.id),
      }))

    return {
      ...judul,
      materials: judulMaterials,
    }
  })

  return (
    <MateriContent
      studentName={student.relation_name}
      studentId={student.id}
      juduls={judulsWithMaterials}
    />
  )
}
