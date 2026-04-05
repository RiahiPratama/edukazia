import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (all) => { try { all.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {} }
        }
      }
    )

    // Guard: admin only
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { path, contentType } = await request.json()
    if (!path) return NextResponse.json({ error: 'Path wajib diisi' }, { status: 400 })

    // Generate signed URL untuk upload (PUT)
    const { data, error } = await supabase.storage
      .from('pustaka')
      .createSignedUploadUrl(path)

    if (error || !data) {
      throw error || new Error('Gagal generate signed URL')
    }

    // Public URL setelah upload
    const { data: urlData } = supabase.storage
      .from('pustaka')
      .getPublicUrl(path)

    return NextResponse.json({
      signedUrl: data.signedUrl,
      publicUrl: urlData.publicUrl
    })

  } catch (err: unknown) {
    console.error('[API /admin/pustaka/upload-thumbnail]', err)
    return NextResponse.json({ error: 'Gagal generate upload URL' }, { status: 500 })
  }
}
