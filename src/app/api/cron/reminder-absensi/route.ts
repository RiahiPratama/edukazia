import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendWhatsApp, formatPhoneID } from '@/lib/fonnte'

/**
 * Cron: Reminder absensi ke tutor
 * Jalan tiap 5 menit via external cron (cron-job.org)
 * 
 * Logic:
 * 1. Ambil semua sesi hari ini yang status = 'scheduled'
 * 2. Hitung end_time = scheduled_at + durasi
 * 3. Kalau sekarang ~10 menit sebelum end_time → kirim WA ke tutor
 * 4. Skip kalau sudah ada attendance record (tutor sudah isi)
 */

// Durasi per tipe kelas (menit)
function getDurasi(classTypeName: string, courseName: string): number {
  const type   = (classTypeName ?? '').toLowerCase()
  const course = (courseName ?? '').toLowerCase()
  if (type.includes('privat') && !type.includes('semi') && course.includes('inggris')) return 45
  return 60
}

export async function GET(req: Request) {
  // Verifikasi cron secret
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const now = new Date()

  // ── Ambil tanggal hari ini WIT ──
  const todayWIT = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Jayapura' })
  const startUtc = new Date(todayWIT + 'T00:00:00+09:00').toISOString()
  const endUtc   = new Date(todayWIT + 'T23:59:59+09:00').toISOString()

  // ── 1. Ambil sesi scheduled hari ini ──
  const { data: sessions, error: sessErr } = await supabase
    .from('sessions')
    .select('id, scheduled_at, class_group_id')
    .eq('status', 'scheduled')
    .gte('scheduled_at', startUtc)
    .lte('scheduled_at', endUtc)

  if (sessErr || !sessions || sessions.length === 0) {
    return NextResponse.json({ sent: 0, message: 'No scheduled sessions today' })
  }

  // ── 2. Ambil class_groups info ──
  const cgIds = [...new Set(sessions.map(s => s.class_group_id))]

  const { data: classGroups } = await supabase
    .from('class_groups')
    .select('id, label, tutor_id, course_id, class_type_id')
    .in('id', cgIds)

  if (!classGroups || classGroups.length === 0) {
    return NextResponse.json({ sent: 0, message: 'No class groups found' })
  }

  // Ambil courses & class_types
  const courseIds = [...new Set(classGroups.map(cg => cg.course_id))]
  const ctIds     = [...new Set(classGroups.map(cg => cg.class_type_id))]
  const tutorIds  = [...new Set(classGroups.map(cg => cg.tutor_id))]

  const [
    { data: courses },
    { data: classTypes },
    { data: tutors },
  ] = await Promise.all([
    supabase.from('courses').select('id, name').in('id', courseIds),
    supabase.from('class_types').select('id, name').in('id', ctIds),
    supabase.from('tutors').select('id, profile_id').in('id', tutorIds),
  ])

  // Ambil profiles tutor (untuk nama + nomor HP)
  const profileIds = (tutors ?? []).map(t => t.profile_id).filter(Boolean)
  const { data: profiles } = profileIds.length > 0
    ? await supabase.from('profiles').select('id, full_name, phone').in('id', profileIds)
    : { data: [] }

  // Build lookup maps
  const courseMap = Object.fromEntries((courses ?? []).map(c => [c.id, c.name]))
  const ctMap    = Object.fromEntries((classTypes ?? []).map(c => [c.id, c.name]))
  const tutorMap = Object.fromEntries((tutors ?? []).map(t => [t.id, t.profile_id]))
  const profMap  = Object.fromEntries((profiles ?? []).map(p => [p.id, { name: p.full_name, phone: p.phone }]))

  // ── 3. Cek attendance yang sudah ada ──
  const sessionIds = sessions.map(s => s.id)
  const { data: existingAtt } = await supabase
    .from('attendances')
    .select('session_id')
    .in('session_id', sessionIds)

  const attendedSessionIds = new Set((existingAtt ?? []).map(a => a.session_id))

  // ── 4. Filter sesi yang perlu reminder ──
  const nowMs = now.getTime()
  const reminders: { sessionId: string; tutorName: string; tutorPhone: string; kelasLabel: string; courseName: string }[] = []

  for (const sesi of sessions) {
    // Skip kalau sudah ada absensi
    if (attendedSessionIds.has(sesi.id)) continue

    const cg = classGroups.find(c => c.id === sesi.class_group_id)
    if (!cg) continue

    const courseName    = courseMap[cg.course_id] ?? ''
    const classTypeName = ctMap[cg.class_type_id] ?? ''
    const durasi        = getDurasi(classTypeName, courseName)

    const scheduledMs = new Date(sesi.scheduled_at).getTime()
    const endMs       = scheduledMs + durasi * 60 * 1000
    const reminderMs  = endMs - 10 * 60 * 1000  // 10 menit sebelum selesai

    // Window: reminder time ± 8 menit (supaya cron 15 menit pasti nangkep sekali)
    const diffFromReminder = nowMs - reminderMs
    if (diffFromReminder >= -480_000 && diffFromReminder <= 480_000) {
      // Dalam window reminder!
      const profileId  = tutorMap[cg.tutor_id]
      const tutorProf  = profMap[profileId]
      if (!tutorProf?.phone) continue

      reminders.push({
        sessionId:  sesi.id,
        tutorName:  tutorProf.name ?? 'Tutor',
        tutorPhone: tutorProf.phone,
        kelasLabel: cg.label,
        courseName,
      })
    }
  }

  if (reminders.length === 0) {
    return NextResponse.json({ sent: 0, message: 'No reminders needed right now' })
  }

  // ── 5. Kirim WA via Fonnte ──
  const results: { sessionId: string; tutor: string; status: boolean }[] = []

  for (const r of reminders) {
    const message = `📋 *Reminder EduKazia*\n\nHalo ${r.tutorName}! 👋\n\nKelas *${r.kelasLabel}* (${r.courseName}) akan selesai dalam 10 menit.\n\n✅ Jangan lupa isi *absensi siswa* ya!\n👉 app.edukazia.com/tutor/absensi\n\nTerima kasih! 🙏`

    const res = await sendWhatsApp({
      target: formatPhoneID(r.tutorPhone),
      message,
    })

    results.push({
      sessionId: r.sessionId,
      tutor:     r.tutorName,
      status:    res.status,
    })

    // Log ke DB — fire-and-forget
    try {
      await supabase.from('notification_logs').insert({
        type:       'wa_reminder_absensi',
        target:     formatPhoneID(r.tutorPhone),
        session_id: r.sessionId,
        payload:    { tutorName: r.tutorName, kelasLabel: r.kelasLabel },
        status:     res.status ? 'sent' : 'failed',
        response:   res.detail ?? null,
      })
    } catch (_) {}
  }

  return NextResponse.json({
    sent: results.filter(r => r.status).length,
    failed: results.filter(r => !r.status).length,
    details: results,
  })
}
