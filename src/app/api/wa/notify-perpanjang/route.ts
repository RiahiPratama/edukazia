import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendWhatsApp, formatPhoneID } from '@/lib/fonnte'

/**
 * POST /api/wa/notify-perpanjang
 * 
 * Kirim WA ke ortu saat admin membuat perpanjangan paket
 * Body: { student_id, class_group_id, sessions_total }
 */

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { student_id, class_group_id, sessions_total } = body

    if (!student_id || !class_group_id) {
      return NextResponse.json({ error: 'student_id and class_group_id required' }, { status: 400 })
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

    // 2. Ambil data siswa
    const { data: student } = await supabase
      .from('students')
      .select('id, profile_id, parent_profile_id, relation_phone')
      .eq('id', student_id)
      .single()

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    // 3. Ambil nama siswa + data ortu
    const profileIds = [student.profile_id, student.parent_profile_id].filter(Boolean)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, phone')
      .in('id', profileIds)

    const profMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))

    const studentName = (profMap[student.profile_id] as any)?.full_name ?? 'Siswa'
    const parentId = student.parent_profile_id ?? student.profile_id
    const parentProf = profMap[parentId] as any
    const parentPhone = parentProf?.phone || student.relation_phone

    if (!parentPhone) {
      return NextResponse.json({ sent: false, reason: 'Parent phone not found' })
    }

    const firstName = (parentProf?.full_name ?? '').split(' ')[0] || 'Ayah/Bunda'
    const totalSesi = sessions_total ?? 8

    // 4. Kirim WA
    const message = `🎉 *Perpanjangan Paket Berhasil!*\n\nHalo Kak ${firstName}. 👋\n\nPaket baru *${studentName}* untuk kursus\n*(${kursusLabel})* sudah diproses! ✅\n\n📚 Jumlah sesi: *${totalSesi} pertemuan*\n🗓️ Jadwal akan dilanjutkan otomatis\n\n📋 Pantau jadwal & progress belajar ${studentName} di:\n🔗 app.edukazia.com/ortu/dashboard\n\nTerima kasih atas kepercayaannya!`

    const result = await sendWhatsApp({
      target: formatPhoneID(parentPhone),
      message,
    })

    // 5. Log
    try {
      await supabase.from('notification_logs').insert({
        type:       'wa_perpanjang_paket',
        target:     formatPhoneID(parentPhone),
        student_id,
        payload:    { parentName: firstName, studentName, kelasLabel: cg?.label, kursusLabel, totalSesi },
        status:     result.status ? 'sent' : 'failed',
        response:   result.detail ?? null,
      })
    } catch (_) {}

    return NextResponse.json({ sent: result.status, detail: result.detail })
  } catch (err: any) {
    console.error('[notify-perpanjang]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
