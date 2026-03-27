'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BookOpen, Check, AlertCircle, Save } from 'lucide-react'

type Enrollment = {
  id: string
  class_group_id: string
  course_id: string
  course_name: string
  course_color: string | null
  class_label: string
  status: string
}

type Level = {
  id: string
  name: string
  description: string | null
  target_age: string | null
  sort_order: number
}

type EnrollmentWithLevels = Enrollment & {
  availableLevels: Level[]
  selectedLevels: string[] // array of level IDs
  saving: boolean
  success: boolean
  error: string
}

const TARGET_AGE_LABELS: Record<string, string> = {
  all: 'Semua Usia',
  kids: 'Anak-anak',
  teen: 'Remaja',
  adult: 'Dewasa',
  kids_teen: 'Anak & Remaja',
  teen_adult: 'Remaja & Dewasa',
}

export default function EnrollmentLevelManager({ studentId }: { studentId: string }) {
  const supabase = createClient()
  const [enrollments, setEnrollments] = useState<EnrollmentWithLevels[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchEnrollments()
  }, [studentId])

  async function fetchEnrollments() {
    setLoading(true)

    // 1. Fetch enrollments dengan course & class info
    const { data: enrData } = await supabase
      .from('enrollments')
      .select(`
        id, 
        class_group_id, 
        status,
        class_groups!inner(
          label,
          course_id,
          courses!inner(
            id,
            name,
            color
          )
        )
      `)
      .eq('student_id', studentId)
      .eq('status', 'active')

    if (!enrData || enrData.length === 0) {
      setEnrollments([])
      setLoading(false)
      return
    }

    // 2. Transform data
    const enrollmentsData: Enrollment[] = enrData.map((e: any) => ({
      id: e.id,
      class_group_id: e.class_group_id,
      course_id: e.class_groups.courses.id,
      course_name: e.class_groups.courses.name,
      course_color: e.class_groups.courses.color,
      class_label: e.class_groups.label,
      status: e.status,
    }))

    // 3. Untuk setiap enrollment, fetch available levels + selected levels
    const enriched = await Promise.all(
      enrollmentsData.map(async (enr) => {
        // Fetch available levels untuk course ini
        const { data: levels } = await supabase
          .from('levels')
          .select('id, name, description, target_age, sort_order')
          .eq('course_id', enr.course_id)
          .eq('is_active', true)
          .order('sort_order')

        // Fetch selected levels untuk enrollment ini
        const { data: selectedLevelsData } = await supabase
          .from('enrollment_levels')
          .select('level_id')
          .eq('enrollment_id', enr.id)

        const selectedLevelIds = (selectedLevelsData ?? []).map((sl: any) => sl.level_id)

        return {
          ...enr,
          availableLevels: (levels ?? []) as Level[],
          selectedLevels: selectedLevelIds,
          saving: false,
          success: false,
          error: '',
        }
      })
    )

    setEnrollments(enriched)
    setLoading(false)
  }

  function toggleLevel(enrollmentId: string, levelId: string) {
    setEnrollments((prev) =>
      prev.map((enr) => {
        if (enr.id !== enrollmentId) return enr

        const isSelected = enr.selectedLevels.includes(levelId)
        return {
          ...enr,
          selectedLevels: isSelected
            ? enr.selectedLevels.filter((id) => id !== levelId)
            : [...enr.selectedLevels, levelId],
          success: false,
          error: '',
        }
      })
    )
  }

  async function saveLevels(enrollmentId: string) {
    const enrollment = enrollments.find((e) => e.id === enrollmentId)
    if (!enrollment) return

    // Set saving state
    setEnrollments((prev) =>
      prev.map((e) =>
        e.id === enrollmentId ? { ...e, saving: true, error: '', success: false } : e
      )
    )

    try {
      // 1. Delete semua enrollment_levels lama
      const { error: deleteError } = await supabase
        .from('enrollment_levels')
        .delete()
        .eq('enrollment_id', enrollmentId)

      if (deleteError) throw deleteError

      // 2. Insert yang terpilih
      if (enrollment.selectedLevels.length > 0) {
        const { error: insertError } = await supabase
          .from('enrollment_levels')
          .insert(
            enrollment.selectedLevels.map((levelId) => ({
              enrollment_id: enrollmentId,
              level_id: levelId,
            }))
          )

        if (insertError) throw insertError
      }

      // Success!
      setEnrollments((prev) =>
        prev.map((e) =>
          e.id === enrollmentId ? { ...e, saving: false, success: true } : e
        )
      )

      // Auto hide success message after 2s
      setTimeout(() => {
        setEnrollments((prev) =>
          prev.map((e) => (e.id === enrollmentId ? { ...e, success: false } : e))
        )
      }, 2000)
    } catch (error: any) {
      setEnrollments((prev) =>
        prev.map((e) =>
          e.id === enrollmentId
            ? { ...e, saving: false, error: error.message || 'Gagal menyimpan' }
            : e
        )
      )
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-[#E5E3FF] p-6">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen size={16} className="text-[#5C4FE5]" />
          <h3 className="font-bold text-[#1A1640] text-sm">Enrollment & Level</h3>
        </div>
        <p className="text-sm text-[#7B78A8]">Memuat data enrollment...</p>
      </div>
    )
  }

  if (enrollments.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-[#E5E3FF] p-6">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen size={16} className="text-[#5C4FE5]" />
          <h3 className="font-bold text-[#1A1640] text-sm">Enrollment & Level</h3>
        </div>
        <div className="px-4 py-8 bg-[#FEF3E2] border border-[#F5C800] rounded-xl text-center">
          <div className="w-10 h-10 rounded-full bg-[#F5C800]/20 flex items-center justify-center mx-auto mb-2">
            <AlertCircle size={18} className="text-[#92400E]" />
          </div>
          <p className="text-sm font-semibold text-[#92400E]">
            📚 Siswa enrolled di 2 courses - tampil semua sekaligus
          </p>
          <p className="text-xs text-[#92400E] mt-1">
            Daftarkan siswa ke kelas terlebih dahulu
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-[#E5E3FF] p-6">
      <div className="flex items-center gap-2 mb-5">
        <BookOpen size={16} className="text-[#5C4FE5]" />
        <h3 className="font-bold text-[#1A1640] text-sm">Enrollment & Level</h3>
      </div>

      <div className="space-y-4">
        {enrollments.map((enr, idx) => (
          <div
            key={enr.id}
            className="border-2 rounded-2xl overflow-hidden transition-all"
            style={{ borderColor: enr.course_color ?? '#E5E3FF' }}
          >
            {/* Header */}
            <div
              className="px-4 py-3 flex items-center justify-between"
              style={{
                backgroundColor: enr.course_color
                  ? `${enr.course_color}15`
                  : '#F7F6FF',
              }}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black text-white"
                    style={{ backgroundColor: enr.course_color ?? '#5C4FE5' }}
                  >
                    {idx + 1}
                  </span>
                  <span
                    className="font-bold text-sm"
                    style={{ color: enr.course_color ?? '#1A1640' }}
                  >
                    {enr.course_name}
                  </span>
                </div>
                <p className="text-xs text-[#7B78A8] mt-0.5 ml-8">
                  Kelas: {enr.class_label}
                </p>
              </div>
            </div>

            {/* Level Selection */}
            <div className="px-4 py-4">
              {enr.availableLevels.length === 0 ? (
                <div className="px-4 py-3 bg-[#FEF3E2] border border-[#F5C800] rounded-xl text-center">
                  <p className="text-xs font-semibold text-[#92400E]">
                    ⚠️ Belum ada level tersedia untuk kursus ini
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-3">
                    Pilih Level (bisa lebih dari 1)
                  </p>
                  <div className="space-y-2 mb-4">
                    {enr.availableLevels.map((level) => {
                      const isSelected = enr.selectedLevels.includes(level.id)
                      return (
                        <label
                          key={level.id}
                          className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-[#E6F4EC] border-[#27A05A]'
                              : 'bg-[#F7F6FF] border-[#E5E3FF] hover:border-[#C4BFFF]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleLevel(enr.id, level.id)}
                            className="w-4 h-4 rounded border-gray-300 text-[#27A05A] focus:ring-[#27A05A] focus:ring-offset-0 cursor-pointer"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-sm font-bold ${
                                  isSelected ? 'text-[#1A5C36]' : 'text-[#1A1640]'
                                }`}
                              >
                                {level.name}
                              </span>
                              {level.target_age && (
                                <span
                                  className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                                    isSelected
                                      ? 'bg-[#27A05A] text-white'
                                      : 'bg-[#E5E3FF] text-[#5C4FE5]'
                                  }`}
                                >
                                  {TARGET_AGE_LABELS[level.target_age] ||
                                    level.target_age}
                                </span>
                              )}
                            </div>
                            {level.description && (
                              <p
                                className={`text-xs mt-0.5 ${
                                  isSelected ? 'text-[#1A5C36]' : 'text-[#7B78A8]'
                                }`}
                              >
                                {level.description}
                              </p>
                            )}
                          </div>
                          {isSelected && (
                            <Check size={16} className="text-[#27A05A] flex-shrink-0" />
                          )}
                        </label>
                      )
                    })}
                  </div>

                  {/* Info + Save Button */}
                  <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-[#F7F6FF] border border-[#E5E3FF] rounded-xl">
                    <span className="text-xs text-[#7B78A8]">
                      {enr.selectedLevels.length === 0 ? (
                        'Belum ada level dipilih'
                      ) : (
                        <>
                          <span className="font-bold text-[#5C4FE5]">
                            {enr.selectedLevels.length}
                          </span>{' '}
                          level dipilih
                        </>
                      )}
                    </span>
                    <button
                      onClick={() => saveLevels(enr.id)}
                      disabled={enr.saving || enr.selectedLevels.length === 0}
                      className="flex items-center gap-1.5 px-4 py-1.5 bg-[#5C4FE5] text-white text-xs font-bold rounded-lg hover:bg-[#3D34C4] transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Save size={12} />
                      {enr.saving ? 'Menyimpan...' : 'Simpan'}
                    </button>
                  </div>

                  {/* Success/Error Messages */}
                  {enr.success && (
                    <div className="mt-3 px-4 py-2 bg-[#E6F4EC] border border-[#27A05A] rounded-xl flex items-center gap-2">
                      <Check size={14} className="text-[#27A05A]" />
                      <p className="text-xs font-semibold text-[#1A5C36]">
                        Level berhasil disimpan!
                      </p>
                    </div>
                  )}
                  {enr.error && (
                    <div className="mt-3 px-4 py-2 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
                      <AlertCircle size={14} className="text-red-600" />
                      <p className="text-xs font-semibold text-red-600">{enr.error}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
