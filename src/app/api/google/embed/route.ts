import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Extract fileId dari berbagai format Google URL
function extractFileId(url: string): string | null {
  const patterns = [
    /\/presentation\/d\/([a-zA-Z0-9_-]+)/,
    /\/document\/d\/([a-zA-Z0-9_-]+)/,
    /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/,
    /id=([a-zA-Z0-9_-]+)/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 1. Verify authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { materialId, studentSlug } = await request.json()

    if (!materialId || !studentSlug) {
      return NextResponse.json(
        { error: 'materialId dan studentSlug diperlukan' },
        { status: 400 }
      )
    }

    // 2. Get student by slug
    const { data: student } = await supabase
      .from('students')
      .select('id')
      .eq('slug', studentSlug)
      .single()

    if (!student) {
      return NextResponse.json({ error: 'Student tidak ditemukan' }, { status: 404 })
    }

    // 3. Get material → telusuri ke level_id
    //    Chain: material → lesson → unit → level
    const { data: material } = await supabase
      .from('materials')
      .select('id, title, category, lesson_id, is_published')
      .eq('id', materialId)
      .eq('is_published', true)
      .single()

    if (!material) {
      return NextResponse.json({ error: 'Material tidak ditemukan' }, { status: 404 })
    }

    // 4. lesson → unit
    const { data: lesson } = await supabase
      .from('lessons')
      .select('id, unit_id')
      .eq('id', material.lesson_id)
      .single()

    if (!lesson) {
      return NextResponse.json({ error: 'Lesson tidak ditemukan' }, { status: 404 })
    }

    // 5. unit → level_id
    const { data: unit } = await supabase
      .from('units')
      .select('id, level_id')
      .eq('id', lesson.unit_id)
      .single()

    if (!unit) {
      return NextResponse.json({ error: 'Unit tidak ditemukan' }, { status: 404 })
    }

    const materialLevelId = unit.level_id

    // 6. FIX SECURITY: verifikasi siswa punya akses ke level ini
    //    Chain: level → class_group_levels → class_groups → enrollments (student + active)
    //
    //    Cek via 3 sumber level (sama seperti di page.tsx):
    //    Sumber A: enrollments.level_id langsung (sistem lama)
    //    Sumber B: enrollment_levels junction table
    //    Sumber C: class_group_levels (enrollment tanpa level_id)

    // Ambil semua enrollment active siswa ini
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('id, level_id, class_group_id')
      .eq('student_id', student.id)
      .eq('status', 'active')

    if (!enrollments || enrollments.length === 0) {
      return NextResponse.json(
        { error: 'Akses ditolak — tidak ada enrollment aktif' },
        { status: 403 }
      )
    }

    // Kumpulkan semua level_id yang accessible oleh siswa ini
    const enrollmentIds   = enrollments.map(e => e.id)
    const classGroupIds   = enrollments.map(e => e.class_group_id).filter(Boolean)

    // Sumber A: dari enrollments.level_id langsung
    const levelIdsA = enrollments
      .map(e => e.level_id)
      .filter((id): id is string => !!id)

    // Sumber B: dari enrollment_levels junction
    const { data: enrollmentLevels } = enrollmentIds.length > 0
      ? await supabase
          .from('enrollment_levels')
          .select('level_id')
          .in('enrollment_id', enrollmentIds)
      : { data: [] }
    const levelIdsB = (enrollmentLevels ?? []).map(el => el.level_id)

    // Sumber C: dari class_group_levels
    const { data: classGroupLevels } = classGroupIds.length > 0
      ? await supabase
          .from('class_group_levels')
          .select('level_id')
          .in('class_group_id', classGroupIds)
      : { data: [] }
    const levelIdsC = (classGroupLevels ?? []).map(cgl => cgl.level_id)

    // Gabungkan semua level yang boleh diakses siswa
    const accessibleLevelIds = new Set([...levelIdsA, ...levelIdsB, ...levelIdsC])

    // Verifikasi: apakah level material ini ada di daftar yang boleh diakses?
    if (!accessibleLevelIds.has(materialLevelId)) {
      return NextResponse.json(
        { error: 'Akses ditolak — materi bukan bagian dari level kelas kamu' },
        { status: 403 }
      )
    }

    // 7. Get material content URL
    const { data: content } = await supabase
      .from('material_contents')
      .select('content_url')
      .eq('material_id', materialId)
      .single()

    if (!content?.content_url) {
      return NextResponse.json({ error: 'URL konten tidak ditemukan' }, { status: 404 })
    }

    // 8. Extract fileId dan generate embed URL
    const fileId = extractFileId(content.content_url)
    if (!fileId) {
      return NextResponse.json({ error: 'Format URL tidak valid' }, { status: 400 })
    }

    let embedUrl: string
    if (content.content_url.includes('/presentation/')) {
      embedUrl = `https://docs.google.com/presentation/d/${fileId}/embed?start=false&loop=false&delayms=3000`
    } else if (content.content_url.includes('/document/')) {
      embedUrl = `https://docs.google.com/document/d/${fileId}/preview`
    } else if (content.content_url.includes('/spreadsheets/')) {
      embedUrl = `https://docs.google.com/spreadsheets/d/${fileId}/preview`
    } else {
      embedUrl = `https://drive.google.com/file/d/${fileId}/preview`
    }

    return NextResponse.json({
      success: true,
      embedUrl,
      title: material.title,
    })

  } catch (error) {
    console.error('Google embed error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
