import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendWhatsApp, formatPhoneID } from '@/lib/fonnte'

/**
 * POST /api/wa/notify-paket
 * 
 * Dipanggil setelah absensi disimpan
 * Cek sisa sesi, kirim WA ke ortu kalau sisa 2, 1, atau 0
 * SKIP kalau sudah ada enrollment baru (P2)
 * Handle Diri Sendiri: template personal "kamu" bukan nama orang ketiga
 * 
 * Body: { class_group_id, student_ids: string[] }
 */

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { class_group_id, student_ids } = body

    if (!class_group_id || !student_ids?.length) {
      return NextResponse.json({ error: 'class_group_id and student_ids required' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 1. Ambil class group + course + class_type
    const { data: cg } = await supabase
      .from('class_groups')
      .select('id, label, course_id, class_type_id')
      .eq('id', class_group_id)
      .single()

    const [{ data: courseData }, { data: ctData }] = await Promise.all([
      cg?.course_id ? supabase.from('courses').select('name').eq('id', cg.course_id).single() : Promise.resolve({ data: null }),
      cg?.class_type_id ? supabase.from('class_types').select('name').eq('id', cg.class_type_id).single() : Promise.resolve({ data: null }),
    ])

    const kursusLabel = [courseData?.name, ctData?.name].filter(Boolean).join(' · ')

    // 2. Ambil SEMUA enrollments aktif
    const { data: allEnrollments } = await supabase
      .from('enrollments')
      .select('id, student_id, session_start_offset, sessions_total, enrolled_at')
      .eq('class_group_id', class_group_id)
      .eq('status', 'active')

    const enrollments = (allEnrollments ?? []).filter(e => student_ids.includes(e.student_id))

    if (enrollments.length === 0) {
      return NextResponse.json({ sent: 0, message: 'No active enrollments' })
    }

    // 3. Ambil sesi completed
    const { data: completedSessions } = await supabase
      .from('sessions')
      .select('id, scheduled_at')
      .eq('class_group_id', class_group_id)
      .eq('status', 'completed')

    const completedIds = (completedSessions ?? []).map(s => s.id)

    // 4. Ambil attendances hadir
    const { data: attendances } = completedIds.length > 0
      ? await supabase
          .from('attendances')
          .select('session_id, student_id, status')
          .in('session_id', completedIds)
          .in('student_id', student_ids)
          .eq('status', 'hadir')
      : { data: [] }

    // 5. Ambil data siswa + ortu
    const { data: students } = await supabase
      .from('students')
      .select('id, profile_id, parent_profile_id, relation_phone')
      .in('id', student_ids)

    const profileIds = [...new Set((students ?? []).flatMap(s => [s.profile_id, s.parent_profile_id].filter(Boolean)))]
    const { data: profiles } = profileIds.length > 0
      ? await supabase.from('profiles').select('id, full_name, phone').in('id', profileIds)
      : { data: [] }

    const profMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))

    // 6. Hitung sisa per siswa & kirim WA
    const results: { student: string; sisa: number; sent: boolean; reason?: string }[] = []

    for (const enr of enrollments) {
      const student = (students ?? []).find(s => s.id === enr.student_id)
      if (!student) continue

      const studentName = (profMap[student.profile_id] as any)?.full_name ?? 'Siswa'
      const isDiriSendiri = student.parent_profile_id === student.profile_id

      // CEK: ada enrollment lebih baru? → skip
      const hasNewerEnrollment = (allEnrollments ?? []).some(e =>
        e.student_id === enr.student_id &&
        e.id !== enr.id &&
        new Date(e.enrolled_at) > new Date(enr.enrolled_at)
      )

      if (hasNewerEnrollment) {
        results.push({ student: studentName, sisa: -1, sent: false, reason: 'Sudah perpanjang (P2 exists)' })
        continue
      }

      // Hitung sisa
      const enrolledAt = enr.enrolled_at ? new Date(enr.enrolled_at) : new Date(0)
      const relevantSessions = (completedSessions ?? []).filter(s =>
        new Date(s.scheduled_at) >= enrolledAt
      )
      const relevantIds = relevantSessions.map(s => s.id)
      const hadirCount = (attendances ?? []).filter(a =>
        a.student_id === enr.student_id && relevantIds.includes(a.session_id)
      ).length

      const done = (enr.session_start_offset ?? 0) + hadirCount
      const total = enr.sessions_total ?? 8
      const sisa = Math.max(total - done, 0)

      if (sisa > 2) {
        results.push({ student: studentName, sisa, sent: false })
        continue
      }

      // Anti-spam per enrollment
      const notifType = sisa === 0 ? 'wa_paket_selesai' : `wa_paket_sisa_${sisa}`
      const { data: existing } = await supabase
        .from('notification_logs')
        .select('id')
        .eq('type', notifType)
        .eq('student_id', enr.student_id)
        .eq('session_id', enr.id)
        .limit(1)

      if (existing && existing.length > 0) {
        results.push({ student: studentName, sisa, sent: false, reason: 'Already sent' })
        continue
      }

      // Data penerima
      const parentId = student.parent_profile_id ?? student.profile_id
      const parentProf = profMap[parentId] as any
      const parentPhone = parentProf?.phone || student.relation_phone
      if (!parentPhone) continue

      const firstName = (parentProf?.full_name ?? '').split(' ')[0] || 'Ayah/Bunda'

      // Template pesan — Diri Sendiri vs Ortu
      let message = ''

      if (sisa === 2) {
        message = isDiriSendiri
          ? `📚 *Info Paket EduKazia*\n\nHalo Kak ${firstName} 👋\nPaket kamu untuk kursus\n*(${kursusLabel})*, tersisa\n*2 pertemuan lagi* di periode ini.\n\nYuk perpanjang sekarang biar progress\nbelajarnya tidak terputus! 💪\n\n📋 Cek laporan belajar kamu di:\n🔗 app.edukazia.com/ortu/dashboard\n\nCukup balas pesan ini:\n*"Perpanjang Paket Min"*\ndan admin EduKazia siap proses! 😊\n\n\nTerima kasih! 🙏`
          : `📚 *Info Paket EduKazia*\n\nHalo Kak ${firstName} 👋\nPaket *${studentName}* untuk kursus\n*(${kursusLabel})*, tersisa\n*2 pertemuan lagi* di periode ini.\n\nYuk perpanjang sekarang biar progress\nbelajarnya tidak terputus! 💪\n\n📋 Cek laporan belajar ${studentName} di:\n🔗 app.edukazia.com/ortu/dashboard\n\nCukup balas pesan ini:\n*"Perpanjang Paket Min"*\ndan admin EduKazia siap proses! 😊\n\n\nTerima kasih! 🙏`
      } else if (sisa === 1) {
        message = isDiriSendiri
          ? `⏳ *Sisa 1 Sesi Lagi!*\n\nHalo Kak ${firstName} 👋\n\nPaket kamu untuk kursus\n*(${kursusLabel})* hanya tersisa\n*1 sesi pertemuan terakhir* di periode ini.\n\n📋 Cek laporan belajar kamu di:\n🔗 app.edukazia.com/ortu/dashboard\n\nCukup balas pesan ini:\n*"Perpanjang Paket Berikutnya Min"*\ndan admin EduKazia siap proses! 😊\n\nTerima kasih! 🙏`
          : `⏳ *Sisa 1 Sesi Lagi!*\n\nHalo Kak ${firstName} 👋\n\nPaket *${studentName}* untuk kursus\n*(${kursusLabel})* hanya tersisa\n*1 sesi pertemuan terakhir* di periode ini.\n\n📋 Cek laporan belajar ${studentName} di:\n🔗 app.edukazia.com/ortu/dashboard\n\nCukup balas pesan ini:\n*"Perpanjang Paket Berikutnya Min"*\ndan admin EduKazia siap proses! 😊\n\nTerima kasih! 🙏`
      } else {
        message = isDiriSendiri
          ? `🎓 *Paket Selesai!*\nHalo Kak ${firstName}. 👋\n\nSelamat! Kamu telah menyelesaikan kursus\n*(${kursusLabel})*\ndengan tuntas untuk periode ini! 🎉\n\n📋 Cek laporan belajar kamu di:\n🔗 app.edukazia.com/ortu/dashboard\n\nLanjut ke periode berikutnya?\nProgress yang sudah dibangun sayang\nkalau berhenti sekarang! 🚀\n\nCukup balas pesan ini:\n*"Oke Min, Buatkan Notanya."*\ndan admin EduKazia langsung proses! 😊\n\nTerima kasih atas kepercayaannya! 🙏`
          : `🎓 *Paket Selesai!*\nHalo Kak ${firstName}. 👋\n\nSelamat! *${studentName}* telah\nmenyelesaikan kursus *(${kursusLabel})*\ndengan tuntas untuk periode ini! 🎉\n\n📋 Cek laporan belajar ${studentName} di:\n🔗 app.edukazia.com/ortu/dashboard\n\nLanjut ke periode berikutnya?\nProgress yang sudah dibangun sayang\nkalau berhenti sekarang! 🚀\n\nJika Kak ${firstName} berkenan,\nmaka Admin buatkan nota *"Perpanjangan paket"* ${studentName}.\n\nCukup balas pesan ini:\n*"Oke Min, Buatkan Notanya."*\ndan admin EduKazia langsung proses! 😊\n\nTerima kasih atas kepercayaannya! 🙏`
      }

      const res = await sendWhatsApp({
        target: formatPhoneID(parentPhone),
        message,
      })

      results.push({ student: studentName, sisa, sent: res.status })

      try {
        await supabase.from('notification_logs').insert({
          type:       notifType,
          target:     formatPhoneID(parentPhone),
          student_id: enr.student_id,
          session_id: enr.id,
          payload:    { parentName: firstName, studentName, kelasLabel: cg?.label, kursusLabel, sisa, isDiriSendiri },
          status:     res.status ? 'sent' : 'failed',
          response:   res.detail ?? null,
        })
      } catch (_) {}
    }

    return NextResponse.json({
      sent: results.filter(r => r.sent).length,
      details: results,
    })
  } catch (err: any) {
    console.error('[notify-paket]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
