'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Plus, BookOpen, Video, Eye, EyeOff, Pencil, Trash2,
  X, Save, ChevronUp, ChevronDown, Search,
  GripVertical, AlertCircle, CheckCircle2,
  BookMarked, Headphones, GraduationCap
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Course {
  id: string
  name: string
  color: string
}

interface CurriculumUnit {
  id: string
  course_id: string
  unit_number: number
  unit_name: string
}

interface Materi {
  id: string
  title: string
  type: 'live_zoom' | 'bacaan_interaktif' | 'kosa_kata' | 'cefr'
  curriculum_unit_id: string | null
  lesson_number: number | null
  lesson_name: string | null
  order_number: number | null
  
  // Type-specific
  component_id: string | null
  canva_embed_url: string | null
  scheduled_at: string | null
  gdrive_url: string | null
  
  is_published: boolean
  created_at: string
  created_by: string | null
  curriculum_units: { id: string; unit_number: number; unit_name: string; course_id: string } | null
  courses: { id: string; name: string; color: string } | null
  profiles: { full_name: string } | null
}

interface FormData {
  title: string
  type: 'live_zoom' | 'bacaan_interaktif' | 'kosa_kata' | 'cefr'
  course_id: string
  curriculum_unit_id: string
  lesson_number: string
  lesson_name: string
  order_number: string
  
  component_id: string
  canva_embed_url: string
  scheduled_at: string
  gdrive_url: string
  
  is_published: boolean
}

const EMPTY_FORM: FormData = {
  title: '',
  type: 'live_zoom',
  course_id: '',
  curriculum_unit_id: '',
  lesson_number: '',
  lesson_name: '',
  order_number: '',
  component_id: '',
  canva_embed_url: '',
  scheduled_at: '',
  gdrive_url: '',
  is_published: false,
}

// ─── Component Registry ───────────────────────────────────────────────────────

const BACAAN_COMPONENTS = [
  { id: 'bunyi_ei', label: 'Bunyi /eɪ/ - Phonics' },
  { id: 'bunyi_ai', label: 'Bunyi /aɪ/ - Phonics' },
  { id: 'bunyi_ou', label: 'Bunyi /oʊ/ - Phonics' },
  { id: 'pronounce_th', label: 'Pronunciation: TH Sound' },
  { id: 'pronounce_r', label: 'Pronunciation: R Sound' },
  { id: 'pos_noun', label: 'Part of Speech: Noun' },
  { id: 'pos_verb', label: 'Part of Speech: Verb' },
  { id: 'pos_adjective', label: 'Part of Speech: Adjective' },
  { id: 'tenses_present_simple', label: 'Tenses: Present Simple' },
  { id: 'tenses_past_simple', label: 'Tenses: Past Simple' },
  { id: 'tenses_present_continuous', label: 'Tenses: Present Continuous' },
]

