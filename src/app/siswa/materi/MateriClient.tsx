'use client'

import { useState, useMemo } from 'react'

interface Materi {
  id: string
  title: string
  type: 'bacaan' | 'live_zoom'
  order_number: number
  content: string | null
  url: string | null
  is_published: boolean
  created_at: string
  is_read: boolean
  progress_id: string | null
  courses: { id: string; name: string; color: string } | null
  class_groups: { id: string; label: string } | null
  sessions: { id: string; scheduled_at: string } | null
  profiles: { full_name: string } | null
}

interface Course {
  id: string
  name: string
  color: string
}

interface Stats {
  totalMateri: number
  totalRead: number
  totalBacaan: number
  totalZoom: number
}

interface Props {
  materi: Materi[]
  courses: Course[]
  studentId: string
  studentName: string
  stats: Stats
}

export default function MateriClient({ materi, courses, studentId, studentName, stats }: Props) {
  const [activeCourse, setActiveCourse] = useState<string>('semua')
  const [activeType,   setActiveType]   = useState<string>('semua')
  const [openMateri,   setOpenMateri]   = useState<Materi | null>(null)
  const [readState,    setReadState]    = useState<Record<string, boolean>>(
    Object.fromEntries(materi.map(m => [m.id, m.is_read]))
  )
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const readCount = Object.values(readState).filter(Boolean).length
  const pct = stats.totalMateri > 0
    ? Math.round((readCount / stats.totalMateri) * 100)
    : 0

  const filtered = useMemo(() => {
    return materi.filter(m => {
      const courseMatch = activeCourse === 'semua' || m.courses?.id === activeCourse
      const typeMatch   = activeType   === 'semua' || m.type === activeType
      return courseMatch && typeMatch
    })
  }, [materi, activeCourse, activeType])

  const bacaanList = filtered.filter(m => m.type === 'bacaan')
  const zoomList   = filtered.filter(m => m.type === 'live_zoom')

  async function toggleRead(m: Materi) {
    const newState = !readState[m.id]
    setLoadingId(m.id)
    setReadState(prev => ({ ...prev, [m.id]: newState }))

    try {
      if (m.progress_id) {
        await fetch('/api/siswa/materi-progress', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ progress_id: m.progress_id, is_read: newState }),
        })
      } else {
        await fetch('/api/siswa/materi-progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ material_id: m.id, student_id: studentId, is_read: newState }),
        })
      }
    } catch {
      // Rollback jika gagal
      setReadState(prev => ({ ...prev, [m.id]: !newState }))
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div className="px-4 pt-4 pb-2">
      <div className="mb-4">
        <h2 className="text-[16px] font-bold text-[#1A1530]">Materi Belajar</h2>
        <p className="text-[12px] text-[#9B97B2] mt-0.5">{studentName}</p>
      </div>

      {/* ── STAT CARDS ── */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white border border-[#E5E3FF] rounded-2xl p-4">
          <p className="text-[11px] text-[#9B97B2] mb-1">Total Materi</p>
          <p className="text-[24px] font-bold text-[#5C4FE5] leading-none">{stats.totalMateri}</p>
          <p className="text-[11px] text-[#9B97B2] mt-1">{stats.totalBacaan} bacaan · {stats.totalZoom} zoom</p>
        </div>
        <div className="bg-white border border-[#E5E3FF] rounded-2xl p-4">
          <p className="text-[11px] text-[#9B97B2] mb-1">Sudah Dibaca</p>
          <p className="text-[24px] font-bold text-green-600 leading-none">{readCount}</p>
          <p className="text-[11px] text-[#9B97B2] mt-1">{pct}% selesai</p>
        </div>
      </div>

      {/* Progress bar keseluruhan */}
      <div className="bg-white border border-[#E5E3FF] rounded-2xl p-4 mb-4">
        <div className="flex justify-between mb-2">
          <span className="text-[12px] font-bold text-[#1A1530]">Progress Keseluruhan</span>
          <span className="text-[12px] font-bold text-[#5C4FE5]">{readCount} / {stats.totalMateri}</span>
        </div>
        <div className="h-2.5 bg-[#F7F6FF] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-[#5C4FE5] transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-[11px] text-[#9B97B2] mt-1.5 text-right">{pct}%</p>
      </div>

      {/* ── FILTER MAPEL ── */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-3 scrollbar-hide">
        <button
          onClick={() => setActiveCourse('semua')}
          className={`text-[11px] font-bold px-4 py-2 rounded-full border flex-shrink-0 transition-colors
            ${activeCourse === 'semua' ? 'bg-[#5C4FE5] text-white border-[#5C4FE5]' : 'bg-white text-[#6B6580] border-[#E5E3FF]'}`}
        >
          Semua
        </button>
        {courses.map(c => (
          <button
            key={c.id}
            onClick={() => setActiveCourse(c.id)}
            className={`text-[11px] font-bold px-4 py-2 rounded-full border flex-shrink-0 transition-colors
              ${activeCourse === c.id ? 'text-white border-transparent' : 'bg-white text-[#6B6580] border-[#E5E3FF]'}`}
            style={activeCourse === c.id ? { background: c.color } : {}}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* ── FILTER TIPE ── */}
      <div className="flex gap-2 mb-4">
        {[
          { key: 'semua',    label: 'Semua Tipe' },
          { key: 'bacaan',   label: '📄 Bacaan' },
          { key: 'live_zoom',label: '🎥 Live Zoom' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveType(key)}
            className={`text-[11px] font-bold px-4 py-2 rounded-full border flex-shrink-0 transition-colors
              ${activeType === key ? 'bg-[#1A1530] text-white border-[#1A1530]' : 'bg-white text-[#6B6580] border-[#E5E3FF]'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── ACCORDION PER MAPEL ── */}
      <AccordionMateri
        filtered={filtered}
        courses={courses}
        activeType={activeType}
        readState={readState}
        loadingId={loadingId}
        onOpen={setOpenMateri}
        onToggleRead={toggleRead}
      />

      {filtered.length === 0 && (
        <div className="bg-white border border-[#E5E3FF] rounded-2xl py-10 text-center">
          <p className="text-[13px] font-semibold text-[#9B97B2]">Belum ada materi</p>
          <p className="text-[11px] text-[#9B97B2] mt-1">untuk filter yang dipilih</p>
        </div>
      )}

      {/* ── MODAL BACA MATERI ── */}
      {openMateri && openMateri.type === 'bacaan' && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center"
          onClick={() => setOpenMateri(null)}
        >
          <div
            className="bg-white rounded-t-2xl w-full max-w-lg max-h-[85vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-start justify-between p-4 border-b border-[#E5E3FF]">
              <div className="flex-1 pr-3">
                <p className="text-[14px] font-bold text-[#1A1530]">{openMateri.title}</p>
                <p className="text-[11px] text-[#9B97B2] mt-0.5">
                  {openMateri.courses?.name ?? '—'} · {openMateri.profiles?.full_name ?? '—'}
                </p>
              </div>
              <button
                onClick={() => setOpenMateri(null)}
                className="w-7 h-7 rounded-full bg-[#F7F6FF] border border-[#E5E3FF] flex items-center justify-center text-[12px] text-[#6B6580] flex-shrink-0"
              >
                ✕
              </button>
            </div>

            {/* Modal content */}
            <div className="flex-1 overflow-y-auto p-4">
              {openMateri.content ? (
                <div className="text-[13px] text-[#1A1530] leading-relaxed whitespace-pre-wrap">
                  {openMateri.content}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-[13px] text-[#9B97B2]">Konten materi belum tersedia.</p>
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="p-4 border-t border-[#E5E3FF] flex items-center justify-between">
              <span className="text-[11px] text-[#9B97B2]">
                Materi {openMateri.order_number}
              </span>
              <button
                onClick={() => {
                  toggleRead(openMateri)
                  setOpenMateri(null)
                }}
                className={`text-[12px] font-bold px-4 py-2 rounded-xl transition-colors
                  ${readState[openMateri.id]
                    ? 'bg-green-50 text-green-700'
                    : 'bg-[#5C4FE5] text-white'}`}
              >
                {readState[openMateri.id] ? '✓ Sudah Dibaca' : 'Tandai Sudah Dibaca'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Komponen kartu materi ──
function MateriCard({
  m, isRead, isLoading, onOpen, onToggleRead
}: {
  m: Materi
  isRead: boolean
  isLoading: boolean
  onOpen: () => void
  onToggleRead: () => void
}) {
  const color    = m.courses?.color ?? '#5C4FE5'
  const isZoom   = m.type === 'live_zoom'
  const badgeCls = isZoom
    ? 'bg-[#FFF8D6] text-[#8A6D00]'
    : 'bg-[#EAE8FD] text-[#5C4FE5]'

  return (
    <div className={`bg-white border rounded-2xl p-4 flex gap-3 transition-opacity ${isRead ? 'opacity-80' : ''} border-[#E5E3FF]`}>
      {/* Nomor urut */}
      <div
        className={`w-8 h-8 rounded-xl flex items-center justify-center text-[12px] font-bold flex-shrink-0
          ${isRead ? 'bg-green-50 text-green-700' : 'bg-[#EAE8FD] text-[#5C4FE5]'}`}
      >
        {isRead ? '✓' : m.order_number}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold text-[#1A1530] leading-snug mb-1">{m.title}</p>
        <p className="text-[11px] text-[#9B97B2] mb-2">
          {m.courses?.name ?? '—'} · {m.profiles?.full_name ?? '—'}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${badgeCls}`}>
            {isZoom ? 'Live Zoom' : 'Bacaan'}
          </span>
          {isRead && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-green-50 text-green-700">
              Sudah dibaca
            </span>
          )}
        </div>
      </div>

      {/* Aksi */}
      <div className="flex flex-col items-end gap-2 flex-shrink-0">
        {/* Toggle sudah baca */}
        <button
          onClick={e => { e.stopPropagation(); onToggleRead() }}
          disabled={isLoading}
          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] transition-colors
            ${isRead
              ? 'bg-green-500 border-green-500 text-white'
              : 'bg-white border-[#E5E3FF]'}`}
        >
          {isRead ? '✓' : ''}
        </button>

        {/* Tombol buka */}
        <button
          onClick={onOpen}
          className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg border transition-colors
            ${isZoom
              ? 'bg-[#FFF8D6] border-[#E6B80060] text-[#8A6D00]'
              : 'bg-[#EAE8FD] border-[#5C4FE540] text-[#5C4FE5]'}`}
        >
          {isZoom ? '↗ Buka Drive' : 'Baca'}
        </button>
      </div>
    </div>
  )
}

// ── Accordion per mapel ──
function AccordionMateri({
  filtered, courses, activeType, readState, loadingId, onOpen, onToggleRead
}: {
  filtered: any[]
  courses: any[]
  activeType: string
  readState: Record<string, boolean>
  loadingId: string | null
  onOpen: (m: any) => void
  onToggleRead: (m: any) => void
}) {
  const [openCourses, setOpenCourses] = useState<Record<string, boolean>>({})

  // Group by course
  const grouped: Record<string, { course: any; items: any[] }> = {}
  filtered.forEach(m => {
    const key = m.courses?.id ?? 'umum'
    if (!grouped[key]) {
      grouped[key] = {
        course: m.courses ?? { id: 'umum', name: 'Umum', color: '#9B97B2' },
        items: []
      }
    }
    grouped[key].items.push(m)
  })

  // Auto-open first group
  const keys = Object.keys(grouped)
  const isOpen = (key: string) => openCourses[key] !== false // default open

  return (
    <div className="space-y-3 mb-4">
      {keys.map(key => {
        const { course, items } = grouped[key]
        const open = isOpen(key)
        const bacaan = items.filter(m => m.type === 'bacaan')
        const zoom   = items.filter(m => m.type === 'live_zoom')
        const readCount = items.filter(m => readState[m.id]).length

        return (
          <div key={key} className="bg-white border border-[#E5E3FF] rounded-2xl overflow-hidden">
            {/* Accordion header */}
            <button
              onClick={() => setOpenCourses(prev => ({ ...prev, [key]: !open }))}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-[#F7F6FF] transition-colors"
            >
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: course.color }} />
              <div className="flex-1">
                <p className="text-[13px] font-bold text-[#1A1530]">{course.name}</p>
                <p className="text-[11px] text-[#9B97B2]">
                  {items.length} materi · {readCount} dibaca
                  {bacaan.length > 0 && ` · ${bacaan.length} bacaan`}
                  {zoom.length > 0 && ` · ${zoom.length} zoom`}
                </p>
              </div>
              {/* Mini progress */}
              <div className="w-16 h-1.5 bg-[#E5E3FF] rounded-full overflow-hidden flex-shrink-0">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${items.length > 0 ? Math.round(readCount/items.length*100) : 0}%`, background: course.color }}
                />
              </div>
              <span className="text-[#9B97B2] text-[12px] flex-shrink-0">{open ? '▲' : '▼'}</span>
            </button>

            {/* Accordion body */}
            {open && (
              <div className="border-t border-[#E5E3FF]">
                {/* Bacaan */}
                {bacaan.length > 0 && activeType !== 'live_zoom' && (
                  <div>
                    <div className="flex items-center gap-2 px-4 py-2 bg-[#F7F6FF]">
                      <p className="text-[10px] font-bold text-[#9B97B2] uppercase tracking-wide">📄 Bacaan</p>
                      <div className="flex-1 h-px bg-[#E5E3FF]" />
                      <p className="text-[10px] text-[#9B97B2]">baca di portal</p>
                    </div>
                    <div className="p-3 space-y-2">
                      {bacaan.map(m => (
                        <MateriCard
                          key={m.id} m={m}
                          isRead={readState[m.id]}
                          isLoading={loadingId === m.id}
                          onOpen={() => onOpen(m)}
                          onToggleRead={() => onToggleRead(m)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Live Zoom */}
                {zoom.length > 0 && activeType !== 'bacaan' && (
                  <div>
                    <div className="flex items-center gap-2 px-4 py-2 bg-[#F7F6FF]">
                      <p className="text-[10px] font-bold text-[#9B97B2] uppercase tracking-wide">🎥 Live Zoom</p>
                      <div className="flex-1 h-px bg-[#E5E3FF]" />
                      <p className="text-[10px] text-[#9B97B2]">via Google Drive</p>
                    </div>
                    <div className="p-3 space-y-2">
                      {zoom.map(m => (
                        <MateriCard
                          key={m.id} m={m}
                          isRead={readState[m.id]}
                          isLoading={loadingId === m.id}
                          onOpen={() => m.url ? window.open(m.url, '_blank') : null}
                          onToggleRead={() => onToggleRead(m)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
