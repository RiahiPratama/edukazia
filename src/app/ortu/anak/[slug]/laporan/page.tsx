import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import BilingualReport from '@/components/shared/BilingualReport'

export const dynamic = 'force-dynamic'

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jayapura',
  })
}

const attBadge: Record<string, string> = {
  hadir: 'bg-green-50 text-green-700 border-green-200',
  izin:  'bg-blue-50 text-blue-700 border-blue-200',
  sakit: 'bg-amber-50 text-amber-700 border-amber-200',
  alpha: 'bg-red-50 text-red-600 border-red-200',
}
const attLabel: Record<string, string> = {
  hadir: 'Hadir', izin: 'Izin', sakit: 'Sakit', alpha: 'Alpha',
}

export default async function OrtuAnakLaporanPage({ params }: { params: Promise<{ slug: string }> }) {
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
    .select(`id, grade, profiles!students_profile_id_fkey(full_name)`)
    .eq('id', studentId)
    .single()

  if (!student) redirect('/ortu/dashboard')

  const studentName = (Array.isArray(student.profiles) ? student.profiles[0] : student.profiles)?.full_name ?? '(Tanpa nama)'

  // Sessions completed
  const { data: enrollments } = await supabase
    .from('enrollments').select('class_group_id').eq('student_id', studentId)

  const cgIds = [...new Set((enrollments ?? []).map((e: any) => e.class_group_id).filter(Boolean))]

  const { data: sessions } = cgIds.length > 0
    ? await supabase
        .from('sessions')
        .select('id, class_group_id, scheduled_at')
        .in('class_group_id', cgIds)
        .eq('status', 'completed')
        .order('scheduled_at', { ascending: false })
        .limit(50)
    : { data: [] }

  const sessionIds = (sessions ?? []).map((s: any) => s.id)

  // ⚠️ Untuk view anak: tampilkan saran_siswa bukan saran_ortu
  // saran_ortu TIDAK ditampilkan di sini — hanya di /ortu/laporan
  const { data: reports } = sessionIds.length > 0
    ? await supabase
        .from('session_reports')
        .select('session_id, materi, perkembangan, saran_siswa, recording_url, created_at')
        .eq('student_id', studentId)
        .in('session_id', sessionIds)
        .order('created_at', { ascending: false })
    : { data: [] }

  const { data: attendances } = sessionIds.length > 0
    ? await supabase
        .from('attendances')
        .select('session_id, status')
        .eq('student_id', studentId)
        .in('session_id', sessionIds)
    : { data: [] }

  const { data: classGroups } = cgIds.length > 0
    ? await supabase.from('class_groups').select('id, label, tutor_id').in('id', cgIds)
    : { data: [] }

  const tutorIds = [...new Set((classGroups ?? []).map((cg: any) => cg.tutor_id).filter(Boolean))]
  const { data: tutors } = tutorIds.length > 0
    ? await supabase.from('profiles').select('id, full_name').in('id', tutorIds)
    : { data: [] }

  const reportList = (reports ?? []).map((r: any) => {
    const sesi  = (sessions ?? []).find((s: any) => s.id === r.session_id)
    const cg    = (classGroups ?? []).find((c: any) => c.id === sesi?.class_group_id)
    const tutor = (tutors ?? []).find((t: any) => t.id === cg?.tutor_id)
    const att   = (attendances ?? []).find((a: any) => a.session_id === r.session_id)
    return {
      sessionId:   r.session_id,
      scheduledAt: sesi?.scheduled_at ?? r.created_at,
      classLabel:  cg?.label   ?? '—',
      tutorName:   tutor?.full_name ?? '—',
      materi:      r.materi,
      perkembangan: r.perkembangan,
      saranSiswa:  r.saran_siswa,
      recordingUrl: r.recording_url ?? null,
      attendance:  att?.status ?? null,
    }
  })

  return (
    <div className="px-4 lg:px-6 py-5 max-w-xl">
      <div className="mb-4">
        <h2 className="text-[15px] font-bold text-stone-800">Laporan Belajar</h2>
        <p className="text-[11px] text-stone-400 mt-0.5">{studentName} · catatan dari tutor</p>
      </div>

      {reportList.length === 0 ? (
        <div className="bg-white border border-stone-100 rounded-2xl py-12 text-center">
          <p className="text-[12px] text-stone-400">Belum ada laporan dari tutor</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {reportList.map((rep, idx) => (
            <div key={rep.sessionId} className="bg-white border border-stone-100 rounded-xl overflow-hidden"
              style={{ borderLeft: '3px solid #5C4FE5' }}>
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-stone-50">
                <div>
                  <p className="text-[12px] font-semibold text-stone-700">{rep.classLabel}</p>
                  <p className="text-[10px] text-stone-400">{fmtDate(rep.scheduledAt)} · {rep.tutorName}</p>
                </div>
                {rep.attendance && (
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                    attBadge[rep.attendance] ?? 'bg-stone-50 text-stone-500 border-stone-200'
                  }`}>
                    {attLabel[rep.attendance] ?? rep.attendance}
                  </span>
                )}
              </div>

              <div className="px-3 py-2.5">
                <BilingualReport
                  laporan={{
                    materi:       rep.materi,
                    perkembangan: rep.perkembangan,
                    saranSiswa:   rep.saranSiswa,
                    saranOrtu:    null,
                    recordingUrl: rep.recordingUrl,
                  }}
                  audience="siswa"
                  sessionLabel={fmtDate(rep.scheduledAt)}
                  studentName={studentName}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
