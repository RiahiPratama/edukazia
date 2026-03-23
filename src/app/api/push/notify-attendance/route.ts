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
    const body = await req.json()
    const { session_id, attendances } = body
    // attendances = [{ student_id, status, notes }]

    if (!session_id || !attendances || attendances.length === 0) {
      return NextResponse.json({ ok: true, sent: 0 })
    }

    // Setup VAPID
    const vapidPublic  = process.env.VAPID_PUBLIC_KEY
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY
    if (!vapidPublic || !vapidPrivate) {
      return NextResponse.json({ error: 'VAPID not configured' }, { status: 500 })
    }
    webpush.setVapidDetails('mailto:admin@edukazia.com', vapidPublic, vapidPrivate)

    // Ambil info sesi
    const { data: sesi } = await supabaseAdmin
      .from('sessions')
      .select('id, scheduled_at, class_groups(label)')
      .eq('id', session_id)
      .single()

    if (!sesi) return NextResponse.json({ ok: true, sent: 0 })

    const cg = Array.isArray(sesi.class_groups) ? sesi.class_groups[0] : sesi.class_groups
    const kelasLabel = cg?.label ?? 'Kelas'
    const waktuWIT   = new Date(sesi.scheduled_at).toLocaleTimeString('id-ID', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jayapura',
    })
    const tanggalWIT = new Date(sesi.scheduled_at).toLocaleDateString('id-ID', {
      weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Jayapura',
    })

    // Ambil parent_profile_id per siswa
    const studentIds = attendances.map((a: any) => a.student_id)
    const { data: students } = await supabaseAdmin
      .from('students')
      .select('id, parent_profile_id')
      .in('id', studentIds)

    if (!students || students.length === 0) return NextResponse.json({ ok: true, sent: 0 })

    // Nama siswa
    const profileIds = students.map((s: any) => s.parent_profile_id).filter(Boolean)
    const studentProfileIds = [...new Set(students.map((s: any) => s.id))]

    // Ambil nama siswa dari profiles via profile_id
    const { data: studentRows } = await supabaseAdmin
      .from('students')
      .select('id, profile_id')
      .in('id', studentProfileIds)

    const studentProfileMap: Record<string, string> = {}
    ;(studentRows ?? []).forEach((s: any) => { studentProfileMap[s.id] = s.profile_id })

    const allProfileIds = [...new Set([...profileIds, ...Object.values(studentProfileMap)])]
    const { data: profiles } = allProfileIds.length > 0
      ? await supabaseAdmin.from('profiles').select('id, full_name').in('id', allProfileIds)
      : { data: [] }
    const profMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p.full_name]))

    // Build parentId → absensi map
    const parentAbsenMap: Record<string, { studentName: string; status: string; notes: string }[]> = {}
    const studentParentMap = Object.fromEntries(students.map((s: any) => [s.id, s.parent_profile_id]))

    for (const att of attendances) {
      const parentId = studentParentMap[att.student_id]
      if (!parentId) continue
      const studentProfileId = studentProfileMap[att.student_id]
      const studentName      = profMap[studentProfileId] ?? 'Siswa'
      if (!parentAbsenMap[parentId]) parentAbsenMap[parentId] = []
      parentAbsenMap[parentId].push({ studentName, status: att.status, notes: att.notes ?? '' })
    }

    const parentIds = Object.keys(parentAbsenMap)
    if (parentIds.length === 0) return NextResponse.json({ ok: true, sent: 0 })

    // Ambil push subscriptions
    const { data: subscriptions } = await supabaseAdmin
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth, user_id')
      .in('user_id', parentIds)

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, message: 'No subscriptions' })
    }

    let sentCount = 0
    const expired: string[] = []

    for (const sub of subscriptions as any[]) {
      const absenList = parentAbsenMap[sub.user_id]
      if (!absenList || absenList.length === 0) continue

      // Build pesan
      const lines = absenList.map(a => {
        const statusText: Record<string, string> = {
          hadir: '✅ Hadir',
          izin:  '🔵 Izin',
          sakit: '🟡 Sakit',
          alpha: '🔴 Alpha',
        }
        const keterangan = a.notes ? ` (${a.notes})` : ''
        return `${a.studentName}: ${statusText[a.status] ?? a.status}${keterangan}`
      }).join('\n')

      const payload = JSON.stringify({
        title: `📋 Absensi ${kelasLabel}`,
        body:  `${tanggalWIT}, ${waktuWIT} WIT\n${lines}`,
        tag:   `attendance-${session_id}`,
        url:   '/ortu/dashboard',
      })

      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        )
        sentCount++
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          expired.push(sub.endpoint)
        }
      }
    }

    // Hapus subscription expired
    if (expired.length > 0) {
      await supabaseAdmin.from('push_subscriptions').delete().in('endpoint', expired)
    }

    return NextResponse.json({ ok: true, sent: sentCount, expired: expired.length })
  } catch (err: any) {
    console.error('notify-attendance error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
