import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendWhatsApp, formatPhoneID } from '@/lib/fonnte'

/**
 * GET /api/cron/weekly-summary
 * 
 * Cron mingguan: kirim summary aktivitas user ke WA admin
 * Setup di cron-job.org: setiap Senin jam 08:00 WIT
 * URL: https://app.edukazia.com/api/cron/weekly-summary
 */

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)

    // User aktif minggu ini
    const { data: weekData } = await supabase
      .from('user_activity')
      .select('user_id, user_role')
      .neq('user_role', 'admin')
      .gte('created_at', weekAgo.toISOString())

    const uniqueWeek = new Set(weekData?.map(d => d.user_id) ?? [])
    const aktif = uniqueWeek.size

    // Per role
    const roleCount: Record<string, number> = {}
    const seen = new Set<string>()
    weekData?.forEach(d => {
      if (!seen.has(d.user_id)) {
        seen.add(d.user_id)
        roleCount[d.user_role] = (roleCount[d.user_role] ?? 0) + 1
      }
    })

    // Total user yang bisa login
    const { data: allProfiles } = await supabase
      .from('profiles')
      .select('id')
      .in('role', ['parent', 'tutor', 'student'])
      .not('email', 'is', null)

    const totalUsers = allProfiles?.length ?? 0
    const tidakAktif = totalUsers - aktif

    // Belum pernah login sama sekali
    const { data: allActivity } = await supabase
      .from('user_activity')
      .select('user_id')
      .neq('user_role', 'admin')

    const everLoggedIn = new Set(allActivity?.map(d => d.user_id) ?? [])
    const neverLoggedIn = (allProfiles ?? []).filter(p => !everLoggedIn.has(p.id)).length

    // Retention: aktif 2 minggu lalu tapi nggak aktif minggu ini
    const twoWeeksAgo = new Date()
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
    const { data: prevWeekData } = await supabase
      .from('user_activity')
      .select('user_id')
      .neq('user_role', 'admin')
      .gte('created_at', twoWeeksAgo.toISOString())
      .lt('created_at', weekAgo.toISOString())

    const prevWeekUsers = new Set(prevWeekData?.map(d => d.user_id) ?? [])
    const churned = [...prevWeekUsers].filter(id => !uniqueWeek.has(id)).length

    // Ambil nomor admin
    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('phone')
      .eq('role', 'admin')
      .limit(1)
      .single()

    if (!adminProfile?.phone) {
      return NextResponse.json({ error: 'Admin phone not found' }, { status: 400 })
    }

    // Build message
    const tutorAktif = roleCount['tutor'] ?? 0
    const ortuAktif = (roleCount['parent'] ?? 0) + (roleCount['student'] ?? 0)

    const message = `📊 *Laporan Mingguan EduKazia*\nPeriode: ${weekAgo.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} - ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}\n\n👥 *User Aktif:* ${aktif} dari ${totalUsers}\n👨‍🏫 Tutor aktif: ${tutorAktif}\n👨‍👩‍👧 Ortu/Siswa aktif: ${ortuAktif}\n\n⚠️ *Tidak Aktif (>7 hari):* ${tidakAktif}\n🚫 *Belum pernah login:* ${neverLoggedIn}\n📉 *Berhenti akses minggu ini:* ${churned}\n\nCek detail di 👉 app.edukazia.com/admin/aktivitas`

    const res = await sendWhatsApp({
      target: formatPhoneID(adminProfile.phone),
      message,
    })

    // Log
    try {
      await supabase.from('notification_logs').insert({
        type: 'wa_weekly_summary',
        target: formatPhoneID(adminProfile.phone),
        payload: { aktif, tidakAktif, neverLoggedIn, churned, tutorAktif, ortuAktif, totalUsers },
        status: res.status ? 'sent' : 'failed',
        response: res.detail ?? null,
      })
    } catch (_) {}

    return NextResponse.json({ sent: res.status, aktif, tidakAktif, neverLoggedIn, churned })
  } catch (err: any) {
    console.error('[weekly-summary]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
