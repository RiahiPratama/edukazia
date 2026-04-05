import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (all) => { try { all.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {} }
        }
      }
    )

    // Guard: admin only
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Query produk semua (termasuk draft)
    const { data: products, error } = await supabase
      .from('digital_products')
      .select('id, title, slug, subject, level_label, product_type, thumbnail_url, price, is_free_for_enrolled, is_published, created_at')
      .order('created_at', { ascending: false })

    if (error) throw error

    // Hitung konten & slide per produk
    const ids = (products || []).map(p => p.id)
    let contentMap: Record<string, number> = {}
    let slideMap:   Record<string, number> = {}

    if (ids.length > 0) {
      const { data: contents } = await supabase
        .from('digital_contents')
        .select('product_id')
        .in('product_id', ids)

      const { data: slides } = await supabase
        .from('digital_slides')
        .select('product_id')
        .in('product_id', ids)

      contents?.forEach(c => { contentMap[c.product_id] = (contentMap[c.product_id] || 0) + 1 })
      slides?.forEach(s => { slideMap[s.product_id] = (slideMap[s.product_id] || 0) + 1 })
    }

    const result = (products || []).map(p => ({
      ...p,
      content_count: contentMap[p.id] || 0,
      slide_count:   slideMap[p.id]   || 0,
    }))

    return NextResponse.json({ products: result })

  } catch (err: unknown) {
    console.error('[API /admin/pustaka/products GET]', err)
    return NextResponse.json({ error: 'Gagal memuat produk' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (all) => { try { all.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {} }
        }
      }
    )

    // Guard: admin only
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { title, slug, description, subject, level_label, product_type, price, is_free_for_enrolled, course_id, level_id, is_published } = body

    if (!title || !slug || !subject || !product_type) {
      return NextResponse.json({ error: 'Field wajib tidak lengkap' }, { status: 400 })
    }

    // Cek slug unique
    const { data: existing } = await supabase
      .from('digital_products')
      .select('id')
      .eq('slug', slug)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'Slug sudah dipakai' }, { status: 409 })
    }

    const { data: product, error } = await supabase
      .from('digital_products')
      .insert({
        title,
        slug,
        description:          description || null,
        subject,
        level_label:          level_label || null,
        product_type,
        price:                price || 0,
        is_free_for_enrolled: is_free_for_enrolled ?? true,
        course_id:            course_id || null,
        level_id:             level_id  || null,
        is_published:         is_published ?? false,
        created_by:           user.id
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ product }, { status: 201 })

  } catch (err: unknown) {
    console.error('[API /admin/pustaka/products POST]', err)
    return NextResponse.json({ error: 'Gagal membuat produk' }, { status: 500 })
  }
}
