import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (all) => {
            try {
              all.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {}
          }
        }
      }
    )

    // Query 1: produk by slug
    const { data: product, error: productError } = await supabase
      .from('digital_products')
      .select('id, title, slug, description, subject, level_label, product_type, thumbnail_url, price, is_free_for_enrolled, is_published, course_id, level_id, created_at')
      .eq('slug', slug)
      .eq('is_published', true)
      .single()

    if (productError || !product) {
      return NextResponse.json({ error: 'Produk tidak ditemukan' }, { status: 404 })
    }

    // Query 2: konten PDF/audio (flat)
    const { data: contents } = await supabase
      .from('digital_contents')
      .select('id, title, content_type, position, file_size_kb, duration_sec')
      .eq('product_id', product.id)
      .order('position', { ascending: true })

    // Query 3: slide metadata saja (tanpa image_url & hotspots)
    const { data: slides } = await supabase
      .from('digital_slides')
      .select('id, slide_number, title')
      .eq('product_id', product.id)
      .order('slide_number', { ascending: true })

    // Cek akses user jika login
    const { data: { user } } = await supabase.auth.getUser()
    let accessInfo = {
      has_access: false,
      access_type: 'none',
      expires_at: null as string | null
    }

    if (user) {
      const { data: access } = await supabase
        .rpc('check_pustaka_access', {
          p_profile_id: user.id,
          p_product_id: product.id
        })
        .single() as { data: { has_access: boolean; access_type: string; expires_at: string | null } | null, error: unknown }

      if (access) {
        accessInfo = {
          has_access: access.has_access,
          access_type: access.access_type,
          expires_at: access.expires_at
        }
      }
    }

    return NextResponse.json({
      product,
      contents: contents || [],
      slides: slides || [],
      access: accessInfo
    })

  } catch (err: unknown) {
    console.error('[API /pustaka/products/[slug] GET]', err)
    return NextResponse.json({ error: 'Gagal memuat detail produk' }, { status: 500 })
  }
}
