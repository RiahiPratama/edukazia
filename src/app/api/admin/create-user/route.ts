import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function getCallerSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options))
          } catch {}
        },
      },
    }
  )
}

async function verifyAdmin(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: caller } = await supabaseAdmin
    .from('profiles').select('role').eq('id', user.id).single()
  if (!caller || caller.role !== 'admin') return null
  return user
}

// ── POST: buat akun baru (siswa atau ortu) ──
export async function POST(req: NextRequest) {
  const supabase = await getCallerSupabase()
  const adminUser = await verifyAdmin(supabase)
  if (!adminUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { email, password, role, full_name, phone, profile_id, student_id } = body

  if (!email || !password || !role) {
    return NextResponse.json({ error: 'email, password, dan role wajib diisi.' }, { status: 400 })
  }

  let createdAuthId: string | null = null

  try {
    if (profile_id) {
      // Kasus: buat auth user untuk profile siswa yang sudah ada
      const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email, password, email_confirm: true,
      })
      if (authErr) throw new Error(authErr.message)
      createdAuthId = authUser.user.id

      const { error: updateErr } = await supabaseAdmin
        .from('profiles').update({ id: authUser.user.id, email }).eq('id', profile_id)
      if (updateErr) throw new Error(updateErr.message)

      return NextResponse.json({ user_id: authUser.user.id, profile_id })

    } else {
      // Kasus: buat auth user + profile baru (ortu/parent)
      const { data: existing } = await supabaseAdmin
        .from('profiles').select('id').eq('email', email).single()

      if (existing) {
        // Email sudah ada — tautkan ke student jika ada student_id
        if (student_id && role === 'parent') {
          await supabaseAdmin.from('students')
            .update({ parent_profile_id: existing.id })
            .eq('id', student_id)
        }
        return NextResponse.json({ user_id: existing.id, profile_id: existing.id })
      }

      const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { full_name: full_name ?? 'Pengguna Baru', phone: phone ?? null }
      })
      if (authErr) throw new Error(authErr.message)
      createdAuthId = authUser.user.id

      const { data: updatedProfile, error: profileErr } = await supabaseAdmin
        .from('profiles')
        .update({ full_name: full_name ?? null, phone: phone ?? null, email, role })
        .eq('id', authUser.user.id)
        .select('id').single()
      if (profileErr) throw new Error(profileErr.message)

      // Tautkan parent ke student jika ada student_id
      if (student_id && role === 'parent') {
        await supabaseAdmin.from('students')
          .update({ parent_profile_id: updatedProfile.id })
          .eq('id', student_id)
      }

      return NextResponse.json({ user_id: authUser.user.id, profile_id: updatedProfile.id })
    }

  } catch (err: any) {
    if (createdAuthId) await supabaseAdmin.auth.admin.deleteUser(createdAuthId)
    return NextResponse.json({ error: err.message ?? 'Terjadi kesalahan.' }, { status: 500 })
  }
}

// ── PATCH: reset password ──
export async function PATCH(req: NextRequest) {
  const supabase = await getCallerSupabase()
  const adminUser = await verifyAdmin(supabase)
  if (!adminUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { profile_id, password } = body

  if (!profile_id || !password) {
    return NextResponse.json({ error: 'profile_id dan password wajib diisi.' }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'Password minimal 6 karakter.' }, { status: 400 })
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(profile_id, { password })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
