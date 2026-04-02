import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ============================================================
// GET — Ambil blocks untuk lesson
// ============================================================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  try {
    const supabase = await createClient();
    const { lessonId } = await params;

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('lesson_contents')
      .select('id, blocks, updated_at')
      .eq('lesson_id', lessonId)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = not found, wajar kalau belum ada konten
      return NextResponse.json({ error: 'Failed to fetch content' }, { status: 500 });
    }

    return NextResponse.json({
      lesson_id: lessonId,
      blocks: data?.blocks || [],
      updated_at: data?.updated_at || null,
    });

  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================================
// POST — Simpan blocks untuk lesson
// ============================================================
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  try {
    const supabase = await createClient();
    const { lessonId } = await params;

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 });
    }

    const body = await request.json();
    const { blocks } = body;

    if (!Array.isArray(blocks)) {
      return NextResponse.json({ error: 'blocks harus berupa array' }, { status: 400 });
    }

    // Upsert — insert kalau belum ada, update kalau sudah ada
    const { data, error } = await supabase
      .from('lesson_contents')
      .upsert({
        lesson_id: lessonId,
        blocks,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'lesson_id',
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving blocks:', error);
      return NextResponse.json({
        error: 'Failed to save content',
        details: error.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      lesson_id: lessonId,
      blocks: data.blocks,
      updated_at: data.updated_at,
    });

  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================================
// DELETE — Hapus semua blocks (reset konten lesson)
// ============================================================
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  try {
    const supabase = await createClient();
    const { lessonId } = await params;

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 });
    }

    const { error } = await supabase
      .from('lesson_contents')
      .delete()
      .eq('lesson_id', lessonId);

    if (error) {
      return NextResponse.json({ error: 'Failed to delete content' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Konten berhasil direset' });

  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
