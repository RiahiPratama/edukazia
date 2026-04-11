export const runtime = 'nodejs'

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// ─── GET: Cek apakah profile sudah punya auth user ────────────────────────────
// Usage: GET /api/admin/create-user?profile_id=xxx
export async function GET(req: NextRequest) {
  const profileId = req.nextUrl.searchParams.get('profile_id')
  if (!profileId) return NextResponse.json({ error: 'profile_id required' }, { status: 400 })

  try {
    const { data: { user }, error } = await supabase.auth.admin.getUserById(profileId)
    if (error || !user) {
      return NextResponse.json({ has_auth: false })
    }
    return NextResponse.json({ has_auth: true, email: user.email })
  } catch {
    return NextResponse.json({ has_auth: false })
  }
}

// ─── POST: Buat akun baru untuk orang tua / siswa ────────────────────────────
// Payload: { email, password, role, full_name, student_id }
// Role 'parent' → buat user auth + profile + link ke student.parent_profile_id
export async function POST(req: NextRequest) {
  try {
    const { email, password, role, full_name, student_id, phone } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'email dan password wajib diisi' }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password minimal 6 karakter' }, { status: 400 })
    }

    const cleanEmail = email.trim().toLowerCase()

    // Coba buat auth user baru langsung
    // Trigger handle_new_user() sudah pakai ON CONFLICT DO NOTHING
    // sehingga tidak akan error jika profile sudah ada
    let authUserId: string
    const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
      email:         cleanEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: full_name?.trim() || 'Orang Tua' },
    })

    if (createErr) {
      // Jika email sudah terdaftar, cari user yang ada lalu update password
      if (createErr.message?.includes('already') || createErr.message?.includes('duplicate')) {
        const { data: listData } = await supabase.auth.admin.listUsers({ perPage: 1000 })
        const existingUser = listData?.users?.find((u: any) => u.email?.toLowerCase() === cleanEmail)
        if (!existingUser) {
          return NextResponse.json({ error: createErr.message }, { status: 500 })
        }
        authUserId = existingUser.id
        await supabase.auth.admin.updateUserById(authUserId, { password })
      } else {
        return NextResponse.json({ error: createErr.message }, { status: 500 })
      }
    } else {
      if (!newUser.user) return NextResponse.json({ error: 'Gagal membuat akun' }, { status: 500 })
      authUserId = newUser.user.id
    }

    // 2. Cek apakah profile sudah ada untuk auth user ini
    // Pakai maybeSingle() — .single() throw error jika tidak ada row
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', authUserId)
      .maybeSingle()

    if (!existingProfile) {
      const { error: profileErr } = await supabase.from('profiles').upsert({
        id:        authUserId,
        full_name: full_name?.trim() || 'Orang Tua',
        role:      'student',
        email:     cleanEmail,
        phone:     phone?.trim() || null,
      }, { onConflict: 'id' })
      if (profileErr) {
        return NextResponse.json({ error: profileErr.message }, { status: 500 })
      }
    } else {
      // Update email + phone (hanya kalau phone masih kosong)
      const updateData: any = { email: cleanEmail }
      if (phone?.trim()) {
        const { data: currentProfile } = await supabase
          .from('profiles').select('phone').eq('id', authUserId).single()
        if (!currentProfile?.phone) {
          updateData.phone = phone.trim()
        }
      }
      await supabase.from('profiles').update(updateData).eq('id', authUserId)
    }

    // 3. Link ke student jika student_id diberikan
    if (student_id) {
      const { error: linkErr } = await supabase
        .from('students')
        .update({ parent_profile_id: authUserId })
        .eq('id', student_id)
      if (linkErr) {
        return NextResponse.json({ error: linkErr.message }, { status: 500 })
      }

      // 4. Sync relation_phone → profiles.phone (kalau masih kosong)
      const { data: profile } = await supabase
        .from('profiles').select('phone').eq('id', authUserId).single()

      if (!profile?.phone) {
        const { data: student } = await supabase
          .from('students').select('relation_phone').eq('id', student_id).single()

        if (student?.relation_phone) {
          await supabase.from('profiles')
            .update({ phone: student.relation_phone })
            .eq('id', authUserId)
        }
      }
    }

    return NextResponse.json({ ok: true, profile_id: authUserId })
  } catch (err: any) {
    console.error('create-user POST error:', err)
    return NextResponse.json({ error: err.message ?? 'Terjadi kesalahan' }, { status: 500 })
  }
}

// ─── PATCH: Reset password ────────────────────────────────────────────────────
// Payload: { profile_id, password }
export async function PATCH(req: NextRequest) {
  try {
    const { profile_id, password } = await req.json()

    if (!profile_id || !password) {
      return NextResponse.json({ error: 'profile_id dan password wajib diisi' }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password minimal 6 karakter' }, { status: 400 })
    }

    // Verifikasi auth user ada
    const { data: { user }, error: getUserErr } = await supabase.auth.admin.getUserById(profile_id)
    if (getUserErr || !user) {
      return NextResponse.json({ error: 'User not found — akun login belum dibuat. Buat akun terlebih dahulu.' }, { status: 404 })
    }

    // Update password + confirm email sekaligus
    // (tutor yang diinvite via email belum terconfirm sampai klik link)
    const { error: updateErr } = await supabase.auth.admin.updateUserById(profile_id, {
      password,
      email_confirm: true,
    })
    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('create-user PATCH error:', err)
    return NextResponse.json({ error: err.message ?? 'Terjadi kesalahan' }, { status: 500 })
  }
}
