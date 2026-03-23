export const runtime = 'nodejs'

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function sendPushToAll(title: string, body: string, tag: string) {
  const vapidPublic  = process.env.VAPID_PUBLIC_KEY
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY
  if (!vapidPublic || !vapidPrivate) return

  webpush.setVapidDetails('mailto:admin@edukazia.com', vapidPublic, vapidPrivate)

  const { data: subs } = await supabaseAdmin
    .from('push_subscriptions').select('endpoint, p256dh, auth')

  if (!subs || subs.length === 0) return

  const payload = JSON.stringify({ title, body, tag, url: '/ortu/dashboard' })
  const expired: string[] = []

  for (const sub of subs as any[]) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      )
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) expired.push(sub.endpoint)
    }
  }
  if (expired.length > 0) {
    await supabaseAdmin.from('push_subscriptions').delete().in('endpoint', expired)
  }
}

// GET — ambil semua pengumuman aktif
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('announcements')
    .select('*')
    .eq('is_active', true)
    .order('priority', { ascending: true }) // high → medium → low
    .order('start_date', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// POST — buat pengumuman baru + otomatis holiday sesi
export async function POST(req: NextRequest) {
  try {
    const { title, description, start_date, end_date, priority } = await req.json()

    if (!title || !start_date || !end_date) {
      return NextResponse.json({ error: 'title, start_date, end_date required' }, { status: 400 })
    }

    // Simpan pengumuman
    const { data: ann, error: annErr } = await supabaseAdmin
      .from('announcements')
      .insert({ title, description, start_date, end_date, priority: priority ?? 'medium', is_active: true })
      .select('*').single()

    if (annErr) return NextResponse.json({ error: annErr.message }, { status: 500 })

    // Ubah semua sesi 'scheduled' di rentang libur → 'holiday'
    const startUTC = `${start_date}T00:00:00+09:00`
    const endUTC   = `${end_date}T23:59:59+09:00`

    const { data: affectedSessions } = await supabaseAdmin
      .from('sessions')
      .select('id')
      .eq('status', 'scheduled')
      .gte('scheduled_at', startUTC)
      .lte('scheduled_at', endUTC)

    let updatedCount = 0
    if (affectedSessions && affectedSessions.length > 0) {
      const ids = affectedSessions.map((s: any) => s.id)
      await supabaseAdmin.from('sessions').update({ status: 'holiday' }).in('id', ids)
      updatedCount = ids.length
    }

    // Push notif ke semua (ortu + tutor)
    if (priority === 'high') {
      await sendPushToAll(
        `⚠️ ${title}`,
        description ?? `${start_date} – ${end_date}`,
        `ann-${ann.id}`
      )
    } else {
      await sendPushToAll(
        `📢 ${title}`,
        description ?? `Periode: ${start_date} – ${end_date}`,
        `ann-${ann.id}`
      )
    }

    return NextResponse.json({ ok: true, announcement: ann, sessions_updated: updatedCount })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// PATCH — update pengumuman
export async function PATCH(req: NextRequest) {
  try {
    const { id, title, description, start_date, end_date, priority, is_active } = await req.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    // Ambil data lama untuk restore sesi jika tanggal berubah
    const { data: old } = await supabaseAdmin
      .from('announcements').select('*').eq('id', id).single()

    const { data: ann, error } = await supabaseAdmin
      .from('announcements')
      .update({ title, description, start_date, end_date, priority, is_active })
      .eq('id', id).select('*').single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Kalau dinonaktifkan atau tanggal berubah → restore sesi lama ke scheduled
    if (old && (is_active === false || start_date !== old.start_date || end_date !== old.end_date)) {
      const oldStart = `${old.start_date}T00:00:00+09:00`
      const oldEnd   = `${old.end_date}T23:59:59+09:00`
      await supabaseAdmin
        .from('sessions').update({ status: 'scheduled' })
        .eq('status', 'holiday')
        .gte('scheduled_at', oldStart)
        .lte('scheduled_at', oldEnd)
    }

    // Kalau masih aktif dan ada tanggal baru → set holiday pada tanggal baru
    if (is_active !== false && start_date && end_date) {
      const newStart = `${start_date}T00:00:00+09:00`
      const newEnd   = `${end_date}T23:59:59+09:00`
      await supabaseAdmin
        .from('sessions').update({ status: 'holiday' })
        .eq('status', 'scheduled')
        .gte('scheduled_at', newStart)
        .lte('scheduled_at', newEnd)
    }

    return NextResponse.json({ ok: true, announcement: ann })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE — hapus pengumuman + restore sesi ke scheduled
export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const { data: ann } = await supabaseAdmin
      .from('announcements').select('*').eq('id', id).single()

    if (ann) {
      // Restore sesi holiday → scheduled
      const startUTC = `${ann.start_date}T00:00:00+09:00`
      const endUTC   = `${ann.end_date}T23:59:59+09:00`
      await supabaseAdmin
        .from('sessions').update({ status: 'scheduled' })
        .eq('status', 'holiday')
        .gte('scheduled_at', startUTC)
        .lte('scheduled_at', endUTC)
    }

    await supabaseAdmin.from('announcements').delete().eq('id', id)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
