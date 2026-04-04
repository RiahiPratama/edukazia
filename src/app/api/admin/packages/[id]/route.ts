import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Auth check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()

    const { data, error } = await supabase
      .from('packages')
      .update({
        name:           body.name,
        price:          body.price,
        total_sessions: body.total_sessions,
        is_active:      body.is_active,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ data })
  } catch (err) {
    console.error('PATCH /api/admin/packages/[id]:', err)
    return NextResponse.json({ error: 'Gagal update paket' }, { status: 500 })
  }
}
