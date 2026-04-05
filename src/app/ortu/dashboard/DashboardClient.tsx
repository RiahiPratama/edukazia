'use client'

import Link from 'next/link'
import { CalendarDays, ExternalLink, ChevronRight, FileText, Plus } from 'lucide-react'
import { useState, useEffect } from 'react'
import AnnouncementFetcher from '@/components/AnnouncementFetcher'
import TodaySessionCard from '@/components/session/TodaySessionCard'

interface Props {
  profile: { full_name: string; email: string }
  childrenData: any[]
  activityFeed: any[]
  adminPhone: string | null
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

export default function OrtuDashboardClient({ profile, childrenData, activityFeed, adminPhone, stats }: Props) {
  const [activeIdx, setActiveIdx] = useState(0)

  const firstName = profile.full_name.split(' ')[0]
  const jam = parseInt(new Date().toLocaleString('id-ID', { hour: '2-digit', timeZone: 'Asia/Jayapura', hour12: false }))
  const greeting = jam < 12 ? 'Selamat pagi' : jam < 17 ? 'Selamat siang' : 'Selamat malam'
  const today = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'Asia/Jayapura',
  })

  const activeChild = childrenData[activeIdx]
  const col = CHILD_COLORS[activeIdx % CHILD_COLORS.length]

  // Sesi hari ini dari anak aktif
  const todaySessions = (activeChild?.summary?.todaySessions ?? []).map((s: any) => ({
    ...s,
    childName: activeChild.full_name,
    childId: activeChild.id,
    childColor: col,
  }))

  // Sesi dalam 3 jam dari anak aktif
  const upcomingSoon = (activeChild?.enrollments ?? []).filter((e: any) => {
    if (!e.nextSession) return false
    const diff = new Date(e.nextSession).getTime() - Date.now()
    const mins = Math.round(diff / 60000)
    return mins >= 0 && mins <= 180
  }).map((e: any) => ({
    ...e,
    diffMinutes: Math.round((new Date(e.nextSession).getTime() - Date.now()) / 60000),
  }))

  // Jadwal terdekat untuk stats
  const nextSched = (activeChild?.enrollments ?? [])
    .filter((e: any) => e.nextSession)
    .sort((a: any, b: any) => new Date(a.nextSession).getTime() - new Date(b.nextSession).getTime())[0]

  return (
    <div className="min-h-screen pb-16">

      {/* Pengumuman */}
      <AnnouncementFetcher />

      {/* ── HERO ── */}
      <div className="relative overflow-hidden rounded-2xl mx-4 mt-4 mb-5 p-5"
        style={{ background: 'linear-gradient(135deg, #E6B800 0%, #f5c93e 100%)' }}>
        <div className="absolute -top-10 -right-10 w-44 h-44 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-6 -left-6 w-28 h-28 bg-white/10 rounded-full blur-xl pointer-events-none" />

        <div className="relative z-10">
          {/* Profil ortu */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center text-[13px] font-extrabold flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.28)', color: '#412402' }}>
              {initials(profile.full_name)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-extrabold text-amber-950 truncate">{profile.full_name}</p>
              <p className="text-[10px] text-amber-700 truncate">{profile.email}</p>
            </div>
            <span className="flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-semibold"
              style={{ background: 'rgba(255,255,255,0.25)', color: '#412402' }}>
              Orang Tua
            </span>
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.3)', paddingTop: 14 }}>
            <p className="text-[11px] text-amber-700 font-medium mb-1">{today}</p>
            <p className="text-[17px] font-extrabold text-amber-950 mb-0.5">{greeting}, {firstName}! 👋</p>
            <p className="text-[12px] text-amber-700">{stats.totalAnak} anak aktif belajar</p>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-4 gap-2 mt-4">
            {[
              { num: stats.totalSesiMingguIni, lbl: 'Sesi minggu' },
              { num: `${stats.avgKehadiran}%`, lbl: 'Kehadiran', green: stats.avgKehadiran >= 80 },
              { num: activityFeed.length, lbl: 'Laporan baru', pulse: activityFeed.length > 0 },
              { num: nextSched ? fmtDateShort(nextSched.nextSession).split(',')[0] : '—', lbl: 'Jadwal' },
            ].map((s, i) => (
              <div key={i} className="relative rounded-xl px-2 py-2.5 text-center"
                style={{ background: 'rgba(255,255,255,0.3)' }}>
                {s.pulse && <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
                <p className={`text-[15px] font-extrabold ${s.green ? 'text-green-800' : 'text-amber-950'}`}>{s.num}</p>
                <p className="text-[9px] text-amber-700 mt-0.5 leading-tight">{s.lbl}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── STORIES ROW — SWITCHER ANAK ── */}
      {childrenData.length > 0 && (
        <div className="px-4 mb-4">
          {/* Row */}
          <div className="flex items-start gap-4 overflow-x-auto pb-1"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {childrenData.map((child, idx) => {
              const ring = storyRing(child)
              const badge = RING_BADGE[ring]
              const isActive = idx === activeIdx
              const childCol = CHILD_COLORS[idx % CHILD_COLORS.length]
              // Waktu sesi hari ini
              const todayEnroll = child.enrollments.find((e: any) => e.nextSession && isToday(e.nextSession))

              return (
                <button key={child.id}
                  onClick={() => setActiveIdx(idx)}
                  className="flex-shrink-0 flex flex-col items-center gap-1.5 transition-all active:scale-95"
                  style={{ transform: isActive ? 'scale(1.08)' : 'scale(1)' }}>
                  {/* Avatar ring */}
                  <div style={{
                    width: 62, height: 62, borderRadius: '50%',
                    padding: 2.5,
                    border: RING_CSS[ring],
                    boxShadow: isActive ? RING_GLOW[ring] : 'none',
                    transition: 'all 0.25s',
                  }}>
                    <div style={{
                      width: '100%', height: '100%', borderRadius: '50%',
                      background: isActive ? childCol.top : childCol.bg,
                      color: isActive ? 'white' : childCol.text,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 15, fontWeight: 800,
                      border: '2.5px solid white',
                    }}>
                      {initials(child.full_name)}
                    </div>
                  </div>
                  {/* Nama */}
                  <span style={{
                    fontSize: 10, fontWeight: 700,
                    color: isActive ? '#5C4FE5' : '#6B7280',
                    maxWidth: 64, textAlign: 'center', lineHeight: 1.3,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {child.full_name.split(' ')[0]}
                  </span>
                  {/* Badge status */}
                  <span style={{
                    fontSize: 8, fontWeight: 700,
                    padding: '2px 7px', borderRadius: 99,
                    background: badge.bg, color: badge.color,
                    whiteSpace: 'nowrap',
                  }}>
                    {ring === 'yellow' && todayEnroll
                      ? fmtTime(todayEnroll.nextSession)
                      : badge.label}
                  </span>
                </button>
              )
            })}

            {/* Tombol tambah anak */}
            <button className="flex-shrink-0 flex flex-col items-center gap-1.5 opacity-50 hover:opacity-100 transition-opacity">
              <div style={{
                width: 62, height: 62, borderRadius: '50%',
                border: '2px dashed #d1d5db',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Plus size={22} color="#9CA3AF" />
              </div>
              <span style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600 }}>Tambah</span>
            </button>
          </div>

          {/* Label anak aktif */}
          {activeChild && (
            <div className="flex items-center justify-between mt-3 px-3 py-2 rounded-xl"
              style={{ background: 'rgba(92,79,229,0.06)', border: '1px solid rgba(92,79,229,0.1)' }}>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[11px] font-semibold text-stone-600 dark:text-stone-300">
                  Data: <span style={{ color: '#5C4FE5' }}>{activeChild.full_name}</span>
                </span>
              </div>
              <span className="text-[9px] text-stone-400">ketuk untuk ganti ›</span>
            </div>
          )}
        </div>
      )}

      <div className="px-4 space-y-4">

        {/* ── SESI HARI INI ── */}
        {todaySessions.length > 0 && (
          <div>
            <p className="text-[12px] font-bold text-stone-700 dark:text-stone-300 mb-2">Sesi Hari Ini</p>
            <div className="bg-white dark:bg-stone-900 border border-stone-100 dark:border-stone-800 rounded-2xl overflow-hidden divide-y divide-stone-50 dark:divide-stone-800">
              {todaySessions.map((session: any, idx: number) => (
                <div key={`${session.id}-${idx}`} className="p-3">
                  <TodaySessionCard session={session} studentId={session.childId} compact showCountdown />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── ZOOM CARD — KELAS SEGERA DIMULAI ── */}
        {upcomingSoon.map((enroll: any) => {
          const hours = Math.floor(enroll.diffMinutes / 60)
          const mins = enroll.diffMinutes % 60
          const timeText = hours > 0
            ? `${hours} jam ${mins} menit lagi`
            : mins === 0 ? 'Sekarang!' : `${mins} menit lagi`
          const urgent = enroll.diffMinutes <= 15
          const dashOffset = Math.max(20, 163 - (enroll.diffMinutes / 180) * 143)

          return (
            <div key={enroll.enrollmentId}
              className="relative rounded-2xl overflow-hidden p-5"
              style={{ background: '#1A1640' }}>
              <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full blur-3xl pointer-events-none"
                style={{ background: 'rgba(230,184,0,0.15)' }} />
              <div className="absolute -bottom-6 -left-6 w-32 h-32 rounded-full blur-2xl pointer-events-none"
                style={{ background: 'rgba(92,79,229,0.2)' }} />

              <div className="relative z-10">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      {urgent && <span className="w-2 h-2 rounded-full bg-red-500 animate-ping flex-shrink-0" />}
                      <span className="text-[9px] font-extrabold tracking-widest uppercase text-amber-400">
                        🔴 Kelas Segera Dimulai
                      </span>
                    </div>
                    <p className="text-[17px] font-extrabold text-white truncate">{activeChild?.full_name}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      {enroll.classLabel} · {enroll.tutorName}
                    </p>
                  </div>

                  {/* Circular timer */}
                  <div className="relative flex-shrink-0" style={{ width: 64, height: 64 }}>
                    <svg width="64" height="64" viewBox="0 0 64 64" style={{ transform: 'rotate(-90deg)' }}>
                      <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4"/>
                      <circle cx="32" cy="32" r="26" fill="none" stroke="#E6B800" strokeWidth="4"
                        strokeDasharray="163" strokeDashoffset={dashOffset}
                        strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s' }}/>
                    </svg>
                    <div style={{
                      position: 'absolute', inset: 0,
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: 'white', lineHeight: 1 }}>
                        {hours > 0 ? `${hours}j` : `${mins}m`}
                      </span>
                      <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)' }}>lagi</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
                    {fmtDate(enroll.nextSession)}, {fmtTime(enroll.nextSession)} WIT · {timeText}
                  </span>
                </div>

                {enroll.zoomLink ? (
                  <a href={enroll.zoomLink} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-3.5 rounded-full font-extrabold text-[14px] transition-transform active:scale-95"
                    style={{ background: '#E6B800', color: '#1A0A00', boxShadow: '0 0 28px rgba(230,184,0,0.35)' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/>
                    </svg>
                    Buka Zoom Sekarang
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

        {/* ── PROGRES ANAK AKTIF ── */}
        {activeChild && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[12px] font-bold text-stone-700 dark:text-stone-300">Progres Ananda</p>
              <Link href={`/ortu/anak/${activeChild.slug ?? activeChild.id}`}
                className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                Lihat detail <ChevronRight size={11} />
              </Link>
            </div>

            <div className="bg-white dark:bg-stone-900 rounded-2xl overflow-hidden border border-stone-100 dark:border-stone-800">
              {/* Header anak */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-stone-50 dark:border-stone-800">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full p-[2.5px]"
                    style={{ background: `linear-gradient(135deg, ${col.top}, #E6B800)` }}>
                    <div className="w-full h-full rounded-full flex items-center justify-center text-[13px] font-extrabold border-[2.5px] border-white dark:border-stone-900"
                      style={{ background: col.bg, color: col.text }}>
                      {initials(activeChild.full_name)}
                    </div>
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full border-2 border-white dark:border-stone-900 animate-pulse" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-extrabold text-stone-800 dark:text-stone-100 truncate">
                    {activeChild.full_name}
                  </p>
                  <p className="text-[10px] text-stone-400 dark:text-stone-500">
                    {activeChild.grade ?? '—'}{activeChild.school ? ` · ${activeChild.school}` : ''}
                  </p>
                </div>
                {activeChild.hadirPct > 0 && (
                  <div className="text-right flex-shrink-0">
                    <p className={`text-[18px] font-extrabold ${
                      activeChild.hadirPct >= 80 ? 'text-green-600' :
                      activeChild.hadirPct >= 60 ? 'text-amber-600' : 'text-red-500'
                    }`}>
                      {activeChild.hadirPct}%
                    </p>
                    <p className="text-[9px] text-stone-400">Kehadiran</p>
                  </div>
                )}
              </div>

              {/* Enrollments */}
              <div className="px-4 py-3 space-y-3">
                {activeChild.enrollments.length === 0 ? (
                  <p className="text-[11px] text-stone-400 py-2">Belum ada kelas aktif</p>
                ) : (
                  activeChild.enrollments.map((enroll: any) => {
                    const sisa = enroll.total - enroll.progress
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
                          {/* Progress */}
                          <div className="flex items-center justify-between mb-1.5">
                            <p className="text-[10px] text-stone-400 dark:text-stone-500">Progress sesi</p>
                            <p className="text-[11px] font-extrabold text-stone-700 dark:text-stone-200">
                              {enroll.progress}/{enroll.total}
                            </p>
                          </div>
                          <div className="h-2 bg-stone-100 dark:bg-stone-800 rounded-full overflow-visible mb-2.5 relative">
                            <div className="h-full rounded-full relative transition-all duration-700"
                              style={{ width: `${barPct}%`, background: col.top }}>
                              <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 bg-white dark:bg-stone-900"
                                style={{ borderColor: col.top, boxShadow: `0 0 0 3px ${col.top}33` }} />
                            </div>
                          </div>

                          {/* Info 3 kolom */}
                          <div className="grid grid-cols-3 gap-1.5 mb-2">
                            <div className="rounded-lg py-1.5 px-2 text-center bg-green-50 dark:bg-green-950/30">
                              <p className="text-[12px] font-extrabold text-green-700 dark:text-green-400">{activeChild.hadirPct}%</p>
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
                            `Halo, saya ingin memperpanjang paket belajar untuk ${activeChild.full_name} (${enroll.classLabel}). Sisa sesi tinggal ${sisa}. Mohon informasi untuk periode berikutnya. Terima kasih.`
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
                                style={{ background: sisa === 0 ? '#F7C1C1' : '#FAC775' }}>
                                ⚠️
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-bold truncate"
                                  style={{ color: sisa === 0 ? '#791F1F' : '#633806' }}>
                                  {sisa === 0
                                    ? `${enroll.classLabel} · Sesi habis!`
                                    : `${enroll.classLabel} · Sisa ${sisa} sesi`}
                                </p>
                                <p className="text-[10px]"
                                  style={{ color: sisa === 0 ? '#A32D2D' : '#854F0B' }}>
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
          </div>
        )}

        {/* ── AKTIVITAS TERBARU ── */}
        {activityFeed.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[12px] font-bold text-stone-700 dark:text-stone-300">Aktivitas Terbaru</p>
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

      </div>

      <div className="h-16" />
    </div>
  )
}
