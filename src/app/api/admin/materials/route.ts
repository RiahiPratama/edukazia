import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Authentication check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      console.error('User is not admin:', profile);
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 });
    }

    // Parse form data
    const formData = await request.formData();
    
    const title = formData.get('title') as string;
    const type = formData.get('type') as string;
    const category = formData.get('category') as string;
    const courseId = formData.get('course_id') as string;
    const levelId = formData.get('level_id') as string;
    const orderNumber = parseInt(formData.get('order_number') as string);
    const isPublished = formData.get('is_published') === 'true';
    const contentDataStr = formData.get('content_data') as string;
    const file = formData.get('file') as File | null;
    
    // Inline creation fields
    let judulId = formData.get('judul_id') as string;
    const judulName = formData.get('judul_name') as string;
    let unitId = formData.get('unit_id') as string;
    const unitName = formData.get('unit_name') as string;
    let lessonId = formData.get('lesson_id') as string;
    const lessonName = formData.get('lesson_name') as string;

    console.log('📥 Received data:', {
      title,
      type,
      category,
      courseId,
      levelId,
      judulId,
      judulName,
      unitId,
      unitName,
      lessonId,
      lessonName,
      orderNumber,
      isPublished,
      hasFile: !!file,
    });

    // Validation
    if (!type || !category) {
      return NextResponse.json({ 
        error: 'Missing required fields', 
        details: 'type and category are required' 
      }, { status: 400 });
    }

    if (!lessonId && !lessonName) {
      return NextResponse.json({ 
        error: 'Missing lesson information', 
        details: 'Either lesson_id or lesson_name must be provided' 
      }, { status: 400 });
    }

    const contentData = JSON.parse(contentDataStr);

    // ============================================================
    // INLINE CREATION: Create judul/unit/lesson if needed
    // ============================================================
    
    // 1. Create Judul if new
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
        console.error('❌ Failed to create judul:', judulError);
        return NextResponse.json(
          { error: 'Failed to create judul', details: judulError.message },
          { status: 500 }
        );
      }
      
      judulId = newJudul.id;
      console.log('✅ Judul created:', judulId);
    }

    // 2. Create Unit if new
    if (unitId === 'NEW' && unitName && judulId) {
      console.log('🆕 Creating new Unit:', unitName);
      
      // Get max unit_number for this judul
      const { data: existingUnits } = await supabase
        .from('units')
        .select('unit_number')
        .eq('judul_id', judulId)
        .order('unit_number', { ascending: false })
        .limit(1);
      
      const nextUnitNumber = existingUnits && existingUnits.length > 0 
        ? existingUnits[0].unit_number + 1 
        : 1;
      
      const { data: newUnit, error: unitError } = await supabase
        .from('units')
        .insert({
          judul_id: judulId,
          level_id: levelId,
          unit_name: unitName,        // Use unit_name!
          unit_number: nextUnitNumber, // Required!
          chapter_id: null,            // Nullable now
          order_number: 0,
          is_active: true,
          description: '',
        })
        .select()
        .single();
      
      if (unitError) {
        console.error('❌ Failed to create unit:', unitError);
        return NextResponse.json(
          { error: 'Failed to create unit', details: unitError.message },
          { status: 500 }
        );
      }
      
      unitId = newUnit.id;
      console.log('✅ Unit created:', unitId);
    }

    // 3. Create Lesson if new (FIXED TO MATCH SCHEMA!)
    if (lessonId === 'NEW' && lessonName && unitId) {
      console.log('🆕 Creating new Lesson:', lessonName);
      
      // Get max lesson_number for this unit
      const { data: existingLessons } = await supabase
        .from('lessons')
        .select('lesson_number')
        .eq('unit_id', unitId)
        .order('lesson_number', { ascending: false })
        .limit(1);
      
      const nextLessonNumber = existingLessons && existingLessons.length > 0 
        ? existingLessons[0].lesson_number + 1 
        : 1;
      
      const { data: newLesson, error: lessonError } = await supabase
        .from('lessons')
        .insert({
          unit_id: unitId,
          lesson_name: lessonName,      // Use lesson_name, not name!
          lesson_number: nextLessonNumber, // Required!
        })
        .select()
        .single();
      
      if (lessonError) {
        console.error('❌ Failed to create lesson:', lessonError);
        return NextResponse.json(
          { error: 'Failed to create lesson', details: lessonError.message },
          { status: 500 }
        );
      }
      
      lessonId = newLesson.id;
      console.log('✅ Lesson created:', lessonId);
    }

    // Final validation
    if (!lessonId) {
      return NextResponse.json(
        { error: 'Lesson ID not found after creation', details: 'This should not happen' },
        { status: 500 }
      );
    }

    // ============================================================
    // FILE UPLOAD
    // ============================================================
    let fileUrl: string | null = null;
    let storageBucket = '';
    let storagePath = '';

    if (file) {
      console.log('📤 Uploading file:', file.name, file.size, 'bytes');
      
      const fileExtension = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExtension}`;

      if (category === 'cefr') {
        storageBucket = 'audio';
        storagePath = `cefr/${fileName}`;
      } else if (category === 'bacaan') {
        storageBucket = 'components';
        storagePath = `bacaan/${fileName}`;
      }

      if (storageBucket) {
        const fileBuffer = await file.arrayBuffer();
        const { error: uploadError } = await supabase.storage
          .from(storageBucket)
          .upload(storagePath, fileBuffer, {
            contentType: file.type,
            upsert: false,
          });

        if (uploadError) {
          console.error('❌ File upload error:', uploadError);
          return NextResponse.json(
            { error: 'Failed to upload file', details: uploadError.message },
            { status: 500 }
          );
        }

        fileUrl = storagePath;

        if (category === 'cefr') {
          contentData.audio_url = fileUrl;
        } else if (category === 'bacaan') {
          contentData.jsx_file_path = fileUrl;
        }
        
        console.log('✅ File uploaded:', storagePath);
      }
    }

    // ============================================================
    // INSERT MATERIAL
    // ============================================================
    console.log('💾 Inserting material...');
    
    const materialTitle = title || lessonName;
    
    const { data: material, error: insertError } = await supabase
      .from('materials')
      .insert({
        title: materialTitle,
        type,
        category,
        course_id: courseId || null,
        level_id: levelId || null,
        unit_id: unitId || null,
        lesson_id: lessonId,
        order_number: orderNumber,
        is_published: isPublished,
        content_data: contentData,
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ Insert material error:', insertError);
      
      // Cleanup uploaded file if material insert fails
      if (fileUrl && storageBucket && storagePath) {
        console.log('🗑️ Cleaning up uploaded file...');
        await supabase.storage.from(storageBucket).remove([storagePath]);
      }

      return NextResponse.json(
        { 
          error: 'Failed to create material', 
          details: insertError.message,
          code: insertError.code,
          hint: insertError.hint,
        },
        { status: 500 }
      );
    }

    console.log('✅ Material created successfully:', material.id);

    return NextResponse.json({
      success: true,
      material,
      message: 'Material created successfully',
    }, { status: 201 });

  } catch (error) {
    console.error('💥 API error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

// GET endpoint
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
      .select(`
        id,
        title,
        type,
        category,
        course_id,
        level_id,
        unit_id,
        lesson_id,
        order_number,
        is_published,
        content_data,
        created_at
      `)
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
