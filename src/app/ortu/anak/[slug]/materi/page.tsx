import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import MateriContent from './MateriContent';

export default async function OrtuMateriPage({ params }: { params: { slug: string } }) {
  const supabase = await createClient();

  // Get student by slug
  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('id, slug, full_name, profile_id')
    .eq('slug', params.slug)
    .single();

  if (studentError || !student) {
    notFound();
  }

  // CORRECT: Get ACTIVE enrollments (status = 'active')
  // NOT using end_date because it's NULL!
  const { data: enrollments, error: enrollError } = await supabase
    .from('enrollments')
    .select('id, class_group_id, level_id, status, enrolled_at')
    .eq('student_id', student.id)
    .eq('status', 'active'); // Check status instead of end_date!

  console.log('📊 Active enrollments found:', enrollments?.length || 0, enrollments);

  if (enrollError) {
    console.error('❌ Enrollment error:', enrollError);
  }

  // If no active enrollments, show lock screen
  if (!enrollments || enrollments.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-gray-800 text-white rounded-2xl p-12 max-w-md text-center">
          <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-4">Materi Terkunci</h2>
          <p className="text-gray-300 mb-6">
            Siswa belum terdaftar di kelas manapun atau kelas sudah berakhir.
          </p>
          <p className="text-sm text-gray-400">
            Hubungi admin untuk mendaftar kelas atau perpanjang kelas yang sudah ada.
          </p>
        </div>
      </div>
    );
  }

  // Get class_group_id (not class_id!)
  const classGroupIds = enrollments.map(e => e.class_group_id);
  console.log('🎓 Class Group IDs:', classGroupIds);

  // Get class_groups
  const { data: classGroups, error: classError } = await supabase
    .from('class_groups')
    .select('id, name, level_id')
    .in('id', classGroupIds);

  console.log('📚 Class groups found:', classGroups?.length || 0, classGroups);

  if (classError || !classGroups || classGroups.length === 0) {
    console.error('❌ Class groups error:', classError);
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-gray-800 text-white rounded-2xl p-12 max-w-md text-center">
          <p className="text-gray-300">Error loading classes. Please contact admin.</p>
        </div>
      </div>
    );
  }

  // Get unique level IDs from enrollments (directly!)
  // Enrollments have level_id column!
  const levelIds = [...new Set(enrollments.map(e => e.level_id))];
  console.log('📊 Level IDs from enrollments:', levelIds);

  // Get levels
  const { data: levels, error: levelError } = await supabase
    .from('levels')
    .select('id, name, course_id')
    .in('id', levelIds);

  console.log('📖 Levels found:', levels?.length || 0, levels);

  if (levelError || !levels || levels.length === 0) {
    console.error('❌ Levels error:', levelError);
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-gray-800 text-white rounded-2xl p-12 max-w-md text-center">
          <p className="text-gray-300">Error loading levels. Please contact admin.</p>
        </div>
      </div>
    );
  }

  // Get courses
  const courseIds = [...new Set(levels.map(l => l.course_id))];
  const { data: courses } = await supabase
    .from('courses')
    .select('id, name')
    .in('id', courseIds);

  console.log('📘 Courses found:', courses?.length || 0);

  // Get ALL published materials
  const { data: allMaterials, error: materialError } = await supabase
    .from('materials')
    .select('id, title, category, order_number, is_published, lesson_id, content_data')
    .eq('is_published', true);

  console.log('📝 Total published materials:', allMaterials?.length || 0);

  if (materialError) {
    console.error('❌ Material error:', materialError);
  }

  if (!allMaterials || allMaterials.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-gray-800 text-white rounded-2xl p-12 max-w-md text-center">
          <h2 className="text-2xl font-bold mb-4">Belum Ada Materi</h2>
          <p className="text-gray-300">
            Belum ada materi yang dipublish untuk level ini.
          </p>
        </div>
      </div>
    );
  }

  // Get lessons for these materials
  const lessonIds = allMaterials.map(m => m.lesson_id);
  const { data: lessons } = await supabase
    .from('lessons')
    .select('id, lesson_name, unit_id')
    .in('id', lessonIds);

  // Get units
  const unitIds = [...new Set(lessons?.map(l => l.unit_id) || [])];
  const { data: units } = await supabase
    .from('units')
    .select('id, unit_name, judul_id')
    .in('id', unitIds);

  // Get juduls
  const judulIds = [...new Set(units?.map(u => u.judul_id) || [])];
  const { data: juduls } = await supabase
    .from('juduls')
    .select('id, name, level_id')
    .in('id', judulIds);

  // Filter materials by accessible levels
  const accessibleMaterials = allMaterials.filter(material => {
    const lesson = lessons?.find(l => l.id === material.lesson_id);
    if (!lesson) return false;

    const unit = units?.find(u => u.id === lesson.unit_id);
    if (!unit) return false;

    const judul = juduls?.find(j => j.id === unit.judul_id);
    if (!judul) return false;

    return levelIds.includes(judul.level_id);
  });

  console.log('✅ Accessible materials:', accessibleMaterials.length);

  if (accessibleMaterials.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-gray-800 text-white rounded-2xl p-12 max-w-md text-center">
          <h2 className="text-2xl font-bold mb-4">Belum Ada Materi</h2>
          <p className="text-gray-300">
            Belum ada materi yang tersedia untuk level kelas ini.
          </p>
        </div>
      </div>
    );
  }

  // Pass data to client component
  return (
    <MateriContent
      studentName={student.full_name}
      materials={accessibleMaterials}
      lessons={lessons || []}
      units={units || []}
      juduls={juduls || []}
      levels={levels || []}
      courses={courses || []}
    />
  );
}
