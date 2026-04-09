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
