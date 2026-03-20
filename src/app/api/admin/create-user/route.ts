import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
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

  // Verifikasi caller adalah admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: caller } = await supabaseAdmin
    .from('profiles').select('role').eq('id', user.id).single()

  if (!caller || caller.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { email, password, role, full_name, phone, profile_id } = body

  if (!email || !password || !role) {
    return NextResponse.json({ error: 'email, password, dan role wajib diisi.' }, { status: 400 })
  }

  // Track apa yang sudah dibuat untuk rollback
  let createdAuthId: string | null = null
  let createdProfileId: string | null = null

  try {
    if (profile_id) {
      // ── Kasus: buat auth user untuk profile siswa yang sudah ada ──
      const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })
      if (authErr) throw new Error(authErr.message)
      createdAuthId = authUser.user.id

      // Update profile id siswa agar sama dengan auth user id
      const { error: updateErr } = await supabaseAdmin
        .from('profiles')
        .update({ id: authUser.user.id, email })
        .eq('id', profile_id)

      if (updateErr) throw new Error(updateErr.message)

      return NextResponse.json({ user_id: authUser.user.id, profile_id })

    } else {
      // ── Kasus: buat auth user + profile baru (ortu/parent) ──

      // Cek dulu apakah email sudah ada di profiles
      const { data: existing } = await supabaseAdmin
        .from('profiles').select('id').eq('email', email).single()

      if (existing) {
        // Email sudah ada — pakai profile yang ada
        return NextResponse.json({ user_id: existing.id, profile_id: existing.id })
      }

      // Buat auth user — trigger akan otomatis insert ke profiles
      const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: full_name ?? 'Pengguna Baru',
          phone:     phone     ?? null,
        }
      })
      if (authErr) throw new Error(authErr.message)
      createdAuthId = authUser.user.id

      // Update profile yang sudah dibuat trigger dengan data yang benar
      const { data: updatedProfile, error: profileErr } = await supabaseAdmin
        .from('profiles')
        .update({
          full_name: full_name ?? null,
          phone:     phone     ?? null,
          email:     email,
          role:      role,
        })
        .eq('id', authUser.user.id)
        .select('id')
        .single()

      if (profileErr) throw new Error(profileErr.message)

      return NextResponse.json({ user_id: authUser.user.id, profile_id: updatedProfile.id })
    }

  } catch (err: any) {
    // ── Rollback: hapus semua yang sudah dibuat ──
    if (createdAuthId) {
      await supabaseAdmin.auth.admin.deleteUser(createdAuthId)
    }
    if (createdProfileId) {
      await supabaseAdmin.from('profiles').delete().eq('id', createdProfileId)
    }
    return NextResponse.json({ error: err.message ?? 'Terjadi kesalahan.' }, { status: 500 })
  }
}
