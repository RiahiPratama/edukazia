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
    // NO MORE JUDULS! Units now link directly to levels!
    // ============================================================

    // 1. Create or get Unit
    let actualUnitId = unitId;
    if (unitId === 'NEW' && unitName) {
      console.log('🆕 Creating new Unit:', unitName);

      const { data: newUnit, error: unitError } = await supabase
        .from('units')
        .insert({
          level_id: levelId,  // ✅ Direct link to level (no more judul_id!)
          unit_name: unitName,
          position: 0,  // ✅ position instead of order_number
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
          position: 0,  // ✅ position instead of sort_order
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
    // STEP 2: HANDLE FILE UPLOAD (for bacaan and cefr categories)
    // ============================================================

    let uploadedFilePath = null;
    let storageBucket = null;

    if (file && (category === 'bacaan' || category === 'cefr')) {
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(7);
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      
      if (category === 'bacaan') {
        storageBucket = 'components';
        uploadedFilePath = `${timestamp}-${random}.jsx`;
      } else if (category === 'cefr') {
        storageBucket = 'audio';
        uploadedFilePath = `${timestamp}-${random}.${ext}`;
      }

      console.log('📤 Uploading file to:', { storageBucket, uploadedFilePath });

      const { error: uploadError } = await supabase.storage
        .from(storageBucket)
        .upload(uploadedFilePath, file);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        return NextResponse.json({
          error: 'Failed to upload file',
          details: uploadError.message
        }, { status: 500 });
      }

      console.log('✅ File uploaded successfully');
    }

    // ============================================================
    // STEP 3: CREATE MATERIAL RECORD
    // ============================================================

    const { data: newMaterial, error: materialError } = await supabase
      .from('materials')
      .insert({
        title,
        category,
        lesson_id: actualLessonId,
        position,  // ✅ position instead of order_number
        is_published: isPublished,
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

    console.log('✅ Material created:', newMaterial.id);

    // ============================================================
    // STEP 4: CREATE MATERIAL_CONTENTS RECORD
    // This is the NEW table in v4.1!
    // ============================================================

    let contentType: 'url' | 'component' | 'audio' = 'url';
    let contentUrl: string | null = null;
    let audioPath: string | null = null;
    let storagePath: string | null = null;

    if (category === 'live_zoom') {
      contentType = 'url';
      contentUrl = contentData.zoom_link || contentData.url || null;
    } else if (category === 'kosakata') {
      contentType = 'url';
      contentUrl = contentData.url || contentData.canva_link || contentData.gdrive_url || null;
    } else if (category === 'bacaan') {
      contentType = 'component';
      storagePath = uploadedFilePath;
    } else if (category === 'cefr') {
      contentType = 'audio';
      audioPath = uploadedFilePath;
    }

    const { data: materialContent, error: contentError } = await supabase
      .from('material_contents')
      .insert({
        material_id: newMaterial.id,
        content_type: contentType,
        content_url: contentUrl,
        storage_bucket: storageBucket,
        storage_path: storagePath,
        audio_bucket: storageBucket,
        audio_path: audioPath,
        content_data: contentData,
      })
      .select()
      .single();

    if (contentError) {
      console.error('Material content creation error:', contentError);
      // Delete the material if content creation fails
      await supabase.from('materials').delete().eq('id', newMaterial.id);
      return NextResponse.json({
        error: 'Failed to create material content',
        details: contentError.message
      }, { status: 500 });
    }

    console.log('✅ Material content created:', materialContent.id);

    return NextResponse.json({
      success: true,
      material: newMaterial,
      content: materialContent
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
    const lessonId = formData.get('lesson_id') as string;
    const lessonName = formData.get('lesson_name') as string;

    console.log('📝 Updating material v4.1:', materialId);

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
    let newFilePath = null;
    let newBucket = null;

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
    // HANDLE HIERARCHY CHANGES (if provided)
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

    // Update material
    const { data: updatedMaterial, error: updateError } = await supabase
      .from('materials')
      .update({
        title,
        lesson_id: finalLessonId,
        position,
        is_published: isPublished,
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
