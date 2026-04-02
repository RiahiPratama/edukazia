import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { storage_path } = await request.json();

    if (!storage_path) {
      return NextResponse.json({ error: 'storage_path diperlukan' }, { status: 400 });
    }

    // Generate signed URL — valid 1 jam (3600 detik)
    const { data, error } = await supabase.storage
      .from('materials-pdf')
      .createSignedUrl(storage_path, 3600);

    if (error || !data) {
      console.error('Signed URL error:', error);
      return NextResponse.json({ error: 'Gagal generate URL' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      signed_url: data.signedUrl,
    });

  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
