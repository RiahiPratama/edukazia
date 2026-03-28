// ================================================================
// MATERIALS API - HYBRID ARCHITECTURE
// Primary enforcement: API checks payment, level, override
// Guardrail: RLS checks role + published only
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkBulkMaterialAccess, filterMaterialsByAccess } from '@/lib/access-control';

// ----------------------------------------------------------------
// GET /api/materials
// Get materials with access control
// ----------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient(); // Await if async
    
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

    // ============================================================
    // 2. GET USER PROFILE & ROLE
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

    // ============================================================
    // 3. ADMIN/TUTOR: Return all materials (no access check)
    // ============================================================
    if (profile.role === 'admin' || profile.role === 'tutor') {
      const { data: materials, error } = await supabase
        .from('materials')
        .select(`
          id,
          title,
          type,
          level_id,
          unit_id,
          is_published,
          content_data,
          order_number,
          lesson_number,
          lesson_name,
          is_for_tutor
        `)
        .order('order_number', { ascending: true });

      if (error) {
        console.error('Materials fetch error:', error);
        return NextResponse.json(
          { error: 'Failed to fetch materials' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        materials: materials || [],
        role: profile.role,
      });
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
          { error: 'student_id required for parent access' },
          { status: 400 }
        );
      }

      const { data: student } = await supabase
        .from('students')
        .select('id')
        .eq('id', childStudentId)
        .eq('parent_profile_id', user.id)
        .single();

      if (!student) {
        return NextResponse.json(
          { error: 'Student not found or not authorized' },
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
    // 5. FETCH PUBLISHED MATERIALS
    // ============================================================
    const { data: materials, error: materialsError } = await supabase
      .from('materials')
      .select(`
        id,
        title,
        type,
        level_id,
        unit_id,
        is_published,
        content_data,
        order_number,
        lesson_number,
        lesson_name
      `)
      .eq('is_published', true)
      .order('order_number', { ascending: true });

    if (materialsError) {
      console.error('Materials fetch error:', materialsError);
      return NextResponse.json(
        { error: 'Failed to fetch materials' },
        { status: 500 }
      );
    }

    if (!materials || materials.length === 0) {
      return NextResponse.json({
        materials: [],
        role: profile.role,
      });
    }

    // ============================================================
    // 6. BULK ACCESS CHECK (THE MAGIC!)
    // ============================================================
    const materialIds = materials.map(m => m.id);
    const accessMap = await checkBulkMaterialAccess(studentId, materialIds);

    // ============================================================
    // 7. FILTER & RETURN
    // ============================================================
    const materialsWithAccess = filterMaterialsByAccess(materials, accessMap);

    return NextResponse.json({
      materials: materialsWithAccess,
      role: profile.role,
      student_id: studentId,
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
