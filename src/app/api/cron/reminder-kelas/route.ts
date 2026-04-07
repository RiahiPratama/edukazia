import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendWhatsApp, formatPhoneID } from '@/lib/fonnte'

/**
 * Cron: Reminder 10 menit sebelum kelas mulai
 * Kirim WA ke ortu/wali siswa
 * Trigger: cron-job.org setiap 5 menit
 */

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('id-ID', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jayapura',
  })
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const now = new Date()
  const nowMs = now.getTime()

  const todayWIT = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Jayapura' })
  const startUtc = new Date(todayWIT + 'T00:00:00+09:00').toISOString()
  const endUtc   = new Date(todayWIT + 'T23:59:59+09:00').toISOString()

  // 1. Ambil sesi scheduled hari ini
  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, scheduled_at, class_group_id, zoom_link')
    .eq('status', 'scheduled')
    .gte('scheduled_at', startUtc)
    .lte('scheduled_at', endUtc)

  if (!sessions || sessions.length === 0) {
    return NextResponse.json({ sent: 0, message: 'No sessions today' })
  }

  // 2. Filter sesi yang mulai dalam ~10 menit (window ±8 menit)
  const targetSessions = sessions.filter(s => {
    const startMs = new Date(s.scheduled_at).getTime()
    const reminderMs = startMs - 10 * 60 * 1000
    const diff = nowMs - reminderMs
    return diff >= -480_000 && diff <= 480_000
  })

  if (targetSessions.length === 0) {
    return NextResponse.json({ sent: 0, message: 'No classes starting in ~10 min' })
  }

  // 3. Ambil class groups + courses + class_types + enrollments
  const cgIds = [...new Set(targetSessions.map(s => s.class_group_id))]

  const [{ data: classGroups }, { data: enrollments }] = await Promise.all([
    supabase.from('class_groups').select('id, label, zoom_link, course_id, class_type_id').in('id', cgIds),
    supabase.from('enrollments').select('student_id, class_group_id').in('class_group_id', cgIds).eq('status', 'active'),
  ])

  if (!enrollments || enrollments.length === 0) {
    return NextResponse.json({ sent: 0, message: 'No active enrollments' })
  }

  const courseIds = [...new Set((classGroups ?? []).map((cg: any) => cg.course_id).filter(Boolean))]
  const ctIds = [...new Set((classGroups ?? []).map((cg: any) => cg.class_type_id).filter(Boolean))]

  const [{ data: courses }, { data: classTypes }] = await Promise.all([
    courseIds.length > 0 ? supabase.from('courses').select('id, name').in('id', courseIds) : Promise.resolve({ data: [] }),
    ctIds.length > 0 ? supabase.from('class_types').select('id, name').in('id', ctIds) : Promise.resolve({ data: [] }),
  ])

  const courseMap = Object.fromEntries((courses ?? []).map(c => [c.id, c.name]))
  const ctMap = Object.fromEntries((classTypes ?? []).map(c => [c.id, c.name]))

  const studentIds = [...new Set(enrollments.map(e => e.student_id))]

  const { data: students } = await supabase
    .from('students')
    .select('id, profile_id, parent_profile_id, relation_phone')
    .in('id', studentIds)

  const profileIds = [...new Set((students ?? []).flatMap(s => [s.profile_id, s.parent_profile_id].filter(Boolean)))]
  const { data: profiles } = profileIds.length > 0
    ? await supabase.from('profiles').select('id, full_name, phone').in('id', profileIds)
    : { data: [] }

  const profMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))

  // 4. Cek notifikasi yang sudah dikirim (hindari duplikat)
  const sessionIds = targetSessions.map(s => s.id)
  const { data: existingLogs } = await supabase
    .from('notification_logs')
    .select('session_id, student_id')
    .eq('type', 'wa_reminder_kelas')
    .in('session_id', sessionIds)

  const sentSet = new Set((existingLogs ?? []).map(l => `${l.session_id}-${l.student_id}`))

  // 5. Kirim WA
  const results: { student: string; status: boolean }[] = []

  for (const sesi of targetSessions) {
    const cg = (classGroups ?? []).find(c => c.id === sesi.class_group_id)
    const zoomLink = sesi.zoom_link ?? cg?.zoom_link ?? null
    const courseName = courseMap[cg?.course_id] ?? ''
    const classTypeName = ctMap[cg?.class_type_id] ?? ''
    const kursusLabel = [courseName, classTypeName].filter(Boolean).join(' · ')
    const waktu = fmtTime(sesi.scheduled_at)

    const sesiEnrollments = (enrollments ?? []).filter(e => e.class_group_id === sesi.class_group_id)

    for (const enr of sesiEnrollments) {
      const key = `${sesi.id}-${enr.student_id}`
      if (sentSet.has(key)) continue

      const student = (students ?? []).find(s => s.id === enr.student_id)
      if (!student) continue

      const studentProf = profMap[student.profile_id]
      const studentName = (studentProf as any)?.full_name ?? 'Siswa'

      const parentId = student.parent_profile_id ?? student.profile_id
      const parentProf = profMap[parentId]
      const parentPhone = (parentProf as any)?.phone || student.relation_phone
      if (!parentPhone) continue

      const firstName = ((parentProf as any)?.full_name ?? '').split(' ')[0] || 'Ayah/Bunda'

      let message = `🔔 *Reminder EduKazia*\n\nHalo Kak ${firstName}. 👋\n\nKelas *${studentName}* untuk kursus\n*(${kursusLabel})* akan dimulai\n*10 menit lagi!*\n\n🕐 Jadwal Zoom: ${waktu} WIT\n👩‍💻 Pastikan *${studentName}* sudah standby\n   di Zoom 3 menit sebelum kelas ya!`

      if (zoomLink) {
        message += `\n🔗 Zoom: ${zoomLink}`
      }

      message += `\n\n🍪 Jangan lupa siapkan cemilan atau air mineral\n   biar ${studentName} makin semangat belajar!\n\nTerima kasih! 🙏`

      const res = await sendWhatsApp({
        target: formatPhoneID(parentPhone),
        message,
      })

      results.push({ student: studentName, status: res.status })

      try {
        await supabase.from('notification_logs').insert({
          type:       'wa_reminder_kelas',
          target:     formatPhoneID(parentPhone),
          session_id: sesi.id,
          student_id: enr.student_id,
          payload:    { parentName: firstName, studentName, kelasLabel: cg?.label, kursusLabel },
          status:     res.status ? 'sent' : 'failed',
          response:   res.detail ?? null,
        })
      } catch (_) {}
    }
  }

  return NextResponse.json({
    sent: results.filter(r => r.status).length,
    failed: results.filter(r => !r.status).length,
    details: results,
  })
}
