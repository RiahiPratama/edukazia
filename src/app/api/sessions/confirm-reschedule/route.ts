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

// Admin tetapkan jadwal pengganti untuk sesi yang di-reschedule
export async function POST(req: NextRequest) {
  try {
    const { session_id, new_date, new_time } = await req.json()
    // new_date: 'YYYY-MM-DD', new_time: 'HH:MM'

    if (!session_id || !new_date || !new_time) {
      return NextResponse.json({ error: 'session_id, new_date, new_time required' }, { status: 400 })
    }

    // Gabungkan tanggal + jam → ISO string (WIT = UTC+9)
    const newScheduledAt = new Date(`${new_date}T${new_time}:00+09:00`).toISOString()

    // Update sesi: pindah tanggal + status kembali ke scheduled
    const { error: updateErr } = await supabaseAdmin
      .from('sessions')
      .update({
        scheduled_at: newScheduledAt,
        status:       'scheduled',
      })
      .eq('id', session_id)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    // Ambil info sesi untuk notif
    const { data: sesi } = await supabaseAdmin
      .from('sessions')
      .select('id, scheduled_at, class_group_id, class_groups(label, tutor_id)')
      .eq('id', session_id)
      .single()

    if (!sesi) return NextResponse.json({ ok: true, notified: 0 })

    // Setup VAPID
    const vapidPublic  = process.env.VAPID_PUBLIC_KEY
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY
    if (!vapidPublic || !vapidPrivate) {
      return NextResponse.json({ ok: true, notified: 0 })
    }
    webpush.setVapidDetails('mailto:admin@edukazia.com', vapidPublic, vapidPrivate)

    const cg         = Array.isArray(sesi.class_groups) ? sesi.class_groups[0] : sesi.class_groups
    const kelasLabel = cg?.label ?? 'Kelas'
    const waktuBaru  = new Date(newScheduledAt).toLocaleTimeString('id-ID', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jayapura',
    })
    const tanggalBaru = new Date(newScheduledAt).toLocaleDateString('id-ID', {
      weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Jayapura',
    })

    let totalNotified = 0

    // Notif ke Orang Tua
    const { data: enrollments } = await supabaseAdmin
      .from('enrollments').select('student_id')
      .eq('class_group_id', sesi.class_group_id).eq('status', 'active')

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
            title: '✅ Jadwal Pengganti Ditetapkan',
            body:  `${kelasLabel} akan dilaksanakan pada ${tanggalBaru} pukul ${waktuBaru} WIT.`,
            tag:   `reschedule-confirmed-${session_id}`,
            url:   '/ortu/dashboard',
          }))
        }
      }
    }

    // Notif ke Tutor
    if (cg?.tutor_id) {
      const { data: tutor } = await supabaseAdmin
        .from('tutors').select('profile_id').eq('id', cg.tutor_id).single()
      if (tutor?.profile_id) {
        const { data: tutorSubs } = await supabaseAdmin
          .from('push_subscriptions').select('endpoint, p256dh, auth').eq('user_id', tutor.profile_id)
        if (tutorSubs && tutorSubs.length > 0) {
          totalNotified += await sendPush(tutorSubs, JSON.stringify({
            title: '✅ Jadwal Pengganti Ditetapkan',
            body:  `${kelasLabel} dijadwalkan ulang ke ${tanggalBaru} pukul ${waktuBaru} WIT.`,
            tag:   `reschedule-confirmed-tutor-${session_id}`,
            url:   '/tutor/dashboard',
          }))
        }
      }
    }

    return NextResponse.json({ ok: true, notified: totalNotified, new_scheduled_at: newScheduledAt })
  } catch (err: any) {
    console.error('confirm-reschedule error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
