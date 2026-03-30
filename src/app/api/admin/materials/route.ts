import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ============================================================
// POST - CREATE NEW MATERIAL (v4.1 COMPATIBLE)
// ============================================================
export async function POST(request: NextRequest) {
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

    const title = formData.get('title') as string;
    const category = formData.get('category') as string;
    const levelId = formData.get('level_id') as string;
    const unitId = formData.get('unit_id') as string;
    const unitName = formData.get('unit_name') as string;
    const lessonId = formData.get('lesson_id') as string;
    const lessonName = formData.get('lesson_name') as string;
    const position = parseInt(formData.get('order_number') as string) || 1;
    const isPublished = formData.get('is_published') === 'true';
    const contentDataStr = formData.get('content_data') as string;
    const file = formData.get('file') as File | null;

    console.log('📦 Creating material v4.1:', { title, category, levelId });

    // Validate required fields
    if (!title || !category || !levelId) {
      return NextResponse.json({
        error: 'Missing required fields',
        details: 'title, category, and level_id are required'
      }, { status: 400 });
    }

    // Parse content data
    let contentData: any = {};
    if (contentDataStr) {
      try {
        contentData = JSON.parse(contentDataStr);
      } catch (e) {
        return NextResponse.json({
          error: 'Invalid content_data JSON'
        }, { status: 400 });
      }
    }

    // ============================================================
    // STEP 1: CREATE HIERARCHY (unit → lesson)
    // ============================================================

    // 1. Create or get Unit
    let actualUnitId = unitId;
    if (unitId === 'NEW' && unitName) {
      console.log('🆕 Creating new Unit:', unitName);

      const { data: newUnit, error: unitError } = await supabase
        .from('units')
        .insert({
          level_id: levelId,
          unit_name: unitName,
          unit_number: 0,
          position: 0,
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

    if (!actualUnitId) {
      return NextResponse.json({
        error: 'Unit ID required'
      }, { status: 400 });
    }

    // 2. Create or get Lesson
    let actualLessonId = lessonId;
    if (lessonId === 'NEW' && lessonName) {
      console.log('🆕 Creating new Lesson:', lessonName);

      const { data: newLesson, error: lessonError } = await supabase
        .from('lessons')
        .insert({
          unit_id: actualUnitId,
          lesson_name: lessonName,
          position: 0,
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

      actualLessonId = newLesson.id;
      console.log('✅ Lesson created:', actualLessonId);
    }

    if (!actualLessonId) {
      return NextResponse.json({
        error: 'Lesson ID required'
      }, { status: 400 });
    }

    // ============================================================
    // STEP 2: HANDLE FILE UPLOADS
    // ============================================================
    let filePath: string | null = null;
    let bucket: string | null = null;

    if (file) {
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(7);
      const ext = file.name.split('.').pop()?.toLowerCase() || '';

      if (category === 'bacaan') {
        bucket = 'components';
        filePath = `${timestamp}-${random}.jsx`;
      } else if (category === 'cefr') {
        bucket = 'audio';
        filePath = `${timestamp}-${random}.${ext}`;
      }

      if (bucket && filePath) {
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
      }
    }

    // ============================================================
    // STEP 3: CREATE MATERIAL
    // ============================================================
    const { data: material, error: materialError } = await supabase
      .from('materials')
      .insert({
        title,
        category,
        type: category,
        level_id: levelId,
        unit_id: actualUnitId,
        lesson_id: actualLessonId,
        position,
        is_published: isPublished,
        canva_urls: category === 'live_zoom' && contentData?.url ? [contentData.url] : null,
      })
      .select()
      .single();

    if (materialError) {
      console.error('Material creation error:', materialError);
      return NextResponse.json({
        error: 'Failed to create material',
        details: materialError.message
      }, { status: 500 });
    }

    // ============================================================
    // STEP 4: CREATE MATERIAL_CONTENT
    // ============================================================
    const contentRecord: any = {
      material_id: material.id,
      content_data: contentData,
      content_type: category,
    };

    if (filePath) {
      if (category === 'bacaan') {
        contentRecord.storage_path = filePath;
        contentRecord.storage_bucket = bucket;
      } else if (category === 'cefr') {
        contentRecord.audio_path = filePath;
        contentRecord.audio_bucket = bucket;
      }
    }

    if (contentData.url || contentData.zoom_link || contentData.canva_link) {
      contentRecord.content_url = contentData.url || contentData.zoom_link || contentData.canva_link;
    }

    const { error: contentError } = await supabase
      .from('material_contents')
      .insert(contentRecord);

    if (contentError) {
      console.error('Content creation error:', contentError);
      // Rollback material creation
      await supabase.from('materials').delete().eq('id', material.id);
      return NextResponse.json({
        error: 'Failed to create material content',
        details: contentError.message
      }, { status: 500 });
    }

    console.log('✅ Material created:', material.id);

    return NextResponse.json({
      success: true,
      material
    });

  } catch (error) {
    console.error('POST error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

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

    // HIERARCHY CHANGE SUPPORT
    const levelId = formData.get('level_id') as string;
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
    // HANDLE HIERARCHY CHANGES (Moving to different unit/lesson)
    // ============================================================
    let finalLessonId = existingMaterial.lesson_id;

    if (levelId && lessonId) {
      // 1. Create Unit if new
      let actualUnitId = unitId;
      if (unitId === 'NEW' && unitName && levelId) {
        console.log('🆕 Creating new Unit:', unitName);

        const { data: newUnit, error: unitError } = await supabase
          .from('units')
          .insert({
            level_id: levelId,
            unit_name: unitName,
            unit_number: 0,
            position: 0,
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

      // 2. Create Lesson if new
      if (lessonId === 'NEW' && lessonName && actualUnitId) {
        console.log('🆕 Creating new Lesson:', lessonName);

        const { data: newLesson, error: lessonError } = await supabase
          .from('lessons')
          .insert({
            unit_id: actualUnitId,
            lesson_name: lessonName,
            position: 0,
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
        finalLessonId = lessonId;
      }
    }

    // ============================================================
    // UPDATE MATERIAL - WITH CANVA_URLS FIX
    // ============================================================
    const materialUpdateData: any = {
      title,
      lesson_id: finalLessonId,
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
