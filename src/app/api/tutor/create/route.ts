import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// ── Gunakan service role key agar bisa buat Auth user ──
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      email,
      full_name,
      phone,
      rate_per_session,
      bank_name,
      bank_account,
      bank_holder,
      is_active,
      tutor_type,
      is_owner,
      bimbel_name,
      education_level,
      education_major,
      education_university,
      education_year,
      subjects,
      teaching_experience_years,
      previous_workplaces,
      bio,
      achievements,
      selectedCourses,
    } = body

    // Validasi minimal
    if (!email?.trim()) {
      return NextResponse.json({ error: 'Email wajib diisi untuk invite tutor.' }, { status: 400 })
    }

    // ── 1. Invite user via email → tutor dapat link set password ──
    // PENTING: Kirim full_name di raw_user_meta_data agar trigger handle_new_user() bisa ambil
    const { data: inviteData, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email.trim(),
      { data: { full_name: full_name.trim(), role: 'tutor' } }
    )

    if (inviteErr || !inviteData?.user) {
      return NextResponse.json(
        { error: inviteErr?.message ?? 'Gagal mengirim invite email.' },
        { status: 400 }
      )
    }

    const authId = inviteData.user.id

    // ── 2. UPDATE profile yang sudah auto-created oleh trigger handle_new_user() ──
    // Trigger sudah create profile dengan role='student', kita update jadi role='tutor'
    const { error: profileErr } = await supabaseAdmin
      .from('profiles')
      .update({
        full_name: full_name.trim(),
        phone:     phone?.trim() || null,
        email:     email.trim(),
        role:      'tutor',
      })
      .eq('id', authId)

    if (profileErr) {
      // Rollback: hapus auth user yang sudah dibuat
      await supabaseAdmin.auth.admin.deleteUser(authId)
      return NextResponse.json({ error: profileErr.message }, { status: 400 })
    }

    // ── 3. Buat tutor (profile_id = auth.id) ──
    const { data: tutor, error: tutorErr } = await supabaseAdmin
      .from('tutors')
      .insert({
        profile_id:                authId,
        rate_per_session:          rate_per_session ? parseInt(rate_per_session) : 0,
        bank_name:                 bank_name?.trim() || null,
        bank_account:              bank_account?.trim() || null,
        bank_holder:               bank_holder?.trim() || null,
        is_active:                 is_active ?? true,
        tutor_type:                tutor_type ?? 'internal',
        is_owner:                  is_owner ?? false,
        bimbel_name:               bimbel_name?.trim() || null,
        education_level:           education_level || null,
        education_major:           education_major?.trim() || null,
        education_university:      education_university?.trim() || null,
        education_year:            education_year ? parseInt(education_year) : null,
        subjects:                  subjects?.length > 0 ? subjects : null,
        teaching_experience_years: teaching_experience_years ? parseInt(teaching_experience_years) : null,
        previous_workplaces:       previous_workplaces?.trim() || null,
        bio:                       bio?.trim() || null,
        achievements:              achievements?.length > 0 ? achievements : [],
      })
      .select('id')
      .single()

    if (tutorErr || !tutor) {
      // Rollback: hapus auth user & profile
      await supabaseAdmin.auth.admin.deleteUser(authId)
      return NextResponse.json({ error: tutorErr?.message ?? 'Gagal menyimpan tutor.' }, { status: 400 })
    }

    // ── 4. Simpan kursus ──
    if (selectedCourses?.length > 0) {
      await supabaseAdmin
        .from('tutor_courses')
        .insert(selectedCourses.map((courseId: string) => ({ tutor_id: tutor.id, course_id: courseId })))
    }

    return NextResponse.json({ success: true, tutorId: tutor.id })

  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Terjadi kesalahan.' }, { status: 500 })
  }
}
