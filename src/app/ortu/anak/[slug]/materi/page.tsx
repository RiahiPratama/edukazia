import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'

export default async function MateriPage({ params }: { params: { slug: string } }) {
  const { slug } = params
  const supabase = await createClient()

  try {
    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return <div className="p-8">ERROR: Not authenticated</div>
    }

    // 1. Get student by slug
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, profile_id')
      .eq('slug', slug)
      .single()

    if (studentError || !student) {
      return (
        <div className="p-8">
          <h1 className="text-xl font-bold">DEBUG INFO</h1>
          <p>Slug: {slug}</p>
          <p>Student Error: {studentError?.message || 'Student not found'}</p>
          <p>Student Data: {JSON.stringify(student)}</p>
        </div>
      )
    }

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
      .select('id, level_id, class_group_id')
      .eq('student_id', student.id)
      .eq('status', 'active')
      .single()

    if (enrollmentError || !enrollment || !enrollment.level_id) {
      return (
        <div className="p-8">
          <h1 className="text-xl font-bold">DEBUG INFO</h1>
          <p>Student ID: {student.id}</p>
          <p>Enrollment Error: {enrollmentError?.message || 'No active enrollment'}</p>
          <p>Enrollment Data: {JSON.stringify(enrollment)}</p>
        </div>
      )
    }

    // 4. Get level details
    const { data: level, error: levelError } = await supabase
      .from('levels')
      .select('id, name, course_id')
      .eq('id', enrollment.level_id)
      .single()

    if (levelError || !level) {
      return <div className="p-8">ERROR: Level not found - {levelError?.message}</div>
    }

    // 5. Get course details
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('id, name')
      .eq('id', level.course_id)
      .single()

    // 6. Get all units for this level
    const { data: units, error: unitsError } = await supabase
      .from('units')
      .select('id, name, position, level_id')
      .eq('level_id', level.id)
      .order('position')

    if (unitsError || !units || units.length === 0) {
      return (
        <div className="p-8">
          <h1 className="text-xl font-bold">DEBUG INFO</h1>
          <p>Student: {profile?.full_name}</p>
          <p>Level: {level.name}</p>
          <p>Course: {course?.name}</p>
          <p>Units Error: {unitsError?.message || 'No units found'}</p>
          <p>Units Data: {JSON.stringify(units)}</p>
        </div>
      )
    }

    // SUCCESS - Show what we got
    return (
      <div className="min-h-screen bg-[#F7F6FF] p-8">
        <div className="max-w-2xl mx-auto bg-white rounded-xl p-8">
          <h1 className="text-2xl font-bold mb-4">✅ DATA LOADED SUCCESSFULLY!</h1>
          
          <div className="space-y-4">
            <div>
              <p className="font-bold">Student:</p>
              <p>{profile?.full_name} (ID: {student.id})</p>
            </div>

            <div>
              <p className="font-bold">Course:</p>
              <p>{course?.name || 'No course'}</p>
            </div>

            <div>
              <p className="font-bold">Level:</p>
              <p>{level.name}</p>
            </div>

            <div>
              <p className="font-bold">Units Found:</p>
              <p>{units.length} units</p>
              <ul className="list-disc ml-6">
                {units.map(u => (
                  <li key={u.id}>{u.name}</li>
                ))}
              </ul>
            </div>

            <div className="mt-8 p-4 bg-green-100 rounded">
              <p className="font-bold text-green-800">
                If you see this, all queries work! The issue is in MateriContent component.
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
        <p>{error.message}</p>
        <pre className="mt-4 bg-gray-100 p-4 rounded">{error.stack}</pre>
      </div>
    )
  }
}
