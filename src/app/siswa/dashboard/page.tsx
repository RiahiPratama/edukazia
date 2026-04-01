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

  // ✅ OPTIMIZED: Replace UNRELIABLE nested join with FLAT queries
  // OLD: One query with nested joins (profiles!class_groups_tutor_id_fkey)
  // NEW: Separate queries + manual join (RELIABLE)
  const { data: todaySessionsRaw } = await supabase
    .from('sessions')
    .select('id, scheduled_at, status, zoom_link, class_group_id')
    .in('class_group_id', classGroupIds)
    .gte('scheduled_at', toUTC(todayStart))
    .lte('scheduled_at', toUTC(todayEnd))
    .order('scheduled_at')

  // Get unique class_group_ids from today's sessions
  const sessionCgIds = [...new Set((todaySessionsRaw ?? []).map((s: any) => s.class_group_id).filter(Boolean))]
  
  // Fetch related data separately
  const { data: sessionCgs } = sessionCgIds.length > 0
    ? await supabase
        .from('class_groups')
        .select('id, label, zoom_link, course_id, tutor_id')
        .in('id', sessionCgIds)
    : { data: [] }

  const sessionCourseIds = [...new Set((sessionCgs ?? []).map((cg: any) => cg.course_id).filter(Boolean))]
  const sessionTutorIds = [...new Set((sessionCgs ?? []).map((cg: any) => cg.tutor_id).filter(Boolean))]

  const [sessionCourses, sessionTutorProfiles] = await Promise.all([
    sessionCourseIds.length > 0
      ? supabase.from('courses').select('id, name, color').in('id', sessionCourseIds)
      : Promise.resolve({ data: [] }),
    sessionTutorIds.length > 0
      ? supabase.from('tutors').select('id, profiles!tutors_profile_id_fkey(full_name)').in('id', sessionTutorIds)
      : Promise.resolve({ data: [] })
  ])

  // Build maps
  const sessionCourseMap: Record<string, any> = {}
  ;(sessionCourses.data ?? []).forEach((c: any) => {
    sessionCourseMap[c.id] = c
  })

  const sessionTutorMap: Record<string, any> = {}
  ;(sessionTutorProfiles.data ?? []).forEach((t: any) => {
    const fullName = Array.isArray(t.profiles) ? t.profiles[0]?.full_name : t.profiles?.full_name
    sessionTutorMap[t.id] = { id: t.id, full_name: fullName }
  })

  // Build session CG map
  const sessionCgMap: Record<string, any> = {}
  ;(sessionCgs ?? []).forEach((cg: any) => {
    sessionCgMap[cg.id] = {
      id: cg.id,
      label: cg.label,
      zoom_link: cg.zoom_link,
      courses: sessionCourseMap[cg.course_id] || null,
      profiles: sessionTutorMap[cg.tutor_id] || null
    }
  })

  // Attach class_groups to sessions
  const todaySessions = (todaySessionsRaw ?? []).map((s: any) => ({
    ...s,
    class_groups: sessionCgMap[s.class_group_id] || null
  }))

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
  
  const [lapCourses, lapTutorProfiles] = await Promise.all([
    lapCourseIds.length > 0
      ? supabase.from('courses').select('id, name, color').in('id', lapCourseIds)
      : Promise.resolve({ data: [] }),
    lapTutorIds.length > 0
      ? supabase.from('tutors').select('id, profiles!tutors_profile_id_fkey(full_name)').in('id', lapTutorIds)
      : Promise.resolve({ data: [] })
  ])

  const lapTutorMap: Record<string, any> = {}
  ;(lapTutorProfiles.data ?? []).forEach((t: any) => {
    const fullName = Array.isArray(t.profiles) ? t.profiles[0]?.full_name : t.profiles?.full_name
    lapTutorMap[t.id] = { id: t.id, full_name: fullName }
  })

  const lapCgMap: Record<string, any> = {}
  ;(lapCg ?? []).forEach((cg: any) => {
    lapCgMap[cg.id] = {
      courses:  (lapCourses.data ?? []).find((c: any) => c.id === cg.course_id) ?? null,
      profiles: lapTutorMap[cg.tutor_id] ?? null,
    }
  })
  const lapSessionMap: Record<string, any> = {}
  ;(lapSessions ?? []).forEach((s: any) => {
    lapSessionMap[s.id] = { ...s, class_groups: lapCgMap[s.class_group_id] ?? null }
  })
  const laporanList = (laporanRaw ?? []).map((l: any) => ({ ...l, sessions: lapSessionMap[l.session_id] ?? null }))

  return { enrollments, activeEnrollments, isExpired, classGroupIds, cgMap, activeEnrollmentsWithCG, todaySessions, laporanList, hadirPct, totalAtt, hadirCount }
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase()
}

const AVATAR_BG = ['#5C4FE5','#D4537E','#1D9E75','#D85A30','#185FA5']

