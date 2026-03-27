import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Check auth
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get request body
    const { enrollment_id, level_id } = await request.json()

    if (!enrollment_id) {
      return NextResponse.json(
        { error: 'enrollment_id is required' },
        { status: 400 }
      )
    }

    // Update enrollment level
    const { data, error } = await supabase
      .from('enrollments')
      .update({ level_id: level_id || null })
      .eq('id', enrollment_id)
      .select('id, level_id')
      .single()

    if (error) {
      console.error('Error updating enrollment level:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data,
      message: 'Level berhasil diperbarui',
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
