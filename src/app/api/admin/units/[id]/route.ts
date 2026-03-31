import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const formData = await request.formData();
    const position = formData.get('position');
    const unit_name = formData.get('unit_name');

    if (!id) {
      return NextResponse.json(
        { error: 'Missing unit ID' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Build update object dynamically
    const updateData: any = {};
    
    // Update position if provided
    if (position !== null && position !== '') {
      updateData.position = parseInt(position as string);
    }
    
    // Update unit_name if provided and not empty
    if (unit_name && typeof unit_name === 'string' && unit_name.trim() !== '') {
      updateData.unit_name = unit_name.trim();
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    // Update unit
    const { error: updateError } = await supabase
      .from('units')
      .update(updateData)
      .eq('id', id);

    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true,
      message: 'Unit updated successfully',
      updated: updateData
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
