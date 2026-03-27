import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import OrtuAnakJadwalHariIni from './OrtuAnakJadwalHariIni'

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

export default async function OrtuAnakPage({ params }: { params: Promise<{ slug: string }> }) {
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

  const { slug } = await params

  // Lookup studentId dari slug + verifikasi milik ortu ini
  const { data: slugRow } = await supabase
    .from('students')
    .select('id')
    .eq('slug', slug)
    .eq('parent_profile_id', session.user.id)
    .single()

  const studentId = slugRow?.id ?? null
  if (!studentId) redirect('/ortu/dashboard')

  const { data: student } = await supabase
    .from('students')
    .select(`id, grade, school, relation_role,
      profiles!students_profile_id_fkey(full_name)`)
    .eq('id', studentId)
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
  const { data: tutorRows } = tutorIds.length > 0
    ? await supabase.from('tutors').select('id, profile_id').in('id', tutorIds)
    : { data: [] }

  const tutorProfileIds = [...new Set((tutorRows ?? []).map((t: any) => t.profile_id).filter(Boolean))]
  const { data: tutors } = tutorProfileIds.length > 0
    ? await supabase.from('profiles').select('id, full_name').in('id', tutorProfileIds)
    : { data: [] }

  // Map tutorId (tutors.id) → full_name
  const tutorNameMap: Record<string, string> = {}
  ;(tutorRows ?? []).forEach((t: any) => {
    const prof = (tutors ?? []).find((p: any) => p.id === t.profile_id)
    if (prof) tutorNameMap[t.id] = prof.full_name
  })

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
        .select('session_id, materi, perkembangan, saran_ortu, recording_url')
        .eq('student_id', studentId)
        .in('session_id', completedIds)
    : { data: [] }

  // Materi live_zoom dari tabel materials (untuk review materi)
  const { data: materiLiveZoom } = cgIds.length > 0
    ? await supabase
        .from('materials')
        .select('id, title, url, class_group_id, created_at, sessions(id, scheduled_at, status)')
        .eq('type', 'live_zoom')
        .eq('is_published', true)
        .in('class_group_id', cgIds)
        .order('created_at', { ascending: false })
        .limit(10)
    : { data: [] }

  // Susun review materi — gabungan recording_url dari laporan + materials live_zoom
  const reviewItems: Array<{
    id: string
    title: string
    url: string
    date: string
    source: 'recording' | 'materi'
    classLabel: string
  }> = []

  // Dari session_reports.recording_url
  ;(reports ?? [])
    .filter((r: any) => r.recording_url)
    .forEach((r: any) => {
      const sesi = (completedSessions ?? []).find((s: any) => s.id === r.session_id)
      const cg   = (classGroups ?? []).find((c: any) => c.id === sesi?.class_group_id)
      reviewItems.push({
        id:         r.session_id,
        title:      r.materi ? `Rekaman · ${r.materi}` : 'Rekaman Sesi',
        url:        r.recording_url,
        date:       sesi?.scheduled_at ?? '',
        source:     'recording',
        classLabel: cg?.label ?? '—',
      })
    })

  // Dari materials live_zoom
  ;(materiLiveZoom ?? [])
    .filter((m: any) => m.url)
    .forEach((m: any) => {
      const cg = (classGroups ?? []).find((c: any) => c.id === m.class_group_id)
      // Hindari duplikat kalau sudah ada di recording
      const alreadyIn = reviewItems.some(r => r.url === m.url)
      if (!alreadyIn) {
        reviewItems.push({
          id:         m.id,
          title:      m.title,
          url:        m.url,
          date:       m.created_at,
          source:     'materi',
          classLabel: cg?.label ?? '—',
        })
      }
    })

  // Sort by date descending
  reviewItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

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

      {/* ── JADWAL HARI INI - WITH COUNTDOWN ── */}
      <OrtuAnakJadwalHariIni
        todaySessions={todaySessions}
        nextSession={nextSession}
        studentId={studentId}
        classGroups={classGroups ?? []}
        tutors={tutors ?? []}
        tutorRows={tutorRows ?? []}
      />

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
            const tutorName = cg ? (tutorNameMap[cg.tutor_id] ?? '—') : '—'
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
                    <p className="text-[10px] text-stone-400">{tutorName}</p>
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

      {/* ── REVIEW MATERI ── */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#5C4FE5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>
            </svg>
            <p className="text-[12px] font-bold text-stone-700">Review Materi Sebelumnya</p>
          </div>
          <Link href={`/ortu/anak/${studentId}/materi`}
            className="text-[11px] text-[#5C4FE5] hover:underline">
            Lihat semua →
          </Link>
        </div>
        {reviewItems.length > 0 ? (
          <div className="flex flex-col gap-2">
            {reviewItems.slice(0, 4).map(item => (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white border border-stone-100 rounded-xl overflow-hidden flex items-center gap-3 px-3 py-2.5 hover:border-[#CECBF6] transition-colors group"
                style={{ borderLeft: '3px solid #5C4FE5' }}>
                {/* Icon */}
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    background: item.source === 'recording' ? '#FEE2E2' : '#EEEDFE',
                  }}>
                  {item.source === 'recording' ? (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="7" stroke="#DC2626" strokeWidth="1.2"/>
                      <path d="M6.5 5.5l4 2.5-4 2.5V5.5z" fill="#DC2626"/>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <rect x="1" y="2" width="14" height="12" rx="2" stroke="#5C4FE5" strokeWidth="1.2"/>
                      <path d="M6 6l4 2-4 2V6z" fill="#5C4FE5"/>
                    </svg>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-stone-700 truncate group-hover:text-[#5C4FE5] transition-colors">
                    {item.title}
                  </p>
                  <p className="text-[10px] text-stone-400 mt-0.5">
                    {item.classLabel}
                    {item.date && ` · ${fmtDate(item.date)}`}
                  </p>
                </div>

                {/* Arrow */}
                <div className="flex-shrink-0">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M5 3l4 4-4 4" stroke="#9CA3AF" strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div className="bg-white border border-stone-100 rounded-xl px-4 py-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: '#EEEDFE' }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="2" width="14" height="12" rx="2" stroke="#5C4FE5" strokeWidth="1.2"/>
                <path d="M6 6l4 2-4 2V6z" fill="#5C4FE5"/>
              </svg>
            </div>
            <div>
              <p className="text-[12px] font-semibold text-stone-500">Belum ada rekaman tersedia</p>
              <p className="text-[10px] text-stone-400 mt-0.5">
                Rekaman akan muncul setelah tutor menginput link di laporan sesi
              </p>
            </div>
          </div>
        )}
      </div>

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
