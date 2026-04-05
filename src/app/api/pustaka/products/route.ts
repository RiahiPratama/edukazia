import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const subject = searchParams.get('subject')   // filter opsional: english | math
    const type    = searchParams.get('type')       // filter opsional: pdf | slide | bundle

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

    // Query 1: ambil produk published
    let query = supabase
      .from('digital_products')
      .select('id, title, slug, description, subject, level_label, product_type, thumbnail_url, price, is_free_for_enrolled, course_id, level_id, created_at')
      .eq('is_published', true)
      .order('created_at', { ascending: false })

    if (subject) query = query.eq('subject', subject)
    if (type)    query = query.eq('product_type', type)

    const { data: products, error } = await query

    if (error) throw error

    if (!products || products.length === 0) {
      return NextResponse.json({ products: [] })
    }

    // Query 2: hitung jumlah konten per produk (flat, no join)
    const productIds = products.map(p => p.id)

    const { data: contentCounts } = await supabase
      .from('digital_contents')
      .select('product_id')
      .in('product_id', productIds)

    const { data: slideCounts } = await supabase
      .from('digital_slides')
      .select('product_id')
      .in('product_id', productIds)

    // Buat lookup map
    const contentMap: Record<string, number> = {}
    const slideMap: Record<string, number> = {}

    contentCounts?.forEach(c => {
      contentMap[c.product_id] = (contentMap[c.product_id] || 0) + 1
    })
    slideCounts?.forEach(s => {
      slideMap[s.product_id] = (slideMap[s.product_id] || 0) + 1
    })

    // Merge
    const result = products.map(p => ({
      ...p,
      content_count: contentMap[p.id] || 0,
      slide_count:   slideMap[p.id]   || 0,
    }))

    return NextResponse.json({ products: result })

  } catch (err: any) {
    console.error('[API /pustaka/products GET]', err)
    return NextResponse.json({ error: 'Gagal memuat produk' }, { status: 500 })
  }
}
