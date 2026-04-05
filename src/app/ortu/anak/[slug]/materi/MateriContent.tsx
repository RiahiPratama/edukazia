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
  student_content_url: string | null
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
  const [activeTab, setActiveTab] = useState<'live_zoom' | 'bacaan' | 'kosakata' | 'cefr'>('live_zoom')
  const [openChapters, setOpenChapters] = useState<Set<string>>(new Set())
  const [openUnits, setOpenUnits] = useState<Set<string>>(new Set())

  // ✅ PDF/Slide Modal state
  const [pdfModal, setPdfModal] = useState<{
    open: boolean
    url: string
    title: string
    loading: boolean
    type: 'pdf' | 'slides' | 'google'
    slideUrls: string[]
  }>({ open: false, url: '', title: '', loading: false, type: 'google', slideUrls: [] })

  // ✅ Google embed modal
  const [embedModal, setEmbedModal] = useState<{
    open: boolean;
    url: string;
    title: string;
    loading: boolean;
  }>({ open: false, url: '', title: '', loading: false })

  // Buka semua chapter by default saat load
  useEffect(() => {
    if (levelsData.length > 0) {
      const allKeys = new Set<string>()
      levelsData.forEach(level => {
        level.units.forEach(u => {
          const key = `${level.level_name}-${u.chapter_title || 'Tanpa Chapter'}`
          allKeys.add(key)
        })
      })
      setOpenChapters(allKeys)
    }
  }, [levelsData])

  const toggleUnit = (unitId: string) => {
    const newOpen = new Set(openUnits)
    if (newOpen.has(unitId)) newOpen.delete(unitId)
    else newOpen.add(unitId)
    setOpenUnits(newOpen)
  }

  // ✅ Detect Google URL
  const isGoogleUrl = (url: string | null) => {
    if (!url) return false;
    return url.includes('docs.google.com') || url.includes('drive.google.com')
  }

  // ✅ Buka PDF/Slides via signed URL
  const openPDF = async (pdfStoragePath: string, title: string) => {
    setPdfModal({ open: true, url: '', title, loading: true, type: 'pdf', slideUrls: [] })
    try {
      const res = await fetch('/api/materials/pdf-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storage_path: pdfStoragePath }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      if (data.type === 'slides') {
        setPdfModal({ open: true, url: '', title, loading: false, type: 'slides', slideUrls: data.slide_urls })
      } else {
        setPdfModal({ open: true, url: data.signed_url, title, loading: false, type: 'pdf', slideUrls: [] })
      }
    } catch (err) {
      alert(`❌ Gagal membuka materi`)
      setPdfModal({ open: false, url: '', title: '', loading: false, type: 'google', slideUrls: [] })
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

  const allMaterials = levelsData.flatMap(l => l.units.flatMap(u => u.materials))
  const tabCounts = {
    live_zoom: allMaterials.filter(m => m.category === 'live_zoom').length,
    bacaan: allMaterials.filter(m => m.category === 'bacaan').length,
    kosakata: allMaterials.filter(m => m.category === 'kosakata').length,
    cefr: allMaterials.filter(m => m.category === 'cefr').length,
  }

  // Kumpulkan semua chapter dari semua level, filter by tab
  const allChapterGroups: {
    levelName: string
    chapterTitle: string
    units: Unit[]
  }[] = []

  levelsData.forEach(level => {
    const filteredUnits = level.units.map(u => ({
      ...u,
      materials: u.materials.filter(m => m.category === activeTab)
    })).filter(u => u.materials.length > 0)

    const chapterMap = new Map<string, Unit[]>()
    filteredUnits.forEach(u => {
      const key = u.chapter_title || 'Tanpa Chapter'
      if (!chapterMap.has(key)) chapterMap.set(key, [])
      chapterMap.get(key)!.push(u)
    })

    chapterMap.forEach((units, chapterTitle) => {
      allChapterGroups.push({ levelName: level.level_name, chapterTitle, units })
    })
  })

  return (
    <>
    <div className="p-4 max-w-4xl mx-auto">

      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-[#1A1640]">Materi Pembelajaran</h1>
        <p className="text-sm text-[#7B78A8] mt-0.5">{levelsData[0]?.course_name}</p>
      </div>

      {/* Tabs — mirip portal tutor */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {(['live_zoom', 'bacaan', 'kosakata', 'cefr'] as const).map(tab => {
          const isActive = activeTab === tab
          const count = tabCounts[tab]
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all whitespace-nowrap border-2 ${
                isActive
                  ? 'bg-[#5C4FE5] border-[#5C4FE5] text-white'
                  : 'bg-white border-[#E5E3FF] text-[#374151] hover:border-[#5C4FE5]'
              }`}
            >
              {getCategoryIcon(tab)}
              {getCategoryLabel(tab)}
              {count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                  isActive ? 'bg-white/20 text-white' : 'bg-[#EEEDFE] text-[#5C4FE5]'
                }`}>{count}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Chapter List */}
      {allChapterGroups.length === 0 ? (
        <div className="bg-white border-2 border-[#E5E3FF] rounded-xl p-10 text-center">
          <div className="text-4xl mb-3">📚</div>
          <p className="text-[#7B78A8]">Belum ada materi {getCategoryLabel(activeTab)}.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {allChapterGroups.map(({ levelName, chapterTitle, units }) => {
            const key = `${levelName}-${chapterTitle}`
            const isOpen = openChapters.has(key)
            return (
              <div key={key} className="bg-white border-2 border-[#5C4FE5] rounded-xl overflow-hidden">

                {/* Chapter Header — mirip portal tutor */}
                <button
                  onClick={() => {
                    const next = new Set(openChapters)
                    if (next.has(key)) next.delete(key)
                    else next.add(key)
                    setOpenChapters(next)
                  }}
                  className="w-full px-5 py-4 flex items-center gap-3 bg-gradient-to-r from-purple-50 to-white hover:from-purple-100 transition-colors"
                >
                  {isOpen
                    ? <ChevronDown className="w-5 h-5 text-[#5C4FE5] flex-shrink-0" />
                    : <ChevronRight className="w-5 h-5 text-[#5C4FE5] flex-shrink-0" />
                  }
                  <div className="text-left">
                    <p className="text-xs font-semibold text-[#7B78A8] leading-none mb-0.5">{levelName}</p>
                    <p className="text-base font-bold text-[#5C4FE5]">{chapterTitle}</p>
                  </div>
                  <span className="ml-auto text-xs text-[#7B78A8] font-medium">
                    {units.length} unit
                  </span>
                </button>

                {/* Units */}
                {isOpen && (
                  <div className="divide-y divide-[#E5E3FF]">
                    {units.map(unit => {
                      const isUnitOpen = openUnits.has(unit.id)
                      const lessonGroups = groupByLesson(unit.materials)
                      return (
                        <div key={unit.id}>
                          {/* Unit Header */}
                          <button
                            onClick={() => toggleUnit(unit.id)}
                            className="w-full px-5 py-3 flex items-center justify-between bg-[#F7F6FF] hover:bg-[#EEEDFE] transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              {isUnitOpen
                                ? <ChevronDown className="w-4 h-4 text-[#7B78A8]" />
                                : <ChevronRight className="w-4 h-4 text-[#7B78A8]" />
                              }
                              <span className="font-semibold text-[#1A1640] text-sm">{unit.name}</span>
                            </div>
                            <span className="text-xs text-[#7B78A8]">{unit.materials.length} materi</span>
                          </button>

                          {/* Lessons + Materials */}
                          {isUnitOpen && (
                            <div className="bg-white">
                              {Array.from(lessonGroups.entries()).map(([lessonTitle, materials]) => (
                                <div key={lessonTitle} className="px-5 py-3 border-b border-[#E5E3FF] last:border-b-0">
                                  <p className="text-sm font-medium text-[#374151] mb-2">{lessonTitle}</p>
                                  <div className="flex flex-wrap gap-2 pl-2">
                                    {materials.map(material => {
                                      const isClickable = material.student_content_url ||
                                        (material.gdrive_url && (isGoogleUrl(material.gdrive_url) || material.category !== 'live_zoom')) ||
                                        material.component_id
                                      return (
                                        <div key={material.id} className="flex items-center gap-1.5">
                                          {material.completed && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                                          {isClickable ? (
                                            material.student_content_url ? (
                                              <button
                                                onClick={() => openPDF(material.student_content_url!, material.title)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#5C4FE5] text-white rounded-lg text-xs font-semibold hover:bg-[#4a3ec7] transition-colors"
                                              >
                                                {getCategoryIcon(material.category)}
                                                {material.title}
                                              </button>
                                            ) : material.gdrive_url && isGoogleUrl(material.gdrive_url) ? (
                                              <button
                                                onClick={() => openGoogleEmbed(material.id, material.title)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#5C4FE5] text-white rounded-lg text-xs font-semibold hover:bg-[#4a3ec7] transition-colors"
                                              >
                                                {getCategoryIcon(material.category)}
                                                {material.title}
                                              </button>
                                            ) : material.category === 'live_zoom' && material.gdrive_url && !isGoogleUrl(material.gdrive_url) ? (
                                              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-400 rounded-lg text-xs font-semibold cursor-not-allowed">
                                                {getCategoryIcon(material.category)}
                                                Segera Hadir
                                              </span>
                                            ) : material.component_id ? (
                                              <Link
                                                href={`/ortu/anak/${studentSlug}/materi/render/${material.component_id}`}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#5C4FE5] text-white rounded-lg text-xs font-semibold hover:bg-[#4a3ec7] transition-colors"
                                              >
                                                {getCategoryIcon(material.category)}
                                                {material.title}
                                              </Link>
                                            ) : null
                                          ) : (
                                            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-400 rounded-lg text-xs font-semibold">
                                              {getCategoryIcon(material.category)}
                                              {material.title}
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

    {/* ✅ Google Drive / PDF Modal */}
    {pdfModal.open && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900 truncate">{pdfModal.title}</h2>
            <button onClick={() => setPdfModal({ open: false, url: '', title: '', loading: false, type: 'google', slideUrls: [] })}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-hidden rounded-b-2xl">
            {pdfModal.loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-10 h-10 animate-spin text-[#5C4FE5] mx-auto mb-3" />
              </div>
            ) : (
              <iframe src={pdfModal.url} className="w-full h-full border-0" title={pdfModal.title} />
            )}
          </div>
        </div>
      </div>
    )}

    {/* Loading overlay */}
    {pdfModal.open && pdfModal.loading && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
        <div className="bg-white rounded-2xl p-8 text-center">
          <Loader2 className="w-10 h-10 animate-spin text-[#5C4FE5] mx-auto mb-3" />
          <p className="text-gray-600 font-medium">Memuat materi...</p>
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
