export const runtime = 'nodejs'

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: NextRequest) {
  // Verifikasi request dari internal / cron
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Setup VAPID di dalam function
  const vapidPublic  = process.env.VAPID_PUBLIC_KEY
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY
  if (!vapidPublic || !vapidPrivate) {
    return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 500 })
  }

  webpush.setVapidDetails(
    'mailto:admin@edukazia.com',
    vapidPublic,
    vapidPrivate
  )

  // Waktu sekarang dalam WIT (UTC+9)
  const nowWIT = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jayapura' }))
  const in60   = new Date(nowWIT.getTime() + 60 * 60 * 1000)
  const in65   = new Date(nowWIT.getTime() + 65 * 60 * 1000)

  // Convert ke UTC untuk query Supabase
  const toUTC = (d: Date) => new Date(d.getTime() - 9 * 60 * 60 * 1000).toISOString()

  // Cari sesi yang mulai dalam 60-65 menit ke depan
  const { data: sessions, error: sessErr } = await supabaseAdmin
    .from('sessions')
    .select(`id, class_group_id, scheduled_at, class_groups!inner(label)`)
    .eq('status', 'scheduled')
    .gte('scheduled_at', toUTC(in60))
    .lte('scheduled_at', toUTC(in65))

  if (sessErr) {
    console.error('Error fetching sessions:', sessErr)
    return NextResponse.json({ error: sessErr.message }, { status: 500 })
  }

  if (!sessions || sessions.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: 'No sessions in window' })
  }

  const cgIds = sessions.map((s: any) => s.class_group_id)

  // Cari enrollments aktif beserta parent_profile_id siswa
  const { data: enrollments, error: enrollErr } = await supabaseAdmin
    .from('enrollments')
    .select(`student_id, class_group_id, students!inner(parent_profile_id)`)
    .in('class_group_id', cgIds)
    .eq('status', 'active')

  if (enrollErr) {
    console.error('Error fetching enrollments:', enrollErr)
    return NextResponse.json({ error: enrollErr.message }, { status: 500 })
  }

  if (!enrollments || enrollments.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: 'No active enrollments' })
  }

  // Kumpulkan semua parent_profile_id unik
  const parentIds = [...new Set(
    (enrollments as any[])
      .map(e => (Array.isArray(e.students) ? e.students[0] : e.students)?.parent_profile_id)
      .filter(Boolean)
  )]

  // Ambil push subscriptions milik para ortu
  const { data: subscriptions, error: subErr } = await supabaseAdmin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth, user_id')
    .in('user_id', parentIds)

  if (subErr) {
    console.error('Error fetching subscriptions:', subErr)
    return NextResponse.json({ error: subErr.message }, { status: 500 })
  }

  if (!subscriptions || subscriptions.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: 'No subscriptions found' })
  }

  let sentCount = 0
  const expired: string[] = []

  for (const sub of subscriptions as any[]) {
    // Cari enrollment milik ortu ini
    const parentEnrollments = (enrollments as any[]).filter(e => {
      const student = Array.isArray(e.students) ? e.students[0] : e.students
      return student?.parent_profile_id === sub.user_id
    })

    for (const enrollment of parentEnrollments) {
      const session = sessions.find((s: any) => s.class_group_id === enrollment.class_group_id)
      if (!session) continue

      const cg = Array.isArray(session.class_groups) ? session.class_groups[0] : session.class_groups

      const jamWIT = new Date(session.scheduled_at).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Jayapura',
      })

      const payload = JSON.stringify({
        title: '🔔 Kelas segera dimulai!',
        body:  `${cg?.label ?? 'Kelas'} mulai pukul ${jamWIT} WIT — 1 jam lagi`,
        tag:   `session-${session.id}`,
        url:   '/ortu/dashboard',
      })

      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload
        )
        sentCount++
      } catch (err: any) {
        console.error('Push error:', err.statusCode, err.message)
        if (err.statusCode === 410 || err.statusCode === 404) {
          // Subscription expired / tidak valid
          expired.push(sub.endpoint)
        }
      }
    }
  }

  // Hapus subscription yang sudah expired
  if (expired.length > 0) {
    await supabaseAdmin
      .from('push_subscriptions')
      .delete()
      .in('endpoint', expired)
  }

  return NextResponse.json({
    ok: true,
    sent: sentCount,
    expired: expired.length,
  })
}
