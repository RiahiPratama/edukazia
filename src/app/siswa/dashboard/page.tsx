import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getActiveChild, getEnrollmentStatus, formatWIT, formatDateWIT } from '@/lib/siswa/helpers'

export const metadata = { title: 'Dashboard · EduKazia' }

export default async function DashboardPage() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', session.user.id)
    .single()

  if (!profile || !['student', 'parent'].includes(profile.role)) redirect('/login')

  const isParent = profile.role === 'parent'

  // ── Step 1: Ambil data siswa ──
  const { data: childrenList } = await supabase
    .from('students')
    .select(`
      id, grade, school, status, relation_role,
      profile:profiles!students_profile_id_fkey(id, full_name, avatar_url)
    `)
    .eq(isParent ? 'parent_profile_id' : 'profile_id', session.user.id)

  // FIX: flatten profile array dari Supabase join → single object
  const activeChild = getActiveChild(
    (childrenList ?? []).map((c: any) => ({
      ...c,
      enrollments: [],
      profile: Array.isArray(c.profile) ? c.profile[0] ?? null : c.profile,
    }))
  )

  if (!activeChild) {
    return (
      <div className="px-4 pt-6 text-center">
        <p className="text-sm text-[#9B97B2]">Tidak ada data siswa ditemukan.</p>
      </div>
    )
  }

  // ── Step 2: Ambil enrollments siswa secara terpisah ──
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('id, status, end_date, expired_at, status_override, sessions_total, session_start_offset, class_group_id')
    .eq('student_id', activeChild.id)

  const activeEnrollments = (enrollments ?? []).filter(
    (e: any) => getEnrollmentStatus(e) === 'active'
  )
  const isExpired = (enrollments ?? []).length > 0 &&
    (enrollments ?? []).every((e: any) => getEnrollmentStatus(e) === 'expired')

  const classGroupIds = activeEnrollments
    .map((e: any) => e.class_group_id)
    .filter(Boolean)

  // ── Step 2b: Ambil class_groups terpisah ──
  const { data: classGroups } = classGroupIds.length > 0
    ? await supabase
        .from('class_groups')
        .select('id, label, zoom_link, course_id')
        .in('id', classGroupIds)
    : { data: [] }

  // ── Step 2c: Ambil courses terpisah ──
  const courseIds = (classGroups ?? []).map((cg: any) => cg.course_id).filter(Boolean)
  const { data: coursesData } = courseIds.length > 0
    ? await supabase
        .from('courses')
        .select('id, name, color')
        .in('id', courseIds)
    : { data: [] }

  // ── Step 2d: Ambil tutor dari class_groups ──
  const { data: tutorData } = classGroupIds.length > 0
    ? await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', (classGroups ?? []).map((cg: any) => cg.tutor_id).filter(Boolean))
    : { data: [] }

  // Map semua data untuk lookup cepat
  const courseMap: Record<string, any> = {}
  ;(coursesData ?? []).forEach((c: any) => { courseMap[c.id] = c })

  const cgMap: Record<string, any> = {}
  ;(classGroups ?? []).forEach((cg: any) => {
    cgMap[cg.id] = {
      ...cg,
      courses: courseMap[cg.course_id] ?? null,
    }
  })

  const activeEnrollmentsWithCG = activeEnrollments.map((e: any) => ({
    ...e,
    class_groups: cgMap[e.class_group_id] ?? null
  }))

  // ── Step 3: Jadwal hari ini (WIT) ──
  const nowWIT = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jayapura' }))
  const todayStart = new Date(nowWIT); todayStart.setHours(0, 0, 0, 0)
  const todayEnd   = new Date(nowWIT); todayEnd.setHours(23, 59, 59, 999)
  const toUTC = (d: Date) => new Date(d.getTime() - 9 * 60 * 60 * 1000).toISOString()

  const { data: todaySessions } = classGroupIds.length > 0
    ? await supabase
        .from('sessions')
        .select(`
          id, scheduled_at, status, zoom_link,
          class_groups(id, label, zoom_link,
            courses(id, name, color),
            profiles!class_groups_tutor_id_fkey(full_name)
          )
        `)
        .in('class_group_id', classGroupIds)
        .gte('scheduled_at', toUTC(todayStart))
        .lte('scheduled_at', toUTC(todayEnd))
        .order('scheduled_at')
    : { data: [] }

  // ── Step 4: Laporan terbaru ──
  const { data: laporanRaw } = await supabase
    .from('session_reports')
    .select('id, materi, perkembangan, created_at, session_id')
    .eq('student_id', activeChild.id)
    .order('created_at', { ascending: false })
    .limit(3)

  // Ambil sessions untuk laporan
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
    ? await supabase.from('courses').select('id, name, color').in('id', lapCourseIds)
    : { data: [] }

  const { data: lapTutors } = lapTutorIds.length > 0
    ? await supabase.from('profiles').select('id, full_name').in('id', lapTutorIds)
    : { data: [] }

  const lapCgMap: Record<string, any> = {}
  ;(lapCg ?? []).forEach((cg: any) => {
    lapCgMap[cg.id] = {
      courses: (lapCourses ?? []).find((c: any) => c.id === cg.course_id) ?? null,
      profiles: (lapTutors ?? []).find((p: any) => p.id === cg.tutor_id) ?? null,
    }
  })

  const lapSessionMap: Record<string, any> = {}
  ;(lapSessions ?? []).forEach((s: any) => {
    lapSessionMap[s.id] = { ...s, class_groups: lapCgMap[s.class_group_id] ?? null }
  })

  const laporanList = (laporanRaw ?? []).map((l: any) => ({
    ...l,
    sessions: lapSessionMap[l.session_id] ?? null
  }))

  // ── Step 5: Kehadiran bulan ini ──
  const startOfMonth = new Date(nowWIT.getFullYear(), nowWIT.getMonth(), 1)
  const { data: attendances } = await supabase
    .from('attendances')
    .select('status')
    .eq('student_id', activeChild.id)
    .gte('created_at', toUTC(startOfMonth))

  const totalAtt  = (attendances ?? []).length
  const hadirCount = (attendances ?? []).filter((a: any) => a.status === 'hadir').length
  const hadirPct  = totalAtt > 0 ? Math.round((hadirCount / totalAtt) * 100) : 0

  return (
    <div className="px-4 pt-4 pb-2">
      <div className="mb-4">
        <h2 className="text-[16px] font-bold text-[#1A1530]">Ringkasan Belajar</h2>
        <p className="text-[12px] text-[#9B97B2] mt-0.5">
          {formatDateWIT(new Date())} · WIT
        </p>
      </div>

      {/* ── STAT CARDS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="bg-white border border-[#E5E3FF] rounded-2xl p-4">
          <p className="text-[11px] text-[#9B97B2] mb-1">Sesi Hari Ini</p>
          <p className="text-[26px] font-bold text-[#5C4FE5] leading-none">
            {todaySessions?.length ?? 0}
          </p>
          <p className="text-[11px] text-[#9B97B2] mt-1">
            {todaySessions?.length === 0 ? 'tidak ada sesi' : 'sesi terjadwal'}
          </p>
        </div>
        <div className="bg-white border border-[#E5E3FF] rounded-2xl p-4">
          <p className="text-[11px] text-[#9B97B2] mb-1">Kehadiran Bulan Ini</p>
          <p className={`text-[26px] font-bold leading-none ${hadirPct >= 80 ? 'text-green-600' : hadirPct >= 60 ? 'text-yellow-600' : 'text-red-500'}`}>
            {totalAtt > 0 ? `${hadirPct}%` : '—'}
          </p>
          <p className="text-[11px] text-[#9B97B2] mt-1">
            {totalAtt > 0 ? `${hadirCount} dari ${totalAtt} hadir` : 'belum ada sesi'}
          </p>
        </div>
        <div className="bg-white border border-[#E5E3FF] rounded-2xl p-4">
          <p className="text-[11px] text-[#9B97B2] mb-1">Mata Pelajaran</p>
          <p className="text-[26px] font-bold text-[#5C4FE5] leading-none">
            {activeEnrollmentsWithCG.length}
          </p>
          <p className="text-[11px] text-[#9B97B2] mt-1">aktif saat ini</p>
        </div>
        <div className="bg-white border border-[#E5E3FF] rounded-2xl p-4">
          <p className="text-[11px] text-[#9B97B2] mb-1">Status Paket</p>
          <p className={`text-[14px] font-bold leading-none mt-1 ${isExpired ? 'text-red-500' : 'text-green-600'}`}>
            {isExpired ? 'Berakhir' : 'Aktif'}
          </p>
          <p className="text-[11px] text-[#9B97B2] mt-1">
            {isExpired ? 'hubungi admin' : `${activeEnrollmentsWithCG.length} enrollment`}
          </p>
        </div>
      </div>

      {/* ── JADWAL HARI INI ── */}
      <div className="bg-white border border-[#E5E3FF] rounded-2xl p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[13px] font-bold text-[#1A1530]">Jadwal Hari Ini</p>
          <Link href="/siswa/jadwal" className="text-[11px] font-semibold text-[#5C4FE5]">
            Lihat Semua ›
          </Link>
        </div>
        {!todaySessions || todaySessions.length === 0 ? (
          <div className="py-4 text-center">
            <p className="text-[12px] text-[#9B97B2]">Tidak ada sesi hari ini 🎉</p>
          </div>
        ) : (
          <div>
            {todaySessions.map((s: any, i: number) => {
              const cg      = s.class_groups
              const course  = cg?.courses
              const tutor   = cg?.profiles
              const witTime = formatWIT(s.scheduled_at)
              const zoomLink = s.zoom_link || cg?.zoom_link
              const sesiTime = new Date(s.scheduled_at)
              const sesiEnd  = new Date(sesiTime.getTime() + 90 * 60 * 1000)
              const isNow    = nowWIT >= sesiTime && nowWIT <= sesiEnd
              const isPast   = nowWIT > sesiEnd
              const statusLabel = isNow ? 'Sekarang' : isPast ? 'Selesai' : 'Nanti'
              const statusCls   = isNow
                ? 'bg-[#EAE8FD] text-[#5C4FE5]'
                : isPast ? 'bg-gray-100 text-gray-500'
                : 'bg-[#FFF8D6] text-[#8A6D00]'
              return (
                <div key={s.id} className={`flex items-start gap-3 py-3 ${i < todaySessions.length - 1 ? 'border-b border-[#E5E3FF]' : ''}`}>
                  <div className="text-center min-w-[42px]">
                    <p className="text-[14px] font-bold text-[#1A1530] leading-none">{witTime}</p>
                    <p className="text-[10px] text-[#9B97B2]">WIT</p>
                  </div>
                  <div className="w-px self-stretch bg-[#E5E3FF]" />
                  <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: course?.color ?? '#5C4FE5' }} />
                  <div className="flex-1">
                    <p className="text-[13px] font-bold text-[#1A1530]">{course?.name ?? cg?.label}</p>
                    <p className="text-[11px] text-[#9B97B2]">{tutor?.full_name ?? '—'} · {zoomLink ? 'Online' : 'Offline'}</p>
                    {zoomLink && !isPast && (
                      <a href={zoomLink} target="_blank" rel="noopener noreferrer"
                        className="text-[11px] text-[#5C4FE5] font-semibold mt-1 inline-flex items-center gap-1">
                        ▶ Buka Zoom
                      </a>
                    )}
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg flex-shrink-0 ${statusCls}`}>
                    {statusLabel}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── PROGRESS SESI ── */}
      {activeEnrollmentsWithCG.length > 0 && (
        <div className="bg-white border border-[#E5E3FF] rounded-2xl p-4 mb-4">
          <p className="text-[13px] font-bold text-[#1A1530] mb-3">Progress Sesi</p>
          <div className="space-y-3">
            {activeEnrollmentsWithCG.map((e: any) => {
              const cg     = e.class_groups
              const course = cg?.courses
              const total  = e.sessions_total ?? 0
              const done   = e.session_start_offset ?? 0
              const pct   = total > 0 ? Math.round((done / total) * 100) : 0
              const color = course?.color ?? '#5C4FE5'
              return (
                <div key={e.id}>
                  <div className="flex justify-between mb-1.5">
                    <p className="text-[12px] font-semibold text-[#1A1530]">{course?.name ?? cg?.label ?? '—'}</p>
                    <p className="text-[11px] text-[#9B97B2]">{done}/{total}</p>
                  </div>
                  <div className="h-2 bg-[#F7F6FF] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── LAPORAN TERBARU ── */}
      <div className="bg-white border border-[#E5E3FF] rounded-2xl p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[13px] font-bold text-[#1A1530]">Laporan Terbaru dari Tutor</p>
          <Link href="/siswa/laporan" className="text-[11px] font-semibold text-[#5C4FE5]">
            Lihat Semua ›
          </Link>
        </div>
        {!laporanList || laporanList.length === 0 ? (
          <div className="py-4 text-center">
            <p className="text-[12px] text-[#9B97B2]">Belum ada laporan dari tutor.</p>
          </div>
        ) : (
          <div>
            {laporanList.map((l: any, i: number) => {
              const cg     = (l.sessions as any)?.class_groups
              const course = cg?.courses
              const tutor  = cg?.profiles
              const color  = course?.color ?? '#5C4FE5'
              const perkembangan = l.perkembangan?.toLowerCase() ?? ''
              const isGood = perkembangan.includes('baik') || perkembangan.includes('bagus')
              const isNeed = perkembangan.includes('perlu') || perkembangan.includes('kurang')
              const tagCls = isGood ? 'bg-green-50 text-green-700' : isNeed ? 'bg-yellow-50 text-yellow-700' : 'bg-[#EAE8FD] text-[#5C4FE5]'
              const tagLabel = isGood ? '✓ Baik' : isNeed ? '▶ Perlu Latihan' : '• Cukup'
              return (
                <div key={l.id} className={`py-3 ${i < laporanList.length - 1 ? 'border-b border-[#E5E3FF]' : ''}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
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
