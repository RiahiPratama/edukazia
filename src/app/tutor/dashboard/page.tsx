import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SesiHariIniClient from './SesiHariIniClient'
import AnnouncementFetcher from '@/components/AnnouncementFetcher'
import { CalendarDays, BookOpen, Users, Coins } from 'lucide-react'

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

  const totalKelas  = kelasAktif?.length ?? 0
  const totalSiswa  = (kelasAktif ?? []).reduce((acc, k) =>
    acc + (k.enrollments?.filter((e: any) => e.status === 'active').length ?? 0), 0)

  // Sesi minggu ini
  const now   = new Date()
  const nowWIT = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jayapura' }))
  const monday = new Date(nowWIT)
  monday.setDate(nowWIT.getDate() - (nowWIT.getDay() === 0 ? 6 : nowWIT.getDay() - 1))
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)

  const cgIds = (kelasAktif ?? []).map(k => k.id)
  const { count: sesiMingguIni } = cgIds.length > 0
    ? await supabase.from('sessions')
        .select('*', { count: 'exact', head: true })
        .in('class_group_id', cgIds)
        .gte('scheduled_at', new Date(monday.getTime() - 9 * 3600000).toISOString())
        .lte('scheduled_at', new Date(sunday.getTime() - 9 * 3600000).toISOString())
    : { count: 0 }

  // Honor bulan ini
  const firstOfMonth = new Date(nowWIT.getFullYear(), nowWIT.getMonth(), 1).toISOString()
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
  const todayWIT = nowWIT.toLocaleDateString('en-CA', { timeZone: 'Asia/Jayapura' })
  const prevDateObj = new Date(todayWIT + 'T00:00:00+09:00')
  prevDateObj.setDate(prevDateObj.getDate() - 1)
  const prevDate = prevDateObj.toLocaleDateString('en-CA')
  const startUtc = `${prevDate}T15:00:00+00:00`
  const endUtc   = `${todayWIT}T14:59:59+00:00`

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
  const tomorrowObj = new Date(todayWIT + 'T00:00:00+09:00')
  tomorrowObj.setDate(tomorrowObj.getDate() + 1)
  const tomorrowDate  = tomorrowObj.toLocaleDateString('en-CA')
  const tomorrowStart = `${todayWIT}T15:00:00+00:00`
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
