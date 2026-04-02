'use client'

import { useState, useEffect } from 'react'
import { BookOpen, Video, FileText, Headphones, ChevronDown, ChevronRight, CheckCircle2, X, Loader2, ExternalLink } from 'lucide-react'
import Link from 'next/link'

type Material = {
  id: string
  title: string
  category: string
  gdrive_url: string | null
  component_id: string | null
  pdf_storage_path: string | null
  slides_url: string | null
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
  studentSlug: string
}

export default function MateriContent({ levelsData, studentName, studentSlug }: MateriContentProps) {
  const [selectedLevelId, setSelectedLevelId] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'live_zoom' | 'bacaan' | 'kosakata' | 'cefr'>('live_zoom')
  const [openChapters, setOpenChapters] = useState<Set<string>>(new Set())
  const [openUnits, setOpenUnits] = useState<Set<string>>(new Set())

  // ✅ PDF Modal state
  const [pdfModal, setPdfModal] = useState<{
    open: boolean
    url: string
    title: string
    loading: boolean
  }>({ open: false, url: '', title: '', loading: false })

  // ✅ Google embed modal
  const [embedModal, setEmbedModal] = useState<{
    open: boolean;
    url: string;
    title: string;
    loading: boolean;
  }>({ open: false, url: '', title: '', loading: false })

  // Initialize with first level
  useEffect(() => {
    if (levelsData.length > 0 && !selectedLevelId) {
      setSelectedLevelId(levelsData[0].level_id)
      // Open all chapters by default
      const allChapters = new Set<string>()
      levelsData[0].units.forEach(u => {
        if (u.chapter_title) allChapters.add(u.chapter_title)
      })
      setOpenChapters(allChapters)
    }
  }, [levelsData, selectedLevelId])

  const selectedLevel = levelsData.find(l => l.level_id === selectedLevelId)

  if (!selectedLevel) {
    return (
      <div className="p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white border-2 border-[#E5E3FF] rounded-xl p-8 text-center">
            <p className="text-lg text-gray-600">Tidak ada level yang tersedia.</p>
          </div>
        </div>
      </div>
    )
  }

  const toggleChapter = (chapterTitle: string) => {
    const newOpen = new Set(openChapters)
    if (newOpen.has(chapterTitle)) {
      newOpen.delete(chapterTitle)
    } else {
      newOpen.add(chapterTitle)
    }
    setOpenChapters(newOpen)
  }

  const toggleUnit = (unitId: string) => {
    const newOpen = new Set(openUnits)
    if (newOpen.has(unitId)) {
      newOpen.delete(unitId)
    } else {
      newOpen.add(unitId)
    }
    setOpenUnits(newOpen)
  }

  // ✅ Detect Google URL
  const isGoogleUrl = (url: string | null) => {
    if (!url) return false;
    return url.includes('docs.google.com') || url.includes('drive.google.com')
  }

  // ✅ Buka PDF via signed URL
  const openPDF = async (pdfStoragePath: string, title: string) => {
    setPdfModal({ open: true, url: '', title, loading: true })
    try {
      const res = await fetch('/api/materials/pdf-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storage_path: pdfStoragePath }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPdfModal({ open: true, url: data.signed_url, title, loading: false })
    } catch (err) {
      alert(`❌ Gagal membuka PDF`)
      setPdfModal({ open: false, url: '', title: '', loading: false })
    }
  }

  // ✅ Buka Google file via enrollment gate
  const openGoogleEmbed = async (materialId: string, title: string) => {
    setEmbedModal({ open: true, url: '', title, loading: true })
    try {
      const res = await fetch('/api/google/embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ materialId, studentSlug }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setEmbedModal({ open: true, url: data.embedUrl, title, loading: false })
    } catch (err) {
      alert(`❌ Gagal membuka materi: ${err instanceof Error ? err.message : 'Unknown error'}`)
      setEmbedModal({ open: false, url: '', title: '', loading: false })
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'live_zoom': return <Video className="w-4 h-4" />
      case 'bacaan': return <BookOpen className="w-4 h-4" />
      case 'kosakata': return <FileText className="w-4 h-4" />
      case 'cefr': return <Headphones className="w-4 h-4" />
      default: return <Video className="w-4 h-4" />
    }
  }

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'live_zoom': return 'Live Zoom'
      case 'bacaan': return 'Bacaan'
      case 'kosakata': return 'Kosakata'
      case 'cefr': return 'CEFR'
      default: return category
    }
  }

  // Group materials by lesson
  const groupByLesson = (materials: Material[]) => {
    const grouped = new Map<string, Material[]>()
    materials.forEach(m => {
      const key = m.lesson_title
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(m)
    })
    return grouped
  }

  // Group units by chapter
  const groupByChapter = (units: Unit[]) => {
    const grouped = new Map<string, Unit[]>()
    units.forEach(u => {
      const key = u.chapter_title || 'Tanpa Chapter'
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(u)
    })
    return grouped
  }

  const filteredUnits = selectedLevel.units.map(unit => ({
    ...unit,
    materials: unit.materials.filter(m => m.category === activeTab)
  })).filter(u => u.materials.length > 0)

  const chapterGroups = groupByChapter(filteredUnits)

  return (
    <>
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Materi Pembelajaran</h1>
        <p className="text-gray-600 mb-4">{selectedLevel.course_name}</p>
        
        {/* Level Badge */}
        {levelsData.length > 1 ? (
          <div className="relative inline-block w-full max-w-md">
            <label className="block text-sm font-medium text-gray-700 mb-2">Pilih Level:</label>
            <div className="relative">
              <select
                value={selectedLevelId}
                onChange={(e) => setSelectedLevelId(e.target.value)}
                className="w-full appearance-none bg-white border-2 border-[#E5E3FF] rounded-xl px-4 py-3 pr-10 text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-[#5C4FE5] focus:border-transparent transition-all cursor-pointer hover:border-[#5C4FE5]"
              >
                {levelsData.map(level => (
                  <option key={level.level_id} value={level.level_id}>Level {level.level_name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            </div>
          </div>
        ) : (
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
                }`}>{count}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Materials List */}
      {chapterGroups.size === 0 ? (
        <div className="bg-white border-2 border-[#E5E3FF] rounded-xl p-12 text-center">
          <div className="w-20 h-20 mx-auto mb-4 text-gray-300">{getCategoryIcon(activeTab)}</div>
          <p className="text-lg text-gray-600">Belum ada materi {getCategoryLabel(activeTab)} untuk level ini.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Array.from(chapterGroups.entries()).map(([chapterTitle, units]) => {
            const isChapterOpen = openChapters.has(chapterTitle)
            return (
              <div key={chapterTitle} className="bg-white border-2 border-[#E5E3FF] rounded-xl overflow-hidden">
                {/* Chapter Header (Collapsible) */}
                <button
                  onClick={() => toggleChapter(chapterTitle)}
                  className="w-full bg-gradient-to-r from-[#5C4FE5] to-[#7C6FE5] px-6 py-4 flex items-center justify-between hover:from-[#4a3ec7] hover:to-[#6a5ed5] transition-colors"
                >
                  <h2 className="text-xl font-bold text-white">{chapterTitle}</h2>
                  {isChapterOpen ? (
                    <ChevronDown className="w-6 h-6 text-white" />
                  ) : (
                    <ChevronRight className="w-6 h-6 text-white" />
                  )}
                </button>

                {/* Units (shown when chapter is open) */}
                {isChapterOpen && (
                  <div className="divide-y divide-[#E5E3FF]">
                    {units.map(unit => {
                      const isUnitOpen = openUnits.has(unit.id)
                      const lessonGroups = groupByLesson(unit.materials)
                      return (
                        <div key={unit.id}>
                          {/* Unit Header (Collapsible) */}
                          <button
                            onClick={() => toggleUnit(unit.id)}
                            className="w-full bg-[#F7F6FF] px-6 py-3 flex items-center justify-between hover:bg-[#eeedf8] transition-colors"
                          >
                            <h3 className="font-semibold text-gray-900">{unit.name}</h3>
                            {isUnitOpen ? (
                              <ChevronDown className="w-5 h-5 text-gray-600" />
                            ) : (
                              <ChevronRight className="w-5 h-5 text-gray-600" />
                            )}
                          </button>

                          {/* Lessons (shown when unit is open) */}
                          {isUnitOpen && (
                            <div className="bg-white">
                              {Array.from(lessonGroups.entries()).map(([lessonTitle, materials]) => (
                                <div key={lessonTitle} className="px-6 py-4 border-b border-[#E5E3FF] last:border-b-0">
                                  <p className="font-medium text-gray-900 mb-3">{lessonTitle}</p>
                                  <div className="flex flex-wrap gap-2 pl-4">
                                    {materials.map(material => {
                                      const isClickable = material.pdf_storage_path || material.gdrive_url || material.component_id
                                      return (
                                        <div key={material.id} className="flex items-center gap-2">
                                          {material.completed && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                                          {isClickable ? (
                                            material.pdf_storage_path ? (
                                              // ✅ PDF tersedia → buka PDF viewer
                                              <button
                                                onClick={() => openPDF(material.pdf_storage_path!, material.title)}
                                                className="flex items-center gap-2 px-4 py-2 bg-[#5C4FE5] text-white rounded-lg font-semibold hover:bg-[#4a3ec7] transition-colors text-sm"
                                              >
                                                {getCategoryIcon(material.category)}
                                                {getCategoryLabel(material.category)}
                                              </button>
                                            ) : material.gdrive_url ? (
                                              isGoogleUrl(material.gdrive_url) ? (
                                                // ✅ Google URL → buka via enrollment gate
                                                <button
                                                  onClick={() => openGoogleEmbed(material.id, material.title)}
                                                  className="flex items-center gap-2 px-4 py-2 bg-[#5C4FE5] text-white rounded-lg font-semibold hover:bg-[#4a3ec7] transition-colors text-sm"
                                                >
                                                  {getCategoryIcon(material.category)}
                                                  {getCategoryLabel(material.category)}
                                                </button>
                                              ) : (
                                                // Non-Google URL (Canva, dll) → buka tab baru
                                                <a
                                                  href={material.gdrive_url}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="flex items-center gap-2 px-4 py-2 bg-[#5C4FE5] text-white rounded-lg font-semibold hover:bg-[#4a3ec7] transition-colors text-sm"
                                                >
                                                  {getCategoryIcon(material.category)}
                                                  {getCategoryLabel(material.category)}
                                                </a>
                                              )
                                            ) : material.component_id ? (
                                              <Link
                                                href={`/ortu/anak/${studentSlug}/materi/render/${material.component_id}`}
                                                className="flex items-center gap-2 px-4 py-2 bg-[#5C4FE5] text-white rounded-lg font-semibold hover:bg-[#4a3ec7] transition-colors text-sm"
                                              >
                                                {getCategoryIcon(material.category)}
                                                {getCategoryLabel(material.category)}
                                              </Link>
                                            ) : null
                                          ) : (
                                            <span className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-500 rounded-lg font-semibold text-sm">
                                              {getCategoryIcon(material.category)}
                                              {getCategoryLabel(material.category)}
                                            </span>
                                          )}
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
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
      )}
    </div>

    {/* ✅ PDF Modal */}
    {pdfModal.open && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900 truncate">{pdfModal.title}</h2>
            <button onClick={() => setPdfModal({ open: false, url: '', title: '', loading: false })}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-hidden rounded-b-2xl">
            {pdfModal.loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Loader2 className="w-10 h-10 animate-spin text-[#5C4FE5] mx-auto mb-3" />
                  <p className="text-gray-600 font-medium">Memuat PDF...</p>
                </div>
              </div>
            ) : (
              <iframe src={pdfModal.url} className="w-full h-full border-0" title={pdfModal.title} />
            )}
          </div>
        </div>
      </div>
    )}

    {/* ✅ Google Embed Modal */}
    {embedModal.open && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col">
          {/* Modal Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900 truncate">{embedModal.title}</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEmbedModal({ open: false, url: '', title: '', loading: false })}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                title="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Modal Content */}
          <div className="flex-1 overflow-hidden rounded-b-2xl">
            {embedModal.loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Loader2 className="w-10 h-10 animate-spin text-[#5C4FE5] mx-auto mb-3" />
                  <p className="text-gray-600 font-medium">Memuat materi...</p>
                </div>
              </div>
            ) : (
              <iframe
                src={embedModal.url}
                className="w-full h-full border-0"
                allow="autoplay"
                title={embedModal.title}
              />
            )}
          </div>
        </div>
      </div>
    )}
    </>
  )
}
