import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'

export default async function MateriPage({ 
  params 
}: { 
  params: Promise<{ slug: string }> 
}) {
  // Next.js 15: params is now a Promise
  const { slug } = await params
  const supabase = await createClient()

  try {
    // DEBUG: Show slug
    if (!slug) {
      return <div className="p-8">ERROR: No slug provided! Params: {JSON.stringify(await params)}</div>
    }

    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return <div className="p-8">ERROR: Not authenticated</div>
    }

    // 1. Get student by slug (don't use .single() yet)
    const { data: students, error: studentError } = await supabase
      .from('students')
      .select('id, profile_id, slug')
      .eq('slug', slug)

    if (studentError) {
      return (
        <div className="p-8">
          <h1 className="text-xl font-bold">STUDENT QUERY ERROR</h1>
          <p>Slug: {slug}</p>
          <p>Error: {studentError.message}</p>
        </div>
      )
    }

    if (!students || students.length === 0) {
      return (
        <div className="p-8">
          <h1 className="text-xl font-bold">NO STUDENT FOUND</h1>
          <p>Slug searched: {slug}</p>
          <p>Results: 0</p>
        </div>
      )
    }

    if (students.length > 1) {
      return (
        <div className="p-8">
          <h1 className="text-xl font-bold">MULTIPLE STUDENTS FOUND!</h1>
          <p>Slug: {slug}</p>
          <p>Count: {students.length}</p>
          <pre className="mt-4 bg-gray-100 p-4 rounded">
            {JSON.stringify(students, null, 2)}
          </pre>
          <p className="mt-4 text-red-600">
            DATABASE ERROR: Duplicate slugs exist! Fix in database.
          </p>
        </div>
      )
    }

    const student = students[0]

    // 2. Get student's profile name
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', student.profile_id)
      .single()

    if (profileError) {
      return <div className="p-8">ERROR: Profile not found - {profileError.message}</div>
    }

    // 3. Get student's enrollment with level
    const { data: enrollment, error: enrollmentError } = await supabase
      .from('enrollments')
      .select('id, level_id, class_group_id, status')
      .eq('student_id', student.id)
      .eq('status', 'active')

    if (enrollmentError) {
      return <div className="p-8">ERROR: Enrollment query failed - {enrollmentError.message}</div>
    }

    if (!enrollment || enrollment.length === 0) {
      return (
        <div className="p-8">
          <h1 className="text-xl font-bold">NO ACTIVE ENROLLMENT</h1>
          <p>Student: {profile?.full_name}</p>
          <p>Student ID: {student.id}</p>
          <p>No active enrollment found for this student.</p>
        </div>
      )
    }

    const activeEnrollment = enrollment[0]

    if (!activeEnrollment.level_id) {
      return (
        <div className="p-8">
          <h1 className="text-xl font-bold">NO LEVEL ASSIGNED</h1>
          <p>Student: {profile?.full_name}</p>
          <p>Enrollment exists but no level_id set.</p>
        </div>
      )
    }

    // 4. Get level details
    const { data: level } = await supabase
      .from('levels')
      .select('id, name, course_id')
      .eq('id', activeEnrollment.level_id)
      .single()

    if (!level) {
      return <div className="p-8">ERROR: Level not found</div>
    }

    // 5. Get course details
    const { data: course } = await supabase
      .from('courses')
      .select('id, name')
      .eq('id', level.course_id)
      .single()

    // 6. Get all units for this level
    const { data: units } = await supabase
      .from('units')
      .select('id, name, position')
      .eq('level_id', level.id)
      .order('position')

    // SUCCESS - Show what we got
    return (
      <div className="min-h-screen bg-[#F7F6FF] p-8">
        <div className="max-w-2xl mx-auto bg-white rounded-xl p-8">
          <h1 className="text-2xl font-bold mb-4 text-green-600">✅ ALL DATA LOADED!</h1>
          
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded">
              <p className="font-bold">Slug (URL param):</p>
              <p className="font-mono">{slug}</p>
            </div>

            <div className="p-4 bg-green-50 rounded">
              <p className="font-bold">Student:</p>
              <p>{profile?.full_name}</p>
              <p className="text-sm text-gray-600">ID: {student.id}</p>
            </div>

            <div className="p-4 bg-purple-50 rounded">
              <p className="font-bold">Course:</p>
              <p>{course?.name || 'No course'}</p>
            </div>

            <div className="p-4 bg-indigo-50 rounded">
              <p className="font-bold">Level:</p>
              <p>{level.name}</p>
            </div>

            <div className="p-4 bg-yellow-50 rounded">
              <p className="font-bold">Units:</p>
              <p>{units?.length || 0} units found</p>
              {units && units.length > 0 && (
                <ul className="list-disc ml-6 mt-2">
                  {units.map(u => (
                    <li key={u.id}>{u.name}</li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-8 p-4 bg-green-100 rounded border-2 border-green-600">
              <p className="font-bold text-green-800 text-lg">
                🎉 SUCCESS! All queries work!
              </p>
              <p className="text-green-700 mt-2">
                Next step: Replace this debug page with the actual MateriContent component.
              </p>
            </div>
          </div>
        </div>
      </div>
    )

  } catch (error: any) {
    return (
      <div className="p-8">
        <h1 className="text-xl font-bold text-red-600">UNEXPECTED ERROR</h1>
        <p className="text-red-600">{error.message}</p>
        <pre className="mt-4 bg-gray-100 p-4 rounded overflow-auto">
          {error.stack}
        </pre>
      </div>
    )
  }
}
