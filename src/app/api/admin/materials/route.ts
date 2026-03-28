import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ================================================================
// POST /api/admin/materials
// Create new material with file upload
// ================================================================
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // ============================================================
    // 1. AUTHENTICATION CHECK
    // ============================================================
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden - Admin only' },
        { status: 403 }
      );
    }

    // ============================================================
    // 2. PARSE FORM DATA
    // ============================================================
    const formData = await request.formData();
    
    const title = formData.get('title') as string;
    const type = formData.get('type') as string;
    const category = formData.get('category') as string;
    const levelId = formData.get('level_id') as string;
    const unitId = formData.get('unit_id') as string;
    const lessonId = formData.get('lesson_id') as string;
    const orderNumber = parseInt(formData.get('order_number') as string);
    const isPublished = formData.get('is_published') === 'true';
    const contentDataStr = formData.get('content_data') as string;
    const file = formData.get('file') as File | null;

    // Validate required fields
    if (!title || !type || !category || !lessonId || !contentDataStr) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const contentData = JSON.parse(contentDataStr);

    // ============================================================
    // 3. UPLOAD FILE TO SUPABASE STORAGE (if exists)
    // ============================================================
    let fileUrl = null;

    if (file) {
      const fileExtension = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExtension}`;
      
      let storageBucket = '';
      let storagePath = '';

      // Determine bucket based on category
      if (category === 'cefr') {
        storageBucket = 'audio';
        storagePath = `cefr/${fileName}`;
      } else if (category === 'bacaan') {
        storageBucket = 'components'; // Create this bucket for .jsx files
        storagePath = `bacaan/${fileName}`;
      }

      if (storageBucket) {
        const fileBuffer = await file.arrayBuffer();
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(storageBucket)
          .upload(storagePath, fileBuffer, {
            contentType: file.type,
            upsert: false,
          });

        if (uploadError) {
          console.error('File upload error:', uploadError);
          return NextResponse.json(
            { error: 'Failed to upload file', details: uploadError.message },
            { status: 500 }
          );
        }

        fileUrl = storagePath;

        // Update content_data with file URL
        if (category === 'cefr') {
          contentData.audio_url = fileUrl;
        } else if (category === 'bacaan') {
          contentData.jsx_file_path = fileUrl;
        }
      }
    }

    // ============================================================
    // 4. INSERT MATERIAL TO DATABASE
    // ============================================================
    const { data: material, error: insertError } = await supabase
      .from('materials')
      .insert({
        title,
        type,
        category,
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
      console.error('Insert material error:', insertError);
      
      // Clean up uploaded file if insert fails
      if (fileUrl) {
        await supabase.storage.from(storageBucket).remove([storagePath]);
      }

      return NextResponse.json(
        { error: 'Failed to create material', details: insertError.message },
        { status: 500 }
      );
    }

    // ============================================================
    // 5. SUCCESS RESPONSE
    // ============================================================
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

// ================================================================
// GET /api/admin/materials
// Get all materials (with optional category filter)
// ================================================================
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // ============================================================
    // 1. AUTHENTICATION CHECK
    // ============================================================
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden - Admin only' },
        { status: 403 }
      );
    }

    // ============================================================
    // 2. GET QUERY PARAMS
    // ============================================================
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    // ============================================================
    // 3. FETCH MATERIALS
    // ============================================================
    let query = supabase
      .from('materials')
      .select(`
        id,
        title,
        type,
        category,
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
      console.error('Fetch materials error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch materials' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      materials: materials || [],
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
