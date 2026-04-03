'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Video, FileText, BookOpen, Headphones,
  ChevronDown, ChevronRight, ExternalLink,
  Clock, Lock, Loader2, X, Crown, Users, Building2
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────
type TutorInfo = {
  id: string
  is_owner: boolean
  tutor_type: string
}

type Material = {
  id: string
  title: string
  category: string
  lesson_id: string
  lesson_name: string
  lesson_position: number
  unit_name: string
  unit_position: number
  chapter_title: string | null
  level_name: string
  content_url: string | null
  canva_url: string | null
  slides_url: string | null
  storage_path: string | null
}

type TabType = 'live_zoom' | 'kosakata' | 'bacaan' | 'cefr'

// ── Tab config per tutor type ─────────────────────────────────
const TABS_BY_ROLE: Record<string, TabType[]> = {
  owner:    ['live_zoom', 'kosakata', 'bacaan', 'cefr'],
  internal: ['live_zoom', 'kosakata'],
  b2b:      ['live_zoom'],
}

const TAB_INFO: Record<TabType, { label: string; icon: any; color: string }> = {
  live_zoom: { label: 'Live Zoom',  icon: Video,      color: 'text-purple-600' },
  kosakata:  { label: 'Kosakata',   icon: FileText,   color: 'text-yellow-600' },
  bacaan:    { label: 'Bacaan',     icon: BookOpen,   color: 'text-blue-600'   },
  cefr:      { label: 'CEFR',      icon: Headphones, color: 'text-green-600'  },
}

