/**
 * Fonnte WhatsApp API Helper
 * Docs: https://fonnte.com/api
 */

const FONNTE_API = 'https://api.fonnte.com/send'

interface SendWAParams {
  target: string       // nomor WA (format: 6281xxx)
  message: string
  typing?: boolean     // simulasi typing indicator
  delay?: number       // delay sebelum kirim (detik)
}

interface FonnteResponse {
  status: boolean
  detail?: string
  id?: string
}

/**
 * Kirim pesan WhatsApp via Fonnte API
 * Nomor target harus format internasional tanpa +  (contoh: 6281384253679)
 */
export async function sendWhatsApp(params: SendWAParams): Promise<FonnteResponse> {
  const token = process.env.FONNTE_TOKEN
  if (!token) {
    console.error('[Fonnte] FONNTE_TOKEN not set')
    return { status: false, detail: 'FONNTE_TOKEN not configured' }
  }

  // Normalize nomor: hapus +, spasi, strip
  const target = params.target.replace(/[^0-9]/g, '')
  if (!target || target.length < 10) {
    return { status: false, detail: `Invalid phone number: ${params.target}` }
  }

  try {
    const body = new FormData()
    body.append('target', target)
    body.append('message', params.message)
    if (params.typing)  body.append('typing', 'true')
    if (params.delay)   body.append('delay', String(params.delay))

    const res = await fetch(FONNTE_API, {
      method: 'POST',
      headers: { Authorization: token },
      body,
    })

    const data = await res.json()
    console.log(`[Fonnte] Sent to ${target}: ${data.status ? 'OK' : 'FAIL'} — ${data.detail ?? ''}`)
    return data as FonnteResponse
  } catch (err: any) {
    console.error(`[Fonnte] Error sending to ${target}:`, err.message)
    return { status: false, detail: err.message }
  }
}

/**
 * Format nomor Indonesia ke format internasional
 * 081xxx → 6281xxx
 * +6281xxx → 6281xxx
 * 6281xxx → 6281xxx (already correct)
 */
export function formatPhoneID(phone: string): string {
  let clean = phone.replace(/[^0-9]/g, '')
  if (clean.startsWith('0')) {
    clean = '62' + clean.slice(1)
  }
  return clean
}
