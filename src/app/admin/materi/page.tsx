'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Plus, BookOpen, Video, Eye, EyeOff, Pencil, Trash2,
  X, Save, ExternalLink, ChevronUp, ChevronDown, Search,
  GripVertical, Globe, AlertCircle, CheckCircle2, Monitor
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Course {
  id: string
  name: string
  color: string
}

interface ClassGroup {
  id: string
  label: string
  course_id: string | null
  courses: { name: string; color: string } | null
}

interface Materi {
  id: string
  title: string
  type: 'bacaan' | 'live_zoom'
  order_number: number | null
  content: string | null
  url: string | null
  is_published: boolean
  created_at: string
  course_id: string | null
  class_group_id: string | null
  session_id: string | null
  created_by: string | null
  courses: { id: string; name: string; color: string } | null
  class_groups: { id: string; label: string } | null
  profiles: { full_name: string } | null
}

interface FormData {
  title: string
  type: 'bacaan' | 'live_zoom'
  course_id: string
  class_group_id: string
  order_number: string
  content: string
  url: string
  is_published: boolean
}

const EMPTY_FORM: FormData = {
  title: '',
  type: 'bacaan',
  course_id: '',
  class_group_id: '',
  order_number: '',
  content: '',
  url: '',
  is_published: false,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function typeLabel(type: string) {
  return type === 'bacaan' ? 'Bacaan' : 'Live Zoom'
}

function typeBadgeCls(type: string) {
  return type === 'bacaan'
    ? 'bg-[#EAE8FD] text-[#5C4FE5]'
    : 'bg-[#FFF8D6] text-[#8A6D00]'
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminMateriPage() {
  const supabase = createClient()

  // Data
  const [materiList,  setMateriList]  = useState<Materi[]>([])
  const [courses,     setCourses]     = useState<Course[]>([])
  const [classGroups, setClassGroups] = useState<ClassGroup[]>([])
  const [loading,     setLoading]     = useState(true)
  const [myProfileId, setMyProfileId] = useState<string | null>(null)

  // Filter / search
  const [search,       setSearch]       = useState('')
  const [filterCourse, setFilterCourse] = useState('semua')
  const [filterType,   setFilterType]   = useState('semua')
  const [filterStatus, setFilterStatus] = useState('semua')

  // Drawer
  const [drawerOpen,   setDrawerOpen]   = useState(false)
  const [editingId,    setEditingId]    = useState<string | null>(null)
  const [form,         setForm]         = useState<FormData>(EMPTY_FORM)
  const [saving,       setSaving]       = useState(false)
  const [saveError,    setSaveError]    = useState('')
  const [saveSuccess,  setSaveSuccess]  = useState(false)

  // Preview
  const [showPreview,  setShowPreview]  = useState(false)

  // Delete confirm
  const [deleteId,    setDeleteId]    = useState<string | null>(null)
  const [deleteTitle, setDeleteTitle] = useState('')
  const [deleting,    setDeleting]    = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // ── Fetch ────────────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    setLoading(true)

    const [{ data: mat }, { data: crs }, { data: cg }, { data: { user } }] =
      await Promise.all([
        supabase
          .from('materials')
          .select(`
            id, title, type, order_number, content, url,
            is_published, created_at, course_id, class_group_id,
            session_id, created_by,
            courses(id, name, color),
            class_groups(id, label),
            profiles!materials_created_by_fkey(full_name)
          `)
          .order('order_number', { ascending: true, nullsFirst: false })
          .order('created_at', { ascending: false }),
        supabase.from('courses').select('id, name, color').order('name'),
        supabase
          .from('class_groups')
          .select('id, label, course_id, courses(name, color)')
          .eq('status', 'active')
          .order('label'),
        supabase.auth.getUser(),
      ])

    // Flatten Supabase join arrays → single object (Supabase kadang return array)
    const flatMat = (mat ?? []).map((m: any) => ({
      ...m,
      courses:      Array.isArray(m.courses)      ? m.courses[0]      ?? null : m.courses,
      class_groups: Array.isArray(m.class_groups) ? m.class_groups[0] ?? null : m.class_groups,
      profiles:     Array.isArray(m.profiles)     ? m.profiles[0]     ?? null : m.profiles,
    }))
    const flatCG = (cg ?? []).map((c: any) => ({
      ...c,
      courses: Array.isArray(c.courses) ? c.courses[0] ?? null : c.courses,
    }))

    setMateriList(flatMat as Materi[])
    setCourses((crs ?? []) as Course[])
    setClassGroups(flatCG as ClassGroup[])
    setMyProfileId(user?.id ?? null)
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── Filter ───────────────────────────────────────────────────────────────────

  const filtered = materiList.filter(m => {
    const matchSearch = search === '' ||
      m.title.toLowerCase().includes(search.toLowerCase())
    const matchCourse = filterCourse === 'semua' || m.course_id === filterCourse
    const matchType   = filterType   === 'semua' || m.type === filterType
    const matchStatus = filterStatus === 'semua' ||
      (filterStatus === 'published' ? m.is_published : !m.is_published)
    return matchSearch && matchCourse && matchType && matchStatus
  })

  // ── Form helpers ─────────────────────────────────────────────────────────────

  function openCreate() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setSaveError('')
    setSaveSuccess(false)
    setShowPreview(false)
    setDrawerOpen(true)
  }

  function openEdit(m: Materi) {
    setEditingId(m.id)
    setForm({
      title:          m.title,
      type:           m.type,
      course_id:      m.course_id ?? '',
      class_group_id: m.class_group_id ?? '',
      order_number:   m.order_number?.toString() ?? '',
      content:        m.content ?? '',
      url:            m.url ?? '',
      is_published:   m.is_published,
    })
    setSaveError('')
    setSaveSuccess(false)
    setShowPreview(false)
    setDrawerOpen(true)
  }

  function handleChange(field: keyof FormData, value: string | boolean) {
    setForm(prev => ({ ...prev, [field]: value }))
    setSaveSuccess(false)
  }

  // ── Save ─────────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!form.title.trim()) {
      setSaveError('Judul materi tidak boleh kosong.')
      return
    }
    if (form.type === 'live_zoom' && !form.url.trim()) {
      setSaveError('URL Google Drive wajib diisi untuk tipe Live Zoom.')
      return
    }

    setSaving(true)
    setSaveError('')

    const payload = {
      title:          form.title.trim(),
      type:           form.type,
      course_id:      form.course_id   || null,
      class_group_id: form.class_group_id || null,
      order_number:   form.order_number ? parseInt(form.order_number) : null,
      content:        form.type === 'bacaan'    ? form.content || null : null,
      url:            form.type === 'live_zoom' ? form.url.trim() || null : null,
      is_published:   form.is_published,
      updated_at:     new Date().toISOString(),
    }

    let error: any
    if (editingId) {
      ;({ error } = await supabase.from('materials').update(payload).eq('id', editingId))
    } else {
      ;({ error } = await supabase.from('materials').insert({
        ...payload,
        created_by: myProfileId,
      }))
    }

    setSaving(false)

    if (error) {
      setSaveError(error.message)
      return
    }

    setSaveSuccess(true)
    await fetchAll()

    // Auto-close setelah 1 detik kalau baru buat
    if (!editingId) {
      setTimeout(() => {
        setDrawerOpen(false)
        setSaveSuccess(false)
      }, 800)
    }
  }

  // ── Toggle publish ────────────────────────────────────────────────────────────

  async function togglePublish(m: Materi) {
    await supabase
      .from('materials')
      .update({ is_published: !m.is_published, updated_at: new Date().toISOString() })
      .eq('id', m.id)
    setMateriList(prev =>
      prev.map(x => x.id === m.id ? { ...x, is_published: !m.is_published } : x)
    )
  }

  // ── Reorder ───────────────────────────────────────────────────────────────────

  async function moveOrder(m: Materi, dir: -1 | 1) {
    const idx = materiList.findIndex(x => x.id === m.id)
    const swap = materiList[idx + dir]
    if (!swap) return

    const aOrd = m.order_number ?? idx + 1
    const bOrd = swap.order_number ?? idx + dir + 1

    await Promise.all([
      supabase.from('materials').update({ order_number: bOrd }).eq('id', m.id),
      supabase.from('materials').update({ order_number: aOrd }).eq('id', swap.id),
    ])
    fetchAll()
  }

  // ── Delete ────────────────────────────────────────────────────────────────────

  async function confirmDelete() {
    if (!deleteId) return
    setDeleting(true)
    await supabase.from('materials').delete().eq('id', deleteId)
    setDeleting(false)
    setDeleteId(null)
    fetchAll()
  }

  // ── Grouped by course ─────────────────────────────────────────────────────────

  const grouped: Record<string, { course: Course | null; items: Materi[] }> = {}
  filtered.forEach(m => {
    const key = m.course_id ?? 'umum'
    if (!grouped[key]) {
      grouped[key] = {
        course: courses.find(c => c.id === key) ?? null,
        items: [],
      }
    }
    grouped[key].items.push(m)
  })

  // ── Filtered classGroups by selected course ───────────────────────────────────

  const filteredCG = form.course_id
    ? classGroups.filter(cg => cg.course_id === form.course_id)
    : classGroups

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full">

      {/* ── PAGE HEADER ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-[#1A1530]">Materi</h1>
          <p className="text-[12px] text-[#9B97B2] mt-0.5">
            {materiList.length} materi · {materiList.filter(m => m.is_published).length} dipublikasi
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#5C4FE5] hover:bg-[#4338CA] text-white text-[13px] font-bold rounded-xl transition-colors"
        >
          <Plus size={15} />
          Tambah Materi
        </button>
      </div>

      {/* ── FILTER BAR ── */}
      <div className="bg-white border border-[#E5E3FF] rounded-2xl p-4 mb-5 flex flex-wrap gap-3 items-center">
        {/* Search */}
        <div className="flex items-center gap-2 flex-1 min-w-[200px] bg-[#F7F6FF] border border-[#E5E3FF] rounded-xl px-3 py-2">
          <Search size={13} className="text-[#9B97B2] flex-shrink-0" />
          <input
            type="text"
            placeholder="Cari judul materi…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 text-[13px] bg-transparent outline-none text-[#1A1530] placeholder:text-[#9B97B2]"
          />
        </div>

        {/* Course filter */}
        <select
          value={filterCourse}
          onChange={e => setFilterCourse(e.target.value)}
          className="text-[12px] font-semibold bg-[#F7F6FF] border border-[#E5E3FF] rounded-xl px-3 py-2 text-[#4A4580] outline-none cursor-pointer"
        >
          <option value="semua">Semua Mata Pelajaran</option>
          {courses.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {/* Type filter */}
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="text-[12px] font-semibold bg-[#F7F6FF] border border-[#E5E3FF] rounded-xl px-3 py-2 text-[#4A4580] outline-none cursor-pointer"
        >
          <option value="semua">Semua Tipe</option>
          <option value="bacaan">Bacaan</option>
          <option value="live_zoom">Live Zoom</option>
        </select>

        {/* Status filter */}
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="text-[12px] font-semibold bg-[#F7F6FF] border border-[#E5E3FF] rounded-xl px-3 py-2 text-[#4A4580] outline-none cursor-pointer"
        >
          <option value="semua">Semua Status</option>
          <option value="published">Dipublikasi</option>
          <option value="draft">Draft</option>
        </select>
      </div>

      {/* ── CONTENT ── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-[#5C4FE5] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-[#E5E3FF] rounded-2xl py-16 text-center">
          <BookOpen size={32} className="text-[#C8C5E8] mx-auto mb-3" />
          <p className="text-[14px] font-bold text-[#9B97B2]">Belum ada materi</p>
          <p className="text-[12px] text-[#9B97B2] mt-1">Klik "Tambah Materi" untuk mulai membuat konten</p>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).map(([key, { course, items }]) => (
            <div key={key} className="bg-white border border-[#E5E3FF] rounded-2xl overflow-hidden">
              {/* Group header */}
              <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[#E5E3FF] bg-[#F7F6FF]">
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: course?.color ?? '#9B97B2' }}
                />
                <span className="text-[13px] font-bold text-[#1A1530]">
                  {course?.name ?? 'Umum'}
                </span>
                <span className="text-[11px] text-[#9B97B2]">{items.length} materi</span>
                <span className="text-[11px] text-green-600 ml-auto">
                  {items.filter(m => m.is_published).length} dipublikasi
                </span>
              </div>

              {/* Materi rows */}
              <div className="divide-y divide-[#F0EFFE]">
                {items.map((m, idx) => (
                  <div key={m.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#FDFCFF] transition-colors group">

                    {/* Order controls */}
                    <div className="flex flex-col gap-0.5 flex-shrink-0">
                      <button
                        onClick={() => moveOrder(m, -1)}
                        disabled={idx === 0}
                        className="w-5 h-5 flex items-center justify-center rounded text-[#C8C5E8] hover:text-[#5C4FE5] disabled:opacity-30 transition-colors"
                      >
                        <ChevronUp size={12} />
                      </button>
                      <button
                        onClick={() => moveOrder(m, 1)}
                        disabled={idx === items.length - 1}
                        className="w-5 h-5 flex items-center justify-center rounded text-[#C8C5E8] hover:text-[#5C4FE5] disabled:opacity-30 transition-colors"
                      >
                        <ChevronDown size={12} />
                      </button>
                    </div>

                    {/* Order number */}
                    <div className="w-7 h-7 rounded-lg bg-[#F7F6FF] flex items-center justify-center text-[11px] font-bold text-[#9B97B2] flex-shrink-0">
                      {m.order_number ?? '—'}
                    </div>

                    {/* Type icon */}
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${m.type === 'bacaan' ? 'bg-[#EAE8FD]' : 'bg-[#FFF8D6]'}`}>
                      {m.type === 'bacaan'
                        ? <BookOpen size={13} className="text-[#5C4FE5]" />
                        : <Video size={13} className="text-[#8A6D00]" />
                      }
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-[#1A1530] truncate">{m.title}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${typeBadgeCls(m.type)}`}>
                          {typeLabel(m.type)}
                        </span>
                        {m.class_groups && (
                          <span className="text-[10px] text-[#9B97B2]">
                            {m.class_groups.label}
                          </span>
                        )}
                        {m.profiles && (
                          <span className="text-[10px] text-[#9B97B2]">
                            oleh {m.profiles.full_name}
                          </span>
                        )}
                        {m.type === 'live_zoom' && m.url && (
                          <a
                            href={m.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-[#5C4FE5] flex items-center gap-1 hover:underline"
                            onClick={e => e.stopPropagation()}
                          >
                            <ExternalLink size={10} />
                            Google Drive
                          </a>
                        )}
                        {m.type === 'bacaan' && m.content && (
                          <span className="text-[10px] text-[#9B97B2]">
                            {m.content.length} karakter HTML
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Published toggle */}
                    <button
                      onClick={() => togglePublish(m)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors flex-shrink-0 ${
                        m.is_published
                          ? 'bg-green-50 text-green-700 hover:bg-green-100'
                          : 'bg-[#F7F6FF] text-[#9B97B2] hover:bg-[#EAE8FD] hover:text-[#5C4FE5]'
                      }`}
                    >
                      {m.is_published
                        ? <><Eye size={11} /> Publik</>
                        : <><EyeOff size={11} /> Draft</>
                      }
                    </button>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEdit(m)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-[#9B97B2] hover:text-[#5C4FE5] hover:bg-[#EAE8FD] transition-colors"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => { setDeleteId(m.id); setDeleteTitle(m.title) }}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-[#9B97B2] hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          DRAWER — Create / Edit
      ═══════════════════════════════════════════════════════ */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 flex">
          {/* Overlay */}
          <div
            className="flex-1 bg-black/40"
            onClick={() => { if (!saving) setDrawerOpen(false) }}
          />

          {/* Drawer panel */}
          <div
            className={`
              flex flex-col bg-white h-full shadow-2xl
              transition-all duration-300
              ${showPreview ? 'w-[90vw] max-w-[1100px]' : 'w-full max-w-[560px]'}
            `}
          >
            {/* Drawer header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E3FF] flex-shrink-0">
              <div>
                <h2 className="text-[15px] font-bold text-[#1A1530]">
                  {editingId ? 'Edit Materi' : 'Tambah Materi Baru'}
                </h2>
                <p className="text-[11px] text-[#9B97B2] mt-0.5">
                  {editingId ? 'Perbarui konten materi' : 'Isi detail dan konten materi baru'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* Preview toggle — hanya untuk bacaan */}
                {form.type === 'bacaan' && (
                  <button
                    onClick={() => setShowPreview(p => !p)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-colors ${
                      showPreview
                        ? 'bg-[#5C4FE5] text-white'
                        : 'bg-[#F7F6FF] text-[#5C4FE5] border border-[#E5E3FF]'
                    }`}
                  >
                    <Monitor size={13} />
                    {showPreview ? 'Tutup Preview' : 'Preview'}
                  </button>
                )}
                <button
                  onClick={() => { if (!saving) setDrawerOpen(false) }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-[#9B97B2] hover:bg-[#F7F6FF] transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Drawer body — split jika preview */}
            <div className="flex flex-1 overflow-hidden">

              {/* ── FORM PANEL ── */}
              <div className={`flex flex-col overflow-y-auto ${showPreview ? 'w-[420px] flex-shrink-0 border-r border-[#E5E3FF]' : 'flex-1'}`}>
                <div className="px-6 py-5 space-y-5 flex-1">

                  {/* Title */}
                  <div>
                    <label className="block text-[11px] font-bold text-[#4A4580] uppercase tracking-wide mb-1.5">
                      Judul Materi *
                    </label>
                    <input
                      type="text"
                      value={form.title}
                      onChange={e => handleChange('title', e.target.value)}
                      placeholder="Contoh: Pengenalan Huruf Vokal Bahasa Inggris"
                      className="w-full px-3 py-2.5 border border-[#E5E3FF] rounded-xl text-[13px] text-[#1A1530] outline-none focus:border-[#5C4FE5] focus:ring-2 focus:ring-[#5C4FE5]/10 bg-white placeholder:text-[#C8C5E8] transition"
                    />
                  </div>

                  {/* Type */}
                  <div>
                    <label className="block text-[11px] font-bold text-[#4A4580] uppercase tracking-wide mb-1.5">
                      Tipe Materi *
                    </label>
                    <div className="flex gap-3">
                      {(['bacaan', 'live_zoom'] as const).map(t => (
                        <button
                          key={t}
                          onClick={() => handleChange('type', t)}
                          className={`
                            flex-1 flex items-center gap-2 px-3 py-3 rounded-xl border text-[12px] font-bold transition-all
                            ${form.type === t
                              ? t === 'bacaan'
                                ? 'border-[#5C4FE5] bg-[#EAE8FD] text-[#5C4FE5]'
                                : 'border-[#E6B800] bg-[#FFF8D6] text-[#8A6D00]'
                              : 'border-[#E5E3FF] bg-white text-[#9B97B2] hover:border-[#C8C5E8]'
                            }
                          `}
                        >
                          {t === 'bacaan'
                            ? <BookOpen size={14} />
                            : <Video size={14} />
                          }
                          {typeLabel(t)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Course + ClassGroup */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-[#4A4580] uppercase tracking-wide mb-1.5">
                        Mata Pelajaran
                      </label>
                      <select
                        value={form.course_id}
                        onChange={e => {
                          handleChange('course_id', e.target.value)
                          handleChange('class_group_id', '')
                        }}
                        className="w-full px-3 py-2.5 border border-[#E5E3FF] rounded-xl text-[12px] text-[#1A1530] outline-none focus:border-[#5C4FE5] bg-white cursor-pointer"
                      >
                        <option value="">— Semua Kursus</option>
                        {courses.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#4A4580] uppercase tracking-wide mb-1.5">
                        Kelas Spesifik
                      </label>
                      <select
                        value={form.class_group_id}
                        onChange={e => handleChange('class_group_id', e.target.value)}
                        disabled={!form.course_id}
                        className="w-full px-3 py-2.5 border border-[#E5E3FF] rounded-xl text-[12px] text-[#1A1530] outline-none focus:border-[#5C4FE5] bg-white cursor-pointer disabled:opacity-50"
                      >
                        <option value="">— Semua Kelas</option>
                        {filteredCG.map(cg => (
                          <option key={cg.id} value={cg.id}>{cg.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Order number */}
                  <div>
                    <label className="block text-[11px] font-bold text-[#4A4580] uppercase tracking-wide mb-1.5">
                      Nomor Urut
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={form.order_number}
                      onChange={e => handleChange('order_number', e.target.value)}
                      placeholder="1"
                      className="w-24 px-3 py-2.5 border border-[#E5E3FF] rounded-xl text-[13px] text-[#1A1530] outline-none focus:border-[#5C4FE5] bg-white"
                    />
                    <p className="text-[10px] text-[#9B97B2] mt-1">
                      Kosongkan untuk auto-sort berdasarkan waktu dibuat
                    </p>
                  </div>

                  {/* Bacaan: HTML content */}
                  {form.type === 'bacaan' && (
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-[11px] font-bold text-[#4A4580] uppercase tracking-wide">
                          Konten HTML
                        </label>
                        <span className="text-[10px] text-[#9B97B2]">
                          {form.content.length} karakter
                        </span>
                      </div>
                      <div className="bg-[#F7F6FF] border border-[#E5E3FF] rounded-xl p-1">
                        <textarea
                          ref={textareaRef}
                          value={form.content}
                          onChange={e => handleChange('content', e.target.value)}
                          placeholder={`Paste konten HTML di sini...\n\nContoh:\n<h2>Judul Bagian</h2>\n<p>Paragraf penjelasan...</p>\n<div class="box-info">...</div>`}
                          className="w-full h-72 px-3 py-3 bg-transparent text-[12px] font-mono text-[#1A1530] outline-none resize-none placeholder:text-[#C8C5E8] leading-relaxed"
                          spellCheck={false}
                        />
                      </div>
                      <p className="text-[10px] text-[#9B97B2] mt-1.5">
                        Gunakan class dari edukazia-english.html: <code className="bg-[#F0EFFE] px-1 rounded text-[#5C4FE5]">box-info</code>, <code className="bg-[#F0EFFE] px-1 rounded text-[#5C4FE5]">box-tip</code>, <code className="bg-[#F0EFFE] px-1 rounded text-[#5C4FE5]">formula-box</code>, <code className="bg-[#F0EFFE] px-1 rounded text-[#5C4FE5]">artic-box</code>, dll
                      </p>
                    </div>
                  )}

                  {/* Live Zoom: URL */}
                  {form.type === 'live_zoom' && (
                    <div>
                      <label className="block text-[11px] font-bold text-[#4A4580] uppercase tracking-wide mb-1.5">
                        URL Google Drive *
                      </label>
                      <div className="flex items-center gap-2 px-3 py-2.5 border border-[#E5E3FF] rounded-xl bg-white focus-within:border-[#5C4FE5] focus-within:ring-2 focus-within:ring-[#5C4FE5]/10 transition">
                        <Globe size={13} className="text-[#9B97B2] flex-shrink-0" />
                        <input
                          type="url"
                          value={form.url}
                          onChange={e => handleChange('url', e.target.value)}
                          placeholder="https://drive.google.com/file/d/..."
                          className="flex-1 text-[13px] text-[#1A1530] outline-none placeholder:text-[#C8C5E8] bg-transparent"
                        />
                        {form.url && (
                          <a
                            href={form.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#5C4FE5] flex-shrink-0"
                          >
                            <ExternalLink size={13} />
                          </a>
                        )}
                      </div>
                      <p className="text-[10px] text-[#9B97B2] mt-1.5">
                        Pastikan file di Google Drive sudah di-share "Anyone with the link can view"
                      </p>
                    </div>
                  )}

                  {/* Published */}
                  <div className="flex items-center gap-3 p-4 bg-[#F7F6FF] border border-[#E5E3FF] rounded-xl">
                    <div className="flex-1">
                      <p className="text-[13px] font-bold text-[#1A1530]">Status Publikasi</p>
                      <p className="text-[11px] text-[#9B97B2] mt-0.5">
                        {form.is_published
                          ? 'Materi sudah bisa dilihat siswa'
                          : 'Masih draft, tidak terlihat siswa'
                        }
                      </p>
                    </div>
                    <button
                      onClick={() => handleChange('is_published', !form.is_published)}
                      className={`
                        relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0
                        ${form.is_published ? 'bg-green-500' : 'bg-[#D8D6F0]'}
                      `}
                    >
                      <span className={`
                        absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-200
                        ${form.is_published ? 'left-[22px]' : 'left-0.5'}
                      `} />
                    </button>
                  </div>

                </div>{/* /form content */}

                {/* Drawer footer */}
                <div className="px-6 py-4 border-t border-[#E5E3FF] flex-shrink-0">
                  {saveError && (
                    <div className="flex items-center gap-2 text-[11px] text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5 mb-3">
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
                        <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Menyimpan…</>
                      ) : (
                        <><Save size={13} /> {editingId ? 'Perbarui' : 'Simpan'}</>
                      )}
                    </button>
                  </div>
                </div>

              </div>{/* /form panel */}

              {/* ── PREVIEW PANEL ── */}
              {showPreview && form.type === 'bacaan' && (
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="flex items-center gap-2 px-5 py-3 border-b border-[#E5E3FF] bg-[#F7F6FF] flex-shrink-0">
                    <Monitor size={13} className="text-[#5C4FE5]" />
                    <span className="text-[12px] font-bold text-[#4A4580]">Preview Konten</span>
                    <span className="text-[10px] text-[#9B97B2] ml-auto">Tampilan di portal siswa</span>
                  </div>
                  <div className="flex-1 overflow-y-auto bg-[#F7F3EC]">
                    <div className="max-w-[680px] mx-auto px-8 py-8">
                      {/* Render judul */}
                      {form.title && (
                        <div className="mb-6">
                          <h1 style={{
                            fontFamily: "'Playfair Display', serif",
                            fontSize: '26px',
                            fontWeight: 900,
                            color: '#1A1A2E',
                            lineHeight: 1.2,
                          }}>
                            {form.title}
                          </h1>
                          <div style={{
                            width: 40, height: 3,
                            background: '#C89A2F',
                            borderRadius: 2,
                            marginTop: 10,
                          }} />
                        </div>
                      )}
                      {/* Render HTML content dengan style dari edukazia-english.html */}
                      {form.content ? (
                        <div
                          className="materi-preview-content"
                          dangerouslySetInnerHTML={{ __html: form.content }}
                          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                        />
                      ) : (
                        <div className="text-center py-12">
                          <p className="text-[13px] text-[#8888A0]">
                            Belum ada konten. Mulai ketik di panel kiri.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Inject CSS dari edukazia-english.html untuk preview */}
                  <style>{`
                    .materi-preview-content{font-size:15px;line-height:1.85;color:#33334A}
                    .materi-preview-content p{margin-bottom:14px}
                    .materi-preview-content strong{color:#1A1A2E;font-weight:800}
                    .materi-preview-content em{font-style:italic;color:#4A4A6A}
                    .materi-preview-content h2{font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:#1A1A2E;margin:28px 0 12px;padding-bottom:7px;border-bottom:1px solid #E0DADA}
                    .materi-preview-content h3{font-size:15px;font-weight:800;color:#1A1A2E;margin:20px 0 9px}
                    .materi-preview-content ul{margin:10px 0 14px 18px}
                    .materi-preview-content ul li{margin-bottom:5px;font-size:14px;line-height:1.65}
                    .materi-preview-content ol{margin:10px 0 14px 18px}
                    .materi-preview-content ol li{margin-bottom:7px;font-size:14px;line-height:1.65}
                    .materi-preview-content .sound-hero{background:#0D1B3E;border-radius:14px;padding:24px 28px;margin-bottom:22px;display:flex;align-items:center;gap:28px}
                    .materi-preview-content .sound-symbol{font-family:'Playfair Display',serif;font-size:60px;color:#E8B84B;line-height:1;font-weight:900;flex-shrink:0}
                    .materi-preview-content .sound-meta h2{font-family:'Playfair Display',serif;font-size:20px;color:#fff;margin-bottom:5px}
                    .materi-preview-content .sound-meta p{font-size:12px;color:rgba(255,255,255,.6);line-height:1.6}
                    .materi-preview-content .sound-keyword{display:inline-flex;align-items:center;gap:5px;background:rgba(200,154,47,.15);border:1px solid rgba(200,154,47,.3);padding:3px 10px;border-radius:5px;font-size:12px;font-weight:700;color:#E8B84B;margin-top:6px}
                    .materi-preview-content .artic-box{background:#EFF5FF;border:1px solid #C5D8F5;border-radius:10px;padding:18px 22px;margin:18px 0}
                    .materi-preview-content .artic-title{font-size:10px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#1565C0;margin-bottom:10px}
                    .materi-preview-content .artic-steps{display:flex;flex-direction:column;gap:7px}
                    .materi-preview-content .artic-step{display:flex;align-items:flex-start;gap:9px;font-size:13px;color:#1A3A6E;line-height:1.6}
                    .materi-preview-content .artic-num{width:20px;height:20px;border-radius:50%;background:#1565C0;color:#fff;font-size:9px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}
                    .materi-preview-content .box{border-radius:9px;padding:14px 18px;margin:16px 0;font-size:14px;line-height:1.75}
                    .materi-preview-content .box-info{background:#EBF3FF;border-left:4px solid #2979D4;color:#1A3A6E}
                    .materi-preview-content .box-tip{background:#E8F5E9;border-left:4px solid #388E3C;color:#1B4A1F}
                    .materi-preview-content .box-warn{background:#FFF3E0;border-left:4px solid #E65100;color:#7A2E00}
                    .materi-preview-content .box-note{background:#F3E5F5;border-left:4px solid #7B1FA2;color:#4A0072}
                    .materi-preview-content .box-compare{background:#FFF8E1;border-left:4px solid #C89A2F;color:#5A3E00}
                    .materi-preview-content .box-title{font-weight:800;font-size:11px;letter-spacing:.5px;text-transform:uppercase;margin-bottom:6px}
                    .materi-preview-content .formula-box{background:#0D1B3E;color:#fff;border-radius:10px;padding:18px 22px;margin:16px 0}
                    .materi-preview-content .formula-title{font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#C89A2F;margin-bottom:8px}
                    .materi-preview-content .formula{font-size:14px;font-weight:600;line-height:1.9;color:#fff;font-family:monospace}
                    .materi-preview-content .f-rule{color:#E8B84B}
                    .materi-preview-content .vocab-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;margin:16px 0}
                    .materi-preview-content .vocab-card{background:#fff;border:1px solid #E0DADA;border-radius:9px;padding:12px 14px}
                    .materi-preview-content .vc-word{font-size:17px;font-weight:800;color:#0D1B3E;margin-bottom:2px}
                    .materi-preview-content .vc-ipa{font-size:12px;color:#C89A2F;font-family:serif;margin-bottom:6px}
                    .materi-preview-content .vc-def{font-size:12px;color:#4A4A6A;line-height:1.5}
                  `}</style>
                </div>
              )}

            </div>{/* /drawer body */}
          </div>{/* /drawer panel */}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          CONFIRM DELETE
      ═══════════════════════════════════════════════════════ */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 size={18} className="text-red-500" />
            </div>
            <h3 className="text-[15px] font-bold text-[#1A1530] text-center mb-1">
              Hapus Materi?
            </h3>
            <p className="text-[12px] text-[#9B97B2] text-center mb-5">
              <strong className="text-[#1A1530]">"{deleteTitle}"</strong> akan dihapus permanen.
              Progress siswa untuk materi ini juga akan terhapus.
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
                {deleting
                  ? <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Menghapus…</>
                  : <><Trash2 size={13} />Hapus</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
