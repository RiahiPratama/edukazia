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

  // 2. Get active enrollments with level_id
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('id, class_group_id, level_id')
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

  // 3. Get level IDs from enrollments (NEW: using enrollments.level_id!)
  const levelIds = enrollments
    .map((e: any) => e.level_id)
    .filter((id: string | null) => id !== null)

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

  // 4. Get units for these levels (NEW: units now link directly to levels!)
  const { data: unitsData } = await supabase
    .from('units')
    .select(`
      id,
      unit_name,
      description,
      position,
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
    .order('position', { ascending: true })

  if (!unitsData || unitsData.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl border border-[#E5E3FF] p-8 text-center">
            <h1 className="text-xl font-black text-[#1A1640] mb-2">
              Belum Ada Materi
            </h1>
            <p className="text-sm text-[#7B78A8]">
              Materi pembelajaran untuk level yang kamu ikuti belum tersedia.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // 5. Get lessons for these units
  const unitIds = unitsData.map((u: any) => u.id)
  const { data: lessonsData } = await supabase
    .from('lessons')
    .select('id, lesson_name, unit_id, position')
    .in('unit_id', unitIds)
    .order('position', { ascending: true })

  // 6. Get materials for these lessons
  const lessonIds = (lessonsData ?? []).map((l: any) => l.id)
  
  let materialsData: any[] = []
  if (lessonIds.length > 0) {
    const { data } = await supabase
      .from('materials')
      .select(`
        id,
        lesson_id,
        title,
        category,
        position,
        is_published,
        material_contents(
          content_type,
          content_url,
          storage_bucket,
          storage_path,
          audio_bucket,
          audio_path
        )
      `)
      .in('lesson_id', lessonIds)
      .eq('is_published', true)
      .order('position', { ascending: true })
    
    materialsData = data ?? []
  }

  // 7. Get student progress
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

  // 8. Transform units to match old Judul structure for MateriContent
  const judulsData = unitsData.map((unit: any) => {
    // Flatten all materials from all lessons in this unit
    const unitLessons = (lessonsData ?? []).filter((l: any) => l.unit_id === unit.id)
    
    const allMaterials = unitLessons.flatMap((lesson: any) => {
      return materialsData
        .filter((m: any) => m.lesson_id === lesson.id)
        .map((m: any) => {
          // Get content data from material_contents
          const content = m.material_contents?.[0]
          let gdrive_url = null
          let component_id = null
          
          if (content) {
            if (content.content_type === 'url') {
              gdrive_url = content.content_url
            } else if (content.content_type === 'component') {
              component_id = `${content.storage_bucket}/${content.storage_path}`
            }
          }

          return {
            id: m.id,
            title: m.title,
            lesson_name: lesson.lesson_name,
            category: m.category,
            gdrive_url,
            component_id,
            thumbnail_url: null,
            lesson_number: m.position,
            isCompleted: completedMaterialIds.has(m.id),
          }
        })
    })

    // Transform to match Judul type
    return {
      id: unit.id,
      name: unit.unit_name,
      description: unit.description,
      sort_order: unit.position,
      level_id: unit.level_id,
      levels: {
        id: unit.levels.id,
        name: unit.levels.name,
        course_id: unit.levels.course_id,
        courses: {
          name: unit.levels.courses.name,
          color: unit.levels.courses.color,
        },
      },
      materials: allMaterials,
    }
  })

  // 9. Filter out units with no materials
  const judulsWithMaterials = judulsData.filter(
    (judul: any) => judul.materials.length > 0
  )

  return (
    <MateriContent
      studentName={student.relation_name}
      studentId={student.id}
      juduls={judulsWithMaterials}
    />
  )
}
