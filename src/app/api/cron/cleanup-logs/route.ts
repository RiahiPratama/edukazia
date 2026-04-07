import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Cron: Cleanup notification_logs
 * Hapus log lebih dari 90 hari
 * Trigger: cron-job.org sebulan sekali
 */

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 90)
  const cutoffISO = cutoff.toISOString()

  // Count sebelum hapus
  const { count } = await supabase
    .from('notification_logs')
    .select('*', { count: 'exact', head: true })
    .lt('created_at', cutoffISO)

  // Hapus log lama
  const { error } = await supabase
    .from('notification_logs')
    .delete()
    .lt('created_at', cutoffISO)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    deleted: count ?? 0,
    cutoff: cutoffISO,
    message: `Cleaned up ${count ?? 0} logs older than 90 days`,
  })
}
