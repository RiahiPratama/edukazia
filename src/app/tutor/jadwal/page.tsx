import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TutorJadwalClient from './TutorJadwalClient'

export const dynamic = 'force-dynamic'

export default async function TutorJadwalPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: tutor } = await supabase
    .from('tutors').select('id').eq('profile_id', user.id).single()
  const tutorId    = tutor?.id
  const params     = await searchParams
  const weekOffset = parseInt(params.week ?? '0')

  // Tanggal hari ini dalam WIT (Asia/Jayapura, UTC+9)
  const todayWITStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jayapura' })

  // Noon WIT agar getDay() akurat
  const [y, m, d] = todayWITStr.split('-').map(Number)
  const noonWIT   = new Date(Date.UTC(y, m - 1, d, 3, 0, 0)) // 03:00 UTC = 12:00 WIT
  const rawDay    = noonWIT.getUTCDay()
  const dayOfWeek = rawDay === 0 ? 6 : rawDay - 1 // Senin=0 … Minggu=6

  // Batas minggu: Senin 00:00 WIT s.d. Minggu 23:59 WIT
  const mondayDate = new Date(Date.UTC(y, m - 1, d - dayOfWeek + weekOffset * 7, 15, 0, 0))
  const sundayDate = new Date(Date.UTC(y, m - 1, d - dayOfWeek + weekOffset * 7 + 6, 15, 0, 0))
  const monday     = new Date(mondayDate.getTime() - 15 * 3600000)
  const sunday     = new Date(sundayDate.getTime() + 8 * 3600000 + 59 * 60000 + 59000)

  const toUTC = (dt: Date) => new Date(dt.getTime() - 9 * 3600000).toISOString()

  // ─── SESI HARI INI ────────────────────────────────────────────────────────
  // FIX: gunakan offset +09:00 eksplisit — sebelumnya setDate() memakai
  // local timezone server (UTC), sehingga batas jadi kemarin WIT.
  const todayStart = `${todayWITStr}T00:00:00+09:00`
  const todayEnd   = `${todayWITStr}T23:59:59+09:00`

  const { data: sesiHariIni } = await supabase
    .from('sessions')
    .select('id, scheduled_at, status, zoom_link, class_groups!inner(id, label, tutor_id, courses(name), class_types(name))')
    .eq('class_groups.tutor_id', tutorId)
    .gte('scheduled_at', todayStart)
    .lte('scheduled_at', todayEnd)
    .order('scheduled_at')

  // ─── SESI MINGGUAN (kalender, TANPA hari ini dan tanpa masa lalu) ─────────
  const tomorrowStart = new Date(Date.UTC(y, m - 1, d + 1, 15, 0, 0) - 15 * 3600000)
  const weekStart = weekOffset === 0 ? tomorrowStart : monday

  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, scheduled_at, status, zoom_link, class_groups!inner(id, label, tutor_id, courses(name), class_types(name))')
    .eq('class_groups.tutor_id', tutorId)
    .gte('scheduled_at', toUTC(weekStart))
    .lte('scheduled_at', toUTC(sunday))
    .order('scheduled_at')

  // ─── DOT INDICATOR bulan ini ─────────────────────────────────────────────
  const firstOfMonth = new Date(todayWITStr.slice(0, 7) + '-01T00:00:00+09:00')
  const lastOfMonth  = new Date(firstOfMonth)
  lastOfMonth.setMonth(lastOfMonth.getMonth() + 1)
  lastOfMonth.setDate(lastOfMonth.getDate() - 1)

  const { data: sessionsBulanIni } = await supabase
    .from('sessions')
    .select('id, scheduled_at, class_groups!inner(tutor_id)')
    .eq('class_groups.tutor_id', tutorId)
    .gte('scheduled_at', toUTC(firstOfMonth))
    .lte('scheduled_at', toUTC(lastOfMonth))
    .neq('status', 'cancelled')

  return (
    <TutorJadwalClient
      sessions={sessions ?? []}
      sesiHariIni={sesiHariIni ?? []}
      sessionsBulanIni={sessionsBulanIni ?? []}
      todayWITStr={todayWITStr}
      weekOffset={weekOffset}
      mondayISO={monday.toISOString()}
      sundayISO={sunday.toISOString()}
    />
  )
}
