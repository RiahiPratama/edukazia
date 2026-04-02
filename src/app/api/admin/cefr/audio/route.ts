import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ============================================================
// POST — Upload audio file untuk audio_sentence block
// ============================================================
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('audio') as File;

    if (!file) {
      return NextResponse.json({ error: 'File audio tidak ditemukan' }, { status: 400 });
    }

    // Validasi tipe file
    const allowedTypes = ['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/ogg'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({
        error: 'Tipe file tidak didukung',
        details: 'Gunakan format MP3, MP4, M4A, AAC, atau OGG'
      }, { status: 400 });
    }

    // Generate nama file unik
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    const ext = file.name.split('.').pop()?.toLowerCase() || 'mp3';
    const fileName = `cefr/${timestamp}-${random}.${ext}`;

    // Upload ke Supabase Storage bucket 'audio'
    const { error: uploadError } = await supabase.storage
      .from('audio')
      .upload(fileName, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json({
        error: 'Gagal upload audio',
        details: uploadError.message
      }, { status: 500 });
    }

    // Ambil public URL
    const { data: urlData } = supabase.storage
      .from('audio')
      .getPublicUrl(fileName);

    console.log('✅ Audio uploaded:', fileName);

    return NextResponse.json({
      success: true,
      storage_path: fileName,
      storage_bucket: 'audio',
      public_url: urlData.publicUrl,
    });

  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================================
// DELETE — Hapus audio file dari storage
// ============================================================
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 });
    }

    const { storage_path } = await request.json();

    if (!storage_path) {
      return NextResponse.json({ error: 'storage_path diperlukan' }, { status: 400 });
    }

    const { error } = await supabase.storage
      .from('audio')
      .remove([storage_path]);

    if (error) {
      return NextResponse.json({ error: 'Gagal hapus audio' }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
