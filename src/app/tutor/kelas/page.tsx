import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BookOpen, Users, Clock } from 'lucide-react'

export default async function TutorKelasPage() {
  const supabase = await createClient()

  // ── Auth ──
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // ── Ambil tutor_id ──
  const { data: tutor } = await supabase
    .from('tutors')
    .select('id')
    .eq('profile_id', user.id)
    .single()

  const tutorId = tutor?.id

  // ── Ambil semua kelas milik tutor ──
  const { data: kelasList } = await supabase
    .from('class_groups')
    .select(`
      id, label, status, max_participants, zoom_link,
      courses(name, color),
      class_types(name),
      enrollments(
        id, session_start_offset, sessions_total,
        students(
          id,
          profiles(full_name)
        )
      ),
      sessions(id, scheduled_at, status)
    `)
    .eq('tutor_id', tutorId)
    .order('created_at', { ascending: false })

  // ── Helper ──
  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Makassar'
    })
  }
  function fmtTime(iso: string) {
    return new Date(iso).toLocaleTimeString('id-ID', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Makassar'
    })
  }
  function getInitials(name: string) {
    return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
  }

  const AVATAR_COLORS = ['#5C4FE5', '#27A05A', '#D97706', '#DC2626', '#0891B2', '#7C3AED', '#BE185D']

  const statusLabel: Record<string, string> = {
    active: 'Aktif', inactive: 'Nonaktif', completed: 'Selesai'
  }
  const statusColor: Record<string, string> = {
    active:    'bg-green-100 text-green-700',
    inactive:  'bg-gray-100 text-gray-500',
    completed: 'bg-blue-100 text-blue-700',
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-[#1A1640] font-['Sora']">Kelas & Siswa</h1>
        <p className="text-sm text-[#7B78A8] mt-1">Daftar kelas yang kamu ampu</p>
      </div>

      {/* Kosong */}
      {!kelasList || kelasList.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E5E3FF] p-12 text-center">
          <div className="flex justify-center mb-3">
            <BookOpen size={36} strokeWidth={1.5} className="text-[#C4BFFF]"/>
          </div>
          <p className="text-sm font-semibold text-[#7B78A8]">Belum ada kelas yang diampu</p>
          <p className="text-xs text-[#7B78A8] mt-1">Kelas akan muncul setelah admin menugaskan kamu</p>
        </div>
      ) : (
        <div className="space-y-5">
          {kelasList.map((k: any) => {
            const enrollments   = k.enrollments ?? []
            const activeEnroll  = enrollments.length
            const isFull        = activeEnroll >= k.max_participants

            // Sesi berikutnya
            const now = new Date()
            const upcoming = (k.sessions ?? [])
              .filter((s: any) => s.status === 'scheduled' && new Date(s.scheduled_at) > now)
              .sort((a: any, b: any) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
            const nextSesi = upcoming[0] ?? null

            // Sesi selesai
            const completedSesi = (k.sessions ?? []).filter((s: any) => s.status === 'completed').length
            const totalSesi     = (k.sessions ?? []).length

            return (
              <div key={k.id} className="bg-white rounded-2xl border border-[#E5E3FF] overflow-hidden">

                {/* Header kelas */}
                <div className="px-5 py-4 border-b border-[#F0EFFF]" style={{ borderLeft: `4px solid ${k.courses?.color ?? '#5C4FE5'}` }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-base font-black text-[#1A1640]">{k.label}</h2>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColor[k.status] ?? 'bg-gray-100 text-gray-500'}`}>
                          {statusLabel[k.status] ?? k.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="text-xs text-[#7B78A8]">{k.courses?.name ?? '—'}</span>
                        <span className="text-xs text-[#7B78A8]">·</span>
                        <span className="text-xs text-[#7B78A8]">{k.class_types?.name ?? '—'}</span>
                      </div>
                    </div>

                    {/* Zoom */}
                    {k.zoom_link && (
                      <a
                        href={k.zoom_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-50 text-blue-700 rounded-xl font-semibold hover:bg-blue-100 transition"
                      >
                        Buka Zoom
                      </a>
                    )}
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center gap-4 mt-3 flex-wrap">
                    {/* Peserta */}
                    <div className="flex items-center gap-1.5">
                      <Users size={13} className="text-[#7B78A8]"/>
                      <span className={`text-xs font-bold ${isFull ? 'text-red-600' : 'text-[#4A4580]'}`}>
                        {activeEnroll}/{k.max_participants} siswa
                      </span>
                    </div>

                    {/* Sesi */}
                    <div className="flex items-center gap-1.5">
                      <Clock size={13} className="text-[#7B78A8]"/>
                      <span className="text-xs font-bold text-[#4A4580]">
                        {completedSesi}/{totalSesi} sesi selesai
                      </span>
                    </div>

                    {/* Sesi berikutnya */}
                    {nextSesi && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#EEEDFE] rounded-lg">
                        <span className="text-[10px] font-bold text-[#5C4FE5]">
                          Berikutnya: {fmtDate(nextSesi.scheduled_at)} · {fmtTime(nextSesi.scheduled_at)} WITA
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3 w-full h-1.5 bg-[#E5E3FF] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#5C4FE5] transition-all"
                      style={{ width: `${totalSesi > 0 ? Math.min((completedSesi / totalSesi) * 100, 100) : 0}%` }}
                    />
                  </div>
                </div>

                {/* Daftar siswa */}
                <div className="px-5 py-4">
                  <p className="text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-3">
                    Siswa ({activeEnroll})
                  </p>

                  {enrollments.length === 0 ? (
                    <p className="text-xs text-[#7B78A8]">Belum ada siswa terdaftar</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {enrollments.map((e: any, idx: number) => {
                        const nama          = e.students?.profiles?.full_name ?? 'Siswa'
                        const avatarColor   = AVATAR_COLORS[idx % AVATAR_COLORS.length]
                        const sessionOffset = e.session_start_offset ?? 1
                        const sessionTotal  = e.sessions_total ?? 8

                        return (
                          <div key={e.id} className="flex items-center gap-3 p-3 rounded-xl border border-[#F0EFFF] hover:bg-[#F7F6FF] transition">
                            {/* Avatar */}
                            <div
                              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                              style={{ background: avatarColor }}
                            >
                              {getInitials(nama)}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-[#1A1640] truncate">{nama}</div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <div className="flex-1 h-1 bg-[#E5E3FF] rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-[#5C4FE5]"
                                    style={{ width: `${Math.min((sessionOffset / sessionTotal) * 100, 100)}%` }}
                                  />
                                </div>
                                <span className="text-[10px] font-bold text-[#5C4FE5] flex-shrink-0">
                                  {sessionOffset}/{sessionTotal}
                                </span>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
