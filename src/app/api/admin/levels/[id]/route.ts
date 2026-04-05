import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// PATCH — edit level
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const body = await request.json()

    const { data, error } = await supabase
      .from('levels')
      .update({
        name:        body.name,
        description: body.description ?? null,
        target_age:  body.target_age ?? 'all',
        sort_order:  body.sort_order ?? 0,
        is_active:   body.is_active ?? true,
        code:        body.code,
        topic_name:  body.topic_name,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ data })
  } catch (err) {
    console.error('PATCH /api/admin/levels/[id]:', err)
    return NextResponse.json({ error: 'Gagal update level' }, { status: 500 })
  }
}

// DELETE — hapus level
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { error } = await supabase
      .from('levels')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE /api/admin/levels/[id]:', err)
    return NextResponse.json({ error: 'Gagal hapus level' }, { status: 500 })
  }
}
