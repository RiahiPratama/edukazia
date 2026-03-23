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
  try {
    const { session_id, alasan, new_date } = await req.json()

    if (!session_id) {
      return NextResponse.json({ error: 'session_id required' }, { status: 400 })
    }

    // Update status sesi → rescheduled
    const { error: updateErr } = await supabaseAdmin
      .from('sessions')
      .update({
        status: 'rescheduled',
        ...(new_date ? { scheduled_at: new_date } : {}),
      })
      .eq('id', session_id)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    // Ambil info sesi
    const { data: sesi } = await supabaseAdmin
      .from('sessions')
      .select('id, scheduled_at, class_group_id, class_groups(label)')
      .eq('id', session_id)
      .single()

    if (!sesi) return NextResponse.json({ ok: true, notified: 0 })

    const cg         = Array.isArray(sesi.class_groups) ? sesi.class_groups[0] : sesi.class_groups
    const kelasLabel = cg?.label ?? 'Kelas'
    const waktuWIT   = new Date(sesi.scheduled_at).toLocaleTimeString('id-ID', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jayapura',
    })
    const tanggalWIT = new Date(sesi.scheduled_at).toLocaleDateString('id-ID', {
      weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Jayapura',
    })

    // Setup VAPID
    const vapidPublic  = process.env.VAPID_PUBLIC_KEY
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY
    if (!vapidPublic || !vapidPrivate) {
      return NextResponse.json({ ok: true, notified: 0, note: 'VAPID not configured' })
    }
    webpush.setVapidDetails('mailto:admin@edukazia.com', vapidPublic, vapidPrivate)

    // Cari siswa di kelas ini
    const { data: enrollments } = await supabaseAdmin
      .from('enrollments')
      .select('student_id')
      .eq('class_group_id', sesi.class_group_id)
      .eq('status', 'active')

    if (!enrollments || enrollments.length === 0) {
      return NextResponse.json({ ok: true, notified: 0 })
    }

    const studentIds = enrollments.map((e: any) => e.student_id)
    const { data: students } = await supabaseAdmin
      .from('students')
      .select('id, parent_profile_id')
      .in('id', studentIds)

    const parentIds = [...new Set(
      (students ?? []).map((s: any) => s.parent_profile_id).filter(Boolean)
    )]

    if (parentIds.length === 0) return NextResponse.json({ ok: true, notified: 0 })

    // Ambil subscriptions ortu
    const { data: subscriptions } = await supabaseAdmin
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .in('user_id', parentIds)

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ ok: true, notified: 0 })
    }

    const alasanText = alasan ? ` Alasan: ${alasan}.` : ''
    const jadwalBaru = new_date
      ? ` Jadwal pengganti akan diinformasikan segera.`
      : ` Jadwal pengganti akan diinformasikan oleh admin.`

    const payload = JSON.stringify({
      title: '📅 Sesi Belajar Dijadwal Ulang',
      body:  `${kelasLabel} — ${tanggalWIT} pukul ${waktuWIT} WIT ditunda.${alasanText}${jadwalBaru}`,
      tag:   `reschedule-${session_id}`,
      url:   '/ortu/dashboard',
    })

    let notified = 0
    const expired: string[] = []

    for (const sub of subscriptions as any[]) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        )
        notified++
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) expired.push(sub.endpoint)
      }
    }

    if (expired.length > 0) {
      await supabaseAdmin.from('push_subscriptions').delete().in('endpoint', expired)
    }

    return NextResponse.json({ ok: true, notified, expired: expired.length })
  } catch (err: any) {
    console.error('reschedule error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
