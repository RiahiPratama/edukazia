export const runtime = 'nodejs'

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function PATCH(req: NextRequest) {
  try {
    const { id, scheduled_at, status, zoom_link, reschedule_reason } = await req.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const update: any = { scheduled_at, status, zoom_link }
    if (status === 'rescheduled' && reschedule_reason) {
      update.reschedule_reason = reschedule_reason
      update.rescheduled_from  = (await supabase.from('sessions').select('scheduled_at').eq('id', id).single()).data?.scheduled_at
    }

    const { error } = await supabase.from('sessions').update(update).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
