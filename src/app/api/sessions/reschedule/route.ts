export const runtime = 'nodejs'

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function sendPush(subs: any[], payload: string) {
  const expired: string[] = []
  let sent = 0
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      )
      sent++
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) expired.push(sub.endpoint)
    }
  }
  if (expired.length > 0) {
    await supabaseAdmin.from('push_subscriptions').delete().in('endpoint', expired)
  }
  return sent
}

export async function POST(req: NextRequest) {
  try {
    const { session_id, alasan, reschedued_by_role, reschedued_by_id } = await req.json()

    if (!session_id) {
      return NextResponse.json({ error: 'session_id required' }, { status: 400 })
    }

    // Ambil info sesi SEBELUM diupdate
    const { data: sesiLama } = await supabaseAdmin
      .from('sessions')
      .select('id, scheduled_at, class_group_id, class_groups(label, tutor_id)')
      .eq('id', session_id)
      .single()

    if (!sesiLama) return NextResponse.json({ error: 'Sesi tidak ditemukan' }, { status: 404 })

    // Update status + simpan tracking
    const { error: updateErr } = await supabaseAdmin
      .from('sessions')
      .update({
        status:            'rescheduled',
        reschedule_reason: alasan || null,
        rescheduled_from:  sesiLama.scheduled_at,
        rescheduled_by:    reschedued_by_id || null,
      })
      .eq('id', session_id)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    // Setup VAPID
    const vapidPublic  = process.env.VAPID_PUBLIC_KEY
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY
    if (!vapidPublic || !vapidPrivate) {
      return NextResponse.json({ ok: true, notified: 0, note: 'VAPID not configured' })
    }
    webpush.setVapidDetails('mailto:admin@edukazia.com', vapidPublic, vapidPrivate)

    const cg         = Array.isArray(sesiLama.class_groups) ? sesiLama.class_groups[0] : sesiLama.class_groups
    const kelasLabel = cg?.label ?? 'Kelas'
    const waktuWIT   = new Date(sesiLama.scheduled_at).toLocaleTimeString('id-ID', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jayapura',
    })
    const tanggalWIT = new Date(sesiLama.scheduled_at).toLocaleDateString('id-ID', {
      weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Jayapura',
    })
    const alasanText = alasan ? ` Alasan: ${alasan}.` : ''

    let totalNotified = 0

    // ── Notif ke Orang Tua (selalu) ─────────────────────────────────────────
    const { data: enrollments } = await supabaseAdmin
      .from('enrollments')
      .select('student_id')
      .eq('class_group_id', sesiLama.class_group_id)
      .eq('status', 'active')

    if (enrollments && enrollments.length > 0) {
      const studentIds = enrollments.map((e: any) => e.student_id)
      const { data: students } = await supabaseAdmin
        .from('students').select('id, parent_profile_id').in('id', studentIds)
      const parentIds = [...new Set((students ?? []).map((s: any) => s.parent_profile_id).filter(Boolean))]

      if (parentIds.length > 0) {
        const { data: parentSubs } = await supabaseAdmin
          .from('push_subscriptions').select('endpoint, p256dh, auth').in('user_id', parentIds)
        if (parentSubs && parentSubs.length > 0) {
          totalNotified += await sendPush(parentSubs, JSON.stringify({
            title: '📅 Sesi Belajar Dijadwal Ulang',
            body:  `${kelasLabel} — ${tanggalWIT} pukul ${waktuWIT} WIT ditunda.${alasanText} Jadwal pengganti akan diinformasikan segera.`,
            tag:   `reschedule-${session_id}`,
            url:   '/ortu/dashboard',
          }))
        }
      }
    }

    // ── Notif ke Tutor (jika reschedule oleh Admin) ──────────────────────────
    if (reschedued_by_role === 'admin' && cg?.tutor_id) {
      const { data: tutor } = await supabaseAdmin
        .from('tutors').select('profile_id').eq('id', cg.tutor_id).single()
      if (tutor?.profile_id) {
        const { data: tutorSubs } = await supabaseAdmin
          .from('push_subscriptions').select('endpoint, p256dh, auth').eq('user_id', tutor.profile_id)
        if (tutorSubs && tutorSubs.length > 0) {
          totalNotified += await sendPush(tutorSubs, JSON.stringify({
            title: '📅 Sesi Dijadwal Ulang oleh Admin',
            body:  `${kelasLabel} — ${tanggalWIT} pukul ${waktuWIT} WIT ditunda oleh admin.${alasanText}`,
            tag:   `reschedule-tutor-${session_id}`,
            url:   '/tutor/dashboard',
          }))
        }
      }
    }

    // ── Notif ke Admin (jika reschedule oleh Tutor) ──────────────────────────
    if (reschedued_by_role === 'tutor') {
      const { data: adminProfiles } = await supabaseAdmin
        .from('profiles').select('id').eq('role', 'admin')
      if (adminProfiles && adminProfiles.length > 0) {
        const { data: adminSubs } = await supabaseAdmin
          .from('push_subscriptions').select('endpoint, p256dh, auth')
          .in('user_id', adminProfiles.map((p: any) => p.id))
        if (adminSubs && adminSubs.length > 0) {
          totalNotified += await sendPush(adminSubs, JSON.stringify({
            title: '📅 Sesi Dijadwal Ulang oleh Tutor',
            body:  `${kelasLabel} — ${tanggalWIT} pukul ${waktuWIT} WIT ditunda oleh tutor.${alasanText}`,
            tag:   `reschedule-admin-${session_id}`,
            url:   '/admin/jadwal',
          }))
        }
      }
    }

    return NextResponse.json({ ok: true, notified: totalNotified })
  } catch (err: any) {
    console.error('reschedule error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
