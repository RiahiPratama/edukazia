'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CalendarDays, ExternalLink } from 'lucide-react'

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

export default function TutorJadwalClient({
  sessions, sesiHariIni, sessionsBulanIni, todayWITStr, weekOffset, mondayISO, sundayISO,
}: Props) {
  const monday  = new Date(mondayISO)
  const sunday  = new Date(sundayISO)



  const fmtKey    = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Jayapura' })
  const fmtTime   = (iso: string) => new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jayapura' })
  const fmtHeader = (d: Date)     => d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jayapura' })
  const fmtMonth  = (d: Date)     => d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric', timeZone: 'Asia/Jayapura' })
  const dKey      = (d: Date)     => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jayapura' })

  const sessionDates = new Set(sessionsBulanIni.map(s => fmtKey(s.scheduled_at)))
  const sessionsByDate: Record<string, any[]> = {}
  sessions.forEach(s => {
    const k = fmtKey(s.scheduled_at)
    if (!sessionsByDate[k]) sessionsByDate[k] = []
    sessionsByDate[k].push(s)
  })

  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday); d.setDate(monday.getDate() + i); return d
  })





  function SesiRow({ s, compact = false }: { s: any; compact?: boolean }) {
    const st = STATUS_MAP[s.status] ?? { label: s.status, pill: 'bg-gray-100 text-gray-600' }
    return (
      <div className={`flex items-center gap-3 ${compact ? 'p-3 rounded-xl bg-[#F7F6FF] border border-[#F0EFFF]' : 'px-5 py-4 hover:bg-[#F7F6FF] transition'}`}>
        <div className="w-14 flex-shrink-0 text-center">
          <div className="text-sm font-black text-[#5C4FE5]">{fmtTime(s.scheduled_at)}</div>
          <div className="text-[10px] text-[#7B78A8] font-semibold">WIT</div>
        </div>
        {!compact && <div className="w-0.5 h-10 bg-[#E5E3FF] flex-shrink-0 rounded-full"/>}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-[#1A1640] truncate">{s.class_groups?.label ?? '—'}</div>
          <div className="text-xs text-[#7B78A8] mt-0.5">{s.class_groups?.courses?.name ?? '—'}</div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={`text-xs px-2 py-1 rounded-lg font-semibold ${st.pill}`}>{st.label}</span>
          {s.zoom_link && (
            <a href={s.zoom_link} target="_blank" rel="noopener noreferrer"
              className="text-xs px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg font-semibold hover:bg-blue-100 transition">
              Zoom
            </a>
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-black text-[#1A1640] font-['Sora']">Jadwal Mengajar</h1>
        <p className="text-sm text-[#7B78A8] mt-1">{fmtMonth(monday)}</p>
      </div>

      {/* ── Mini Calendar ── */}
      <div className="bg-white rounded-2xl border border-[#E5E3FF] p-4 mb-4">
        <div className="flex items-center justify-between mb-4">
          <Link href={`/tutor/jadwal?week=${weekOffset - 1}`}
            className="px-3 py-1.5 rounded-xl border border-[#E5E3FF] text-sm font-semibold text-[#4A4580] hover:bg-[#F0EFFF] hover:text-[#5C4FE5] transition">
            ← Minggu Lalu
          </Link>
          <span className="text-sm font-bold text-[#1A1640]">
            {monday.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'Asia/Jayapura' })} –{' '}
            {weekDates[6].toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jayapura' })}
          </span>
          <Link href={`/tutor/jadwal?week=${weekOffset + 1}`}
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

      {/* ── Sesi Hari Ini — tampil di bawah kalender ── */}
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
              <p className="text-sm text-[#7B78A8]">Tidak ada sesi mengajar hari ini</p>
            </div>
          ) : (
            <div className="px-4 py-3 space-y-2">
              {sesiHariIni.map((s: any) => <SesiRow key={s.id} s={s} compact/>)}
            </div>
          )}
        </div>
      )}

      {/* ── Session List ── */}
      <div className="space-y-4">
        {weekDates.map((d, i) => {
          const ds = dKey(d); const daySessi = sessionsByDate[ds] ?? []; const isToday = ds === todayWITStr
          if (!daySessi.length) return null
          return (
            <div key={i} className="bg-white rounded-2xl border border-[#E5E3FF] overflow-hidden">
              <div className={`px-5 py-3 border-b border-[#E5E3FF] flex items-center justify-between ${isToday ? 'bg-[#5C4FE5]' : 'bg-[#F7F6FF]'}`}>
                <span className={`text-sm font-bold ${isToday ? 'text-white' : 'text-[#1A1640]'}`}>
                  {fmtHeader(d)}{isToday && <span className="ml-2 text-xs opacity-80">— Hari Ini</span>}
                </span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isToday ? 'bg-white/20 text-white' : 'bg-[#EEEDFE] text-[#3C3489]'}`}>
                  {daySessi.length} sesi
                </span>
              </div>
              <div className="divide-y divide-[#F0EFFF]">
                {daySessi.map((s: any) => <SesiRow key={s.id} s={s}/>)}
              </div>
            </div>
          )
        })}

        {!Object.keys(sessionsByDate).length && weekOffset !== 0 && (
          <div className="bg-white rounded-2xl border border-[#E5E3FF] p-10 text-center">
            <CalendarDays size={36} strokeWidth={1.5} className="text-[#C4BFFF] mx-auto mb-3"/>
            <p className="text-sm font-semibold text-[#7B78A8]">Tidak ada sesi mengajar minggu ini</p>
          </div>
        )}
      </div>

      {/* ── Edit Modal ── */}
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
