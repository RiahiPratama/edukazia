'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BookOpen, CheckCircle, Circle, ExternalLink, Maximize2, Minimize2 } from 'lucide-react'

type Material = {
  id: string
  title: string
  lesson_name: string | null
  category: string | null
  gdrive_url: string | null
  component_id: string | null
  thumbnail_url: string | null
  lesson_number: number | null
  isCompleted: boolean
}

type Judul = {
  id: string
  name: string
  description: string | null
  sort_order: number
  level_id: string
  levels: {
    id: string
    name: string
    course_id: string
    courses: {
      name: string
      color: string | null
    }
  }
  materials: Material[]
}

type Props = {
  studentName: string
  studentId: string
  juduls: Judul[]
}

export default function MateriContent({ studentName, studentId, juduls }: Props) {
  const supabase = createClient()
  const [completedMaterials, setCompletedMaterials] = useState<Set<string>>(
    new Set(
      juduls.flatMap(j => j.materials.filter(m => m.isCompleted).map(m => m.id))
    )
  )
  const [expandedMaterial, setExpandedMaterial] = useState<string | null>(null)

  async function toggleComplete(materialId: string, currentlyCompleted: boolean) {
    if (currentlyCompleted) {
      const { error } = await supabase
        .from('materi_progress')
        .delete()
        .eq('student_id', studentId)
        .eq('material_id', materialId)

      if (!error) {
        setCompletedMaterials(prev => {
          const next = new Set(prev)
          next.delete(materialId)
          return next
        })
      }
    } else {
      const { error } = await supabase
        .from('materi_progress')
        .insert({
          student_id: studentId,
          material_id: materialId,
          completed_at: new Date().toISOString(),
        })

      if (!error) {
        setCompletedMaterials(prev => new Set(prev).add(materialId))
      }
    }
  }

  function handleOpenLink(url: string) {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  function toggleExpand(materialId: string) {
    setExpandedMaterial(prev => prev === materialId ? null : materialId)
  }

  if (juduls.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-black text-[#1A1640] mb-2">
            Materi Pembelajaran
          </h1>
          <p className="text-sm text-[#7B78A8] mb-6">{studentName}</p>

          <div className="bg-white rounded-2xl border border-[#E5E3FF] p-8 text-center">
            <BookOpen size={48} className="mx-auto text-[#C4BFFF] mb-4" />
            <h2 className="text-lg font-bold text-[#1A1640] mb-2">
              Belum Ada Materi
            </h2>
            <p className="text-sm text-[#7B78A8]">
              Materi pembelajaran untuk level yang kamu ikuti belum tersedia.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const groupedByCourse = juduls.reduce((acc, judul) => {
    const courseName = judul.levels.courses.name
    if (!acc[courseName]) {
      acc[courseName] = {
        color: judul.levels.courses.color,
        juduls: []
      }
    }
    acc[courseName].juduls.push(judul)
    return acc
  }, {} as Record<string, { color: string | null, juduls: Judul[] }>)

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-black text-[#1A1640] mb-2">
          Materi Pembelajaran
        </h1>
        <p className="text-sm text-[#7B78A8] mb-6">{studentName}</p>

        <div className="space-y-6">
          {Object.entries(groupedByCourse).map(([courseName, { color, juduls: courseJuduls }]) => (
            <div key={courseName}>
              <div
                className="mb-4 px-4 py-3 rounded-xl"
                style={{
                  backgroundColor: color ? `${color}15` : '#F7F6FF',
                  borderLeft: `4px solid ${color || '#5C4FE5'}`
                }}
              >
                <h2
                  className="font-bold text-lg"
                  style={{ color: color || '#5C4FE5' }}
                >
                  {courseName}
                </h2>
              </div>

              <div className="space-y-4">
                {courseJuduls.map((judul) => {
                  const totalMaterials = judul.materials.length
                  const completedCount = judul.materials.filter(m =>
                    completedMaterials.has(m.id)
                  ).length

                  return (
                    <div
                      key={judul.id}
                      className="bg-white rounded-2xl border-2 border-[#E5E3FF] overflow-hidden"
                    >
                      <div className="px-4 py-3 bg-[#F7F6FF] border-b-2 border-[#E5E3FF]">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-bold text-sm text-[#1A1640]">
                              {judul.name}
                            </h3>
                            {judul.description && (
                              <p className="text-xs text-[#7B78A8] mt-0.5">
                                {judul.description}
                              </p>
                            )}
                            <p className="text-[10px] text-[#7B78A8] mt-1">
                              Level: {judul.levels.name}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-bold text-[#5C4FE5]">
                              {completedCount}/{totalMaterials}
                            </p>
                            <p className="text-[10px] text-[#7B78A8]">
                              Selesai
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 space-y-2">
                        {judul.materials.length === 0 ? (
                          <p className="text-xs text-[#7B78A8] text-center py-4">
                            Belum ada materi untuk topik ini
                          </p>
                        ) : (
                          judul.materials.map((material) => {
                            const isCompleted = completedMaterials.has(material.id)
                            const isExpanded = expandedMaterial === material.id

                            return (
                              <div key={material.id} className="space-y-2">
                                <div
                                  className={`flex items-start gap-3 p-3 rounded-xl border-2 transition-all ${
                                    isCompleted
                                      ? 'border-green-200 bg-green-50'
                                      : 'border-[#E5E3FF] bg-white hover:border-[#C4BFFF]'
                                  }`}
                                >
                                  <button
                                    onClick={() => toggleComplete(material.id, isCompleted)}
                                    className="flex-shrink-0 mt-0.5"
                                  >
                                    {isCompleted ? (
                                      <CheckCircle size={20} className="text-green-600" />
                                    ) : (
                                      <Circle size={20} className="text-[#C4BFFF]" />
                                    )}
                                  </button>

                                  <div className="flex-1 min-w-0">
                                    <h4
                                      className={`text-sm font-bold ${
                                        isCompleted ? 'text-green-800' : 'text-[#1A1640]'
                                      }`}
                                    >
                                      {material.title}
                                    </h4>
                                    {material.lesson_name && (
                                      <p
                                        className={`text-xs mt-0.5 ${
                                          isCompleted ? 'text-green-700' : 'text-[#7B78A8]'
                                        }`}
                                      >
                                        {material.lesson_name}
                                      </p>
                                    )}
                                    {material.category && (
                                      <span className="inline-block text-[10px] px-2 py-0.5 bg-[#E5E3FF] text-[#5C4FE5] rounded-full mt-1 font-semibold">
                                        {material.category}
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex gap-2">
                                    {material.component_id && (
                                      <button
                                        onClick={() => toggleExpand(material.id)}
                                        className={`flex-shrink-0 p-2 rounded-lg transition-colors ${
                                          isExpanded
                                            ? 'bg-[#5C4FE5] text-white'
                                            : isCompleted
                                            ? 'bg-green-100 hover:bg-green-200 text-green-700'
                                            : 'bg-[#F7F6FF] hover:bg-[#EEEDFE] text-[#5C4FE5]'
                                        }`}
                                        title={isExpanded ? 'Tutup' : 'Baca Materi'}
                                      >
                                        {isExpanded ? (
                                          <Minimize2 size={16} />
                                        ) : (
                                          <Maximize2 size={16} />
                                        )}
                                      </button>
                                    )}

                                    {material.gdrive_url && (
                                      <button
                                        onClick={() => handleOpenLink(material.gdrive_url!)}
                                        className={`flex-shrink-0 p-2 rounded-lg transition-colors ${
                                          isCompleted
                                            ? 'bg-green-100 hover:bg-green-200 text-green-700'
                                            : 'bg-[#F7F6FF] hover:bg-[#EEEDFE] text-[#5C4FE5]'
                                        }`}
                                        title="Buka di Google Drive"
                                      >
                                        <ExternalLink size={16} />
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {/* Inline Component Renderer */}
                                {isExpanded && material.component_id && (
                                  <div className="rounded-xl border-2 border-[#C4BFFF] overflow-hidden bg-white">
                                    <iframe
                                      src={`/ortu/materi/render/${material.component_id}`}
                                      className="w-full"
                                      style={{ height: '100vh', minHeight: '600px' }}
                                      title={material.title}
                                      sandbox="allow-scripts allow-same-origin"
                                    />
                                  </div>
                                )}
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
