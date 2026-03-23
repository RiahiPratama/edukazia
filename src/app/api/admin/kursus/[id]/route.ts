import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const body = await request.json()

    const { data, error } = await supabase
      .from('courses')
      .update({
        name:        body.name,
        description: body.description ?? null,
        color:       body.color,
        is_active:   body.is_active,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ data })
  } catch (err) {
    console.error('PATCH /api/admin/kursus/[id]:', err)
    return NextResponse.json({ error: 'Gagal update kursus' }, { status: 500 })
  }
}
