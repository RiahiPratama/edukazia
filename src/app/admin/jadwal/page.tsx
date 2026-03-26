import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminJadwalClient from './AdminJadwalClient'

export const dynamic = 'force-dynamic'

export default async function AdminJadwalPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params     = await searchParams
  const weekOffset = parseInt(params.week ?? '0')

  // Tanggal hari ini dalam WIT (Asia/Jayapura, UTC+9)
  const todayWITStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jayapura' })

  // Noon WIT agar getDay() akurat (tidak terpengaruh DST/UTC offset)
  const [y, m, d] = todayWITStr.split('-').map(Number)
  const noonWIT   = new Date(Date.UTC(y, m - 1, d, 3, 0, 0)) // 03:00 UTC = 12:00 WIT
  const rawDay    = noonWIT.getUTCDay()
  const dayOfWeek = rawDay === 0 ? 6 : rawDay - 1 // Senin=0 … Minggu=6

  // Batas minggu: Senin 00:00 WIT s.d. Minggu 23:59 WIT
  const mondayDate = new Date(Date.UTC(y, m - 1, d - dayOfWeek + weekOffset * 7, 15, 0, 0))
  const sundayDate = new Date(Date.UTC(y, m - 1, d - dayOfWeek + weekOffset * 7 + 6, 15, 0, 0))
  const monday     = new Date(mondayDate.getTime() - 15 * 3600000) // 00:00 WIT = −15j UTC
  const sunday     = new Date(sundayDate.getTime() + 8 * 3600000 + 59 * 60000 + 59000) // 23:59 WIT

  const toUTC = (dt: Date) => new Date(dt.getTime() - 9 * 3600000).toISOString()

  // ─── SESI HARI INI ────────────────────────────────────────────────────────
  // FIX: gunakan offset +09:00 eksplisit agar batas tepat di WIT,
  // bukan bergantung pada timezone server (yang mungkin UTC).
  const todayStart = `${todayWITStr}T00:00:00+09:00`
  const todayEnd   = `${todayWITStr}T23:59:59+09:00`

  const { data: sesiHariIni } = await supabase
    .from('sessions')
    .select(`id, scheduled_at, status, zoom_link,
      class_groups(id, label, courses(name), class_types(name),
        tutors(profiles(full_name)))`)
    .gte('scheduled_at', todayStart)
    .lte('scheduled_at', todayEnd)
    .order('scheduled_at')

  // ─── SESI MINGGU INI (untuk kalender) ─────────────────────────────────────
  // FIX: filter keluar hari ini agar tidak dobel dengan card "Sesi Hari Ini"
  const { data: allWeekSessions } = await supabase
    .from('sessions')
    .select(`
      id, scheduled_at, status, zoom_link,
      reschedule_reason, rescheduled_from,
      class_groups(
        id, label,
        courses(name),
        class_types(name),
        tutors(profiles(full_name))
      )
    `)
    .gte('scheduled_at', toUTC(monday))
    .lte('scheduled_at', toUTC(sunday))
    .order('scheduled_at')

  // Keluarkan sesi hari ini dari kalender mingguan (sudah tampil di card atas)
  const sessions = (allWeekSessions ?? []).filter(s => {
    const witDate = new Date(s.scheduled_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Jayapura' })
    return witDate !== todayWITStr
  })

  // ─── DOT INDICATOR bulan ini ──────────────────────────────────────────────
  const firstOfMonth = new Date(todayWITStr.slice(0, 7) + '-01T00:00:00+09:00')
  const lastOfMonth  = new Date(firstOfMonth)
  lastOfMonth.setMonth(lastOfMonth.getMonth() + 1)
  lastOfMonth.setDate(lastOfMonth.getDate() - 1)

  const { data: sessionsBulanIni } = await supabase
    .from('sessions')
    .select('id, scheduled_at')
    .gte('scheduled_at', toUTC(firstOfMonth))
    .lte('scheduled_at', toUTC(lastOfMonth))
    .neq('status', 'cancelled')

  return (
    <AdminJadwalClient
      sessions={sessions}
      sesiHariIni={sesiHariIni ?? []}
      sessionsBulanIni={sessionsBulanIni ?? []}
      todayWITStr={todayWITStr}
      weekOffset={weekOffset}
      mondayISO={monday.toISOString()}
      sundayISO={sunday.toISOString()}
    />
  )
}
