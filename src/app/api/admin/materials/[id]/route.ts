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
    const title = formData.get('title') as string;
    const url = formData.get('url') as string;

    // Validate inputs
    if (!title || !title.trim()) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    if (!url || !url.trim()) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // Get current material to know the category
    const { data: currentMaterial } = await supabase
      .from('materials')
      .select('category, content_data')
      .eq('id', id)
      .single();

    if (!currentMaterial) {
      return NextResponse.json(
        { error: 'Material not found' },
        { status: 404 }
      );
    }

    const content_data = currentMaterial.content_data || {};
    
    // Update URL based on category
    if (currentMaterial.category === 'live_zoom') {
      content_data.url = url.trim();
      content_data.zoom_link = url.trim();
    } else if (currentMaterial.category === 'kosakata') {
      content_data.url = url.trim();
      content_data.canva_link = url.trim();
    }

    // Update material
    const { data, error } = await supabase
      .from('materials')
      .update({ 
        title: title.trim(),
        content_data 
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating material:', error);
      return NextResponse.json(
        { error: 'Failed to update material' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
      message: 'Material updated successfully'
    });

  } catch (error) {
    console.error('Error in PATCH /api/admin/materials/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

