'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BookOpen, Check, AlertCircle, Save, CheckCircle } from 'lucide-react'

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
  savedLevels: string[]
  selectedLevels: string[]
  saving: boolean
  success: boolean
  error: string
}

const TARGET_AGE_LABELS: Record<string, string> = {
  all: 'Semua',
  kids: 'Anak',
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

    const enrollmentsData: Enrollment[] = enrData.map((e: any) => ({
      id: e.id,
      class_group_id: e.class_group_id,
      course_id: e.class_groups.courses.id,
      course_name: e.class_groups.courses.name,
      course_color: e.class_groups.courses.color,
      class_label: e.class_groups.label,
      status: e.status,
    }))

    const enriched = await Promise.all(
      enrollmentsData.map(async (enr) => {
        const { data: levels } = await supabase
          .from('levels')
          .select('id, name, description, target_age, sort_order')
          .eq('course_id', enr.course_id)
          .eq('is_active', true)
          .order('sort_order')

        const { data: savedLevelsData } = await supabase
          .from('enrollment_levels')
          .select('level_id')
          .eq('enrollment_id', enr.id)

        const savedLevelIds = (savedLevelsData ?? []).map((sl: any) => sl.level_id)

        return {
          ...enr,
          availableLevels: (levels ?? []) as Level[],
          savedLevels: savedLevelIds,
          selectedLevels: savedLevelIds,
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

    setEnrollments((prev) =>
      prev.map((e) =>
        e.id === enrollmentId ? { ...e, saving: true, error: '', success: false } : e
      )
    )

    try {
      // 1. Delete old enrollment_levels
      const { error: deleteError } = await supabase
        .from('enrollment_levels')
        .delete()
        .eq('enrollment_id', enrollmentId)

      if (deleteError) throw deleteError

      // 2. Insert new enrollment_levels
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

        // 3. ✅ Update enrollments.level_id with first selected level
        const primaryLevelId = enrollment.selectedLevels[0]
        const { error: updateError } = await supabase
          .from('enrollments')
          .update({ level_id: primaryLevelId })
          .eq('id', enrollmentId)

        if (updateError) throw updateError

        // 4. ✅ Sync ke class_group_levels
        for (const levelId of enrollment.selectedLevels) {
          const { data: existing } = await supabase
            .from('class_group_levels')
            .select('id')
            .eq('class_group_id', enrollment.class_group_id)
            .eq('level_id', levelId)
            .maybeSingle()

          if (!existing) {
            await supabase.from('class_group_levels').insert({
              class_group_id: enrollment.class_group_id,
              level_id: levelId,
            })
          }
        }
      } else {
        // 4. ✅ NEW: If no levels selected, set to NULL
        const { error: updateError } = await supabase
          .from('enrollments')
          .update({ level_id: null })
          .eq('id', enrollmentId)

        if (updateError) throw updateError
      }

      setEnrollments((prev) =>
        prev.map((e) =>
          e.id === enrollmentId
            ? {
                ...e,
                savedLevels: [...enrollment.selectedLevels],
                saving: false,
                success: true,
              }
            : e
        )
      )

      setTimeout(() => {
        setEnrollments((prev) =>
          prev.map((e) => (e.id === enrollmentId ? { ...e, success: false } : e))
        )
      }, 3000)
    } catch (error: any) {
      setEnrollments((prev) =>
        prev.map((e) =>
          e.id === enrollmentId
            ? { ...e, saving: false, error: error.message }
            : e
        )
      )
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-[#E5E3FF] p-6">
        <div className="flex items-center gap-2 mb-5">
          <BookOpen size={16} className="text-[#5C4FE5]" />
          <h3 className="font-bold text-[#1A1640] text-sm">Enrollment & Level</h3>
        </div>
        <div className="px-4 py-3 bg-[#F7F6FF] rounded-xl text-center">
          <p className="text-sm text-[#7B78A8]">Memuat data enrollment...</p>
        </div>
      </div>
    )
  }

  if (enrollments.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-[#E5E3FF] p-6">
        <div className="flex items-center gap-2 mb-5">
          <BookOpen size={16} className="text-[#5C4FE5]" />
          <h3 className="font-bold text-[#1A1640] text-sm">Enrollment & Level</h3>
        </div>
        <div className="px-4 py-3 bg-[#FEF3E2] border border-[#F5C800] rounded-xl">
          <p className="text-sm font-semibold text-[#92400E]">Siswa belum terdaftar di kelas manapun</p>
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
        {enrollments.map((enr, idx) => {
          const hasChanges =
            JSON.stringify([...enr.selectedLevels].sort()) !==
            JSON.stringify([...enr.savedLevels].sort())

          // Get active level names
          const activeLevelNames = enr.availableLevels
            .filter(lvl => enr.savedLevels.includes(lvl.id))
            .map(lvl => lvl.name)

          return (
            <div
              key={enr.id}
              className="border-2 rounded-2xl overflow-hidden transition-all"
              style={{ borderColor: enr.course_color ?? '#E5E3FF' }}
            >
              {/* HEADER */}
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

              {/* CONTENT */}
              <div className="px-4 py-4">
                {enr.availableLevels.length === 0 ? (
                  <div className="px-4 py-3 bg-[#FEF3E2] border border-[#F5C800] rounded-xl text-center">
                    <p className="text-xs font-semibold text-[#92400E]">
                      ⚠️ Belum ada level tersedia untuk kursus ini
                    </p>
                  </div>
                ) : (
                  <>
                    {/* STATUS LEVEL AKTIF */}
                    {enr.savedLevels.length > 0 ? (
                      <div className="mb-4 px-4 py-3 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle size={16} className="text-green-600 flex-shrink-0" />
                          <p className="text-xs font-bold text-green-800 uppercase tracking-wide">
                            Level Aktif Saat Ini
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {activeLevelNames.map((name, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs font-bold rounded-lg"
                            >
                              <Check size={12} />
                              {name}
                            </span>
                          ))}
                        </div>
                        <p className="text-[10px] text-green-700 mt-2 font-semibold">
                          ✓ Siswa saat ini terdaftar di {enr.savedLevels.length} level
                        </p>
                      </div>
                    ) : (
                      <div className="mb-4 px-4 py-3 bg-amber-50 border-2 border-amber-200 rounded-xl">
                        <div className="flex items-center gap-2">
                          <AlertCircle size={16} className="text-amber-600 flex-shrink-0" />
                          <p className="text-xs font-bold text-amber-800">
                            Belum ada level aktif - silakan pilih level di bawah
                          </p>
                        </div>
                      </div>
                    )}

                    <p className="text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-3">
                      Pilih Level (bisa lebih dari 1)
                    </p>

                    {/* GRID LAYOUT - 2 cols mobile, 3 cols tablet, 4 cols desktop */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 mb-3">
                      {enr.availableLevels.map((level) => {
                        const isSelected = enr.selectedLevels.includes(level.id)
                        const isSaved = enr.savedLevels.includes(level.id)

                        return (
                          <label
                            key={level.id}
                            className={`relative flex items-start gap-2 p-3 border-2 rounded-xl cursor-pointer transition-all ${
                              isSaved
                                ? 'border-green-500 bg-green-50 ring-2 ring-green-200'
                                : isSelected
                                ? 'border-[#27A05A] bg-[#E6F4EC]'
                                : 'border-[#E5E3FF] bg-white hover:border-[#C4BFFF] hover:bg-[#F7F6FF]'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleLevel(enr.id, level.id)}
                              className="mt-0.5 w-4 h-4 rounded border-gray-300 text-[#27A05A] focus:ring-[#27A05A] focus:ring-offset-0 cursor-pointer flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-1">
                                <span
                                  className={`text-xs font-bold leading-tight ${
                                    isSaved
                                      ? 'text-green-800'
                                      : isSelected
                                      ? 'text-[#1A5C36]'
                                      : 'text-[#1A1640]'
                                  }`}
                                >
                                  {level.name}
                                </span>
                                {isSaved && (
                                  <CheckCircle size={14} className="text-green-600 flex-shrink-0" />
                                )}
                                {isSelected && !isSaved && (
                                  <Check size={14} className="text-[#27A05A] flex-shrink-0" />
                                )}
                              </div>
                              
                              {level.description && (
                                <p
                                  className={`text-[10px] mt-1 leading-tight ${
                                    isSaved
                                      ? 'text-green-700'
                                      : isSelected
                                      ? 'text-[#1A5C36]'
                                      : 'text-[#7B78A8]'
                                  }`}
                                >
                                  {level.description}
                                </p>
                              )}
                              
                              <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                                {level.target_age && (
                                  <span
                                    className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${
                                      isSaved
                                        ? 'bg-green-600 text-white'
                                        : isSelected
                                        ? 'bg-[#27A05A] text-white'
                                        : 'bg-[#E5E3FF] text-[#5C4FE5]'
                                    }`}
                                  >
                                    {TARGET_AGE_LABELS[level.target_age] ||
                                      level.target_age}
                                  </span>
                                )}
                                {isSaved && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-green-600 text-white">
                                    ✓ AKTIF
                                  </span>
                                )}
                              </div>
                            </div>
                          </label>
                        )
                      })}
                    </div>

                    <button
                      onClick={() => saveLevels(enr.id)}
                      disabled={enr.saving || !hasChanges}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#5C4FE5] text-white text-sm font-bold rounded-xl hover:bg-[#3D34C4] transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Save size={14} />
                      {enr.saving
                        ? 'Menyimpan...'
                        : hasChanges
                        ? 'Simpan Perubahan'
                        : 'Tidak Ada Perubahan'}
                    </button>

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
          )
        })}
      </div>
    </div>
  )
}
