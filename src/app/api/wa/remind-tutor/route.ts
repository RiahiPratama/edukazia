import { NextResponse } from 'next/server'
import { sendWhatsApp, formatPhoneID } from '@/lib/fonnte'

/**
 * POST /api/wa/remind-tutor
 * Body: { phone: string, message: string }
 * 
 * Admin kirim WA reminder ke tutor via Fonnte
 */
export async function POST(req: Request) {
  try {
    const { phone, message } = await req.json()
    if (!phone || !message) {
      return NextResponse.json({ error: 'phone and message required' }, { status: 400 })
    }

    const res = await sendWhatsApp({
      target: formatPhoneID(phone),
      message,
    })

    return NextResponse.json({ sent: res.status, detail: res.detail })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
