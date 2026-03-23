import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    const { data, error } = await supabase
      .from('class_group_levels')
      .insert({
        class_group_id: body.class_group_id,
        level_id:       body.level_id,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    console.error('POST /api/admin/class-group-levels:', err)
    return NextResponse.json({ error: 'Gagal menambah level ke kelas' }, { status: 500 })
  }
}
