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

  // Verifikasi bahwa siswa ini memang milik ortu yang login
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

  // Sessions + attendances
  const nowWIT = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jayapura' }))
  const plus14 = new Date(nowWIT); plus14.setDate(plus14.getDate() + 14)
  const toUTC  = (d: Date) => new Date(d.getTime() - 9 * 60 * 60 * 1000).toISOString()

  const { data: sessions } = cgIds.length > 0
    ? await supabase
        .from('sessions')
        .select('id, class_group_id, scheduled_at, status, zoom_link')
        .in('class_group_id', cgIds)
        .order('scheduled_at', { ascending: false })
        .limit(30)
    : { data: [] }

  const sessionIds = (sessions ?? []).map((s: any) => s.id)
  const { data: attendances } = sessionIds.length > 0
    ? await supabase
        .from('attendances')
        .select('session_id, status')
        .eq('student_id', studentId)
        .in('session_id', sessionIds)
    : { data: [] }

  // Reports
  const completedIds = (sessions ?? []).filter((s: any) => s.status === 'completed').map((s: any) => s.id)
  const { data: reports } = completedIds.length > 0
    ? await supabase
        .from('session_reports')
        .select('session_id, materi, perkembangan, saran_ortu')
        .eq('student_id', studentId)
        .in('session_id', completedIds)
    : { data: [] }

  // Hitung kehadiran
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
      {/* Back */}
      <Link href="/ortu/dashboard"
        className="inline-flex items-center gap-1 text-[11px] text-stone-400 hover:text-stone-600 mb-4">
        ← Kembali
      </Link>

      {/* Hero profil anak */}
      <div className="bg-white border border-stone-100 rounded-2xl p-4 mb-5"
        style={{ borderTop: '3px solid #E6B800' }}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
            style={{ background: '#E6B800', color: '#412402' }}>
            {initials(studentName)}
          </div>
          <div>
            <p className="text-[15px] font-bold text-stone-800">{studentName}</p>
            <p className="text-[11px] text-stone-400">
              {student.grade ?? '—'}
              {student.school ? ` · ${student.school}` : ''}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-stone-50 rounded-xl px-3 py-2 text-center">
            <p className="text-[16px] font-bold text-stone-700">{(enrollments ?? []).filter((e: any) => e.status === 'active').length}</p>
            <p className="text-[10px] text-stone-400">Kelas aktif</p>
          </div>
          <div className="bg-stone-50 rounded-xl px-3 py-2 text-center">
            <p className={`text-[16px] font-bold ${hadirPct >= 80 ? 'text-green-600' : hadirPct >= 60 ? 'text-amber-600' : 'text-red-500'}`}>
              {hadirPct}%
            </p>
            <p className="text-[10px] text-stone-400">Kehadiran</p>
          </div>
          <div className="bg-stone-50 rounded-xl px-3 py-2 text-center">
            <p className="text-[16px] font-bold text-stone-700">{(reports ?? []).length}</p>
            <p className="text-[10px] text-stone-400">Laporan</p>
          </div>
        </div>
      </div>

      {/* Kelas aktif */}
      <p className="text-[12px] font-bold text-stone-700 mb-2">Kelas aktif</p>
      {(enrollments ?? []).map((e: any) => {
        const cg    = (classGroups ?? []).find((c: any) => c.id === e.class_group_id)
        const tutor = (tutors ?? []).find((t: any) => t.id === cg?.tutor_id)
        const cgSessions = (sessions ?? []).filter((s: any) => s.class_group_id === e.class_group_id && s.status === 'completed')
        const hadirInCG  = cgSessions.filter(s => (attendances ?? []).find((a: any) => a.session_id === s.id && a.status === 'hadir')).length
        const progress   = (e.session_start_offset ?? 0) + hadirInCG
        const total      = e.sessions_total ?? 8
        const isPaid     = true

        return (
          <div key={e.id} className="bg-white border border-stone-100 rounded-xl overflow-hidden mb-2">
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-stone-50">
              <div>
                <p className="text-[12px] font-semibold text-stone-700">{cg?.label ?? '—'}</p>
                <p className="text-[10px] text-stone-400">{tutor?.full_name ?? '—'}</p>
              </div>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                isPaid ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'
              }`}>
                {isPaid ? 'Aktif' : 'Terkunci'}
              </span>
            </div>
            {isPaid && (
              <div className="px-3 py-2">
                <div className="flex justify-between mb-1">
                  <p className="text-[10px] text-stone-400">Progress</p>
                  <p className="text-[10px] font-semibold text-stone-600">{progress}/{total} sesi</p>
                </div>
                <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-amber-400 transition-all"
                    style={{ width: `${Math.min(100, Math.round(progress / total * 100))}%` }} />
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* Laporan terbaru */}
      {(reports ?? []).length > 0 && (
        <>
          <p className="text-[12px] font-bold text-stone-700 mt-4 mb-2">Laporan terbaru</p>
          {(sessions ?? [])
            .filter(s => s.status === 'completed' && (reports ?? []).find((r: any) => r.session_id === s.id))
            .slice(0, 5)
            .map(s => {
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
                      <div className="px-2.5 py-2 rounded-lg bg-amber-50 border-l-2 border-amber-400 mt-1.5">
                        <p className="text-[9px] font-bold text-amber-700 uppercase tracking-wider mb-1">Catatan untuk Orang Tua</p>
                        <p className="text-[11px] text-amber-800">{rep.saran_ortu}</p>
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
