import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

function makeSupabase() {
  const cookieStore = cookies()
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

// POST — buat progress baru
export async function POST(req: NextRequest) {
  const supabase = makeSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { material_id, student_id, is_read } = await req.json()
  if (!material_id || !student_id) {
    return NextResponse.json({ error: 'material_id dan student_id wajib diisi.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('material_progress')
    .upsert(
      { material_id, student_id, is_read, read_at: is_read ? new Date().toISOString() : null },
      { onConflict: 'material_id,student_id' }
    )
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ progress_id: data.id })
}

// PATCH — update progress yang sudah ada
export async function PATCH(req: NextRequest) {
  const supabase = makeSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { progress_id, is_read } = await req.json()
  if (!progress_id) {
    return NextResponse.json({ error: 'progress_id wajib diisi.' }, { status: 400 })
  }

  const { error } = await supabase
    .from('material_progress')
    .update({ is_read, read_at: is_read ? new Date().toISOString() : null })
    .eq('id', progress_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
