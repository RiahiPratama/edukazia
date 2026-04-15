import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import MateriContent from './MateriContent'

export const dynamic = 'force-dynamic'

export default async function MateriPage({ 
  params 
}: { 
  params: Promise<{ slug: string }> 
}) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  // 1. Get student by slug
  const { data: students } = await supabase
    .from('students')
    .select('id, profile_id')
    .eq('slug', slug)
  if (!students || students.length === 0) notFound()
  const student = students[0]

  // 2. Student profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', student.profile_id)
    .single()

  // 3. Active enrollments
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('id, level_id, class_group_id')
    .eq('student_id', student.id)
    .eq('status', 'active')

  if (!enrollments || enrollments.length === 0) {
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white border-2 border-[#E5E3FF] rounded-xl p-8 text-center">
            <p className="text-lg text-gray-600">Hubungi admin untuk mengatur level pembelajaran kamu.</p>
          </div>
        </div>
      </div>
    )
  }

  // 4. Collect level IDs from 3 sources
  const enrollmentIds    = enrollments.map(e => e.id)
  const classGroupIds    = enrollments.map(e => e.class_group_id).filter(Boolean)
  const levelIdsFromEnr  = enrollments.map(e => e.level_id).filter((id): id is string => !!id)

  const { data: enrollmentLevels } = await supabase
    .from('enrollment_levels')
    .select('level_id')
    .in('enrollment_id', enrollmentIds)
  const levelIdsFromJunction = enrollmentLevels?.map(el => el.level_id) || []

  const { data: classGroupLevels } = classGroupIds.length > 0
    ? await supabase.from('class_group_levels').select('level_id').in('class_group_id', classGroupIds)
    : { data: [] }
  const levelIdsFromClassGroups = classGroupLevels?.map(cgl => cgl.level_id) || []

  const levelIds = Array.from(new Set([
    ...levelIdsFromEnr, ...levelIdsFromJunction, ...levelIdsFromClassGroups,
  ].filter(Boolean)))

  if (levelIds.length === 0) {
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white border-2 border-[#E5E3FF] rounded-xl p-8 text-center">
            <p className="text-lg text-gray-600">Level pembelajaran tidak ditemukan.</p>
          </div>
        </div>
      </div>
    )
  }

  // 5. Levels with courses
  const { data: levels } = await supabase
    .from('levels')
    .select('id, name, sort_order, course_id, courses:course_id(id, name)')
    .in('id', levelIds)
    .order('sort_order')

  // 6. Units (with chapter_id and position)
  const { data: units } = await supabase
    .from('units')
    .select('id, unit_name, position, level_id, chapter_id')
    .in('level_id', levelIds)
    .order('position')

  if (!units || units.length === 0) {
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white border-2 border-[#E5E3FF] rounded-xl p-8 text-center">
            <p className="text-lg text-gray-600">Materi pembelajaran belum tersedia.</p>
          </div>
        </div>
      </div>
    )
  }

  // 7. Chapters
  const chapterIds = units.map(u => u.chapter_id).filter((id): id is string => !!id)
  const { data: chapters } = await supabase
    .from('chapters')
    .select('id, chapter_title, level_id, order_number')
    .in('id', chapterIds)
    .order('order_number')

  // 8. Compute global position (for sort_order, backward compat)
  const levelOrderMap: Record<string, number> = {}
  levels?.forEach((l: any) => { levelOrderMap[l.id] = l.sort_order ?? 0 })
  const chapterOrderMap: Record<string, number> = {}
  chapters?.forEach((c: any) => { chapterOrderMap[c.id] = (levelOrderMap[c.level_id] ?? 0) * 1000 + (c.order_number ?? 0) })

  const sortedUnitsGlobal = [...units].sort((a, b) => {
    const la = levelOrderMap[a.level_id] ?? 0
    const lb = levelOrderMap[b.level_id] ?? 0
    if (la !== lb) return la - lb
    const ca = a.chapter_id ? (chapterOrderMap[a.chapter_id] ?? 0) : 999
    const cb = b.chapter_id ? (chapterOrderMap[b.chapter_id] ?? 0) : 999
    if (ca !== cb) return ca - cb
    return (a.position ?? 0) - (b.position ?? 0)
  })
  const globalPosMap: Record<string, number> = {}
  sortedUnitsGlobal.forEach((u, idx) => { globalPosMap[u.id] = idx + 1 })

  // 9. Lessons
  const unitIds = units.map(u => u.id)
  const { data: lessons } = await supabase
    .from('lessons')
    .select('id, lesson_name, position, unit_id')
    .in('unit_id', unitIds)
    .order('position')

  // 10. Materials (published only)
  const lessonIds = lessons?.map(l => l.id) || []
  const { data: materials } = await supabase
    .from('materials')
    .select('id, title, position, lesson_id, category, is_published')
    .in('lesson_id', lessonIds)
    .eq('is_published', true)
    .order('position')

  // 11. Material contents
  const materialIds = materials?.map(m => m.id) || []
  const { data: materialContents } = await supabase
    .from('material_contents')
    .select('material_id, content_url, storage_path, student_content_url, canva_url, slides_url')
    .in('material_id', materialIds)

  // 12. Material progress
  let progress: { material_id: string; completed_at: string }[] = []
  try {
    const { data: progressData, error: progressError } = await supabase
      .from('material_progress')
      .select('material_id, completed_at')
      .eq('student_id', student.id)
    if (!progressError && progressData) progress = progressData
  } catch (e) { /* table may not exist yet */ }

  // ────────────────────────────────────────────────
  // 13. Chapter Lock Map (NEW — replaces unitLockMap)
  // chapterLockMap[chapter_id] = { unit: N, lesson: M }
  // N = position within chapter that is currently active (i.e., unlocked up to N)
  // Default: undefined → all unlocked (999)
  // ────────────────────────────────────────────────
  const chapterLockMap: Record<string, { unit: number; lesson: number }> = {}

  // Source A: student_chapter_progress (Privat)
  const { data: studentChProg } = await supabase
    .from('student_chapter_progress')
    .select('chapter_id, current_unit_position, current_lesson_position, class_group_id')
    .eq('student_id', student.id)
    .in('class_group_id', classGroupIds.length > 0 ? classGroupIds : ['00000000-0000-0000-0000-000000000000'])

  studentChProg?.forEach((sp: any) => {
    const existing = chapterLockMap[sp.chapter_id]
    if (!existing || sp.current_unit_position > existing.unit) {
      chapterLockMap[sp.chapter_id] = {
        unit: sp.current_unit_position ?? 1,
        lesson: sp.current_lesson_position ?? 999,
      }
    }
  })

  // Source B: class_group_chapter_progress (Grup)
  if (classGroupIds.length > 0) {
    const { data: cgChProg } = await supabase
      .from('class_group_chapter_progress')
      .select('chapter_id, current_unit_position, current_lesson_position, class_group_id')
      .in('class_group_id', classGroupIds)

    cgChProg?.forEach((cp: any) => {
      const existing = chapterLockMap[cp.chapter_id]
      if (!existing || cp.current_unit_position > existing.unit) {
        chapterLockMap[cp.chapter_id] = {
          unit: cp.current_unit_position ?? 1,
          lesson: cp.current_lesson_position ?? 999,
        }
      }
    })
  }

  // ────────────────────────────────────────────────
  // 14. Transform data grouped by LEVEL
  // ────────────────────────────────────────────────
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
          const isCompleted = progress.some(p => p.material_id === material.id)
          let materialUrl = null
          let componentId = null
          if (material.category === 'live_zoom' || material.category === 'kosakata') {
            materialUrl = content?.canva_url || content?.content_url || null
          } else if (material.category === 'bacaan') {
            componentId = content?.storage_path || null
          } else if (material.category === 'cefr') {
            componentId = material.lesson_id || null
          }
          return {
            id: material.id,
            title: material.title,
            category: material.category || 'live_zoom',
            gdrive_url: materialUrl,
            component_id: componentId,
            student_content_url: content?.student_content_url || null,
            slides_url: content?.slides_url || null,
            completed: isCompleted || false,
            lesson_title: lesson.lesson_name,
            lesson_position: lesson.position ?? 0,
            unit_name: unit.unit_name,
          }
        })
      })

      const chapter = chapters?.find(c => c.id === unit.chapter_id)

      return {
        id: unit.id,
        name: unit.unit_name,
        chapter_title: chapter?.chapter_title || null,
        chapter_id: unit.chapter_id || null,           // ← NEW
        chapter_order: chapter?.order_number || 0,
        sort_order: globalPosMap[unit.id] || unit.position,
        unit_position: unit.position,                  // ← NEW: position within chapter
        materials: unitMaterials,
      }
    })

    return {
      level_id: level.id,
      level_name: level.name,
      course_name: course?.name || '',
      units: transformedUnits,
    }
  }).filter((l): l is NonNullable<typeof l> => l !== null)
    .sort((a, b) => {
      const aSort = levels?.find(l => l.id === a.level_id)?.sort_order ?? 0
      const bSort = levels?.find(l => l.id === b.level_id)?.sort_order ?? 0
      return aSort - bSort
    })

  return (
    <div className="min-h-screen">
      <MateriContent
        levelsData={levelsData}
        studentName={profile?.full_name || 'Student'}
        studentSlug={slug}
        chapterLockMap={chapterLockMap}
      />
    </div>
  )
}
