import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'

export default async function MateriPage({ 
  params 
}: { 
  params: Promise<{ slug: string }> 
}) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  // Get student
  const { data: students } = await supabase
    .from('students')
    .select('id, profile_id')
    .eq('slug', slug)

  if (!students || students.length === 0) notFound()
  const student = students[0]

  // Get enrollment
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('id, level_id')
    .eq('student_id', student.id)
    .eq('status', 'active')

  const enrollment = enrollments?.[0]

  // Get level
  const { data: level } = await supabase
    .from('levels')
    .select('id, name')
    .eq('id', enrollment?.level_id)
    .single()

  // ============================================
  // THE CRITICAL QUERY - Let's see what it returns
  // ============================================
  const { data: units, error: unitsError } = await supabase
    .from('units')
    .select('id, unit_name, position, level_id')
    .eq('level_id', level?.id)
    .order('position')

  return (
    <div className="min-h-screen bg-[#F7F6FF] p-4">
      <div className="max-w-4xl mx-auto space-y-4">
        
        {/* Level Info */}
        <div className="bg-white rounded-lg p-4 border-2 border-blue-500">
          <h2 className="font-bold text-lg">📍 Level Info</h2>
          <p><strong>Level ID from enrollment:</strong></p>
          <p className="font-mono text-xs bg-gray-100 p-2 rounded">{enrollment?.level_id}</p>
          <p className="mt-2"><strong>Level Name:</strong> {level?.name}</p>
        </div>

        {/* Units Query Result */}
        <div className={`rounded-lg p-4 border-2 ${units && units.length > 0 ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}>
          <h2 className="font-bold text-lg">🔍 Units Query Result</h2>
          
          <div className="mt-2">
            <p><strong>Query:</strong></p>
            <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto">
{`supabase
  .from('units')
  .select('id, unit_name, position, level_id')
  .eq('level_id', '${level?.id}')
  .order('position')`}
            </pre>
          </div>

          <div className="mt-4">
            <p><strong>Error:</strong> {unitsError ? unitsError.message : 'None'}</p>
            <p><strong>Data returned:</strong> {units ? units.length : 0} rows</p>
          </div>

          {units && units.length > 0 ? (
            <div className="mt-4">
              <p className="font-bold text-green-600">✅ Units Found!</p>
              <pre className="bg-white p-4 rounded mt-2 overflow-auto text-xs">
                {JSON.stringify(units, null, 2)}
              </pre>
            </div>
          ) : (
            <div className="mt-4">
              <p className="font-bold text-red-600">❌ No Units Returned!</p>
              <p className="mt-2">But we KNOW units exist from SQL query!</p>
            </div>
          )}
        </div>

        {/* Expected vs Actual */}
        <div className="bg-yellow-50 rounded-lg p-4 border-2 border-yellow-500">
          <h2 className="font-bold text-lg">🎯 Expected vs Actual</h2>
          
          <div className="mt-2">
            <p><strong>Expected Unit (from SQL):</strong></p>
            <pre className="bg-white p-2 rounded text-xs mt-1">
{`{
  "id": "efa80c45-2e64-4b75-a867-4fdae8fe6225",
  "unit_name": "03 Planets and space",
  "position": 0,
  "level_id": "173355d6-e5e6-4732-9706-643c1908b5c5"
}`}
            </pre>
          </div>

          <div className="mt-4">
            <p><strong>Actual Query Result:</strong></p>
            <p>{units && units.length > 0 ? '✅ MATCH!' : '❌ NOT FOUND'}</p>
          </div>

          {(!units || units.length === 0) && (
            <div className="mt-4 p-3 bg-red-100 rounded">
              <p className="font-bold text-red-800">🔴 POSSIBLE CAUSES:</p>
              <ul className="list-disc ml-6 mt-2 text-sm">
                <li>RLS policy blocking the query</li>
                <li>level_id mismatch</li>
                <li>Old build cache on Vercel</li>
                <li>is_active = false filtering somewhere</li>
              </ul>
            </div>
          )}
        </div>

        {/* RLS Check */}
        <div className="bg-purple-50 rounded-lg p-4 border-2 border-purple-500">
          <h2 className="font-bold text-lg">🔒 Check RLS Policies</h2>
          <p className="text-sm mt-2">Run this in Supabase SQL Editor:</p>
          <pre className="bg-white p-2 rounded text-xs mt-2 overflow-auto">
{`SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual
FROM pg_policies
WHERE tablename = 'units';`}
          </pre>
        </div>

      </div>
    </div>
  )
}
