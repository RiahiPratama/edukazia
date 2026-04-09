import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendWhatsApp, formatPhoneID } from '@/lib/fonnte'

/**
 * POST /api/wa/notify-report
 * 
 * Kirim WA ke ortu saat tutor submit/update laporan belajar
 * Anti-duplikat: 1 notif per session_id + student_id per hari
 * Body: { session_id, student_id, materi }
 */

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'Asia/Jayapura',
  })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { session_id, student_id } = body

    if (!session_id || !student_id) {
      return NextResponse.json({ error: 'session_id and student_id required' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Anti-duplikat: cek apakah notif laporan sudah pernah dikirim untuk sesi + siswa ini
    const { data: existingLog } = await supabase
      .from('notification_logs')
      .select('id')
      .eq('type', 'wa_laporan_ortu')
      .eq('session_id', session_id)
      .eq('student_id', student_id)
      .limit(1)

    if (existingLog && existingLog.length > 0) {
      return NextResponse.json({ sent: false, reason: 'Already notified for this session' })
    }

    // 1. Ambil data siswa
    const { data: student } = await supabase
      .from('students')
      .select('id, profile_id, parent_profile_id, relation_phone')
      .eq('id', student_id)
      .single()

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    // 2. Ambil nama siswa
    const { data: studentProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', student.profile_id)
      .single()

    const studentName = studentProfile?.full_name ?? 'Siswa'

    // 3. Ambil data ortu
    const parentId = student.parent_profile_id ?? student.profile_id
    const { data: parentProfile } = await supabase
      .from('profiles')
      .select('full_name, phone')
      .eq('id', parentId)
      .single()

    const parentPhone = parentProfile?.phone || student.relation_phone || null

    if (!parentPhone) {
      return NextResponse.json({ sent: false, reason: 'Parent phone not found' })
    }

    // 4. Ambil data sesi
    const { data: session } = await supabase
      .from('sessions')
      .select('scheduled_at, class_group_id')
      .eq('id', session_id)
      .single()

    let kelasLabel = ''
    if (session?.class_group_id) {
      const { data: cg } = await supabase
        .from('class_groups')
        .select('label')
        .eq('id', session.class_group_id)
        .single()
      kelasLabel = cg?.label ?? ''
    }

    const tanggal = session?.scheduled_at ? fmtDate(session.scheduled_at) : ''
    const parentName = parentProfile?.full_name ?? ''
    const firstName = parentName.split(' ')[0] || 'Ayah/Bunda'

    // 5. Kirim WA
    const message = `📊 *Laporan Belajar EduKazia*\nHalo Kak ${firstName} 👋\nLaporan tutor untuk sesi *${studentName}*, telah tersedia ya.\n\n🗓️ Sesi: ${tanggal}\n🧾 Progress materi, perkembangan siswa, dan saran buat ortu bisa dibaca lengkap pada...\n↓↓↓↓↓↓\n\n🔗 app.edukazia.com/ortu/dashboard\n\nTerima kasih! 🙏`

    const result = await sendWhatsApp({
      target: formatPhoneID(parentPhone),
      message,
    })

    // 6. Log
    try {
      await supabase.from('notification_logs').insert({
        type:       'wa_laporan_ortu',
        target:     formatPhoneID(parentPhone),
        session_id,
        student_id,
        payload:    { parentName: firstName, studentName, kelasLabel },
        status:     result.status ? 'sent' : 'failed',
        response:   result.detail ?? null,
      })
    } catch (_) {}

    return NextResponse.json({ sent: result.status, detail: result.detail })
  } catch (err: any) {
    console.error('[notify-report]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
