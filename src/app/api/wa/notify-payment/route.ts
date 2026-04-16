import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendWhatsApp, formatPhoneID } from '@/lib/fonnte'

/**
 * POST /api/wa/notify-payment
 *
 * Dipanggil saat admin membuat tagihan dengan status 'paid'
 * atau saat admin klik "Konfirmasi Lunas" pada tagihan pending.
 * Kirim WA konfirmasi pembayaran diterima ke ortu/siswa.
 * Handle Diri Sendiri: template personal "kamu".
 *
 * Body: { student_id, class_group_id, amount, period_label? }
 */

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { student_id, class_group_id, amount, period_label } = body

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
      cg?.course_id
        ? supabase.from('courses').select('name').eq('id', cg.course_id).single()
        : Promise.resolve({ data: null }),
      cg?.class_type_id
        ? supabase.from('class_types').select('name').eq('id', cg.class_type_id).single()
        : Promise.resolve({ data: null }),
    ])

    const kursusLabel = [courseData?.name, ctData?.name].filter(Boolean).join(' · ')

    // 2. Ambil data siswa + ortu
    const { data: student } = await supabase
      .from('students')
      .select('id, profile_id, parent_profile_id, relation_phone')
      .eq('id', student_id)
      .single()

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    const profileIds = [student.profile_id, student.parent_profile_id].filter(Boolean)
    const { data: profiles } = profileIds.length > 0
      ? await supabase.from('profiles').select('id, full_name, phone').in('id', profileIds)
      : { data: [] }

    const profMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))

    const studentName   = (profMap[student.profile_id] as any)?.full_name ?? 'Siswa'
    const isDiriSendiri = student.parent_profile_id === student.profile_id
    const parentId      = student.parent_profile_id ?? student.profile_id
    const parentProf    = profMap[parentId] as any
    const parentPhone   = parentProf?.phone || student.relation_phone

    if (!parentPhone) {
      return NextResponse.json({ sent: false, reason: 'Parent phone not found' })
    }

    const firstName = (parentProf?.full_name ?? '').split(' ')[0] || 'Ayah/Bunda'

    // 3. Format nominal
    const nominalFmt = new Intl.NumberFormat('id-ID', {
      style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
    }).format(amount ?? 0)

    // 4. Period line (opsional)
    const periodLine = period_label ? `\n🗓️ Periode: *${period_label}*` : ''

    // 5. Build message — handle Diri Sendiri
    const message = isDiriSendiri
      ? `✅ *Pembayaran Diterima!*\n\nHalo Kak ${firstName} 👋\n\nPembayaran kamu untuk kursus\n*(${kursusLabel})*\nsebesar *${nominalFmt}*\ntelah kami terima. ✅${periodLine}\n\n📋 Pantau progress belajar kamu di:\n🔗 app.edukazia.com/ortu/dashboard\n\nTerima kasih atas kepercayaannya! 🙏`
      : `✅ *Pembayaran Diterima!*\n\nHalo Kak ${firstName} 👋\n\nPembayaran kursus *${studentName}*\n*(${kursusLabel})*\nsebesar *${nominalFmt}*\ntelah kami terima. ✅${periodLine}\n\n📋 Pantau progress belajar ${studentName} di:\n🔗 app.edukazia.com/ortu/dashboard\n\nTerima kasih atas kepercayaannya! 🙏`

    // 6. Kirim WA
    const result = await sendWhatsApp({
      target: formatPhoneID(parentPhone),
      message,
    })

    // 7. Log
    try {
      await supabase.from('notification_logs').insert({
        type:       'wa_payment_confirmed',
        target:     formatPhoneID(parentPhone),
        student_id,
        payload:    { parentName: firstName, studentName, kursusLabel, amount, period_label, isDiriSendiri },
        status:     result.status ? 'sent' : 'failed',
        response:   result.detail ?? null,
      })
    } catch (_) {}

    return NextResponse.json({ sent: result.status, detail: result.detail })
  } catch (err: any) {
    console.error('[notify-payment]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
