import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
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

  // Gunakan noon WIT agar .getDay() tidak salah
  const todayWITStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jayapura' })
  // Parse tanggal WIT secara eksplisit agar tidak terpengaruh UTC offset
  const [y, m, d]   = todayWITStr.split('-').map(Number)
  const noonWIT     = new Date(Date.UTC(y, m - 1, d, 3, 0, 0)) // noon WIT = 03:00 UTC
  const rawDay      = noonWIT.getUTCDay() // pakai UTC karena kita set UTC secara eksplisit
  const dayOfWeek   = rawDay === 0 ? 6 : rawDay - 1

  // monday & sunday dalam WIT (jam 00:00 WIT = 15:00 UTC hari sebelumnya)
  const mondayDate  = new Date(Date.UTC(y, m - 1, d - dayOfWeek + weekOffset * 7, 15, 0, 0))
  const sundayDate  = new Date(Date.UTC(y, m - 1, d - dayOfWeek + weekOffset * 7 + 6, 15, 0, 0))
  const monday      = new Date(mondayDate.getTime() - 15 * 3600000) // 00:00 WIT
  const sunday      = new Date(sundayDate.getTime() + 8 * 3600000 + 59 * 60000 + 59000) // 23:59 WIT

  const toUTC = (d: Date) => new Date(d.getTime() - 9 * 3600000).toISOString()

  // Semua sesi minggu ini
  const { data: sessions } = await supabase
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

  // Sesi bulan ini untuk dot indicator
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

  // Sesi hari ini
  const prevDate   = new Date(todayWITStr + 'T00:00:00+09:00')
  prevDate.setDate(prevDate.getDate() - 1)
  const todayStart = prevDate.toLocaleDateString('en-CA') + 'T15:00:00+00:00'
  const todayEnd   = todayWITStr + 'T14:59:59+00:00'

  const { data: sesiHariIni } = await supabase
    .from('sessions')
    .select(`id, scheduled_at, status, zoom_link,
      class_groups(id, label, courses(name), class_types(name),
        tutors(profiles(full_name)))`)
    .gte('scheduled_at', todayStart)
    .lte('scheduled_at', todayEnd)
    .order('scheduled_at')

  return (
    <AdminJadwalClient
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
