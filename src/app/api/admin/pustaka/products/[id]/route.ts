import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

async function getAdminSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (all) => { try { all.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {} }
      }
    }
  )
}

async function guardAdmin(supabase: ReturnType<typeof createServerClient>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return null
  return user
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await getAdminSupabase()
    const user = await guardAdmin(supabase)
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data: product, error } = await supabase
      .from('digital_products')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !product) {
      return NextResponse.json({ error: 'Produk tidak ditemukan' }, { status: 404 })
    }

    return NextResponse.json({ product })

  } catch (err: unknown) {
    console.error('[API /admin/pustaka/products/[id] GET]', err)
    return NextResponse.json({ error: 'Gagal memuat produk' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await getAdminSupabase()
    const user = await guardAdmin(supabase)
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json()

    // Kalau update thumbnail_url (setelah upload storage)
    const allowed = [
      'title', 'slug', 'description', 'subject', 'level_label',
      'product_type', 'price', 'is_free_for_enrolled', 'is_published',
      'course_id', 'level_id', 'thumbnail_url'
    ]

    const updates: Record<string, unknown> = {}
    allowed.forEach(key => {
      if (body[key] !== undefined) updates[key] = body[key]
    })

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Tidak ada field yang diupdate' }, { status: 400 })
    }

    // Kalau ada slug baru, cek unique
    if (updates.slug) {
      const { data: existing } = await supabase
        .from('digital_products')
        .select('id')
        .eq('slug', updates.slug as string)
        .neq('id', id)
        .single()

      if (existing) {
        return NextResponse.json({ error: 'Slug sudah dipakai produk lain' }, { status: 409 })
      }
    }

    const { data: product, error } = await supabase
      .from('digital_products')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ product })

  } catch (err: unknown) {
    console.error('[API /admin/pustaka/products/[id] PATCH]', err)
    return NextResponse.json({ error: 'Gagal update produk' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await getAdminSupabase()
    const user = await guardAdmin(supabase)
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Cek ada pembelian aktif - jangan hapus kalau ada
    const { data: purchases } = await supabase
      .from('digital_purchases')
      .select('id')
      .eq('product_id', id)
      .eq('is_active', true)
      .limit(1)

    if (purchases && purchases.length > 0) {
      return NextResponse.json(
        { error: 'Produk tidak bisa dihapus karena ada pembelian aktif' },
        { status: 409 }
      )
    }

    const { error } = await supabase
      .from('digital_products')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })

  } catch (err: unknown) {
    console.error('[API /admin/pustaka/products/[id] DELETE]', err)
    return NextResponse.json({ error: 'Gagal hapus produk' }, { status: 500 })
  }
}