// ── Main Component ────────────────────────────────────────────
export default function TutorMateriPage() {
  const supabase = createClient()
  const router = useRouter()

  const [tutorInfo, setTutorInfo]     = useState<TutorInfo | null>(null)
  const [materials, setMaterials]     = useState<Material[]>([])
  const [loading, setLoading]         = useState(true)
  const [activeTab, setActiveTab]     = useState<TabType>('live_zoom')
  const [openGroups, setOpenGroups]   = useState<Set<string>>(new Set())
  const [hasActiveSession, setHasActiveSession] = useState(false)

  const [embedModal, setEmbedModal] = useState<{
    open: boolean; url: string; title: string; loading: boolean
  }>({ open: false, url: '', title: '', loading: false })

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Get tutor info
    const { data: tutor } = await supabase
      .from('tutors')
      .select('id, is_owner, tutor_type')
      .eq('profile_id', user.id)
      .single()

    if (!tutor) { setLoading(false); return }
    setTutorInfo(tutor)

    // Get class groups tutor ini
    // Owner: semua class group (termasuk arsip)
    // Freelancer/B2B: hanya active
    let classGroupsQuery = supabase
      .from('class_groups')
      .select('id')
      .eq('tutor_id', tutor.id)
    
    if (!tutor.is_owner) {
      classGroupsQuery = classGroupsQuery.eq('status', 'active')
    }

    const { data: classGroups } = await classGroupsQuery

    const classGroupIds = classGroups?.map(cg => cg.id) || []

    // Get level IDs
    const { data: cgl } = classGroupIds.length > 0
      ? await supabase
          .from('class_group_levels')
          .select('level_id')
          .in('class_group_id', classGroupIds)
      : { data: [] }

    const levelIds = Array.from(new Set(cgl?.map((c: any) => c.level_id).filter(Boolean) || []))
    if (levelIds.length === 0) { setLoading(false); return }

    // Get levels
    const { data: levels } = await supabase
      .from('levels')
      .select('id, name')
      .in('id', levelIds)

    // Get units
    const { data: units } = await supabase
      .from('units')
      .select('id, unit_name, level_id, chapter_id, position').order('position')
      .in('level_id', levelIds)
      .order('position')

    const unitIds = units?.map(u => u.id) || []
    const chapterIds = [...new Set(units?.map(u => u.chapter_id).filter(Boolean) || [])] as string[]

    // Get chapters
    const { data: chapters } = chapterIds.length > 0
      ? await supabase.from('chapters').select('id, chapter_title').in('id', chapterIds)
      : { data: [] }

    // Get lessons
    const { data: lessons } = unitIds.length > 0
      ? await supabase
          .from('lessons')
          .select('id, lesson_name, unit_id, position').order('position')
          .in('unit_id', unitIds)
          .order('position')
      : { data: [] }

    const lessonIds = lessons?.map(l => l.id) || []

    // Get all materials (semua kategori)
    const { data: mats } = lessonIds.length > 0
      ? await supabase
          .from('materials')
          .select('id, title, category, lesson_id, position')
          .in('lesson_id', lessonIds)
          .eq('is_published', true)
          .order('position')
      : { data: [] }

    const materialIds = mats?.map(m => m.id) || []

    // Get material contents
    const { data: contents } = materialIds.length > 0
      ? await supabase
          .from('material_contents')
          .select('material_id, content_url, canva_url, slides_url, storage_path')
          .in('material_id', materialIds)
      : { data: [] }

    // Check time-based access for freelancer
    if (!tutor.is_owner && tutor.tutor_type === 'internal') {
      const now = new Date()
      const { data: sessions } = await supabase
        .from('sessions')
        .select('id, scheduled_at')
        .in('class_group_id', classGroupIds)
        .gte('scheduled_at', new Date(now.getTime() - 60 * 60 * 1000).toISOString())
        .lte('scheduled_at', new Date(now.getTime() + 60 * 60 * 1000).toISOString())

      const active = sessions?.some(s => {
        const diffMin = (now.getTime() - new Date(s.scheduled_at).getTime()) / 60000
        return diffMin >= -20 && diffMin <= 5
      })
      setHasActiveSession(!!active)
    }

    // Build flat materials list
    const allMaterials: Material[] = (mats || []).map(m => {
      const lesson = lessons?.find(l => l.id === m.lesson_id)
      const unit = units?.find(u => u.id === lesson?.unit_id)
      const chapter = chapters?.find(c => c.id === unit?.chapter_id)
      const level = levels?.find(l => l.id === unit?.level_id)
      const content = contents?.find((c: any) => c.material_id === m.id)

      return {
        id: m.id,
        title: m.title,
        category: m.category,
        lesson_id: m.lesson_id,
        lesson_name: lesson?.lesson_name || '',
        lesson_position: lesson?.position || 0,
        unit_name: unit?.unit_name || '',
        unit_position: unit?.position || 0,
        chapter_title: chapter?.chapter_title || null,
        level_name: level?.name || '',
        content_url: (content as any)?.content_url || null,
        canva_url: (content as any)?.canva_url || null,
        slides_url: (content as any)?.slides_url || null,
        storage_path: (content as any)?.storage_path || null,
      }
    })

    setMaterials(allMaterials)
    setLoading(false)
  }

  // ── Access check ──────────────────────────────────────────
  const canAccess = (material: Material): 'allowed' | 'time_locked' | 'no_content' => {
    if (material.category === 'bacaan') {
      return material.storage_path ? 'allowed' : 'no_content'
    }
    if (material.category === 'cefr') {
      return material.lesson_id ? 'allowed' : 'no_content'
    }
    if (material.category === 'kosakata') {
      return material.content_url ? 'allowed' : 'no_content'
    }
    // live_zoom
    if (tutorInfo?.is_owner) {
      return material.canva_url ? 'allowed' : 'no_content'
    }
    if (!material.slides_url) return 'no_content'
    if (tutorInfo?.tutor_type === 'internal') {
      return hasActiveSession ? 'allowed' : 'time_locked'
    }
    return 'allowed'
  }

  // ── Open material ─────────────────────────────────────────
  const openMaterial = async (material: Material) => {
    const status = canAccess(material)
    if (status === 'time_locked') {
      alert('🔒 Materi hanya bisa diakses 20 menit sebelum kelas dimulai.')
      return
    }
    if (status === 'no_content') {
      alert('⚠️ Konten belum tersedia.')
      return
    }

    // Bacaan → render page
    if (material.category === 'bacaan' && material.storage_path) {
      router.push(`/tutor/render/${material.storage_path}`)
      return
    }
    // CEFR → render page
    if (material.category === 'cefr') {
      router.push(`/tutor/render/${material.lesson_id}`)
      return
    }

    // URL-based materials
    const url = material.category === 'live_zoom'
      ? (tutorInfo?.is_owner ? material.canva_url : material.slides_url)
      : material.content_url

    if (!url) return

    if (url.includes('canva')) {
      window.open(url, '_blank')
      return
    }

    if (url.includes('google.com')) {
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
      return
    }

    window.open(url, '_blank')
  }

  // ── Group materials by level → chapter/unit ───────────────
  const tabMaterials = materials.filter(m => m.category === activeTab)

  type UnitGroup = { unit: string; items: Material[] }
  type ChapterGroup = { level: string; chapter: string | null; units: UnitGroup[] }
  const groups: ChapterGroup[] = []

  // Sort: level → chapter → unit position → lesson position
  const sorted = [...tabMaterials].sort((a, b) => {
    if (a.level_name !== b.level_name) return a.level_name.localeCompare(b.level_name)
    if ((a.chapter_title || '') !== (b.chapter_title || ''))
      return (a.chapter_title || '').localeCompare(b.chapter_title || '')
    if (a.unit_position !== b.unit_position) return a.unit_position - b.unit_position
    return a.lesson_position - b.lesson_position
  })

  sorted.forEach(m => {
    let chGroup = groups.find(g => g.level === m.level_name && g.chapter === m.chapter_title)
    if (!chGroup) {
      chGroup = { level: m.level_name, chapter: m.chapter_title, units: [] }
      groups.push(chGroup)
    }
    let uGroup = chGroup.units.find(u => u.unit === m.unit_name)
    if (!uGroup) {
      uGroup = { unit: m.unit_name, items: [] }
      chGroup.units.push(uGroup)
    }
    uGroup.items.push(m)
  })

  const toggleGroup = (key: string) => {
    setOpenGroups(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  // ── Tutor badge ───────────────────────────────────────────
  const tutorBadge = tutorInfo?.is_owner
    ? { label: 'Owner', color: 'bg-purple-100 text-purple-700', icon: Crown }
    : tutorInfo?.tutor_type === 'b2b'
    ? { label: 'B2B', color: 'bg-blue-100 text-blue-700', icon: Building2 }
    : { label: 'Freelancer', color: 'bg-green-100 text-green-700', icon: Users }

  const roleKey = tutorInfo?.is_owner ? 'owner' : (tutorInfo?.tutor_type || 'internal')
  const allowedTabs = TABS_BY_ROLE[roleKey] || ['live_zoom']

  if (loading) return (
    <div className="flex items-center justify-center p-16">
      <Loader2 className="w-8 h-8 animate-spin text-[#5C4FE5]" />
    </div>
  )

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-[#1A1640]" style={{ fontFamily: 'Sora, sans-serif' }}>
            Materi Ajar
          </h1>
          <p className="text-sm text-[#7B78A8] mt-0.5">
            {materials.length} materi tersedia dari {[...new Set(materials.map(m => m.level_name))].length} level
          </p>
        </div>
        {tutorInfo && (() => {
          const BadgeIcon = tutorBadge.icon
          return (
            <span className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ${tutorBadge.color}`}>
              <BadgeIcon size={12} />{tutorBadge.label}
            </span>
          )
        })()}
      </div>

      {/* Time lock banner for freelancer */}
      {tutorInfo && !tutorInfo.is_owner && tutorInfo.tutor_type === 'internal' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 flex items-center gap-3">
          <Clock className="w-4 h-4 text-yellow-600 flex-shrink-0" />
          <p className="text-xs text-yellow-800">
            <strong>Live Zoom</strong> hanya bisa dibuka 20 menit sebelum – 5 menit setelah kelas.
            {hasActiveSession ? ' ✅ Sesi aktif sekarang.' : ' 🔒 Belum ada sesi aktif.'}
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-white border border-[#E5E3FF] rounded-xl p-1">
        {allowedTabs.map(tab => {
          const info = TAB_INFO[tab]
          const Icon = info.icon
          const count = materials.filter(m => m.category === tab).length
          const isActive = activeTab === tab
          return (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all
                ${isActive ? 'bg-[#5C4FE5] text-white shadow-md' : 'text-[#7B78A8] hover:bg-[#F0EFFF] hover:text-[#5C4FE5]'}`}>
              <Icon size={15} />
              <span className="hidden sm:inline">{info.label}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold
                ${isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Content */}
      {groups.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E5E3FF] p-12 text-center">
          <div className="text-4xl mb-3">📭</div>
          <p className="font-bold text-[#1A1640]">Belum ada materi {TAB_INFO[activeTab].label}</p>
          <p className="text-sm text-[#7B78A8] mt-1">Materi akan muncul sesuai level kelas yang kamu ajar.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group, gi) => {
            const chKey = `${group.level}__${group.chapter}`
            const isChOpen = openGroups.has(chKey)
            const totalItems = group.units.reduce((sum, u) => sum + u.items.length, 0)

            return (
              <div key={gi} className="bg-white rounded-2xl border border-[#E5E3FF] overflow-hidden">
                {/* Chapter header */}
                <button onClick={() => toggleGroup(chKey)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#F7F6FF] transition-colors text-left">
                  <div className="flex items-center gap-3 min-w-0">
                    {isChOpen
                      ? <ChevronDown className="w-4 h-4 text-[#5C4FE5] flex-shrink-0" />
                      : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                    <div>
                      <p className="text-xs text-[#7B78A8] font-medium">{group.level}</p>
                      <p className="font-bold text-[#1A1640] text-sm">{group.chapter || 'Materi'}</p>
                    </div>
                  </div>
                  <span className="text-xs text-[#7B78A8] flex-shrink-0 ml-3">
                    {group.units.length} unit · {totalItems} materi
                  </span>
                </button>

                {/* Units */}
                {isChOpen && (
                  <div className="border-t border-[#F0EFFF]">
                    {group.units.map((uGroup, ui) => {
                      const uKey = `${chKey}__${uGroup.unit}`
                      const isUOpen = openGroups.has(uKey)
                      return (
                        <div key={ui} className="border-b border-[#F7F6FF] last:border-0">
                          {/* Unit header */}
                          <button onClick={() => toggleGroup(uKey)}
                            className="w-full flex items-center justify-between pl-10 pr-5 py-3 hover:bg-[#F7F6FF] transition-colors text-left">
                            <div className="flex items-center gap-2">
                              {isUOpen
                                ? <ChevronDown className="w-3.5 h-3.5 text-[#5C4FE5]" />
                                : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                              <span className="text-sm font-semibold text-[#1A1640]">{uGroup.unit}</span>
                            </div>
                            <span className="text-xs text-[#7B78A8]">{uGroup.items.length} materi</span>
                          </button>

                          {/* Materials */}
                          {isUOpen && (
                            <div className="divide-y divide-[#F7F6FF] bg-[#FAFAFE]">
                              {uGroup.items.map(material => {
                                const status = canAccess(material)
                                return (
                                  <div key={material.id}
                                    className="flex items-center justify-between pl-14 pr-5 py-3 hover:bg-[#F0EFFF] transition-colors">
                                    <div className="flex-1 min-w-0 mr-3">
                                      <p className={`text-sm font-semibold truncate ${status === 'allowed' ? 'text-[#5C4FE5]' : 'text-gray-400'}`}>
                                        {material.lesson_name || material.title}
                                      </p>
                                    </div>
                                    <button onClick={() => openMaterial(material)}
                                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex-shrink-0
                                        ${status === 'allowed'
                                          ? 'bg-[#5C4FE5] text-white hover:bg-[#4a3ec7]'
                                          : status === 'time_locked'
                                          ? 'bg-yellow-100 text-yellow-700 cursor-not-allowed'
                                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
                                      {status === 'allowed'
                                        ? <><ExternalLink className="w-3 h-3" />Buka</>
                                        : status === 'time_locked'
                                        ? <><Clock className="w-3 h-3" />Terkunci</>
                                        : <><Lock className="w-3 h-3" />Belum Tersedia</>}
                                    </button>
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

      {/* Embed Modal */}
      {embedModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900 truncate">{embedModal.title}</h2>
              <button onClick={() => setEmbedModal({ open: false, url: '', title: '', loading: false })}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden rounded-b-2xl">
              {embedModal.loading
                ? <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-10 h-10 animate-spin text-[#5C4FE5]" />
                  </div>
                : <iframe src={embedModal.url} className="w-full h-full border-0" title={embedModal.title} allowFullScreen />}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
