import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import MateriContent from './MateriContent'

export default async function MateriPage({ 
  params 
}: { 
  params: Promise<{ slug: string }> 
}) {
  // Next.js 15: params is now a Promise
  const { slug } = await params
  const supabase = await createClient()

  // Get authenticated user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  // 1. Get student by slug
  const { data: students } = await supabase
    .from('students')
    .select('id, profile_id')
    .eq('slug', slug)

  if (!students || students.length === 0) {
    notFound()
  }

  const student = students[0]

  // 2. Get student's profile name
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', student.profile_id)
    .single()

  // 3. Get ALL student's active enrollments
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('id, level_id, class_group_id')
    .eq('student_id', student.id)
    .eq('status', 'active')

  if (!enrollments || enrollments.length === 0) {
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

  // 4. Get level IDs from enrollment_levels table (supports multi-level per enrollment)
  const enrollmentIds = enrollments.map(e => e.id)
  const { data: enrollmentLevels } = await supabase
    .from('enrollment_levels')
    .select('level_id')
    .in('enrollment_id', enrollmentIds)

  // Combine level_id from both enrollments (old system) and enrollment_levels (new system)
  const levelIdsFromEnrollments = enrollments
    .map(e => e.level_id)
    .filter((id): id is string => !!id)
  
  const levelIdsFromJunction = enrollmentLevels?.map(el => el.level_id) || []
  
  const levelIds = Array.from(new Set([...levelIdsFromEnrollments, ...levelIdsFromJunction]))

  if (levelIds.length === 0) {
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

  // 5. Get levels with courses
  const { data: levels } = await supabase
    .from('levels')
    .select('id, name, course_id, courses:course_id(id, name)')
    .in('id', levelIds)

  // 6. Get all units for ALL enrolled levels
  const { data: units } = await supabase
    .from('units')
    .select('id, unit_name, position, level_id, chapter_id')
    .in('level_id', levelIds)
    .order('position')

  if (!units || units.length === 0) {
    return (
      <div className="min-h-screen bg-[#F7F6FF] p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white border-2 border-[#E5E3FF] rounded-xl p-8 text-center">
            <p className="text-lg text-gray-600">
              Materi pembelajaran belum tersedia.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // 6. Get chapters for context
  const chapterIds = units.map(u => u.chapter_id).filter((id): id is string => !!id)
  const { data: chapters } = await supabase
    .from('chapters')
    .select('id, chapter_title, level_id')
    .in('id', chapterIds)

  console.log('🔍 DEBUG Chapters:', {
    chapterIds,
    chapters,
    unitsWithChapterIds: units.map(u => ({ name: u.unit_name, chapter_id: u.chapter_id }))
  })

  // 7. Get all lessons for these units
  const unitIds = units.map(u => u.id)
  const { data: lessons } = await supabase
    .from('lessons')
    .select('id, lesson_name, position, unit_id')
    .in('unit_id', unitIds)
    .order('position')

  // 8. Get all materials for these lessons
  const lessonIds = lessons?.map(l => l.id) || []
  const { data: materials } = await supabase
    .from('materials')
    .select('id, title, position, lesson_id, category, is_published')
    .in('lesson_id', lessonIds)
    .eq('is_published', true)
    .order('position')

  // 9. Get material contents for all materials
  const materialIds = materials?.map(m => m.id) || []
  const { data: materialContents } = await supabase
    .from('material_contents')
    .select('material_id, content_url, storage_path')
    .in('material_id', materialIds)

  // 10. Get student's material progress
  const { data: progress } = await supabase
    .from('student_material_progress')
    .select('material_id, completed_at')
    .eq('student_id', student.id)

  // Transform data grouped by LEVEL
  const levelsData = levelIds.map(levelId => {
    const level = levels?.find(l => l.id === levelId)
    if (!level) return null

    const course = Array.isArray(level.courses) ? level.courses[0] : level.courses

    const levelUnits = units.filter(u => u.level_id === level.id)
    
    const transformedUnits = levelUnits.map(unit => {
      const unitLessons = lessons?.filter(l => l.unit_id === unit.id) || []
      const unitMaterials = unitLessons.flatMap(lesson => {
        const lessonMaterials = materials?.filter(m => m.lesson_id === lesson.id) || []
        return lessonMaterials.map(material => {
          const content = materialContents?.find(c => c.material_id === material.id)
          const isCompleted = progress?.some(p => p.material_id === material.id)
          
          // ✅ Extract URL dari material_contents (schema v4.1)
          let materialUrl = null
          let componentId = null

          if (material.category === 'live_zoom' || material.category === 'kosakata') {
            materialUrl = content?.content_url || null
          } else if (material.category === 'bacaan') {
            componentId = content?.storage_path || null
          } else if (material.category === 'cefr') {
            // CEFR pakai lesson_contents (block editor) — lesson_id jadi identifier
            componentId = material.lesson_id || null
          }
          
          return {
            id: material.id,
            title: material.title,
            category: material.category || 'live_zoom',
            gdrive_url: materialUrl,
            component_id: componentId,
            completed: isCompleted || false,
            lesson_title: lesson.lesson_name,
            unit_name: unit.unit_name
          }
        })
      })

      const chapter = chapters?.find(c => c.id === unit.chapter_id)

      console.log('🔍 Unit Transform:', {
        unit_name: unit.unit_name,
        chapter_id: unit.chapter_id,
        found_chapter: chapter,
        chapter_title: chapter?.chapter_title
      })

      return {
        id: unit.id,
        name: unit.unit_name,
        chapter_title: chapter?.chapter_title || null,
        sort_order: unit.position,
        materials: unitMaterials
      }
    })

    return {
      level_id: level.id,
      level_name: level.name,
      course_name: course?.name || '',
      units: transformedUnits
    }
  }).filter((l): l is NonNullable<typeof l> => l !== null)

  return (
    <div className="min-h-screen bg-[#F7F6FF]">
      <MateriContent
        levelsData={levelsData}
        studentName={profile?.full_name || 'Student'}
        studentSlug={slug}
      />
    </div>
  )
}
