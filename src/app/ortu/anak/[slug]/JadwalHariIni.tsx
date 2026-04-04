'use client'

import Link from 'next/link'
import TodaySessionCard from '@/components/session/TodaySessionCard'

interface Props {
  todaySessions: any[]
  nextSession: any | null
  studentId: string
  classGroups: any[]
  tutors: any[]
  tutorRows: any[]
}

function fmtDateFull(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Jayapura',
  })
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('id-ID', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jayapura',
  })
}

export default function OrtuAnakJadwalHariIni({
  todaySessions,
  nextSession,
  studentId,
  classGroups,
  tutors,
  tutorRows,
}: Props) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#5C4FE5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <p className="text-[12px] font-bold text-stone-700">Jadwal Hari Ini</p>
        </div>
        <Link href={`/ortu/anak/${studentId}/jadwal`}
          className="text-[11px] text-[#5C4FE5] hover:underline">
          Lihat semua →
        </Link>
      </div>

      {todaySessions.length > 0 ? (
        <div className="flex flex-col gap-2">
          {todaySessions.map((s: any) => {
            const cg = classGroups.find((c: any) => c.id === s.class_group_id)
            const tutor = tutors.find((t: any) => {
              const tRow = tutorRows.find((tr: any) => tr.id === cg?.tutor_id)
              return t.id === tRow?.profile_id
            })

            // Build session object for TodaySessionCard
            const session = {
              id: s.id,
              scheduled_at: s.scheduled_at,
              status: s.status,
              zoom_link: s.zoom_link ?? cg?.zoom_link ?? null,
              class_groups: {
                label: cg?.label ?? '—',
                zoom_link: cg?.zoom_link,
                courses: { name: '', color: null }, // Not available in this data
                tutors: { profiles: { full_name: tutor?.full_name ?? '—' } },
              },
            }

            return (
              <div key={s.id} className="bg-white border border-stone-100 rounded-xl overflow-hidden p-3">
                <TodaySessionCard
                  session={session}
                  studentId={studentId}
                  compact
                  showCountdown
                />
              </div>
            )
          })}
        </div>
      ) : (
        /* Tidak ada jadwal hari ini → tampilkan sesi berikutnya */
        <div className="bg-white border border-stone-100 rounded-xl overflow-hidden">
          <div className="flex items-center gap-4 px-4 py-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: '#EEEDFE' }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="1" y="2" width="16" height="15" rx="2" stroke="#5C4FE5" strokeWidth="1.4"/>
                <path d="M5 1v2M13 1v2M1 6h16" stroke="#5C4FE5" strokeWidth="1.4" strokeLinecap="round"/>
                <path d="M9 9v3l2 1" stroke="#5C4FE5" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-stone-600">Tidak ada jadwal hari ini</p>
              {nextSession ? (
                <>
                  <p className="text-[10px] text-stone-400 mt-0.5">Sesi berikutnya:</p>
                  <p className="text-[11px] font-semibold text-[#5C4FE5] mt-0.5">
                    {fmtDateFull(nextSession.scheduled_at)}, {fmtTime(nextSession.scheduled_at)} WIT
                  </p>
                  {(() => {
                    const cg = classGroups.find((c: any) => c.id === nextSession.class_group_id)
                    return cg ? (
                      <p className="text-[10px] text-stone-400">{cg.label}</p>
                    ) : null
                  })()}
                </>
              ) : (
                <p className="text-[10px] text-stone-400 mt-0.5">Belum ada jadwal tersedia</p>
              )}
            </div>
            <Link href={`/ortu/anak/${studentId}/jadwal`}
              className="flex-shrink-0 px-3 py-2 rounded-xl text-[11px] font-semibold transition-colors"
              style={{ background: '#EEEDFE', color: '#3C3489' }}>
              Lihat jadwal
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