// ─── KOMPONEN: Dashboard Ortu — REVOLUSIONER ─────────────────────
async function ParentDashboard({ supabase, childrenList, nowWIT }: any) {
  // Fetch semua anak secara parallel
  const summaries = await Promise.all(
    childrenList.map((child: any) => fetchChildSummary(supabase, child.id, nowWIT))
  )
  const childrenWithData = childrenList.map((child: any, i: number) => ({
    ...child, summary: summaries[i],
  }))

  // Aggregate stats
  const totalSesiHariIni = childrenWithData.reduce((a: number, c: any) => a + (c.summary.todaySessions?.length ?? 0), 0)
  const childrenWithAtt  = childrenWithData.filter((c: any) => c.summary.totalAtt > 0)
  const avgHadir = childrenWithAtt.length > 0
    ? Math.round(childrenWithAtt.reduce((a: number, c: any) => a + c.summary.hadirPct, 0) / childrenWithAtt.length)
    : 0

  // Feed aktivitas gabungan semua anak — diurutkan terbaru
  const allLaporan = childrenWithData.flatMap((c: any, idx: number) =>
    (c.summary.laporanList ?? []).map((l: any) => ({
      ...l,
      childName:  c.profile?.full_name ?? 'Siswa',
      childAv:    getInitials(c.profile?.full_name ?? 'S'),
      childColor: AVATAR_BG[idx % AVATAR_BG.length],
      type: 'laporan',
    }))
  ).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 6)

  const tanggal = new Date().toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jayapura', weekday: 'long', day: 'numeric', month: 'long'
  })

  return (
    <div className="pb-6">

      {/* ── HERO BANNER ── */}
      <div className="bg-[#5C4FE5] px-4 pt-5 pb-6 mb-[-16px]">
        <p className="text-white/60 text-[12px] mb-1">{tanggal} · WIT</p>
        <p className="text-white text-[20px] font-bold mb-4">Pantau Belajar Anak</p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Anak Aktif',     val: childrenList.length,                             unit: 'anak' },
            { label: 'Sesi Hari Ini',  val: totalSesiHariIni,                                unit: 'sesi' },
            { label: 'Rata-rata Hadir',val: childrenWithAtt.length > 0 ? `${avgHadir}%` : '—', unit: 'bulan ini' },
          ].map(s => (
            <div key={s.label} className="bg-white/15 rounded-2xl px-3 py-3 text-center">
              <p className="text-white text-[22px] font-bold leading-none">{s.val}</p>
              <p className="text-white/60 text-[10px] mt-1">{s.unit}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 pt-8">

        {/* ── KARTU PER ANAK — grid 2 kolom ── */}
        <p className="text-[11px] font-bold text-[#9B97B2] uppercase tracking-widest mb-3">Semua Anak</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          {childrenWithData.map((child: any, idx: number) => {
            const name      = child.profile?.full_name ?? 'Siswa'
            const summary   = child.summary
            const bgColor   = AVATAR_BG[idx % AVATAR_BG.length]
            const nextSesi  = summary.todaySessions?.[0]
            const enrolls   = summary.activeEnrollmentsWithCG ?? []
            const firstE    = enrolls[0]
            const courseName = firstE?.class_groups?.courses?.name ?? firstE?.class_groups?.label ?? '—'
            const done   = firstE?.done ?? 0
            const total  = firstE?.sessions_total ?? 0
            const pct    = total > 0 ? Math.round((done / total) * 100) : 0
            const laporan = summary.laporanList?.[0]
            const hadirOk = summary.hadirPct >= 80
            const hadirWarn = summary.hadirPct >= 60 && summary.hadirPct < 80
            const hadirColor = hadirOk ? 'text-green-600' : hadirWarn ? 'text-yellow-600' : 'text-red-500'

            return (
              <div key={child.id} className="bg-white border border-[#E5E3FF] rounded-2xl overflow-hidden">
                {/* Header anak */}
                <div className="px-4 pt-4 pb-3 border-b border-[#F0EFFF]">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full flex items-center justify-center text-[14px] font-bold text-white flex-shrink-0"
                      style={{ background: bgColor }}>
                      {getInitials(name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-bold text-[#1A1530] truncate">{name}</p>
                      <p className="text-[11px] text-[#9B97B2] truncate">{courseName}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-[18px] font-bold ${hadirColor}`}>
                        {summary.totalAtt > 0 ? `${summary.hadirPct}%` : '—'}
                      </p>
                      <p className="text-[10px] text-[#9B97B2]">hadir</p>
                    </div>
                  </div>
                </div>

                {/* Progress */}
                {total > 0 && (
                  <div className="px-4 py-3 border-b border-[#F0EFFF]">
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-[11px] text-[#9B97B2]">Progress sesi</p>
                      <p className="text-[12px] font-bold text-[#1A1530]">{done}/{total}</p>
                    </div>
                    <div className="h-2.5 bg-[#F7F6FF] rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: bgColor }}/>
                    </div>
                    <div className="flex justify-between mt-1.5">
                      <p className="text-[10px] text-[#9B97B2]">{pct}% selesai</p>
                      <p className="text-[10px] text-[#9B97B2]">{total - done} sesi tersisa</p>
                    </div>
                  </div>
                )}

                {/* Sesi hari ini */}
                <div className="px-4 py-3 border-b border-[#F0EFFF]">
                  {nextSesi ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-[#5C4FE5] animate-pulse"/>
                        <div>
                          <p className="text-[12px] font-bold text-[#3C3489]">Sesi hari ini</p>
                          <p className="text-[11px] text-[#7B78A8]">{formatWIT(nextSesi.scheduled_at)} WIT</p>
                        </div>
                      </div>
                      {(nextSesi.zoom_link || nextSesi.class_groups?.zoom_link) && (
                        <a href={nextSesi.zoom_link || nextSesi.class_groups?.zoom_link}
                          target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[11px] font-bold text-white bg-[#5C4FE5] px-3 py-1.5 rounded-xl">
                          ▶ Zoom
                        </a>
                      )}
                    </div>
                  ) : (
                    <p className="text-[12px] text-[#9B97B2] text-center py-1">Tidak ada sesi hari ini</p>
                  )}
                </div>

                {/* Laporan terakhir */}
                {laporan ? (
                  <div className="px-4 py-3">
                    <p className="text-[10px] font-bold text-[#9B97B2] uppercase tracking-wide mb-1.5">Laporan terakhir tutor</p>
                    <p className="text-[12px] font-semibold text-[#1A1530] truncate">{laporan.materi ?? '—'}</p>
                    {laporan.perkembangan && (
                      <p className="text-[11px] text-[#9B97B2] truncate mt-0.5">{laporan.perkembangan}</p>
                    )}
                  </div>
                ) : (
                  <div className="px-4 py-3">
                    <p className="text-[12px] text-[#9B97B2] text-center">Belum ada laporan</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* ── AKSI CEPAT ── */}
        <p className="text-[11px] font-bold text-[#9B97B2] uppercase tracking-widest mb-3">Aksi Cepat</p>
        <div className="grid grid-cols-4 gap-2 mb-5">
          {[
            { label: 'Jadwal',  href: '/siswa/jadwal',  bg: '#EEEDFE', iconColor: '#5C4FE5',
              icon: 'M8 2v3M16 2v3M3 8h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z' },
            { label: 'Laporan', href: '/siswa/laporan', bg: '#EAF3DE', iconColor: '#3B6D11',
              icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8' },
            { label: 'Materi',  href: '/siswa/materi',  bg: '#FAEEDA', iconColor: '#854F0B',
              icon: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z' },
            { label: 'Profil',  href: '/siswa/profil',  bg: '#FBEAF0', iconColor: '#993556',
              icon: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z' },
          ].map(qa => (
            <Link key={qa.href} href={qa.href}
              className="bg-white border border-[#E5E3FF] rounded-2xl p-3 flex flex-col items-center gap-2">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: qa.bg }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={qa.iconColor} strokeWidth="2" strokeLinecap="round">
                  <path d={qa.icon}/>
                </svg>
              </div>
              <p className="text-[11px] text-[#7B78A8] font-medium">{qa.label}</p>
            </Link>
          ))}
        </div>

        {/* ── FEED AKTIVITAS GABUNGAN ── */}
        {allLaporan.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-bold text-[#9B97B2] uppercase tracking-widest">Aktivitas Terbaru</p>
              <Link href="/siswa/laporan" className="text-[11px] font-semibold text-[#5C4FE5]">Lihat Semua ›</Link>
            </div>
            <div className="bg-white border border-[#E5E3FF] rounded-2xl overflow-hidden">
              {allLaporan.map((l: any, i: number) => {
                const cg    = l.sessions?.class_groups
                const course = cg?.courses
                const tutor  = cg?.profiles
                return (
                  <div key={`${l.id}-${i}`}
                    className={`flex items-start gap-3 px-4 py-3.5 ${i < allLaporan.length - 1 ? 'border-b border-[#F0EFFF]' : ''}`}>
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-bold text-white flex-shrink-0"
                      style={{ background: l.childColor }}>
                      {l.childAv}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <p className="text-[13px] font-bold text-[#1A1530]">{l.childName}</p>
                        <p className="text-[10px] text-[#9B97B2] flex-shrink-0">
                          {new Date(l.created_at).toLocaleDateString('id-ID', { timeZone: 'Asia/Jayapura', day: 'numeric', month: 'short' })}
                        </p>
                      </div>
                      <p className="text-[11px] text-[#9B97B2] mb-1">{course?.name ?? '—'} · {tutor?.full_name ?? '—'}</p>
                      <p className="text-[12px] text-[#4A4580] truncate">{l.materi ?? '—'}</p>
                      {l.perkembangan && (
                        <p className="text-[11px] text-[#9B97B2] truncate mt-0.5 italic">"{l.perkembangan}"</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
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
