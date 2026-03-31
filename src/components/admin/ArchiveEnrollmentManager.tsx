'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';

interface Course {
  id: string;
  name: string;
}

interface ArchiveClassGroup {
  id: string;
  course_id: string;
}

interface Enrollment {
  id: string;
  class_group_id: string;
}

interface ArchiveEnrollmentManagerProps {
  studentId: string;
}

export default function ArchiveEnrollmentManager({ studentId }: ArchiveEnrollmentManagerProps) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [archiveClassGroups, setArchiveClassGroups] = useState<ArchiveClassGroup[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [selectedCourseIds, setSelectedCourseIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    fetchData();
  }, [studentId]);

  async function fetchData() {
    try {
      setLoading(true);

      // Fetch all courses
      const { data: coursesData, error: coursesError } = await supabase
        .from('courses')
        .select('id, name')
        .order('name');

      if (coursesError) throw coursesError;

      // Fetch all archive class groups
      const { data: archiveData, error: archiveError } = await supabase
        .from('class_groups')
        .select('id, course_id')
        .eq('status', 'inactive')
        .like('label', 'Materi Arsip%');

      if (archiveError) throw archiveError;

      // Fetch student's existing enrollments
      const { data: enrollmentsData, error: enrollmentsError } = await supabase
        .from('enrollments')
        .select('id, class_group_id')
        .eq('student_id', studentId);

      if (enrollmentsError) throw enrollmentsError;

      setCourses(coursesData || []);
      setArchiveClassGroups(archiveData || []);
      setEnrollments(enrollmentsData || []);

      // Build initial selected courses
      const enrolledArchiveGroupIds = new Set(
        (enrollmentsData || []).map(e => e.class_group_id)
      );
      const enrolledCourseIds = (archiveData || [])
        .filter(ag => enrolledArchiveGroupIds.has(ag.id))
        .map(ag => ag.course_id);
      
      setSelectedCourseIds(new Set(enrolledCourseIds));
    } catch (error) {
      console.error('Error fetching data:', error);
      setMessage({ type: 'error', text: 'Gagal memuat data' });
    } finally {
      setLoading(false);
    }
  }

  function handleCourseToggle(courseId: string) {
    const newSelected = new Set(selectedCourseIds);
    if (newSelected.has(courseId)) {
      newSelected.delete(courseId);
    } else {
      newSelected.add(courseId);
    }
    setSelectedCourseIds(newSelected);
  }

  async function handleSave() {
    try {
      setSaving(true);
      setMessage(null);

      const response = await fetch('/api/admin/enrollments/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          course_ids: Array.from(selectedCourseIds),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Gagal menyimpan akses arsip');
      }

      setMessage({ 
        type: 'success', 
        text: `Berhasil menyimpan akses arsip! ${result.enrollments_created} enrollment dibuat.` 
      });

      // Refresh data
      await fetchData();

      // Reload page after 1 second to show EnrollmentLevelManager
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('Error saving archive access:', error);
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Gagal menyimpan akses arsip' 
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg border-2 border-[#E5E3FF] p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Akses Materi Arsip</h3>
        <p className="text-gray-500">Memuat...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border-2 border-[#E5E3FF] p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Akses Materi Arsip</h3>
        <p className="text-sm text-gray-600">
          Centang mata pelajaran untuk memberikan akses ke materi level yang sudah dipelajari sebelumnya. 
          Setelah menyimpan, Anda bisa memilih level spesifik menggunakan "Enrollment Level Manager" di bawah.
        </p>
      </div>

      {message && (
        <div
          className={`mb-4 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="space-y-3 mb-6">
        {courses.length === 0 ? (
          <p className="text-gray-500">Tidak ada mata pelajaran tersedia.</p>
        ) : (
          courses.map((course) => {
            const archiveGroup = archiveClassGroups.find(ag => ag.course_id === course.id);
            const isEnrolled = selectedCourseIds.has(course.id);
            const hasArchiveGroup = !!archiveGroup;

            return (
              <label
                key={course.id}
                className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all cursor-pointer ${
                  isEnrolled
                    ? 'border-[#5C4FE5] bg-[#F7F6FF]'
                    : 'border-[#E5E3FF] hover:border-[#5C4FE5]/50'
                } ${!hasArchiveGroup ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={isEnrolled}
                  onChange={() => hasArchiveGroup && handleCourseToggle(course.id)}
                  disabled={!hasArchiveGroup || saving}
                  className="w-5 h-5 text-[#5C4FE5] border-gray-300 rounded focus:ring-[#5C4FE5] focus:ring-2"
                />
                <div className="flex-1">
                  <span className="font-medium text-gray-900">{course.name}</span>
                  {!hasArchiveGroup && (
                    <span className="ml-2 text-xs text-gray-500">(Archive class group belum dibuat)</span>
                  )}
                </div>
              </label>
            );
          })
        )}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full px-6 py-3 bg-[#5C4FE5] text-white font-semibold rounded-lg hover:bg-[#4a3ec7] transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
      >
        {saving ? 'Menyimpan...' : 'Simpan Akses Arsip'}
      </button>

      <p className="mt-3 text-xs text-gray-500">
        💡 Tip: Setelah menyimpan, scroll ke bawah untuk memilih level spesifik menggunakan "Enrollment Level Manager".
      </p>
    </div>
  );
}
