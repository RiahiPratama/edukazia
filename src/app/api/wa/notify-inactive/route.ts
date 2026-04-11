import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendWhatsApp, formatPhoneID } from '@/lib/fonnte'

/**
 * POST /api/wa/notify-inactive
 * 
 * Kirim WA reminder ke ortu/siswa yang tidak aktif > 7 hari
 * Body: { profile_id?: string }
 * - Kalau profile_id dikirim → kirim ke satu orang
 * - Kalau tidak → blast semua yang tidak aktif
 */

const NOTIF_TYPE = 'wa_reminder_portal'

function buildMessage(parentName: string, studentNames: string[], isDiriSendiri: boolean, isAlsoDiriSendiri: boolean): string {
  const firstName = parentName.split(' ')[0] || 'Kakak'

  // Case 3: Ortu + Diri Sendiri (contoh: Siti Fatimah)
  if (isAlsoDiriSendiri && studentNames.length > 0) {
    const namaAnak = studentNames.join(', ')
    return `Halo Kak ${firstName} 👋\nPortal EduKazia untuk ${namaAnak} dan Kakak sendiri sudah aktif!\n\nKakak bisa:\n✅ Pantau jadwal & laporan belajar\n✅ Lihat progress setiap sesi\n✅ Materi belajar untuk ${namaAnak} dan Kakak sendiri sudah bisa dipelajari secara mandiri di rumah\n\nLogin di 👉 app.edukazia.com\n\nKalau ada kendala login, langsung chat admin di sini.\n\nTerima kasih 🙏`
  }

  // Case 2: Diri Sendiri saja (contoh: Rinna, Julaiha)
  if (isDiriSendiri || studentNames.length === 0) {
    return `Halo Kak ${firstName} 👋\nPortal EduKazia sudah aktif!\n\nKakak bisa:\n✅ Pantau jadwal & laporan belajar\n✅ Lihat progress setiap sesi\n✅ Materi belajar sudah bisa dipelajari secara mandiri di rumah\n\nLogin di 👉 app.edukazia.com\n\nKalau ada kendala login, langsung chat admin di sini.\n\nTerima kasih 🙏`
  }

  // Case 1: Ortu biasa (contoh: Darma, Mariyana)
  const namaAnak = studentNames.join(', ')
  return `Halo Kak ${firstName} 👋\nPortal EduKazia untuk ${namaAnak} sudah aktif!\n\nKakak bisa:\n✅ Pantau jadwal & laporan belajar\n✅ Lihat progress setiap sesi\n✅ Materi belajar untuk ${namaAnak} sudah bisa dipelajari secara mandiri di rumah\n\nLogin di 👉 app.edukazia.com\n\nKalau ada kendala login, langsung chat admin di sini.\n\nTerima kasih 🙏`
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const targetProfileId = body.profile_id ?? null

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 1. Cari user yang bisa login (punya email), exclude admin
    const { data: allProfiles } = await supabase
      .from('profiles')
      .select('id, full_name, phone, role, email')
      .in('role', ['parent', 'tutor', 'student'])
      .not('email', 'is', null)

    if (!allProfiles || allProfiles.length === 0) {
      return NextResponse.json({ sent: 0, message: 'No profiles found' })
    }

    // 2. Cari yang aktif minggu ini
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    const { data: weekData } = await supabase
      .from('user_activity')
      .select('user_id')
      .neq('user_role', 'admin')
      .gte('created_at', weekAgo.toISOString())

    const activeIds = new Set(weekData?.map(d => d.user_id) ?? [])

    // 3. Filter tidak aktif
    let inactiveProfiles = allProfiles.filter(p => !activeIds.has(p.id))

    // Kalau target spesifik
    if (targetProfileId) {
      inactiveProfiles = inactiveProfiles.filter(p => p.id === targetProfileId)
      if (inactiveProfiles.length === 0) {
        return NextResponse.json({ sent: 0, message: 'User is active or not found' })
      }
    }

    // 4. Anti-spam: cek siapa yang udah di-WA tipe ini dalam 7 hari terakhir
    const inactiveIds = inactiveProfiles.map(p => p.id)
    const { data: recentNotifs } = await supabase
      .from('notification_logs')
      .select('target, payload')
      .eq('type', NOTIF_TYPE)
      .eq('status', 'sent')
      .gte('created_at', weekAgo.toISOString())

    const recentTargets = new Set<string>()
    recentNotifs?.forEach(n => {
      const pid = (n.payload as any)?.profile_id
      if (pid) recentTargets.add(pid)
    })

    // 5. Ambil data siswa untuk setiap ortu
    const { data: allStudents } = await supabase
      .from('students')
      .select('id, profile_id, parent_profile_id, relation_phone')
      .in('parent_profile_id', inactiveIds)

    const studentProfileIds = [...new Set((allStudents ?? []).map(s => s.profile_id).filter(Boolean))]
    const { data: studentProfiles } = studentProfileIds.length > 0
      ? await supabase.from('profiles').select('id, full_name').in('id', studentProfileIds)
      : { data: [] }

    const studentNameMap: Record<string, string> = {}
    studentProfiles?.forEach(p => { studentNameMap[p.id] = p.full_name ?? '' })

    // 6. Kirim per orang
    const results: { name: string; sent: boolean; reason?: string }[] = []

    for (const prof of inactiveProfiles) {
      // Anti-spam check
      if (recentTargets.has(prof.id)) {
        results.push({ name: prof.full_name, sent: false, reason: 'Sudah dikirim dalam 7 hari' })
        continue
      }

      // Cari anak-anak dari ortu ini + nomor WA (fallback ke relation_phone)
      const children = (allStudents ?? []).filter(s => s.parent_profile_id === prof.id)
      const phone = prof.phone || children.find(c => c.relation_phone)?.relation_phone
      if (!phone) {
        results.push({ name: prof.full_name, sent: false, reason: 'Tidak ada nomor HP' })
        continue
      }

      const hasSelfAsStudent = children.some(c => c.profile_id === prof.id)
      const realChildren = children.filter(c => c.profile_id !== prof.id)
      const isDiriSendiri = hasSelfAsStudent && realChildren.length === 0
      const isAlsoDiriSendiri = hasSelfAsStudent && realChildren.length > 0
      const childNames = realChildren.map(c => studentNameMap[c.profile_id] ?? '').filter(Boolean)

      const message = buildMessage(prof.full_name, childNames, isDiriSendiri, isAlsoDiriSendiri)

      const res = await sendWhatsApp({
        target: formatPhoneID(phone),
        message,
      })

      results.push({ name: prof.full_name, sent: res.status, reason: res.status ? undefined : res.detail })

      // Log
      try {
        await supabase.from('notification_logs').insert({
          type: NOTIF_TYPE,
          target: formatPhoneID(phone),
          payload: {
            profile_id: prof.id,
            parentName: prof.full_name,
            studentNames: childNames,
            isDiriSendiri,
            isAlsoDiriSendiri,
          },
          status: res.status ? 'sent' : 'failed',
          response: res.detail ?? null,
        })
      } catch (_) {}
    }

    return NextResponse.json({
      sent: results.filter(r => r.sent).length,
      skipped: results.filter(r => !r.sent).length,
      details: results,
    })
  } catch (err: any) {
    console.error('[notify-inactive]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
