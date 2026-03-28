'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BookOpen, FileText, CheckCircle, Circle, Download, ExternalLink } from 'lucide-react'

type Material = {
  id: string
  title: string
  description: string | null
  file_url: string | null
  file_type: string | null
  created_at: string
  isCompleted: boolean
}

type Judul = {
  id: string
  title: string
  description: string | null
  level_id: string
  sort_order: number
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
  materials: Judul[]
}

export default function MateriContent({ studentName, studentId, materials }: Props) {
  const supabase = createClient()
  const [completedMaterials, setCompletedMaterials] = useState<Set<string>>(
    new Set(
      materials.flatMap(j => j.materials.filter(m => m.isCompleted).map(m => m.id))
    )
  )

  async function toggleComplete(materialId: string, currentlyCompleted: boolean) {
    if (currentlyCompleted) {
      // Remove completion
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
      // Mark as complete
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

  async function handleDownload(fileUrl: string, title: string) {
    try {
      const { data } = await supabase.functions.invoke('get-signed-url', {
        body: { file_url: fileUrl }
      })

      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank')
      }
    } catch (error) {
      console.error('Download error:', error)
    }
  }

  if (materials.length === 0) {
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

  // Group by course
  const groupedByCourse = materials.reduce((acc, judul) => {
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
          {Object.entries(groupedByCourse).map(([courseName, { color, juduls }]) => (
            <div key={courseName}>
              {/* Course Header */}
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

              {/* Juduls */}
              <div className="space-y-4">
                {juduls.map((judul) => {
                  const totalMaterials = judul.materials.length
                  const completedCount = judul.materials.filter(m =>
                    completedMaterials.has(m.id)
                  ).length

                  return (
                    <div
                      key={judul.id}
                      className="bg-white rounded-2xl border-2 border-[#E5E3FF] overflow-hidden"
                    >
                      {/* Judul Header */}
                      <div className="px-4 py-3 bg-[#F7F6FF] border-b-2 border-[#E5E3FF]">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-bold text-sm text-[#1A1640]">
                              {judul.title}
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

                      {/* Materials */}
                      <div className="p-4 space-y-2">
                        {judul.materials.length === 0 ? (
                          <p className="text-xs text-[#7B78A8] text-center py-4">
                            Belum ada materi untuk topik ini
                          </p>
                        ) : (
                          judul.materials.map((material) => {
                            const isCompleted = completedMaterials.has(material.id)

                            return (
                              <div
                                key={material.id}
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
                                  {material.description && (
                                    <p
                                      className={`text-xs mt-0.5 ${
                                        isCompleted ? 'text-green-700' : 'text-[#7B78A8]'
                                      }`}
                                    >
                                      {material.description}
                                    </p>
                                  )}
                                  {material.file_type && (
                                    <p className="text-[10px] text-[#7B78A8] mt-1">
                                      {material.file_type.toUpperCase()}
                                    </p>
                                  )}
                                </div>

                                {material.file_url && (
                                  <button
                                    onClick={() => handleDownload(material.file_url!, material.title)}
                                    className={`flex-shrink-0 p-2 rounded-lg transition-colors ${
                                      isCompleted
                                        ? 'bg-green-100 hover:bg-green-200 text-green-700'
                                        : 'bg-[#F7F6FF] hover:bg-[#EEEDFE] text-[#5C4FE5]'
                                    }`}
                                    title="Download"
                                  >
                                    <Download size={16} />
                                  </button>
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
