import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendWhatsApp, formatPhoneID } from '@/lib/fonnte'

/**
 * POST /api/wa/notify-report
 * 
 * Kirim WA ke ortu saat tutor submit/update laporan belajar
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

    // ── 1. Ambil data siswa ──
    const { data: student } = await supabase
      .from('students')
      .select('id, profile_id, parent_profile_id')
      .eq('id', student_id)
      .single()

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    // ── 2. Ambil nama siswa ──
    const { data: studentProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', student.profile_id)
      .single()

    const studentName = studentProfile?.full_name ?? 'Siswa'

    // ── 3. Ambil data ortu (phone + nama) ──
    const parentId = student.parent_profile_id ?? student.profile_id
    const { data: parentProfile } = await supabase
      .from('profiles')
      .select('full_name, phone')
      .eq('id', parentId)
      .single()

    if (!parentProfile?.phone) {
      return NextResponse.json({ sent: false, reason: 'Parent phone not found' })
    }

    // ── 4. Ambil data sesi (tanggal + kelas) ──
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
    const parentName = parentProfile.full_name ?? ''
    const firstName = parentName.split(' ')[0] ?? 'Ayah/Bunda'

    // ── 5. Kirim WA ──
    const message = `📊 *Laporan Belajar EduKazia*\nHalo Kak ${firstName} 👋\nLaporan tutor untuk sesi *${studentName}*, telah tersedia ya.\n\n🗓️ Sesi: ${tanggal}\n🧾 Progress materi, perkembangan siswa, dan saran buat ortu bisa dibaca lengkap pada...\n\n↓↓↓↓↓↓\n🔗 app.edukazia.com/ortu/dashboard\n\nTerima kasih! 🙏`

    const result = await sendWhatsApp({
      target: formatPhoneID(parentProfile.phone),
      message,
    })

    // ── 6. Log ──
    try {
      await supabase.from('notification_logs').insert({
        type: 'wa_laporan_ortu',
        target: formatPhoneID(parentProfile.phone),
        session_id,
        student_id,
        payload: { parentName: firstName, studentName, kelasLabel },
        status: result.status ? 'sent' : 'failed',
        response: result.detail ?? null,
      })
    } catch (_) { }

    return NextResponse.json({ sent: result.status, detail: result.detail })
  } catch (err: any) {
    console.error('[notify-report]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
