import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getEnrollmentStatus, formatWIT, formatDateWIT } from '@/lib/siswa/helpers'

export const metadata = { title: 'Dashboard · EduKazia' }

// ─── Helper: ambil ringkasan per siswa ───────────────────────────
async function fetchChildSummary(supabase: any, studentId: string, nowWIT: Date) {
  const toUTC = (d: Date) => new Date(d.getTime() - 9 * 60 * 60 * 1000).toISOString()

  // Enrollments
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('id, status, end_date, expired_at, status_override, sessions_total, session_start_offset, class_group_id')
    .eq('student_id', studentId)

  const activeEnrollments = (enrollments ?? []).filter(
    (e: any) => getEnrollmentStatus(e) === 'active'
  )
  const isExpired = (enrollments ?? []).length > 0 &&
    (enrollments ?? []).every((e: any) => getEnrollmentStatus(e) === 'expired')

  const classGroupIds = activeEnrollments.map((e: any) => e.class_group_id).filter(Boolean)

  if (classGroupIds.length === 0) {
    return { enrollments, activeEnrollments: [], isExpired, classGroupIds: [], cgMap: {}, activeEnrollmentsWithCG: [], todaySessions: [], laporanList: [], hadirPct: 0, totalAtt: 0, hadirCount: 0 }
  }

  // Class groups + courses
  const { data: classGroups } = await supabase
    .from('class_groups').select('id, label, zoom_link, course_id, tutor_id').in('id', classGroupIds)

  const courseIds = (classGroups ?? []).map((cg: any) => cg.course_id).filter(Boolean)
  const { data: coursesData } = courseIds.length > 0
    ? await supabase.from('courses').select('id, name, color').in('id', courseIds)
    : { data: [] }

  const courseMap: Record<string, any> = {}
  ;(coursesData ?? []).forEach((c: any) => { courseMap[c.id] = c })

  const cgMap: Record<string, any> = {}
  ;(classGroups ?? []).forEach((cg: any) => {
    cgMap[cg.id] = { ...cg, courses: courseMap[cg.course_id] ?? null }
  })

  // Progress (hadir di sesi completed)
  const { data: completedSess } = await supabase
    .from('sessions').select('id, class_group_id').in('class_group_id', classGroupIds).eq('status', 'completed')

  const completedIds = (completedSess ?? []).map((s: any) => s.id)
  const { data: hadirAtts } = completedIds.length > 0
    ? await supabase.from('attendances').select('session_id').eq('student_id', studentId).eq('status', 'hadir').in('session_id', completedIds)
    : { data: [] }

  const hadirPerCG: Record<string, number> = {}
  ;(hadirAtts ?? []).forEach((a: any) => {
    const sess = (completedSess ?? []).find((s: any) => s.id === a.session_id)
    if (sess) hadirPerCG[sess.class_group_id] = (hadirPerCG[sess.class_group_id] ?? 0) + 1
  })

  const activeEnrollmentsWithCG = activeEnrollments.map((e: any) => ({
    ...e,
    class_groups: cgMap[e.class_group_id] ?? null,
    done: (e.session_start_offset ?? 0) + (hadirPerCG[e.class_group_id] ?? 0),
  }))

  // Sesi hari ini
  const todayStart = new Date(nowWIT); todayStart.setHours(0, 0, 0, 0)
  const todayEnd   = new Date(nowWIT); todayEnd.setHours(23, 59, 59, 999)

  const { data: todaySessions } = await supabase
    .from('sessions')
    .select(`id, scheduled_at, status, zoom_link, class_groups(id, label, zoom_link, courses(id, name, color), profiles!class_groups_tutor_id_fkey(full_name))`)
    .in('class_group_id', classGroupIds)
    .gte('scheduled_at', toUTC(todayStart))
    .lte('scheduled_at', toUTC(todayEnd))
    .order('scheduled_at')

  // Kehadiran bulan ini
  const startOfMonth = new Date(nowWIT.getFullYear(), nowWIT.getMonth(), 1)
  const { data: attendances } = await supabase
    .from('attendances').select('status').eq('student_id', studentId).gte('created_at', toUTC(startOfMonth))

  const totalAtt   = (attendances ?? []).length
  const hadirCount = (attendances ?? []).filter((a: any) => a.status === 'hadir').length
  const hadirPct   = totalAtt > 0 ? Math.round((hadirCount / totalAtt) * 100) : 0

  // Laporan terbaru
  const { data: laporanRaw } = await supabase
    .from('session_reports')
    .select('id, materi, perkembangan, created_at, session_id')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .limit(3)

  const lapSessionIds = (laporanRaw ?? []).map((l: any) => l.session_id).filter(Boolean)
  const { data: lapSessions } = lapSessionIds.length > 0
    ? await supabase.from('sessions').select('id, scheduled_at, class_group_id').in('id', lapSessionIds)
    : { data: [] }

  const lapCgIds = (lapSessions ?? []).map((s: any) => s.class_group_id).filter(Boolean)
  const { data: lapCg } = lapCgIds.length > 0
    ? await supabase.from('class_groups').select('id, course_id, tutor_id').in('id', lapCgIds)
    : { data: [] }

  const lapCourseIds = (lapCg ?? []).map((cg: any) => cg.course_id).filter(Boolean)
  const lapTutorIds  = (lapCg ?? []).map((cg: any) => cg.tutor_id).filter(Boolean)
  const { data: lapCourses } = lapCourseIds.length > 0
    ? await supabase.from('courses').select('id, name, color').in('id', lapCourseIds) : { data: [] }
  const { data: lapTutors } = lapTutorIds.length > 0
    ? await supabase.from('profiles').select('id, full_name').in('id', lapTutorIds) : { data: [] }

  const lapCgMap: Record<string, any> = {}
  ;(lapCg ?? []).forEach((cg: any) => {
    lapCgMap[cg.id] = {
      courses:  (lapCourses ?? []).find((c: any) => c.id === cg.course_id) ?? null,
      profiles: (lapTutors  ?? []).find((p: any) => p.id === cg.tutor_id) ?? null,
    }
  })
  const lapSessionMap: Record<string, any> = {}
  ;(lapSessions ?? []).forEach((s: any) => {
    lapSessionMap[s.id] = { ...s, class_groups: lapCgMap[s.class_group_id] ?? null }
  })
  const laporanList = (laporanRaw ?? []).map((l: any) => ({ ...l, sessions: lapSessionMap[l.session_id] ?? null }))

  return { enrollments, activeEnrollments, isExpired, classGroupIds, cgMap, activeEnrollmentsWithCG, todaySessions: todaySessions ?? [], laporanList, hadirPct, totalAtt, hadirCount }
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase()
}

