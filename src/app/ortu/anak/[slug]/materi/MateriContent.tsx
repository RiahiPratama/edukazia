'use client'

import { useState, useEffect, useRef } from 'react'
import { BookOpen, Video, FileText, Headphones, ChevronDown, ChevronRight, CheckCircle2, X, Loader2, ExternalLink, Maximize2 } from 'lucide-react'
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
  lesson_position: number
  unit_name: string
}

type Unit = {
  id: string
  name: string
  chapter_title: string | null
  chapter_order: number
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
  unitLockMap?: Record<string, number>
  lessonLockMap?: Record<string, number>
}

export default function MateriContent({ levelsData, studentName, studentSlug, unitLockMap = {}, lessonLockMap = {} }: MateriContentProps) {
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

  // ✅ Fullscreen state
  const [zoomLevel] = useState(1)
  const pdfModalRef = useRef<HTMLDivElement>(null)
  const embedModalRef = useRef<HTMLDivElement>(null)

  const handleFullscreen = (ref: React.RefObject<HTMLDivElement | null>) => {
    const el = ref.current
    if (!el) return
    if (document.fullscreenElement) document.exitFullscreen()
    else el.requestFullscreen()
  }

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
  // ✅ Transform Google Drive URL ke preview mode (no toolbar, no download)
  const toGDrivePreview = (url: string): string => {
    // https://drive.google.com/file/d/xxx/view?usp=sharing → /preview
    const match = url.match(/\/file\/d\/([^/]+)/)
    if (match) return `https://drive.google.com/file/d/${match[1]}/preview`
    return url
  }

  const isGDriveUrl = (url: string): boolean => {
    return url.includes('drive.google.com/file/')
  }

  const openPDF = async (pdfStoragePath: string, title: string) => {
    // ✅ Google Drive URL → buka langsung di preview mode (no API call needed)
    if (isGDriveUrl(pdfStoragePath)) {
      const previewUrl = toGDrivePreview(pdfStoragePath)
      setPdfModal({ open: true, url: previewUrl, title, loading: false, type: 'google', slideUrls: [] })
      return
    }

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
    levelId: string
    levelSortOrder: number
    chapterTitle: string
    chapterOrder: number
    units: Unit[]
  }[] = []

  levelsData.forEach(level => {
    const levelSortOrder = levelsData.indexOf(level)

    const filteredUnits = level.units.map(u => ({
      ...u,
      materials: u.materials.filter(m => m.category === activeTab)
    })).filter(u => u.materials.length > 0)

    // On live_zoom/bacaan/cefr tabs, also include units that have materials but are locked (so they show with 🔒)
    // For other tabs, locked units with materials are already included
    const maxPos = unitLockMap[level.level_id] ?? 999
    const allUnitsForTab = activeTab !== 'kosakata'
      ? level.units.filter(u => u.materials.some(m => m.category === activeTab))
      : filteredUnits

    const chapterMap = new Map<string, { units: Unit[]; order: number }>()
    allUnitsForTab.forEach(u => {
      const unitWithFiltered = { ...u, materials: u.materials.filter(m => m.category === activeTab) }
      if (unitWithFiltered.materials.length === 0) return
      const key = u.chapter_title || 'Tanpa Chapter'
      if (!chapterMap.has(key)) chapterMap.set(key, { units: [], order: u.chapter_order || 0 })
      chapterMap.get(key)!.units.push(unitWithFiltered)
    })

    chapterMap.forEach(({ units, order }, chapterTitle) => {
      // Sort units within chapter by position
      units.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      allChapterGroups.push({ levelName: level.level_name, levelId: level.level_id, levelSortOrder, chapterTitle, chapterOrder: order, units })
    })
  })

  // ✅ Sort: level terendah dulu, lalu chapter by order_number
  allChapterGroups.sort((a, b) => {
    if (a.levelSortOrder !== b.levelSortOrder) return a.levelSortOrder - b.levelSortOrder
    return (a.chapterOrder || 0) - (b.chapterOrder || 0)
  })

  return (
    <>
    <div className="p-4 max-w-4xl mx-auto">

      {/* Sapaan Siswa */}
      <div className="bg-gradient-to-br from-[#5C4FE5] to-[#7C6FE5] rounded-2xl p-5 mb-5 text-white shadow-lg">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0 text-lg">
            👋
          </div>
          <div>
            <h1 className="text-lg font-bold leading-snug">
              Halo, {studentName}!
            </h1>
            <p className="text-sm text-white/80 mt-0.5">
              {levelsData.length === 1
                ? <>Kamu sedang belajar di <span className="font-semibold text-white">{levelsData[0].level_name}</span> — terus semangat, setiap langkah kecil membawamu lebih jauh! 🌟</>
                : <>Kamu aktif di <span className="font-semibold text-white">{levelsData.length} level</span> sekaligus — luar biasa, terus pertahankan! 🔥</>
              }
            </p>
          </div>
        </div>

        {/* Panduan Tab */}
        <div className="bg-white/10 rounded-xl p-3 space-y-2">
          <p className="text-xs font-semibold text-white/70 uppercase tracking-wide mb-2">Panduan Belajar</p>
          {[
            {
              icon: '🎥',
              label: 'Live Zoom',
              desc: 'Rekap materi dari sesi kelas yang sudah berlangsung dan preview materi yang akan segera kamu pelajari bersama tutor.',
              tab: 'live_zoom' as const,
            },
            {
              icon: '📖',
              label: 'Bacaan',
              desc: 'Eksplorasi materi lewat teks interaktif yang menyenangkan — klik kata, temukan artinya, dan perkaya pemahamanmu!',
              tab: 'bacaan' as const,
            },
            {
              icon: '🎧',
              label: 'Kosakata',
              desc: 'Dengarkan langsung pengucapan dari Native Speaker dan latih telingamu mengenali kosa kata dalam konteks nyata.',
              tab: 'kosakata' as const,
            },
            {
              icon: '🔄',
              label: 'CEFR',
              desc: 'Uji kemampuanmu beralih antara Bahasa Indonesia dan Inggris — latihan yang bikin otakmu makin lincah!',
              tab: 'cefr' as const,
            },
          ].map(item => (
            <button
              key={item.tab}
              onClick={() => setActiveTab(item.tab)}
              className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-all ${
                activeTab === item.tab
                  ? 'bg-white/20'
                  : 'hover:bg-white/10'
              }`}
            >
              <span className="text-base flex-shrink-0">{item.icon}</span>
              <div className="min-w-0">
                <span className="text-xs font-bold text-white block">{item.label}</span>
                <span className="text-xs text-white/70 leading-snug">{item.desc}</span>
              </div>
              {tabCounts[item.tab] > 0 && (
                <span className="ml-auto flex-shrink-0 bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {tabCounts[item.tab]}
                </span>
              )}
            </button>
          ))}
        </div>
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
          {allChapterGroups.map(({ levelName, levelId, chapterTitle, units }) => {
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
                      const maxPos = unitLockMap[levelId] ?? 999
                      const isUnitLocked = activeTab !== 'kosakata' && unit.sort_order > maxPos
                      const isUnitOpen = !isUnitLocked && openUnits.has(unit.id)
                      const lessonGroups = groupByLesson(unit.materials)
                      return (
                        <div key={unit.id}>
                          {/* Unit Header */}
                          <button
                            onClick={() => !isUnitLocked && toggleUnit(unit.id)}
                            className={`w-full px-5 py-3 flex items-center justify-between transition-colors ${isUnitLocked ? 'bg-gray-50 opacity-60 cursor-not-allowed' : 'bg-[#F7F6FF] hover:bg-[#EEEDFE]'}`}
                          >
                            <div className="flex items-center gap-2">
                              {isUnitLocked
                                ? <span className="text-sm">🔒</span>
                                : isUnitOpen
                                ? <ChevronDown className="w-4 h-4 text-[#7B78A8]" />
                                : <ChevronRight className="w-4 h-4 text-[#7B78A8]" />
                              }
                              <span className={`font-semibold text-sm ${isUnitLocked ? 'text-gray-400' : 'text-[#1A1640]'}`}>{unit.name}</span>
                              {isUnitLocked && <span className="text-[10px] text-gray-400">Belum dibuka oleh tutor</span>}
                            </div>
                            <span className="text-xs text-[#7B78A8]">{unit.materials.length} materi</span>
                          </button>

                          {/* Lessons + Materials */}
                          {isUnitOpen && !isUnitLocked && (
                            <div className="bg-white">
                              {Array.from(lessonGroups.entries()).map(([lessonTitle, materials]) => {
                                // Lesson lock: di unit saat ini, lesson di atas current_lesson_position dikunci
                                const lessonPos = materials[0]?.lesson_position ?? 0
                                const maxLessonPos = lessonLockMap[levelId] ?? 999
                                const isLessonLocked = activeTab !== 'kosakata' && unit.sort_order === maxPos && lessonPos > maxLessonPos

                                return (
                                <div key={lessonTitle} className={`px-5 py-3 border-b border-[#E5E3FF] last:border-b-0 ${isLessonLocked ? 'opacity-50' : ''}`}>
                                  <div className="flex items-center gap-2 mb-2">
                                    {isLessonLocked && <span className="text-sm">🔒</span>}
                                    <p className={`text-sm font-medium ${isLessonLocked ? 'text-gray-400' : 'text-[#374151]'}`}>{lessonTitle}</p>
                                    {isLessonLocked && <span className="text-[10px] text-gray-400">Belum dibuka</span>}
                                  </div>
                                  {!isLessonLocked && (
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
            )
          })}
        </div>
      )}
    </div>

    {/* ✅ Google Drive / PDF Modal — with Zoom & Fullscreen */}
    {pdfModal.open && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
        <div ref={pdfModalRef} className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900 truncate">{pdfModal.title}</h2>
            <div className="flex items-center gap-1">
              <button onClick={() => handleFullscreen(pdfModalRef)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors" title="Fullscreen">
                <Maximize2 className="w-4 h-4" />
              </button>
              <button onClick={() => setPdfModal({ open: false, url: '', title: '', loading: false, type: 'google', slideUrls: [] })}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden rounded-b-2xl relative">
            {pdfModal.loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-10 h-10 animate-spin text-[#5C4FE5] mx-auto mb-3" />
              </div>
            ) : (
              <>
                <iframe src={pdfModal.url} className="w-full h-full border-0" title={pdfModal.title} sandbox="allow-scripts allow-same-origin" />
                {/* ✅ Block Google pop-out "Lepas" button di pojok kanan atas */}
                {pdfModal.type === 'google' && (
                  <div className="absolute top-0 right-0 w-16 h-16 bg-transparent z-10" style={{ pointerEvents: 'auto' }}
                    onClick={(e) => e.preventDefault()} />
                )}
              </>
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

    {/* ✅ Google Embed Modal — with Zoom & Fullscreen */}
    {embedModal.open && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
        <div ref={embedModalRef} className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col">
          {/* Modal Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900 truncate">{embedModal.title}</h2>
            <div className="flex items-center gap-1">
              <button onClick={() => handleFullscreen(embedModalRef)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors" title="Fullscreen">
                <Maximize2 className="w-4 h-4" />
              </button>
              <button onClick={() => setEmbedModal({ open: false, url: '', title: '', loading: false })}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors" title="Tutup">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Modal Content */}
          <div className="flex-1 overflow-hidden rounded-b-2xl relative">
            {embedModal.loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Loader2 className="w-10 h-10 animate-spin text-[#5C4FE5] mx-auto mb-3" />
                  <p className="text-gray-600 font-medium">Memuat materi...</p>
                </div>
              </div>
            ) : (
              <>
                <iframe
                  src={embedModal.url}
                  className="w-full h-full border-0"
                  allow="autoplay"
                  title={embedModal.title}
                />
                {/* ✅ Block Google pop-out button */}
                <div className="absolute top-0 right-0 w-16 h-16 bg-transparent z-10"
                  onClick={(e) => e.preventDefault()} />
              </>
            )}
          </div>
        </div>
      </div>
    )}
    </>
  )
}
