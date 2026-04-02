import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    // Check auth
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
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // ✅ Ambil lesson_id sebelum hapus material
    const { data: material } = await supabase
      .from('materials')
      .select('lesson_id')
      .eq('id', id)
      .single();

    if (!material) {
      return NextResponse.json({ error: 'Material not found' }, { status: 404 });
    }

    const lessonId = material.lesson_id;

    // STEP 1: Hapus material
    const { error: deleteError } = await supabase
      .from('materials')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting material:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete material' },
        { status: 500 }
      );
    }

    console.log('✅ Material deleted:', id);

    // STEP 2: Cek apakah lesson masih punya material lain
    if (lessonId) {
      const { count: remainingMaterials } = await supabase
        .from('materials')
        .select('id', { count: 'exact', head: true })
        .eq('lesson_id', lessonId);

      if (remainingMaterials === 0) {
        // Ambil unit_id sebelum hapus lesson
        const { data: lesson } = await supabase
          .from('lessons')
          .select('unit_id')
          .eq('id', lessonId)
          .single();

        const unitId = lesson?.unit_id;

        // Hapus lesson yang kosong
        await supabase.from('lessons').delete().eq('id', lessonId);
        console.log('🗑️ Empty lesson deleted:', lessonId);

        // STEP 3: Cek apakah unit masih punya lesson lain
        if (unitId) {
          const { count: remainingLessons } = await supabase
            .from('lessons')
            .select('id', { count: 'exact', head: true })
            .eq('unit_id', unitId);

          if (remainingLessons === 0) {
            // Hapus unit yang kosong
            await supabase.from('units').delete().eq('id', unitId);
            console.log('🗑️ Empty unit deleted:', unitId);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Material berhasil dihapus'
    });

  } catch (error) {
    console.error('Error in DELETE /api/admin/materials/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    // Check auth
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
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse form data
    const formData = await request.formData();
    const title = formData.get('title') as string;
    const url = formData.get('url') as string;
    const canvaUrl = formData.get('canva_url') as string || '';
    const slidesUrl = formData.get('slides_url') as string || '';
    const pdfFile = formData.get('pdf_file') as File | null;

    // Get current material
    const { data: currentMaterial } = await supabase
      .from('materials')
      .select('category, lesson_id')
      .eq('id', id)
      .single();

    if (!currentMaterial) {
      return NextResponse.json({ error: 'Material not found' }, { status: 404 });
    }

    // ✅ Update material title
    const { data: updatedMaterial, error: materialError } = await supabase
      .from('materials')
      .update({ title: title?.trim() || url.trim() })
      .eq('id', id)
      .select()
      .single();

    if (materialError) {
      return NextResponse.json({ error: 'Failed to update material' }, { status: 500 });
    }

    // ✅ Update content_url di material_contents
    const { data: mc } = await supabase
      .from('material_contents')
      .select('id')
      .eq('material_id', id)
      .single();

    if (mc) {
      // ✅ Upload PDF jika ada file baru
      let pdfStoragePath: string | null | undefined = undefined;
      if (pdfFile && pdfFile.size > 0) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(7);
        const { error: pdfError } = await supabase.storage
          .from('materials-pdf')
          .upload(`${timestamp}-${random}.pdf`, pdfFile, { contentType: 'application/pdf' });
        if (!pdfError) {
          pdfStoragePath = `${timestamp}-${random}.pdf`;
        }
      }

      const updateData: any = {
        content_url: canvaUrl || url?.trim() || '',
      };
      if (canvaUrl !== undefined) updateData.canva_url = canvaUrl || null;
      if (slidesUrl !== undefined) updateData.slides_url = slidesUrl || null;
      if (pdfStoragePath !== undefined) updateData.pdf_storage_path = pdfStoragePath;

      await supabase
        .from('material_contents')
        .update(updateData)
        .eq('id', mc.id);
    }

    console.log('✅ Material updated:', id);

    return NextResponse.json({
      success: true,
      data: updatedMaterial,
      message: 'Material updated successfully'
    });

  } catch (error) {
    console.error('Error in PATCH /api/admin/materials/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
