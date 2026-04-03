import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

function createClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          try { return cookieStore.getAll() } catch { return [] }
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}

// ── GET — ambil semua pembayaran honor ────────────────────────────────────────
export async function GET() {
  try {
    const supabase = createClient()

    const { data: payments, error } = await supabase
      .from('tutor_honor_payments')
      .select('id, tutor_id, enrollment_id, amount, sessions_count, scheme, paid_at, notes, created_at')
      .order('paid_at', { ascending: false })

    if (error) throw error
    if (!payments || payments.length === 0) {
      return NextResponse.json({ payments: [] })
    }

    // Fetch tutors
    const tutorIds = [...new Set(payments.map((p) => p.tutor_id).filter(Boolean))]
    const { data: tutors } = await supabase
      .from('tutors')
      .select('id, profile_id, rate_per_session')
      .in('id', tutorIds)

    // Fetch profiles tutor
    const tProfileIds = (tutors ?? []).map((t) => t.profile_id).filter(Boolean)
    const { data: tProfiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', tProfileIds)

    // Fetch enrollments → class_group_id + student_id
    const enrollmentIds = [...new Set(payments.map((p) => p.enrollment_id).filter(Boolean))]
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('id, class_group_id, student_id')
      .in('id', enrollmentIds)

    // Fetch class_groups → course_id + class_type_id
    const cgIds = [...new Set((enrollments ?? []).map((e) => e.class_group_id).filter(Boolean))]
    const { data: classGroups } = await supabase
      .from('class_groups')
      .select('id, course_id, class_type_id')
      .in('id', cgIds)

    // Fetch courses
    const courseIds = [...new Set((classGroups ?? []).map((c) => c.course_id).filter(Boolean))]
    const { data: courses } = await supabase
      .from('courses')
      .select('id, name')
      .in('id', courseIds)

    // Fetch class_types
    const ctIds = [...new Set((classGroups ?? []).map((c) => c.class_type_id).filter(Boolean))]
    const { data: classTypes } = await supabase
      .from('class_types')
      .select('id, name')
      .in('id', ctIds)

    // Fetch students → profile_id
    const studentIds = [...new Set((enrollments ?? []).map((e) => e.student_id).filter(Boolean))]
    const { data: students } = await supabase
      .from('students')
      .select('id, profile_id')
      .in('id', studentIds)

    // Fetch profiles siswa
    const sProfileIds = (students ?? []).map((s) => s.profile_id).filter(Boolean)
    const { data: sProfiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', sProfileIds)

    // Lookup maps
    const tutorMap = new Map((tutors ?? []).map((t) => [t.id, t]))
    const tProfileMap = new Map((tProfiles ?? []).map((p) => [p.id, p]))
    const enrollmentMap = new Map((enrollments ?? []).map((e) => [e.id, e]))
    const cgMap = new Map((classGroups ?? []).map((c) => [c.id, c]))
    const courseMap = new Map((courses ?? []).map((c) => [c.id, c]))
    const ctMap = new Map((classTypes ?? []).map((c) => [c.id, c]))
    const studentMap = new Map((students ?? []).map((s) => [s.id, s]))
    const sProfileMap = new Map((sProfiles ?? []).map((p) => [p.id, p]))

    // Merge
    const merged = payments.map((p) => {
      const tutor = tutorMap.get(p.tutor_id)
      const tProfile = tProfileMap.get(tutor?.profile_id)
      const enrollment = enrollmentMap.get(p.enrollment_id)
      const cg = cgMap.get(enrollment?.class_group_id)
      const course = courseMap.get(cg?.course_id)
      const ct = ctMap.get(cg?.class_type_id)
      const student = studentMap.get(enrollment?.student_id)
      const sProfile = sProfileMap.get(student?.profile_id)

      return {
        id: p.id,
        tutor_id: p.tutor_id,
        tutor_name: tProfile?.full_name ?? '—',
        enrollment_id: p.enrollment_id,
        student_name: sProfile?.full_name ?? '—',
        course_name: course?.name ?? '—',
        class_type: ct?.name ?? '—',
        amount: p.amount,
        sessions_count: p.sessions_count,
        scheme: p.scheme,
        paid_at: p.paid_at,
        notes: p.notes,
        created_at: p.created_at,
      }
    })

    return NextResponse.json({ payments: merged })
  } catch (err: any) {
    console.error('[GET tutor-honor]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ── POST — catat pembayaran honor baru ────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const supabase = createClient()
    const body = await req.json()

    const { tutor_id, enrollment_id, amount, sessions_count, scheme, paid_at, notes } = body

    // Validasi wajib
    if (!tutor_id || !enrollment_id || !amount || !paid_at || !scheme) {
      return NextResponse.json(
        { error: 'tutor_id, enrollment_id, amount, scheme, dan paid_at wajib diisi' },
        { status: 400 }
      )
    }

    // Validasi scheme
    if (!['prepaid', 'postpaid'].includes(scheme)) {
      return NextResponse.json(
        { error: 'scheme harus prepaid atau postpaid' },
        { status: 400 }
      )
    }

    // Ambil admin yang sedang login untuk created_by
    const { data: { user } } = await supabase.auth.getUser()
    const { data: adminProfile } = user
      ? await supabase.from('profiles').select('id').eq('id', user.id).single()
      : { data: null }

    const { data, error } = await supabase
      .from('tutor_honor_payments')
      .insert({
        tutor_id,
        enrollment_id,
        amount: Number(amount),
        sessions_count: Number(sessions_count ?? 8),
        scheme,
        paid_at,
        notes: notes || null,
        created_by: adminProfile?.id ?? null,
      })
      .select('id')
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, id: data.id })
  } catch (err: any) {
    console.error('[POST tutor-honor]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
