'use client'

import { useState } from 'react'
import { Video, BookMarked, Headphones, GraduationCap, BookOpen, ChevronRight } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Material {
  material_id: string
  title: string
  type: 'live_zoom' | 'bacaan_interaktif' | 'kosa_kata' | 'cefr'
  lesson_number: number | null
  lesson_name: string | null
  unit_number: number
  unit_name: string
  level_name: string
  target_age: string | null
  course_name: string
  course_color: string
  is_published: boolean
  created_at: string
}

interface EnrolledLevel {
  level_id: string
  level_name: string
  course_name: string
  target_age: string | null
}

interface Props {
  materials: Material[]
  enrolledLevels: EnrolledLevel[]
  studentName: string
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

function typeIcon(type: string, size = 16) {
  switch (type) {
    case 'live_zoom':
      return <Video size={size} />
    case 'bacaan_interaktif':
      return <BookMarked size={size} />
    case 'kosa_kata':
      return <Headphones size={size} />
    case 'cefr':
      return <GraduationCap size={size} />
    default:
      return <BookOpen size={size} />
  }
}

function typeLabel(type: string) {
  switch (type) {
    case 'live_zoom':
      return 'Live Zoom'
    case 'bacaan_interaktif':
      return 'Bacaan Interaktif'
    case 'kosa_kata':
      return 'Kosa Kata'
    case 'cefr':
      return 'CEFR'
    default:
      return type
  }
}

function typeBadgeCls(type: string) {
  switch (type) {
    case 'live_zoom':
      return 'bg-[#FFF8D6] text-[#8A6D00]'
    case 'bacaan_interaktif':
      return 'bg-[#EAE8FD] text-[#5C4FE5]'
    case 'kosa_kata':
      return 'bg-[#E8F5E9] text-[#2E7D32]'
    case 'cefr':
      return 'bg-[#FFE4E1] text-[#C62828]'
    default:
      return 'bg-gray-100 text-gray-700'
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MateriListClient({ materials, enrolledLevels, studentName }: Props) {
  const [filterLevel, setFilterLevel] = useState('semua')

  // Filter by level
  const filtered = materials.filter((m) => filterLevel === 'semua' || m.level_name === filterLevel)

  // Group by course → level → unit
  const grouped = filtered.reduce((acc, mat) => {
    const courseKey = mat.course_name
    const levelKey = mat.level_name
    const unitKey = `Unit ${mat.unit_number}`

    if (!acc[courseKey]) acc[courseKey] = {}
    if (!acc[courseKey][levelKey]) acc[courseKey][levelKey] = {}
    if (!acc[courseKey][levelKey][unitKey]) acc[courseKey][levelKey][unitKey] = []

    acc[courseKey][levelKey][unitKey].push(mat)
    return acc
  }, {} as Record<string, Record<string, Record<string, Material[]>>>)

  return (
    <div className="min-h-screen bg-[#F7F6FF] pb-20">
      {/* HEADER */}
      <div className="bg-white border-b border-[#E5E3FF] sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="mb-4">
            <h1 className="text-[20px] font-black text-[#1A1530]">Materi Pembelajaran</h1>
            <p className="text-[12px] text-[#9B97B2] mt-0.5">
              Halo {studentName}! Berikut materi yang bisa kamu akses
            </p>
          </div>

          {/* Enrolled Levels Info */}
          {enrolledLevels.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="text-[11px] font-bold text-[#9B97B2]">Level Aktif:</span>
              {enrolledLevels.map((level) => (
                <span
                  key={level.level_id}
                  className="px-2 py-1 bg-[#E8F5E9] text-[#2E7D32] rounded-lg text-[10px] font-bold"
                >
                  {level.level_name} {level.target_age && `(${level.target_age})`}
                </span>
              ))}
            </div>
          )}

          {/* Filter */}
          {enrolledLevels.length > 1 && (
            <div className="flex gap-3">
              <select
                value={filterLevel}
                onChange={(e) => setFilterLevel(e.target.value)}
                className="px-3 py-2 border border-[#E5E3FF] rounded-xl text-[13px] font-medium text-[#4A4580] focus:outline-none focus:ring-2 focus:ring-[#5C4FE5]"
              >
                <option value="semua">Semua Level</option>
                {enrolledLevels.map((level) => (
                  <option key={level.level_id} value={level.level_name}>
                    {level.level_name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* CONTENT */}
      <div className="max-w-5xl mx-auto px-6 py-6">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E5E3FF] p-12 text-center">
            <div className="w-16 h-16 bg-[#F7F6FF] rounded-full flex items-center justify-center mx-auto mb-4">
              <BookOpen size={24} className="text-[#5C4FE5]" />
            </div>
            <h3 className="text-[15px] font-bold text-[#1A1530] mb-1">Belum ada materi</h3>
            <p className="text-[12px] text-[#9B97B2]">
              {enrolledLevels.length === 0
                ? 'Kamu belum terdaftar di level manapun'
                : 'Materi sedang disiapkan oleh tutor'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([courseName, levels]) => (
              <div key={courseName}>
                {/* Course Header */}
                <div className="mb-4">
                  <h2 className="text-[18px] font-black text-[#1A1530]">{courseName}</h2>
                </div>

                {/* Levels */}
                {Object.entries(levels).map(([levelName, units]) => (
                  <div key={levelName} className="mb-6">
                    {/* Level Header */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className="px-3 py-1.5 bg-[#E8F5E9] text-[#2E7D32] rounded-lg text-[12px] font-bold">
                        {levelName}
                      </span>
                    </div>

                    {/* Units */}
                    {Object.entries(units).map(([unitName, materials]) => (
                      <div key={unitName} className="mb-4">
                        {/* Unit Header */}
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[13px] font-bold text-[#4A4580]">{unitName}</span>
                          <span className="text-[11px] text-[#9B97B2]">
                            {materials[0].unit_name}
                          </span>
                        </div>

                        {/* Materials */}
                        <div className="space-y-2">
                          {materials.map((mat) => (
                            <a
                              key={mat.material_id}
                              href={`/siswa/materi/${mat.material_id}`}
                              className="block bg-white rounded-xl border border-[#E5E3FF] p-4 hover:shadow-md hover:border-[#5C4FE5] transition-all group"
                            >
                              <div className="flex items-start gap-3">
                                {/* Icon */}
                                <div
                                  className={`p-2 rounded-lg ${typeBadgeCls(mat.type)} flex-shrink-0`}
                                >
                                  {typeIcon(mat.type, 16)}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start gap-2 mb-1">
                                    <span
                                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${typeBadgeCls(
                                        mat.type
                                      )}`}
                                    >
                                      {typeLabel(mat.type)}
                                    </span>
                                    {mat.lesson_number && (
                                      <span className="px-2 py-0.5 bg-[#FFF8D6] text-[#8A6D00] rounded-lg text-[10px] font-bold">
                                        Lesson {mat.lesson_number}
                                      </span>
                                    )}
                                  </div>
                                  <h3 className="text-[14px] font-bold text-[#1A1530] mb-1 group-hover:text-[#5C4FE5] transition-colors">
                                    {mat.title}
                                  </h3>
                                  {mat.lesson_name && (
                                    <p className="text-[11px] text-[#9B97B2]">{mat.lesson_name}</p>
                                  )}
                                </div>

                                {/* Arrow */}
                                <ChevronRight
                                  size={18}
                                  className="text-[#9B97B2] group-hover:text-[#5C4FE5] transition-colors flex-shrink-0"
                                />
                              </div>
                            </a>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
