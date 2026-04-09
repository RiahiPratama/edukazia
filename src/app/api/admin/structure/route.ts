import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ============================================================
// HELPER: Auth check — admin only
// ============================================================
async function requireAdmin(supabase: any) {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized', status: 401 };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') return { error: 'Forbidden - Admin only', status: 403 };
  return { user };
}

// ============================================================
// POST - STRUCTURE OPERATIONS
// action: move_chapter | move_unit | reorder_units | reorder_lessons
// ============================================================
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await requireAdmin(supabase);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'move_chapter':
        return await moveChapter(supabase, body);
      case 'move_unit':
        return await moveUnit(supabase, body);
      case 'reorder_units':
        return await reorderUnits(supabase, body);
      case 'reorder_lessons':
        return await reorderLessons(supabase, body);
      case 'delete_chapter':
        return await deleteChapter(supabase, body);
      case 'delete_unit':
        return await deleteUnit(supabase, body);
      case 'bulk_publish':
        return await bulkPublish(supabase, body);
      case 'duplicate_material':
        return await duplicateMaterial(supabase, body);
      case 'clone_chapter':
        return await cloneChapter(supabase, body);
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error('Structure API error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// ============================================================
// 1. MOVE CHAPTER — pindah chapter + semua unit ke level lain
// ============================================================
async function moveChapter(supabase: any, body: any) {
  const { chapter_id, target_level_id, target_position } = body;

  if (!chapter_id || !target_level_id) {
    return NextResponse.json({ error: 'chapter_id dan target_level_id wajib diisi' }, { status: 400 });
  }

  // Verify chapter exists
  const { data: chapter, error: chapterErr } = await supabase
    .from('chapters')
    .select('id, chapter_title, level_id, order_number')
    .eq('id', chapter_id)
    .single();

  if (chapterErr || !chapter) {
    return NextResponse.json({ error: 'Chapter tidak ditemukan' }, { status: 404 });
  }

  if (chapter.level_id === target_level_id) {
    return NextResponse.json({ error: 'Chapter sudah di level ini' }, { status: 400 });
  }

  // Verify target level exists
  const { data: targetLevel } = await supabase
    .from('levels')
    .select('id, name')
    .eq('id', target_level_id)
    .single();

  if (!targetLevel) {
    return NextResponse.json({ error: 'Level tujuan tidak ditemukan' }, { status: 404 });
  }

  // Get max order_number di level tujuan
  const { data: existingChapters } = await supabase
    .from('chapters')
    .select('order_number')
    .eq('level_id', target_level_id)
    .order('order_number', { ascending: false })
    .limit(1);

  // Get max chapter_number di level tujuan (bisa beda row dari max order_number)
  const { data: maxChapterNumRow } = await supabase
    .from('chapters')
    .select('chapter_number')
    .eq('level_id', target_level_id)
    .order('chapter_number', { ascending: false })
    .limit(1);

  const maxOrder = existingChapters?.[0]?.order_number || 0;
  const maxChapterNumber = maxChapterNumRow?.[0]?.chapter_number || 0;
  const newOrder = target_position || (maxOrder + 1);
  const newChapterNumber = maxChapterNumber + 1;

  // Kalau target_position specified, geser chapter yang sudah ada di posisi itu ke bawah
  if (target_position) {
    const { data: chaptersToShift } = await supabase
      .from('chapters')
      .select('id, order_number')
      .eq('level_id', target_level_id)
      .gte('order_number', target_position)
      .order('order_number', { ascending: false });

    if (chaptersToShift && chaptersToShift.length > 0) {
      for (const ch of chaptersToShift) {
        await supabase
          .from('chapters')
          .update({ order_number: ch.order_number + 1 })
          .eq('id', ch.id);
      }
    }
  }

  // UPDATE chapter — pindah ke level baru
  const { error: updateChapterErr } = await supabase
    .from('chapters')
    .update({ level_id: target_level_id, order_number: newOrder, chapter_number: newChapterNumber })
    .eq('id', chapter_id);

  if (updateChapterErr) {
    console.error('Move chapter error:', updateChapterErr);
    return NextResponse.json({ error: 'Gagal pindah chapter', details: updateChapterErr.message }, { status: 500 });
  }

  // UPDATE semua units di chapter ini — sync level_id
  const { error: updateUnitsErr } = await supabase
    .from('units')
    .update({ level_id: target_level_id })
    .eq('chapter_id', chapter_id);

  if (updateUnitsErr) {
    console.error('Update units level_id error:', updateUnitsErr);
    // Rollback chapter
    await supabase
      .from('chapters')
      .update({ level_id: chapter.level_id, order_number: chapter.order_number })
      .eq('id', chapter_id);
    return NextResponse.json({ error: 'Gagal sync level_id unit', details: updateUnitsErr.message }, { status: 500 });
  }

  // Rapikan order_number di level asal (tutup gap)
  const { data: sourceChapters } = await supabase
    .from('chapters')
    .select('id')
    .eq('level_id', chapter.level_id)
    .order('order_number', { ascending: true });

  if (sourceChapters) {
    for (let i = 0; i < sourceChapters.length; i++) {
      await supabase
        .from('chapters')
        .update({ order_number: i + 1 })
        .eq('id', sourceChapters[i].id);
    }
  }

  console.log(`✅ Chapter "${chapter.chapter_title}" dipindah ke level "${targetLevel.name}"`);

  return NextResponse.json({
    success: true,
    message: `Chapter "${chapter.chapter_title}" berhasil dipindah ke ${targetLevel.name}`,
  });
}

// ============================================================
// 2. MOVE UNIT — pindah unit + semua lesson ke chapter lain
// ============================================================
async function moveUnit(supabase: any, body: any) {
  const { unit_id, target_chapter_id, target_position } = body;

  if (!unit_id || !target_chapter_id) {
    return NextResponse.json({ error: 'unit_id dan target_chapter_id wajib diisi' }, { status: 400 });
  }

  // Verify unit exists
  const { data: unit, error: unitErr } = await supabase
    .from('units')
    .select('id, unit_name, chapter_id, level_id, position')
    .eq('id', unit_id)
    .single();

  if (unitErr || !unit) {
    return NextResponse.json({ error: 'Unit tidak ditemukan' }, { status: 404 });
  }

  if (unit.chapter_id === target_chapter_id) {
    return NextResponse.json({ error: 'Unit sudah di chapter ini' }, { status: 400 });
  }

  // Verify target chapter exists & get its level_id
  const { data: targetChapter } = await supabase
    .from('chapters')
    .select('id, chapter_title, level_id')
    .eq('id', target_chapter_id)
    .single();

  if (!targetChapter) {
    return NextResponse.json({ error: 'Chapter tujuan tidak ditemukan' }, { status: 404 });
  }

  // Get max position di chapter tujuan
  const { data: existingUnits } = await supabase
    .from('units')
    .select('position')
    .eq('chapter_id', target_chapter_id)
    .order('position', { ascending: false })
    .limit(1);

  const maxPos = existingUnits?.[0]?.position || 0;
  const newPosition = target_position || (maxPos + 1);

  // Kalau target_position specified, geser unit yang sudah ada
  if (target_position) {
    const { data: unitsToShift } = await supabase
      .from('units')
      .select('id, position')
      .eq('chapter_id', target_chapter_id)
      .gte('position', target_position)
      .order('position', { ascending: false });

    if (unitsToShift && unitsToShift.length > 0) {
      for (const u of unitsToShift) {
        await supabase
          .from('units')
          .update({ position: u.position + 1 })
          .eq('id', u.id);
      }
    }
  }

  // UPDATE unit — pindah ke chapter baru + sync level_id
  const { error: updateUnitErr } = await supabase
    .from('units')
    .update({
      chapter_id: target_chapter_id,
      level_id: targetChapter.level_id,
      position: newPosition,
    })
    .eq('id', unit_id);

  if (updateUnitErr) {
    console.error('Move unit error:', updateUnitErr);
    return NextResponse.json({ error: 'Gagal pindah unit', details: updateUnitErr.message }, { status: 500 });
  }

  // Rapikan position di chapter asal (tutup gap)
  const { data: sourceUnits } = await supabase
    .from('units')
    .select('id')
    .eq('chapter_id', unit.chapter_id)
    .order('position', { ascending: true });

  if (sourceUnits) {
    for (let i = 0; i < sourceUnits.length; i++) {
      await supabase
        .from('units')
        .update({ position: i + 1 })
        .eq('id', sourceUnits[i].id);
    }
  }

  console.log(`✅ Unit "${unit.unit_name}" dipindah ke chapter "${targetChapter.chapter_title}"`);

  return NextResponse.json({
    success: true,
    message: `Unit "${unit.unit_name}" berhasil dipindah ke chapter "${targetChapter.chapter_title}"`,
  });
}

// ============================================================
// 3. REORDER UNITS — ubah urutan unit dalam satu chapter
// ============================================================
async function reorderUnits(supabase: any, body: any) {
  const { chapter_id, unit_ids } = body;

  if (!chapter_id || !unit_ids || !Array.isArray(unit_ids)) {
    return NextResponse.json({ error: 'chapter_id dan unit_ids[] wajib diisi' }, { status: 400 });
  }

  // Verify all units belong to this chapter
  const { data: existingUnits } = await supabase
    .from('units')
    .select('id')
    .eq('chapter_id', chapter_id);

  const existingIds = new Set(existingUnits?.map((u: any) => u.id) || []);
  const invalidIds = unit_ids.filter((id: string) => !existingIds.has(id));

  if (invalidIds.length > 0) {
    return NextResponse.json({
      error: 'Ada unit_id yang tidak ditemukan di chapter ini',
      details: invalidIds,
    }, { status: 400 });
  }

  // Update position satu per satu sesuai urutan array
  for (let i = 0; i < unit_ids.length; i++) {
    const { error } = await supabase
      .from('units')
      .update({ position: i + 1 })
      .eq('id', unit_ids[i]);

    if (error) {
      console.error(`Reorder unit error at index ${i}:`, error);
      return NextResponse.json({
        error: `Gagal update urutan unit ke-${i + 1}`,
        details: error.message,
      }, { status: 500 });
    }
  }

  console.log(`✅ Reorder ${unit_ids.length} units di chapter ${chapter_id}`);

  return NextResponse.json({
    success: true,
    message: `Urutan ${unit_ids.length} unit berhasil diperbarui`,
  });
}

// ============================================================
// 4. REORDER LESSONS — ubah urutan lesson dalam satu unit
// ============================================================
async function reorderLessons(supabase: any, body: any) {
  const { unit_id, lesson_ids } = body;

  if (!unit_id || !lesson_ids || !Array.isArray(lesson_ids)) {
    return NextResponse.json({ error: 'unit_id dan lesson_ids[] wajib diisi' }, { status: 400 });
  }

  // Verify all lessons belong to this unit
  const { data: existingLessons } = await supabase
    .from('lessons')
    .select('id')
    .eq('unit_id', unit_id);

  const existingIds = new Set(existingLessons?.map((l: any) => l.id) || []);
  const invalidIds = lesson_ids.filter((id: string) => !existingIds.has(id));

  if (invalidIds.length > 0) {
    return NextResponse.json({
      error: 'Ada lesson_id yang tidak ditemukan di unit ini',
      details: invalidIds,
    }, { status: 400 });
  }

  for (let i = 0; i < lesson_ids.length; i++) {
    const { error } = await supabase
      .from('lessons')
      .update({ position: i + 1 })
      .eq('id', lesson_ids[i]);

    if (error) {
      console.error(`Reorder lesson error at index ${i}:`, error);
      return NextResponse.json({
        error: `Gagal update urutan lesson ke-${i + 1}`,
        details: error.message,
      }, { status: 500 });
    }
  }

  console.log(`✅ Reorder ${lesson_ids.length} lessons di unit ${unit_id}`);

  return NextResponse.json({
    success: true,
    message: `Urutan ${lesson_ids.length} lesson berhasil diperbarui`,
  });
}

// ============================================================
// HELPER: Hapus storage files untuk material IDs
// ============================================================
async function deleteStorageFiles(supabase: any, materialIds: string[]) {
  if (materialIds.length === 0) return 0;

  const { data: contents } = await supabase
    .from('material_contents')
    .select('storage_path, storage_bucket')
    .in('material_id', materialIds);

  let deletedCount = 0;
  for (const mc of (contents ?? [])) {
    if (mc.storage_path && mc.storage_bucket) {
      const { error } = await supabase.storage
        .from(mc.storage_bucket)
        .remove([mc.storage_path]);
      if (!error) deletedCount++;
      else console.warn('⚠️ Gagal hapus file:', mc.storage_path, error.message);
    }
  }
  return deletedCount;
}

// ============================================================
// 5. DELETE CHAPTER — cascade hapus semua isi + storage files
// ============================================================
async function deleteChapter(supabase: any, body: any) {
  const { chapter_id } = body;
  if (!chapter_id) return NextResponse.json({ error: 'chapter_id wajib diisi' }, { status: 400 });

  // Verify chapter exists
  const { data: chapter } = await supabase
    .from('chapters')
    .select('id, chapter_title, level_id')
    .eq('id', chapter_id)
    .single();

  if (!chapter) return NextResponse.json({ error: 'Chapter tidak ditemukan' }, { status: 404 });

  // Get all units in this chapter
  const { data: units } = await supabase
    .from('units')
    .select('id')
    .eq('chapter_id', chapter_id);

  const unitIds = (units || []).map((u: any) => u.id);

  // Get all lessons in these units
  let lessonIds: string[] = [];
  if (unitIds.length > 0) {
    const { data: lessons } = await supabase
      .from('lessons')
      .select('id')
      .in('unit_id', unitIds);
    lessonIds = (lessons || []).map((l: any) => l.id);
  }

  // Get all materials in these lessons
  let materialIds: string[] = [];
  if (lessonIds.length > 0) {
    const { data: materials } = await supabase
      .from('materials')
      .select('id')
      .in('lesson_id', lessonIds);
    materialIds = (materials || []).map((m: any) => m.id);
  }

  // 1. Delete storage files
  const filesDeleted = await deleteStorageFiles(supabase, materialIds);

  // 2. Delete material_contents
  if (materialIds.length > 0) {
    await supabase.from('material_contents').delete().in('material_id', materialIds);
  }

  // 3. Delete materials
  if (materialIds.length > 0) {
    await supabase.from('materials').delete().in('id', materialIds);
  }

  // 4. Delete lessons
  if (lessonIds.length > 0) {
    await supabase.from('lessons').delete().in('id', lessonIds);
  }

  // 5. Delete units
  if (unitIds.length > 0) {
    await supabase.from('units').delete().in('id', unitIds);
  }

  // 6. Delete chapter
  const { error: deleteErr } = await supabase
    .from('chapters')
    .delete()
    .eq('id', chapter_id);

  if (deleteErr) {
    console.error('Delete chapter error:', deleteErr);
    return NextResponse.json({ error: 'Gagal hapus chapter', details: deleteErr.message }, { status: 500 });
  }

  // 7. Rapikan order_number di level asal
  const { data: remainingChapters } = await supabase
    .from('chapters')
    .select('id')
    .eq('level_id', chapter.level_id)
    .order('order_number', { ascending: true });

  if (remainingChapters) {
    for (let i = 0; i < remainingChapters.length; i++) {
      await supabase.from('chapters').update({ order_number: i + 1 }).eq('id', remainingChapters[i].id);
    }
  }

  console.log(`✅ Chapter "${chapter.chapter_title}" dihapus: ${materialIds.length} material, ${filesDeleted} file`);

  return NextResponse.json({
    success: true,
    message: `Chapter "${chapter.chapter_title}" berhasil dihapus (${unitIds.length} unit, ${lessonIds.length} lesson, ${materialIds.length} material, ${filesDeleted} file)`,
  });
}

// ============================================================
// 6. DELETE UNIT — cascade hapus semua isi + storage files
// ============================================================
async function deleteUnit(supabase: any, body: any) {
  const { unit_id } = body;
  if (!unit_id) return NextResponse.json({ error: 'unit_id wajib diisi' }, { status: 400 });

  // Verify unit exists
  const { data: unit } = await supabase
    .from('units')
    .select('id, unit_name, chapter_id')
    .eq('id', unit_id)
    .single();

  if (!unit) return NextResponse.json({ error: 'Unit tidak ditemukan' }, { status: 404 });

  // Get all lessons
  const { data: lessons } = await supabase
    .from('lessons')
    .select('id')
    .eq('unit_id', unit_id);

  const lessonIds = (lessons || []).map((l: any) => l.id);

  // Get all materials
  let materialIds: string[] = [];
  if (lessonIds.length > 0) {
    const { data: materials } = await supabase
      .from('materials')
      .select('id')
      .in('lesson_id', lessonIds);
    materialIds = (materials || []).map((m: any) => m.id);
  }

  // 1. Delete storage files
  const filesDeleted = await deleteStorageFiles(supabase, materialIds);

  // 2. Delete material_contents
  if (materialIds.length > 0) {
    await supabase.from('material_contents').delete().in('material_id', materialIds);
  }

  // 3. Delete materials
  if (materialIds.length > 0) {
    await supabase.from('materials').delete().in('id', materialIds);
  }

  // 4. Delete lessons
  if (lessonIds.length > 0) {
    await supabase.from('lessons').delete().in('id', lessonIds);
  }

  // 5. Delete unit
  const { error: deleteErr } = await supabase
    .from('units')
    .delete()
    .eq('id', unit_id);

  if (deleteErr) {
    console.error('Delete unit error:', deleteErr);
    return NextResponse.json({ error: 'Gagal hapus unit', details: deleteErr.message }, { status: 500 });
  }

  // 6. Rapikan position di chapter
  if (unit.chapter_id) {
    const { data: remainingUnits } = await supabase
      .from('units')
      .select('id')
      .eq('chapter_id', unit.chapter_id)
      .order('position', { ascending: true });

    if (remainingUnits) {
      for (let i = 0; i < remainingUnits.length; i++) {
        await supabase.from('units').update({ position: i + 1 }).eq('id', remainingUnits[i].id);
      }
    }
  }

  console.log(`✅ Unit "${unit.unit_name}" dihapus: ${materialIds.length} material, ${filesDeleted} file`);

  return NextResponse.json({
    success: true,
    message: `Unit "${unit.unit_name}" berhasil dihapus (${lessonIds.length} lesson, ${materialIds.length} material, ${filesDeleted} file)`,
  });
}

// ============================================================
// 7. BULK PUBLISH — batch update is_published
// ============================================================
async function bulkPublish(supabase: any, body: any) {
  const { material_ids, is_published } = body;

  if (!material_ids || !Array.isArray(material_ids) || material_ids.length === 0) {
    return NextResponse.json({ error: 'material_ids[] wajib diisi' }, { status: 400 });
  }

  if (typeof is_published !== 'boolean') {
    return NextResponse.json({ error: 'is_published (boolean) wajib diisi' }, { status: 400 });
  }

  const { error } = await supabase
    .from('materials')
    .update({ is_published })
    .in('id', material_ids);

  if (error) {
    console.error('Bulk publish error:', error);
    return NextResponse.json({ error: 'Gagal update publish status', details: error.message }, { status: 500 });
  }

  const action = is_published ? 'dipublish' : 'di-unpublish';
  console.log(`✅ ${material_ids.length} material ${action}`);

  return NextResponse.json({
    success: true,
    message: `${material_ids.length} material berhasil ${action}`,
  });
}

// ============================================================
// 8. DUPLICATE MATERIAL — copy material + file ke level lain
// ============================================================
async function duplicateMaterial(supabase: any, body: any) {
  const { material_id, target_level_id } = body;

  if (!material_id || !target_level_id) {
    return NextResponse.json({ error: 'material_id dan target_level_id wajib diisi' }, { status: 400 });
  }

  // 1. Get source material + content
  const { data: material } = await supabase
    .from('materials')
    .select('id, title, category, position, is_published, lesson_id')
    .eq('id', material_id)
    .single();

  if (!material) return NextResponse.json({ error: 'Material tidak ditemukan' }, { status: 404 });

  const { data: contents } = await supabase
    .from('material_contents')
    .select('*')
    .eq('material_id', material_id);

  const sourceContent = contents?.[0];

  // 2. Get source hierarchy: lesson → unit → chapter
  const { data: lesson } = await supabase
    .from('lessons')
    .select('id, lesson_name, position, unit_id')
    .eq('id', material.lesson_id)
    .single();

  if (!lesson) return NextResponse.json({ error: 'Source lesson tidak ditemukan' }, { status: 404 });

  const { data: unit } = await supabase
    .from('units')
    .select('id, unit_name, position, chapter_id, level_id')
    .eq('id', lesson.unit_id)
    .single();

  if (!unit) return NextResponse.json({ error: 'Source unit tidak ditemukan' }, { status: 404 });

  const { data: chapter } = await supabase
    .from('chapters')
    .select('id, chapter_title')
    .eq('id', unit.chapter_id)
    .single();

  if (!chapter) return NextResponse.json({ error: 'Source chapter tidak ditemukan' }, { status: 404 });

  // 3. Find-or-create chapter di target level
  let targetChapterId: string;
  const { data: existingChapter } = await supabase
    .from('chapters')
    .select('id')
    .eq('level_id', target_level_id)
    .eq('chapter_title', chapter.chapter_title)
    .maybeSingle();

  if (existingChapter) {
    targetChapterId = existingChapter.id;
  } else {
    const { data: maxCh } = await supabase
      .from('chapters')
      .select('chapter_number, order_number')
      .eq('level_id', target_level_id)
      .order('chapter_number', { ascending: false })
      .limit(1);

    const { data: newChapter, error: chErr } = await supabase
      .from('chapters')
      .insert({
        level_id: target_level_id,
        chapter_title: chapter.chapter_title,
        chapter_number: (maxCh?.[0]?.chapter_number || 0) + 1,
        order_number: (maxCh?.[0]?.order_number || 0) + 1,
      })
      .select()
      .single();

    if (chErr) return NextResponse.json({ error: 'Gagal buat chapter', details: chErr.message }, { status: 500 });
    targetChapterId = newChapter.id;
  }

  // 4. Find-or-create unit di target chapter
  let targetUnitId: string;
  const { data: existingUnit } = await supabase
    .from('units')
    .select('id')
    .eq('chapter_id', targetChapterId)
    .eq('unit_name', unit.unit_name)
    .maybeSingle();

  if (existingUnit) {
    targetUnitId = existingUnit.id;
  } else {
    const { data: newUnit, error: uErr } = await supabase
      .from('units')
      .insert({
        level_id: target_level_id,
        chapter_id: targetChapterId,
        unit_name: unit.unit_name,
        unit_number: 0,
        position: unit.position || 1,
      })
      .select()
      .single();

    if (uErr) return NextResponse.json({ error: 'Gagal buat unit', details: uErr.message }, { status: 500 });
    targetUnitId = newUnit.id;
  }

  // 5. Find-or-create lesson di target unit
  let targetLessonId: string;
  const { data: existingLesson } = await supabase
    .from('lessons')
    .select('id')
    .eq('unit_id', targetUnitId)
    .eq('lesson_name', lesson.lesson_name)
    .maybeSingle();

  if (existingLesson) {
    targetLessonId = existingLesson.id;
  } else {
    const { data: newLesson, error: lErr } = await supabase
      .from('lessons')
      .insert({
        unit_id: targetUnitId,
        lesson_name: lesson.lesson_name,
        position: lesson.position || 1,
      })
      .select()
      .single();

    if (lErr) return NextResponse.json({ error: 'Gagal buat lesson', details: lErr.message }, { status: 500 });
    targetLessonId = newLesson.id;
  }

  // 6. Copy file di storage (download + re-upload)
  let newStoragePath: string | null = null;
  let storageBucket: string | null = sourceContent?.storage_bucket || null;

  if (sourceContent?.storage_path && sourceContent?.storage_bucket) {
    const { data: fileData, error: dlErr } = await supabase.storage
      .from(sourceContent.storage_bucket)
      .download(sourceContent.storage_path);

    if (dlErr) {
      console.warn('⚠️ Gagal download source file:', dlErr.message);
    } else if (fileData) {
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 8);
      const ext = sourceContent.storage_path.split('.').pop() || 'jsx';
      const folder = sourceContent.storage_path.split('/')[0] || 'bacaan';
      newStoragePath = `${folder}/${timestamp}-${random}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from(sourceContent.storage_bucket)
        .upload(newStoragePath, fileData);

      if (upErr) {
        console.warn('⚠️ Gagal upload copy file:', upErr.message);
        newStoragePath = null;
      }
    }
  }

  // 7. Create new material
  const { data: newMaterial, error: mErr } = await supabase
    .from('materials')
    .insert({
      title: material.title,
      category: material.category,
      lesson_id: targetLessonId,
      position: material.position || 1,
      is_published: false, // default draft
    })
    .select()
    .single();

  if (mErr) return NextResponse.json({ error: 'Gagal buat material', details: mErr.message }, { status: 500 });

  // 8. Create material_contents
  await supabase
    .from('material_contents')
    .insert({
      material_id: newMaterial.id,
      content_type: sourceContent?.content_type || 'component',
      content_url: sourceContent?.content_url || null,
      storage_bucket: storageBucket,
      storage_path: newStoragePath,
      canva_url: sourceContent?.canva_url || null,
      student_content_url: sourceContent?.student_content_url || null,
      slides_url: sourceContent?.slides_url || null,
    });

  // Get target level name
  const { data: targetLevel } = await supabase
    .from('levels')
    .select('name')
    .eq('id', target_level_id)
    .single();

  console.log(`✅ Material "${material.title}" diduplikat ke ${targetLevel?.name}`);

  return NextResponse.json({
    success: true,
    message: `Material "${material.title}" berhasil diduplikat ke ${targetLevel?.name || 'level tujuan'}${newStoragePath ? ' (file ikut ter-copy)' : ''}`,
  });
}

// ============================================================
// 9. CLONE CHAPTER — copy struktur (chapter/unit/lesson) tanpa file
// ============================================================
async function cloneChapter(supabase: any, body: any) {
  const { chapter_id, target_level_id } = body;

  if (!chapter_id || !target_level_id) {
    return NextResponse.json({ error: 'chapter_id dan target_level_id wajib diisi' }, { status: 400 });
  }

  // 1. Get source chapter
  const { data: chapter } = await supabase
    .from('chapters')
    .select('id, chapter_title, level_id, icon')
    .eq('id', chapter_id)
    .single();

  if (!chapter) return NextResponse.json({ error: 'Chapter tidak ditemukan' }, { status: 404 });

  if (chapter.level_id === target_level_id) {
    return NextResponse.json({ error: 'Tidak bisa clone ke level yang sama' }, { status: 400 });
  }

  // 2. Check if chapter already exists in target level
  const { data: existingChapter } = await supabase
    .from('chapters')
    .select('id')
    .eq('level_id', target_level_id)
    .eq('chapter_title', chapter.chapter_title)
    .maybeSingle();

  if (existingChapter) {
    return NextResponse.json({
      error: `Chapter "${chapter.chapter_title}" sudah ada di level tujuan`,
    }, { status: 400 });
  }

  // 3. Get max chapter_number and order_number
  const { data: maxCh } = await supabase
    .from('chapters')
    .select('chapter_number, order_number')
    .eq('level_id', target_level_id)
    .order('chapter_number', { ascending: false })
    .limit(1);

  // 4. Create chapter in target level
  const { data: newChapter, error: chErr } = await supabase
    .from('chapters')
    .insert({
      level_id: target_level_id,
      chapter_title: chapter.chapter_title,
      chapter_number: (maxCh?.[0]?.chapter_number || 0) + 1,
      order_number: (maxCh?.[0]?.order_number || 0) + 1,
      icon: chapter.icon || null,
    })
    .select()
    .single();

  if (chErr) return NextResponse.json({ error: 'Gagal buat chapter', details: chErr.message }, { status: 500 });

  // 5. Get source units
  const { data: sourceUnits } = await supabase
    .from('units')
    .select('id, unit_name, position, icon')
    .eq('chapter_id', chapter_id)
    .order('position');

  let totalUnits = 0;
  let totalLessons = 0;

  // 6. Clone units + lessons
  for (const srcUnit of (sourceUnits || [])) {
    const { data: newUnit, error: uErr } = await supabase
      .from('units')
      .insert({
        level_id: target_level_id,
        chapter_id: newChapter.id,
        unit_name: srcUnit.unit_name,
        unit_number: 0,
        position: srcUnit.position || 1,
        icon: srcUnit.icon || null,
      })
      .select()
      .single();

    if (uErr) {
      console.warn('⚠️ Gagal clone unit:', srcUnit.unit_name, uErr.message);
      continue;
    }
    totalUnits++;

    // Get source lessons for this unit
    const { data: sourceLessons } = await supabase
      .from('lessons')
      .select('id, lesson_name, position')
      .eq('unit_id', srcUnit.id)
      .order('position');

    for (const srcLesson of (sourceLessons || [])) {
      const { error: lErr } = await supabase
        .from('lessons')
        .insert({
          unit_id: newUnit.id,
          lesson_name: srcLesson.lesson_name,
          position: srcLesson.position || 1,
        });

      if (lErr) {
        console.warn('⚠️ Gagal clone lesson:', srcLesson.lesson_name, lErr.message);
      } else {
        totalLessons++;
      }
    }
  }

  // Get target level name
  const { data: targetLevel } = await supabase
    .from('levels')
    .select('name')
    .eq('id', target_level_id)
    .single();

  console.log(`✅ Chapter "${chapter.chapter_title}" di-clone ke ${targetLevel?.name}: ${totalUnits} unit, ${totalLessons} lesson`);

  return NextResponse.json({
    success: true,
    message: `Struktur "${chapter.chapter_title}" berhasil di-clone ke ${targetLevel?.name || 'level tujuan'} (${totalUnits} unit, ${totalLessons} lesson, tanpa materi/file)`,
  });
}
