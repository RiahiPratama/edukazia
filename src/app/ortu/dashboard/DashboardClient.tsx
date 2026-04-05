'use client'

import Link from 'next/link'
import { CalendarDays, ExternalLink, ChevronRight, FileText, Clock } from 'lucide-react'
import { useState, useEffect } from 'react'
import AnnouncementFetcher from '@/components/AnnouncementFetcher'

interface Props {
  profile: { full_name: string; email: string }
  childrenData: any[]
  activityFeed: any[]
  adminPhone: string | null
  archivedData: any[]
  stats: {
    totalAnak: number
    totalSesiMingguIni: number
    avgKehadiran: number
    totalTagihanBelumBayar: number
  }
}

const CHILD_COLORS = [
  { top: '#E6B800', bg: '#FAEEDA', text: '#412402', badge: '#FAC775' },
  { top: '#1D9E75', bg: '#E1F5EE', text: '#085041', badge: '#9FE1CB' },
  { top: '#5C4FE5', bg: '#EEEDFE', text: '#3C3489', badge: '#CECBF6' },
  { top: '#D85A30', bg: '#FAECE7', text: '#4A1B0C', badge: '#F5C4B3' },
  { top: '#639922', bg: '#EAF3DE', text: '#173404', badge: '#C0DD97' },
]

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'short',
    timeZone: 'Asia/Jayapura',
  })
}

function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', {
    weekday: 'short', day: 'numeric', month: 'short',
    timeZone: 'Asia/Jayapura',
  })
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('id-ID', {
    hour: '2-digit', minute: '2-digit', hour12: false,
    timeZone: 'Asia/Jayapura',
  })
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (d > 0) return `${d} hari lalu`
  if (h > 0) return `${h} jam lalu`
  return 'Baru saja'
}

function isToday(iso: string) {
  const d = new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Jayapura' })
  const t = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jayapura' })
  return d === t
}

// Ring Stories Row
type RingColor = 'yellow' | 'green' | 'red' | 'gray'

function storyRing(child: any): RingColor {
  const hasUrgent = child.enrollments.some((e: any) => (e.total - e.progress) <= 1)
  if (hasUrgent) return 'red'
  const hasToday = child.enrollments.some((e: any) => e.nextSession && isToday(e.nextSession))
  if (hasToday) return 'yellow'
  if (child.enrollments.length > 0) return 'green'
  return 'gray'
}

const RING_CSS: Record<RingColor, string> = {
  yellow: '2.5px solid #E6B800',
  green:  '2.5px solid #22c55e',
  red:    '2.5px solid #ef4444',
  gray:   '2.5px solid #d1d5db',
}

const RING_GLOW: Record<RingColor, string> = {
  yellow: '0 0 0 3px rgba(230,184,0,0.25)',
  green:  '0 0 0 3px rgba(34,197,94,0.2)',
  red:    '0 0 0 3px rgba(239,68,68,0.2)',
  gray:   'none',
}

const RING_BADGE: Record<RingColor, { bg: string; color: string; label: string }> = {
  yellow: { bg: '#FFF9E6', color: '#92400E', label: 'Hari ini' },
  green:  { bg: '#F0FDF4', color: '#15803D', label: 'Oke ✓' },
  red:    { bg: '#FEF2F2', color: '#dc2626', label: 'Perhatian!' },
  gray:   { bg: '#F3F4F6', color: '#6B7280', label: 'Tidak aktif' },
}

