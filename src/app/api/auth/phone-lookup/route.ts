export const runtime = 'nodejs'

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Pakai service role agar bisa bypass RLS (user belum login saat ini)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json()
    if (!phone) return NextResponse.json({ error: 'phone required' }, { status: 400 })

    // Normalisasi: ambil digit saja
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 8) {
      return NextResponse.json({ error: 'Nomor HP tidak valid.' }, { status: 400 })
    }

    // Gunakan 8 digit terakhir untuk matching (cukup unik, toleran format)
    const last8 = digits.slice(-8)

    // 1. Cari di profiles.phone
    const { data: profileRows } = await supabase
      .from('profiles')
      .select('id, email, phone')
      .not('phone', 'is', null)

    const matchedProfile = (profileRows ?? []).find(p => {
      const d = (p.phone ?? '').replace(/\D/g, '')
      return d.endsWith(last8) && p.email
    })

    if (matchedProfile?.email) {
      return NextResponse.json({ email: matchedProfile.email })
    }

    // 2. Cari di students.relation_phone → parent_profile_id → profiles.email
    const { data: studentRows } = await supabase
      .from('students')
      .select('profile_id, parent_profile_id, relation_phone')
      .not('relation_phone', 'is', null)

    const matchedStudent = (studentRows ?? []).find(s => {
      const d = (s.relation_phone ?? '').replace(/\D/g, '')
      return d.endsWith(last8)
    })

    if (matchedStudent) {
      // Cek parent_profile_id dulu, fallback ke profile_id (Diri Sendiri)
      const lookupId = matchedStudent.parent_profile_id || matchedStudent.profile_id
      if (lookupId) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', lookupId)
          .single()
        if (prof?.email) {
          return NextResponse.json({ email: prof.email })
        }
      }
    }

    return NextResponse.json({ error: 'Nomor HP tidak terdaftar di sistem EduKazia.' }, { status: 404 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
