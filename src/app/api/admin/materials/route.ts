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
    const chapterId = formData.get('chapter_id') as string;
    const chapterName = formData.get('chapter_name') as string;
    const unitId = formData.get('unit_id') as string;
    const unitName = formData.get('unit_name') as string;
    const lessonId = formData.get('lesson_id') as string;
    const lessonName = formData.get('lesson_name') as string;
    const lessonPositionNew = parseInt(formData.get('lesson_position_new') as string) || 1;
    const unitPositionNew = parseInt(formData.get('unit_position_new') as string) || 1;
    const canvaUrl = formData.get('canva_url') as string || '';
    const studentContentUrl = formData.get('student_content_url') as string || '';
    const slidesUrl = formData.get('slides_url') as string || '';
    const pdfFile = formData.get('pdf_file') as File | null; // ✅ posisi lesson dari admin
    const position = parseInt(formData.get('order_number') as string) || 1;
    const isPublished = formData.get('is_published') === 'true';
    const contentDataStr = formData.get('content_data') as string;
    const file = formData.get('jsx_file') as File | null; // Fixed: jsx_file not 'file'

    console.log('📦 Creating material v4.1:', { title, category, levelId, chapterId });

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
    // STEP 1: CREATE HIERARCHY (chapter → unit → lesson)
    // ============================================================

    // 1. Create or get Chapter
    let actualChapterId: string | null = chapterId;
    
    if (chapterId === 'FIND_OR_CREATE') {
      // ✅ MULTI-LEVEL MODE: cari chapter by nama di level ini, create kalau belum ada
      if (chapterName && chapterName.trim()) {
        console.log('🔍 Find-or-create Chapter:', chapterName, 'in level:', levelId);

        const { data: existingChapter } = await supabase
          .from('chapters')
          .select('id')
          .eq('level_id', levelId)
          .ilike('chapter_title', chapterName.trim())
          .limit(1)
          .maybeSingle();

        if (existingChapter) {
          actualChapterId = existingChapter.id;
          console.log('✅ Found existing chapter:', actualChapterId);
        } else {
          // Create new chapter
          const { data: maxRows } = await supabase
            .from('chapters')
            .select('chapter_number, order_number')
            .eq('level_id', levelId)
            .order('chapter_number', { ascending: false })
            .limit(1);

          const nextChapterNumber = (maxRows?.[0]?.chapter_number || 0) + 1;
          const nextOrderNumber = (maxRows?.[0]?.order_number || 0) + 1;

          const { data: newChapter, error: chapterError } = await supabase
            .from('chapters')
            .insert({
              level_id: levelId,
              chapter_title: chapterName.trim(),
              chapter_number: nextChapterNumber,
              order_number: nextOrderNumber,
            })
            .select()
            .single();

          if (chapterError) {
            console.error('Chapter creation error:', chapterError);
            return NextResponse.json({ error: 'Failed to create chapter', details: chapterError.message }, { status: 500 });
          }

          actualChapterId = newChapter.id;
          console.log('✅ Chapter created (find-or-create):', actualChapterId);
        }
      }
    } else if (chapterId === 'NEW') {
      if (chapterName && chapterName.trim()) {
        // Create NEW chapter with provided name
        console.log('🆕 Creating new Chapter:', chapterName);

        // Get max chapter_number and order_number for this level
        const { data: existingChapters } = await supabase
          .from('chapters')
          .select('chapter_number, order_number')
          .eq('level_id', levelId)
          .order('chapter_number', { ascending: false })
          .limit(1);

        const nextChapterNumber = existingChapters && existingChapters.length > 0 
          ? (existingChapters[0].chapter_number || 0) + 1 
          : 1;

        const nextOrderNumber = existingChapters && existingChapters.length > 0 
          ? (existingChapters[0].order_number || 0) + 1 
          : 1;

        const { data: newChapter, error: chapterError } = await supabase
          .from('chapters')
          .insert({
            level_id: levelId,
            chapter_title: chapterName,
            chapter_number: nextChapterNumber,
            order_number: nextOrderNumber,
          })
          .select()
          .single();

        if (chapterError) {
          console.error('Chapter creation error:', chapterError);
          return NextResponse.json({
            error: 'Failed to create chapter',
            details: chapterError.message
          }, { status: 500 });
        }

        actualChapterId = newChapter.id;
        console.log('✅ Chapter created:', actualChapterId, 'number:', nextChapterNumber);
      } else {
        // NO chapter name provided → use existing chapter for this level
        console.log('⚠️ No chapter name provided, using existing chapter for level:', levelId);
        
        const { data: existingChapter } = await supabase
          .from('chapters')
          .select('id')
          .eq('level_id', levelId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (existingChapter) {
          actualChapterId = existingChapter.id;
          console.log('✅ Using existing chapter:', actualChapterId);
        } else {
          // No existing chapter → create default chapter
          console.log('🆕 No existing chapter, creating default chapter');
          
          const { data: defaultChapter, error: defaultChapterError } = await supabase
            .from('chapters')
            .insert({
              level_id: levelId,
              chapter_title: 'Default Chapter',
              chapter_number: 1,
              order_number: 1,
            })
            .select()
            .single();

          if (defaultChapterError) {
            console.error('Default chapter creation error:', defaultChapterError);
            actualChapterId = null;
          } else {
            actualChapterId = defaultChapter.id;
            console.log('✅ Default chapter created:', actualChapterId);
          }
        }
      }
    }
    
    // Final validation: ensure actualChapterId is valid UUID or null
    if (actualChapterId === 'NEW' || !actualChapterId) {
      actualChapterId = null;
    }

    // 2. Create or get Unit
    let actualUnitId: string | null = unitId;

    if (unitId === 'FIND_OR_CREATE' && unitName) {
      // ✅ MULTI-LEVEL MODE: cari unit by nama di chapter ini, create kalau belum ada
      console.log('🔍 Find-or-create Unit:', unitName, 'in chapter:', actualChapterId);

      const { data: existingUnit } = await supabase
        .from('units')
        .select('id')
        .eq('chapter_id', actualChapterId)
        .ilike('unit_name', unitName.trim())
        .limit(1)
        .maybeSingle();

      if (existingUnit) {
        actualUnitId = existingUnit.id;
        console.log('✅ Found existing unit:', actualUnitId);
      } else {
        const { data: newUnit, error: unitError } = await supabase
          .from('units')
          .insert({
            level_id: levelId,
            chapter_id: actualChapterId || null,
            unit_name: unitName.trim(),
            unit_number: 0,
            position: unitPositionNew,
          })
          .select()
          .single();

        if (unitError) {
          console.error('Unit creation error:', unitError);
          return NextResponse.json({ error: 'Failed to create unit', details: unitError.message }, { status: 500 });
        }

        actualUnitId = newUnit.id;
        console.log('✅ Unit created (find-or-create):', actualUnitId);
      }
    } else if (unitId === 'NEW' && unitName) {
      console.log('🆕 Creating new Unit:', unitName);

      const { data: newUnit, error: unitError } = await supabase
        .from('units')
        .insert({
          level_id: levelId,
          chapter_id: actualChapterId || null,
          unit_name: unitName,
          unit_number: 0,
          position: unitPositionNew, // ✅ dari input admin
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

    // 3. Create or get Lesson
    let actualLessonId: string | null = lessonId;
    let newlyCreatedLessonId: string | null = null; // ✅ track untuk rollback kalau gagal

    if (lessonId === 'FIND_OR_CREATE' && lessonName) {
      // ✅ MULTI-LEVEL MODE: cari lesson by nama di unit ini, create kalau belum ada
      console.log('🔍 Find-or-create Lesson:', lessonName, 'in unit:', actualUnitId);

      const { data: existingLesson } = await supabase
        .from('lessons')
        .select('id')
        .eq('unit_id', actualUnitId)
        .ilike('lesson_name', lessonName.trim())
        .limit(1)
        .maybeSingle();

      if (existingLesson) {
        actualLessonId = existingLesson.id;
        console.log('✅ Found existing lesson:', actualLessonId);
      } else {
        const { data: newLesson, error: lessonError } = await supabase
          .from('lessons')
          .insert({
            unit_id: actualUnitId,
            lesson_name: lessonName.trim(),
            position: lessonPositionNew,
          })
          .select()
          .single();

        if (lessonError) {
          console.error('Lesson creation error:', lessonError);
          return NextResponse.json({ error: 'Failed to create lesson', details: lessonError.message }, { status: 500 });
        }

        actualLessonId = newLesson.id;
        newlyCreatedLessonId = newLesson.id;
        console.log('✅ Lesson created (find-or-create):', actualLessonId);
      }
    } else if (lessonId === 'NEW' && lessonName) {
      console.log('🆕 Creating new Lesson:', lessonName);

      const { data: newLesson, error: lessonError } = await supabase
        .from('lessons')
        .insert({
          unit_id: actualUnitId,
          lesson_name: lessonName,
          position: lessonPositionNew, // ✅ dari input admin, bukan hardcode 0
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
      newlyCreatedLessonId = newLesson.id; // ✅ simpan untuk rollback
      console.log('✅ Lesson created:', actualLessonId);
    }

    if (!actualLessonId) {
      return NextResponse.json({
        error: 'Lesson ID required'
      }, { status: 400 });
    }

    // ✅ FETCH LESSON NAME TO USE AS MATERIAL TITLE
    const { data: lessonData } = await supabase
      .from('lessons')
      .select('lesson_name')
      .eq('id', actualLessonId)
      .single();
    
    const materialTitle = lessonData?.lesson_name || title || 'Untitled Material';
    console.log('📝 Material title from lesson:', materialTitle);

    // ============================================================
    // STEP 2: HANDLE FILE UPLOAD
    // ============================================================

    let uploadedFilePath: string | null = null;
    let storageBucket: string | null = null;

    if (file && (category === 'bacaan' || category === 'cefr')) {
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(7);
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      
      if (category === 'bacaan') {
        storageBucket = 'components';
        uploadedFilePath = `bacaan/${timestamp}-${random}.jsx`;
      } else if (category === 'cefr') {
        storageBucket = 'audio';
        uploadedFilePath = `cefr/${timestamp}-${random}.${ext}`;
      }

      if (storageBucket && uploadedFilePath) {
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
    }

    // ============================================================
    // STEP 3: CREATE MATERIAL RECORD
    // ============================================================

    const { data: newMaterial, error: materialError } = await supabase
      .from('materials')
      .insert({
        title: materialTitle,  // ✅ Use lesson name as title
        category,
        lesson_id: actualLessonId,
        position,
        is_published: isPublished,
      })
      .select()
      .single();

    if (materialError) {
      console.error('Material creation error:', materialError);
      // ✅ Rollback lesson kalau material gagal
      if (newlyCreatedLessonId) {
        await supabase.from('lessons').delete().eq('id', newlyCreatedLessonId);
        console.log('🔄 Lesson rolled back:', newlyCreatedLessonId);
      }
      return NextResponse.json({
        error: 'Failed to create material',
        details: materialError.message
      }, { status: 500 });
    }

    console.log('✅ Material created:', newMaterial.id);

    // ============================================================
    // STEP 4: CREATE MATERIAL_CONTENTS RECORD
    // ============================================================

    let contentType: 'url' | 'component' | 'audio' = 'url';
    let contentUrl: string | null = null;
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
      storagePath = uploadedFilePath; // ✅ cefr pakai storage_path
    }

    // ✅ Defensive check: content_url wajib ada untuk url-based category
    if (contentType === 'url' && !contentUrl) {
      console.error('❌ content_url null:', { category, contentData });
      await supabase.from('materials').delete().eq('id', newMaterial.id);
      return NextResponse.json({
        error: 'Failed to create material content',
        details: `URL tidak boleh kosong untuk kategori ${category}. Pastikan URL sudah diisi.`
      }, { status: 400 });
    }

    // ✅ Upload PDF jika ada
    let pdfStoragePath: string | null = null;
    if (pdfFile && pdfFile.size > 0) {
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(7);
      const pdfFileName = `${timestamp}-${random}.pdf`;
      const { error: pdfError } = await supabase.storage
        .from('materials-pdf')
        .upload(pdfFileName, pdfFile, { contentType: 'application/pdf', upsert: false });
      if (!pdfError) {
        pdfStoragePath = pdfFileName;
        console.log('✅ PDF uploaded:', pdfFileName);
      } else {
        console.error('PDF upload error:', pdfError);
      }
    }

    const { data: materialContent, error: contentError } = await supabase
      .from('material_contents')
      .insert({
        material_id: newMaterial.id,
        content_type: contentType,
        content_url: contentUrl,
        storage_bucket: storageBucket,
        storage_path: storagePath,
        canva_url: canvaUrl || null,
        student_content_url: studentContentUrl || null,
        slides_url: slidesUrl || null,
      })
      .select()
      .single();

    if (contentError) {
      console.error('Material content creation error:', contentError);
      // ✅ Rollback material + lesson kalau material_contents gagal
      await supabase.from('materials').delete().eq('id', newMaterial.id);
      if (newlyCreatedLessonId) {
        await supabase.from('lessons').delete().eq('id', newlyCreatedLessonId);
        console.log('🔄 Lesson rolled back:', newlyCreatedLessonId);
      }
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
// GET - FETCH MATERIALS
// ============================================================
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

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

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    let query = supabase
      .from('materials')
      .select('*, material_contents(content_url)')
      .order('created_at', { ascending: false });

    if (category) {
      query = query.eq('category', category);
    }

    const { data: materials, error } = await query;

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch materials' }, { status: 500 });
    }

    return NextResponse.json({ materials: materials || [] });

  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================================
// PATCH - UPDATE EXISTING MATERIAL (CHAPTER-AWARE)
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
    const position = parseInt(formData.get('order_number') as string);
    const isPublished = formData.get('is_published') === 'true';
    const contentDataStr = formData.get('content_data') as string;

    // CHAPTER SETTINGS
    const chapterId = formData.get('chapter_id') as string;
    const chapterTitle = formData.get('chapter_title') as string;

    // UNIT SETTINGS
    const unitId = formData.get('unit_id') as string;
    const unitName = formData.get('unit_name') as string;
    const unitPosition = formData.get('unit_position') as string;

    // LESSON SETTINGS
    const lessonId = formData.get('lesson_id') as string;
    const lessonName = formData.get('lesson_name') as string;
    const lessonPosition = formData.get('lesson_position') as string;

    console.log('📝 Updating material:', { materialId, chapterId, unitId, lessonId });

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

    // ============================================================
    // UPDATE CHAPTER (if chapter_id exists)
    // ============================================================
    if (chapterId && chapterTitle) {
      console.log('📚 Updating chapter:', chapterId, '→', chapterTitle);
      
      const { error: chapterError } = await supabase
        .from('chapters')
        .update({ chapter_title: chapterTitle })
        .eq('id', chapterId);

      if (chapterError) {
        console.error('Chapter update error:', chapterError);
        return NextResponse.json({
          error: 'Failed to update chapter',
          details: chapterError.message
        }, { status: 500 });
      }

      console.log('✅ Chapter updated');
    }

    // ============================================================
    // UPDATE UNIT
    // ============================================================
    if (unitId && unitName) {
      console.log('📦 Updating unit:', unitId, '→', { unitName, position: unitPosition });

      const unitUpdateData: any = {
        unit_name: unitName,
      };

      if (unitPosition !== undefined && unitPosition !== null) {
        unitUpdateData.position = parseInt(unitPosition);
      }

      const { error: unitError } = await supabase
        .from('units')
        .update(unitUpdateData)
        .eq('id', unitId);

      if (unitError) {
        console.error('Unit update error:', unitError);
        return NextResponse.json({
          error: 'Failed to update unit',
          details: unitError.message
        }, { status: 500 });
      }

      console.log('✅ Unit updated');
    }

    // ============================================================
    // UPDATE LESSON
    // ============================================================
    if (lessonId && lessonName) {
      console.log('📄 Updating lesson:', lessonId, '→', { lessonName, position: lessonPosition });

      const lessonUpdateData: any = {
        lesson_name: lessonName,
      };

      if (lessonPosition !== undefined && lessonPosition !== null) {
        lessonUpdateData.position = parseInt(lessonPosition);
      }

      const { error: lessonError } = await supabase
        .from('lessons')
        .update(lessonUpdateData)
        .eq('id', lessonId);

      if (lessonError) {
        console.error('Lesson update error:', lessonError);
        return NextResponse.json({
          error: 'Failed to update lesson',
          details: lessonError.message
        }, { status: 500 });
      }

      console.log('✅ Lesson updated');
    }

    // ✅ FETCH LESSON NAME TO USE AS MATERIAL TITLE
    const { data: lessonData } = await supabase
      .from('lessons')
      .select('lesson_name')
      .eq('id', lessonId || existingMaterial.lesson_id)
      .single();
    
    const materialTitle = lessonData?.lesson_name || existingMaterial.title || 'Untitled Material';
    console.log('📝 Material title from lesson:', materialTitle);

    // ============================================================
    // UPDATE MATERIAL
    // ============================================================
    const materialUpdateData: any = {
      title: materialTitle,  // ✅ Use lesson name as title
      position,
      is_published: isPublished,
      updated_at: new Date().toISOString(),
    };

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

    // Update material_contents — hanya update content_url
    if (contentDataStr) {
      const existingContent = existingMaterial.material_contents?.[0]
      const newContentUrl = contentData.url || contentData.zoom_link || contentData.canva_link || null

      if (existingContent && newContentUrl) {
        await supabase
          .from('material_contents')
          .update({ content_url: newContentUrl })
          .eq('id', existingContent.id)
      }
    }

    // ✅ HANDLE JSX FILE REPLACEMENT (Bacaan category)
    const jsxFile = formData.get('jsx_file') as File | null
    if (jsxFile && jsxFile.size > 0 && category === 'bacaan') {

      // Flat query terpisah — nested join tidak reliable
      const { data: existingContents } = await supabase
        .from('material_contents')
        .select('id, storage_path, storage_bucket')
        .eq('material_id', materialId)
        .limit(1)

      const existingContent = existingContents?.[0]

      // Hapus file lama dari Storage dulu
      if (existingContent?.storage_path && existingContent?.storage_bucket) {
        const { error: removeError } = await supabase.storage
          .from(existingContent.storage_bucket)
          .remove([existingContent.storage_path])
        if (removeError) {
          console.warn('⚠️ Gagal hapus file lama:', existingContent.storage_path, removeError.message)
        } else {
          console.log('🗑️ File lama dihapus:', existingContent.storage_path)
        }
      }

      // Upload file baru
      const timestamp = Date.now()
      const random = Math.random().toString(36).substring(2, 8)
      const newPath = `bacaan/${timestamp}-${random}.jsx`

      const { error: uploadError } = await supabase.storage
        .from('components')
        .upload(newPath, jsxFile)

      if (uploadError) {
        console.error('Upload error:', uploadError)
        return NextResponse.json({ error: 'Failed to upload new JSX file', details: uploadError.message }, { status: 500 })
      }

      console.log('✅ File baru diupload:', newPath)

      // Update storage_path di material_contents
      if (existingContent) {
        await supabase
          .from('material_contents')
          .update({ storage_path: newPath, storage_bucket: 'components' })
          .eq('id', existingContent.id)
        console.log('✅ storage_path diupdate:', newPath)
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
