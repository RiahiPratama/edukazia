import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { id } = params;

    // Check auth
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse form data
    const formData = await request.formData();
    const chapter_title = formData.get('chapter_title') as string;
    const icon = formData.get('icon') as string;

    // Prepare update data
    const updateData: any = {};
    
    if (chapter_title && chapter_title.trim()) {
      updateData.chapter_title = chapter_title.trim();
    }
    
    if (icon && typeof icon === 'string') {
      updateData.icon = icon;
    }

    // Validate - at least one field must be provided
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    // Update chapter
    const { data, error } = await supabase
      .from('chapters')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating chapter:', error);
      return NextResponse.json(
        { error: 'Failed to update chapter' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
      message: 'Chapter updated successfully'
    });

  } catch (error) {
    console.error('Error in PATCH /api/admin/chapters/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
