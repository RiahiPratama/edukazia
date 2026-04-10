'use client';

import { useState, useEffect } from 'react';
import { Upload, FileCode, X, Info, Check, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type Material = {
  id: string;
  title: string;
  material_contents?: {
    content_url: string | null;
    storage_bucket: string | null;
    storage_path: string | null;
  }[];
  position: number;
  is_published: boolean;
  lesson_id: string;
  unit_id: string;
};

type BacaanFormProps = {
  onSave: () => void;
  onCancel: () => void;
  editData?: Material | null;
};

export default function BacaanForm({ onSave, onCancel, editData }: BacaanFormProps) {
  const [courses, setCourses] = useState<any[]>([]);
  const [levels, setLevels] = useState<any[]>([]);
  const [chapters, setChapters] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [lessons, setLessons] = useState<any[]>([]);

  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [selectedChapter, setSelectedChapter] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('');
  const [selectedLesson, setSelectedLesson] = useState('');

  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitPosition, setNewUnitPosition] = useState(1);
  const [newLessonName, setNewLessonName] = useState('');
  const [newLessonPosition, setNewLessonPosition] = useState(1);

  const [description, setDescription] = useState('');
  const [jsxFile, setJsxFile] = useState<File | null>(null);
  const [jsxFiles, setJsxFiles] = useState<Record<string, File | null>>({});
  const [orderNumber, setOrderNumber] = useState(1);
  const [isPublished, setIsPublished] = useState(false);

  const [editUnitName, setEditUnitName] = useState('');
  const [editUnitPosition, setEditUnitPosition] = useState(1);
  const [editLessonName, setEditLessonName] = useState('');
  const [editLessonPosition, setEditLessonPosition] = useState(1);
  const [editMaterialTitle, setEditMaterialTitle] = useState('');

  const [lessonHasMaterial, setLessonHasMaterial] = useState<Record<string, boolean>>({});
  const [lessonPositionValid, setLessonPositionValid] = useState<boolean | null>(null);
  const [lessonPositionMsg, setLessonPositionMsg] = useState('');
  const [useExistingLesson, setUseExistingLesson] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [loadingEditData, setLoadingEditData] = useState(false);

  // ✅ Referensi struktur existing per level (multi-level mode)
  type LevelStructure = {
    levelId: string;
    levelName: string;
    chapters: {
      id: string;
      title: string;
      units: {
        id: string;
        name: string;
        lessonCount: number;
        lastLesson: string | null;
      }[];
    }[];
  };
  const [levelStructures, setLevelStructures] = useState<LevelStructure[]>([]);
  const [loadingStructure, setLoadingStructure] = useState(false);
  const [showStructure, setShowStructure] = useState(true);

  const supabase = createClient();
  const isEditing = !!editData;
  const isMultiLevel = selectedLevels.length > 1;

  const sortedSelectedLevels = levels
    .filter(l => selectedLevels.includes(l.id))
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  // ✅ Fetch existing structure saat multi-level
  useEffect(() => {
    if (isMultiLevel && selectedLevels.length > 0) {
      fetchLevelStructures();
    } else {
      setLevelStructures([]);
    }
  }, [selectedLevels, isMultiLevel]);

  const fetchLevelStructures = async () => {
    setLoadingStructure(true);
    try {
      // 1. Fetch chapters for all selected levels
      const { data: chaptersData } = await supabase
        .from('chapters')
        .select('id, chapter_title, level_id, order_number')
        .in('level_id', selectedLevels)
        .order('order_number');

      if (!chaptersData || chaptersData.length === 0) {
        setLevelStructures(sortedSelectedLevels.map(l => ({ levelId: l.id, levelName: l.name, chapters: [] })));
        setLoadingStructure(false);
        return;
      }

      // 2. Fetch units for these chapters
      const chapterIds = chaptersData.map(c => c.id);
      const { data: unitsData } = await supabase
        .from('units')
        .select('id, unit_name, chapter_id, position')
        .in('chapter_id', chapterIds)
        .order('position');

      // 3. Fetch lessons for these units (hanya nama & position untuk last lesson)
      const unitIds = (unitsData || []).map(u => u.id);
      const { data: lessonsData } = await supabase
        .from('lessons')
        .select('id, lesson_name, unit_id, position')
        .in('unit_id', unitIds)
        .order('position', { ascending: true });

      // 4. Count lessons per unit & find last lesson
      const lessonsByUnit: Record<string, { count: number; last: string | null }> = {};
      (lessonsData || []).forEach(l => {
        if (!lessonsByUnit[l.unit_id]) lessonsByUnit[l.unit_id] = { count: 0, last: null };
        lessonsByUnit[l.unit_id].count++;
        lessonsByUnit[l.unit_id].last = `${l.position}. ${l.lesson_name}`;
      });

      // 5. Group by level
      const structures: LevelStructure[] = sortedSelectedLevels.map(level => {
        const levelChapters = (chaptersData || []).filter(c => c.level_id === level.id);
        return {
          levelId: level.id,
          levelName: level.name,
          chapters: levelChapters.map(ch => {
            const chUnits = (unitsData || []).filter(u => u.chapter_id === ch.id);
            return {
              id: ch.id,
              title: ch.chapter_title,
              units: chUnits.map(u => ({
                id: u.id,
                name: u.unit_name,
                lessonCount: lessonsByUnit[u.id]?.count || 0,
                lastLesson: lessonsByUnit[u.id]?.last || null,
              })),
            };
          }),
        };
      });

      setLevelStructures(structures);
    } catch (err) {
      console.error('Error fetching level structures:', err);
    } finally {
      setLoadingStructure(false);
    }
  };

  useEffect(() => { fetchCourses(); }, []);

  useEffect(() => {
    if (editData) {
      setDescription('');
      setOrderNumber(editData.position || 1);
      setIsPublished(editData.is_published || false);
      setEditMaterialTitle(editData.title || '');
      fetchEditModeData();
    }
  }, [editData]);

  const fetchEditModeData = async () => {
    if (!editData) return;
    setLoadingEditData(true);
    try {
      const { data: unitData } = await supabase.from('units').select('unit_name, position').eq('id', editData.unit_id).single();
      if (unitData) { setEditUnitName(unitData.unit_name); setEditUnitPosition(unitData.position || 1); }
      const { data: lessonData } = await supabase.from('lessons').select('lesson_name, position').eq('id', editData.lesson_id).single();
      if (lessonData) { setEditLessonName(lessonData.lesson_name); setEditLessonPosition(lessonData.position || 1); }
    } catch (error) { console.error('Error fetching edit data:', error); }
    finally { setLoadingEditData(false); }
  };

  useEffect(() => {
    if (selectedLevels.length > 0 && !isEditing) fetchChaptersForSelectedLevels();
    else if (!isEditing) { setChapters([]); setSelectedChapter(''); }
  }, [selectedLevels]);

  const fetchCourses = async () => {
    const { data } = await supabase.from('courses').select('*').eq('is_active', true);
    setCourses(data || []);
  };

  const fetchLevels = async (courseId: string) => {
    const { data } = await supabase.from('levels').select('*').eq('course_id', courseId).order('sort_order');
    setLevels(data || []);
  };

  const fetchChaptersForSelectedLevels = async () => {
    if (selectedLevels.length === 0) return;
    const { data: chaptersData } = await supabase.from('chapters').select('*').in('level_id', selectedLevels).order('order_number');
    if (!chaptersData) { setChapters([]); return; }
    const levelIds = [...new Set(chaptersData.map(c => c.level_id))];
    const { data: levelsData } = await supabase.from('levels').select('id, name').in('id', levelIds);
    const levelMap = new Map((levelsData || []).map(l => [l.id, l.name]));
    setChapters(chaptersData.map(ch => ({ ...ch, level_name: levelMap.get(ch.level_id) || '' })));
  };

  const fetchUnits = async (chapterId: string) => {
    const { data } = await supabase.from('units').select('*').eq('chapter_id', chapterId).order('position');
    setUnits(data || []);
  };

  const fetchLessons = async (unitId: string) => {
    const { data } = await supabase.from('lessons').select('*').eq('unit_id', unitId).order('position');
    setLessons(data || []);
    if (data && data.length > 0) {
      const lessonIds = data.map((l: any) => l.id);
      const { data: mats } = await supabase.from('materials').select('lesson_id').in('lesson_id', lessonIds).eq('category', 'bacaan');
      const matSet: Record<string, boolean> = {};
      (mats || []).forEach((m: any) => { matSet[m.lesson_id] = true; });
      setLessonHasMaterial(matSet);
      const maxPos = Math.max(...data.map((l: any) => l.position || 0), 0);
      setNewLessonPosition(maxPos + 1);
      const lastEmpty = [...data].reverse().find((l: any) => !matSet[l.id]);
      if (lastEmpty) { setUseExistingLesson(lastEmpty.id); setSelectedLesson(lastEmpty.id); }
      else { setUseExistingLesson(null); setSelectedLesson('NEW'); }
    } else {
      setLessonHasMaterial({}); setNewLessonPosition(1); setUseExistingLesson(null); setSelectedLesson('NEW');
    }
  };

  const validateLessonPosition = (pos: number) => {
    setNewLessonPosition(pos);
    const existing = lessons.find((l: any) => l.position === pos);
    if (existing) {
      if (lessonHasMaterial[existing.id]) {
        setLessonPositionValid(false);
        setLessonPositionMsg('Posisi ' + pos + ' sudah terisi dan sudah ada materi');
      } else {
        setLessonPositionValid(true);
        setLessonPositionMsg('Posisi ' + pos + ' tersedia — lesson existing akan dipakai');
        setUseExistingLesson(existing.id); setSelectedLesson(existing.id);
      }
    } else {
      setLessonPositionValid(true);
      setLessonPositionMsg('Posisi ' + pos + ' tersedia');
      setUseExistingLesson(null); setSelectedLesson('NEW');
    }
  };

  const toggleLevel = (levelId: string) => setSelectedLevels(prev => prev.includes(levelId) ? prev.filter(id => id !== levelId) : [...prev, levelId]);
  const selectAllLevels = () => setSelectedLevels(levels.map(l => l.id));
  const clearAllLevels = () => setSelectedLevels([]);
  const setFileForLevel = (levelId: string, file: File | null) => setJsxFiles(prev => ({ ...prev, [levelId]: file }));
  const allLevelsHaveFiles = () => selectedLevels.every(id => !!jsxFiles[id]);
  const filledCount = sortedSelectedLevels.filter(l => !!jsxFiles[l.id]).length;

  // ✅ Auto-fill lesson position saat unit existing dipilih di multi-level mode
  useEffect(() => {
    if (!isMultiLevel || !newChapterTitle || !newUnitName) return;
    const matchedUnits = levelStructures.flatMap(ls =>
      ls.chapters
        .filter(ch => ch.title.toLowerCase() === newChapterTitle.toLowerCase())
        .flatMap(ch => ch.units.filter(u => u.name.toLowerCase() === newUnitName.toLowerCase()))
    );
    const maxLessonCount = Math.max(0, ...matchedUnits.map(u => u.lessonCount));
    if (maxLessonCount > 0) setNewLessonPosition(maxLessonCount + 1);
  }, [newUnitName, newChapterTitle, isMultiLevel]);

  // ✅ Drag-drop state & handler
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files).filter(f =>
      f.name.endsWith('.jsx') || f.name.endsWith('.tsx') || f.name.endsWith('.js')
    );

    if (files.length === 0) return;

    // Auto-match: cari level name di filename (case insensitive)
    const newFiles = { ...jsxFiles };
    const unmatchedFiles: File[] = [];

    for (const file of files) {
      const nameLower = file.name.toLowerCase().replace(/[_\-\.]/g, ' ');
      let matched = false;

      for (const level of sortedSelectedLevels) {
        // Match level name patterns: "eng 2.1", "eng2.1", "eng-2-1", "eng_2_1"
        const levelLower = level.name.toLowerCase();
        const levelCompact = levelLower.replace(/[\s\.]/g, '');
        const levelDash = levelLower.replace(/[\s\.]/g, '-');
        const levelUnderscore = levelLower.replace(/[\s\.]/g, '_');

        if (nameLower.includes(levelLower) || nameLower.includes(levelCompact) ||
            nameLower.includes(levelDash) || nameLower.includes(levelUnderscore)) {
          newFiles[level.id] = file;
          matched = true;
          break;
        }
      }

      if (!matched) unmatchedFiles.push(file);
    }

    // Assign unmatched files sequentially to empty slots
    let emptyIdx = 0;
    for (const file of unmatchedFiles) {
      while (emptyIdx < sortedSelectedLevels.length && newFiles[sortedSelectedLevels[emptyIdx].id]) {
        emptyIdx++;
      }
      if (emptyIdx < sortedSelectedLevels.length) {
        newFiles[sortedSelectedLevels[emptyIdx].id] = file;
        emptyIdx++;
      }
    }

    setJsxFiles(newFiles);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEditing) {
        const formData = new FormData();
        formData.append('material_id', editData.id);
        formData.append('title', editMaterialTitle);
        formData.append('order_number', orderNumber.toString());
        formData.append('is_published', isPublished.toString());
        formData.append('content_data', JSON.stringify({ description }));
        if (jsxFile) formData.append('jsx_file', jsxFile);
        formData.append('unit_id', editData.unit_id);
        formData.append('lesson_id', editData.lesson_id);
        formData.append('unit_name', editUnitName);
        formData.append('unit_position', editUnitPosition.toString());
        formData.append('lesson_name', editLessonName);
        formData.append('lesson_position', editLessonPosition.toString());
        const response = await fetch('/api/admin/materials', { method: 'PATCH', body: formData });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to update');
        alert('✅ Material berhasil diupdate!');
        onSave();
        return;
      }

      if (selectedLevels.length === 0) { alert('Pilih minimal 1 level!'); setLoading(false); return; }
      if (isMultiLevel && !allLevelsHaveFiles()) { alert('❌ Semua level harus punya file!'); setLoading(false); return; }
      if (isMultiLevel && (!newChapterTitle.trim() || !newUnitName.trim() || !newLessonName.trim())) { alert('❌ Nama Chapter, Unit, dan Lesson wajib diisi!'); setLoading(false); return; }
      if (!isMultiLevel && !jsxFile) { alert('❌ Pilih file JSX terlebih dahulu!'); setLoading(false); return; }

      let successCount = 0;
      let failedLevels: string[] = [];

      for (const levelId of selectedLevels) {
        try {
          const fileForThisLevel = isMultiLevel ? jsxFiles[levelId] : jsxFile;
          const formData = new FormData();
          const materialTitle = fileForThisLevel ? fileForThisLevel.name.replace(/\.(jsx|tsx)$/, '') : (newLessonName || selectedLesson);
          formData.append('title', materialTitle);
          formData.append('type', 'bacaan');
          formData.append('category', 'bacaan');
          formData.append('course_id', selectedCourse);
          formData.append('level_id', levelId);
          formData.append('order_number', orderNumber.toString());
          formData.append('is_published', isPublished.toString());
          formData.append('content_data', JSON.stringify({ description }));
          if (fileForThisLevel) formData.append('jsx_file', fileForThisLevel);

          if (isMultiLevel) {
            formData.append('chapter_id', 'FIND_OR_CREATE');
            formData.append('chapter_name', newChapterTitle.trim());
            formData.append('unit_id', 'FIND_OR_CREATE');
            formData.append('unit_name', newUnitName.trim());
            formData.append('unit_position_new', newUnitPosition.toString());
            formData.append('lesson_id', 'FIND_OR_CREATE');
            formData.append('lesson_name', newLessonName.trim());
            formData.append('lesson_position_new', newLessonPosition.toString());
          } else {
            formData.append('chapter_id', selectedChapter === 'NEW' ? 'NEW' : selectedChapter);
            formData.append('chapter_name', newChapterTitle);
            formData.append('unit_id', selectedUnit === 'NEW' ? 'NEW' : selectedUnit);
            formData.append('unit_name', newUnitName);
            formData.append('unit_position_new', newUnitPosition.toString());
            formData.append('lesson_id', selectedLesson === 'NEW' ? 'NEW' : selectedLesson);
            formData.append('lesson_name', newLessonName);
            formData.append('lesson_position_new', newLessonPosition.toString());
          }

          const response = await fetch('/api/admin/materials', { method: 'POST', body: formData });
          if (!response.ok) { failedLevels.push(levels.find(l => l.id === levelId)?.name || levelId); }
          else { successCount++; }
        } catch { failedLevels.push(levels.find(l => l.id === levelId)?.name || levelId); }
      }

      if (successCount === selectedLevels.length) { alert(`✅ Material berhasil dibuat untuk ${successCount} level!`); onSave(); }
      else if (successCount > 0) { alert(`⚠️ Material dibuat untuk ${successCount} level.\nGagal: ${failedLevels.join(', ')}`); onSave(); }
      else { alert(`❌ Gagal untuk semua level.\nLevel: ${failedLevels.join(', ')}`); }
    } catch (error) { alert(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`); }
    finally { setLoading(false); }
  };

  if (loadingEditData) {
    return <div className="p-8 text-center"><div className="animate-spin w-8 h-8 border-4 border-[#5C4FE5] border-t-transparent rounded-full mx-auto"></div><p className="text-gray-600 mt-4">Memuat data...</p></div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {!isEditing && (
        <>
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Mata Pelajaran *</label>
            <select value={selectedCourse}
              onChange={(e) => { setSelectedCourse(e.target.value); setSelectedLevels([]); setSelectedChapter(''); setSelectedUnit(''); setSelectedLesson(''); fetchLevels(e.target.value); }}
              required className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] focus:border-[#5C4FE5] bg-white text-gray-900 font-medium">
              <option value="">Pilih Mata Pelajaran</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {selectedCourse && levels.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-semibold text-gray-900">Level * (pilih 1 atau lebih)</label>
                <div className="flex gap-2">
                  <button type="button" onClick={selectAllLevels} className="px-3 py-1 text-xs bg-[#5C4FE5] text-white rounded-full hover:bg-[#4a3ec7] font-semibold">Pilih Semua</button>
                  {selectedLevels.length > 0 && <button type="button" onClick={clearAllLevels} className="px-3 py-1 text-xs bg-gray-200 text-gray-700 rounded-full hover:bg-gray-300 font-semibold">Clear</button>}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {levels.map((level) => (
                  <button key={level.id} type="button" onClick={() => toggleLevel(level.id)}
                    className={`px-4 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-1.5 ${selectedLevels.includes(level.id) ? 'bg-[#5C4FE5] text-white shadow-md' : 'bg-[#F7F6FF] text-[#4A4580] border border-[#E5E3FF] hover:border-[#5C4FE5]'}`}>
                    {selectedLevels.includes(level.id) && <Check size={12}/>}
                    {level.name}
                  </button>
                ))}
              </div>
              {selectedLevels.length > 0 && <p className="mt-2 text-xs text-[#5C4FE5] font-semibold">Material akan dibuat untuk {selectedLevels.length} level</p>}
            </div>
          )}

          {selectedLevels.length > 0 && (
            <>
              <div className="flex items-center gap-2 px-4 py-2.5 bg-[#F0EFFF] rounded-xl text-sm flex-wrap">
                <span className="text-[#7B78A8]">📍</span>
                <span className="font-semibold text-[#5C4FE5]">{courses.find(c => c.id === selectedCourse)?.name}</span>
                <span className="text-[#C4BFFF]">→</span>
                <span className="font-semibold text-[#5C4FE5]">{selectedLevels.length} level dipilih</span>
                {isMultiLevel && (
                  <>
                    <span className="text-[#C4BFFF]">→</span>
                    <span className="px-2 py-0.5 bg-[#5C4FE5] text-white text-xs font-semibold rounded-full">Multi-level mode</span>
                  </>
                )}
              </div>

              {/* ════════ SINGLE-LEVEL MODE ════════ */}
              {!isMultiLevel && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">Chapter *</label>
                      <select value={selectedChapter} onChange={(e) => { setSelectedChapter(e.target.value); setSelectedUnit(e.target.value === 'NEW' ? 'NEW' : ''); setSelectedLesson(e.target.value === 'NEW' ? 'NEW' : ''); if (e.target.value !== 'NEW') fetchUnits(e.target.value); }} required
                        className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] focus:border-[#5C4FE5] bg-white text-gray-900 font-medium">
                        <option value="">Pilih Chapter</option>
                        <option value="NEW">+ Buat Chapter Baru</option>
                        {chapters.map((ch) => <option key={ch.id} value={ch.id}>{ch.chapter_title}{ch.level_name ? ` (${ch.level_name})` : ''}</option>)}
                      </select>
                      {selectedChapter === 'NEW' && <input type="text" value={newChapterTitle} onChange={(e) => setNewChapterTitle(e.target.value)} placeholder="Nama Chapter Baru" required className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] mt-2 bg-white text-gray-900 font-medium"/>}
                    </div>
                    {selectedChapter && (
                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">Unit *</label>
                        <select value={selectedUnit} onChange={(e) => { setSelectedUnit(e.target.value); setSelectedLesson(e.target.value === 'NEW' ? 'NEW' : ''); if (e.target.value !== 'NEW') fetchLessons(e.target.value); }} required
                          className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] focus:border-[#5C4FE5] bg-white text-gray-900 font-medium">
                          <option value="">Pilih Unit</option>
                          <option value="NEW">+ Buat Unit Baru</option>
                          {units.map((u) => <option key={u.id} value={u.id}>{u.unit_name}</option>)}
                        </select>
                        {selectedUnit === 'NEW' && (
                          <div className="mt-2 space-y-2">
                            <input type="text" value={newUnitName} onChange={(e) => setNewUnitName(e.target.value)} placeholder="Nama Unit Baru" required className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900 font-medium"/>
                            <div className="flex items-center gap-3">
                              <label className="text-sm font-semibold text-gray-700 whitespace-nowrap">Urutan *</label>
                              <input type="number" value={newUnitPosition} onChange={(e) => setNewUnitPosition(parseInt(e.target.value) || 1)} min="1" required className="w-24 px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900 font-medium"/>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {selectedUnit && selectedUnit !== 'NEW' && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">Lesson</label>
                      {lessons.length > 0 ? (() => {
                        const lastWithMat = [...lessons].reverse().find((l: any) => lessonHasMaterial[l.id]);
                        return lastWithMat ? (
                          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl mb-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500">Lesson terakhir:</span>
                              <span className="text-sm font-semibold text-gray-900">{lastWithMat.position}. {lastWithMat.lesson_name}</span>
                            </div>
                            <span className="text-xs px-2.5 py-1 rounded-full bg-green-50 text-green-700 font-semibold">sudah ada materi</span>
                          </div>
                        ) : null;
                      })() : (
                        <div className="px-4 py-3 bg-gray-50 rounded-xl mb-3"><span className="text-sm text-gray-500 italic">Belum ada lesson</span></div>
                      )}
                      <div className={`border-2 rounded-xl p-4 ${lessonPositionValid === false ? 'border-red-300 bg-red-50' : lessonPositionValid === true ? 'border-[#5C4FE5]/30 bg-[#F0EFFF]' : 'border-dashed border-[#E5E3FF] bg-[#F7F6FF]'}`}>
                        <div className="flex items-center gap-3 mb-3">
                          <div>
                            <div className="text-xs text-[#7B78A8] mb-1">Posisi</div>
                            <input type="number" value={newLessonPosition} onChange={(e) => validateLessonPosition(parseInt(e.target.value) || 1)} min="1" required
                              className={`w-16 px-3 py-2 border-2 rounded-lg text-center font-semibold ${lessonPositionValid === false ? 'border-red-400 text-red-600' : 'border-[#E5E3FF] text-[#5C4FE5]'} bg-white`}/>
                          </div>
                          <div className="flex-1">
                            <div className="text-xs text-[#7B78A8] mb-1">Nama lesson</div>
                            <input type="text" value={useExistingLesson ? (lessons.find((l: any) => l.id === useExistingLesson)?.lesson_name || '') : newLessonName}
                              onChange={(e) => { if (!useExistingLesson) setNewLessonName(e.target.value); }}
                              placeholder="Contoh: Week 13-16" readOnly={!!useExistingLesson} required={!useExistingLesson}
                              className={`w-full px-3 py-2 border-2 border-[#E5E3FF] rounded-lg bg-white text-gray-900 font-medium ${useExistingLesson ? 'bg-gray-50 text-gray-600' : ''}`}/>
                          </div>
                        </div>
                        {lessonPositionValid !== null && (
                          <div className={`flex items-center gap-2 text-xs font-semibold ${lessonPositionValid ? 'text-green-700' : 'text-red-600'}`}>
                            <span>{lessonPositionValid ? '✅' : '🚫'}</span><span>{lessonPositionMsg}</span>
                          </div>
                        )}
                        {lessonPositionValid === null && <p className="text-xs text-[#7B78A8]">Posisi otomatis. Ubah angka jika ingin menaruh di urutan lain.</p>}
                      </div>
                    </div>
                  )}

                  {selectedUnit === 'NEW' && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">Lesson (unit baru)</label>
                      <div className="border-2 border-dashed border-[#E5E3FF] bg-[#F7F6FF] rounded-xl p-4">
                        <div className="flex items-center gap-3">
                          <div>
                            <div className="text-xs text-[#7B78A8] mb-1">Posisi</div>
                            <input type="number" value={1} readOnly className="w-16 px-3 py-2 border-2 border-[#E5E3FF] rounded-lg text-center font-semibold text-[#5C4FE5] bg-gray-50"/>
                          </div>
                          <div className="flex-1">
                            <div className="text-xs text-[#7B78A8] mb-1">Nama lesson</div>
                            <input type="text" value={newLessonName} onChange={(e) => setNewLessonName(e.target.value)} placeholder="Contoh: Week 01-04" required
                              className="w-full px-3 py-2 border-2 border-[#E5E3FF] rounded-lg bg-white text-gray-900 font-medium"/>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ════════ MULTI-LEVEL MODE ════════ */}
              {isMultiLevel && (
                <>
                  {/* ✅ Referensi struktur existing */}
                  <div className="border-2 border-blue-200 rounded-xl overflow-hidden">
                    <button type="button" onClick={() => setShowStructure(!showStructure)}
                      className="w-full px-5 py-3 flex items-center justify-between bg-blue-50 hover:bg-blue-100 transition-colors">
                      <span className="text-sm font-bold text-blue-800 flex items-center gap-2">
                        📋 Struktur existing per level
                        {loadingStructure && <span className="text-xs font-normal text-blue-500">(memuat...)</span>}
                      </span>
                      <span className="text-blue-500 text-xs">{showStructure ? '▲ Tutup' : '▼ Buka'}</span>
                    </button>
                    {showStructure && (
                      <div className="px-5 py-4 bg-white space-y-4 max-h-[400px] overflow-y-auto">
                        {loadingStructure ? (
                          <div className="flex items-center gap-2 text-sm text-gray-400 py-4 justify-center">
                            <div className="animate-spin w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full"></div>
                            Memuat struktur...
                          </div>
                        ) : levelStructures.length === 0 ? (
                          <p className="text-sm text-gray-400 text-center py-4">Belum ada data struktur</p>
                        ) : (
                          levelStructures.map(ls => (
                            <div key={ls.levelId}>
                              <div className="text-xs font-bold text-[#5C4FE5] uppercase tracking-wide mb-2">{ls.levelName}</div>
                              {ls.chapters.length === 0 ? (
                                <p className="text-xs text-gray-400 italic ml-3 mb-2">Belum ada chapter</p>
                              ) : (
                                ls.chapters.map(ch => (
                                  <div key={ch.id} className="ml-3 mb-2">
                                    <div className="text-sm font-semibold text-gray-800">📚 {ch.title}</div>
                                    {ch.units.length === 0 ? (
                                      <p className="text-xs text-gray-400 italic ml-5">Belum ada unit</p>
                                    ) : (
                                      ch.units.map(u => (
                                        <div key={u.id} className="ml-5 flex items-center gap-2 py-0.5">
                                          <span className="text-xs text-gray-600">📖 {u.name}</span>
                                          <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded font-semibold">{u.lessonCount} lesson</span>
                                          {u.lastLesson && (
                                            <span className="text-xs text-gray-400">terakhir: <span className="font-medium text-gray-600">{u.lastLesson}</span></span>
                                          )}
                                        </div>
                                      ))
                                    )}
                                  </div>
                                ))
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  <div className="border-2 border-[#E5E3FF] rounded-xl p-5 bg-[#FAFAFF]">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="w-6 h-6 flex items-center justify-center bg-[#5C4FE5] text-white text-xs font-bold rounded-full">1</span>
                      <span className="text-sm font-bold text-gray-900">Nama struktur (berlaku untuk semua level)</span>
                    </div>
                    <p className="text-xs text-gray-500 mb-4">Pilih dari existing atau ketik nama baru. Jika belum ada di suatu level, dibuat otomatis.</p>

                    {(() => {
                      // Compute suggestions from levelStructures
                      const uniqueChapters = [...new Set(levelStructures.flatMap(ls => ls.chapters.map(ch => ch.title)))];

                      const matchedUnits = levelStructures.flatMap(ls =>
                        ls.chapters
                          .filter(ch => ch.title.toLowerCase() === newChapterTitle.toLowerCase())
                          .flatMap(ch => ch.units)
                      );
                      const uniqueUnits = [...new Set(matchedUnits.map(u => u.name))];

                      // Get max lesson position for selected unit
                      const matchedUnitData = matchedUnits.filter(u => u.name.toLowerCase() === newUnitName.toLowerCase());
                      const maxLessonCount = Math.max(0, ...matchedUnitData.map(u => u.lessonCount));

                      // Collect unique lesson names from matched units
                      // We need to fetch lessons for the matched units — but we already have lastLesson info
                      // For full lesson list, we'd need another query. For now, show lastLesson as hint.
                      const lastLessonHint = matchedUnitData.find(u => u.lastLesson)?.lastLesson || null;

                      return (
                        <div className="space-y-4">
                          <div>
                            <label className="block text-xs font-semibold text-[#7B78A8] mb-1">Nama Chapter *</label>
                            <input type="text" list="chapter-suggestions" value={newChapterTitle}
                              onChange={(e) => { setNewChapterTitle(e.target.value); setNewUnitName(''); setNewLessonName(''); setNewLessonPosition(1); }}
                              placeholder="Ketik atau pilih chapter..." required
                              className="w-full px-3 py-2.5 border-2 border-[#E5E3FF] rounded-lg focus:ring-2 focus:ring-[#5C4FE5] focus:border-[#5C4FE5] bg-white text-gray-900 font-medium"/>
                            <datalist id="chapter-suggestions">
                              {uniqueChapters.map(name => <option key={name} value={name} />)}
                            </datalist>
                            {newChapterTitle && uniqueChapters.some(c => c.toLowerCase() === newChapterTitle.toLowerCase()) && (
                              <p className="text-xs text-green-600 mt-1 font-semibold">✅ Chapter existing — akan dipakai</p>
                            )}
                            {newChapterTitle && !uniqueChapters.some(c => c.toLowerCase() === newChapterTitle.toLowerCase()) && (
                              <p className="text-xs text-blue-600 mt-1 font-semibold">🆕 Chapter baru — akan dibuat di semua level</p>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="sm:col-span-2">
                              <label className="block text-xs font-semibold text-[#7B78A8] mb-1">Nama Unit *</label>
                              <input type="text" list="unit-suggestions" value={newUnitName}
                                onChange={(e) => { setNewUnitName(e.target.value); setNewLessonName(''); setNewLessonPosition(1); }}
                                placeholder="Ketik atau pilih unit..." required
                                className="w-full px-3 py-2.5 border-2 border-[#E5E3FF] rounded-lg focus:ring-2 focus:ring-[#5C4FE5] focus:border-[#5C4FE5] bg-white text-gray-900 font-medium"/>
                              <datalist id="unit-suggestions">
                                {uniqueUnits.map(name => <option key={name} value={name} />)}
                              </datalist>
                              {newUnitName && uniqueUnits.some(u => u.toLowerCase() === newUnitName.toLowerCase()) && (
                                <p className="text-xs text-green-600 mt-1 font-semibold">✅ Unit existing — akan dipakai</p>
                              )}
                              {newUnitName && !uniqueUnits.some(u => u.toLowerCase() === newUnitName.toLowerCase()) && newChapterTitle && (
                                <p className="text-xs text-blue-600 mt-1 font-semibold">🆕 Unit baru</p>
                              )}
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-[#7B78A8] mb-1">Urutan Unit</label>
                              <input type="number" value={newUnitPosition} onChange={(e) => setNewUnitPosition(parseInt(e.target.value) || 1)} min="1"
                                className="w-full px-3 py-2.5 border-2 border-[#E5E3FF] rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900 font-medium"/>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="sm:col-span-2">
                              <label className="block text-xs font-semibold text-[#7B78A8] mb-1">Nama Lesson *</label>
                              <input type="text" value={newLessonName} onChange={(e) => setNewLessonName(e.target.value)}
                                placeholder="Contoh: Collective Nouns" required
                                className="w-full px-3 py-2.5 border-2 border-[#E5E3FF] rounded-lg focus:ring-2 focus:ring-[#5C4FE5] focus:border-[#5C4FE5] bg-white text-gray-900 font-medium"/>
                              {lastLessonHint && newUnitName && (
                                <p className="text-xs text-gray-500 mt-1">Lesson terakhir: <span className="font-semibold text-gray-700">{lastLessonHint}</span></p>
                              )}
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-[#7B78A8] mb-1">Posisi Lesson</label>
                              <input type="number" value={newLessonPosition} onChange={(e) => setNewLessonPosition(parseInt(e.target.value) || 1)} min="1"
                                className="w-full px-3 py-2.5 border-2 border-[#E5E3FF] rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900 font-medium"/>
                              {maxLessonCount > 0 && newUnitName && (
                                <p className="text-xs text-gray-400 mt-1">Unit ini punya {maxLessonCount} lesson</p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div
                    className={`border-2 rounded-xl p-5 transition-colors ${isDragging ? 'border-[#5C4FE5] bg-[#F0EFFF]' : 'border-[#E5E3FF] bg-[#FAFAFF]'}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <span className="w-6 h-6 flex items-center justify-center bg-[#5C4FE5] text-white text-xs font-bold rounded-full">2</span>
                      <span className="text-sm font-bold text-gray-900">Upload file per level</span>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">Upload file berbeda untuk setiap level. Diurutkan dari level terendah.</p>

                    {/* ✅ Drag-drop hint */}
                    <div className={`mb-3 px-4 py-3 rounded-lg border-2 border-dashed text-center transition-colors ${
                      isDragging ? 'border-[#5C4FE5] bg-white' : 'border-gray-300 bg-gray-50'
                    }`}>
                      <p className={`text-sm font-semibold ${isDragging ? 'text-[#5C4FE5]' : 'text-gray-400'}`}>
                        {isDragging ? '📥 Lepas file di sini...' : '📁 Drag & drop file ke sini — auto-match by nama level'}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Contoh: <span className="font-mono">nouns-eng2.1.jsx</span> otomatis masuk ke ENG 2.1
                      </p>
                    </div>

                    <div className="space-y-2">
                      {sortedSelectedLevels.map((level, idx) => {
                        const file = jsxFiles[level.id];
                        return (
                          <div key={level.id} className={`flex items-center gap-3 px-4 py-3 rounded-lg border-2 transition-colors ${file ? 'border-green-300 bg-green-50' : 'border-dashed border-gray-300 bg-gray-50'}`}>
                            <span className="w-6 h-6 flex items-center justify-center bg-gray-200 text-gray-600 text-xs font-bold rounded-full">{idx + 1}</span>
                            <span className={`text-sm font-bold min-w-[110px] ${file ? 'text-green-700' : 'text-gray-600'}`}>
                              {file && <span className="mr-1">✅</span>}{level.name}
                            </span>
                            <label className="cursor-pointer flex-shrink-0">
                              <input type="file" accept=".jsx,.tsx,.js" className="hidden" onChange={(e) => setFileForLevel(level.id, e.target.files?.[0] ?? null)} />
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 border-2 border-dashed rounded-lg text-xs font-semibold transition-colors ${file ? 'border-green-400 text-green-700 hover:bg-green-100' : 'border-[#5C4FE5] text-[#5C4FE5] hover:bg-[#F7F6FF]'}`}>
                                {file ? '🔄 Ganti' : '📂 Pilih File'}
                              </span>
                            </label>
                            {file ? (
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span className="text-xs text-gray-600 truncate">{file.name}</span>
                                <button type="button" onClick={() => setFileForLevel(level.id, null)} className="text-red-500 hover:text-red-700 text-xs flex-shrink-0">✕</button>
                              </div>
                            ) : (<span className="text-xs text-gray-400">Belum dipilih</span>)}
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-[#5C4FE5] rounded-full transition-all" style={{ width: `${(filledCount / sortedSelectedLevels.length) * 100}%` }} />
                      </div>
                      <span className={`text-xs font-semibold ${filledCount === sortedSelectedLevels.length ? 'text-green-600' : 'text-gray-500'}`}>{filledCount}/{sortedSelectedLevels.length} file</span>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}

      {isEditing && (
        <>
          <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4">
            <div className="flex gap-3">
              <AlertCircle className="text-yellow-600 flex-shrink-0" size={20} />
              <div className="text-sm text-yellow-800">
                <p className="font-semibold mb-1">⚠️ Perhatian:</p>
                <p>Mengubah nama Unit/Lesson akan mempengaruhi <strong>SEMUA materials</strong> yang menggunakan Unit/Lesson ini.</p>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Material Title *</label>
            <input type="text" value={editMaterialTitle} onChange={(e) => setEditMaterialTitle(e.target.value)} required className="w-full px-3 py-2 border border-gray-400 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900" />
          </div>
          <div className="border-t-2 border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">📦 Unit Settings</h3>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-gray-900 mb-2">Unit Name *</label><input type="text" value={editUnitName} onChange={(e) => setEditUnitName(e.target.value)} required className="w-full px-3 py-2 border border-gray-400 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900" /></div>
              <div><label className="block text-sm font-medium text-gray-900 mb-2">Unit Position *</label><input type="number" value={editUnitPosition} onChange={(e) => setEditUnitPosition(parseInt(e.target.value))} min="0" required className="w-full px-3 py-2 border border-gray-400 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900" /></div>
            </div>
          </div>
          <div className="border-t-2 border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">📚 Lesson Settings</h3>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-gray-900 mb-2">Lesson Name *</label><input type="text" value={editLessonName} onChange={(e) => setEditLessonName(e.target.value)} required className="w-full px-3 py-2 border border-gray-400 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900" /></div>
              <div><label className="block text-sm font-medium text-gray-900 mb-2">Lesson Position *</label><input type="number" value={editLessonPosition} onChange={(e) => setEditLessonPosition(parseInt(e.target.value))} min="0" required className="w-full px-3 py-2 border border-gray-400 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900" /></div>
            </div>
          </div>
        </>
      )}

      <div className={isEditing ? 'border-t-2 border-gray-200 pt-6' : ''}>
        {isEditing && <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">📄 Material Content</h3>}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full px-3 py-2 border border-gray-400 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900" />
        </div>

        {(!isMultiLevel || isEditing) && (
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">File JSX Bacaan {!isEditing && <span className="text-red-500">*</span>}</label>
            <div className="flex items-center gap-3">
              <label className="cursor-pointer">
                <input type="file" accept=".jsx,.tsx,.js" className="hidden" onChange={(e) => setJsxFile(e.target.files?.[0] ?? null)} />
                <span className="inline-flex items-center gap-2 px-4 py-2 border-2 border-dashed border-[#5C4FE5] text-[#5C4FE5] rounded-lg hover:bg-[#F7F6FF] transition-colors font-medium text-sm">{jsxFile ? '🔄 Ganti File' : '📂 Pilih File JSX'}</span>
              </label>
              {jsxFile ? (
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-sm text-gray-600 truncate">{jsxFile.name}</span>
                  <button type="button" onClick={() => setJsxFile(null)} className="text-red-500 hover:text-red-700 text-xs flex-shrink-0">✕ Hapus</button>
                </div>
              ) : (<span className="text-sm text-gray-400">{isEditing ? 'Kosongkan jika tidak ingin ganti file' : 'Pilih file .jsx atau .tsx'}</span>)}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <input type="checkbox" id="isPublished" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} className="w-4 h-4 text-[#5C4FE5] focus:ring-[#5C4FE5]" />
          <label htmlFor="isPublished" className="text-sm font-medium text-gray-900">Publish (siswa bisa lihat)</label>
        </div>
      </div>

      <div className="flex gap-3 pt-4 border-t-2 border-gray-200">
        <button type="button" onClick={onCancel} className="flex-1 px-4 py-2 border border-gray-400 text-gray-900 rounded-lg hover:bg-gray-50 font-medium">Batal</button>
        <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-[#5C4FE5] text-white rounded-lg hover:bg-[#4a3ec7] disabled:opacity-50 font-medium">
          {loading ? 'Menyimpan...' : isEditing ? 'Update' : isMultiLevel ? `Simpan untuk ${selectedLevels.length} level` : 'Simpan'}
        </button>
      </div>
    </form>
  );
}