const AVATAR_BG = ['#5C4FE5','#D4537E','#1D9E75','#D85A30','#185FA5']

// ─── KOMPONEN: Dashboard Ortu ────────────────────────────────────
async function ParentDashboard({ supabase, childrenList, nowWIT }: any) {
  const toUTC = (d: Date) => new Date(d.getTime() - 9 * 60 * 60 * 1000).toISOString()

  // Fetch summary semua anak secara parallel
  const summaries = await Promise.all(
    childrenList.map((child: any) => fetchChildSummary(supabase, child.id, nowWIT))
  )

  const childrenWithData = childrenList.map((child: any, i: number) => ({
    ...child,
    summary: summaries[i],
  }))

  // Cek apakah ada anak yang alpha hari ini
  const alertChildren = childrenWithData.filter((c: any) => {
    const todayAtt = c.summary.todaySessions?.length > 0
    return false // akan dikembangkan dengan cek attendance hari ini
  })

  // Feed gabungan semua laporan terbaru
  const allLaporan = childrenWithData.flatMap((c: any) =>
    c.summary.laporanList.map((l: any) => ({ ...l, childName: c.profile?.full_name ?? 'Siswa', childAv: getInitials(c.profile?.full_name ?? 'S'), childColor: AVATAR_BG[childrenList.indexOf(c) % AVATAR_BG.length] }))
  ).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5)

  const totalSesiHariIni = childrenWithData.reduce((acc: number, c: any) => acc + (c.summary.todaySessions?.length ?? 0), 0)
  const avgHadir = childrenWithData.length > 0
    ? Math.round(childrenWithData.reduce((acc: number, c: any) => acc + c.summary.hadirPct, 0) / childrenWithData.length)
    : 0

  return (
    <div className="px-4 pt-4 pb-2">
      <div className="mb-4">
        <h2 className="text-[16px] font-bold text-[#1A1530]">Ringkasan Belajar</h2>
        <p className="text-[12px] text-[#9B97B2] mt-0.5">{formatDateWIT(new Date())} · WIT</p>
      </div>

      {/* Stat ringkasan semua anak */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white border border-[#E5E3FF] rounded-2xl p-4">
          <p className="text-[11px] text-[#9B97B2] mb-1">Anak Terdaftar</p>
          <p className="text-[26px] font-bold text-[#5C4FE5] leading-none">{childrenList.length}</p>
          <p className="text-[11px] text-[#9B97B2] mt-1">anak aktif</p>
        </div>
        <div className="bg-white border border-[#E5E3FF] rounded-2xl p-4">
          <p className="text-[11px] text-[#9B97B2] mb-1">Sesi Hari Ini</p>
          <p className="text-[26px] font-bold text-[#5C4FE5] leading-none">{totalSesiHariIni}</p>
          <p className="text-[11px] text-[#9B97B2] mt-1">sesi terjadwal</p>
        </div>
        <div className="bg-white border border-[#E5E3FF] rounded-2xl p-4">
          <p className="text-[11px] text-[#9B97B2] mb-1">Rata-rata Hadir</p>
          <p className={`text-[26px] font-bold leading-none ${avgHadir >= 80 ? 'text-green-600' : avgHadir >= 60 ? 'text-yellow-600' : 'text-red-500'}`}>
            {childrenWithData.some((c: any) => c.summary.totalAtt > 0) ? `${avgHadir}%` : '—'}
          </p>
          <p className="text-[11px] text-[#9B97B2] mt-1">bulan ini</p>
        </div>
      </div>

      {/* Card per anak */}
      <p className="text-[11px] font-bold text-[#9B97B2] uppercase tracking-widest mb-3">Semua Anak</p>
      <div className="space-y-3 mb-4">
        {childrenWithData.map((child: any, idx: number) => {
          const name    = child.profile?.full_name ?? 'Siswa'
          const summary = child.summary
          const bgColor = AVATAR_BG[idx % AVATAR_BG.length]
          const nextSesi = summary.todaySessions?.[0]
          const firstEnroll = summary.activeEnrollmentsWithCG?.[0]
          const courseName = firstEnroll?.class_groups?.courses?.name ?? firstEnroll?.class_groups?.label ?? '—'
          const done  = firstEnroll?.done ?? 0
          const total = firstEnroll?.sessions_total ?? 0
          const pct   = total > 0 ? Math.round((done / total) * 100) : 0

          return (
            <div key={child.id} className="bg-white border border-[#E5E3FF] rounded-2xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-bold text-white flex-shrink-0"
                  style={{ background: bgColor }}>
                  {getInitials(name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-bold text-[#1A1530] truncate">{name}</p>
                  <p className="text-[11px] text-[#9B97B2]">{courseName}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-[16px] font-bold ${summary.hadirPct >= 80 ? 'text-green-600' : summary.hadirPct >= 60 ? 'text-yellow-600' : 'text-red-500'}`}>
                    {summary.totalAtt > 0 ? `${summary.hadirPct}%` : '—'}
                  </p>
                  <p className="text-[10px] text-[#9B97B2]">kehadiran</p>
                </div>
              </div>

              {/* Progress bar */}
              {total > 0 && (
                <div className="mb-3">
                  <div className="flex justify-between mb-1">
                    <p className="text-[11px] text-[#9B97B2]">Progress sesi</p>
                    <p className="text-[11px] font-semibold text-[#1A1530]">{done}/{total}</p>
                  </div>
                  <div className="h-2 bg-[#F7F6FF] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: bgColor }}/>
                  </div>
                </div>
              )}

              {/* Sesi hari ini */}
              {nextSesi ? (
                <div className="flex items-center justify-between px-3 py-2 bg-[#EEEDFE] rounded-xl">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#5C4FE5]"/>
                    <p className="text-[12px] font-semibold text-[#3C3489]">
                      Sesi hari ini · {formatWIT(nextSesi.scheduled_at)} WIT
                    </p>
                  </div>
                  {(nextSesi.zoom_link || nextSesi.class_groups?.zoom_link) && (
                    <a href={nextSesi.zoom_link || nextSesi.class_groups?.zoom_link}
                      target="_blank" rel="noopener noreferrer"
                      className="text-[11px] font-bold text-[#5C4FE5]">▶ Zoom</a>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 bg-[#F7F6FF] rounded-xl">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#C4BFFF]"/>
                  <p className="text-[12px] text-[#9B97B2]">Tidak ada sesi hari ini</p>
                </div>
              )}

              {/* Laporan terbaru singkat */}
              {summary.laporanList?.[0] && (
                <div className="mt-3 pt-3 border-t border-[#F0EFFF]">
                  <p className="text-[11px] text-[#9B97B2] mb-1">Laporan terakhir dari tutor</p>
                  <p className="text-[12px] text-[#1A1530] truncate">{summary.laporanList[0].materi ?? '—'}</p>
                  {summary.laporanList[0].perkembangan && (
                    <p className="text-[11px] text-[#9B97B2] truncate">{summary.laporanList[0].perkembangan}</p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Feed gabungan laporan semua anak */}
      {allLaporan.length > 0 && (
        <div className="bg-white border border-[#E5E3FF] rounded-2xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[13px] font-bold text-[#1A1530]">Laporan Terbaru</p>
            <Link href="/siswa/laporan" className="text-[11px] font-semibold text-[#5C4FE5]">Lihat Semua ›</Link>
          </div>
          <div className="space-y-3">
            {allLaporan.map((l: any, i: number) => {
              const cg     = l.sessions?.class_groups
              const course = cg?.courses
              const tutor  = cg?.profiles
              return (
                <div key={`${l.id}-${i}`} className={`flex items-start gap-3 pb-3 ${i < allLaporan.length - 1 ? 'border-b border-[#F0EFFF]' : ''}`}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
                    style={{ background: l.childColor }}>
                    {l.childAv}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[12px] font-bold text-[#1A1530]">{l.childName}</p>
                      <p className="text-[10px] text-[#9B97B2] flex-shrink-0">
                        {new Date(l.created_at).toLocaleDateString('id-ID', { timeZone: 'Asia/Jayapura', day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                    <p className="text-[11px] text-[#9B97B2]">{course?.name ?? '—'} · {tutor?.full_name ?? '—'}</p>
                    <p className="text-[12px] text-[#6B6580] mt-1 truncate">{l.materi ?? '—'}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── KOMPONEN: Dashboard Siswa (diri sendiri) ────────────────────
async function StudentDashboard({ supabase, studentId, nowWIT }: any) {
  const summary = await fetchChildSummary(supabase, studentId, nowWIT)
  const { activeEnrollmentsWithCG, isExpired, todaySessions, laporanList, hadirPct, totalAtt, hadirCount } = summary

  return (
    <div className="px-4 pt-4 pb-2">
      <div className="mb-4">
        <h2 className="text-[16px] font-bold text-[#1A1530]">Ringkasan Belajar</h2>
        <p className="text-[12px] text-[#9B97B2] mt-0.5">{formatDateWIT(new Date())} · WIT</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="bg-white border border-[#E5E3FF] rounded-2xl p-4">
          <p className="text-[11px] text-[#9B97B2] mb-1">Sesi Hari Ini</p>
          <p className="text-[26px] font-bold text-[#5C4FE5] leading-none">{todaySessions.length}</p>
          <p className="text-[11px] text-[#9B97B2] mt-1">{todaySessions.length === 0 ? 'tidak ada sesi' : 'sesi terjadwal'}</p>
        </div>
        <div className="bg-white border border-[#E5E3FF] rounded-2xl p-4">
          <p className="text-[11px] text-[#9B97B2] mb-1">Kehadiran Bulan Ini</p>
          <p className={`text-[26px] font-bold leading-none ${hadirPct >= 80 ? 'text-green-600' : hadirPct >= 60 ? 'text-yellow-600' : 'text-red-500'}`}>
            {totalAtt > 0 ? `${hadirPct}%` : '—'}
          </p>
          <p className="text-[11px] text-[#9B97B2] mt-1">{totalAtt > 0 ? `${hadirCount} dari ${totalAtt} hadir` : 'belum ada sesi'}</p>
        </div>
        <div className="bg-white border border-[#E5E3FF] rounded-2xl p-4">
          <p className="text-[11px] text-[#9B97B2] mb-1">Mata Pelajaran</p>
          <p className="text-[26px] font-bold text-[#5C4FE5] leading-none">{activeEnrollmentsWithCG.length}</p>
          <p className="text-[11px] text-[#9B97B2] mt-1">aktif saat ini</p>
        </div>
        <div className="bg-white border border-[#E5E3FF] rounded-2xl p-4">
          <p className="text-[11px] text-[#9B97B2] mb-1">Status Paket</p>
          <p className={`text-[14px] font-bold leading-none mt-1 ${isExpired ? 'text-red-500' : 'text-green-600'}`}>
            {isExpired ? 'Berakhir' : 'Aktif'}
          </p>
          <p className="text-[11px] text-[#9B97B2] mt-1">{isExpired ? 'hubungi admin' : `${activeEnrollmentsWithCG.length} enrollment`}</p>
        </div>
      </div>

      {/* Jadwal hari ini */}
      <div className="bg-white border border-[#E5E3FF] rounded-2xl p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[13px] font-bold text-[#1A1530]">Jadwal Hari Ini</p>
          <Link href="/siswa/jadwal" className="text-[11px] font-semibold text-[#5C4FE5]">Lihat Semua ›</Link>
        </div>
        {todaySessions.length === 0 ? (
          <div className="py-4 text-center">
            <p className="text-[12px] text-[#9B97B2]">Tidak ada sesi hari ini 🎉</p>
          </div>
        ) : (
          <div>
            {todaySessions.map((s: any, i: number) => {
              const cg       = s.class_groups
              const course   = cg?.courses
              const tutor    = cg?.profiles
              const witTime  = formatWIT(s.scheduled_at)
              const zoomLink = s.zoom_link || cg?.zoom_link
              const sesiTime = new Date(s.scheduled_at)
              const sesiEnd  = new Date(sesiTime.getTime() + 90 * 60 * 1000)
              const isNow    = nowWIT >= sesiTime && nowWIT <= sesiEnd
              const isPast   = nowWIT > sesiEnd
              const statusLabel = isNow ? 'Sekarang' : isPast ? 'Selesai' : 'Akan Datang'
              const statusCls   = isNow ? 'bg-[#EAE8FD] text-[#5C4FE5]' : isPast ? 'bg-gray-100 text-gray-500' : 'bg-[#FFF8D6] text-[#8A6D00]'
              return (
                <div key={s.id} className={`flex items-start gap-3 py-3 ${i < todaySessions.length - 1 ? 'border-b border-[#E5E3FF]' : ''}`}>
                  <div className="text-center min-w-[42px]">
                    <p className="text-[14px] font-bold text-[#1A1530] leading-none">{witTime}</p>
                    <p className="text-[10px] text-[#9B97B2]">WIT</p>
                  </div>
                  <div className="w-px self-stretch bg-[#E5E3FF]"/>
                  <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: course?.color ?? '#5C4FE5' }}/>
                  <div className="flex-1">
                    <p className="text-[13px] font-bold text-[#1A1530]">{course?.name ?? cg?.label}</p>
                    <p className="text-[11px] text-[#9B97B2]">{tutor?.full_name ?? '—'} · {zoomLink ? 'Online' : 'Offline'}</p>
                    {zoomLink && !isPast && (
                      <a href={zoomLink} target="_blank" rel="noopener noreferrer"
                        className="text-[11px] text-[#5C4FE5] font-semibold mt-1 inline-flex items-center gap-1">▶ Buka Zoom</a>
                    )}
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg flex-shrink-0 ${statusCls}`}>{statusLabel}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Progress sesi */}
      {activeEnrollmentsWithCG.length > 0 && (
        <div className="bg-white border border-[#E5E3FF] rounded-2xl p-4 mb-4">
          <p className="text-[13px] font-bold text-[#1A1530] mb-3">Progress Sesi</p>
          <div className="space-y-3">
            {activeEnrollmentsWithCG.map((e: any) => {
              const cg    = e.class_groups
              const course = cg?.courses
              const total  = e.sessions_total ?? 0
              const done   = e.done ?? 0
              const pct    = total > 0 ? Math.round((done / total) * 100) : 0
              const color  = course?.color ?? '#5C4FE5'
              return (
                <div key={e.id}>
                  <div className="flex justify-between mb-1.5">
                    <p className="text-[12px] font-semibold text-[#1A1530]">{course?.name ?? cg?.label ?? '—'}</p>
                    <p className="text-[11px] text-[#9B97B2]">{done}/{total}</p>
                  </div>
                  <div className="h-2 bg-[#F7F6FF] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }}/>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Laporan terbaru */}
      <div className="bg-white border border-[#E5E3FF] rounded-2xl p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[13px] font-bold text-[#1A1530]">Laporan Terbaru dari Tutor</p>
          <Link href="/siswa/laporan" className="text-[11px] font-semibold text-[#5C4FE5]">Lihat Semua ›</Link>
        </div>
        {laporanList.length === 0 ? (
          <div className="py-4 text-center">
            <p className="text-[12px] text-[#9B97B2]">Belum ada laporan dari tutor.</p>
          </div>
        ) : (
          <div>
            {laporanList.map((l: any, i: number) => {
              const cg     = l.sessions?.class_groups
              const course = cg?.courses
              const tutor  = cg?.profiles
              const color  = course?.color ?? '#5C4FE5'
              const perkembangan = l.perkembangan?.toLowerCase() ?? ''
              const isGood = perkembangan.includes('baik') || perkembangan.includes('bagus')
              const isNeed = perkembangan.includes('perlu') || perkembangan.includes('kurang')
              const tagCls   = isGood ? 'bg-green-50 text-green-700' : isNeed ? 'bg-yellow-50 text-yellow-700' : 'bg-[#EAE8FD] text-[#5C4FE5]'
              const tagLabel = isGood ? '✓ Baik' : isNeed ? '▶ Perlu Latihan' : '• Cukup'
              return (
                <div key={l.id} className={`py-3 ${i < laporanList.length - 1 ? 'border-b border-[#E5E3FF]' : ''}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }}/>
                      <p className="text-[13px] font-bold text-[#1A1530]">{course?.name ?? '—'} · {tutor?.full_name ?? '—'}</p>
                    </div>
                    <p className="text-[10px] text-[#9B97B2]">
                      {new Date(l.created_at).toLocaleDateString('id-ID', { timeZone: 'Asia/Jayapura', day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <p className="text-[12px] text-[#6B6580] mb-2 pl-4">Materi: {l.materi ?? '—'}</p>
                  <div className="flex items-center gap-2 pl-4">
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg ${tagCls}`}>{tagLabel}</span>
                    {l.perkembangan && <span className="text-[11px] text-[#9B97B2] truncate">— {l.perkembangan}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── PAGE UTAMA ──────────────────────────────────────────────────
export default async function DashboardPage() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {}
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('id, role').eq('id', session.user.id).single()

  if (!profile || !['student', 'parent'].includes(profile.role)) redirect('/login')

  const isParent = profile.role === 'parent'
  const nowWIT = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jayapura' }))

  const { data: childrenList } = await supabase
    .from('students')
    .select(`id, grade, school, status, relation_role, profile:profiles!students_profile_id_fkey(id, full_name, avatar_url)`)
    .eq(isParent ? 'parent_profile_id' : 'profile_id', session.user.id)

  const childrenListFlat = (childrenList ?? []).map((c: any) => ({
    ...c,
    profile: Array.isArray(c.profile) ? c.profile[0] ?? null : c.profile,
  }))

  if (childrenListFlat.length === 0) {
    return (
      <div className="px-4 pt-6 text-center">
        <p className="text-sm text-[#9B97B2]">Tidak ada data siswa ditemukan.</p>
      </div>
    )
  }

  if (isParent) {
    return <ParentDashboard supabase={supabase} childrenList={childrenListFlat} nowWIT={nowWIT}/>
  }

  return <StudentDashboard supabase={supabase} studentId={childrenListFlat[0].id} nowWIT={nowWIT}/>
}
