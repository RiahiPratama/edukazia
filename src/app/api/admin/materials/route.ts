// ============================================================
// PATCH - UPDATE EXISTING MATERIAL (v4.1 COMPATIBLE)
// ============================================================
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
    const position = parseInt(formData.get('order_number') as string);
    const isPublished = formData.get('is_published') === 'true';
    const contentDataStr = formData.get('content_data') as string;
    const file = formData.get('file') as File | null;

    // NEW: Unit & Lesson edit fields
    const unitId = formData.get('unit_id') as string;
    const unitName = formData.get('unit_name') as string;
    const unitPositionStr = formData.get('unit_position') as string;
    const lessonId = formData.get('lesson_id') as string;
    const lessonName = formData.get('lesson_name') as string;
    const lessonPositionStr = formData.get('lesson_position') as string;

    console.log('📝 Updating material v4.1:', materialId);
    console.log('📦 Unit update:', { unitId, unitName, unitPosition: unitPositionStr });
    console.log('📚 Lesson update:', { lessonId, lessonName, lessonPosition: lessonPositionStr });

    if (!materialId) {
      return NextResponse.json({ error: 'Material ID required' }, { status: 400 });
    }

    // Get existing material
    const { data: existingMaterial, error: fetchError } = await supabase
      .from('materials')
      .select('*, material_contents(*)')
      .eq('id', materialId)
      .single();

    if (fetchError || !existingMaterial) {
      return NextResponse.json({ error: 'Material not found' }, { status: 404 });
    }

    let contentData = contentDataStr ? JSON.parse(contentDataStr) : {};
    const category = existingMaterial.category;

    // Handle file upload if new file provided
    let newFilePath: string | null = null;
    let newBucket: string | null = null;

    if (file) {
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(7);
      const ext = file.name.split('.').pop()?.toLowerCase() || '';

      if (category === 'bacaan') {
        newBucket = 'components';
        newFilePath = `${timestamp}-${random}.jsx`;
      } else if (category === 'cefr') {
        newBucket = 'audio';
        newFilePath = `${timestamp}-${random}.${ext}`;
      }

      if (newBucket && newFilePath) {
        // Delete old file if exists
        const oldContent = existingMaterial.material_contents?.[0];
        if (oldContent) {
          const oldPath = category === 'bacaan' ? oldContent.storage_path : oldContent.audio_path;
          const oldBucket = category === 'bacaan' ? oldContent.storage_bucket : oldContent.audio_bucket;
          if (oldPath && oldBucket) {
            await supabase.storage.from(oldBucket).remove([oldPath]);
          }
        }

        // Upload new file
        const { error: uploadError } = await supabase.storage
          .from(newBucket)
          .upload(newFilePath, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          return NextResponse.json({
            error: 'Failed to upload file',
            details: uploadError.message
          }, { status: 500 });
        }
      }
    }

    // ============================================================
    // NEW: UPDATE UNIT & LESSON (if changed)
    // ============================================================
    
    // Update Unit name & position
    if (unitId && (unitName || unitPositionStr)) {
      const unitUpdateData: any = {};
      
      if (unitName) {
        unitUpdateData.unit_name = unitName;
      }
      
      if (unitPositionStr) {
        const unitPosition = parseInt(unitPositionStr);
        if (!isNaN(unitPosition)) {
          unitUpdateData.position = unitPosition;
        }
      }

      if (Object.keys(unitUpdateData).length > 0) {
        console.log('🔄 Updating unit:', unitId, unitUpdateData);
        
        const { error: unitUpdateError } = await supabase
          .from('units')
          .update(unitUpdateData)
          .eq('id', unitId);

        if (unitUpdateError) {
          console.error('Unit update error:', unitUpdateError);
          return NextResponse.json({
            error: 'Failed to update unit',
            details: unitUpdateError.message
          }, { status: 500 });
        }

        console.log('✅ Unit updated successfully');
      }
    }

    // Update Lesson name & position
    if (lessonId && (lessonName || lessonPositionStr)) {
      const lessonUpdateData: any = {};
      
      if (lessonName) {
        lessonUpdateData.lesson_name = lessonName;
      }
      
      if (lessonPositionStr) {
        const lessonPosition = parseInt(lessonPositionStr);
        if (!isNaN(lessonPosition)) {
          lessonUpdateData.position = lessonPosition;
        }
      }

      if (Object.keys(lessonUpdateData).length > 0) {
        console.log('🔄 Updating lesson:', lessonId, lessonUpdateData);
        
        const { error: lessonUpdateError } = await supabase
          .from('lessons')
          .update(lessonUpdateData)
          .eq('id', lessonId);

        if (lessonUpdateError) {
          console.error('Lesson update error:', lessonUpdateError);
          return NextResponse.json({
            error: 'Failed to update lesson',
            details: lessonUpdateError.message
          }, { status: 500 });
        }

        console.log('✅ Lesson updated successfully');
      }
    }

    // ============================================================
    // UPDATE MATERIAL - WITH CANVA_URLS FIX
    // ============================================================
    const materialUpdateData: any = {
      title,
      position,
      is_published: isPublished,
      updated_at: new Date().toISOString(),
    };

    // CRITICAL FIX: Save canva_urls to materials table for live_zoom
    if (category === 'live_zoom' && contentData) {
      const canvaUrl = contentData.url || contentData.zoom_link || contentData.canva_link;
      if (canvaUrl) {
        materialUpdateData.canva_urls = [canvaUrl];
        console.log('✅ Saving to canva_urls:', canvaUrl);
      }
    }

    const { data: updatedMaterial, error: updateError } = await supabase
      .from('materials')
      .update(materialUpdateData)
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

    // Update material_contents if needed
    if (newFilePath || contentDataStr) {
      const existingContent = existingMaterial.material_contents?.[0];
      
      const contentUpdate: any = {
        content_data: contentData,
      };

      if (newFilePath) {
        if (category === 'bacaan') {
          contentUpdate.storage_path = newFilePath;
          contentUpdate.storage_bucket = newBucket;
        } else if (category === 'cefr') {
          contentUpdate.audio_path = newFilePath;
          contentUpdate.audio_bucket = newBucket;
        }
      }

      if (contentData.url || contentData.zoom_link || contentData.canva_link) {
        contentUpdate.content_url = contentData.url || contentData.zoom_link || contentData.canva_link;
      }

      if (existingContent) {
        // Update existing content
        await supabase
          .from('material_contents')
          .update(contentUpdate)
          .eq('id', existingContent.id);
      }
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
