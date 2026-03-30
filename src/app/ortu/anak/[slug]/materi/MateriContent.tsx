'use client'

import { useState } from 'react'
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

type Judul = {
  id: string
  name: string
  sort_order: number
  materials: Material[]
}

type Props = {
  juduls: Judul[]
  levelName: string
  courseName: string
  studentName: string
  studentId: string
}

type TabType = 'live_zoom' | 'bacaan' | 'kosakata' | 'cefr'

const TABS: { id: TabType; icon: string; label: string }[] = [
  { id: 'live_zoom', icon: '🎥', label: 'Live Zoom' },
  { id: 'bacaan', icon: '📚', label: 'Bacaan' },
  { id: 'kosakata', icon: '📝', label: 'Kosakata' },
  { id: 'cefr', icon: '🎧', label: 'CEFR' },
]

export default function MateriContent({ juduls, levelName, courseName, studentName, studentId }: Props) {
  const [activeTab, setActiveTab] = useState<TabType>('live_zoom')
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set())

  // Filter materials by active tab
  const filteredJuduls = juduls.map(judul => ({
    ...judul,
    materials: judul.materials.filter(m => m.category === activeTab)
  })).filter(judul => judul.materials.length > 0)

  // Get all materials for the active tab (across all units)
  const allMaterialsForTab = juduls.flatMap(j => j.materials.filter(m => m.category === activeTab))

  // Find next unfinished material for "Ayo Belajar" card
  const nextMaterial = allMaterialsForTab.find(m => !m.completed) || allMaterialsForTab[0]

  const toggleUnit = (unitId: string) => {
    setExpandedUnits(prev => {
      const next = new Set(prev)
      if (next.has(unitId)) {
        next.delete(unitId)
      } else {
        next.add(unitId)
      }
      return next
    })
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-[#5C4FE5] text-white p-4 text-center">
        <h1 className="text-lg font-medium">Materi Pembelajaran</h1>
        <p className="text-sm opacity-90 mt-1">{studentName}</p>
      </div>

      {/* Tabs */}
      <div className="bg-[#F7F6FF] border-b-2 border-[#E5E3FF] flex overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 min-w-[90px] py-3 px-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-white text-[#5C4FE5] border-b-3 border-[#5C4FE5]'
                : 'text-[#7B78A8] hover:bg-white/50'
            }`}
            style={activeTab === tab.id ? { borderBottomWidth: '3px' } : {}}
          >
            <span className="text-base mr-1">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4 max-w-2xl mx-auto">
        {/* Ayo Belajar Card */}
        {nextMaterial && (
          <div className="bg-gradient-to-br from-[#EEEDFE] to-[#F7F6FF] border-2 border-[#5C4FE5] rounded-xl p-4 mb-6">
            <p className="text-xs text-[#7B78A8] font-medium mb-2">🔥 Ayo Belajar</p>
            <p className="text-base font-medium text-[#1A1640] mb-2">{nextMaterial.title}</p>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs bg-white text-[#5C4FE5] px-2 py-1 rounded-full font-medium">
                {levelName}
              </span>
              <span className="text-xs text-[#7B78A8]">•</span>
              <span className="text-xs text-[#7B78A8]">{nextMaterial.unit_name}</span>
            </div>
            <Link
              href={getMaterialUrl(nextMaterial)}
              className="w-full flex items-center justify-center gap-2 bg-[#5C4FE5] text-white py-2.5 px-4 rounded-lg font-medium hover:bg-[#4A3FD4] transition-colors"
            >
              Mulai Belajar
              <span className="text-lg">→</span>
            </Link>
          </div>
        )}

        {/* Course Section with Units */}
        {filteredJuduls.length === 0 ? (
          <div className="bg-white border-2 border-[#E5E3FF] rounded-xl p-8 text-center">
            <p className="text-gray-600">
              Belum ada materi {TABS.find(t => t.id === activeTab)?.label} untuk level ini.
            </p>
          </div>
        ) : (
          <div>
            {/* Course Header */}
            <div className="mb-4">
              <div className="bg-[#EEEDFE] border-l-4 border-[#5C4FE5] py-3 px-4 rounded-lg">
                <h2 className="text-base font-medium text-[#5C4FE5]">{courseName}</h2>
                <p className="text-xs text-[#7B78A8] mt-1">Level: {levelName}</p>
              </div>
            </div>

            {/* Units List */}
            <div className="space-y-2">
              {filteredJuduls.map(judul => {
                const isExpanded = expandedUnits.has(judul.id)
                const completedCount = judul.materials.filter(m => m.completed).length
                const totalCount = judul.materials.length

                return (
                  <div key={judul.id} className="border-2 border-[#E5E3FF] rounded-lg overflow-hidden">
                    {/* Unit Header */}
                    <button
                      onClick={() => toggleUnit(judul.id)}
                      className="w-full flex items-center justify-between p-3 bg-[#F7F6FF] hover:bg-[#EEEDFE] transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[#1A1640]">
                          {isExpanded ? '▼' : '▶'} {judul.name}
                        </span>
                      </div>
                      <span className="text-xs text-[#7B78A8] bg-white px-2 py-1 rounded-full">
                        {completedCount}/{totalCount}
                      </span>
                    </button>

                    {/* Materials List */}
                    {isExpanded && (
                      <div className="p-3 space-y-2 bg-white">
                        {judul.materials.map(material => {
                          const shouldOpenInNewTab = material.category === 'live_zoom' || material.category === 'kosakata'
                          const materialUrl = shouldOpenInNewTab 
                            ? (material.gdrive_url || '#')
                            : `/ortu/materi/render/${material.component_id}`

                          return (
                            <div
                              key={material.id}
                              className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                                material.completed
                                  ? 'bg-[#E6F4EC] border-[#9FE1CB]'
                                  : 'bg-white border-[#E5E3FF] hover:bg-[#F7F6FF] hover:border-[#5C4FE5]'
                              }`}
                            >
                              {/* Completion Status */}
                              <div
                                className={`w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center ${
                                  material.completed
                                    ? 'bg-[#27A05A] text-white text-[10px] font-medium'
                                    : 'border-2 border-[#C4BFFF]'
                                }`}
                              >
                                {material.completed && '✓'}
                              </div>

                              {/* Material Info */}
                              <div className="flex-1 min-w-0">
                                <p
                                  className={`text-sm font-medium truncate ${
                                    material.completed ? 'text-[#1A5C36]' : 'text-[#1A1640]'
                                  }`}
                                >
                                  {material.title}
                                </p>
                              </div>

                              {/* Action Button */}
                              {shouldOpenInNewTab ? (
                                <a
                                  href={materialUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`px-3 py-1.5 text-xs font-medium rounded ${
                                    material.completed
                                      ? 'bg-white border border-[#27A05A] text-[#27A05A] hover:bg-[#E6F4EC]'
                                      : 'bg-[#5C4FE5] text-white hover:bg-[#4A3FD4]'
                                  } transition-colors`}
                                >
                                  {material.completed ? 'Buka' : 'Mulai'}
                                </a>
                              ) : (
                                <Link
                                  href={materialUrl}
                                  className={`px-3 py-1.5 text-xs font-medium rounded ${
                                    material.completed
                                      ? 'bg-white border border-[#27A05A] text-[#27A05A] hover:bg-[#E6F4EC]'
                                      : 'bg-[#5C4FE5] text-white hover:bg-[#4A3FD4]'
                                  } transition-colors`}
                                >
                                  {material.completed ? 'Buka' : 'Mulai'}
                                </Link>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
