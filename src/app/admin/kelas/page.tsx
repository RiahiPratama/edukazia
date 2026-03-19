'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Plus, X, Minus, Calendar, Trash2, Archive } from 'lucide-react'
import ConfirmModal from '@/components/ui/ConfirmModal'

type Kelas = {
  id: string
  label: string
  status: string
  max_participants: number
  courses: { name: string; color: string | null } | null
  class_types: { name: string } | null
  tutors: { profiles: { full_name: string } | null } | null
  enrollments: { id: string; status: string }[]
}

type JadwalRow = { date: string; time: string; repeat: number }

const MAX_ROWS   = 5
const MAX_REPEAT = 16

function generateSessions(row: JadwalRow, classGroupId: string) {
  return Array.from({ length: row.repeat }, (_, i) => {
    const d = new Date(`${row.date}T${row.time}:00`)
    d.setDate(d.getDate() + i * 7)
    return { class_group_id: classGroupId, scheduled_at: d.toISOString(), status: 'scheduled', zoom_link: null }
  })
}

export default function KelasPage() {
  const supabase = createClient()

  const [kelasList, setKelasList] = useState<Kelas[]>([])
  const [loading,   setLoading]   = useState(true)

  // Modal arsip
  const [archiveId,    setArchiveId]    = useState<string | null>(null)
  const [archiveLabel, setArchiveLabel] = useState('')
  const [archiving,    setArchiving]    = useState(false)

  // Modal jadwal
  const [showJadwal,    setShowJadwal]    = useState(false)
  const [selectedKelas, setSelectedKelas] = useState<Kelas | null>(null)
  const [jadwalRows,    setJadwalRows]    = useState<JadwalRow[]>([{ date: today(), time: '08:00', repeat: 1 }])
  const [fZoom,         setFZoom]         = useState('')
  const [saving,        setSaving]        = useState(false)
  const [jadwalError,   setJadwalError]   = useState('')
  const [jadwalSuccess, setJadwalSuccess] = useState('')

  // Modal hapus
  const [deleteId,    setDeleteId]    = useState<string | null>(null)
  const [deleteLabel, setDeleteLabel] = useState('')
  const [deleting,    setDeleting]    = useState(false)
  const [deleteError, setDeleteError] = useState('')

  function today() {
    const d = new Date()
    const offset = d.getTimezoneOffset()
    const local  = new Date(d.getTime() - offset * 60 * 1000)
    return local.toISOString().split('T')[0]
  }

  useEffect(() => { fetchKelas() }, [])

  async function fetchKelas() {
    setLoading(true)
    const { data } = await supabase
      .from('class_groups')
      .select(`id, label, status, max_participants,
        courses(name, color), class_types(name),
        tutors(profiles(full_name)),
        enrollments(id, status)`)
      .order('created_at', { ascending: false })
    setKelasList((data as any[]) ?? [])
    setLoading(false)
  }

  function openJadwal(k: Kelas) {
    setSelectedKelas(k)
    setJadwalRows([{ date: today(), time: '08:00', repeat: 1 }])
    setFZoom('')
    setJadwalError('')
    setJadwalSuccess('')
    setShowJadwal(true)
  }

  function openArchive(k: Kelas) {
    setArchiveId(k.id)
    setArchiveLabel(k.label)
  }

  async function handleArchive() {
    if (!archiveId) return
    setArchiving(true)
    await supabase.from('class_groups').update({ status: 'completed' }).eq('id', archiveId)
    setArchiving(false)
    setArchiveId(null)
    fetchKelas()
  }

  function openDelete(k: Kelas) {
    setDeleteId(k.id)
    setDeleteLabel(k.label)
    setDeleteError('')
  }

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true); setDeleteError('')

    // Hapus sessions dulu
    await supabase.from('sessions').delete().eq('class_group_id', deleteId)
    // Hapus enrollments
    await supabase.from('enrollments').delete().eq('class_group_id', deleteId)
    // Hapus class_group
    const { error } = await supabase.from('class_groups').delete().eq('id', deleteId)

    if (error) { setDeleteError(error.message); setDeleting(false); return }

    setDeleting(false)
    setDeleteId(null)
    fetchKelas()
  }

  function addRow() {
    if (jadwalRows.length >= MAX_ROWS) return
    const last = jadwalRows[jadwalRows.length - 1]
    const next = new Date(`${last.date}T00:00:00`)
    next.setDate(next.getDate() + 7)
    const offset = next.getTimezoneOffset()
    const local  = new Date(next.getTime() - offset * 60 * 1000)
    setJadwalRows(prev => [...prev, { date: local.toISOString().split('T')[0], time: last.time, repeat: 1 }])
  }

  function removeRow(idx: number) { setJadwalRows(prev => prev.filter((_, i) => i !== idx)) }

  function updateRow(idx: number, field: keyof JadwalRow, value: string | number) {
    setJadwalRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r))
  }

  async function handleSaveJadwal() {
    if (!selectedKelas) return
    setSaving(true); setJadwalError(''); setJadwalSuccess('')

    const allSessions: any[] = []
    for (const row of jadwalRows) {
      if (!row.date || !row.time) continue
      const sessions = generateSessions(row, selectedKelas.id)
      sessions.forEach(s => allSessions.push({ ...s, zoom_link: fZoom || null }))
    }

    if (allSessions.length === 0) { setJadwalError('Isi minimal satu jadwal.'); setSaving(false); return }

    const { error } = await supabase.from('sessions').insert(allSessions)
    if (error) { setJadwalError(error.message); setSaving(false); return }

    setJadwalSuccess(`${allSessions.length} sesi berhasil dijadwalkan!`)
    setSaving(false)
    setTimeout(() => setShowJadwal(false), 1500)
  }

  const totalSesi = jadwalRows.reduce((a, r) => a + r.repeat, 0)

  const statusLabel: Record<string, string> = { active: 'Aktif', inactive: 'Nonaktif', completed: 'Selesai' }
  const statusColor: Record<string, string> = {
    active:    'bg-green-100 text-green-700',
    inactive:  'bg-gray-100 text-gray-500',
    completed: 'bg-blue-100 text-blue-700',
  }
  const inputCls = "w-full px-3 py-2 border border-[#E5E3FF] rounded-lg text-sm bg-white text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] transition"

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-[#1A1640]" style={{fontFamily:'Sora,sans-serif'}}>Manajemen Kelas</h1>
          <p className="text-sm text-[#7B78A8] mt-1">{kelasList.length} kelas terdaftar</p>
        </div>
        <Link href="/admin/kelas/baru"
          className="bg-[#5C4FE5] text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-[#3D34C4] transition-colors">
          + Buat Kelas
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({length: 3}).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-[#E5E3FF] p-5 animate-pulse">
              <div className="h-4 w-32 bg-gray-200 rounded mb-2"/>
              <div className="h-3 w-24 bg-gray-200 rounded mb-4"/>
              <div className="h-3 w-full bg-gray-200 rounded mb-6"/>
              <div className="flex gap-2">
                <div className="flex-1 h-8 bg-gray-200 rounded-lg"/>
                <div className="flex-1 h-8 bg-gray-200 rounded-lg"/>
                <div className="flex-1 h-8 bg-gray-200 rounded-lg"/>
              </div>
            </div>
          ))}
        </div>
      ) : kelasList.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E5E3FF] p-12 text-center">
          <div className="text-5xl mb-4">🏫</div>
          <p className="font-bold text-[#1A1640] mb-2">Belum ada kelas</p>
          <p className="text-sm text-[#7B78A8] mb-4">Buat kelas pertama untuk mulai mendaftarkan siswa</p>
          <Link href="/admin/kelas/baru"
            className="inline-flex items-center gap-2 bg-[#5C4FE5] text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-[#3D34C4] transition-colors">
            + Buat Kelas Pertama
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {kelasList.map((k: any) => {
            const activeEnroll = k.enrollments?.filter((e: any) => e.status === 'active').length ?? 0
            const isFull = activeEnroll >= k.max_participants
            return (
              <div key={k.id} className="bg-white rounded-2xl border border-[#E5E3FF] p-5 hover:shadow-sm transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-[#1A1640] truncate">{k.label}</div>
                    <div className="text-xs text-[#7B78A8] mt-0.5">{k.courses?.name} · {k.class_types?.name}</div>
                  </div>
                  <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusColor[k.status] ?? 'bg-gray-100 text-gray-500'}`}>
                      {statusLabel[k.status] ?? k.status}
                    </span>
                    {/* Tombol arsip */}
                    {k.status !== 'completed' && (
                      <button onClick={() => openArchive(k)}
                        className="p-1 rounded-lg text-gray-300 hover:text-[#5C4FE5] hover:bg-[#F0EEFF] transition-colors"
                        title="Arsipkan Kelas">
                        <Archive size={13}/>
                      </button>
                    )}
                    {/* Tombol hapus */}
                    <button onClick={() => openDelete(k)}
                      className="p-1 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Hapus Kelas">
                      <Trash2 size={13}/>
                    </button>
                  </div>
                </div>

                <div className="text-sm text-[#4A4580] mb-3">
                  👨‍🏫 {k.tutors?.profiles?.full_name ?? '—'}
                </div>

                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-[#7B78A8]">Peserta</div>
                  <div className={`text-sm font-bold ${isFull ? 'text-red-600' : 'text-green-600'}`}>
                    {activeEnroll}/{k.max_participants}
                  </div>
                </div>

                <div className="w-full h-1.5 bg-[#E5E3FF] rounded-full overflow-hidden mb-4">
                  <div className={`h-full rounded-full ${isFull ? 'bg-red-400' : 'bg-[#5C4FE5]'}`}
                    style={{ width: `${Math.min((activeEnroll / k.max_participants) * 100, 100)}%` }}/>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <Link href={`/admin/kelas/${k.id}/edit`}
                    className="text-center py-2 bg-[#5C4FE5] text-white text-xs font-bold rounded-lg hover:bg-[#3D34C4] transition-colors">
                    Edit
                  </Link>
                  <button onClick={() => openJadwal(k)}
                    className="flex items-center justify-center gap-1 py-2 bg-[#E6B800] text-[#7A5C00] text-xs font-bold rounded-lg hover:bg-[#F5C800] transition-colors">
                    <Calendar size={11}/> Jadwal
                  </button>
                  <Link href={`/admin/kelas/${k.id}`}
                    className="text-center py-2 border border-[#E5E3FF] text-[#4A4580] text-xs font-bold rounded-lg hover:bg-[#F0EFFF] transition-colors">
                    Detail
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <ConfirmModal
        open={!!archiveId}
        title="Arsipkan Kelas?"
        description={`Kelas "${archiveLabel}" akan diubah statusnya menjadi Selesai. Kelas tidak muncul di jadwal aktif, tapi semua data tetap tersimpan.`}
        confirmText="Ya, Arsipkan"
        cancelText="Batal"
        loading={archiving}
        variant="archive"
        onConfirm={handleArchive}
        onCancel={() => setArchiveId(null)}
      />

      <ConfirmModal
        open={!!deleteId}
        title="Hapus Kelas?"
        description={`Kelas "${deleteLabel}" akan dihapus permanen beserta semua jadwal/sesi dan data enrollment siswa.`}
        confirmText="Ya, Hapus"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />

      {/* MODAL JADWALKAN */}
      {showJadwal && selectedKelas && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E3FF] sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-base font-bold text-[#1A1640]">Jadwalkan Sesi</h2>
                <p className="text-xs text-[#7B78A8] mt-0.5">{selectedKelas.label}</p>
              </div>
              <button onClick={() => setShowJadwal(false)} className="p-1.5 rounded-lg hover:bg-[#F7F6FF] text-[#7B78A8]">
                <X size={16}/>
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-[#7B78A8] uppercase tracking-wide">Jadwal</label>
                  <span className="text-xs text-[#7B78A8]">{jadwalRows.length}/{MAX_ROWS} jadwal</span>
                </div>
                <div className="space-y-3">
                  {jadwalRows.map((row, idx) => (
                    <div key={idx} className="bg-[#F7F6FF] rounded-xl border border-[#E5E3FF] p-3">
                      <div className="flex items-center justify-between mb-2.5">
                        <span className="text-xs font-semibold text-[#5C4FE5]">Jadwal {idx + 1}</span>
                        {jadwalRows.length > 1 && (
                          <button onClick={() => removeRow(idx)} className="p-1 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition">
                            <Minus size={13}/>
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <div>
                          <label className="block text-[10px] font-bold text-[#7B78A8] uppercase tracking-wide mb-1">Tanggal</label>
                          <input type="date" value={row.date} onChange={e => updateRow(idx, 'date', e.target.value)} className={inputCls}/>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-[#7B78A8] uppercase tracking-wide mb-1">Jam Mulai</label>
                          <input type="time" value={row.time} onChange={e => updateRow(idx, 'time', e.target.value)} className={inputCls}/>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-[#7B78A8] uppercase tracking-wide mb-1">
                          Ulangi setiap minggu <span className="normal-case font-normal">(1 = sekali saja, maks {MAX_REPEAT})</span>
                        </label>
                        <div className="flex items-center gap-3">
                          <input type="range" min={1} max={MAX_REPEAT} value={row.repeat}
                            onChange={e => updateRow(idx, 'repeat', Number(e.target.value))}
                            className="flex-1 accent-[#5C4FE5]"/>
                          <span className="text-sm font-bold text-[#5C4FE5] min-w-[60px] text-right">
                            {row.repeat}x
                            {row.repeat > 1 && <span className="text-[10px] font-normal text-[#7B78A8] block">≈ {Math.ceil(row.repeat / 4)} bln</span>}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {jadwalRows.length < MAX_ROWS && (
                  <button onClick={addRow}
                    className="mt-3 w-full py-2.5 border-2 border-dashed border-[#C4BFFF] rounded-xl text-sm font-semibold text-[#5C4FE5] hover:bg-[#F0EEFF] transition flex items-center justify-center gap-2">
                    <Plus size={14}/> Tambah Jadwal Lain
                  </button>
                )}
                <div className="mt-3 flex items-center justify-between px-4 py-2.5 bg-[#EEEDFE] rounded-xl">
                  <span className="text-xs font-semibold text-[#3C3489]">Total sesi yang akan dibuat</span>
                  <span className="text-sm font-bold text-[#5C4FE5]">
                    {totalSesi} sesi
                    {totalSesi >= 8 && <span className="text-[10px] font-normal ml-1">(≈ {Math.ceil((totalSesi - 1) / 8)} periode)</span>}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">
                  Link Zoom <span className="normal-case font-normal text-[#7B78A8]">(opsional)</span>
                </label>
                <input type="url" placeholder="https://zoom.us/j/..." value={fZoom}
                  onChange={e => setFZoom(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-[#E5E3FF] rounded-xl text-sm bg-[#F7F6FF] text-[#1A1640] placeholder:text-[#7B78A8] focus:outline-none focus:border-[#5C4FE5] transition"/>
              </div>

              {jadwalError   && <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 font-semibold">{jadwalError}</div>}
              {jadwalSuccess && <div className="px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 font-semibold">✅ {jadwalSuccess}</div>}
            </div>

            <div className="px-6 pb-5 flex gap-3 sticky bottom-0 bg-white border-t border-[#E5E3FF] pt-4">
              <button onClick={handleSaveJadwal} disabled={saving}
                className="flex-1 py-3 bg-[#5C4FE5] hover:bg-[#3D34C4] text-white font-bold rounded-xl text-sm transition disabled:opacity-60">
                {saving ? 'Menyimpan...' : `Jadwalkan ${totalSesi} Sesi`}
              </button>
              <button onClick={() => setShowJadwal(false)}
                className="px-5 py-3 border border-[#E5E3FF] text-[#4A4580] font-bold rounded-xl text-sm hover:bg-[#F0EFFF] transition">
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
