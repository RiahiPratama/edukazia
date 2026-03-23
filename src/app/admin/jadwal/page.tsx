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
  const noonWIT     = new Date(todayWITStr + 'T12:00:00+09:00')
  const rawDay      = noonWIT.getDay()
  const dayOfWeek   = rawDay === 0 ? 6 : rawDay - 1

  const monday = new Date(noonWIT)
  monday.setDate(noonWIT.getDate() - dayOfWeek + weekOffset * 7)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)

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

  return (
    <AdminJadwalClient
      sessions={sessions ?? []}
      sessionsBulanIni={sessionsBulanIni ?? []}
      todayWITStr={todayWITStr}
      weekOffset={weekOffset}
      mondayISO={monday.toISOString()}
      sundayISO={sunday.toISOString()}
    />
  )
}
