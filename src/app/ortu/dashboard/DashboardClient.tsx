'use client'

import Link from 'next/link'
import { CalendarDays, FileText, ChevronRight, ExternalLink } from 'lucide-react'
import { useState, useEffect } from 'react'
import AnnouncementFetcher from '@/components/AnnouncementFetcher'

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

export default function OrtuDashboardClient({ profile, childrenData, activityFeed, adminPhone, stats }: Props) {
  const firstName = profile.full_name.split(' ')[0]
  const jam = new Date().toLocaleString('id-ID', { hour: '2-digit', timeZone: 'Asia/Jayapura', hour12: false })
  const greeting = parseInt(jam) < 12 ? 'Selamat pagi' : parseInt(jam) < 17 ? 'Selamat siang' : 'Selamat malam'

  return (
    <div className="px-4 lg:px-6 py-5 max-w-3xl">

      {/* Pengumuman */}
      <AnnouncementFetcher />

      {/* ── Hero ── */}
      <div className="rounded-2xl p-5 mb-5 relative overflow-hidden"
        style={{ background: '#E6B800' }}>

        {/* Profil ortu di dalam hero */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.3)', color: '#412402' }}>
            {initials(profile.full_name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold text-amber-900 leading-tight truncate">
              {profile.full_name}
            </p>
            <p className="text-[10px] text-amber-700 truncate mt-0.5">{profile.email}</p>
          </div>
          <div className="flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-semibold"
            style={{ background: 'rgba(255,255,255,0.25)', color: '#412402' }}>
            Orang Tua
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.25)', paddingTop: '14px' }}>
          <p className="text-[11px] text-amber-700 font-medium mb-1">
            {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jayapura' })}
          </p>
          <p className="text-[16px] font-bold text-amber-900 mb-0.5">
            {greeting}, {firstName}!
          </p>
          <p className="text-[12px] text-amber-700">
            {stats.totalAnak} anak aktif belajar
          </p>
        </div>

        {/* Stat boxes */}
        <div className="grid grid-cols-4 gap-2 mt-4">
          {[
            { num: stats.totalSesiMingguIni, lbl: 'Sesi minggu ini' },
            { num: `${stats.avgKehadiran}%`, lbl: 'Kehadiran' },
            { num: activityFeed.length, lbl: 'Laporan baru' },
            { num: stats.totalTagihanBelumBayar, lbl: 'Tagihan', danger: stats.totalTagihanBelumBayar > 0 },
          ].map((s, i) => (
            <div key={i} className="rounded-xl bg-[#FAEEDA] px-2 py-2 text-center">
              <p className={`text-[15px] font-bold ${s.danger ? 'text-red-700' : 'text-amber-900'}`}>{s.num}</p>
              <p className="text-[9px] text-amber-700 mt-0.5">{s.lbl}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Per anak ── */}
      <p className="text-[12px] font-bold text-stone-700 mb-2.5">Ringkasan per anak</p>
      <div className="flex flex-col gap-3 mb-5">
        {childrenData.map((child, idx) => {
          const col = CHILD_COLORS[idx % CHILD_COLORS.length]
          return (
            <div key={child.id} className="bg-white border border-stone-100 rounded-2xl overflow-hidden"
              style={{ borderTop: `3px solid ${col.top}` }}>
              {/* Card header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-stone-50">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                    style={{ background: col.bg, color: col.text }}>
                    {initials(child.full_name)}
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-stone-800">{child.full_name}</p>
                    <p className="text-[10px] text-stone-400">
                      {child.grade ?? '—'}{child.school ? ` · ${child.school}` : ''}
                    </p>
                  </div>
                </div>
                <Link href={`/ortu/anak/${child.slug ?? child.id}`}
                  className="text-[11px] text-stone-400 hover:text-stone-700 flex items-center gap-0.5">
                  Lihat <ChevronRight size={11} />
                </Link>
              </div>

              {/* Enrollments */}
              <div className="px-4 py-3 flex flex-col gap-2">
                {child.enrollments.length === 0 ? (
                  <p className="text-[11px] text-stone-400">Belum ada kelas aktif</p>
                ) : (
                  child.enrollments.map((enroll: any) => (
                    <div key={enroll.enrollmentId} className="rounded-xl overflow-hidden border border-stone-100">
                      <div className="flex items-center justify-between px-3 py-2 border-b border-stone-50">
                        <div>
                          <p className="text-[12px] font-semibold text-stone-700">{enroll.classLabel}</p>
                          <p className="text-[10px] text-stone-400">{enroll.tutorName}</p>
                        </div>
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
                          Aktif
                        </span>
                      </div>

                      <div className="px-3 py-2">
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-[10px] text-stone-400">Progress sesi</p>
                          <p className="text-[10px] font-semibold text-stone-600">
                            {enroll.progress}/{enroll.total}
                          </p>
                        </div>
                        <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden mb-2">
                          <div className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.min(100, Math.round(enroll.progress / enroll.total * 100))}%`,
                              background: col.top,
                            }} />
                        </div>
                        {enroll.nextSession && (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <CalendarDays size={11} className="text-stone-400" />
                              <p className="text-[10px] text-stone-500">
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
                    </div>
                  ))
                )}

                {/* Kehadiran bulan ini */}
                {child.totalAtt > 0 && (
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-[10px] text-stone-400">Kehadiran bulan ini</p>
                    <p className={`text-[10px] font-semibold ${child.hadirPct >= 80 ? 'text-green-600' : child.hadirPct >= 60 ? 'text-amber-600' : 'text-red-500'}`}>
                      {child.hadirPct}% ({child.hadirCount}/{child.totalAtt})
                    </p>
                  </div>
                )}
              </div>

              {/* ── Banner kelas akan dimulai (< 1 jam) ── */}
              {child.enrollments.map((enroll: any) => {
                if (!enroll.nextSession) return null
                const now = new Date()
                const sessionTime = new Date(enroll.nextSession)
                const diffMs = sessionTime.getTime() - now.getTime()
                const diffMenit = Math.round(diffMs / 60000)
                if (diffMenit < 0 || diffMenit > 60) return null

                return (
                  <div key={`mulai-${enroll.enrollmentId}`}
                    className="mx-3 mb-2 rounded-xl flex items-center gap-3 px-3 py-2.5"
                    style={{ background: '#EEEDFE', border: '0.5px solid #CECBF6' }}>
                    {/* Animasi pulse */}
                    <div className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center relative"
                      style={{ background: '#5C4FE5' }}>
                      <span className="absolute inset-0 rounded-lg animate-ping opacity-30"
                        style={{ background: '#5C4FE5' }} />
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                        <circle cx="8" cy="8" r="6.5" stroke="white" strokeWidth="1.2"/>
                        <path d="M8 4.5v3.5l2.5 1.5" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-[#3C3489] truncate">
                        {enroll.classLabel} · {diffMenit === 0 ? 'Sekarang!' : `${diffMenit} menit lagi`}
                      </p>
                      <p className="text-[10px] text-[#5C4FE5]">
                        Kelas segera dimulai
                      </p>
                    </div>
                    {enroll.zoomLink && (
                      <a href={enroll.zoomLink} target="_blank" rel="noopener noreferrer"
                        className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold"
                        style={{ background: '#5C4FE5', color: '#fff' }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="white">
                          <path d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/>
                        </svg>
                        Buka Zoom
                      </a>
                    )}
                  </div>
                )
              })}

              {/* ── Banner sisa sesi ── */}
              {child.enrollments.map((enroll: any) => {
                const sisa = enroll.total - enroll.progress
                if (sisa > 2) return null  // Hanya tampil kalau sisa ≤ 2

                const waMsg = encodeURIComponent(
                  `Halo, saya ingin memperpanjang paket belajar untuk ${child.full_name} (${enroll.classLabel}). Sisa sesi tinggal ${sisa}. Mohon informasi untuk periode berikutnya. Terima kasih.`
                )
                const waUrl = adminPhone
                  ? `https://wa.me/${adminPhone.replace(/\D/g, '')}?text=${waMsg}`
                  : null

                return (
                  <div key={`banner-${enroll.enrollmentId}`}
                    className="mx-3 mb-3 rounded-xl flex items-center gap-3 px-3 py-2.5"
                    style={{
                      background: sisa === 0 ? '#FCEBEB' : '#FAEEDA',
                      border: `0.5px solid ${sisa === 0 ? '#F7C1C1' : '#FAC775'}`,
                    }}>
                    {/* Icon */}
                    <div className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background: sisa === 0 ? '#F7C1C1' : '#FAC775' }}>
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                        <circle cx="8" cy="8" r="7" stroke={sisa === 0 ? '#791F1F' : '#633806'} strokeWidth="1.3"/>
                        <line x1="8" y1="4" x2="8" y2="8.5" stroke={sisa === 0 ? '#791F1F' : '#633806'} strokeWidth="1.5" strokeLinecap="round"/>
                        <circle cx="8" cy="11" r="0.8" fill={sisa === 0 ? '#791F1F' : '#633806'}/>
                      </svg>
                    </div>

                    {/* Teks */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold truncate"
                        style={{ color: sisa === 0 ? '#791F1F' : '#633806' }}>
                        {sisa === 0
                          ? `${enroll.classLabel} · Sesi habis!`
                          : `${enroll.classLabel} · Sisa ${sisa} sesi`
                        }
                      </p>
                      <p className="text-[10px]"
                        style={{ color: sisa === 0 ? '#A32D2D' : '#854F0B' }}>
                        {sisa === 0 ? 'Perpanjang untuk lanjut belajar' : 'Segera perpanjang paket'}
                      </p>
                    </div>

                    {/* Tombol WA */}
                    {waUrl ? (
                      <a href={waUrl} target="_blank" rel="noopener noreferrer"
                        className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold"
                        style={{
                          background: '#25D366',
                          color: '#fff',
                        }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="white">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.553 4.122 1.524 5.854L0 24l6.337-1.501A11.955 11.955 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.007-1.373l-.36-.213-3.761.891.946-3.657-.234-.376A9.818 9.818 0 012.182 12C2.182 6.58 6.58 2.182 12 2.182S21.818 6.58 21.818 12 17.42 21.818 12 21.818z"/>
                        </svg>
                        Perpanjang
                      </a>
                    ) : (
                      <span className="flex-shrink-0 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold"
                        style={{ background: '#FAC775', color: '#633806' }}>
                        Hubungi Admin
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* ── Activity Feed ── */}
      {activityFeed.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-[12px] font-bold text-stone-700">Aktivitas terbaru</p>
            <Link href="/ortu/laporan" className="text-[11px] text-amber-600 hover:underline flex items-center gap-0.5">
              Lihat semua <ChevronRight size={11} />
            </Link>
          </div>
          <div className="flex flex-col gap-2 pb-6">
            {activityFeed.slice(0, 5).map((item, idx) => {
              const col = CHILD_COLORS[childrenData.findIndex(c => c.id === item.studentId) % CHILD_COLORS.length]
              return (
                <div key={idx} className="flex gap-2.5 p-3 rounded-xl bg-white border border-stone-100">
                  <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                    style={{ background: col.top }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <p className="text-[11px] font-semibold text-stone-700">
                        Laporan {item.classLabel}
                      </p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                        style={{ background: col.bg, color: col.text }}>
                        {item.studentName}
                      </span>
                    </div>
                    {item.saranOrtu && (
                      <p className="text-[10px] text-stone-500 line-clamp-2">{item.saranOrtu}</p>
                    )}
                    {!item.saranOrtu && item.materi && (
                      <p className="text-[10px] text-stone-400">Materi: {item.materi}</p>
                    )}
                  </div>
                  <p className="text-[10px] text-stone-300 flex-shrink-0 mt-0.5">
                    {timeAgo(item.createdAt)}
                  </p>
                </div>
              )
            })}
          </div>
        </>
      )}

      {activityFeed.length === 0 && (
        <div className="flex flex-col items-center py-10 text-center pb-8">
          <FileText size={28} className="text-stone-200 mb-2" />
          <p className="text-[12px] text-stone-400">Belum ada aktivitas terbaru</p>
        </div>
      )}
    </div>
  )
}
