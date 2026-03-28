// UPDATED PATCH METHOD - Add to src/app/api/admin/materials/route.ts

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

    // HIERARCHY CHANGE SUPPORT
    const courseId = formData.get('course_id') as string;
    const levelId = formData.get('level_id') as string;
    const judulId = formData.get('judul_id') as string;
    const judulName = formData.get('judul_name') as string;
    const unitId = formData.get('unit_id') as string;
    const unitName = formData.get('unit_name') as string;
    const lessonId = formData.get('lesson_id') as string;
    const lessonName = formData.get('lesson_name') as string;

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
      
      const originalName = file.name;
      const sanitizedName = originalName
        .replace(/[^a-zA-Z0-9.-]/g, '_')
        .replace(/_+/g, '_')
        .toLowerCase();
      
      const ext = sanitizedName.split('.').pop();
      const baseName = sanitizedName.replace(`.${ext}`, '');
      const fileName = `${baseName}-${timestamp}-${random}.${ext}`;

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

        if (category === 'bacaan') {
          contentData.jsx_file_path = filePath;
        } else if (category === 'cefr') {
          contentData.audio_url = filePath;
        }
      }
    }

    // ============================================================
    // HANDLE HIERARCHY CHANGES
    // ============================================================
    let finalLessonId = existingMaterial.lesson_id;

    // If hierarchy info provided, handle inline creation + get correct lesson_id
    if (courseId && levelId && lessonId) {
      // 1. Create Judul if new
      let actualJudulId = judulId;
      if (judulId === 'NEW' && judulName && levelId) {
        console.log('🆕 Creating new Judul:', judulName);
        
        const { data: newJudul, error: judulError } = await supabase
          .from('juduls')
          .insert({
            level_id: levelId,
            name: judulName,
            is_active: true,
            sort_order: 0,
          })
          .select()
          .single();
        
        if (judulError) {
          console.error('Judul creation error:', judulError);
          return NextResponse.json({ 
            error: 'Failed to create judul',
            details: judulError.message 
          }, { status: 500 });
        }
        
        actualJudulId = newJudul.id;
        console.log('✅ Judul created:', actualJudulId);
      }

      // 2. Create Unit if new
      let actualUnitId = unitId;
      if (unitId === 'NEW' && unitName && actualJudulId) {
        console.log('🆕 Creating new Unit:', unitName);
        
        const { data: newUnit, error: unitError } = await supabase
          .from('units')
          .insert({
            judul_id: actualJudulId,
            unit_name: unitName,
            sort_order: 0,
          })
          .select()
          .single();
        
        if (unitError) {
          console.error('Unit creation error:', unitError);
          return NextResponse.json({ 
            error: 'Failed to create unit',
            details: unitError.message 
          }, { status: 500 });
        }
        
        actualUnitId = newUnit.id;
        console.log('✅ Unit created:', actualUnitId);
      }

      // 3. Create Lesson if new
      if (lessonId === 'NEW' && lessonName && actualUnitId) {
        console.log('🆕 Creating new Lesson:', lessonName);
        
        const { data: newLesson, error: lessonError } = await supabase
          .from('lessons')
          .insert({
            unit_id: actualUnitId,
            lesson_name: lessonName,
            sort_order: 0,
          })
          .select()
          .single();
        
        if (lessonError) {
          console.error('Lesson creation error:', lessonError);
          return NextResponse.json({ 
            error: 'Failed to create lesson',
            details: lessonError.message 
          }, { status: 500 });
        }
        
        finalLessonId = newLesson.id;
        console.log('✅ Lesson created:', finalLessonId);
      } else if (lessonId && lessonId !== 'NEW') {
        // Use existing lesson
        finalLessonId = lessonId;
      }
    }

    // Update material
    const { data: updatedMaterial, error: updateError } = await supabase
      .from('materials')
      .update({
        title,
        lesson_id: finalLessonId, // Can be changed!
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
