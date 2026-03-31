'use client'

import { useState, useEffect } from 'react'
import { BookOpen, Video, FileText, Headphones, ChevronDown, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

type Material = {
  id: string
  title: string
  category: string
  gdrive_url: string | null
  component_id: string | null
  completed: boolean
  lesson_title: string
  unit_name: string
}

type Unit = {
  id: string
  name: string
  chapter_title: string | null
  sort_order: number
  materials: Material[]
}

type LevelData = {
  level_id: string
  level_name: string
  course_name: string
  units: Unit[]
}

type MateriContentProps = {
  levelsData: LevelData[]
  studentName: string
  studentId: string
}

export default function MateriContent({ levelsData, studentName, studentId }: MateriContentProps) {
  const [selectedLevelId, setSelectedLevelId] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'live_zoom' | 'bacaan' | 'kosakata' | 'cefr'>('live_zoom')

  // Initialize with first level or load from localStorage
  useEffect(() => {
    const storedLevelId = localStorage.getItem('selected_level_id')
    if (storedLevelId && levelsData.some(l => l.level_id === storedLevelId)) {
      setSelectedLevelId(storedLevelId)
    } else if (levelsData.length > 0) {
      setSelectedLevelId(levelsData[0].level_id)
    }
  }, [levelsData])

  // Save selected level to localStorage
  useEffect(() => {
    if (selectedLevelId) {
      localStorage.setItem('selected_level_id', selectedLevelId)
    }
  }, [selectedLevelId])

  const selectedLevel = levelsData.find(l => l.level_id === selectedLevelId)

  if (!selectedLevel) {
    return (
      <div className="p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white border-2 border-[#E5E3FF] rounded-xl p-8 text-center">
            <p className="text-lg text-gray-600">
              Tidak ada level yang tersedia.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Get materials for selected tab
  const filteredMaterials = selectedLevel.units
    .flatMap(unit => 
      unit.materials
        .filter(m => m.category === activeTab)
        .map(m => ({ ...m, chapter_title: unit.chapter_title, unit_name: unit.name }))
    )

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'live_zoom':
        return <Video className="w-5 h-5" />
      case 'bacaan':
        return <BookOpen className="w-5 h-5" />
      case 'kosakata':
        return <FileText className="w-5 h-5" />
      case 'cefr':
        return <Headphones className="w-5 h-5" />
      default:
        return <Video className="w-5 h-5" />
    }
  }

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'live_zoom':
        return 'Live Zoom'
      case 'bacaan':
        return 'Bacaan'
      case 'kosakata':
        return 'Kosakata'
      case 'cefr':
        return 'CEFR'
      default:
        return category
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header with Level Selector */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Materi Pembelajaran</h1>
        <p className="text-gray-600 mb-4">{selectedLevel.course_name}</p>
        
        {/* Level Selector Dropdown */}
        {levelsData.length > 1 && (
          <div className="relative inline-block w-full max-w-md">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Pilih Level:
            </label>
            <div className="relative">
              <select
                value={selectedLevelId}
                onChange={(e) => setSelectedLevelId(e.target.value)}
                className="w-full appearance-none bg-white border-2 border-[#E5E3FF] rounded-xl px-4 py-3 pr-10 text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-[#5C4FE5] focus:border-transparent transition-all cursor-pointer hover:border-[#5C4FE5]"
              >
                {levelsData.map(level => (
                  <option key={level.level_id} value={level.level_id}>
                    Level {level.level_name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            </div>
          </div>
        )}

        {/* Single level display (no dropdown needed) */}
        {levelsData.length === 1 && (
          <div className="inline-block bg-gradient-to-r from-[#5C4FE5] to-[#7C6FE5] text-white px-6 py-3 rounded-xl font-semibold shadow-lg">
            Level {selectedLevel.level_name}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {(['live_zoom', 'bacaan', 'kosakata', 'cefr'] as const).map((tab) => {
          const count = selectedLevel.units.flatMap(u => u.materials).filter(m => m.category === tab).length
          const isActive = activeTab === tab

          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-gradient-to-r from-[#5C4FE5] to-[#7C6FE5] text-white shadow-lg'
                  : 'bg-white border-2 border-[#E5E3FF] text-gray-700 hover:border-[#5C4FE5]'
              }`}
            >
              {getCategoryIcon(tab)}
              {getCategoryLabel(tab)}
              {count > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  isActive ? 'bg-white/20' : 'bg-[#5C4FE5]/10 text-[#5C4FE5]'
                }`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Materials List */}
      {filteredMaterials.length === 0 ? (
        <div className="bg-white border-2 border-[#E5E3FF] rounded-xl p-12 text-center">
          <div className="w-20 h-20 mx-auto mb-4 text-gray-300">
            {getCategoryIcon(activeTab)}
          </div>
          <p className="text-lg text-gray-600">
            Belum ada materi {getCategoryLabel(activeTab)} untuk level ini.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Group by Chapter → Unit */}
          {(() => {
            const grouped = new Map<string, Map<string, Material[]>>()
            
            filteredMaterials.forEach(material => {
              const chapterKey = material.chapter_title || 'Tanpa Chapter'
              const unitKey = material.unit_name
              
              if (!grouped.has(chapterKey)) {
                grouped.set(chapterKey, new Map())
              }
              
              const chapterMap = grouped.get(chapterKey)!
              if (!chapterMap.has(unitKey)) {
                chapterMap.set(unitKey, [])
              }
              
              chapterMap.get(unitKey)!.push(material)
            })

            return Array.from(grouped.entries()).map(([chapterTitle, units]) => (
              <div key={chapterTitle} className="bg-white border-2 border-[#E5E3FF] rounded-xl overflow-hidden">
                {/* Chapter Header */}
                <div className="bg-gradient-to-r from-[#5C4FE5] to-[#7C6FE5] px-6 py-4">
                  <h2 className="text-xl font-bold text-white">{chapterTitle}</h2>
                </div>

                {/* Units */}
                {Array.from(units.entries()).map(([unitName, materials]) => (
                  <div key={unitName} className="border-t-2 border-[#E5E3FF]">
                    {/* Unit Header */}
                    <div className="bg-[#F7F6FF] px-6 py-3 border-b border-[#E5E3FF]">
                      <h3 className="font-semibold text-gray-900">{unitName}</h3>
                    </div>

                    {/* Materials */}
                    <div className="divide-y divide-[#E5E3FF]">
                      {materials.map((material) => {
                        const isClickable = material.gdrive_url || material.component_id

                        return (
                          <div
                            key={material.id}
                            className={`px-6 py-4 flex items-center justify-between ${
                              isClickable ? 'hover:bg-[#F7F6FF] transition-colors' : ''
                            }`}
                          >
                            <div className="flex items-center gap-3 flex-1">
                              <div className="text-[#5C4FE5]">
                                {getCategoryIcon(material.category)}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">{material.title}</p>
                                <p className="text-sm text-gray-500">{material.lesson_title}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              {material.completed && (
                                <CheckCircle2 className="w-5 h-5 text-green-500" />
                              )}
                              
                              {isClickable && (
                                material.gdrive_url ? (
                                  <a
                                    href={material.gdrive_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-4 py-2 bg-[#5C4FE5] text-white rounded-lg font-semibold hover:bg-[#4a3ec7] transition-colors"
                                  >
                                    Buka
                                  </a>
                                ) : material.component_id ? (
                                  <Link
                                    href={`/ortu/anak/${studentId}/materi/render/${material.component_id}`}
                                    className="px-4 py-2 bg-[#5C4FE5] text-white rounded-lg font-semibold hover:bg-[#4a3ec7] transition-colors"
                                  >
                                    Buka
                                  </Link>
                                ) : null
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ))
          })()}
        </div>
      )}
    </div>
  )
}
