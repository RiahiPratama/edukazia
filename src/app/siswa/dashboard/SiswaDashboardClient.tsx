'use client'

import Link from 'next/link'
import { CalendarDays, BookOpen, ChevronRight, ExternalLink } from 'lucide-react'
import AnnouncementFetcher from '@/components/AnnouncementFetcher'
import TodaySessionCard from '@/components/session/TodaySessionCard'

interface Props {
  student: {
    id: string
    full_name: string
    grade?: string
    school?: string
  }
  enrollments: any[]
  todaySessions: any[]
  upcomingSessions: any[]
  recentReports: any[]
}

const COLORS = { top: '#5C4FE5', bg: '#EEEDFE', text: '#3C3489', badge: '#CECBF6' }

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

export default function SiswaDashboardClient({ student, enrollments, todaySessions, upcomingSessions, recentReports }: Props) {
  const firstName = student.full_name.split(' ')[0]
  const jam = new Date().toLocaleString('id-ID', { hour: '2-digit', timeZone: 'Asia/Jayapura', hour12: false })
  const greeting = parseInt(jam) < 12 ? 'Selamat pagi' : parseInt(jam) < 17 ? 'Selamat siang' : 'Selamat malam'

  return (
    <div className="px-4 lg:px-6 py-5 max-w-3xl">
      {/* Pengumuman */}
      <AnnouncementFetcher />

      {/* Hero */}
      <div className="rounded-2xl p-5 mb-5 relative overflow-hidden" style={{ background: COLORS.top }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.3)', color: '#1A1640' }}>
            {initials(student.full_name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold text-white leading-tight truncate">
              {student.full_name}
            </p>
            <p className="text-[10px] text-purple-200 truncate mt-0.5">
              {student.grade ?? '—'}{student.school ? ` · ${student.school}` : ''}
            </p>
          </div>
          <div className="flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-semibold"
            style={{ background: 'rgba(255,255,255,0.25)', color: '#1A1640' }}>
            Siswa
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.25)', paddingTop: '14px' }}>
          <p className="text-[11px] text-purple-200 font-medium mb-1">
            {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jayapura' })}
          </p>
          <p className="text-[16px] font-bold text-white mb-0.5">
            {greeting}, {firstName}!
          </p>
          <p className="text-[12px] text-purple-200">
            {enrollments.length} kelas aktif
          </p>
        </div>
      </div>

      {/* Jadwal Hari Ini - WITH COUNTDOWN */}
      {todaySessions.length > 0 && (
        <>
          <p className="text-[12px] font-bold text-stone-700 mb-2.5">Jadwal Hari Ini</p>
          <div className="bg-white border border-stone-100 rounded-2xl overflow-hidden mb-5">
            <div className="divide-y divide-stone-50">
              {todaySessions.map((session: any) => (
                <div key={session.id} className="p-3">
                  <TodaySessionCard
                    session={session}
                    studentId={student.id}
                    compact
                    showCountdown
                  />
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Kelas Aktif */}
      <p className="text-[12px] font-bold text-stone-700 mb-2.5">Kelas Aktif</p>
      <div className="flex flex-col gap-3 mb-5">
        {enrollments.length === 0 ? (
          <div className="bg-white border border-stone-100 rounded-2xl p-6 text-center">
            <BookOpen size={28} className="text-stone-200 mx-auto mb-2" />
            <p className="text-[12px] text-stone-400">Belum ada kelas aktif</p>
          </div>
        ) : (
          enrollments.map((enroll: any) => (
            <div key={enroll.enrollmentId} className="bg-white border border-stone-100 rounded-2xl overflow-hidden"
              style={{ borderTop: `3px solid ${COLORS.top}` }}>
              <div className="px-4 py-3 border-b border-stone-50">
                <p className="text-[13px] font-bold text-stone-800">{enroll.classLabel}</p>
                <p className="text-[10px] text-stone-400">{enroll.tutorName}</p>
              </div>

              <div className="px-4 py-3">
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
                      background: COLORS.top,
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
      </div>

      {/* Sesi Berikutnya */}
      {upcomingSessions.length > 0 && (
        <>
          <p className="text-[12px] font-bold text-stone-700 mb-2.5">Sesi Berikutnya</p>
          <div className="flex flex-col gap-2 mb-5">
            {upcomingSessions.slice(0, 3).map((session: any) => (
              <div key={session.id} className="bg-white border border-stone-100 rounded-xl p-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 flex-shrink-0 text-center">
                    <div className="text-sm font-black" style={{ color: COLORS.top }}>
                      {fmtTime(session.scheduled_at)}
                    </div>
                    <div className="text-[9px] text-stone-400 font-semibold">WIT</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-stone-700 truncate">
                      {session.class_groups?.label ?? '—'}
                    </p>
                    <p className="text-[10px] text-stone-400">
                      {fmtDate(session.scheduled_at)}
                    </p>
                  </div>
                  {session.zoom_link && (
                    <a href={session.zoom_link} target="_blank" rel="noopener noreferrer"
                      className="text-[10px] px-2 py-1 bg-blue-50 text-blue-700 rounded-lg font-semibold hover:bg-blue-100 transition">
                      Zoom
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Laporan Terbaru */}
      {recentReports.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-[12px] font-bold text-stone-700">Laporan Terbaru</p>
            <Link href="/siswa/laporan" className="text-[11px] text-purple-600 hover:underline flex items-center gap-0.5">
              Lihat semua <ChevronRight size={11} />
            </Link>
          </div>
          <div className="flex flex-col gap-2 pb-6">
            {recentReports.slice(0, 3).map((report: any, idx: number) => (
              <div key={idx} className="bg-white border border-stone-100 rounded-xl p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[11px] font-semibold text-stone-700">
                    {report.classLabel}
                  </p>
                  <p className="text-[9px] text-stone-400">
                    {fmtDate(report.sessionDate)}
                  </p>
                </div>
                {report.materi && (
                  <p className="text-[10px] text-stone-500 line-clamp-2">{report.materi}</p>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
