'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Pencil, X, Check } from 'lucide-react'

function getDurasiMenit(classTypeName: string, courseName: string): number {
  const type   = (classTypeName ?? '').toLowerCase()
  const course = (courseName ?? '').toLowerCase()
  if (type.includes('privat') && !type.includes('semi') && course.includes('inggris')) return 45
  return 60
}

function CountdownBadge({ scheduledAt, classTypeName, courseName, status }: {
  scheduledAt: string
  classTypeName: string
  courseName: string
  status: string
}) {
  const [diffMs, setDiffMs] = useState(() => new Date(scheduledAt).getTime() - Date.now())

  useEffect(() => {
    if (status === 'rescheduled') return
    const interval = setInterval(() => {
      setDiffMs(new Date(scheduledAt).getTime() - Date.now())
    }, 1000)
    return () => clearInterval(interval)
  }, [scheduledAt, status])

  // Holiday — countdown berhenti
  if (status === 'holiday') {
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-teal-50 text-teal-700 border border-teal-200 w-fit flex items-center gap-1">
        🏖️ Hari Libur
      </span>
    )
  }

  // Rescheduled — countdown berhenti, tampilkan badge khusus
  if (status === 'rescheduled') {
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-amber-50 text-amber-700 border border-amber-200 w-fit flex items-center gap-1">
        🔄 Dijadwal Ulang
      </span>
    )
  }

  if (diffMs > 3 * 60 * 60 * 1000) return null

  const durasiMs = getDurasiMenit(classTypeName, courseName) * 60 * 1000

  if (diffMs < -durasiMs) {
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-stone-100 text-stone-500 w-fit">
        ✓ Telah dilaksanakan
      </span>
    )
  }

  if (diffMs <= 0) {
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-green-100 text-green-700 flex items-center gap-1 w-fit">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
        Berlangsung
      </span>
    )
  }

  const totalSec = Math.floor(diffMs / 1000)
  const jam      = Math.floor(totalSec / 3600)
  const menit    = Math.floor((totalSec % 3600) / 60)
  const detik    = totalSec % 60
  const pad      = (n: number) => String(n).padStart(2, '0')
  const label    = jam > 0 ? `${pad(jam)}:${pad(menit)}:${pad(detik)}` : `${pad(menit)}:${pad(detik)}`

  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono font-semibold bg-amber-50 text-amber-700 border border-amber-200 w-fit">
      ⏱ {label}
    </span>
  )
}

