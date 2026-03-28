import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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
    const type = formData.get('type') as string;
    const category = formData.get('category') as string;
    const courseId = formData.get('course_id') as string;
    const levelId = formData.get('level_id') as string;
    const unitId = formData.get('unit_id') as string;
    const lessonId = formData.get('lesson_id') as string;
    const orderNumber = parseInt(formData.get('order_number') as string);
    const isPublished = formData.get('is_published') === 'true';
    const contentDataStr = formData.get('content_data') as string;
    const file = formData.get('file') as File | null;
    
    // NEW: Handle inline creation
    let judulId = formData.get('judul_id') as string;
    const judulName = formData.get('judul_name') as string;
    const unitName = formData.get('unit_name') as string;
    const lessonName = formData.get('lesson_name') as string;

    if (!title || !type || !category || !lessonId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const contentData = JSON.parse(contentDataStr);

    // ============================================================
    // INLINE CREATION: Create judul/unit/lesson if needed
    // ============================================================
    
    // 1. Create Judul if new
    if (judulId === 'NEW' && judulName && levelId) {
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
      
      if (judulError || !newJudul) {
        return NextResponse.json(
          { error: 'Failed to create judul', details: judulError?.message },
          { status: 500 }
        );
      }
      
      judulId = newJudul.id;
    }

    // 2. Create Unit if new
    let finalUnitId = unitId;
    if (unitId === 'NEW' && unitName && judulId) {
      const { data: newUnit, error: unitError } = await supabase
        .from('units')
        .insert({
          judul_id: judulId,
          level_id: levelId,
          name: unitName,
          is_active: true,
          sort_order: 0,
        })
        .select()
        .single();
      
      if (unitError || !newUnit) {
        return NextResponse.json(
          { error: 'Failed to create unit', details: unitError?.message },
          { status: 500 }
        );
      }
      
      finalUnitId = newUnit.id;
    }

    // 3. Create Lesson if new
    let finalLessonId = lessonId;
    if (lessonId === 'NEW' && lessonName && finalUnitId) {
      const { data: newLesson, error: lessonError } = await supabase
        .from('lessons')
        .insert({
          unit_id: finalUnitId,
          name: lessonName,
          is_active: true,
          sort_order: 0,
        })
        .select()
        .single();
      
      if (lessonError || !newLesson) {
        return NextResponse.json(
          { error: 'Failed to create lesson', details: lessonError?.message },
          { status: 500 }
        );
      }
      
      finalLessonId = newLesson.id;
    }

    // ============================================================
    // FILE UPLOAD (same as before)
    // ============================================================
    let fileUrl: string | null = null;
    let storageBucket = '';
    let storagePath = '';

    if (file) {
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
      }
    }

    // ============================================================
    // INSERT MATERIAL
    // ============================================================
    const { data: material, error: insertError } = await supabase
      .from('materials')
      .insert({
        title,
        type,
        category,
        course_id: courseId || null,
        level_id: levelId || null,
        unit_id: finalUnitId || null,
        lesson_id: finalLessonId,
        order_number: orderNumber,
        is_published: isPublished,
        content_data: contentData,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert material error:', insertError);
      
      if (fileUrl && storageBucket && storagePath) {
        await supabase.storage.from(storageBucket).remove([storagePath]);
      }

      return NextResponse.json(
        { error: 'Failed to create material', details: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      material,
      message: 'Material created successfully',
    }, { status: 201 });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET endpoint remains the same
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
