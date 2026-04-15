import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SesiHariIniClient from './SesiHariIniClient'
import AnnouncementFetcher from '@/components/AnnouncementFetcher'
import { CalendarDays, BookOpen, Users, Coins, ClipboardList, FileText, AlertTriangle } from 'lucide-react'

function fmtTanggal() {
  return new Date().toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'Asia/Jayapura',
  })
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('id-ID', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jayapura',
  })
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Jayapura',
  })
}

export default async function TutorDashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('id, full_name').eq('id', user.id).single()

  const { data: tutor } = await supabase
    .from('tutors').select('id').eq('profile_id', user.id).single()

  if (!tutor) redirect('/login')
  const tutorId = tutor.id

  // Kelas aktif
  const { data: kelasAktif } = await supabase
    .from('class_groups')
    .select('id, enrollments(id, status)')
    .eq('tutor_id', tutorId)
    .eq('status', 'active')

  const totalKelas = kelasAktif?.length ?? 0
  const totalSiswa = (kelasAktif ?? []).reduce((acc, k) =>
    acc + (k.enrollments?.filter((e: any) => e.status === 'active').length ?? 0), 0)

  const todayWITStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jayapura' })
  const [y, m, d]   = todayWITStr.split('-').map(Number)
  const rawDay      = new Date(Date.UTC(y, m - 1, d, 3, 0, 0)).getUTCDay()
  const dayOfWeek   = rawDay === 0 ? 6 : rawDay - 1
  const monday      = new Date(Date.UTC(y, m - 1, d - dayOfWeek, 0, 0, 0))
  const sunday      = new Date(Date.UTC(y, m - 1, d - dayOfWeek + 6, 23, 59, 59))

  const cgIds = (kelasAktif ?? []).map(k => k.id)
  const { count: sesiMingguIni } = cgIds.length > 0
    ? await supabase.from('sessions')
        .select('*', { count: 'exact', head: true })
        .in('class_group_id', cgIds)
        .gte('scheduled_at', new Date(monday.getTime() - 9 * 3600000).toISOString())
        .lte('scheduled_at', new Date(sunday.getTime() - 9 * 3600000).toISOString())
    : { count: 0 }

  // Honor bulan ini
  const firstOfMonth = new Date(todayWITStr.slice(0, 7) + '-01T00:00:00+09:00').toISOString()
  const { data: honorBulanIni } = await supabase
    .from('tutor_payments')
    .select('total')
    .eq('tutor_id', tutorId)
    .gte('created_at', firstOfMonth)
    .eq('status', 'paid')
  const totalHonor = (honorBulanIni ?? []).reduce((a, h) => a + h.total, 0)

  function formatRp(n: number) {
    if (n === 0) return 'Rp 0'
    if (n >= 1000000) return `Rp ${(n / 1000000).toFixed(1).replace('.0', '')} jt`
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
  }

  // Sesi hari ini WIT
  const startUtc = `${todayWITStr}T00:00:00+09:00`
  const endUtc   = `${todayWITStr}T23:59:59+09:00`

  const { data: sesiHariIni } = cgIds.length > 0
    ? await supabase.from('sessions')
        .select(`id, scheduled_at, status, zoom_link,
          class_groups(id, label, courses(name), class_types(name))`)
        .in('class_group_id', cgIds)
        .gte('scheduled_at', startUtc)
        .lte('scheduled_at', endUtc)
        .order('scheduled_at')
    : { data: [] }

  // Sesi besok WIT
  const tomorrowObj = new Date(todayWITStr + 'T00:00:00+09:00')
  tomorrowObj.setDate(tomorrowObj.getDate() + 1)
  const tomorrowDate  = tomorrowObj.toLocaleDateString('en-CA')
  const tomorrowStart = `${todayWITStr}T15:00:00+00:00`
  const tomorrowEnd   = `${tomorrowDate}T14:59:59+00:00`

  const { data: sesiBesok } = cgIds.length > 0
    ? await supabase.from('sessions')
        .select(`id, scheduled_at, status, zoom_link,
          class_groups(label, courses(name))`)
        .in('class_group_id', cgIds)
        .gte('scheduled_at', tomorrowStart)
        .lte('scheduled_at', tomorrowEnd)
        .order('scheduled_at')
    : { data: [] }

  // ── Absensi yang belum diisi (3 hari terakhir) ──
  // Sesi completed tapi tidak ada satupun record di tabel attendances
  const threeDaysAgo = new Date(Date.now() - 3 * 86400 * 1000).toISOString()
  let absensiMissingSessions: { id: string; scheduled_at: string; kelasLabel: string }[] = []

  if (cgIds.length > 0) {
    const { data: recentCompleted } = await supabase
      .from('sessions')
      .select('id, scheduled_at, class_group_id, class_groups(label)')
      .in('class_group_id', cgIds)
      .eq('status', 'completed')
      .gte('scheduled_at', threeDaysAgo)
      .order('scheduled_at', { ascending: false })

    const completedIds = (recentCompleted ?? []).map((s: any) => s.id)

    if (completedIds.length > 0) {
      const { data: existingAbs } = await supabase
        .from('attendances')
        .select('session_id')
        .in('session_id', completedIds)

      const hasAbsensi = new Set((existingAbs ?? []).map((a: any) => a.session_id))
      absensiMissingSessions = (recentCompleted ?? [])
        .filter((s: any) => !hasAbsensi.has(s.id))
        .map((s: any) => ({
          id: s.id,
          scheduled_at: s.scheduled_at,
          kelasLabel: (s.class_groups as any)?.label ?? '—',
        }))
    }
  }

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Tutor'

  return (
    <div>
      {/* Pengumuman */}
      <AnnouncementFetcher />

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-[#1A1640] font-['Sora']">
          Halo, {firstName}! 👋
        </h1>
        <p className="text-sm text-[#7B78A8] mt-1">{fmtTanggal()}</p>
      </div>

      {/* ── ALERT: Absensi belum diisi ── */}
      {absensiMissingSessions.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={16} className="text-amber-600"/>
            </div>
            <div>
              <p className="font-bold text-amber-800 text-sm">
                {absensiMissingSessions.length} sesi belum ada absensi
              </p>
              <p className="text-xs text-amber-600 mt-0.5">Segera isi agar progress siswa tercatat dengan benar</p>
            </div>
          </div>
          <div className="space-y-2">
            {absensiMissingSessions.map(s => (
              <a key={s.id} href="/tutor/absensi"
                className="flex items-center justify-between p-3 bg-white rounded-xl border border-amber-100 hover:border-amber-300 transition-colors">
                <div>
                  <div className="text-sm font-semibold text-[#1A1640]">{s.kelasLabel}</div>
                  <div className="text-xs text-amber-600 mt-0.5">
                    {new Date(s.scheduled_at).toLocaleDateString('id-ID', {
                      weekday: 'short', day: 'numeric', month: 'short',
                      hour: '2-digit', minute: '2-digit',
                      timeZone: 'Asia/Jayapura',
                    })}
                  </div>
                </div>
                <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full flex-shrink-0">
                  Isi Absensi →
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-[#E5E3FF] p-4">
          <div className="w-10 h-10 rounded-xl bg-[#EEEDFE] flex items-center justify-center mb-3">
            <CalendarDays size={18} color="#5C4FE5" strokeWidth={2}/>
          </div>
          <div className="text-2xl font-black text-[#5C4FE5]">{sesiMingguIni ?? 0}</div>
          <div className="text-xs text-[#7B78A8] font-semibold mt-1">Sesi minggu ini</div>
        </div>
        <div className="bg-white rounded-2xl border border-[#E5E3FF] p-4">
          <div className="w-10 h-10 rounded-xl bg-[#E1F5EE] flex items-center justify-center mb-3">
            <BookOpen size={18} color="#1D9E75" strokeWidth={2}/>
          </div>
          <div className="text-2xl font-black text-[#1D9E75]">{totalKelas}</div>
          <div className="text-xs text-[#7B78A8] font-semibold mt-1">Kelas aktif</div>
        </div>
        <div className="bg-white rounded-2xl border border-[#E5E3FF] p-4">
          <div className="w-10 h-10 rounded-xl bg-[#E6F1FB] flex items-center justify-center mb-3">
            <Users size={18} color="#185FA5" strokeWidth={2}/>
          </div>
          <div className="text-2xl font-black text-[#185FA5]">{totalSiswa}</div>
          <div className="text-xs text-[#7B78A8] font-semibold mt-1">Siswa diajar</div>
        </div>
        <div className="bg-white rounded-2xl border border-[#E5E3FF] p-4">
          <div className="w-10 h-10 rounded-xl bg-[#FAEEDA] flex items-center justify-center mb-3">
            <Coins size={18} color="#BA7517" strokeWidth={2}/>
          </div>
          <div className="text-2xl font-black text-[#BA7517]">{formatRp(totalHonor)}</div>
          <div className="text-xs text-[#7B78A8] font-semibold mt-1">Honor bulan ini</div>
        </div>
      </div>

      {/* Sesi Hari Ini */}
      <div className="bg-white rounded-2xl border border-[#E5E3FF] p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-[#1A1640]">Sesi Hari Ini</h2>
          <a href="/tutor/jadwal" className="text-xs text-[#5C4FE5] font-semibold hover:underline">
            Lihat semua →
          </a>
        </div>
        <SesiHariIniClient sesiHariIni={sesiHariIni ?? []} />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          { href: '/tutor/absensi',  label: 'Absensi',       icon: <ClipboardList size={20} strokeWidth={2}/>, bg: '#EEEDFE', color: '#5C4FE5', badge: absensiMissingSessions.length },
          { href: '/tutor/jadwal',   label: 'Jadwal',        icon: <CalendarDays  size={20} strokeWidth={2}/>, bg: '#E1F5EE', color: '#1D9E75', badge: 0 },
          { href: '/tutor/laporan',  label: 'Laporan Siswa', icon: <FileText      size={20} strokeWidth={2}/>, bg: '#E6F1FB', color: '#185FA5', badge: 0 },
          { href: '/tutor/kelas',    label: 'Kelas & Siswa', icon: <BookOpen      size={20} strokeWidth={2}/>, bg: '#FAEEDA', color: '#BA7517', badge: 0 },
        ].map((a, i) => (
          <a key={i} href={a.href}
            className="relative bg-white rounded-2xl border border-[#E5E3FF] p-4 flex flex-col items-center gap-2 hover:border-[#5C4FE5] hover:bg-[#F7F6FF] transition-all group">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center transition-colors relative"
              style={{ background: a.bg, color: a.color }}>
              {a.icon}
              {a.badge > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                  {a.badge}
                </span>
              )}
            </div>
            <span className="text-xs font-semibold text-[#4A4580] group-hover:text-[#5C4FE5] text-center leading-tight transition-colors">
              {a.label}
            </span>
          </a>
        ))}
      </div>

      {/* Sesi Besok */}
      {(sesiBesok ?? []).length > 0 && (
        <div className="bg-white rounded-2xl border border-[#E5E3FF] p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-bold text-[#1A1640]">Besok</h2>
              <p className="text-xs text-[#7B78A8] mt-0.5">
                {fmtDate((sesiBesok ?? [])[0]?.scheduled_at ?? '')}
                <span className="ml-2 font-semibold text-[#5C4FE5]">
                  {(sesiBesok ?? []).length} sesi
                </span>
              </p>
            </div>
          </div>
          <div className="space-y-2">
            {(sesiBesok ?? []).map((s: any) => (
              <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#F7F6FF] border border-[#F0EFFF]">
                <div className="text-sm font-bold text-[#5C4FE5] w-12 flex-shrink-0">
                  {fmtTime(s.scheduled_at)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-[#1A1640] truncate">
                    {s.class_groups?.label ?? '—'}
                  </div>
                  <div className="text-xs text-[#7B78A8]">
                    {s.class_groups?.courses?.name ?? '—'}
                  </div>
                </div>
                {s.zoom_link && (
                  <a href={s.zoom_link} target="_blank" rel="noopener noreferrer"
                    className="text-xs px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg font-semibold hover:bg-blue-100 transition flex-shrink-0">
                    Zoom
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