const CEFR_COMPONENTS = [
  { id: 'cefr_a1_reading_1', label: 'A1 Reading: Simple Texts' },
  { id: 'cefr_a1_reading_2', label: 'A1 Reading: Personal Info' },
  { id: 'cefr_a1_listening_1', label: 'A1 Listening: Greetings' },
  { id: 'cefr_a2_reading_1', label: 'A2 Reading: Daily Routine' },
  { id: 'cefr_a2_writing_1', label: 'A2 Writing: Short Messages' },
  { id: 'cefr_b1_reading_1', label: 'B1 Reading: Articles' },
  { id: 'cefr_b1_speaking_1', label: 'B1 Speaking: Conversations' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function typeLabel(type: string) {
  switch (type) {
    case 'live_zoom': return 'Live Zoom'
    case 'bacaan_interaktif': return 'Bacaan Interaktif'
    case 'kosa_kata': return 'Kosa Kata'
    case 'cefr': return 'CEFR'
    default: return type
  }
}

function typeBadgeCls(type: string) {
  switch (type) {
    case 'live_zoom': return 'bg-[#FFF8D6] text-[#8A6D00]'
    case 'bacaan_interaktif': return 'bg-[#EAE8FD] text-[#5C4FE5]'
    case 'kosa_kata': return 'bg-[#E8F5E9] text-[#2E7D32]'
    case 'cefr': return 'bg-[#FFE4E1] text-[#C62828]'
    default: return 'bg-gray-100 text-gray-700'
  }
}

function typeIcon(type: string, size = 14) {
  switch (type) {
    case 'live_zoom': return <Video size={size} />
    case 'bacaan_interaktif': return <BookMarked size={size} />
    case 'kosa_kata': return <Headphones size={size} />
    case 'cefr': return <GraduationCap size={size} />
    default: return <BookOpen size={size} />
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminMateriPage() {
  const supabase = createClient()

  // Data
  const [materiList, setMateriList] = useState<Materi[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [allUnits, setAllUnits] = useState<CurriculumUnit[]>([])
  const [loading, setLoading] = useState(true)
  const [myProfileId, setMyProfileId] = useState<string | null>(null)

  // Filter
  const [search, setSearch] = useState('')
  const [filterCourse, setFilterCourse] = useState('semua')
  const [activeTab, setActiveTab] = useState<'live_zoom' | 'bacaan_interaktif' | 'kosa_kata' | 'cefr'>('live_zoom')
  const [filterStatus, setFilterStatus] = useState('semua')

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteTitle, setDeleteTitle] = useState('')
  const [deleting, setDeleting] = useState(false)

  // ── Fetch ────────────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    setLoading(true)

    const [{ data: mat }, { data: crs }, { data: units }, { data: { user } }] = await Promise.all([
      supabase
        .from('materials')
        .select(`
          id, title, type, curriculum_unit_id, lesson_number, lesson_name,
          order_number, component_id, canva_embed_url, scheduled_at, gdrive_url,
          is_published, created_at, created_by,
          curriculum_units(id, unit_number, unit_name, course_id),
          profiles!materials_created_by_fkey(full_name)
        `)
        .order('order_number', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false }),
      supabase.from('courses').select('id, name, color').eq('is_active', true).order('name'),
      supabase.from('curriculum_units').select('id, course_id, unit_number, unit_name').eq('is_active', true).order('unit_number'),
      supabase.auth.getUser(),
    ])

    // Flatten joins
    const flatMat = (mat ?? []).map((m: any) => {
      const unit = Array.isArray(m.curriculum_units) ? m.curriculum_units[0] ?? null : m.curriculum_units
      return {
        ...m,
        curriculum_units: unit,
        courses: unit ? { id: unit.course_id, name: '', color: '' } : null, // Will be populated from courses
        profiles: Array.isArray(m.profiles) ? m.profiles[0] ?? null : m.profiles,
      }
    })

    // Populate course info
    const coursesMap = new Map((crs ?? []).map((c: Course) => [c.id, c]))
    flatMat.forEach((m: any) => {
      if (m.curriculum_units?.course_id) {
        m.courses = coursesMap.get(m.curriculum_units.course_id) ?? null
      }
    })

    setMateriList(flatMat as Materi[])
    setCourses((crs ?? []) as Course[])
    setAllUnits((units ?? []) as CurriculumUnit[])
    setMyProfileId(user?.id ?? null)
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // ── Filter ───────────────────────────────────────────────────────────────────

  const filtered = materiList.filter((m) => {
    const matchSearch = search === '' || m.title.toLowerCase().includes(search.toLowerCase())
    const matchCourse = filterCourse === 'semua' || m.curriculum_units?.course_id === filterCourse
    const matchType = m.type === activeTab
    const matchStatus =
      filterStatus === 'semua' ||
      (filterStatus === 'published' && m.is_published) ||
      (filterStatus === 'draft' && !m.is_published)
    return matchSearch && matchCourse && matchType && matchStatus
  })

  // Get units for selected course in form
  const availableUnits = allUnits.filter((u) => !form.course_id || u.course_id === form.course_id)

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function openDrawer(id?: string) {
    if (id) {
      const m = materiList.find((x) => x.id === id)
      if (!m) return
      setEditingId(id)
      setForm({
        title: m.title,
        type: m.type,
        course_id: m.curriculum_units?.course_id ?? '',
        curriculum_unit_id: m.curriculum_unit_id ?? '',
        lesson_number: m.lesson_number?.toString() ?? '',
        lesson_name: m.lesson_name ?? '',
        order_number: m.order_number?.toString() ?? '',
        component_id: m.component_id ?? '',
        canva_embed_url: m.canva_embed_url ?? '',
        scheduled_at: m.scheduled_at ?? '',
        gdrive_url: m.gdrive_url ?? '',
        is_published: m.is_published,
      })
    } else {
      setEditingId(null)
      setForm({ ...EMPTY_FORM, type: activeTab })
    }
    setSaveError('')
    setSaveSuccess(false)
    setDrawerOpen(true)
  }

  async function handleSave() {
    // Validation
    if (!form.title.trim()) {
      setSaveError('Judul harus diisi')
      return
    }
    if (!form.curriculum_unit_id) {
      setSaveError('Unit harus dipilih')
      return
    }
    if (!form.lesson_number || parseInt(form.lesson_number) < 1) {
      setSaveError('Lesson Number harus diisi (minimal 1)')
      return
    }

    // Type-specific validation
    if (form.type === 'live_zoom' && !form.canva_embed_url.trim()) {
      setSaveError('URL Embed Canva harus diisi')
      return
    }
    if (form.type === 'bacaan_interaktif' && !form.component_id) {
      setSaveError('Component ID harus dipilih')
      return
    }
    if (form.type === 'kosa_kata' && !form.gdrive_url.trim()) {
      setSaveError('Google Drive URL harus diisi')
      return
    }
    if (form.type === 'cefr' && !form.component_id) {
      setSaveError('Component ID harus dipilih')
      return
    }

    setSaving(true)
    setSaveError('')
    setSaveSuccess(false)

    const payload: any = {
      title: form.title.trim(),
      type: form.type,
      curriculum_unit_id: form.curriculum_unit_id,
      lesson_number: parseInt(form.lesson_number),
      lesson_name: form.lesson_name.trim() || null,
      order_number: form.order_number ? parseInt(form.order_number) : null,
      is_published: form.is_published,

      // Clear all optional fields
      component_id: null,
      canva_embed_url: null,
      scheduled_at: null,
      gdrive_url: null,
    }

    // Set type-specific fields
    if (form.type === 'live_zoom') {
      payload.canva_embed_url = form.canva_embed_url.trim()
      payload.scheduled_at = form.scheduled_at || null
    }
    if (form.type === 'bacaan_interaktif' || form.type === 'cefr') {
      payload.component_id = form.component_id
    }
    if (form.type === 'kosa_kata') {
      payload.gdrive_url = form.gdrive_url.trim()
    }

    if (!editingId) {
      payload.created_by = myProfileId
    }

    const { error } = editingId
      ? await supabase.from('materials').update(payload).eq('id', editingId)
      : await supabase.from('materials').insert([payload])

    setSaving(false)

    if (error) {
      setSaveError(error.message)
      return
    }

    setSaveSuccess(true)
    setTimeout(() => {
      setDrawerOpen(false)
      fetchAll()
    }, 800)
  }

  async function confirmDelete() {
    if (!deleteId) return
    setDeleting(true)
    const { error } = await supabase.from('materials').delete().eq('id', deleteId)
    setDeleting(false)
    if (error) {
      alert('Gagal menghapus: ' + error.message)
      return
    }
    setDeleteId(null)
    fetchAll()
  }

  async function togglePublish(id: string, currentStatus: boolean) {
    await supabase.from('materials').update({ is_published: !currentStatus }).eq('id', id)
    fetchAll()
  }

  async function moveOrder(id: string, direction: 'up' | 'down') {
    const idx = filtered.findIndex((m) => m.id === id)
    if (idx === -1) return
    if (direction === 'up' && idx === 0) return
    if (direction === 'down' && idx === filtered.length - 1) return

    const current = filtered[idx]
    const target = direction === 'up' ? filtered[idx - 1] : filtered[idx + 1]

    const tempOrder = current.order_number
    await supabase.from('materials').update({ order_number: target.order_number }).eq('id', current.id)
    await supabase.from('materials').update({ order_number: tempOrder }).eq('id', target.id)
    fetchAll()
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F6FF] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-[#5C4FE5] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-[13px] text-[#9B97B2]">Memuat materi...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F7F6FF] pb-20">
      {/* HEADER */}
      <div className="bg-white border-b border-[#E5E3FF] sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-[20px] font-black text-[#1A1530]">Materi Pembelajaran</h1>
              <p className="text-[12px] text-[#9B97B2] mt-0.5">Kelola konten dengan struktur Unit-Lesson</p>
            </div>
            <button
              onClick={() => openDrawer()}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#5C4FE5] hover:bg-[#4338CA] text-white rounded-xl text-[13px] font-bold transition-colors"
            >
              <Plus size={14} />
              Tambah Materi
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 border-b border-[#E5E3FF] -mb-px">
            {[
              { key: 'live_zoom' as const, label: 'Live Zoom', icon: Video },
              { key: 'bacaan_interaktif' as const, label: 'Bacaan Interaktif', icon: BookMarked },
              { key: 'kosa_kata' as const, label: 'Kosa Kata', icon: Headphones },
              { key: 'cefr' as const, label: 'CEFR', icon: GraduationCap },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2.5 text-[13px] font-bold transition-all border-b-2 ${
                  activeTab === tab.key ? 'border-[#5C4FE5] text-[#5C4FE5]' : 'border-transparent text-[#9B97B2] hover:text-[#5C4FE5]'
                }`}
              >
                <tab.icon size={14} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* FILTERS */}
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9B97B2]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari materi..."
              className="w-full pl-9 pr-3 py-2 border border-[#E5E3FF] rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-[#5C4FE5] focus:border-transparent"
            />
          </div>
          <select
            value={filterCourse}
            onChange={(e) => setFilterCourse(e.target.value)}
            className="px-3 py-2 border border-[#E5E3FF] rounded-xl text-[13px] font-medium text-[#4A4580] focus:outline-none focus:ring-2 focus:ring-[#5C4FE5]"
          >
            <option value="semua">Semua Pelajaran</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-[#E5E3FF] rounded-xl text-[13px] font-medium text-[#4A4580] focus:outline-none focus:ring-2 focus:ring-[#5C4FE5]"
          >
            <option value="semua">Semua Status</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>
        </div>
      </div>

      {/* MATERI LIST */}
      <div className="max-w-7xl mx-auto px-6">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E5E3FF] p-12 text-center">
            <div className="w-16 h-16 bg-[#F7F6FF] rounded-full flex items-center justify-center mx-auto mb-4">
              {typeIcon(activeTab, 24)}
            </div>
            <h3 className="text-[15px] font-bold text-[#1A1530] mb-1">Belum ada materi {typeLabel(activeTab)}</h3>
            <p className="text-[12px] text-[#9B97B2] mb-4">Klik tombol "Tambah Materi" untuk membuat yang pertama</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((m, idx) => (
              <div key={m.id} className="bg-white rounded-xl border border-[#E5E3FF] p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-start gap-3">
                  {/* Drag handle */}
                  <div className="flex flex-col gap-1 pt-1">
                    <button
                      onClick={() => moveOrder(m.id, 'up')}
                      disabled={idx === 0}
                      className="text-[#9B97B2] hover:text-[#5C4FE5] disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <GripVertical size={14} className="text-[#E5E3FF]" />
                    <button
                      onClick={() => moveOrder(m.id, 'down')}
                      disabled={idx === filtered.length - 1}
                      className="text-[#9B97B2] hover:text-[#5C4FE5] disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 mb-2">
                      <span className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold ${typeBadgeCls(m.type)}`}>
                        {typeIcon(m.type, 11)}
                        {typeLabel(m.type)}
                      </span>
                      {m.curriculum_units && (
                        <span className="px-2 py-1 bg-[#F7F6FF] text-[#5C4FE5] rounded-lg text-[10px] font-bold">
                          Unit {m.curriculum_units.unit_number}
                        </span>
                      )}
                      {m.lesson_number && (
                        <span className="px-2 py-1 bg-[#FFF8D6] text-[#8A6D00] rounded-lg text-[10px] font-bold">
                          Lesson {m.lesson_number}
                        </span>
                      )}
                    </div>
                    <h3 className="text-[14px] font-bold text-[#1A1530] mb-1">{m.title}</h3>
                    <div className="flex flex-wrap gap-2 text-[11px] text-[#9B97B2]">
                      {m.courses && (
                        <span className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full" style={{ background: m.courses.color }} />
                          {m.courses.name}
                        </span>
                      )}
                      {m.curriculum_units && <span>• {m.curriculum_units.unit_name}</span>}
                      {m.lesson_name && <span>• {m.lesson_name}</span>}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => togglePublish(m.id, m.is_published)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        m.is_published ? 'bg-green-50 text-green-600 hover:bg-green-100' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                      }`}
                      title={m.is_published ? 'Published' : 'Draft'}
                    >
                      {m.is_published ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>
                    <button
                      onClick={() => openDrawer(m.id)}
                      className="p-1.5 rounded-lg bg-[#F7F6FF] text-[#5C4FE5] hover:bg-[#EAE8FD] transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => {
                        setDeleteId(m.id)
                        setDeleteTitle(m.title)
                      }}
                      className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* DRAWER FORM */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 flex items-end justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setDrawerOpen(false)} />

          <div className="relative bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E3FF] flex-shrink-0">
              <div>
                <h2 className="text-[16px] font-black text-[#1A1530]">{editingId ? 'Edit Materi' : 'Tambah Materi Baru'}</h2>
                <p className="text-[11px] text-[#9B97B2] mt-0.5">{typeLabel(form.type)}</p>
              </div>
              <button onClick={() => setDrawerOpen(false)} className="p-2 rounded-lg hover:bg-[#F7F6FF] transition-colors">
                <X size={18} className="text-[#9B97B2]" />
              </button>
            </div>

            {/* Form Body */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-[12px] font-bold text-[#4A4580] mb-1.5">Judul Materi *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Contoh: Core sentence pattern: S + be + noun/adjective"
                  className="w-full px-3 py-2.5 border border-[#E5E3FF] rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-[#5C4FE5]"
                />
              </div>

              {/* Course */}
              <div>
                <label className="block text-[12px] font-bold text-[#4A4580] mb-1.5">Pelajaran *</label>
                <select
                  value={form.course_id}
                  onChange={(e) => setForm({ ...form, course_id: e.target.value, curriculum_unit_id: '' })}
                  className="w-full px-3 py-2.5 border border-[#E5E3FF] rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-[#5C4FE5]"
                >
                  <option value="">Pilih Pelajaran</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Unit */}
              <div>
                <label className="block text-[12px] font-bold text-[#4A4580] mb-1.5">Unit *</label>
                <select
                  value={form.curriculum_unit_id}
                  onChange={(e) => setForm({ ...form, curriculum_unit_id: e.target.value })}
                  disabled={!form.course_id}
                  className="w-full px-3 py-2.5 border border-[#E5E3FF] rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-[#5C4FE5] disabled:bg-gray-50 disabled:cursor-not-allowed"
                >
                  <option value="">Pilih Unit</option>
                  {availableUnits.map((u) => (
                    <option key={u.id} value={u.id}>
                      Unit {u.unit_number} - {u.unit_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Lesson Number & Name */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-bold text-[#4A4580] mb-1.5">Lesson Number *</label>
                  <input
                    type="number"
                    value={form.lesson_number}
                    onChange={(e) => setForm({ ...form, lesson_number: e.target.value })}
                    placeholder="1, 2, 3, ..."
                    className="w-full px-3 py-2.5 border border-[#E5E3FF] rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-[#5C4FE5]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-bold text-[#4A4580] mb-1.5">Lesson Name</label>
                  <input
                    type="text"
                    value={form.lesson_name}
                    onChange={(e) => setForm({ ...form, lesson_name: e.target.value })}
                    placeholder="Opsional"
                    className="w-full px-3 py-2.5 border border-[#E5E3FF] rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-[#5C4FE5]"
                  />
                </div>
              </div>

              {/* Order Number */}
              <div>
                <label className="block text-[12px] font-bold text-[#4A4580] mb-1.5">Urutan</label>
                <input
                  type="number"
                  value={form.order_number}
                  onChange={(e) => setForm({ ...form, order_number: e.target.value })}
                  placeholder="Opsional (untuk custom sorting)"
                  className="w-full px-3 py-2.5 border border-[#E5E3FF] rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-[#5C4FE5]"
                />
              </div>

              {/* TAB: LIVE ZOOM */}
              {form.type === 'live_zoom' && (
                <>
                  <div>
                    <label className="block text-[12px] font-bold text-[#4A4580] mb-1.5">URL Embed Canva *</label>
                    <input
                      type="url"
                      value={form.canva_embed_url}
                      onChange={(e) => setForm({ ...form, canva_embed_url: e.target.value })}
                      placeholder="https://www.canva.com/design/..."
                      className="w-full px-3 py-2.5 border border-[#E5E3FF] rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-[#5C4FE5]"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-bold text-[#4A4580] mb-1.5">Jadwal Tayang</label>
                    <input
                      type="datetime-local"
                      value={form.scheduled_at}
                      onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
                      className="w-full px-3 py-2.5 border border-[#E5E3FF] rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-[#5C4FE5]"
                    />
                  </div>
                </>
              )}

              {/* TAB: BACAAN INTERAKTIF */}
              {form.type === 'bacaan_interaktif' && (
                <div>
                  <label className="block text-[12px] font-bold text-[#4A4580] mb-1.5">Component ID *</label>
                  <select
                    value={form.component_id}
                    onChange={(e) => setForm({ ...form, component_id: e.target.value })}
                    className="w-full px-3 py-2.5 border border-[#E5E3FF] rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-[#5C4FE5]"
                  >
                    <option value="">Pilih Component</option>
                    {BACAAN_COMPONENTS.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* TAB: KOSA KATA */}
              {form.type === 'kosa_kata' && (
                <div>
                  <label className="block text-[12px] font-bold text-[#4A4580] mb-1.5">Google Drive URL *</label>
                  <input
                    type="url"
                    value={form.gdrive_url}
                    onChange={(e) => setForm({ ...form, gdrive_url: e.target.value })}
                    placeholder="https://drive.google.com/file/d/..."
                    className="w-full px-3 py-2.5 border border-[#E5E3FF] rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-[#5C4FE5]"
                  />
                  <p className="text-[11px] text-[#9B97B2] mt-1.5">
                    Link ke file Google Drive yang berisi kosa kata (pastikan set ke "Anyone with the link can view")
                  </p>
                </div>
              )}

              {/* TAB: CEFR */}
              {form.type === 'cefr' && (
                <div>
                  <label className="block text-[12px] font-bold text-[#4A4580] mb-1.5">Component ID *</label>
                  <select
                    value={form.component_id}
                    onChange={(e) => setForm({ ...form, component_id: e.target.value })}
                    className="w-full px-3 py-2.5 border border-[#E5E3FF] rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-[#5C4FE5]"
                  >
                    <option value="">Pilih Component</option>
                    {CEFR_COMPONENTS.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Published Toggle */}
              <div className="flex items-center gap-2 bg-[#F7F6FF] rounded-xl p-3">
                <input
                  type="checkbox"
                  id="is-published"
                  checked={form.is_published}
                  onChange={(e) => setForm({ ...form, is_published: e.target.checked })}
                  className="w-4 h-4 text-[#5C4FE5] border-[#E5E3FF] rounded focus:ring-2 focus:ring-[#5C4FE5]"
                />
                <label htmlFor="is-published" className="text-[13px] font-bold text-[#4A4580] cursor-pointer">
                  Publish materi (siswa dapat melihat)
                </label>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-[#E5E3FF] px-6 py-4 flex-shrink-0">
              {saveError && (
                <div className="flex items-center gap-2 text-[11px] text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5 mb-3">
                  <AlertCircle size={13} />
                  {saveError}
                </div>
              )}
              {saveSuccess && (
                <div className="flex items-center gap-2 text-[11px] text-green-700 bg-green-50 border border-green-100 rounded-xl px-3 py-2.5 mb-3">
                  <CheckCircle2 size={13} />
                  Berhasil disimpan!
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => setDrawerOpen(false)}
                  disabled={saving}
                  className="flex-1 py-2.5 border border-[#E5E3FF] rounded-xl text-[13px] font-bold text-[#4A4580] hover:bg-[#F7F6FF] transition-colors disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-2.5 bg-[#5C4FE5] hover:bg-[#4338CA] text-white rounded-xl text-[13px] font-bold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Menyimpan…
                    </>
                  ) : (
                    <>
                      <Save size={13} /> {editingId ? 'Perbarui' : 'Simpan'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 size={18} className="text-red-500" />
            </div>
            <h3 className="text-[15px] font-bold text-[#1A1530] text-center mb-1">Hapus Materi?</h3>
            <p className="text-[12px] text-[#9B97B2] text-center mb-5">
              <strong className="text-[#1A1530]">"{deleteTitle}"</strong> akan dihapus permanen.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                disabled={deleting}
                className="flex-1 py-2.5 border border-[#E5E3FF] rounded-xl text-[13px] font-bold text-[#4A4580] hover:bg-[#F7F6FF] transition-colors"
              >
                Batal
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-[13px] font-bold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Menghapus…
                  </>
                ) : (
                  <>
                    <Trash2 size={13} />
                    Hapus
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
