import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jayapura',
  })
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('id-ID', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jayapura',
  })
}
function fmtDateFull(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Jayapura',
  })
}

export default async function OrtuAnakPage({ params }: { params: Promise<{ studentId: string }> }) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cs) { try { cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {} },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { studentId } = await params

  const { data: student } = await supabase
    .from('students')
    .select(`id, grade, school, relation_role,
      profiles!students_profile_id_fkey(full_name)`)
    .eq('id', studentId)
    .eq('parent_profile_id', session.user.id)
    .single()

  if (!student) redirect('/ortu/dashboard')

  const studentName = (Array.isArray(student.profiles) ? student.profiles[0] : student.profiles)?.full_name ?? '(Tanpa nama)'

  // Enrollments
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select(`id, status, end_date, expired_at, status_override,
      session_start_offset, sessions_total, class_group_id`)
    .eq('student_id', studentId)

  const cgIds = [...new Set((enrollments ?? []).map((e: any) => e.class_group_id).filter(Boolean))]

  const { data: classGroups } = cgIds.length > 0
    ? await supabase.from('class_groups').select('id, label, tutor_id, zoom_link').in('id', cgIds)
    : { data: [] }

  const tutorIds = [...new Set((classGroups ?? []).map((cg: any) => cg.tutor_id).filter(Boolean))]
  const { data: tutors } = tutorIds.length > 0
    ? await supabase.from('profiles').select('id, full_name').in('id', tutorIds)
    : { data: [] }

  // Waktu WIT
  const nowWIT = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jayapura' }))
  const toUTC  = (d: Date) => new Date(d.getTime() - 9 * 60 * 60 * 1000).toISOString()

  // Today range (WIT)
  const todayStart = new Date(nowWIT); todayStart.setHours(0, 0, 0, 0)
  const todayEnd   = new Date(nowWIT); todayEnd.setHours(23, 59, 59, 999)

  // Next 30 days untuk cari sesi berikutnya
  const futureEnd = new Date(nowWIT); futureEnd.setDate(futureEnd.getDate() + 30)

  const { data: sessions } = cgIds.length > 0
    ? await supabase
        .from('sessions')
        .select('id, class_group_id, scheduled_at, status, zoom_link')
        .in('class_group_id', cgIds)
        .gte('scheduled_at', toUTC(todayStart))
        .lte('scheduled_at', toUTC(futureEnd))
        .order('scheduled_at')
    : { data: [] }

  // Session hari ini
  const todaySessions = (sessions ?? []).filter((s: any) => {
    const sDate = new Date(s.scheduled_at)
    const sWIT  = new Date(sDate.toLocaleString('en-US', { timeZone: 'Asia/Jayapura' }))
    return sWIT >= todayStart && sWIT <= todayEnd && s.status === 'scheduled'
  })

  // Sesi berikutnya (di luar hari ini)
  const nextSession = (sessions ?? []).find((s: any) => {
    const sDate = new Date(s.scheduled_at)
    const sWIT  = new Date(sDate.toLocaleString('en-US', { timeZone: 'Asia/Jayapura' }))
    return sWIT > todayEnd && s.status === 'scheduled'
  })

  // Sessions completed untuk progress & laporan
  const { data: completedSessions } = cgIds.length > 0
    ? await supabase
        .from('sessions')
        .select('id, class_group_id, scheduled_at, status')
        .in('class_group_id', cgIds)
        .eq('status', 'completed')
        .order('scheduled_at', { ascending: false })
        .limit(20)
    : { data: [] }

  const allSessionIds = [
    ...(sessions ?? []).map((s: any) => s.id),
    ...(completedSessions ?? []).map((s: any) => s.id),
  ]

  const { data: attendances } = allSessionIds.length > 0
    ? await supabase
        .from('attendances')
        .select('session_id, status')
        .eq('student_id', studentId)
        .in('session_id', allSessionIds)
    : { data: [] }

  const completedIds = (completedSessions ?? []).map((s: any) => s.id)
  const { data: reports } = completedIds.length > 0
    ? await supabase
        .from('session_reports')
        .select('session_id, materi, perkembangan, saran_ortu')
        .eq('student_id', studentId)
        .in('session_id', completedIds)
    : { data: [] }

  const hadirCount = (attendances ?? []).filter((a: any) => a.status === 'hadir').length
  const totalAtt   = (attendances ?? []).length
  const hadirPct   = totalAtt > 0 ? Math.round((hadirCount / totalAtt) * 100) : 0

  const attBadge: Record<string, { bg: string; text: string; label: string }> = {
    hadir: { bg: '#EAF3DE', text: '#27500A', label: 'Hadir' },
    izin:  { bg: '#E6F1FB', text: '#0C447C', label: 'Izin' },
    sakit: { bg: '#FAEEDA', text: '#412402', label: 'Sakit' },
    alpha: { bg: '#FCEBEB', text: '#791F1F', label: 'Alpha' },
  }

  return (
    <div className="px-4 lg:px-6 py-5 max-w-2xl">

      {/* Hero profil anak */}
      <div className="bg-white border border-stone-100 rounded-2xl p-4 mb-4"
        style={{ borderTop: '3px solid #5C4FE5' }}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
            style={{ background: '#EEEDFE', color: '#3C3489' }}>
            {initials(studentName)}
          </div>
          <div>
            <p className="text-[15px] font-bold text-stone-800">{studentName}</p>
            <p className="text-[11px] text-stone-400">
              {student.grade ?? '—'}{student.school ? ` · ${student.school}` : ''}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { num: (enrollments ?? []).filter((e: any) => e.status === 'active').length, lbl: 'Kelas aktif' },
            {
              num: `${hadirPct}%`,
              lbl: 'Kehadiran',
              color: hadirPct >= 80 ? '#16a34a' : hadirPct >= 60 ? '#d97706' : '#dc2626'
            },
            { num: (reports ?? []).length, lbl: 'Laporan' },
          ].map((s, i) => (
            <div key={i} className="bg-stone-50 rounded-xl px-3 py-2 text-center">
              <p className="text-[15px] font-bold" style={{ color: (s as any).color ?? '#374151' }}>{s.num}</p>
              <p className="text-[10px] text-stone-400 mt-0.5">{s.lbl}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── JADWAL HARI INI ── */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[12px] font-bold text-stone-700">
            📅 Jadwal Hari Ini
          </p>
          <Link href={`/ortu/anak/${studentId}/jadwal`}
            className="text-[11px] text-[#5C4FE5] hover:underline">
            Lihat semua →
          </Link>
        </div>

        {todaySessions.length > 0 ? (
          <div className="flex flex-col gap-2">
            {todaySessions.map((s: any) => {
              const cg    = (classGroups ?? []).find((c: any) => c.id === s.class_group_id)
              const tutor = (tutors ?? []).find((t: any) => t.id === cg?.tutor_id)
              const zoom  = s.zoom_link ?? cg?.zoom_link ?? null
              const sWIT  = new Date(new Date(s.scheduled_at).toLocaleString('en-US', { timeZone: 'Asia/Jayapura' }))
              const isOngoing = nowWIT >= sWIT && nowWIT <= new Date(sWIT.getTime() + 90 * 60 * 1000)

              return (
                <div key={s.id}
                  className="bg-white border rounded-xl overflow-hidden"
                  style={{
                    borderLeft: `3px solid ${isOngoing ? '#16a34a' : '#5C4FE5'}`,
                    borderColor: isOngoing ? '#bbf7d0' : '#E5E3FF',
                  }}>
                  <div className="flex items-center gap-3 px-3 py-2.5">
                    {/* Jam */}
                    <div className="text-center flex-shrink-0" style={{ minWidth: '48px' }}>
                      <p className="text-[13px] font-bold text-stone-700">{fmtTime(s.scheduled_at)}</p>
                      <p className="text-[9px] text-stone-400">WIT</p>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-stone-700 truncate">{cg?.label ?? '—'}</p>
                      <p className="text-[10px] text-stone-400 truncate">{tutor?.full_name ?? '—'}</p>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      {isOngoing ? (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
                          Sedang berlangsung
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#EEEDFE] text-[#3C3489]">
                          Akan datang
                        </span>
                      )}
                      {zoom && (
                        <a href={zoom} target="_blank" rel="noopener noreferrer"
                          className="text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-[#5C4FE5] text-white hover:bg-[#3D34C4] transition-colors">
                          ▶ Buka Zoom
                        </a>
                      )}
                    </div>
                  </div>
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
                      const cg = (classGroups ?? []).find((c: any) => c.id === nextSession.class_group_id)
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

      {/* Kelas aktif */}
      <p className="text-[12px] font-bold text-stone-700 mb-2">Kelas aktif</p>
      {(enrollments ?? []).length === 0 ? (
        <div className="bg-white border border-stone-100 rounded-xl py-6 text-center mb-4">
          <p className="text-[11px] text-stone-400">Belum ada kelas aktif</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 mb-4">
          {(enrollments ?? []).map((e: any) => {
            const cg    = (classGroups ?? []).find((c: any) => c.id === e.class_group_id)
            const tutor = (tutors ?? []).find((t: any) => t.id === cg?.tutor_id)
            const cgCompleted = (completedSessions ?? []).filter((s: any) => s.class_group_id === e.class_group_id)
            const hadirInCG  = cgCompleted.filter((s: any) =>
              (attendances ?? []).find((a: any) => a.session_id === s.id && a.status === 'hadir')
            ).length
            const progress = (e.session_start_offset ?? 0) + hadirInCG
            const total    = e.sessions_total ?? 8

            return (
              <div key={e.id} className="bg-white border border-stone-100 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-stone-50">
                  <div>
                    <p className="text-[12px] font-semibold text-stone-700">{cg?.label ?? '—'}</p>
                    <p className="text-[10px] text-stone-400">{tutor?.full_name ?? '—'}</p>
                  </div>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
                    Aktif
                  </span>
                </div>
                <div className="px-3 py-2">
                  <div className="flex justify-between mb-1">
                    <p className="text-[10px] text-stone-400">Progress</p>
                    <p className="text-[10px] font-semibold text-stone-600">{progress}/{total} sesi</p>
                  </div>
                  <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, Math.round(progress / total * 100))}%`, background: '#5C4FE5' }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Laporan terbaru */}
      {(reports ?? []).length > 0 && (
        <>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[12px] font-bold text-stone-700">Laporan terbaru</p>
            <Link href={`/ortu/anak/${studentId}/laporan`}
              className="text-[11px] text-[#5C4FE5] hover:underline">
              Lihat semua →
            </Link>
          </div>
          {(completedSessions ?? [])
            .filter((s: any) => (reports ?? []).find((r: any) => r.session_id === s.id))
            .slice(0, 3)
            .map((s: any) => {
              const rep = (reports ?? []).find((r: any) => r.session_id === s.id)
              const att = (attendances ?? []).find((a: any) => a.session_id === s.id)
              const cg  = (classGroups ?? []).find((c: any) => c.id === s.class_group_id)
              if (!rep) return null
              return (
                <div key={s.id} className="bg-white border border-stone-100 rounded-xl overflow-hidden mb-2">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-stone-50">
                    <div>
                      <p className="text-[11px] font-semibold text-stone-600">{cg?.label ?? '—'}</p>
                      <p className="text-[10px] text-stone-400">{fmtDate(s.scheduled_at)}</p>
                    </div>
                    {att && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                        style={{
                          background: attBadge[att.status]?.bg ?? '#f0f0f0',
                          color: attBadge[att.status]?.text ?? '#888',
                        }}>
                        {attBadge[att.status]?.label ?? att.status}
                      </span>
                    )}
                  </div>
                  <div className="px-3 py-2.5">
                    {rep.materi && (
                      <p className="text-[11px] text-stone-500 mb-1">
                        <span className="font-semibold text-stone-600">Materi: </span>{rep.materi}
                      </p>
                    )}
                    {rep.saran_ortu && (
                      <div className="px-2.5 py-2 rounded-lg mt-1.5"
                        style={{ background: '#EEEDFE60', borderLeft: '2px solid #5C4FE5' }}>
                        <p className="text-[9px] font-bold text-[#3C3489] uppercase tracking-wider mb-1">
                          Catatan untuk Orang Tua
                        </p>
                        <p className="text-[11px] text-[#3C3489]">{rep.saran_ortu}</p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          }
        </>
      )}
    </div>
  )
}
