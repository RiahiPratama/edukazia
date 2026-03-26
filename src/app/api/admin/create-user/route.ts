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
    const { email, password, role, full_name, student_id } = await req.json()

    if (!email || !password || !student_id) {
      return NextResponse.json({ error: 'email, password, dan student_id wajib diisi' }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password minimal 6 karakter' }, { status: 400 })
    }

    // 1. Cek apakah email sudah terdaftar di auth
    const { data: existingUsers } = await supabase.auth.admin.listUsers()
    const existingUser = existingUsers?.users.find(u => u.email === email.trim().toLowerCase())

    let authUserId: string

    if (existingUser) {
      // Email sudah terdaftar di auth — gunakan user yang ada
      authUserId = existingUser.id

      // Update password jika diminta
      await supabase.auth.admin.updateUserById(authUserId, { password })
    } else {
      // Buat auth user baru
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        email:          email.trim().toLowerCase(),
        password,
        email_confirm:  true,
      })
      if (createErr || !newUser.user) {
        return NextResponse.json({ error: createErr?.message ?? 'Gagal membuat auth user' }, { status: 500 })
      }
      authUserId = newUser.user.id
    }

    // 2. Cek apakah profile sudah ada untuk auth user ini
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', authUserId)
      .single()

    if (!existingProfile) {
      // Buat profile baru
      const { error: profileErr } = await supabase.from('profiles').insert({
        id:        authUserId,
        full_name: full_name?.trim() || 'Orang Tua',
        role:      'student', // semua user portal siswa pakai role student
        email:     email.trim().toLowerCase(),
      })
      if (profileErr) {
        return NextResponse.json({ error: profileErr.message }, { status: 500 })
      }
    } else {
      // Update email di profile jika belum ada
      await supabase.from('profiles')
        .update({ email: email.trim().toLowerCase() })
        .eq('id', authUserId)
    }

    // 3. Link ke student: set parent_profile_id
    const { error: linkErr } = await supabase
      .from('students')
      .update({ parent_profile_id: authUserId })
      .eq('id', student_id)

    if (linkErr) {
      return NextResponse.json({ error: linkErr.message }, { status: 500 })
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

    // Update password
    const { error: updateErr } = await supabase.auth.admin.updateUserById(profile_id, { password })
    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('create-user PATCH error:', err)
    return NextResponse.json({ error: err.message ?? 'Terjadi kesalahan' }, { status: 500 })
  }
}
