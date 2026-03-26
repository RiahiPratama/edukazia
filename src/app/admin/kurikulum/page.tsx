'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Plus, BookOpen, Pencil, Trash2, X, Save, AlertCircle,
  CheckCircle2, ChevronUp, ChevronDown, GripVertical
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Course {
  id: string
  name: string
  color: string
}

interface Level {
  id: string
  course_id: string
  name: string
  target_age: string
  sort_order: number
}

interface CurriculumUnit {
  id: string
  course_id: string
  level_id: string | null
  unit_number: number
  unit_name: string
  description: string | null
  order_number: number | null
  is_active: boolean
  created_at: string
  courses: { id: string; name: string; color: string } | null
  levels: { id: string; name: string; target_age: string } | null
  lesson_count?: number
}

interface FormData {
  course_id: string
  level_id: string
  unit_number: string
  unit_name: string
  description: string
  is_active: boolean
}

const EMPTY_FORM: FormData = {
  course_id: '',
  level_id: '',
  unit_number: '',
  unit_name: '',
  description: '',
  is_active: true,
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminKurikulumPage() {
  const supabase = createClient()

  // Data
  const [units, setUnits] = useState<CurriculumUnit[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [allLevels, setAllLevels] = useState<Level[]>([])
  const [loading, setLoading] = useState(true)

  // Filter
  const [filterCourse, setFilterCourse] = useState('semua')
  const [filterLevel, setFilterLevel] = useState('semua')

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteTitle, setDeleteTitle] = useState('')
  const [deleting, setDeleting] = useState(false)

  // ── Fetch ────────────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    setLoading(true)

    const [{ data: unitsData }, { data: coursesData }, { data: levelsData }] = await Promise.all([
      supabase
        .from('curriculum_units')
        .select(`
          id, course_id, level_id, unit_number, unit_name, description,
          order_number, is_active, created_at,
          courses(id, name, color),
          levels(id, name, target_age)
        `)
        .order('order_number', { ascending: true, nullsFirst: false })
        .order('unit_number', { ascending: true }),
      supabase.from('courses').select('id, name, color').eq('is_active', true).order('name'),
      supabase.from('levels').select('id, course_id, name, target_age, sort_order').order('sort_order'),
    ])

    // Flatten Supabase join
    const flatUnits = (unitsData ?? []).map((u: any) => ({
      ...u,
      courses: Array.isArray(u.courses) ? u.courses[0] ?? null : u.courses,
      levels: Array.isArray(u.levels) ? u.levels[0] ?? null : u.levels,
    }))

    // Get lesson count per unit
    const unitsWithCount = await Promise.all(
      flatUnits.map(async (unit) => {
        const { count } = await supabase
          .from('materials')
          .select('id', { count: 'exact', head: true })
          .eq('curriculum_unit_id', unit.id)
        return { ...unit, lesson_count: count ?? 0 }
      })
    )

    setUnits(unitsWithCount as CurriculumUnit[])
    setCourses((coursesData ?? []) as Course[])
    setAllLevels((levelsData ?? []) as Level[])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // ── Filter ───────────────────────────────────────────────────────────────────

  const filtered = units.filter((u) => {
    const matchCourse = filterCourse === 'semua' || u.course_id === filterCourse
    const matchLevel = filterLevel === 'semua' || u.level_id === filterLevel
    return matchCourse && matchLevel
  })

  // Get levels for selected course in form
  const availableLevels = allLevels.filter((l) => !form.course_id || l.course_id === form.course_id)

  // Get levels for filter dropdown
  const filterLevels = allLevels.filter((l) => filterCourse === 'semua' || l.course_id === filterCourse)

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function openDrawer(id?: string) {
    if (id) {
      const unit = units.find((u) => u.id === id)
      if (!unit) return
      setEditingId(id)
      setForm({
        course_id: unit.course_id,
        level_id: unit.level_id ?? '',
        unit_number: unit.unit_number.toString(),
        unit_name: unit.unit_name,
        description: unit.description ?? '',
        is_active: unit.is_active,
      })
    } else {
      setEditingId(null)
      setForm(EMPTY_FORM)
    }
    setSaveError('')
    setSaveSuccess(false)
    setDrawerOpen(true)
  }

  async function handleSave() {
    // Validation
    if (!form.course_id) {
      setSaveError('Pelajaran harus dipilih')
      return
    }
    if (!form.level_id) {
      setSaveError('Level harus dipilih')
      return
    }
    if (!form.unit_number || parseInt(form.unit_number) < 1) {
      setSaveError('Unit Number harus diisi (minimal 1)')
      return
    }
    if (!form.unit_name.trim()) {
      setSaveError('Unit Name harus diisi')
      return
    }

    setSaving(true)
    setSaveError('')
    setSaveSuccess(false)

    const payload: any = {
      course_id: form.course_id,
      level_id: form.level_id,
      unit_number: parseInt(form.unit_number),
      unit_name: form.unit_name.trim(),
      description: form.description.trim() || null,
      is_active: form.is_active,
      order_number: parseInt(form.unit_number), // Default order = unit_number
    }

    const { error } = editingId
      ? await supabase.from('curriculum_units').update(payload).eq('id', editingId)
      : await supabase.from('curriculum_units').insert([payload])

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
    const { error } = await supabase.from('curriculum_units').delete().eq('id', deleteId)
    setDeleting(false)
    if (error) {
      alert('Gagal menghapus: ' + error.message)
      return
    }
    setDeleteId(null)
    fetchAll()
  }

  async function toggleActive(id: string, currentStatus: boolean) {
    await supabase.from('curriculum_units').update({ is_active: !currentStatus }).eq('id', id)
    fetchAll()
  }

  async function moveOrder(id: string, direction: 'up' | 'down') {
    const idx = filtered.findIndex((u) => u.id === id)
    if (idx === -1) return
    if (direction === 'up' && idx === 0) return
    if (direction === 'down' && idx === filtered.length - 1) return

    const current = filtered[idx]
    const target = direction === 'up' ? filtered[idx - 1] : filtered[idx + 1]

    const tempOrder = current.order_number
    await supabase.from('curriculum_units').update({ order_number: target.order_number }).eq('id', current.id)
    await supabase.from('curriculum_units').update({ order_number: tempOrder }).eq('id', target.id)
    fetchAll()
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F6FF] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-[#5C4FE5] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-[13px] text-[#9B97B2]">Memuat kurikulum...</p>
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
              <h1 className="text-[20px] font-black text-[#1A1530]">Kurikulum (Unit)</h1>
              <p className="text-[12px] text-[#9B97B2] mt-0.5">Kelola unit kurikulum per level</p>
            </div>
            <button
              onClick={() => openDrawer()}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#5C4FE5] hover:bg-[#4338CA] text-white rounded-xl text-[13px] font-bold transition-colors"
            >
              <Plus size={14} />
              Tambah Unit
            </button>
          </div>

          {/* Filter */}
          <div className="flex gap-3">
            <select
              value={filterCourse}
              onChange={(e) => {
                setFilterCourse(e.target.value)
                setFilterLevel('semua')
              }}
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
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              disabled={filterCourse === 'semua'}
              className="px-3 py-2 border border-[#E5E3FF] rounded-xl text-[13px] font-medium text-[#4A4580] focus:outline-none focus:ring-2 focus:ring-[#5C4FE5] disabled:bg-gray-50 disabled:cursor-not-allowed"
            >
              <option value="semua">Semua Level</option>
              {filterLevels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} {l.target_age && `(${l.target_age})`}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* UNITS LIST */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E5E3FF] p-12 text-center">
            <div className="w-16 h-16 bg-[#F7F6FF] rounded-full flex items-center justify-center mx-auto mb-4">
              <BookOpen size={24} className="text-[#5C4FE5]" />
            </div>
            <h3 className="text-[15px] font-bold text-[#1A1530] mb-1">Belum ada unit kurikulum</h3>
            <p className="text-[12px] text-[#9B97B2] mb-4">Klik tombol "Tambah Unit" untuk membuat yang pertama</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((unit, idx) => (
              <div key={unit.id} className="bg-white rounded-xl border border-[#E5E3FF] p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-start gap-3">
                  {/* Drag handle */}
                  <div className="flex flex-col gap-1 pt-1">
                    <button
                      onClick={() => moveOrder(unit.id, 'up')}
                      disabled={idx === 0}
                      className="text-[#9B97B2] hover:text-[#5C4FE5] disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <GripVertical size={14} className="text-[#E5E3FF]" />
                    <button
                      onClick={() => moveOrder(unit.id, 'down')}
                      disabled={idx === filtered.length - 1}
                      className="text-[#9B97B2] hover:text-[#5C4FE5] disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 mb-2 flex-wrap">
                      <span className="px-2 py-1 bg-[#F7F6FF] text-[#5C4FE5] rounded-lg text-[10px] font-bold">
                        Unit {unit.unit_number}
                      </span>
                      {unit.levels && (
                        <span className="px-2 py-1 bg-[#E8F5E9] text-[#2E7D32] rounded-lg text-[10px] font-bold">
                          {unit.levels.name}
                          {unit.levels.target_age && ` • ${unit.levels.target_age}`}
                        </span>
                      )}
                      {unit.courses && (
                        <span
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold"
                          style={{ background: `${unit.courses.color}20`, color: unit.courses.color }}
                        >
                          <div className="w-2 h-2 rounded-full" style={{ background: unit.courses.color }} />
                          {unit.courses.name}
                        </span>
                      )}
                      {!unit.is_active && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded-lg text-[10px] font-bold">Nonaktif</span>
                      )}
                    </div>
                    <h3 className="text-[14px] font-bold text-[#1A1530] mb-1">{unit.unit_name}</h3>
                    {unit.description && <p className="text-[12px] text-[#9B97B2] mb-2">{unit.description}</p>}
                    <div className="text-[11px] text-[#9B97B2]">
                      {unit.lesson_count ?? 0} lesson{(unit.lesson_count ?? 0) !== 1 ? 's' : ''}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleActive(unit.id, unit.is_active)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        unit.is_active ? 'bg-green-50 text-green-600 hover:bg-green-100' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                      }`}
                      title={unit.is_active ? 'Aktif' : 'Nonaktif'}
                    >
                      <CheckCircle2 size={14} />
                    </button>
                    <button
                      onClick={() => openDrawer(unit.id)}
                      className="p-1.5 rounded-lg bg-[#F7F6FF] text-[#5C4FE5] hover:bg-[#EAE8FD] transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => {
                        setDeleteId(unit.id)
                        setDeleteTitle(unit.unit_name)
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

          <div className="relative bg-white w-full max-w-xl h-full shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E3FF] flex-shrink-0">
              <div>
                <h2 className="text-[16px] font-black text-[#1A1530]">{editingId ? 'Edit Unit' : 'Tambah Unit Baru'}</h2>
                <p className="text-[11px] text-[#9B97B2] mt-0.5">Unit kurikulum untuk level tertentu</p>
              </div>
              <button onClick={() => setDrawerOpen(false)} className="p-2 rounded-lg hover:bg-[#F7F6FF] transition-colors">
                <X size={18} className="text-[#9B97B2]" />
              </button>
            </div>

            {/* Form Body */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
              {/* Course */}
              <div>
                <label className="block text-[12px] font-bold text-[#4A4580] mb-1.5">Pelajaran *</label>
                <select
                  value={form.course_id}
                  onChange={(e) => setForm({ ...form, course_id: e.target.value, level_id: '' })}
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

              {/* Level */}
              <div>
                <label className="block text-[12px] font-bold text-[#4A4580] mb-1.5">Level *</label>
                <select
                  value={form.level_id}
                  onChange={(e) => setForm({ ...form, level_id: e.target.value })}
                  disabled={!form.course_id}
                  className="w-full px-3 py-2.5 border border-[#E5E3FF] rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-[#5C4FE5] disabled:bg-gray-50 disabled:cursor-not-allowed"
                >
                  <option value="">Pilih Level</option>
                  {availableLevels.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} {l.target_age && `(${l.target_age})`}
                    </option>
                  ))}
                </select>
                {form.course_id && availableLevels.length === 0 && (
                  <p className="text-[11px] text-orange-600 mt-1.5">
                    ⚠️ Belum ada level untuk pelajaran ini. Tambahkan di menu Kursus & Paket.
                  </p>
                )}
              </div>

              {/* Unit Number */}
              <div>
                <label className="block text-[12px] font-bold text-[#4A4580] mb-1.5">Unit Number *</label>
                <input
                  type="number"
                  value={form.unit_number}
                  onChange={(e) => setForm({ ...form, unit_number: e.target.value })}
                  placeholder="1, 2, 3, ..."
                  className="w-full px-3 py-2.5 border border-[#E5E3FF] rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-[#5C4FE5]"
                />
              </div>

              {/* Unit Name */}
              <div>
                <label className="block text-[12px] font-bold text-[#4A4580] mb-1.5">Unit Name *</label>
                <input
                  type="text"
                  value={form.unit_name}
                  onChange={(e) => setForm({ ...form, unit_name: e.target.value })}
                  placeholder="Contoh: Basic Sentence & Identity"
                  className="w-full px-3 py-2.5 border border-[#E5E3FF] rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-[#5C4FE5]"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-[12px] font-bold text-[#4A4580] mb-1.5">Deskripsi</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Penjelasan singkat tentang unit ini (opsional)"
                  rows={3}
                  className="w-full px-3 py-2.5 border border-[#E5E3FF] rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-[#5C4FE5] resize-none"
                />
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-2 bg-[#F7F6FF] rounded-xl p-3">
                <input
                  type="checkbox"
                  id="is-active"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="w-4 h-4 text-[#5C4FE5] border-[#E5E3FF] rounded focus:ring-2 focus:ring-[#5C4FE5]"
                />
                <label htmlFor="is-active" className="text-[13px] font-bold text-[#4A4580] cursor-pointer">
                  Unit aktif (siswa dapat melihat)
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
            <h3 className="text-[15px] font-bold text-[#1A1530] text-center mb-1">Hapus Unit?</h3>
            <p className="text-[12px] text-[#9B97B2] text-center mb-5">
              <strong className="text-[#1A1530]">"{deleteTitle}"</strong> akan dihapus permanen. Semua lesson dalam unit ini akan
              kehilangan reference.
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
