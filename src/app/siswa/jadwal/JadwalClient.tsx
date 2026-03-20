'use client'

import { useState, useMemo } from 'react'

interface Session {
  id: string
  scheduled_at: string
  status: string
  zoom_link: string | null
  reschedule_reason: string | null
  rescheduled_at: string | null
  original_scheduled_at: string | null
  class_groups: {
    id: string
    label: string
    zoom_link: string | null
    courses: { id: string; name: string; color: string } | null
    profiles: { full_name: string } | null
  } | null
  attendance: { id: string; status: string; notes: string | null } | null
}

interface Props {
  sessions: Session[]
  isExpired: boolean
  studentName: string
}

const DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']

function toWITDate(iso: string) {
  return new Date(new Date(iso).toLocaleString('en-US', { timeZone: 'Asia/Jayapura' }))
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('id-ID', {
    timeZone: 'Asia/Jayapura', hour: '2-digit', minute: '2-digit', hour12: false
  })
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

export default function JadwalClient({ sessions, isExpired, studentName }: Props) {
  const nowWIT     = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jayapura' }))
  const [selected, setSelected] = useState<Date>(nowWIT)

  // Buat 7 hari mulai dari hari ini -3 sampai +10 untuk week picker
  const weekDays = useMemo(() => {
    const days = []
    for (let i = -3; i <= 10; i++) {
      const d = new Date(nowWIT)
      d.setDate(d.getDate() + i)
      d.setHours(0, 0, 0, 0)
      days.push(d)
    }
    return days
  }, [])

  // Hari-hari yang punya sesi
  const daysWithSession = useMemo(() => {
    return new Set(
      sessions.map(s => {
        const d = toWITDate(s.scheduled_at)
        return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      })
    )
  }, [sessions])

  // Sesi di hari yang dipilih
  const selectedSessions = useMemo(() => {
    return sessions.filter(s => isSameDay(toWITDate(s.scheduled_at), selected))
  }, [sessions, selected])

  const selectedLabel = `${DAYS[selected.getDay()]}, ${selected.getDate()} ${MONTHS[selected.getMonth()]} ${selected.getFullYear()}`

  function getSessionStatus(s: Session) {
    const sTime = toWITDate(s.scheduled_at)
    const sEnd  = new Date(sTime.getTime() + 90 * 60 * 1000)
    if (s.status === 'cancelled') return 'cancelled'
    if (s.status === 'rescheduled') return 'rescheduled'
    if (nowWIT < sTime) return 'upcoming'
    if (nowWIT >= sTime && nowWIT <= sEnd) return 'ongoing'
    return 'done'
  }

  const statusConfig: Record<string, { label: string; cls: string }> = {
    upcoming:    { label: 'Akan Datang', cls: 'bg-[#FFF8D6] text-[#8A6D00]' },
    ongoing:     { label: 'Sedang Berlangsung', cls: 'bg-[#EAE8FD] text-[#5C4FE5]' },
    done:        { label: 'Selesai', cls: 'bg-gray-100 text-gray-500' },
    cancelled:   { label: 'Dibatalkan', cls: 'bg-red-50 text-red-500' },
    rescheduled: { label: 'Dijadwal Ulang', cls: 'bg-orange-50 text-orange-600' },
  }

  const attConfig: Record<string, { label: string; cls: string }> = {
    hadir: { label: 'Hadir',  cls: 'bg-green-50 text-green-700' },
    izin:  { label: 'Izin',   cls: 'bg-blue-50 text-blue-700' },
    sakit: { label: 'Sakit',  cls: 'bg-yellow-50 text-yellow-700' },
    alpha: { label: 'Alpha',  cls: 'bg-red-50 text-red-600' },
  }

  return (
    <div className="px-4 pt-4 pb-2">
      <div className="mb-4">
        <h2 className="text-[16px] font-bold text-[#1A1530]">Jadwal Sesi</h2>
        <p className="text-[12px] text-[#9B97B2] mt-0.5">{studentName}</p>
      </div>

      {/* ── WEEK PICKER ── */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
        {weekDays.map((day, i) => {
          const key       = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`
          const isToday   = isSameDay(day, nowWIT)
          const isActive  = isSameDay(day, selected)
          const hasSesi   = daysWithSession.has(key)

          return (
            <button
              key={i}
              onClick={() => setSelected(day)}
              className={`
                flex flex-col items-center px-3 py-2 rounded-xl border flex-shrink-0 min-w-[52px] transition-colors
                ${isActive
                  ? 'bg-[#5C4FE5] border-[#5C4FE5]'
                  : 'bg-white border-[#E5E3FF]'}
              `}
            >
              <span className={`text-[10px] font-medium ${isActive ? 'text-white/70' : 'text-[#9B97B2]'}`}>
                {DAYS[day.getDay()]}
              </span>
              <span className={`text-[14px] font-bold mt-0.5 ${isActive ? 'text-white' : isToday ? 'text-[#5C4FE5]' : 'text-[#1A1530]'}`}>
                {day.getDate()}
              </span>
              {hasSesi && (
                <div className={`w-1 h-1 rounded-full mt-1 ${isActive ? 'bg-white/70' : 'bg-[#5C4FE5]'}`} />
              )}
            </button>
          )
        })}
      </div>

      {/* ── HEADER HARI TERPILIH ── */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-[13px] font-bold text-[#1A1530]">{selectedLabel}</p>
        <p className="text-[11px] text-[#9B97B2]">
          {selectedSessions.length > 0
            ? `${selectedSessions.length} sesi`
            : 'tidak ada sesi'}
        </p>
      </div>

      {/* ── SESI LIST ── */}
      {selectedSessions.length === 0 ? (
        <div className="bg-white border border-[#E5E3FF] rounded-2xl py-10 text-center">
          <p className="text-[13px] font-semibold text-[#9B97B2]">Tidak ada sesi</p>
          <p className="text-[11px] text-[#9B97B2] mt-1">pada hari ini</p>
        </div>
      ) : (
        <div className="space-y-3">
          {selectedSessions.map(s => {
            const cg       = s.class_groups
            const course   = cg?.courses
            const tutor    = cg?.profiles
            const zoomLink = s.zoom_link || cg?.zoom_link
            const color    = course?.color ?? '#5C4FE5'
            const sStatus  = getSessionStatus(s)
            const cfg      = statusConfig[sStatus]
            const att      = s.attendance
            const attCfg   = att ? attConfig[att.status] : null

            return (
              <div
                key={s.id}
                className="bg-white border border-[#E5E3FF] rounded-2xl p-4 flex gap-3"
              >
                {/* Garis warna kiri */}
                <div className="w-1 rounded-full flex-shrink-0 self-stretch" style={{ background: color }} />

                <div className="flex-1">
                  {/* Waktu + status */}
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="text-[15px] font-bold text-[#1A1530]">
                        {formatTime(s.scheduled_at)}
                      </span>
                      <span className="text-[11px] text-[#9B97B2] ml-1">WIT</span>
                    </div>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg ${cfg.cls}`}>
                      {cfg.label}
                    </span>
                  </div>

                  {/* Nama mapel + tutor */}
                  <p className="text-[14px] font-bold text-[#1A1530] mb-0.5">
                    {course?.name ?? cg?.label ?? '—'}
                  </p>
                  <p className="text-[12px] text-[#9B97B2] mb-3">
                    {tutor?.full_name ?? '—'} · {zoomLink ? 'Online' : 'Offline'}
                  </p>

                  {/* Tags bawah */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Badge kehadiran */}
                    {attCfg && (
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg ${attCfg.cls}`}>
                        {attCfg.label}
                      </span>
                    )}
                    {att?.notes && (
                      <span className="text-[11px] text-[#9B97B2]">— {att.notes}</span>
                    )}

                    {/* Zoom link */}
                    {zoomLink && (sStatus === 'upcoming' || sStatus === 'ongoing') && !isExpired && (
                      <a
                        href={zoomLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto text-[11px] font-bold bg-[#EAE8FD] text-[#5C4FE5] px-3 py-1.5 rounded-lg inline-flex items-center gap-1"
                      >
                        ▶ Buka Zoom
                      </a>
                    )}
                  </div>

                  {/* Info reschedule */}
                  {s.status === 'rescheduled' && s.reschedule_reason && (
                    <div className="mt-2 px-3 py-2 bg-orange-50 rounded-xl">
                      <p className="text-[11px] text-orange-700">
                        Dijadwal ulang: {s.reschedule_reason}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
