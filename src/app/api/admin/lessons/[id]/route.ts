import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    // Check auth
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse form data
    const formData = await request.formData();
    const lesson_name = formData.get('lesson_name') as string;
    const position = formData.get('position') as string;

    // Update lesson name if provided
    if (lesson_name && lesson_name.trim()) {
      const { error: lessonError } = await supabase
        .from('lessons')
        .update({ lesson_name: lesson_name.trim() })
        .eq('id', id);

      if (lessonError) {
        console.error('Error updating lesson name:', lessonError);
        return NextResponse.json(
          { error: 'Failed to update lesson name' },
          { status: 500 }
        );
      }
    }

    // Update position in materials table (all materials in this lesson)
    if (position !== null && position !== '') {
      const positionNum = parseInt(position);
      if (!isNaN(positionNum)) {
        const { error: positionError } = await supabase
          .from('materials')
          .update({ position: positionNum })
          .eq('lesson_id', id);

        if (positionError) {
          console.error('Error updating lesson position:', positionError);
          return NextResponse.json(
            { error: 'Failed to update lesson position' },
            { status: 500 }
          );
        }
      }
    }

    // Fetch updated lesson data
    const { data: lessonData } = await supabase
      .from('lessons')
      .select('*')
      .eq('id', id)
      .single();

    return NextResponse.json({
      success: true,
      data: lessonData,
      message: 'Lesson updated successfully'
    });

  } catch (error) {
    console.error('Error in PATCH /api/admin/lessons/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
