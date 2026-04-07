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

  // Hitung tanggal 90 hari lalu
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 90)
  const cutoffISO = cutoff.toISOString()

  // Hapus log lama
  const { data, error, count } = await supabase
    .from('notification_logs')
    .delete()
    .lt('created_at', cutoffISO)
    .select('id', { count: 'exact' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    deleted: data?.length ?? 0,
    cutoff: cutoffISO,
    message: `Cleaned up ${data?.length ?? 0} logs older than 90 days`,
  })
}
