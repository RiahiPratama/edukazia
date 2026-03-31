import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookies) => {
            try {
              cookies.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {}
          },
        },
      }
    );

    // Check auth
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { student_id, course_ids } = body;

    if (!student_id || !Array.isArray(course_ids)) {
      return NextResponse.json(
        { error: 'student_id and course_ids are required' },
        { status: 400 }
      );
    }

    // Fetch all archive class groups
    const { data: archiveGroups, error: archiveError } = await supabase
      .from('class_groups')
      .select('id, course_id')
      .eq('status', 'inactive')
      .like('label', 'Materi Arsip%');

    if (archiveError) {
      throw archiveError;
    }

    if (!archiveGroups || archiveGroups.length === 0) {
      return NextResponse.json(
        { error: 'No archive class groups found. Please run the SQL script first.' },
        { status: 404 }
      );
    }

    // Build map: course_id -> archive_class_group_id
    const courseToArchiveGroup = new Map(
      archiveGroups.map(ag => [ag.course_id, ag.id])
    );

    // Fetch student's existing enrollments to archive groups
    const archiveGroupIds = archiveGroups.map(ag => ag.id);
    const { data: existingEnrollments, error: enrollmentsError } = await supabase
      .from('enrollments')
      .select('id, class_group_id')
      .eq('student_id', student_id)
      .in('class_group_id', archiveGroupIds);

    if (enrollmentsError) {
      throw enrollmentsError;
    }

    const existingEnrollmentMap = new Map(
      (existingEnrollments || []).map(e => [e.class_group_id, e.id])
    );

    let enrollmentsCreated = 0;
    let enrollmentsDeleted = 0;

    // Process selected courses (create enrollments)
    for (const courseId of course_ids) {
      const archiveGroupId = courseToArchiveGroup.get(courseId);
      
      if (!archiveGroupId) {
        console.warn(`No archive class group found for course ${courseId}`);
        continue;
      }

      // Check if enrollment already exists
      if (existingEnrollmentMap.has(archiveGroupId)) {
        console.log(`Enrollment already exists for course ${courseId}`);
        continue;
      }

      // Create new enrollment
      const { error: insertError } = await supabase
        .from('enrollments')
        .insert({
          student_id,
          class_group_id: archiveGroupId,
          level_id: null, // Will be set via EnrollmentLevelManager
          status: 'active', // Active so materials are accessible
          sessions_total: 0, // Archive enrollments have no sessions
          session_start_offset: 0,
        });

      if (insertError) {
        console.error(`Failed to create enrollment for course ${courseId}:`, insertError);
        throw insertError;
      }

      enrollmentsCreated++;
    }

    // Process unselected courses (delete enrollments)
    const selectedArchiveGroupIds = new Set(
      course_ids
        .map(cid => courseToArchiveGroup.get(cid))
        .filter(Boolean) as string[]
    );

    for (const [archiveGroupId, enrollmentId] of existingEnrollmentMap.entries()) {
      if (!selectedArchiveGroupIds.has(archiveGroupId)) {
        // Delete enrollment
        const { error: deleteError } = await supabase
          .from('enrollments')
          .delete()
          .eq('id', enrollmentId);

        if (deleteError) {
          console.error(`Failed to delete enrollment ${enrollmentId}:`, deleteError);
          throw deleteError;
        }

        enrollmentsDeleted++;
      }
    }

    return NextResponse.json({
      success: true,
      enrollments_created: enrollmentsCreated,
      enrollments_deleted: enrollmentsDeleted,
    });
  } catch (error) {
    console.error('Error in archive enrollments API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
