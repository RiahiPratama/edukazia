import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// POST — tambah level baru
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    const { data, error } = await supabase
      .from('levels')
      .insert({
        course_id:   body.course_id,
        name:        body.name,
        description: body.description ?? null,
        target_age:  body.target_age ?? 'all',
        sort_order:  body.sort_order ?? 0,
        is_active:   body.is_active ?? true,
        code:        body.code,
        topic_name:  body.topic_name,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    console.error('POST /api/admin/levels:', err)
    return NextResponse.json({ error: 'Gagal tambah level' }, { status: 500 })
  }
}
