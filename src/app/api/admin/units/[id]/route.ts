import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params; // ← FIX: await params for Next.js 15+

    // Check auth
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse form data
    const formData = await request.formData();
    const unit_name = formData.get('unit_name') as string;
    const icon = formData.get('icon') as string;
    const position = formData.get('position') as string;

    // Prepare update data
    const updateData: any = {};
    
    if (unit_name && unit_name.trim()) {
      updateData.unit_name = unit_name.trim();
    }
    
    if (icon && typeof icon === 'string') {
      updateData.icon = icon;
    }
    
    if (position !== null && position !== '') {
      const positionNum = parseInt(position);
      if (!isNaN(positionNum)) {
        updateData.position = positionNum;
      }
    }

    // Validate - at least one field must be provided
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    // Update unit
    const { data, error } = await supabase
      .from('units')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating unit:', error);
      return NextResponse.json(
        { error: 'Failed to update unit' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
      message: 'Unit updated successfully'
    });

  } catch (error) {
    console.error('Error in PATCH /api/admin/units/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
