import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendWhatsApp, formatPhoneID } from '@/lib/fonnte'

/**
 * POST /api/wa/remind-tutor
 * Body: { phone: string, message: string, type?: string, context?: object }
 * 
 * Admin kirim WA reminder ke tutor via Fonnte
 * Otomatis masuk ke notification_logs
 */
export async function POST(req: Request) {
  try {
    const { phone, message, type, context } = await req.json()
    if (!phone || !message) {
      return NextResponse.json({ error: 'phone and message required' }, { status: 400 })
    }

    const target = formatPhoneID(phone)

    const res = await sendWhatsApp({ target, message })

    // Log ke notification_logs
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      await supabase.from('notification_logs').insert({
        type:     type ?? 'wa_remind_tutor',
        target,
        payload:  context ?? { message: message.slice(0, 200) },
        status:   res.status ? 'sent' : 'failed',
        response: res.detail ?? null,
      })
    } catch (_) {}

    return NextResponse.json({ sent: res.status, detail: res.detail })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
