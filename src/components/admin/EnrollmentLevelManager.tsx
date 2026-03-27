'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Enrollment {
  id: string
  course_id: string
  course_name: string
  class_name: string
  level_id: string | null
  level_name: string | null
}

interface Level {
  id: string
  name: string
  target_age: string | null
}

interface Props {
  studentId: string
}

export default function EnrollmentLevelManager({ studentId }: Props) {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [levelsByCourse, setLevelsByCourse] = useState<Record<string, Level[]>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<Record<string, boolean>>({})

  useEffect(() => {
    fetchData()
  }, [studentId])

  async function fetchData() {
    const supabase = createClient()

    try {
      // Fetch enrollments dengan course & level info
      const { data: enrollmentData } = await supabase
        .from('enrollments')
        .select(`
          id,
          course_id,
          level_id,
          class_group_id,
          class_groups!inner(label, course_id, courses!inner(name)),
          levels(id, name)
        `)
        .eq('student_id', studentId)
        .eq('status', 'active')

      if (enrollmentData) {
        const formatted = enrollmentData.map((e: any) => ({
          id: e.id,
          course_id: e.class_groups.course_id,
          course_name: e.class_groups.courses.name,
          class_name: e.class_groups.label,
          level_id: e.level_id,
          level_name: e.levels?.name || null,
        }))
        setEnrollments(formatted)

        // Fetch levels untuk setiap course
        const courseIds = [...new Set(formatted.map((e: Enrollment) => e.course_id))]
        const levelsMap: Record<string, Level[]> = {}

        for (const courseId of courseIds) {
          const { data: levels } = await supabase
            .from('levels')
            .select('id, name, target_age')
            .eq('course_id', courseId)
            .eq('is_active', true)
            .order('sort_order')

          if (levels) {
            levelsMap[courseId] = levels
          }
        }

        setLevelsByCourse(levelsMap)
      }
    } catch (error) {
      console.error('Error fetching enrollments:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave(enrollmentId: string, levelId: string) {
    setSaving({ ...saving, [enrollmentId]: true })

    try {
      const response = await fetch('/api/admin/enrollments/update-level', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enrollment_id: enrollmentId,
          level_id: levelId || null,
        }),
      })

      const result = await response.json()

      if (response.ok) {
        // Update local state
        setEnrollments(
          enrollments.map((e) =>
            e.id === enrollmentId
              ? {
                  ...e,
                  level_id: levelId || null,
                  level_name:
                    levelsByCourse[e.course_id]?.find((l) => l.id === levelId)
                      ?.name || null,
                }
              : e
          )
        )
        alert('✅ Level berhasil diperbarui!')
      } else {
        alert('❌ Gagal memperbarui level: ' + result.error)
      }
    } catch (error) {
      console.error('Error saving level:', error)
      alert('❌ Terjadi kesalahan')
    } finally {
      setSaving({ ...saving, [enrollmentId]: false })
    }
  }

  if (loading) {
    return (
      <div className="bg-[#F7F6FF] border-2 border-[#E5E3FF] rounded-xl p-6">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-[#5C4FE5] border-t-transparent rounded-full animate-spin" />
          <span className="text-[13px] text-[#9B97B2]">Memuat data enrollment...</span>
        </div>
      </div>
    )
  }

  if (enrollments.length === 0) {
    return (
      <div className="bg-[#FFF8D6] border-2 border-[#E6B800] rounded-xl p-6">
        <p className="text-[13px] text-[#8A6D00]">
          ℹ️ Siswa belum terdaftar di kelas manapun
        </p>
      </div>
    )
  }

  // Adaptive Layout: Simple vs Cards
  const isSingleEnrollment = enrollments.length === 1

  return (
    <div className="bg-[#F7F6FF] border-2 border-[#E5E3FF] rounded-xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[20px]">📚</span>
        <h3 className="text-[15px] font-bold text-[#1A1530]">Enrollment & Level</h3>
      </div>

      {isSingleEnrollment ? (
        // SIMPLE LAYOUT (1 enrollment)
        <SimpleEnrollmentLayout
          enrollment={enrollments[0]}
          levels={levelsByCourse[enrollments[0].course_id] || []}
          onSave={handleSave}
          isSaving={saving[enrollments[0].id] || false}
        />
      ) : (
        // CARDS LAYOUT (2+ enrollments)
        <div className="space-y-3">
          {enrollments.map((enrollment, index) => (
            <EnrollmentCard
              key={enrollment.id}
              enrollment={enrollment}
              levels={levelsByCourse[enrollment.course_id] || []}
              number={index + 1}
              onSave={handleSave}
              isSaving={saving[enrollment.id] || false}
            />
          ))}
          <div className="mt-3 p-3 bg-[#FFF8D6] rounded-lg text-center">
            <span className="text-[12px] text-[#8A6D00]">
              ℹ️ Siswa enrolled di <strong>{enrollments.length} courses</strong> - tampil
              semua sekaligus
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// Simple Layout Component (1 enrollment)
function SimpleEnrollmentLayout({
  enrollment,
  levels,
  onSave,
  isSaving,
}: {
  enrollment: Enrollment
  levels: Level[]
  onSave: (id: string, levelId: string) => void
  isSaving: boolean
}) {
  const [selectedLevel, setSelectedLevel] = useState(enrollment.level_id || '')

  return (
    <div className="bg-white border-2 border-[#E5E3FF] rounded-xl p-4">
      {/* Course Display */}
      <div className="flex items-center gap-2 mb-4 p-3 bg-[#F7F6FF] rounded-lg">
        <span className="text-[18px]">📘</span>
        <span className="text-[14px] font-bold text-[#1A1530]">{enrollment.course_name}</span>
        <span className="px-2 py-1 bg-[#FFF8D6] text-[#8A6D00] rounded-lg text-[10px] font-bold ml-auto">
          {enrollment.class_name}
        </span>
      </div>

      {/* Level Dropdown */}
      <div className="mb-4">
        <label className="block text-[13px] font-semibold text-[#4A4580] mb-2">
          Pilih Level
        </label>
        <select
          value={selectedLevel}
          onChange={(e) => setSelectedLevel(e.target.value)}
          className="w-full px-3 py-2.5 border-2 border-[#E5E3FF] rounded-lg text-[14px] text-[#1A1530] focus:outline-none focus:ring-2 focus:ring-[#5C4FE5] focus:border-[#5C4FE5]"
        >
          <option value="">-- Pilih Level --</option>
          {levels.map((level) => (
            <option key={level.id} value={level.id}>
              {level.name}
              {level.target_age && ` (${level.target_age})`}
            </option>
          ))}
        </select>
      </div>

      {/* Save Button */}
      <button
        onClick={() => onSave(enrollment.id, selectedLevel)}
        disabled={isSaving}
        className="w-full px-4 py-3 bg-[#5C4FE5] text-white rounded-lg text-[14px] font-bold hover:bg-[#4A3FCC] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
      >
        {isSaving ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>Menyimpan...</span>
          </>
        ) : (
          <>
            <span>💾</span>
            <span>Simpan Level</span>
          </>
        )}
      </button>
    </div>
  )
}

// Card Component (untuk multi enrollments)
function EnrollmentCard({
  enrollment,
  levels,
  number,
  onSave,
  isSaving,
}: {
  enrollment: Enrollment
  levels: Level[]
  number: number
  onSave: (id: string, levelId: string) => void
  isSaving: boolean
}) {
  const [selectedLevel, setSelectedLevel] = useState(enrollment.level_id || '')

  return (
    <div className="bg-white border-2 border-[#E5E3FF] rounded-xl p-4 hover:border-[#5C4FE5] transition-colors">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 bg-[#5C4FE5] text-white rounded-full flex items-center justify-center text-[13px] font-black">
          {number}
        </div>
        <span className="text-[14px] font-bold text-[#1A1530]">{enrollment.course_name}</span>
        <span className="px-2 py-1 bg-[#FFF8D6] text-[#8A6D00] rounded-lg text-[10px] font-bold ml-auto">
          {enrollment.class_name}
        </span>
      </div>

      {/* Level Dropdown */}
      <div className="mb-3">
        <label className="block text-[13px] font-semibold text-[#4A4580] mb-2">
          Pilih Level
        </label>
        <select
          value={selectedLevel}
          onChange={(e) => setSelectedLevel(e.target.value)}
          className="w-full px-3 py-2.5 border-2 border-[#E5E3FF] rounded-lg text-[14px] text-[#1A1530] focus:outline-none focus:ring-2 focus:ring-[#5C4FE5] focus:border-[#5C4FE5]"
        >
          <option value="">-- Pilih Level --</option>
          {levels.map((level) => (
            <option key={level.id} value={level.id}>
              {level.name}
              {level.target_age && ` (${level.target_age})`}
            </option>
          ))}
        </select>
      </div>

      {/* Save Button */}
      <button
        onClick={() => onSave(enrollment.id, selectedLevel)}
        disabled={isSaving}
        className="w-full px-4 py-2.5 bg-[#5C4FE5] text-white rounded-lg text-[14px] font-bold hover:bg-[#4A3FCC] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
      >
        {isSaving ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>Menyimpan...</span>
          </>
        ) : (
          <>
            <span>💾</span>
            <span>Simpan</span>
          </>
        )}
      </button>
    </div>
  )
}
