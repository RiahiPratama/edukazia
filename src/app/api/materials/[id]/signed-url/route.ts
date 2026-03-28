// ================================================================
// SIGNED URL GENERATOR
// Lazy generation: Only create URL when user clicks play
// Security: Verify access before generating URL
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkBulkMaterialAccess } from '@/lib/access-control';

// ----------------------------------------------------------------
// GET /api/materials/[id]/signed-url
// Generate signed URL for audio file
// ----------------------------------------------------------------
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const materialId = params.id;

    // ============================================================
    // 1. AUTHENTICATION
    // ============================================================
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // ============================================================
    // 2. GET MATERIAL
    // ============================================================
    const { data: material, error: materialError } = await supabase
      .from('materials')
      .select('id, type, content_data, is_published')
      .eq('id', materialId)
      .single();

    if (materialError || !material) {
      return NextResponse.json(
        { error: 'Material not found' },
        { status: 404 }
      );
    }

    if (!material.is_published) {
      return NextResponse.json(
        { error: 'Material not published' },
        { status: 403 }
      );
    }

    // ============================================================
    // 3. GET USER ROLE & STUDENT ID
    // ============================================================
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    // Admin/Tutor: Direct access
    if (profile.role === 'admin' || profile.role === 'tutor') {
      return await generateSignedUrl(supabase, material);
    }

    // ============================================================
    // 4. STUDENT/PARENT: Get student_id
    // ============================================================
    let studentId: string;

    if (profile.role === 'student') {
      const { data: student } = await supabase
        .from('students')
        .select('id')
        .eq('profile_id', user.id)
        .single();

      if (!student) {
        return NextResponse.json(
          { error: 'Student record not found' },
          { status: 404 }
        );
      }

      studentId = student.id;
    } else if (profile.role === 'parent') {
      const { searchParams } = new URL(request.url);
      const childStudentId = searchParams.get('student_id');

      if (!childStudentId) {
        return NextResponse.json(
          { error: 'student_id required' },
          { status: 400 }
        );
      }

      // Verify ownership
      const { data: student } = await supabase
        .from('students')
        .select('id')
        .eq('id', childStudentId)
        .eq('parent_profile_id', user.id)
        .single();

      if (!student) {
        return NextResponse.json(
          { error: 'Not authorized' },
          { status: 403 }
        );
      }

      studentId = student.id;
    } else {
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 403 }
      );
    }

    // ============================================================
    // 5. ACCESS CHECK
    // ============================================================
    const accessMap = await checkBulkMaterialAccess(studentId, [materialId]);
    const access = accessMap.get(materialId);

    if (!access || !access.can_access) {
      // Log denied access (optional: save to material_access_logs)
      return NextResponse.json(
        { 
          error: 'Access denied',
          reason: access?.reason || 'no_access'
        },
        { status: 403 }
      );
    }

    // ============================================================
    // 6. GENERATE SIGNED URL
    // ============================================================
    const result = await generateSignedUrl(supabase, material);

    // Optional: Log access (intelligent sampling)
    // await logAccess(supabase, user.id, materialId, studentId, 200, 'signed_url_generated');

    return result;

  } catch (error) {
    console.error('Signed URL generation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ----------------------------------------------------------------
// Helper: Generate signed URL from Supabase Storage
// ----------------------------------------------------------------
async function generateSignedUrl(supabase: any, material: any) {
  // Extract audio path from content_data
  const audioPath = material.content_data?.audio_url;

  if (!audioPath) {
    return NextResponse.json(
      { error: 'No audio file available' },
      { status: 404 }
    );
  }

  // Generate signed URL (expires in 1 hour)
  const { data, error } = await supabase.storage
    .from('audio')
    .createSignedUrl(audioPath, 3600); // 1 hour expiry

  if (error) {
    console.error('Storage signed URL error:', error);
    return NextResponse.json(
      { error: 'Failed to generate URL' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    signed_url: data.signedUrl,
    expires_in: 3600,
    material_id: material.id,
  });
}
