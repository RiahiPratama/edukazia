import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { storage_path } = await request.json();
    if (!storage_path) {
      return NextResponse.json({ error: 'storage_path diperlukan' }, { status: 400 });
    }

    // Kalau ini Google Drive/Slides URL — generate embed URL
    if (storage_path.includes('drive.google.com') || storage_path.includes('docs.google.com')) {
      let embedUrl = storage_path;
      
      // Google Drive PDF: convert ke preview URL
      if (storage_path.includes('drive.google.com/file/d/')) {
        const fileId = storage_path.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)?.[1];
        if (fileId) {
          embedUrl = `https://drive.google.com/file/d/${fileId}/preview`;
        }
      }
      // Google Slides: convert ke embed URL
      else if (storage_path.includes('docs.google.com/presentation')) {
        const fileId = storage_path.match(/\/presentation\/d\/([a-zA-Z0-9_-]+)/)?.[1];
        if (fileId) {
          embedUrl = `https://docs.google.com/presentation/d/${fileId}/embed?start=false&loop=false`;
        }
      }

      return NextResponse.json({ success: true, type: 'google', signed_url: embedUrl });
    }

    // Supabase Storage — generate signed URL 1 jam
    const { data, error } = await supabase.storage
      .from('materials-pdf')
      .createSignedUrl(storage_path, 3600);

    if (error || !data) {
      return NextResponse.json({ error: 'Gagal generate URL' }, { status: 500 });
    }

    return NextResponse.json({ success: true, type: 'pdf', signed_url: data.signedUrl });

  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