export default function SesiHariIniAdminClient({ sesiHariIni: initialSesi }: { sesiHariIni: any[] }) {
  const supabase = createClient()

  const [sesiList,  setSesiList]  = useState<any[]>(initialSesi)
  const [editSesi,  setEditSesi]  = useState<any | null>(null)
  const [fDate,     setFDate]     = useState('')
  const [fTime,     setFTime]     = useState('')
  const [fZoom,     setFZoom]     = useState('')
  const [fStatus,   setFStatus]   = useState('')
  const [saving,    setSaving]    = useState(false)
  const [saveErr,   setSaveErr]   = useState('')
  const [saveOk,    setSaveOk]    = useState(false)

  function fmtTime(iso: string) {
    return new Date(iso).toLocaleTimeString('id-ID', {
      hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jayapura', hour12: false,
    })
  }

  function openEdit(s: any) {
    // Convert UTC → WIT untuk input
    const dt     = new Date(s.scheduled_at)
    const witStr = dt.toLocaleString('en-CA', { timeZone: 'Asia/Jayapura', hour12: false })
    const [datePart, timePart] = witStr.split(', ')
    setFDate(datePart)
    setFTime(timePart.slice(0, 5))
    setFZoom(s.zoom_link ?? '')
    setFStatus(s.status)
    setSaveErr('')
    setSaveOk(false)
    setEditSesi(s)
  }

  async function handleSave() {
    if (!editSesi) return
    setSaving(true); setSaveErr(''); setSaveOk(false)

    const newScheduledAt = new Date(`${fDate}T${fTime}:00+09:00`).toISOString()

    const { error } = await supabase.from('sessions').update({
      scheduled_at: newScheduledAt,
      zoom_link:    fZoom || null,
      status:       fStatus,
    }).eq('id', editSesi.id)

    setSaving(false)
    if (error) { setSaveErr(error.message); return }

    // Update local state
    setSesiList(prev => prev.map(s => s.id === editSesi.id
      ? { ...s, scheduled_at: newScheduledAt, zoom_link: fZoom || null, status: fStatus }
      : s
    ))
    setSaveOk(true)
    setTimeout(() => setEditSesi(null), 800)
  }

  const statusColor: Record<string, string> = {
    scheduled:   'bg-blue-50 text-blue-700',
    completed:   'bg-green-50 text-green-700',
    cancelled:   'bg-red-50 text-red-700',
    rescheduled: 'bg-amber-50 text-amber-700',
    holiday:     'bg-teal-50 text-teal-700',
  }
  const statusLabel: Record<string, string> = {
    scheduled:   'Terjadwal',
    completed:   'Selesai',
    cancelled:   'Dibatalkan',
    rescheduled: 'Reschedule',
    holiday:     'Libur',
  }

  const inputCls = "w-full px-3 py-2 border border-[#E5E3FF] rounded-xl text-sm bg-[#F7F6FF] text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] transition"

  if (!sesiList || sesiList.length === 0) {
    return (
      <div className="text-center py-8 text-[#7B78A8] text-sm">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
          className="mx-auto mb-2 text-[#C4BFFF]">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        Tidak ada sesi hari ini
      </div>
    )
  }

  return (
    <>
      {/* Modal Edit Sesi */}
      {editSesi && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E3FF]">
              <div>
                <h3 className="font-bold text-[#1A1640] text-sm">Edit Sesi</h3>
                <p className="text-xs text-[#7B78A8] mt-0.5">{editSesi.class_groups?.label}</p>
              </div>
              <button onClick={() => setEditSesi(null)} className="p-1.5 rounded-lg hover:bg-[#F7F6FF] text-[#7B78A8]">
                <X size={16}/>
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-[#7B78A8] uppercase tracking-wider mb-1.5">Tanggal</label>
                  <input type="date" value={fDate} onChange={e => setFDate(e.target.value)} className={inputCls}/>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#7B78A8] uppercase tracking-wider mb-1.5">Jam (WIT)</label>
                  <input type="time" value={fTime} onChange={e => setFTime(e.target.value)} className={inputCls}/>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#7B78A8] uppercase tracking-wider mb-1.5">Status</label>
                <select value={fStatus} onChange={e => setFStatus(e.target.value)} className={inputCls}>
                  <option value="scheduled">Terjadwal</option>
                  <option value="completed">Selesai</option>
                  <option value="cancelled">Dibatalkan</option>
                  <option value="rescheduled">Dijadwal Ulang</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#7B78A8] uppercase tracking-wider mb-1.5">
                  Link Zoom <span className="normal-case font-normal">(opsional)</span>
                </label>
                <input type="url" value={fZoom} onChange={e => setFZoom(e.target.value)}
                  placeholder="https://zoom.us/j/..." className={inputCls}/>
              </div>
              {saveErr && (
                <p className="text-[11px] text-red-600 px-3 py-2 bg-red-50 rounded-xl border border-red-200">{saveErr}</p>
              )}
              {saveOk && (
                <p className="text-[11px] text-green-700 px-3 py-2 bg-green-50 rounded-xl border border-green-200 flex items-center gap-1.5">
                  <Check size={12}/> Berhasil disimpan!
                </p>
              )}
              <div className="flex gap-2 pt-1">
                <button onClick={() => setEditSesi(null)}
                  className="flex-1 py-2.5 border border-[#E5E3FF] text-[#7B78A8] font-semibold rounded-xl text-sm hover:bg-[#F7F6FF] transition">
                  Batal
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 py-2.5 bg-[#5C4FE5] hover:bg-[#3D34C4] text-white font-bold rounded-xl text-sm transition disabled:opacity-60">
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {sesiList.map((s: any) => {
          const classTypeName = s.class_groups?.class_types?.name ?? ''
          const courseName    = s.class_groups?.courses?.name ?? ''
          const isRescheduled = s.status === 'rescheduled'
          const isHoliday     = s.status === 'holiday'
          return (
            <div key={s.id}
              className={`flex items-center gap-3 p-3 rounded-xl transition-colors border ${
                isHoliday     ? 'border-teal-200 bg-teal-50/40' :
                isRescheduled ? 'border-amber-200 bg-amber-50/40' :
                'border-[#F0EFFF] hover:bg-[#F7F6FF]'
              }`}>
              <div className="w-12 text-center flex-shrink-0">
                <div className={`text-sm font-bold ${isHoliday ? 'text-teal-600' : isRescheduled ? 'text-amber-600' : 'text-[#5C4FE5]'}`}>{fmtTime(s.scheduled_at)}</div>
                <div className="text-[10px] text-[#7B78A8]">WIT</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-semibold text-[#1A1640] truncate">
                    {s.class_groups?.label ?? '—'}
                  </div>
                  {!s.class_groups?.tutor_id && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-red-100 text-red-600 flex-shrink-0">
                      ⚠ Tanpa Tutor
                    </span>
                  )}
                </div>
                <div className="text-xs text-[#7B78A8] mb-1">{courseName}</div>
                <CountdownBadge
                  scheduledAt={s.scheduled_at}
                  classTypeName={classTypeName}
                  courseName={courseName}
                  status={s.status}
                />
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {s.zoom_link && !isRescheduled && !isHoliday && (
                  <a href={s.zoom_link} target="_blank" rel="noopener noreferrer"
                    className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-lg font-semibold hover:bg-blue-100 transition-colors">
                    Zoom
                  </a>
                )}
                <span className={`text-xs px-2 py-1 rounded-lg font-semibold ${statusColor[s.status] ?? 'bg-gray-50 text-gray-700'}`}>
                  {statusLabel[s.status] ?? s.status}
                </span>
                <button onClick={() => openEdit(s)}
                  className="p-1.5 rounded-lg text-[#7B78A8] hover:text-[#5C4FE5] hover:bg-[#F0EFFF] transition-colors"
                  title="Edit sesi">
                  <Pencil size={13}/>
                </button>
              </div>
            </div>
          )
        })}
      </div>
      <Link href="/admin/jadwal?new=1"
        className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-[#E5E3FF] text-sm text-[#7B78A8] hover:border-[#5C4FE5] hover:text-[#5C4FE5] transition-colors font-semibold">
        + Tambah Sesi Baru
      </Link>
    </>
  )
}
