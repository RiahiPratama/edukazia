    // Update material
    const materialUpdateData: any = {
      title,
      lesson_id: finalLessonId,
      position,
      is_published: isPublished,
      updated_at: new Date().toISOString(),
    };

    // ============================================================
    // CRITICAL FIX: Save canva_urls to materials table for live_zoom
    // ============================================================
    if (category === 'live_zoom' && contentData) {
      const canvaUrl = contentData.url || contentData.zoom_link || contentData.canva_link;
      if (canvaUrl) {
        materialUpdateData.canva_urls = [canvaUrl];
        console.log('✅ Saving to canva_urls:', canvaUrl);
      }
    }

    const { data: updatedMaterial, error: updateError } = await supabase
      .from('materials')
      .update(materialUpdateData)
      .eq('id', materialId)
      .select()
      .single();
