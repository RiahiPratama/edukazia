'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, Pencil, Trash2, GripVertical, BookOpen, Save, X, ChevronDown } from 'lucide-react'

type Course = {
  id: string
  name: string
  description: string | null
  color: string | null
  is_active: boolean
  sort_order: number
}

type Level = {
  id: string
  course_id: string
  name: string
  description: string | null
  target_age: string | null
  sort_order: number
  is_active: boolean
}

const PRESET_COLORS = [
  '#5C4FE5', '#3D34C4', '#16A34A', '#DC2626',
  '#C8A000', '#EA580C', '#0284C7', '#7C3AED',
  '#DB2777', '#0891B2',
]

const TARGET_AGE_OPTIONS = [
  { value: 'all',   label: 'Semua Usia' },
  { value: 'kids',  label: 'Anak-anak' },
  { value: 'teen',  label: 'Remaja' },
  { value: 'adult', label: 'Dewasa' },
]

export default function KursusEditClient({
  kursus,
  levels: initialLevels,
}: {
  kursus: Course
  levels: Level[]
}) {
  const router = useRouter()

  // ── Course form state ──
  const [courseName,  setCourseName]  = useState(kursus.name)
  const [courseDesc,  setCourseDesc]  = useState(kursus.description ?? '')
  const [courseColor, setCourseColor] = useState(kursus.color ?? '#5C4FE5')
  const [courseActive,setCourseActive]= useState(kursus.is_active)
  const [savingCourse,setSavingCourse]= useState(false)
  const [courseMsg,   setCourseMsg]   = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // ── Levels state ──
  const [levels, setLevels] = useState<Level[]>(initialLevels)

  // ── Modal state ──
  const [modal, setModal] = useState<'add' | 'edit' | null>(null)
  const [editingLevel, setEditingLevel] = useState<Level | null>(null)
  const [levelName,    setLevelName]    = useState('')
  const [levelDesc,    setLevelDesc]    = useState('')
  const [levelAge,     setLevelAge]     = useState('all')
  const [levelOrder,   setLevelOrder]   = useState(0)
  const [levelActive,  setLevelActive]  = useState(true)
  const [savingLevel,  setSavingLevel]  = useState(false)

  // ── Delete confirm ──
  const [deleteId,     setDeleteId]     = useState<string | null>(null)
  const [deletingLevel,setDeletingLevel]= useState(false)

  // ── Save course ──
  async function saveCourse() {
    setSavingCourse(true)
    setCourseMsg(null)
    try {
      const res = await fetch(`/api/admin/kursus/${kursus.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: courseName,
          description: courseDesc || null,
          color: courseColor,
          is_active: courseActive,
        }),
      })
      if (!res.ok) throw new Error()
      setCourseMsg({ type: 'ok', text: 'Kursus berhasil disimpan!' })
      router.refresh()
    } catch {
      setCourseMsg({ type: 'err', text: 'Gagal menyimpan. Coba lagi.' })
    } finally {
      setSavingCourse(false)
    }
  }

  // ── Open modal ──
  function openAdd() {
    setModal('add')
    setEditingLevel(null)
    setLevelName('')
    setLevelDesc('')
    setLevelAge('all')
    setLevelOrder(levels.length > 0 ? Math.max(...levels.map(l => l.sort_order)) + 1 : 1)
    setLevelActive(true)
  }

  function openEdit(level: Level) {
    setModal('edit')
    setEditingLevel(level)
    setLevelName(level.name)
    setLevelDesc(level.description ?? '')
    setLevelAge(level.target_age ?? 'all')
    setLevelOrder(level.sort_order)
    setLevelActive(level.is_active)
  }

  function closeModal() {
    setModal(null)
    setEditingLevel(null)
  }

  // ── Save level ──
  async function saveLevel() {
    if (!levelName.trim()) return
    setSavingLevel(true)
    try {
      if (modal === 'add') {
        const res = await fetch('/api/admin/levels', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            course_id:   kursus.id,
            name:        levelName.trim(),
            description: levelDesc || null,
            target_age:  levelAge,
            sort_order:  levelOrder,
            is_active:   levelActive,
          }),
        })
        if (!res.ok) throw new Error()
        const { data } = await res.json()
        setLevels(prev => [...prev, data].sort((a, b) => a.sort_order - b.sort_order))
      } else if (modal === 'edit' && editingLevel) {
        const res = await fetch(`/api/admin/levels/${editingLevel.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name:        levelName.trim(),
            description: levelDesc || null,
            target_age:  levelAge,
            sort_order:  levelOrder,
            is_active:   levelActive,
          }),
        })
        if (!res.ok) throw new Error()
        const { data } = await res.json()
        setLevels(prev =>
          prev.map(l => l.id === editingLevel.id ? data : l)
            .sort((a, b) => a.sort_order - b.sort_order)
        )
      }
      closeModal()
    } catch {
      alert('Gagal menyimpan level. Coba lagi.')
    } finally {
      setSavingLevel(false)
    }
  }

  // ── Delete level ──
  async function deleteLevel() {
    if (!deleteId) return
    setDeletingLevel(true)
    try {
      const res = await fetch(`/api/admin/levels/${deleteId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setLevels(prev => prev.filter(l => l.id !== deleteId))
      setDeleteId(null)
    } catch {
      alert('Gagal menghapus level. Coba lagi.')
    } finally {
      setDeletingLevel(false)
    }
  }

  const targetAgeLabel = (val: string | null) =>
    TARGET_AGE_OPTIONS.find(o => o.value === (val ?? 'all'))?.label ?? '—'

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/admin/kursus"
          className="w-9 h-9 rounded-xl border border-[#E5E3FF] bg-white flex items-center justify-center hover:bg-[#F0EFFF] transition-colors"
        >
          <ArrowLeft size={16} className="text-[#5C4FE5]" />
        </Link>
        <div>
          <h1 className="text-2xl font-black text-[#1A1640]" style={{ fontFamily: 'Sora,sans-serif' }}>
            Edit Kursus
          </h1>
          <p className="text-sm text-[#7B78A8] mt-0.5">Kelola informasi dan level kursus</p>
        </div>
      </div>

      {/* Course form */}
      <div className="bg-white rounded-2xl border border-[#E5E3FF] p-5 mb-4">
        <h2 className="font-bold text-[#1A1640] mb-4">Informasi Kursus</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Nama */}
          <div>
            <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">
              Nama Kursus
            </label>
            <input
              value={courseName}
              onChange={e => setCourseName(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-[#E5E3FF] text-sm text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] bg-[#F7F6FF]"
              placeholder="Nama kursus..."
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">
              Status
            </label>
            <div className="flex gap-2">
              {[true, false].map(val => (
                <button
                  key={String(val)}
                  onClick={() => setCourseActive(val)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                    courseActive === val
                      ? val
                        ? 'bg-green-50 border-green-300 text-green-700'
                        : 'bg-gray-100 border-gray-300 text-gray-600'
                      : 'bg-white border-[#E5E3FF] text-[#7B78A8] hover:bg-[#F7F6FF]'
                  }`}
                >
                  {val ? 'Aktif' : 'Nonaktif'}
                </button>
              ))}
            </div>
          </div>

          {/* Deskripsi */}
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">
              Deskripsi
            </label>
            <textarea
              value={courseDesc}
              onChange={e => setCourseDesc(e.target.value)}
              rows={2}
              className="w-full px-3 py-2.5 rounded-xl border border-[#E5E3FF] text-sm text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] bg-[#F7F6FF] resize-none"
              placeholder="Deskripsi singkat kursus..."
            />
          </div>

          {/* Warna */}
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">
              Warna Identitas
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setCourseColor(c)}
                  style={{ background: c }}
                  className={`w-8 h-8 rounded-full transition-transform ${
                    courseColor === c ? 'ring-2 ring-offset-2 ring-[#5C4FE5] scale-110' : 'hover:scale-105'
                  }`}
                />
              ))}
              <div className="flex items-center gap-2 ml-1">
                <input
                  type="color"
                  value={courseColor}
                  onChange={e => setCourseColor(e.target.value)}
                  className="w-8 h-8 rounded-full cursor-pointer border border-[#E5E3FF]"
                  title="Pilih warna custom"
                />
                <span className="text-xs font-mono text-[#7B78A8]">{courseColor}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Save button */}
        <div className="flex items-center gap-3 mt-5 pt-4 border-t border-[#F0EFFF]">
          <button
            onClick={saveCourse}
            disabled={savingCourse}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#5C4FE5] text-white text-sm font-semibold rounded-xl hover:bg-[#3D34C4] transition-colors disabled:opacity-60"
          >
            <Save size={15} />
            {savingCourse ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
          {courseMsg && (
            <span className={`text-sm font-semibold ${
              courseMsg.type === 'ok' ? 'text-green-600' : 'text-red-500'
            }`}>
              {courseMsg.text}
            </span>
          )}
        </div>
      </div>

      {/* Levels */}
      <div className="bg-white rounded-2xl border border-[#E5E3FF] p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold text-[#1A1640]">Level Kurikulum</h2>
            <p className="text-xs text-[#7B78A8] mt-0.5">{levels.length} level tersedia</p>
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 text-sm bg-[#5C4FE5] text-white px-4 py-2 rounded-xl font-semibold hover:bg-[#3D34C4] transition-colors"
          >
            <Plus size={15} />
            Tambah Level
          </button>
        </div>

        {levels.length === 0 ? (
          <div className="text-center py-12 text-[#7B78A8]">
            <div className="w-14 h-14 rounded-2xl bg-[#F0EFFF] flex items-center justify-center mx-auto mb-3">
              <BookOpen size={24} className="text-[#C4BFFF]" />
            </div>
            <p className="font-semibold mb-1">Belum ada level</p>
            <p className="text-xs mb-3">Tambahkan level kurikulum untuk kursus ini</p>
            <button
              onClick={openAdd}
              className="text-sm text-[#5C4FE5] font-bold hover:underline"
            >
              + Tambah Level Pertama
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {levels.map((level, idx) => (
              <div
                key={level.id}
                className={`flex items-center gap-3 p-4 rounded-xl border transition-colors ${
                  level.is_active
                    ? 'border-[#E5E3FF] bg-[#F7F6FF] hover:border-[#C4BFFF]'
                    : 'border-gray-200 bg-gray-50 opacity-60'
                }`}
              >
                {/* Order badge */}
                <div className="w-7 h-7 rounded-lg bg-[#E5E3FF] flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-black text-[#5C4FE5]">{idx + 1}</span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-[#1A1640]">{level.name}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      level.is_active
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {level.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                    <span className="text-xs bg-[#E5E3FF] text-[#5C4FE5] font-semibold px-2 py-0.5 rounded-full">
                      {targetAgeLabel(level.target_age)}
                    </span>
                  </div>
                  {level.description && (
                    <p className="text-xs text-[#7B78A8] mt-0.5 truncate">{level.description}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => openEdit(level)}
                    className="w-8 h-8 rounded-lg hover:bg-[#E5E3FF] flex items-center justify-center transition-colors"
                    title="Edit level"
                  >
                    <Pencil size={14} className="text-[#5C4FE5]" />
                  </button>
                  <button
                    onClick={() => setDeleteId(level.id)}
                    className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center transition-colors"
                    title="Hapus level"
                  >
                    <Trash2 size={14} className="text-red-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Modal Add/Edit Level ── */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E5E3FF] w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-[#F0EFFF]">
              <h3 className="font-black text-[#1A1640]" style={{ fontFamily: 'Sora,sans-serif' }}>
                {modal === 'add' ? 'Tambah Level' : 'Edit Level'}
              </h3>
              <button
                onClick={closeModal}
                className="w-8 h-8 rounded-xl hover:bg-[#F0EFFF] flex items-center justify-center transition-colors"
              >
                <X size={16} className="text-[#7B78A8]" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Nama Level */}
              <div>
                <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">
                  Nama Level <span className="text-red-400">*</span>
                </label>
                <input
                  value={levelName}
                  onChange={e => setLevelName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E5E3FF] text-sm text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] bg-[#F7F6FF]"
                  placeholder="Contoh: Level 1.1 - Phonics"
                  autoFocus
                />
              </div>

              {/* Deskripsi */}
              <div>
                <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">
                  Deskripsi
                </label>
                <textarea
                  value={levelDesc}
                  onChange={e => setLevelDesc(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E5E3FF] text-sm text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] bg-[#F7F6FF] resize-none"
                  placeholder="Deskripsi singkat level ini..."
                />
              </div>

              {/* Target Age + Urutan */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">
                    Target Usia
                  </label>
                  <div className="relative">
                    <select
                      value={levelAge}
                      onChange={e => setLevelAge(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-[#E5E3FF] text-sm text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] bg-[#F7F6FF] appearance-none pr-8"
                    >
                      {TARGET_AGE_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-3 text-[#7B78A8] pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">
                    Urutan
                  </label>
                  <input
                    type="number"
                    value={levelOrder}
                    onChange={e => setLevelOrder(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#E5E3FF] text-sm text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] bg-[#F7F6FF]"
                    min={0}
                  />
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">
                  Status
                </label>
                <div className="flex gap-2">
                  {[true, false].map(val => (
                    <button
                      key={String(val)}
                      onClick={() => setLevelActive(val)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                        levelActive === val
                          ? val
                            ? 'bg-green-50 border-green-300 text-green-700'
                            : 'bg-gray-100 border-gray-300 text-gray-600'
                          : 'bg-white border-[#E5E3FF] text-[#7B78A8] hover:bg-[#F7F6FF]'
                      }`}
                    >
                      {val ? 'Aktif' : 'Nonaktif'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2 p-5 pt-0">
              <button
                onClick={closeModal}
                className="flex-1 py-2.5 rounded-xl border border-[#E5E3FF] text-sm font-semibold text-[#7B78A8] hover:bg-[#F7F6FF] transition-colors"
              >
                Batal
              </button>
              <button
                onClick={saveLevel}
                disabled={savingLevel || !levelName.trim()}
                className="flex-1 py-2.5 rounded-xl bg-[#5C4FE5] text-white text-sm font-semibold hover:bg-[#3D34C4] transition-colors disabled:opacity-60"
              >
                {savingLevel ? 'Menyimpan...' : modal === 'add' ? 'Tambah Level' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Konfirmasi Hapus ── */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E5E3FF] w-full max-w-sm shadow-2xl p-6">
            <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={20} className="text-red-500" />
            </div>
            <h3 className="font-black text-[#1A1640] text-center mb-2" style={{ fontFamily: 'Sora,sans-serif' }}>
              Hapus Level?
            </h3>
            <p className="text-sm text-[#7B78A8] text-center mb-5">
              Level ini akan dihapus permanen beserta semua materinya. Tindakan ini tidak bisa dibatalkan.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 py-2.5 rounded-xl border border-[#E5E3FF] text-sm font-semibold text-[#7B78A8] hover:bg-[#F7F6FF] transition-colors"
              >
                Batal
              </button>
              <button
                onClick={deleteLevel}
                disabled={deletingLevel}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-60"
              >
                {deletingLevel ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
