'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BookOpen, Video, ChevronDown, ChevronRight, Crown, Users, Building2, Clock, Lock, ExternalLink, Loader2, X } from 'lucide-react'

type TutorInfo = {
  id: string
  is_owner: boolean
  tutor_type: string
  employment_status: string
}

type Material = {
  id: string
  title: string
  category: string
  canva_url: string | null
  slides_url: string | null
  lesson_id: string
}

type Unit = {
  id: string
  unit_name: string
  chapter_title: string | null
  position: number
  materials: Material[]
}

type LevelData = {
  level_id: string
  level_name: string
  course_name: string
  units: Unit[]
}

export default function TutorMateriPage() {
  const supabase = createClient()
  const [tutorInfo, setTutorInfo] = useState<TutorInfo | null>(null)
  const [levelsData, setLevelsData] = useState<LevelData[]>([])
  const [loading, setLoading] = useState(true)
  const [openUnits, setOpenUnits] = useState<Set<string>>(new Set())
  const [accessStatus, setAccessStatus] = useState<Record<string, 'allowed' | 'time_locked' | 'no_content'>>({})
  const [embedModal, setEmbedModal] = useState<{ open: boolean; url: string; title: string; loading: boolean }>
    ({ open: false, url: '', title: '', loading: false })

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Get tutor info
    const { data: tutor } = await supabase
      .from('tutors')
      .select('id, is_owner, tutor_type, employment_status')
      .eq('profile_id', user.id)
      .single()

    if (!tutor) { setLoading(false); return }
    setTutorInfo(tutor)

    // Get kelas yang diajar tutor
    const { data: classGroups } = await supabase
      .from('class_groups')
      .select('id, label')
      .eq('tutor_id', tutor.id)
      .eq('status', 'active')

    const classGroupIds = classGroups?.map((cg: any) => cg.id) || []

    // Get level IDs dari class_group_levels
    const { data: cgl } = classGroupIds.length > 0
      ? await supabase
          .from('class_group_levels')
          .select('class_group_id, level_id')
          .in('class_group_id', classGroupIds)
      : { data: [] }

    // Extract unique level IDs
    const levelIds = Array.from(new Set(
      cgl?.map((c: any) => c.level_id).filter(Boolean) || []
    ))

    if (levelIds.length === 0) { setLoading(false); return }

    // Fetch levels + courses
    const { data: levels } = await supabase
      .from('levels')
      .select('id, name, course_id, courses:course_id(name)')
      .in('id', levelIds)

    // Fetch units
    const { data: units } = await supabase
      .from('units')
      .select('id, unit_name, position, level_id, chapter_id')
      .in('level_id', levelIds)
      .order('position')

    const unitIds = units?.map(u => u.id) || []
    const chapterIds = [...new Set(units?.map(u => u.chapter_id).filter(Boolean) || [])]

    // Fetch chapters
    const { data: chapters } = chapterIds.length > 0
      ? await supabase.from('chapters').select('id, chapter_title').in('id', chapterIds)
      : { data: [] }

    // Fetch lessons
    const { data: lessons } = await supabase
      .from('lessons')
      .select('id, lesson_name, position, unit_id')
      .in('unit_id', unitIds)
      .order('position')

    const lessonIds = lessons?.map(l => l.id) || []

    // Fetch materials + contents
    const { data: materials } = await supabase
      .from('materials')
      .select('id, title, category, lesson_id, is_published')
      .in('lesson_id', lessonIds)
      .eq('is_published', true)
      .eq('category', 'live_zoom')

    const materialIds = materials?.map(m => m.id) || []

    const { data: contents } = await supabase
      .from('material_contents')
      .select('material_id, canva_url, slides_url')
      .in('material_id', materialIds)

    // Check time-based access for freelancer
    let timeAccess: Record<string, boolean> = {}
    if (!tutor.is_owner && tutor.tutor_type === 'internal') {
      const now = new Date()
      const { data: sessions } = await supabase
        .from('sessions')
        .select('id, scheduled_at, class_group_id')
        .in('class_group_id', classGroupIds)
        .gte('scheduled_at', new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString())
        .lte('scheduled_at', new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString())

      sessions?.forEach(s => {
        const sessionTime = new Date(s.scheduled_at)
        const diffMin = (now.getTime() - sessionTime.getTime()) / 60000
        // Allow: 20 menit sebelum (-20) sampai 5 menit setelah (+5)
        if (diffMin >= -20 && diffMin <= 5) {
          timeAccess[s.class_group_id] = true
        }
      })
    }

    // Build access status per material
    const accessMap: Record<string, 'allowed' | 'time_locked' | 'no_content'> = {}
    materials?.forEach(m => {
      const content = contents?.find(c => c.material_id === m.id)
      if (tutor.is_owner) {
        accessMap[m.id] = content?.canva_url ? 'allowed' : 'no_content'
      } else {
        // Freelancer & B2B
        if (!content?.slides_url) {
          accessMap[m.id] = 'no_content'
        } else if (tutor.tutor_type === 'internal') {
          // Time-based check
              // Cek apakah ada sesi aktif untuk materi ini
          const hasActiveSession = Object.values(timeAccess).some(v => v)
          accessMap[m.id] = hasActiveSession ? 'allowed' : 'time_locked'
        } else {
          // B2B — akses penuh kalau ada slides_url
          accessMap[m.id] = 'allowed'
        }
      }
    })
    setAccessStatus(accessMap)

    // Build levelsData — sort level by name
    const sortedLevelIds = [...levelIds].sort((a, b) => {
      const la = levels?.find(l => l.id === a)?.name || ''
      const lb = levels?.find(l => l.id === b)?.name || ''
      return la.localeCompare(lb)
    })

    const result: LevelData[] = sortedLevelIds.map(levelId => {
      const level = levels?.find(l => l.id === levelId)
      if (!level) return null
      const course = Array.isArray(level.courses) ? level.courses[0] : level.courses

      const levelUnits = units?.filter(u => u.level_id === levelId) || []
      const builtUnits: Unit[] = levelUnits.map(unit => {
        const chapter = chapters?.find(c => c.id === unit.chapter_id)
        const unitLessons = lessons?.filter(l => l.unit_id === unit.id) || []
        const unitMaterials: Material[] = unitLessons.flatMap(lesson => {
          return (materials?.filter(m => m.lesson_id === lesson.id) || []).map(m => {
            const content = contents?.find(c => c.material_id === m.id)
            return {
              id: m.id,
              title: m.title,
              category: m.category,
              canva_url: content?.canva_url || null,
              slides_url: content?.slides_url || null,
              lesson_id: m.lesson_id,
            }
          })
        })
        return {
          id: unit.id,
          unit_name: unit.unit_name,
          chapter_title: chapter?.chapter_title || null,
          position: unit.position,
          materials: unitMaterials,
        }
      })

      return {
        level_id: levelId,
        level_name: level.name,
        course_name: course?.name || '',
        units: builtUnits,
      }
    }).filter(Boolean) as LevelData[]

    setLevelsData(result)
    setLoading(false)
  }

  const openMaterial = async (material: Material) => {
    const status = accessStatus[material.id]
    if (status === 'time_locked') {
      alert('🔒 Materi hanya bisa diakses 20 menit sebelum kelas dimulai.')
      return
    }
    if (status === 'no_content') {
      alert('⚠️ Konten belum tersedia.')
      return
    }

    const url = tutorInfo?.is_owner ? material.canva_url : material.slides_url
    if (!url) return

    if (url.includes('canva')) {
      window.open(url, '_blank')
      return
    }

    // Google Slides — embed via modal
    setEmbedModal({ open: true, url: '', title: material.title, loading: true })
    try {
      const res = await fetch('/api/materials/pdf-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storage_path: url }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setEmbedModal({ open: true, url: data.signed_url, title: material.title, loading: false })
    } catch {
      alert('❌ Gagal membuka materi')
      setEmbedModal({ open: false, url: '', title: '', loading: false })
    }
  }

  const getTutorBadge = () => {
    if (!tutorInfo) return null
    if (tutorInfo.is_owner) return { label: 'Owner', color: 'bg-purple-100 text-purple-700', icon: <Crown size={12} className="inline mr-1"/> }
    if (tutorInfo.tutor_type === 'b2b') return { label: 'B2B', color: 'bg-blue-100 text-blue-700', icon: <Building2 size={12} className="inline mr-1"/> }
    return { label: 'Freelancer', color: 'bg-green-100 text-green-700', icon: <Users size={12} className="inline mr-1"/> }
  }

  const badge = getTutorBadge()

  if (loading) return (
    <div className="flex items-center justify-center p-16">
      <Loader2 className="w-8 h-8 animate-spin text-[#5C4FE5]"/>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-[#1A1640]" style={{ fontFamily: 'Sora, sans-serif' }}>Materi Ajar</h1>
          <p className="text-sm text-[#7B78A8] mt-1">Materi Live Zoom sesuai kelas yang kamu ajar</p>
        </div>
        {badge && (
          <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${badge.color}`}>
            {badge.icon}{badge.label}
          </span>
        )}
      </div>

      {/* Access info banner */}
      {tutorInfo && !tutorInfo.is_owner && tutorInfo.tutor_type === 'internal' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3">
          <Clock className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-yellow-800">Akses Terbatas Waktu</p>
            <p className="text-xs text-yellow-700 mt-0.5">Materi hanya bisa dibuka <strong>20 menit sebelum</strong> kelas dimulai dan ditutup <strong>5 menit setelah</strong> kelas selesai.</p>
          </div>
        </div>
      )}

      {levelsData.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E5E3FF] p-12 text-center">
          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4"/>
          <p className="font-bold text-[#1A1640] mb-1">Belum ada materi tersedia</p>
          <p className="text-sm text-[#7B78A8]">Materi akan muncul sesuai kelas aktif yang kamu ajar.</p>
        </div>
      ) : (
        levelsData.map(level => (
          <div key={level.level_id} className="bg-white rounded-2xl border border-[#E5E3FF] overflow-hidden">
            {/* Level header */}
            <div className="px-6 py-4 bg-[#5C4FE5] flex items-center justify-between">
              <div>
                <p className="text-xs text-purple-200 font-medium">{level.course_name}</p>
                <h2 className="text-lg font-bold text-white">{level.level_name}</h2>
              </div>
            </div>

            {/* Units */}
            <div className="divide-y divide-gray-100">
              {level.units.map(unit => {
                const isOpen = openUnits.has(unit.id)
                return (
                  <div key={unit.id}>
                    <button onClick={() => setOpenUnits(prev => {
                      const next = new Set(prev)
                      isOpen ? next.delete(unit.id) : next.add(unit.id)
                      return next
                    })}
                      className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors text-left">
                      <div className="flex items-center gap-3">
                        {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                        <div>
                          {unit.chapter_title && <p className="text-xs text-[#7B78A8]">{unit.chapter_title}</p>}
                          <p className="font-semibold text-[#1A1640] text-sm">{unit.unit_name}</p>
                        </div>
                      </div>
                      <span className="text-xs text-gray-400">{unit.materials.length} materi</span>
                    </button>

                    {isOpen && (
                      <div className="px-6 pb-4 space-y-2">
                        {unit.materials.length === 0 ? (
                          <p className="text-sm text-gray-400 pl-7">Belum ada materi</p>
                        ) : (
                          unit.materials.map(material => {
                            const status = accessStatus[material.id]
                            return (
                              <div key={material.id}
                                className={`flex items-center justify-between p-3 rounded-xl border transition-colors
                                  ${status === 'allowed' ? 'border-[#E5E3FF] bg-[#F7F6FF] hover:border-[#5C4FE5]' :
                                    status === 'time_locked' ? 'border-yellow-200 bg-yellow-50' :
                                    'border-gray-200 bg-gray-50'}`}>
                                <div className="flex items-center gap-3">
                                  <Video className={`w-4 h-4 flex-shrink-0 ${status === 'allowed' ? 'text-[#5C4FE5]' : 'text-gray-400'}`}/>
                                  <span className={`text-sm font-medium ${status === 'allowed' ? 'text-[#1A1640]' : 'text-gray-500'}`}>
                                    {material.title}
                                  </span>
                                </div>
                                <button onClick={() => openMaterial(material)}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex-shrink-0
                                    ${status === 'allowed' ? 'bg-[#5C4FE5] text-white hover:bg-[#4a3ec7]' :
                                      status === 'time_locked' ? 'bg-yellow-100 text-yellow-700 cursor-not-allowed' :
                                      'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
                                  {status === 'allowed' ? <><ExternalLink className="w-3 h-3"/>Buka</> :
                                    status === 'time_locked' ? <><Clock className="w-3 h-3"/>Terkunci</> :
                                    <><Lock className="w-3 h-3"/>Belum Tersedia</>}
                                </button>
                              </div>
                            )
                          })
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))
      )}

      {/* Embed Modal */}
      {embedModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900 truncate">{embedModal.title}</h2>
              <button onClick={() => setEmbedModal({ open: false, url: '', title: '', loading: false })}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5"/>
              </button>
            </div>
            <div className="flex-1 overflow-hidden rounded-b-2xl">
              {embedModal.loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-10 h-10 animate-spin text-[#5C4FE5]"/>
                </div>
              ) : (
                <iframe src={embedModal.url} className="w-full h-full border-0" title={embedModal.title} allowFullScreen/>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
