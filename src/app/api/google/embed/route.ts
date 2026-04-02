import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Extract fileId dari berbagai format Google URL
function extractFileId(url: string): string | null {
  const patterns = [
    /\/presentation\/d\/([a-zA-Z0-9_-]+)/,
    /\/document\/d\/([a-zA-Z0-9_-]+)/,
    /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/,
    /id=([a-zA-Z0-9_-]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 1. Verify authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { materialId, studentSlug } = await request.json();

    if (!materialId || !studentSlug) {
      return NextResponse.json({ error: 'materialId dan studentSlug diperlukan' }, { status: 400 });
    }

    // 2. Get student by slug
    const { data: student } = await supabase
      .from('students')
      .select('id')
      .eq('slug', studentSlug)
      .single();

    if (!student) {
      return NextResponse.json({ error: 'Student tidak ditemukan' }, { status: 404 });
    }

    // 3. Verify enrollment aktif
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('id, status')
      .eq('student_id', student.id)
      .eq('status', 'active');

    if (!enrollments || enrollments.length === 0) {
      return NextResponse.json({ 
        error: 'Akses ditolak — tidak ada enrollment aktif' 
      }, { status: 403 });
    }

    // 4. Get material content URL
    const { data: material } = await supabase
      .from('materials')
      .select(`
        id, title, category, lesson_id,
        material_contents(content_url)
      `)
      .eq('id', materialId)
      .eq('is_published', true)
      .single();

    if (!material) {
      return NextResponse.json({ error: 'Material tidak ditemukan' }, { status: 404 });
    }

    const contentUrl = (material.material_contents as any)?.[0]?.content_url;
    if (!contentUrl) {
      return NextResponse.json({ error: 'URL konten tidak ditemukan' }, { status: 404 });
    }

    // 5. Extract fileId dan generate embed URL
    const fileId = extractFileId(contentUrl);
    if (!fileId) {
      return NextResponse.json({ error: 'Format URL tidak valid' }, { status: 400 });
    }

    // Generate embed URL berdasarkan tipe file
    let embedUrl: string;
    if (contentUrl.includes('/presentation/')) {
      embedUrl = `https://docs.google.com/presentation/d/${fileId}/embed?start=false&loop=false&delayms=3000`;
    } else if (contentUrl.includes('/document/')) {
      embedUrl = `https://docs.google.com/document/d/${fileId}/preview`;
    } else if (contentUrl.includes('/spreadsheets/')) {
      embedUrl = `https://docs.google.com/spreadsheets/d/${fileId}/preview`;
    } else {
      embedUrl = `https://drive.google.com/file/d/${fileId}/preview`;
    }

    return NextResponse.json({
      success: true,
      embedUrl,
      title: material.title,
    });

  } catch (error) {
    console.error('Google embed error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
