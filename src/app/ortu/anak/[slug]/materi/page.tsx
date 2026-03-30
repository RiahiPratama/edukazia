import { createServerClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import MateriContent from '@/components/siswa/MateriContent'

export default async function MateriPage({ params }: { params: { slug: string } }) {
  const { slug } = params
  const supabase = await createServerClient()

  // Get authenticated user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  // 1. Get student by slug with profile name
  const { data: student } = await supabase
    .from('students')
    .select(`
      id,
      profile_id,
      profiles!inner(
        full_name
      )
    `)
    .eq('slug', slug)
    .single()

  if (!student) {
    notFound()
  }

  // 2. Get student's enrollment with level
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('id, level_id, class_group_id')
    .eq('student_id', student.id)
    .eq('status', 'active')
    .single()

  if (!enrollment || !enrollment.level_id) {
    return (
      <div className="min-h-screen bg-[#F7F6FF] p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white border-2 border-[#E5E3FF] rounded-xl p-8 text-center">
            <p className="text-lg text-gray-600">
              Hubungi admin untuk mengatur level pembelajaran kamu.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // 3. Get level details
  const { data: level } = await supabase
    .from('levels')
    .select('id, name, course_id, courses(id, name)')
    .eq('id', enrollment.level_id)
    .single()

  if (!level) {
    return (
      <div className="min-h-screen bg-[#F7F6FF] p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white border-2 border-[#E5E3FF] rounded-xl p-8 text-center">
            <p className="text-lg text-gray-600">
              Level pembelajaran tidak ditemukan.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // 4. Get all units for this level
  const { data: units } = await supabase
    .from('units')
    .select('id, name, position, level_id')
    .eq('level_id', level.id)
    .order('position')

  if (!units || units.length === 0) {
    return (
      <div className="min-h-screen bg-[#F7F6FF] p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white border-2 border-[#E5E3FF] rounded-xl p-8 text-center">
            <p className="text-lg text-gray-600">
              Materi pembelajaran untuk level {level.name} belum tersedia.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // 5. Get all lessons for these units
  const unitIds = units.map(u => u.id)
  const { data: lessons } = await supabase
    .from('lessons')
    .select('id, title, position, unit_id')
    .in('unit_id', unitIds)
    .order('position')

  // 6. Get all materials for these lessons
  const lessonIds = lessons?.map(l => l.id) || []
  const { data: materials } = await supabase
    .from('materials')
    .select('id, title, position, lesson_id')
    .in('lesson_id', lessonIds)
    .order('position')

  // 7. Get material contents for all materials
  const materialIds = materials?.map(m => m.id) || []
  const { data: materialContents } = await supabase
    .from('material_contents')
    .select('material_id, category, content_url, storage_path')
    .in('material_id', materialIds)

  // 8. Get student's material progress
  const { data: progress } = await supabase
    .from('student_material_progress')
    .select('material_id, completed_at')
    .eq('student_id', student.id)

  // Transform data into the structure needed by MateriContent component
  const transformedData = units.map(unit => {
    const unitLessons = lessons?.filter(l => l.unit_id === unit.id) || []
    const unitMaterials = unitLessons.flatMap(lesson => {
      const lessonMaterials = materials?.filter(m => m.lesson_id === lesson.id) || []
      return lessonMaterials.map(material => {
        const content = materialContents?.find(c => c.material_id === material.id)
        const isCompleted = progress?.some(p => p.material_id === material.id)
        
        return {
          id: material.id,
          title: material.title,
          category: content?.category || 'live_zoom',
          gdrive_url: content?.content_url || null,
          component_id: content?.storage_path || null,
          completed: isCompleted || false,
          lesson_title: lesson.title,
          unit_name: unit.name
        }
      })
    })

    return {
      id: unit.id,
      name: unit.name,
      sort_order: unit.position,
      materials: unitMaterials
    }
  })

  return (
    <div className="min-h-screen bg-[#F7F6FF]">
      <MateriContent
        juduls={transformedData}
        levelName={level.name}
        courseName={level.courses?.name || ''}
        studentName={student.profiles.full_name}
        studentId={student.id}
      />
    </div>
  )
}
