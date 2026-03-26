'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ExternalLink, CalendarDays, RefreshCw, X } from 'lucide-react'

const STATUS_MAP: Record<string, { label: string; pill: string }> = {
  scheduled:   { label: 'Terjadwal',      pill: 'bg-[#EEEDFE] text-[#3C3489]' },
  completed:   { label: 'Selesai',        pill: 'bg-[#E6F4EC] text-[#1A5C36]' },
  cancelled:   { label: 'Dibatalkan',     pill: 'bg-[#FEE9E9] text-[#991B1B]' },
  rescheduled: { label: 'Dijadwal Ulang', pill: 'bg-[#FEF3E2] text-[#92400E]' },
  holiday:     { label: 'Libur',          pill: 'bg-teal-50 text-teal-700' },
}

const DAY_NAMES = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']

const inputCls = "w-full px-3 py-2 border border-[#E5E3FF] rounded-xl text-sm bg-[#F7F6FF] text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] transition"

type Props = {
  sessions: any[]
  sesiHariIni: any[]
  sessionsBulanIni: any[]
  todayWITStr: string
  weekOffset: number
  mondayISO: string
  sundayISO: string
}

export default function AdminJadwalClient({
  sessions, sesiHariIni, sessionsBulanIni, todayWITStr, weekOffset, mondayISO, sundayISO,
}: Props) {
  const router = useRouter()

  const monday = new Date(mondayISO)
  const sunday = new Date(sundayISO)

  // Edit sesi modal state
  const [editSesi,     setEditSesi]     = useState<any | null>(null)
  const [editDate,     setEditDate]     = useState('')
  const [editTime,     setEditTime]     = useState('')
  const [editStatus,   setEditStatus]   = useState('')
  const [editZoom,     setEditZoom]     = useState('')
  const [editReason,   setEditReason]   = useState('')
  const [saving,       setSaving]       = useState(false)
  const [msg,          setMsg]          = useState('')

  function fmtKey(iso: string) {
    return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Jayapura' })
  }
  function fmtTime(iso: string) {
    return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jayapura' })
  }
  function fmtHeader(iso: string) {
    return new Date(iso).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jayapura' })
  }
  function fmtMonth(d: Date) {
    return d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric', timeZone: 'Asia/Jayapura' })
  }
  function dKey(d: Date) {
    return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jayapura' })
  }

  const sessionDates = new Set(sessions.map(s => fmtKey(s.scheduled_at)))
  const sessionsByDate: Record<string, any[]> = {}
  sessions.forEach(s => {
    const k = fmtKey(s.scheduled_at)
    if (!sessionsByDate[k]) sessionsByDate[k] = []
    sessionsByDate[k].push(s)
  })

  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday); d.setDate(monday.getDate() + i); return d
  })

  function openEdit(s: any) {
    const wit = new Date(s.scheduled_at)
    const localDate = wit.toLocaleDateString('en-CA', { timeZone: 'Asia/Jayapura' })
    const localTime = wit.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jayapura' })
    setEditSesi(s)
    setEditDate(localDate)
    setEditTime(localTime)
    setEditStatus(s.status)
    setEditZoom(s.zoom_link ?? '')
    setEditReason('')
    setMsg('')
  }

  async function handleSave() {
    if (!editSesi) return
    setSaving(true); setMsg('')
    const scheduledAt = new Date(`${editDate}T${editTime}:00+09:00`).toISOString()
    const body: any = { id: editSesi.id, scheduled_at: scheduledAt, status: editStatus, zoom_link: editZoom || null }
    if (editStatus === 'rescheduled' && editReason) body.reschedule_reason = editReason

    const res  = await fetch('/api/sessions/update', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setMsg(data.error ?? 'Gagal menyimpan'); return }
    setEditSesi(null)
    router.refresh()
  }

  // Batalkan status libur → kembalikan ke scheduled
  const [batalkanId, setBatalkanId] = useState<string | null>(null)
  async function handleBatalkanLibur(s: any) {
    setBatalkanId(s.id)
    await fetch('/api/sessions/update', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id:           s.id,
        status:       'scheduled',
        scheduled_at: s.scheduled_at,
        zoom_link:    s.zoom_link ?? null,
      }),
    })
    setBatalkanId(null)
    router.refresh()
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-black text-[#1A1640] font-['Sora']">Jadwal Sesi</h1>
        <p className="text-sm text-[#7B78A8] mt-1">{fmtMonth(monday)}</p>
      </div>

      {/* Mini Calendar */}
      <div className="bg-white rounded-2xl border border-[#E5E3FF] p-4 mb-4">
        <div className="flex items-center justify-between mb-4">
          <Link href={`/admin/jadwal?week=${weekOffset - 1}`}
            className="px-3 py-1.5 rounded-xl border border-[#E5E3FF] text-sm font-semibold text-[#4A4580] hover:bg-[#F0EFFF] hover:text-[#5C4FE5] transition">
            ← Minggu Lalu
          </Link>
          <span className="text-sm font-bold text-[#1A1640]">
            {monday.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'Asia/Jayapura' })} –{' '}
            {weekDates[6].toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jayapura' })}
          </span>
          <Link href={`/admin/jadwal?week=${weekOffset + 1}`}
            className="px-3 py-1.5 rounded-xl border border-[#E5E3FF] text-sm font-semibold text-[#4A4580] hover:bg-[#F0EFFF] hover:text-[#5C4FE5] transition">
            Minggu Depan →
          </Link>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {weekDates.map((d, i) => {
            const ds = dKey(d); const isToday = ds === todayWITStr; const has = sessionDates.has(ds)
            return (
              <div key={i} className="flex flex-col items-center gap-1">
                <span className="text-[10px] font-bold text-[#7B78A8] uppercase">{DAY_NAMES[i]}</span>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold ${isToday ? 'bg-[#5C4FE5] text-white' : has ? 'bg-[#EEEDFE] text-[#3C3489]' : 'text-[#4A4580]'}`}>
                  {parseInt(ds.slice(-2))}
                </div>
                {has && !isToday && <div className="w-1.5 h-1.5 rounded-full bg-[#5C4FE5]"/>}
              </div>
            )
          })}
        </div>
      </div>

      {/* Sesi Hari Ini */}
      {weekOffset === 0 && (
        <div className="bg-white rounded-2xl border border-[#E5E3FF] overflow-hidden mb-4">
          <div className="px-5 py-3 bg-[#5C4FE5] flex items-center justify-between">
            <span className="text-sm font-bold text-white">
              Sesi Hari Ini — {new Date(todayWITStr + 'T00:00:00+09:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Jayapura' })}
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/20 text-white">
              {sesiHariIni.length} sesi
            </span>
          </div>
          {sesiHariIni.length === 0 ? (
            <div className="p-6 text-center">
              <CalendarDays size={28} strokeWidth={1.5} className="text-[#C4BFFF] mx-auto mb-2"/>
              <p className="text-sm text-[#7B78A8]">Tidak ada sesi hari ini</p>
            </div>
          ) : (
            <div className="divide-y divide-[#F0EFFF]">
              {sesiHariIni.map((s: any) => {
                const st = STATUS_MAP[s.status] ?? { label: s.status, pill: 'bg-gray-100 text-gray-600' }
                const tutorName = s.class_groups?.tutors?.profiles?.full_name ?? '—'
                return (
                  <div key={s.id} className={`flex items-center gap-4 px-5 py-3.5 hover:bg-[#F7F6FF] transition ${s.status === 'holiday' ? 'bg-teal-50/50' : ''}`}>
                    <div className="w-14 flex-shrink-0 text-center">
                      <div className={`text-sm font-black ${s.status === 'holiday' ? 'text-teal-600' : 'text-[#5C4FE5]'}`}>{fmtTime(s.scheduled_at)}</div>
                      <div className="text-[10px] text-[#7B78A8] font-semibold">WIT</div>
                    </div>
                    <div className="w-0.5 h-10 bg-[#E5E3FF] flex-shrink-0 rounded-full"/>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-[#1A1640] truncate">{s.class_groups?.label ?? '—'}</div>
                      <div className="text-xs text-[#7B78A8] mt-0.5">{s.class_groups?.courses?.name ?? '—'} · {tutorName}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-xs px-2.5 py-1 rounded-lg font-semibold ${st.pill}`}>{st.label}</span>
                      {/* Tombol khusus untuk status holiday */}
                      {s.status === 'holiday' && (
                        <button
                          onClick={() => handleBatalkanLibur(s)}
                          disabled={batalkanId === s.id}
                          title="Batalkan libur → kembalikan ke Terjadwal"
                          className="text-xs px-2.5 py-1 rounded-lg font-semibold bg-[#EEEDFE] text-[#5C4FE5] hover:bg-[#5C4FE5] hover:text-white transition disabled:opacity-50 flex items-center gap-1"
                        >
                          {batalkanId === s.id ? (
                            <RefreshCw size={11} className="animate-spin"/>
                          ) : (
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M18 6L6 18M6 6l12 12"/>
                            </svg>
                          )}
                          Batalkan Libur
                        </button>
                      )}
                      {s.zoom_link && (
                        <a href={s.zoom_link} target="_blank" rel="noopener noreferrer"
                          className="text-[#5C4FE5] hover:opacity-70 p-1.5 rounded-lg hover:bg-[#F0EFFF] transition">
                          <ExternalLink size={13}/>
                        </a>
                      )}
                      <button onClick={() => openEdit(s)}
                        className="p-1.5 rounded-lg text-[#7B78A8] hover:bg-[#F0EFFF] hover:text-[#5C4FE5] transition">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Session List */}
      <div className="space-y-4">
        {weekDates.map((d, i) => {
          const ds = dKey(d); const daySessi = sessionsByDate[ds] ?? []; const isToday = ds === todayWITStr
          if (!daySessi.length) return null
          return (
            <div key={i} className="bg-white rounded-2xl border border-[#E5E3FF] overflow-hidden">
              <div className={`px-5 py-3 border-b border-[#E5E3FF] flex items-center justify-between ${isToday ? 'bg-[#5C4FE5]' : 'bg-[#F7F6FF]'}`}>
                <span className={`text-sm font-bold ${isToday ? 'text-white' : 'text-[#1A1640]'}`}>
                  {fmtHeader(d.toISOString())}
                  {isToday && <span className="ml-2 text-xs opacity-80">— Hari Ini</span>}
                </span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isToday ? 'bg-white/20 text-white' : 'bg-[#EEEDFE] text-[#3C3489]'}`}>
                  {daySessi.length} sesi
                </span>
              </div>
              <div className="divide-y divide-[#F0EFFF]">
                {daySessi.map((s: any) => {
                  const st = STATUS_MAP[s.status] ?? { label: s.status, pill: 'bg-gray-100 text-gray-600' }
                  const tutorName = s.class_groups?.tutors?.profiles?.full_name ?? '—'
                  const isRescheduled = s.status === 'rescheduled'
                  return (
                    <div key={s.id} className={`px-5 py-4 hover:bg-[#F7F6FF] transition ${isRescheduled ? 'bg-amber-50/40' : ''}`}>
                      <div className="flex items-center gap-4">
                        <div className="w-14 flex-shrink-0 text-center">
                          <div className={`text-sm font-black ${isRescheduled ? 'text-amber-600' : 'text-[#5C4FE5]'}`}>{fmtTime(s.scheduled_at)}</div>
                          <div className="text-[10px] text-[#7B78A8] font-semibold">WIT</div>
                        </div>
                        <div className="w-0.5 h-10 bg-[#E5E3FF] flex-shrink-0 rounded-full"/>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-[#1A1640] truncate">{s.class_groups?.label ?? '—'}</div>
                          <div className="text-xs text-[#7B78A8] mt-0.5">
                            {s.class_groups?.courses?.name ?? '—'} · {tutorName}
                          </div>
                          {isRescheduled && s.reschedule_reason && (
                            <div className="text-[10px] text-amber-600 mt-0.5">🔄 {s.reschedule_reason}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`text-xs px-2.5 py-1 rounded-lg font-semibold ${st.pill}`}>{st.label}</span>
                          {s.zoom_link && (
                            <a href={s.zoom_link} target="_blank" rel="noopener noreferrer"
                              className="text-[#5C4FE5] hover:opacity-70 p-1.5 rounded-lg hover:bg-[#F0EFFF] transition">
                              <ExternalLink size={13}/>
                            </a>
                          )}
                          <button onClick={() => openEdit(s)}
                            className="p-1.5 rounded-lg text-[#7B78A8] hover:bg-[#F0EFFF] hover:text-[#5C4FE5] transition">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {!Object.keys(sessionsByDate).length && (
          <div className="bg-white rounded-2xl border border-[#E5E3FF] p-10 text-center">
            <CalendarDays size={36} strokeWidth={1.5} className="text-[#C4BFFF] mx-auto mb-3"/>
            <p className="text-sm font-semibold text-[#7B78A8]">Tidak ada sesi minggu ini</p>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editSesi && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E3FF] bg-[#F7F6FF] rounded-t-2xl">
              <div>
                <h3 className="font-bold text-[#1A1640] text-sm">Edit Sesi</h3>
                <p className="text-xs text-[#7B78A8] mt-0.5">{editSesi.class_groups?.label}</p>
              </div>
              <button onClick={() => setEditSesi(null)} className="p-1.5 rounded-lg hover:bg-[#E5E3FF] text-[#7B78A8]">
                <X size={16}/>
              </button>
            </div>
            <div className="px-5 py-4 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-[#7B78A8] uppercase tracking-wider mb-1.5">Tanggal</label>
                  <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className={inputCls}/>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#7B78A8] uppercase tracking-wider mb-1.5">Jam WIT</label>
                  <input type="time" value={editTime} onChange={e => setEditTime(e.target.value)} className={inputCls}/>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#7B78A8] uppercase tracking-wider mb-1.5">Status</label>
                <select value={editStatus} onChange={e => setEditStatus(e.target.value)} className={inputCls}>
                  {Object.entries(STATUS_MAP).map(([v, { label }]) => (
                    <option key={v} value={v}>{label}</option>
                  ))}
                </select>
              </div>
              {editStatus === 'rescheduled' && (
                <div>
                  <label className="block text-[10px] font-bold text-[#7B78A8] uppercase tracking-wider mb-1.5">Alasan Reschedule</label>
                  <input type="text" value={editReason} onChange={e => setEditReason(e.target.value)}
                    placeholder="Contoh: Tutor berhalangan hadir" className={inputCls}/>
                </div>
              )}
              <div>
                <label className="block text-[10px] font-bold text-[#7B78A8] uppercase tracking-wider mb-1.5">Zoom Link</label>
                <input type="url" value={editZoom} onChange={e => setEditZoom(e.target.value)}
                  placeholder="https://zoom.us/j/..." className={inputCls}/>
              </div>
              {msg && <p className="text-xs text-red-600 px-3 py-2 bg-red-50 rounded-xl">{msg}</p>}
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
    </div>
  )
}
