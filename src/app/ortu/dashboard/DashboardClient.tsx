'use client'

import Link from 'next/link'
import { CalendarDays, FileText, ChevronRight, ExternalLink } from 'lucide-react'

interface Props {
  profile: { full_name: string; email: string }
  childrenData: any[]
  activityFeed: any[]
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

export default function OrtuDashboardClient({ profile, childrenData, activityFeed, stats }: Props) {
  const firstName = profile.full_name.split(' ')[0]
  const jam = new Date().toLocaleString('id-ID', { hour: '2-digit', timeZone: 'Asia/Jayapura', hour12: false })
  const greeting = parseInt(jam) < 12 ? 'Selamat pagi' : parseInt(jam) < 17 ? 'Selamat siang' : 'Selamat malam'

  return (
    <div className="px-4 lg:px-6 py-5 max-w-3xl">

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
                <Link href={`/ortu/anak/${child.id}`}
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