export default function OrtuDashboardClient({ profile, childrenData, activityFeed, adminPhone, archivedData, stats }: Props) {
  const [now, setNow] = useState(() => Date.now())
  const [isDark, setIsDark] = useState(false)
  const [mouse, setMouse] = useState({ x: -999, y: -999 })

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const check = () => setIsDark(localStorage.getItem('ortu-theme') === 'dark')
    check()
    window.addEventListener('storage', check)
    // Also observe CSS variable change via MutationObserver
    const obs = new MutationObserver(check)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] })
    return () => { window.removeEventListener('storage', check); obs.disconnect() }
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => setMouse({ x: e.clientX, y: e.clientY })
    window.addEventListener('mousemove', handler)
    return () => window.removeEventListener('mousemove', handler)
  }, [])
  const firstName = profile.full_name.split(' ')[0]
  const jam = parseInt(new Date().toLocaleString('id-ID', { hour: '2-digit', timeZone: 'Asia/Jayapura', hour12: false }))
  const greeting = jam < 12 ? 'Selamat pagi' : jam < 17 ? 'Selamat siang' : 'Selamat malam'
  const today = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'Asia/Jayapura',
  })

  // Sesi hari ini dari SEMUA anak (upcoming + live)
  const allTodaySessions = childrenData.flatMap((child, idx) =>
    (child.todaySessions ?? []).map((s: any) => ({
      ...s,
      childName:  child.full_name,
      childId:    child.id,
      childColor: CHILD_COLORS[idx % CHILD_COLORS.length],
    }))
  ).sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())

  // Sesi yang relevan ditampilkan di zoom card:
  // - Belum mulai dan dalam 3 jam ke depan, ATAU
  // - Sedang berlangsung (belum selesai)
  const activeSessions = childrenData.flatMap((child, idx) =>
    child.enrollments
      .filter((e: any) => {
        if (!e.nextSession) return false
        const start = new Date(e.nextSession).getTime()
        const end   = start + (e.durationMinutes ?? 60) * 60 * 1000
        const diffMins = Math.round((start - now) / 60000)
        return (diffMins >= 0 && diffMins <= 180) || (now >= start && now < end)
      })
      .map((e: any) => ({
        ...e,
        childName:  child.full_name,
        childSlug:  child.slug ?? child.id,
        childColor: CHILD_COLORS[idx % CHILD_COLORS.length],
      }))
  ).sort((a: any, b: any) =>
    new Date(a.nextSession).getTime() - new Date(b.nextSession).getTime()
  )

  // Jadwal terdekat untuk stats (dari semua anak)
  const nextSched = childrenData.flatMap(c => c.enrollments)
    .filter((e: any) => e.nextSession)
    .sort((a: any, b: any) => new Date(a.nextSession).getTime() - new Date(b.nextSession).getTime())[0]

  return (
    <div className="min-h-screen pb-16" style={{ position: 'relative' }}>

      {/* ── DOT GRID — dark mode only ── */}
      {isDark && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='24' height='24' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='1' cy='1' r='1' fill='rgba(255,255,255,0.1)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
        }} />
      )}

      {/* ── SPOTLIGHT — ikuti mouse, dark mode only ── */}
      {isDark && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none',
          background: `radial-gradient(600px circle at ${mouse.x}px ${mouse.y}px, rgba(92,79,229,0.13), transparent 80%)`,
          transition: 'background 0.1s',
        }} />
      )}

      {/* Content wrapper — di atas dot grid */}
      <div style={{ position: 'relative', zIndex: 2 }}>

      {/* Pengumuman */}
      <AnnouncementFetcher />

      {/* ── HERO ── */}
      <div className="relative overflow-hidden rounded-2xl mx-4 mt-4 mb-5 p-5"
        style={{
          background: isDark
            ? 'linear-gradient(135deg, rgba(92,79,229,0.25) 0%, rgba(26,22,64,0.8) 100%)'
            : 'linear-gradient(135deg, #5C4FE5 0%, #4338CA 100%)',
          border: isDark ? '1px solid rgba(92,79,229,0.3)' : 'none',
          backdropFilter: isDark ? 'blur(20px)' : 'none',
        }}>
        {/* Dekorasi */}
        <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full pointer-events-none"
          style={{ background: isDark ? 'rgba(230,184,0,0.06)' : 'rgba(255,255,255,0.1)', filter: 'blur(30px)' }} />
        <div className="absolute -bottom-6 -left-6 w-28 h-28 rounded-full pointer-events-none"
          style={{ background: isDark ? 'rgba(92,79,229,0.15)' : 'rgba(255,255,255,0.08)', filter: 'blur(20px)' }} />

        <div className="relative z-10">
          <p className="text-[11px] font-medium mb-1" style={{ color: 'rgba(255,255,255,0.6)' }}>{today}</p>
          <p className="text-[19px] font-extrabold text-white mb-0.5">{greeting}, {firstName}! 👋</p>
          <p className="text-[12px] mb-4" style={{ color: 'rgba(255,255,255,0.65)' }}>
            {stats.totalAnak} anak aktif belajar
          </p>

          {/* Stats grid */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { num: stats.totalSesiMingguIni, lbl: 'Sesi minggu' },
              { num: `${stats.avgKehadiran}%`, lbl: 'Kehadiran', green: stats.avgKehadiran >= 80 },
              { num: activityFeed.length, lbl: 'Laporan baru', pulse: activityFeed.length > 0 },
              { num: nextSched ? fmtDateShort(nextSched.nextSession).split(',')[0] : '—', lbl: 'Jadwal' },
            ].map((s, i) => (
              <div key={i} className="relative rounded-xl px-2 py-2.5 text-center"
                style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.1)' }}>
                {s.pulse && <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400 animate-pulse" />}
                <p className="text-[15px] font-extrabold text-white">{s.num}</p>
                <p className="text-[9px] mt-0.5 leading-tight" style={{ color: 'rgba(255,255,255,0.55)' }}>{s.lbl}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── STORIES ROW — compact pills ── */}
      {childrenData.length > 0 && (
        <div className="px-4 mb-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {childrenData.map((child, idx) => {
              const ring = storyRing(child)
              const badge = RING_BADGE[ring]
              const childCol = CHILD_COLORS[idx % CHILD_COLORS.length]
              const todayEnroll = child.enrollments.find((e: any) => e.nextSession && isToday(e.nextSession))
              const timeLabel = ring === 'yellow' && todayEnroll
                ? fmtTime(todayEnroll.nextSession)
                : badge.label

              return (
                <Link key={child.id}
                  href={`/ortu/anak/${child.slug ?? child.id}`}
                  className="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl active:scale-95 transition-all"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.8)',
                    border: RING_CSS[ring],
                    boxShadow: RING_GLOW[ring],
                    backdropFilter: 'blur(8px)',
                  }}>
                  {/* Dot status */}
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: ring === 'yellow' ? '#E6B800'
                      : ring === 'green' ? '#22c55e'
                      : ring === 'red' ? '#ef4444' : '#d1d5db',
                    boxShadow: ring !== 'gray' ? `0 0 0 2px ${
                      ring === 'yellow' ? 'rgba(230,184,0,0.25)'
                      : ring === 'green' ? 'rgba(34,197,94,0.25)'
                      : 'rgba(239,68,68,0.25)'
                    }` : 'none',
                  }} />
                  {/* Nama */}
                  <span style={{ fontSize: 12, fontWeight: 700, color: childCol.text, background: childCol.bg,
                    padding: '1px 6px', borderRadius: 6 }}>
                    {child.full_name.split(' ')[0]}
                  </span>
                  {/* Status */}
                  <span style={{ fontSize: 10, fontWeight: 600, color: isDark ? 'rgba(255,255,255,0.7)' : badge.color, whiteSpace: 'nowrap' }}>
                    {timeLabel}
                  </span>
                </Link>
              )
            })}

          </div>
        </div>
      )}

      <div className="px-4 space-y-4">

        {/* ── SESI HARI INI — hanya tampil kalau tidak ada smart card ── */}
        {activeSessions.length === 0 && allTodaySessions.length > 0 && (
          <div>
            <p className="text-[12px] font-bold" style={{ color: "var(--ortu-text)" }} mb-2">Jadwal Hari Ini</p>
            <div className="flex flex-col gap-2">
              {allTodaySessions.map((session: any, idx: number) => {
                const col = session.childColor
                return (
                  <div key={`today-${session.id}-${idx}`}
                    className="bg-white dark:bg-stone-900 rounded-2xl overflow-hidden"
                    style={{ border: `1.5px solid ${col.top}30` }}>
                    <div className="flex items-center gap-3 px-4 py-3"
                      style={{ background: `${col.top}10` }}>
                      {/* Jam */}
                      <div className="flex-shrink-0 text-center min-w-[40px]">
                        <p className="text-[15px] font-extrabold leading-none" style={{ color: col.top }}>
                          {fmtTime(session.scheduled_at)}
                        </p>
                        <p className="text-[9px] text-stone-400 font-semibold mt-0.5">WIT</p>
                      </div>
                      <div className="w-px h-8 flex-shrink-0" style={{ background: `${col.top}30` }} />
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-extrabold text-stone-800 dark:text-stone-100 truncate">
                          {session.classLabel}
                        </p>
                        <p className="text-[10px] text-stone-400 truncate">
                          {session.tutorName} · {session.childName}
                        </p>
                      </div>
                      {/* Zoom */}
                      {session.zoom_link && (
                        <a href={session.zoom_link} target="_blank" rel="noopener noreferrer"
                          className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-bold text-white active:scale-95 transition-transform"
                          style={{ background: '#2D8CFF' }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="white">
                            <path d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/>
                          </svg>
                          Zoom
                        </a>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── SMART ZOOM CARD ── */}
        {activeSessions.map((enroll: any) => {
          const sessionStart = new Date(enroll.nextSession).getTime()
          const durationMs   = (enroll.durationMinutes ?? 60) * 60 * 1000
          const sessionEnd   = sessionStart + durationMs
          const isLive       = now >= sessionStart && now < sessionEnd
          const diffMs       = sessionStart - now
          const elapsedMs    = now - sessionStart

          const fmt = (ms: number) => {
            const total = Math.max(0, ms)
            const h = Math.floor(total / 3600000)
            const m = Math.floor((total % 3600000) / 60000)
            const s = Math.floor((total % 60000) / 1000)
            return h > 0
              ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
              : `${m}:${String(s).padStart(2,'0')}`
          }

          const arcPct = isLive
            ? Math.min(1, elapsedMs / durationMs)
            : Math.max(0, 1 - diffMs / (180 * 60000))
          const dashArr = 163
          const dashOff = Math.round(dashArr - arcPct * dashArr)

          return (
            <div key={enroll.enrollmentId}
              className="relative rounded-2xl overflow-hidden p-5"
              style={{ background: '#1A1640' }}>
              <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full blur-3xl pointer-events-none"
                style={{ background: isLive ? 'rgba(34,197,94,0.15)' : 'rgba(230,184,0,0.15)' }} />
              <div className="absolute -bottom-6 -left-6 w-32 h-32 rounded-full blur-2xl pointer-events-none"
                style={{ background: 'rgba(92,79,229,0.2)' }} />

              <div className="relative z-10">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isLive ? 'bg-green-500 animate-ping' : 'bg-red-500 animate-pulse'}`} />
                      <span className={`text-[9px] font-extrabold tracking-widest uppercase ${isLive ? 'text-green-400' : 'text-amber-400'}`}>
                        {isLive ? '🟢 Sedang Berlangsung' : '🔴 Kelas Segera Dimulai'}
                      </span>
                    </div>
                    <p className="text-[17px] font-extrabold text-white truncate">{enroll.childName}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      {enroll.classLabel} · {enroll.tutorName}
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
                    <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: isLive ? '#4ade80' : 'white', lineHeight: 1 }}>
                        {isLive ? fmt(elapsedMs) : fmt(diffMs)}
                      </span>
                      <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                        {isLive ? 'berlangsung' : 'lagi'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <div className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: isLive ? '#22c55e' : '#E6B800', animation: 'pulse 2s infinite' }} />
                  {isLive ? (
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>
                      Durasi {enroll.durationMinutes ?? 60} menit · Selesai pukul {fmtTime(new Date(sessionEnd).toISOString())} WIT
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
                      {fmtDate(enroll.nextSession)}, {fmtTime(enroll.nextSession)} WIT
                    </span>
                  )}
                </div>

                {enroll.zoomLink ? (
                  <a href={enroll.zoomLink} target="_blank" rel="noopener noreferrer"
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

        {/* ── RINGKASAN PER ANAK ── */}
        {childrenData.length > 0 && (
          <div>
            <p className="text-[12px] font-bold" style={{ color: "var(--ortu-text)" }} mb-2">Ringkasan per Anak</p>
            <div className="flex flex-col gap-3">
              {childrenData.map((child, idx) => {
                const childCol = CHILD_COLORS[idx % CHILD_COLORS.length]
                return (
                  <div key={child.id} className="bg-white dark:bg-stone-900 rounded-2xl overflow-hidden border border-stone-100 dark:border-stone-800"
                    style={{ borderTop: `3px solid ${childCol.top}` }}>
                    {/* Header anak */}
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-stone-50 dark:border-stone-800">
                      <div className="relative">
                        <div className="w-11 h-11 rounded-full p-[2.5px]"
                          style={{ background: `linear-gradient(135deg, ${childCol.top}, #E6B800)` }}>
                          <div className="w-full h-full rounded-full flex items-center justify-center text-[12px] font-extrabold border-2 border-white dark:border-stone-900"
                            style={{ background: childCol.bg, color: childCol.text }}>
                            {initials(child.full_name)}
                          </div>
                        </div>
                        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white dark:border-stone-900 animate-pulse" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-extrabold text-stone-800 dark:text-stone-100 truncate">{child.full_name}</p>
                        <p className="text-[10px] text-stone-400 dark:text-stone-500">
                          {child.grade ?? '—'}{child.school ? ` · ${child.school}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {child.hadirPct > 0 && (
                          <div className="text-right">
                            <p className={`text-[16px] font-extrabold ${child.hadirPct >= 80 ? 'text-green-600' : child.hadirPct >= 60 ? 'text-amber-600' : 'text-red-500'}`}>
                              {child.hadirPct}%
                            </p>
                            <p className="text-[9px] text-stone-400">Hadir</p>
                          </div>
                        )}
                        <Link href={`/ortu/anak/${child.slug ?? child.id}`}
                          className="text-[10px] text-stone-400 hover:text-stone-700 flex items-center gap-0.5">
                          <ChevronRight size={14} />
                        </Link>
                      </div>
                    </div>

                    {/* Enrollments */}
                    <div className="px-4 py-3 space-y-3">
                      {child.enrollments.length === 0 ? (
                        <p className="text-[11px] text-stone-400 py-1">Belum ada kelas aktif</p>
                      ) : (
                        child.enrollments.map((enroll: any) => {
                          const sisa = enroll.total - (enroll.barProgress ?? enroll.progress)
                          const barPct = Math.min(100, Math.round((enroll.barProgress ?? enroll.progress) / enroll.total * 100))
                          return (
                            <div key={enroll.enrollmentId}
                              className="rounded-xl border border-stone-100 dark:border-stone-800 overflow-hidden">
                              <div className="flex items-center justify-between px-3 py-2 bg-stone-50 dark:bg-stone-800/50">
                                <div>
                                  <p className="text-[12px] font-bold text-stone-700 dark:text-stone-200">{enroll.classLabel}</p>
                                  <p className="text-[10px] text-stone-400">{enroll.tutorName}</p>
                                </div>
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-900">
                                  Aktif
                                </span>
                              </div>

                              <div className="px-3 py-2.5">
                                {/* Progress bar */}
                                <div className="flex items-center justify-between mb-1.5">
                                  <p className="text-[10px] text-stone-400 dark:text-stone-500">Progress sesi</p>
                                  <p className="text-[11px] font-extrabold text-stone-700 dark:text-stone-200">
                                    {enroll.progress}/{enroll.total}
                                  </p>
                                </div>
                                <div className="h-2 bg-stone-100 dark:bg-stone-800 rounded-full overflow-visible mb-2.5 relative">
                                  <div className="h-full rounded-full relative transition-all duration-700"
                                    style={{ width: `${barPct}%`, background: childCol.top }}>
                                    <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 bg-white dark:bg-stone-900"
                                      style={{ borderColor: childCol.top, boxShadow: `0 0 0 3px ${childCol.top}33` }} />
                                  </div>
                                </div>

                                {/* Info 3 kolom */}
                                <div className="grid grid-cols-3 gap-1.5 mb-2">
                                  <div className="rounded-lg py-1.5 px-2 text-center bg-green-50 dark:bg-green-950/30">
                                    <p className="text-[12px] font-extrabold text-green-700 dark:text-green-400">{child.hadirPct}%</p>
                                    <p className="text-[8px] text-green-600 dark:text-green-500 font-semibold">Kehadiran</p>
                                  </div>
                                  <div className="rounded-lg py-1.5 px-2 text-center bg-indigo-50 dark:bg-indigo-950/30">
                                    <p className="text-[11px] font-extrabold text-indigo-700 dark:text-indigo-400 leading-tight">
                                      {enroll.nextSession ? fmtDateShort(enroll.nextSession).split(',')[0] : '—'}
                                    </p>
                                    <p className="text-[8px] text-indigo-500 font-semibold">Berikutnya</p>
                                  </div>
                                  <div className="rounded-lg py-1.5 px-2 text-center"
                                    style={{ background: sisa <= 1 ? '#FCEBEB' : '#FFF9E6' }}>
                                    <p className="text-[12px] font-extrabold"
                                      style={{ color: sisa <= 1 ? '#A32D2D' : '#854F0B' }}>{sisa}</p>
                                    <p className="text-[8px] font-semibold"
                                      style={{ color: sisa <= 1 ? '#A32D2D' : '#854F0B' }}>Sisa sesi</p>
                                  </div>
                                </div>

                                {/* Jadwal berikutnya */}
                                {enroll.nextSession && (
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                      <CalendarDays size={10} className="text-stone-400" />
                                      <p className="text-[10px] text-stone-500 dark:text-stone-400">
                                        {fmtDate(enroll.nextSession)}, {fmtTime(enroll.nextSession)}
                                      </p>
                                    </div>
                                    {enroll.zoomLink && (
                                      <a href={enroll.zoomLink} target="_blank" rel="noopener noreferrer"
                                        className="text-[10px] text-blue-500 flex items-center gap-0.5 hover:underline">
                                        Zoom <ExternalLink size={9} />
                                      </a>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Banner sisa sesi */}
                              {sisa <= 2 && (() => {
                                const waMsg = encodeURIComponent(
                                  `Halo, saya ingin memperpanjang paket belajar untuk ${child.full_name} (${enroll.classLabel}). Sisa sesi tinggal ${sisa}. Mohon informasi untuk periode berikutnya. Terima kasih.`
                                )
                                const waUrl = adminPhone
                                  ? `https://wa.me/${adminPhone.replace(/\D/g, '')}?text=${waMsg}`
                                  : null
                                return (
                                  <div className="mx-3 mb-3 rounded-xl flex items-center gap-3 px-3 py-2.5"
                                    style={{
                                      background: sisa === 0 ? '#FCEBEB' : '#FFF9E6',
                                      border: `0.5px solid ${sisa === 0 ? '#F7C1C1' : '#FAC775'}`,
                                    }}>
                                    <div className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-sm"
                                      style={{ background: sisa === 0 ? '#F7C1C1' : '#FAC775' }}>⚠️</div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-[11px] font-bold truncate"
                                        style={{ color: sisa === 0 ? '#791F1F' : '#633806' }}>
                                        {sisa === 0 ? `${enroll.classLabel} · Sesi habis!` : `${enroll.classLabel} · Sisa ${sisa} sesi`}
                                      </p>
                                      <p className="text-[10px]" style={{ color: sisa === 0 ? '#A32D2D' : '#854F0B' }}>
                                        {sisa === 0 ? 'Perpanjang untuk lanjut belajar' : 'Segera perpanjang paket'}
                                      </p>
                                    </div>
                                    {waUrl ? (
                                      <a href={waUrl} target="_blank" rel="noopener noreferrer"
                                        className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-white active:scale-95 transition-transform"
                                        style={{ background: '#25D366' }}>
                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="white">
                                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                                          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.553 4.122 1.524 5.854L0 24l6.337-1.501A11.955 11.955 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.007-1.373l-.36-.213-3.761.891.946-3.657-.234-.376A9.818 9.818 0 012.182 12C2.182 6.58 6.58 2.182 12 2.182S21.818 6.58 21.818 12 17.42 21.818 12 21.818z"/>
                                        </svg>
                                        Perpanjang
                                      </a>
                                    ) : (
                                      <span className="flex-shrink-0 px-2.5 py-1.5 rounded-lg text-[10px] font-bold"
                                        style={{ background: '#FAC775', color: '#633806' }}>
                                        Hubungi Admin
                                      </span>
                                    )}
                                  </div>
                                )
                              })()}
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── AKTIVITAS TERBARU ── */}
        {activityFeed.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[12px] font-bold" style={{ color: "var(--ortu-text)" }}">Aktivitas Terbaru</p>
              <Link href="/ortu/laporan"
                className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-0.5 hover:underline">
                Lihat semua <ChevronRight size={11} />
              </Link>
            </div>

            {/* Stacked cards */}
            <div className="relative" style={{ paddingBottom: Math.min(activityFeed.length - 1, 2) * 10 + 'px' }}>
              {activityFeed.slice(0, 3).map((item, idx) => {
                const childIdx = childrenData.findIndex(c => c.id === item.studentId)
                const itemCol = CHILD_COLORS[childIdx >= 0 ? childIdx % CHILD_COLORS.length : 0]
                return (
                  <div key={idx}
                    className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-800 p-4 w-full"
                    style={{
                      position: 'absolute',
                      top: `${idx * 14}px`,
                      zIndex: 10 - idx,
                      transform: `scale(${1 - idx * 0.04})`,
                      opacity: 1 - idx * 0.2,
                      transformOrigin: 'bottom center',
                    }}>
                    <div className="flex gap-3">
                      <div className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center text-base"
                        style={{ background: itemCol.bg }}>
                        📝
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                          <p className="text-[11px] font-bold text-stone-700 dark:text-stone-200">
                            Laporan {item.classLabel}
                          </p>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
                            style={{ background: itemCol.bg, color: itemCol.text }}>
                            {item.studentName}
                          </span>
                        </div>
                        {item.saranOrtu && (
                          <p className="text-[10px] text-stone-500 dark:text-stone-400 line-clamp-2">
                            {item.saranOrtu}
                          </p>
                        )}
                        {!item.saranOrtu && item.materi && (
                          <p className="text-[10px] text-stone-400">Materi: {item.materi}</p>
                        )}
                      </div>
                      <p className="text-[10px] text-stone-300 dark:text-stone-600 flex-shrink-0">
                        {timeAgo(item.createdAt)}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {activityFeed.length === 0 && (
          <div className="flex flex-col items-center py-10 text-center">
            <FileText size={28} className="text-stone-200 dark:text-stone-700 mb-2" />
            <p className="text-[12px] text-stone-400">Belum ada aktivitas terbaru</p>
          </div>
        )}

        {/* ── KELAS ARSIP — perlu perhatian khusus ── */}
        {archivedData.length > 0 && (
          <div>
            {/* Label section */}
            <div className="flex items-center gap-2 mb-2">
              <div className="flex items-center justify-center w-5 h-5 rounded-md flex-shrink-0"
                style={{ background: 'rgba(239,68,68,0.12)' }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <p className="text-[12px] font-bold" style={{ color: '#ef4444' }}>
                Paket kelas perlu diperpanjang
              </p>
            </div>

            <div className="relative rounded-2xl overflow-hidden"
              style={{ background: 'linear-gradient(135deg, #1A0A00 0%, #2D1200 100%)' }}>
              {/* Dekorasi pulse attention */}
              <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full pointer-events-none animate-pulse"
                style={{ background: 'rgba(230,184,0,0.12)', filter: 'blur(20px)' }} />
              <div className="absolute -bottom-4 -left-4 w-20 h-20 rounded-full pointer-events-none"
                style={{ background: 'rgba(239,68,68,0.1)', filter: 'blur(16px)' }} />

              {/* Border atas merah */}
              <div className="absolute top-0 left-0 right-0 h-0.5"
                style={{ background: 'linear-gradient(90deg, #ef4444, #E6B800, #ef4444)' }} />

              <div className="relative z-10 p-4">
                {/* Header */}
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center"
                    style={{ background: 'rgba(230,184,0,0.15)', border: '1px solid rgba(230,184,0,0.2)' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E6B800" strokeWidth="1.8" strokeLinecap="round">
                      <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                      <polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-[13px] font-extrabold text-white leading-tight">
                      Lanjutkan perjalanan belajar!
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      Kelas berikut sudah selesai dan siap diperpanjang
                    </p>
                  </div>
                </div>

                {/* List kelas arsip */}
                <div className="space-y-2 mb-4">
                  {archivedData.flatMap(s =>
                    s.archived.map((kelas: any, ki: number) => (
                      <div key={`arsip-${s.studentId}-${ki}`}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        {/* Icon kelas selesai */}
                        <div className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center"
                          style={{ background: 'rgba(230,184,0,0.1)', border: '1px solid rgba(230,184,0,0.15)' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E6B800" strokeWidth="2" strokeLinecap="round">
                            <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/>
                            <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-bold text-white truncate">{kelas.classLabel}</p>
                          <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.45)' }}>
                            {s.studentName} · {kelas.tutorName} · {kelas.total} sesi
                          </p>
                        </div>
                        {/* Badge selesai */}
                        <div className="flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg"
                          style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                          <span style={{ fontSize: 9, fontWeight: 700, color: '#22c55e' }}>Selesai</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* CTA perpanjang — urgent */}
                {adminPhone && (
                  <a href={`https://wa.me/${adminPhone.replace(/\D/g,'')}?text=${encodeURIComponent(
                    `Halo Admin EduKazia, saya ingin mendaftarkan kembali paket belajar untuk periode berikutnya. Mohon informasi paket yang tersedia. Terima kasih 🙏`
                  )}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-extrabold text-[13px] active:scale-95 transition-transform"
                    style={{
                      background: 'linear-gradient(135deg, #E6B800 0%, #f5c93e 100%)',
                      color: '#1A0A00',
                      boxShadow: '0 4px 20px rgba(230,184,0,0.3)',
                    }}>
                    {/* WA icon */}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#1A0A00">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.553 4.122 1.524 5.854L0 24l6.337-1.501A11.955 11.955 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.007-1.373l-.36-.213-3.761.891.946-3.657-.234-.376A9.818 9.818 0 012.182 12C2.182 6.58 6.58 2.182 12 2.182S21.818 6.58 21.818 12 17.42 21.818 12 21.818z"/>
                    </svg>
                    Perpanjang Paket Sekarang
                    {/* Arrow */}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1A0A00" strokeWidth="2.5" strokeLinecap="round">
                      <line x1="5" y1="12" x2="19" y2="12"/>
                      <polyline points="12 5 19 12 12 19"/>
                    </svg>
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

      </div>

      <div className="h-16" />
      </div> {/* end content wrapper */}
    </div>
  )
}
