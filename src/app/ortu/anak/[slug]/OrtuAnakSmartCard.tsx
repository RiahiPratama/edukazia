'use client'

import { useState, useEffect } from 'react'

interface Session {
  id: string
  scheduled_at: string
  zoom_link: string | null
  classLabel: string
  tutorName: string
  durationMinutes: number
  studentName: string
}

interface Props {
  activeSessions: Session[]
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('id-ID', {
    hour: '2-digit', minute: '2-digit', hour12: false,
    timeZone: 'Asia/Jayapura',
  })
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'short',
    timeZone: 'Asia/Jayapura',
  })
}

export default function OrtuAnakSmartCard({ activeSessions }: Props) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  if (!activeSessions || activeSessions.length === 0) return null

  const fmt = (ms: number) => {
    const total = Math.max(0, ms)
    const h = Math.floor(total / 3600000)
    const m = Math.floor((total % 3600000) / 60000)
    const s = Math.floor((total % 60000) / 1000)
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${m}:${String(s).padStart(2, '0')}`
  }

  return (
    <div className="flex flex-col gap-3 mb-4">
      {activeSessions.map((session) => {
        const sessionStart = new Date(session.scheduled_at).getTime()
        const durationMs   = session.durationMinutes * 60 * 1000
        const sessionEnd   = sessionStart + durationMs
        const isLive       = now >= sessionStart && now < sessionEnd
        const diffMs       = sessionStart - now
        const elapsedMs    = now - sessionStart

        const dashArr = 163
        const arcPct  = isLive
          ? Math.min(1, elapsedMs / durationMs)
          : Math.max(0, 1 - diffMs / (180 * 60000))
        const dashOff = Math.round(dashArr - arcPct * dashArr)

        return (
          <div key={session.id}
            className="relative rounded-2xl overflow-hidden p-5"
            style={{ background: '#1A1640' }}>
            {/* Dekorasi */}
            <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full pointer-events-none"
              style={{ background: isLive ? 'rgba(34,197,94,0.15)' : 'rgba(230,184,0,0.15)', filter: 'blur(35px)' }} />
            <div className="absolute -bottom-6 -left-6 w-32 h-32 rounded-full pointer-events-none"
              style={{ background: 'rgba(92,79,229,0.2)', filter: 'blur(30px)' }} />

            <div className="relative z-10">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isLive ? 'bg-green-500 animate-ping' : 'bg-red-500 animate-pulse'}`} />
                    <span className={`text-[9px] font-extrabold tracking-widest uppercase ${isLive ? 'text-green-400' : 'text-amber-400'}`}>
                      {isLive ? '🟢 Sedang Berlangsung' : '🔴 Kelas Segera Dimulai'}
                    </span>
                  </div>
                  <p className="text-[17px] font-extrabold text-white truncate">{session.studentName}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    {session.classLabel} · {session.tutorName}
                  </p>
                </div>

                {/* Circular timer */}
                <div className="relative flex-shrink-0" style={{ width: 68, height: 68 }}>
                  <svg width="68" height="68" viewBox="0 0 68 68" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="34" cy="34" r="26" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4"/>
                    <circle cx="34" cy="34" r="26" fill="none"
                      stroke={isLive ? '#22c55e' : '#E6B800'}
                      strokeWidth="4"
                      strokeDasharray={dashArr}
                      strokeDashoffset={dashOff}
                      strokeLinecap="round"
                      style={{ transition: 'stroke-dashoffset 1s linear' }}/>
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: isLive ? '#4ade80' : 'white', lineHeight: 1 }}>
                      {isLive ? fmt(elapsedMs) : fmt(diffMs)}
                    </span>
                    <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                      {isLive ? 'berlangsung' : 'lagi'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Info baris */}
              <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: isLive ? '#22c55e' : '#E6B800', animation: 'pulse 2s infinite' }} />
                {isLive ? (
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>
                    Durasi {session.durationMinutes} menit · Selesai pukul {fmtTime(new Date(sessionEnd).toISOString())} WIT
                  </span>
                ) : (
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
                    {fmtDate(session.scheduled_at)}, {fmtTime(session.scheduled_at)} WIT
                  </span>
                )}
              </div>

              {session.zoom_link ? (
                <a href={session.zoom_link} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3.5 rounded-full font-extrabold text-[14px] active:scale-95 transition-transform"
                  style={{
                    background: isLive ? '#22c55e' : '#2D8CFF',
                    color: 'white',
                    boxShadow: isLive ? '0 0 28px rgba(34,197,94,0.35)' : '0 0 28px rgba(45,140,255,0.35)',
                  }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/>
                  </svg>
                  {isLive ? 'Gabung Zoom Sekarang' : 'Buka Zoom Sekarang'}
                </a>
              ) : (
                <p className="text-center text-[11px] py-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Link Zoom belum tersedia
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
