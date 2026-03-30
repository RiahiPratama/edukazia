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
    <div className="min-h-screen bg-gradient-to-br from-[#F7F6FF] via-[#FEFBFF] to-[#F7F6FF]">
      {/* Premium Header */}
      <div className="bg-gradient-to-r from-[#5C4FE5] via-[#6B5FF5] to-[#7A6FFF] text-white shadow-lg">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Materi Pembelajaran</h1>
              <p className="text-sm opacity-90 mt-1 font-medium">{studentName}</p>
            </div>
            <div className="hidden md:flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full">
              <div className="w-2 h-2 rounded-full bg-[#E6B800] animate-pulse"></div>
              <span className="text-xs font-medium">Level {levelName}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Premium Tabs */}
      <div className="bg-white border-b border-[#E5E3FF] shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex gap-1 overflow-x-auto scrollbar-hide -mb-px">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 px-6 py-4 text-sm font-semibold transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'text-[#5C4FE5]'
                    : 'text-[#7B78A8] hover:text-[#5C4FE5] hover:bg-[#F7F6FF]'
                }`}
              >
                <span className="text-lg">{tab.icon}</span>
                <span>{tab.label}</span>
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-[#5C4FE5] to-[#7A6FFF] rounded-t-full shadow-lg shadow-[#5C4FE5]/30"></div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Premium Ayo Belajar Card */}
        {nextMaterial && (
          <div className="bg-gradient-to-br from-[#5C4FE5] via-[#6B5FF5] to-[#7A6FFF] rounded-2xl p-6 mb-8 shadow-2xl shadow-[#5C4FE5]/20 border border-white/20">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center text-2xl">
                🔥
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white/80 text-xs font-bold uppercase tracking-wider mb-2">Ayo Belajar</p>
                <h3 className="text-white text-xl font-bold mb-3 leading-tight">{nextMaterial.title}</h3>
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  <span className="bg-white/20 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-full font-semibold border border-white/30">
                    {levelName}
                  </span>
                  <span className="text-white/60">•</span>
                  <span className="text-white/90 text-xs font-medium">{nextMaterial.unit_name}</span>
                </div>
                {(nextMaterial.category === 'live_zoom' || nextMaterial.category === 'kosakata') ? (
                  <a
                    href={nextMaterial.gdrive_url || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-white text-[#5C4FE5] px-6 py-3 rounded-xl font-bold hover:bg-white/90 hover:shadow-xl transition-all group"
                  >
                    <span>Mulai Belajar</span>
                    <span className="text-lg group-hover:translate-x-1 transition-transform">→</span>
                  </a>
                ) : (
                  <Link
                    href={`/ortu/materi/render/${nextMaterial.component_id}`}
                    className="inline-flex items-center gap-2 bg-white text-[#5C4FE5] px-6 py-3 rounded-xl font-bold hover:bg-white/90 hover:shadow-xl transition-all group"
                  >
                    <span>Mulai Belajar</span>
                    <span className="text-lg group-hover:translate-x-1 transition-transform">→</span>
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Course Section with Premium Units */}
        {filteredJuduls.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-[#E5E3FF]">
            <div className="text-6xl mb-4 opacity-50">📚</div>
            <p className="text-[#7B78A8] text-lg font-medium">
              Belum ada materi {TABS.find(t => t.id === activeTab)?.label} untuk level ini.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Course Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-[#1A1640] flex items-center gap-2">
                  <span className="text-2xl">🎓</span>
                  {courseName}
                </h2>
                <p className="text-sm text-[#7B78A8] mt-1 font-medium">Level: {levelName}</p>
              </div>
              <div className="bg-[#F7F6FF] border border-[#E5E3FF] px-4 py-2 rounded-full">
                <p className="text-xs font-semibold text-[#5C4FE5]">
                  {filteredJuduls.length} {filteredJuduls.length === 1 ? 'unit' : 'units'}
                </p>
              </div>
            </div>

            {/* Premium Units List */}
            <div className="space-y-4">
              {filteredJuduls.map((judul, idx) => {
                const isExpanded = expandedUnits.has(judul.id)
                const completedCount = judul.materials.filter(m => m.completed).length
                const totalCount = judul.materials.length

                return (
                  <div
                    key={judul.id}
                    className="bg-white rounded-2xl shadow-sm border border-[#E5E3FF] overflow-hidden hover:shadow-lg hover:border-[#C4BFFF] transition-all"
                  >
                    {/* Unit Header */}
                    <button
                      onClick={() => toggleUnit(judul.id)}
                      className="w-full px-6 py-5 flex items-center justify-between hover:bg-[#F7F6FF] transition-colors group"
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm transition-all ${
                          isExpanded 
                            ? 'bg-gradient-to-br from-[#5C4FE5] to-[#7A6FFF] text-white shadow-lg shadow-[#5C4FE5]/30' 
                            : 'bg-[#F7F6FF] text-[#5C4FE5] group-hover:bg-[#EEEDFE]'
                        }`}>
                          {String(idx + 1).padStart(2, '0')}
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <h3 className="font-bold text-[#1A1640] text-base mb-1 truncate">{judul.name}</h3>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1.5">
                              <div className="w-full max-w-[120px] h-1.5 bg-[#F7F6FF] rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-gradient-to-r from-[#27A05A] to-[#34C76D] rounded-full transition-all"
                                  style={{ width: `${(completedCount / totalCount) * 100}%` }}
                                ></div>
                              </div>
                              <span className="text-xs font-semibold text-[#7B78A8]">
                                {completedCount}/{totalCount}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className={`text-[#5C4FE5] transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                        </svg>
                      </div>
                    </button>

                    {/* Premium Materials List */}
                    {isExpanded && (
                      <div className="px-6 pb-6 space-y-2 animate-in slide-in-from-top-2 duration-200">
                        {judul.materials.map((material, matIdx) => {
                          const shouldOpenInNewTab = material.category === 'live_zoom' || material.category === 'kosakata'
                          const materialUrl = shouldOpenInNewTab 
                            ? (material.gdrive_url || '#')
                            : `/ortu/materi/render/${material.component_id}`

                          return (
                            <div
                              key={material.id}
                              className={`group flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                                material.completed
                                  ? 'bg-gradient-to-r from-[#E6F4EC] to-[#F0F8F4] border-[#9FE1CB]'
                                  : 'bg-white border-[#E5E3FF] hover:bg-gradient-to-r hover:from-[#F7F6FF] hover:to-[#FEFBFF] hover:border-[#5C4FE5] hover:shadow-md'
                              }`}
                            >
                              {/* Completion Status */}
                              <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-bold transition-all ${
                                material.completed
                                  ? 'bg-gradient-to-br from-[#27A05A] to-[#34C76D] text-white shadow-lg shadow-[#27A05A]/30'
                                  : 'bg-[#F7F6FF] text-[#C4BFFF] border-2 border-[#E5E3FF] group-hover:border-[#5C4FE5] group-hover:text-[#5C4FE5]'
                              }`}>
                                {material.completed ? (
                                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                    <path d="M13.485 3.515a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.414L5.778 10.07l6.293-6.293a1 1 0 011.414 0z"/>
                                  </svg>
                                ) : (
                                  <span className="text-xs">{String(matIdx + 1).padStart(2, '0')}</span>
                                )}
                              </div>

                              {/* Material Info */}
                              <div className="flex-1 min-w-0">
                                <p className={`font-semibold truncate transition-colors ${
                                  material.completed 
                                    ? 'text-[#1A5C36] dark:text-[#34C76D]' 
                                    : 'text-[#1A1640] dark:text-white group-hover:text-[#5C4FE5] dark:group-hover:text-[#7A6FFF]'
                                }`}>
                                  {material.title}
                                </p>
                              </div>

                              {/* Premium Action Button */}
                              {shouldOpenInNewTab ? (
                                <a
                                  href={materialUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`flex-shrink-0 px-5 py-2.5 text-sm font-bold rounded-lg transition-all ${
                                    material.completed
                                      ? 'bg-white border-2 border-[#27A05A] text-[#27A05A] hover:bg-[#E6F4EC] hover:shadow-md'
                                      : 'bg-gradient-to-r from-[#5C4FE5] to-[#7A6FFF] text-white hover:shadow-lg hover:shadow-[#5C4FE5]/30 hover:-translate-y-0.5'
                                  }`}
                                >
                                  {material.completed ? 'Buka' : 'Mulai'}
                                </a>
                              ) : (
                                <Link
                                  href={materialUrl}
                                  className={`flex-shrink-0 px-5 py-2.5 text-sm font-bold rounded-lg transition-all ${
                                    material.completed
                                      ? 'bg-white border-2 border-[#27A05A] text-[#27A05A] hover:bg-[#E6F4EC] hover:shadow-md'
                                      : 'bg-gradient-to-r from-[#5C4FE5] to-[#7A6FFF] text-white hover:shadow-lg hover:shadow-[#5C4FE5]/30 hover:-translate-y-0.5'
                                  }`}
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
