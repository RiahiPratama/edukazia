import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// POST - Create new material (existing code remains same)
export async function POST(request: NextRequest) {
  // ... existing POST code stays the same ...
  // (Keep all the existing code from route-FINAL-FIX.ts)
}

// PATCH - Update existing material
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Authentication check
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

    // Parse form data
    const formData = await request.formData();
    
    const materialId = formData.get('material_id') as string;
    const title = formData.get('title') as string;
    const orderNumber = parseInt(formData.get('order_number') as string);
    const isPublished = formData.get('is_published') === 'true';
    const contentDataStr = formData.get('content_data') as string;
    const file = formData.get('file') as File | null;

    console.log('📝 Updating material:', materialId);

    if (!materialId) {
      return NextResponse.json({ error: 'Material ID required' }, { status: 400 });
    }

    // Get existing material
    const { data: existingMaterial, error: fetchError } = await supabase
      .from('materials')
      .select('*')
      .eq('id', materialId)
      .single();

    if (fetchError || !existingMaterial) {
      return NextResponse.json({ error: 'Material not found' }, { status: 404 });
    }

    let contentData = JSON.parse(contentDataStr);
    const category = existingMaterial.category;

    // Handle file upload if new file provided
    if (file) {
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(7);
      
      // Sanitize filename
      const originalName = file.name;
      const sanitizedName = originalName
        .replace(/[^a-zA-Z0-9.-]/g, '_')
        .replace(/_+/g, '_')
        .toLowerCase();
      
      const ext = sanitizedName.split('.').pop();
      const baseName = sanitizedName.replace(`.${ext}`, '');
      const fileName = `${baseName}-${timestamp}-${random}.${ext}`;

      // Upload to appropriate bucket
      let bucket = '';
      let filePath = '';

      if (category === 'bacaan') {
        bucket = 'components';
        filePath = `bacaan/${fileName}`;
      } else if (category === 'cefr') {
        bucket = 'audio';
        filePath = `cefr/${fileName}`;
      }

      if (bucket) {
        // Delete old file if exists
        const oldPath = category === 'bacaan' 
          ? existingMaterial.content_data?.jsx_file_path 
          : existingMaterial.content_data?.audio_url;

        if (oldPath) {
          await supabase.storage.from(bucket).remove([oldPath]);
        }

        // Upload new file
        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(filePath, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          return NextResponse.json({ 
            error: 'Failed to upload file',
            details: uploadError.message 
          }, { status: 500 });
        }

        // Update content data with new file path
        if (category === 'bacaan') {
          contentData.jsx_file_path = filePath;
        } else if (category === 'cefr') {
          contentData.audio_url = filePath;
        }
      }
    }

    // Update material
    const { data: updatedMaterial, error: updateError } = await supabase
      .from('materials')
      .update({
        title,
        order_number: orderNumber,
        is_published: isPublished,
        content_data: contentData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', materialId)
      .select()
      .single();

    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.json({ 
        error: 'Failed to update material',
        details: updateError.message 
      }, { status: 500 });
    }

    console.log('✅ Material updated:', updatedMaterial.id);

    return NextResponse.json({ 
      success: true,
      material: updatedMaterial 
    });

  } catch (error) {
    console.error('PATCH error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
