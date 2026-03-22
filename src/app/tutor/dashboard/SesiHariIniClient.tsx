'use client'

import { useState, useEffect } from 'react'

function getDurasiMenit(classTypeName: string, courseName: string): number {
  const type   = (classTypeName ?? '').toLowerCase()
  const course = (courseName ?? '').toLowerCase()
  if (type.includes('privat') && !type.includes('semi') && course.includes('inggris')) return 45
  return 60
}

function CountdownBadge({ scheduledAt, classTypeName, courseName }: {
  scheduledAt: string
  classTypeName: string
  courseName: string
}) {
  const [diffMs, setDiffMs] = useState(() => new Date(scheduledAt).getTime() - Date.now())

  useEffect(() => {
    const interval = setInterval(() => {
      setDiffMs(new Date(scheduledAt).getTime() - Date.now())
    }, 1000)
    return () => clearInterval(interval)
  }, [scheduledAt])

  const durasiMs = getDurasiMenit(classTypeName, courseName) * 60 * 1000

  // Lebih dari 3 jam ke depan → tidak tampil
  if (diffMs > 3 * 60 * 60 * 1000) return null

  // Sudah lewat durasi kelas → Telah dilaksanakan
  if (diffMs < -durasiMs) {
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-stone-100 text-stone-500 w-fit flex items-center gap-1">
        ✓ Telah dilaksanakan
      </span>
    )
  }

  // Sedang berlangsung
  if (diffMs <= 0) {
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-green-100 text-green-700 flex items-center gap-1 w-fit">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
        Berlangsung
      </span>
    )
  }

  // Countdown mundur
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

export default function SesiHariIniClient({ sesiHariIni }: { sesiHariIni: any[] }) {
  function fmtTime(iso: string) {
    return new Date(iso).toLocaleTimeString('id-ID', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jayapura',
    })
  }

  const statusColor: Record<string, string> = {
    scheduled:   'bg-blue-50 text-blue-700',
    completed:   'bg-green-50 text-green-700',
    cancelled:   'bg-red-50 text-red-700',
    rescheduled: 'bg-yellow-50 text-yellow-700',
  }
  const statusLabel: Record<string, string> = {
    scheduled:   'Terjadwal',
    completed:   'Selesai',
    cancelled:   'Dibatalkan',
    rescheduled: 'Reschedule',
  }

  if (!sesiHariIni || sesiHariIni.length === 0) {
    return (
      <div className="text-center py-8 text-[#7B78A8] text-sm">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
          className="mx-auto mb-2 text-[#C4BFFF]">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        Tidak ada sesi mengajar hari ini
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {sesiHariIni.map((s: any) => {
        const classTypeName = s.class_groups?.class_types?.name ?? ''
        return (
          <div key={s.id}
            className="flex items-center gap-3 p-3 rounded-xl hover:bg-[#F7F6FF] transition-colors border border-[#F0EFFF]">
            <div className="w-14 text-center flex-shrink-0">
              <div className="text-sm font-black text-[#5C4FE5]">{fmtTime(s.scheduled_at)}</div>
              <div className="text-[10px] text-[#7B78A8] font-semibold">WIT</div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-[#1A1640] truncate">
                {s.class_groups?.label ?? '—'}
              </div>
              <div className="text-xs text-[#7B78A8]">
                {s.class_groups?.courses?.name ?? '—'}
              </div>
              <div className="mt-1">
                <CountdownBadge scheduledAt={s.scheduled_at} classTypeName={classTypeName} courseName={s.class_groups?.courses?.name ?? ''} />
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {s.zoom_link && (
                <a href={s.zoom_link} target="_blank" rel="noopener noreferrer"
                  className="text-xs px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg font-semibold hover:bg-blue-100 transition-colors">
                  Buka Zoom
                </a>
              )}
              <span className={`text-xs px-2 py-1 rounded-lg font-semibold ${statusColor[s.status] ?? 'bg-gray-50 text-gray-700'}`}>
                {statusLabel[s.status] ?? s.status}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
