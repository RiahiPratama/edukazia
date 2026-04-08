'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AlertCircle } from 'lucide-react';

type Material = {
  id: string;
  title: string;
  material_contents?: { content_url: string | null }[];
  position: number;
  is_published: boolean;
  level_id: string;
  unit_id: string;
  lesson_id: string;
};

type LiveZoomFormProps = {
  onSave: () => void;
  onCancel: () => void;
  editData?: Material | null;
};

export default function LiveZoomForm({ onSave, onCancel, editData }: LiveZoomFormProps) {
  const [courses, setCourses] = useState<any[]>([]);
  const [levels, setLevels] = useState<any[]>([]);
  const [chapters, setChapters] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [lessons, setLessons] = useState<any[]>([]);

  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('');
  const [selectedChapter, setSelectedChapter] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('');
  const [selectedLesson, setSelectedLesson] = useState('');

  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitPosition, setNewUnitPosition] = useState(1);
  const [newLessonName, setNewLessonName] = useState('');
  const [newLessonPosition, setNewLessonPosition] = useState(1);

  const [platform, setPlatform] = useState('canva');
  const [url, setUrl] = useState('');
  const [canvaUrl, setCanvaUrl] = useState('');
  const [slidesUrl, setSlidesUrl] = useState('');
  const [tutorSlidesUrl, setTutorSlidesUrl] = useState('');

  const [orderNumber, setOrderNumber] = useState(1);
  const [isPublished, setIsPublished] = useState(false);

  const [editLevelName, setEditLevelName] = useState('');
  const [editChapterTitle, setEditChapterTitle] = useState('');
  const [editChapterId, setEditChapterId] = useState('');
  const [editUnitName, setEditUnitName] = useState('');
  const [editUnitPosition, setEditUnitPosition] = useState(1); // FIX: default 1, bukan 0
  const [editLessonName, setEditLessonName] = useState('');
  const [editLessonPosition, setEditLessonPosition] = useState(1); // FIX: default 1, bukan 0

  const [lessonHasMaterial, setLessonHasMaterial] = useState<Record<string, boolean>>({})
  const [lessonPositionValid, setLessonPositionValid] = useState<boolean | null>(null)
  const [lessonPositionMsg, setLessonPositionMsg] = useState('')
  const [useExistingLesson, setUseExistingLesson] = useState<string | null>(null)

  const [loading, setLoading] = useState(false);
  const [loadingEditData, setLoadingEditData] = useState(false);

  const supabase = createClient();
  const isEditing = !!editData;

  useEffect(() => {
    fetchCourses();
  }, []);

  const detectPlatformFromUrl = (inputUrl: string): string => {
    if (!inputUrl) return 'canva';
    const lower = inputUrl.toLowerCase();
    if (lower.includes('zoom.us') || lower.includes('zoom.com')) return 'zoom';
    if (lower.includes('meet.google.com')) return 'google_meet';
    return 'canva';
  };

  useEffect(() => {
    if (editData) {
      const contentUrl = editData.material_contents?.[0]?.content_url || '';
      setUrl(contentUrl);
      setPlatform(detectPlatformFromUrl(contentUrl));
      setOrderNumber(editData.position || 1);
      setIsPublished(editData.is_published || false);
      fetchEditModeData();
    }
  }, [editData]);

  const fetchEditModeData = async () => {
    if (!editData) return;
    setLoadingEditData(true);
    try {
      const { data: levelData } = await supabase
        .from('levels')
        .select('name')
        .eq('id', editData.level_id)
        .single();
      if (levelData) setEditLevelName(levelData.name);

      const { data: unitData } = await supabase
        .from('units')
        .select('unit_name, position, chapter_id')
        .eq('id', editData.unit_id)
        .single();

      if (unitData) {
        setEditUnitName(unitData.unit_name);
        // FIX: pastikan minimum 1, bukan 0
        setEditUnitPosition(Math.max(unitData.position || 1, 1));

        if (unitData.chapter_id) {
          setEditChapterId(unitData.chapter_id);
          const { data: chapterData } = await supabase
            .from('chapters')
            .select('chapter_title')
            .eq('id', unitData.chapter_id)
            .single();
          if (chapterData) setEditChapterTitle(chapterData.chapter_title);
        }
      }

      const { data: lessonData } = await supabase
        .from('lessons')
        .select('lesson_name, position')
        .eq('id', editData.lesson_id)
        .single();
      if (lessonData) {
        setEditLessonName(lessonData.lesson_name);
        // FIX: pastikan minimum 1, bukan 0
        setEditLessonPosition(Math.max(lessonData.position || 1, 1));
      }
    } catch (error) {
      console.error('Error fetching edit data:', error);
    } finally {
      setLoadingEditData(false);
    }
  };

  useEffect(() => {
    if (selectedLevel) {
      fetchChapters(selectedLevel);
    } else {
      setChapters([]);
      setSelectedChapter('');
    }
  }, [selectedLevel]);

  useEffect(() => {
    if (selectedChapter && selectedChapter !== 'NEW') {
      fetchUnits(selectedChapter);
    } else {
      setUnits([]);
      setSelectedUnit('');
    }
  }, [selectedChapter]);

  useEffect(() => {
    if (selectedUnit && selectedUnit !== 'NEW') {
      fetchLessons(selectedUnit);
    } else {
      setLessons([]);
      setSelectedLesson('');
    }
  }, [selectedUnit]);

  const fetchCourses = async () => {
    const { data } = await supabase.from('courses').select('*').eq('is_active', true);
    setCourses(data || []);
  };

  const fetchLevels = async (courseId: string) => {
    const { data } = await supabase.from('levels').select('*').eq('course_id', courseId).order('sort_order');
    setLevels(data || []);
  };

  const fetchChapters = async (levelId: string) => {
    const { data } = await supabase.from('chapters').select('*').eq('level_id', levelId).order('order_number');
    setChapters(data || []);
  };

  const fetchUnits = async (chapterId: string) => {
    const { data } = await supabase.from('units').select('*').eq('chapter_id', chapterId).order('position');
    setUnits(data || []);
  };

  const fetchLessons = async (unitId: string) => {
    const { data } = await supabase.from('lessons').select('*').eq('unit_id', unitId).order('position');
    setLessons(data || []);
    // Check which lessons already have materials for this category
    if (data && data.length > 0) {
      const lessonIds = data.map((l: any) => l.id);
      const { data: mats } = await supabase
        .from('materials')
        .select('lesson_id')
        .in('lesson_id', lessonIds)
        .eq('category', 'live_zoom');
      const matSet: Record<string, boolean> = {};
      (mats || []).forEach((m: any) => { matSet[m.lesson_id] = true; });
      setLessonHasMaterial(matSet);
      // Auto-set new lesson position
      const maxPos = Math.max(...data.map((l: any) => l.position || 0), 0);
      setNewLessonPosition(maxPos + 1);
      // Find last lesson with material
      const lastWithMat = [...data].reverse().find((l: any) => matSet[l.id]);
      const lastEmpty = [...data].reverse().find((l: any) => !matSet[l.id]);
      // Auto-select existing empty lesson if available
      if (lastEmpty) {
        setUseExistingLesson(lastEmpty.id);
        setSelectedLesson(lastEmpty.id);
      } else {
        setUseExistingLesson(null);
        setSelectedLesson('NEW');
      }
    } else {
      setLessonHasMaterial({});
      setNewLessonPosition(1);
      setUseExistingLesson(null);
      setSelectedLesson('NEW');
    }
  };

  const validateLessonPosition = (pos: number) => {
    setNewLessonPosition(pos);
    const existing = lessons.find((l: any) => l.position === pos);
    if (existing) {
      const hasMat = lessonHasMaterial[existing.id];
      if (hasMat) {
        setLessonPositionValid(false);
        setLessonPositionMsg(`Posisi ${pos} sudah terisi "${existing.lesson_name}" dan sudah ada materi`);
      } else {
        setLessonPositionValid(true);
        setLessonPositionMsg(`Posisi ${pos} ada "${existing.lesson_name}" tapi belum ada materi — akan dipakai`);
        setUseExistingLesson(existing.id);
        setSelectedLesson(existing.id);
      }
    } else {
      setLessonPositionValid(true);
      setLessonPositionMsg(`Posisi ${pos} tersedia`);
      setUseExistingLesson(null);
      setSelectedLesson('NEW');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isEditing) {
        const formData = new FormData();
        formData.append('material_id', editData.id);
        formData.append('chapter_id', editChapterId || '');
        formData.append('chapter_title', editChapterTitle);
        formData.append('unit_id', editData.unit_id);
        formData.append('unit_name', editUnitName);
        formData.append('unit_position', editUnitPosition.toString());
        formData.append('lesson_id', editData.lesson_id);
        formData.append('lesson_name', editLessonName);
        formData.append('lesson_position', editLessonPosition.toString());
        formData.append('order_number', orderNumber.toString());
        formData.append('is_published', isPublished.toString());
        formData.append('content_data', JSON.stringify({ platform, url: canvaUrl || url }));
        formData.append('canva_url', canvaUrl);
        formData.append('student_content_url', slidesUrl);
        formData.append('slides_url', tutorSlidesUrl);

        const response = await fetch('/api/admin/materials', { method: 'PATCH', body: formData });
        const result = await response.json();

        if (!response.ok) throw new Error(`${result.error || 'Failed to update'}: ${result.details || ''}`);

        alert('✅ Material berhasil diupdate!');
        onSave();
      } else {
        // CREATE MODE
        if (!selectedLevel) { alert('❌ Level harus dipilih!'); setLoading(false); return; }
        if (lessonPositionValid === false) { alert('❌ Posisi lesson sudah terisi dengan materi!'); setLoading(false); return; }
        if (!selectedChapter || selectedChapter === 'NEW') {
          if (selectedChapter !== 'NEW') { alert('❌ Chapter harus dipilih!'); setLoading(false); return; }
        }

        // Create Chapter if NEW
        let actualChapterId = selectedChapter;
        if (selectedChapter === 'NEW' && newChapterTitle) {
          const { data: existingChapters } = await supabase
            .from('chapters')
            .select('order_number')
            .eq('level_id', selectedLevel)
            .order('order_number', { ascending: false })
            .limit(1);

          const nextOrderNumber = existingChapters && existingChapters.length > 0
            ? (existingChapters[0].order_number + 1) : 1;

          const { data: newChapter, error: chapterError } = await supabase
            .from('chapters')
            .insert({
              level_id: selectedLevel,
              chapter_title: newChapterTitle,
              chapter_number: nextOrderNumber,
              order_number: nextOrderNumber,
            })
            .select()
            .single();

          if (chapterError) { alert(`❌ Gagal membuat chapter: ${chapterError.message}`); setLoading(false); return; }
          actualChapterId = newChapter.id;
        }

        if (!actualChapterId || actualChapterId === 'NEW') {
          alert('❌ Chapter harus dipilih atau dibuat!'); setLoading(false); return;
        }

        // Create Unit if NEW
        let actualUnitId = selectedUnit;
        if (selectedUnit === 'NEW' && newUnitName) {
          const { data: newUnit, error: unitError } = await supabase
            .from('units')
            .insert({
              level_id: selectedLevel,
              chapter_id: actualChapterId,
              unit_name: newUnitName,
              unit_number: newUnitPosition, // FIX: pakai newUnitPosition bukan hardcode 0
              position: newUnitPosition,    // FIX: pakai newUnitPosition bukan hardcode 0
            })
            .select()
            .single();

          if (unitError) { alert(`❌ Gagal membuat unit: ${unitError.message}`); setLoading(false); return; }
          actualUnitId = newUnit.id;
        }

        const formData = new FormData();
        formData.append('title', newLessonName || selectedLesson);
        formData.append('category', 'live_zoom');
        formData.append('course_id', selectedCourse);
        formData.append('level_id', selectedLevel);
        formData.append('unit_id', actualUnitId);
        formData.append('lesson_id', selectedLesson === 'NEW' ? 'NEW' : selectedLesson);
        formData.append('lesson_name', newLessonName);
        formData.append('lesson_position_new', newLessonPosition.toString());
        formData.append('order_number', orderNumber.toString());
        formData.append('is_published', isPublished.toString());
        formData.append('content_data', JSON.stringify({ platform, url: canvaUrl || url }));
        formData.append('canva_url', canvaUrl);
        formData.append('student_content_url', slidesUrl);
        formData.append('slides_url', tutorSlidesUrl);

        const response = await fetch('/api/admin/materials', { method: 'POST', body: formData });
        const result = await response.json();

        if (!response.ok) throw new Error(`${result.error || 'Failed to create'}: ${result.details || ''}`);

        alert('✅ Material berhasil dibuat!');
        onSave();
      }
    } catch (error) {
      alert(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setLoading(false);
    }
  };

  if (loadingEditData) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-[#5C4FE5] border-t-transparent rounded-full mx-auto"></div>
        <p className="text-gray-600 mt-4">Memuat data...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {!isEditing && (
        <>
          {/* Mata Pelajaran — dropdown */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Mata Pelajaran *</label>
            <select value={selectedCourse}
              onChange={(e) => { setSelectedCourse(e.target.value); setSelectedLevel(''); setSelectedChapter(''); setSelectedUnit(''); setSelectedLesson(''); fetchLevels(e.target.value); }}
              required
              className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] focus:border-[#5C4FE5] bg-white text-gray-900 font-medium">
              <option value="">Pilih Mata Pelajaran</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Level — pill selector */}
          {selectedCourse && levels.length > 0 && (
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Level Kurikulum *</label>
              <div className="flex flex-wrap gap-2">
                {levels.map((level) => (
                  <button key={level.id} type="button"
                    onClick={() => { setSelectedLevel(level.id); setSelectedChapter(''); setSelectedUnit(''); setSelectedLesson(''); }}
                    className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                      selectedLevel === level.id
                        ? 'bg-[#5C4FE5] text-white shadow-md'
                        : 'bg-[#F7F6FF] text-[#4A4580] border border-[#E5E3FF] hover:border-[#5C4FE5] hover:text-[#5C4FE5]'
                    }`}>
                    {level.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedLevel && (
            <>
              {/* Breadcrumb */}
              <div className="flex items-center gap-2 px-4 py-2.5 bg-[#F0EFFF] rounded-xl text-sm">
                <span className="text-[#7B78A8]">📍</span>
                <span className="font-semibold text-[#5C4FE5]">{courses.find(c => c.id === selectedCourse)?.name}</span>
                <span className="text-[#C4BFFF]">→</span>
                <span className="font-semibold text-[#5C4FE5]">{levels.find(l => l.id === selectedLevel)?.name}</span>
                {selectedChapter && selectedChapter !== 'NEW' && (
                  <><span className="text-[#C4BFFF]">→</span><span className="text-[#5C4FE5]">{chapters.find(c => c.id === selectedChapter)?.chapter_title}</span></>
                )}
                {selectedUnit && selectedUnit !== 'NEW' && (
                  <><span className="text-[#C4BFFF]">→</span><span className="text-[#5C4FE5]">{units.find(u => u.id === selectedUnit)?.unit_name}</span></>
                )}
              </div>

              {/* Chapter + Unit — 2 kolom */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Chapter *</label>
                  <select value={selectedChapter} onChange={(e) => { setSelectedChapter(e.target.value); setSelectedUnit(''); setSelectedLesson(''); }} required
                    className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] focus:border-[#5C4FE5] bg-white text-gray-900 font-medium">
                    <option value="">Pilih Chapter</option>
                    <option value="NEW">+ Buat Chapter Baru</option>
                    {chapters.map((ch) => <option key={ch.id} value={ch.id}>{ch.chapter_title}</option>)}
                  </select>
                  {selectedChapter === 'NEW' && (
                    <input type="text" value={newChapterTitle}
                      onChange={(e) => setNewChapterTitle(e.target.value)}
                      placeholder="Nama Chapter Baru" required
                      className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] mt-2 bg-white text-gray-900 font-medium"/>
                  )}
                </div>

                {selectedChapter && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Unit *</label>
                    <select value={selectedUnit} onChange={(e) => { setSelectedUnit(e.target.value); setSelectedLesson(''); }} required
                      className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] focus:border-[#5C4FE5] bg-white text-gray-900 font-medium">
                      <option value="">Pilih Unit</option>
                      <option value="NEW">+ Buat Unit Baru</option>
                      {units.map((u) => <option key={u.id} value={u.id}>{u.unit_name}</option>)}
                    </select>
                    {selectedUnit === 'NEW' && (
                      <div className="mt-2 space-y-2">
                        <input type="text" value={newUnitName}
                          onChange={(e) => setNewUnitName(e.target.value)}
                          placeholder="Nama Unit Baru" required
                          className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900 font-medium"/>
                        <div className="flex items-center gap-3">
                          <label className="text-sm font-semibold text-gray-700 whitespace-nowrap">Urutan *</label>
                          <input type="number" value={newUnitPosition}
                            onChange={(e) => setNewUnitPosition(parseInt(e.target.value) || 1)}
                            min="1" required
                            className="w-24 px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900 font-medium"/>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Lesson — smart position input */}
              {selectedUnit && selectedUnit !== 'NEW' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Lesson</label>

                  {/* Info lesson terakhir */}
                  {lessons.length > 0 ? (() => {
                    const lastLesson = [...lessons].reverse().find((l: any) => lessonHasMaterial[l.id]);
                    const lastEmpty = [...lessons].reverse().find((l: any) => !lessonHasMaterial[l.id]);
                    return (
                      <>
                        {lastLesson && (
                          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl mb-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500">Lesson terakhir:</span>
                              <span className="text-sm font-semibold text-gray-900">{lastLesson.position}. {lastLesson.lesson_name}</span>
                            </div>
                            <span className="text-xs px-2.5 py-1 rounded-full bg-green-50 text-green-700 font-semibold">sudah ada materi</span>
                          </div>
                        )}
                        {lastEmpty && (
                          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl mb-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500">Lesson kosong:</span>
                              <span className="text-sm font-semibold text-gray-900">{lastEmpty.position}. {lastEmpty.lesson_name}</span>
                            </div>
                            <span className="text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-semibold">belum ada materi</span>
                          </div>
                        )}
                      </>
                    );
                  })() : (
                    <div className="px-4 py-3 bg-gray-50 rounded-xl mb-3">
                      <span className="text-sm text-gray-500 italic">Belum ada lesson di unit ini</span>
                    </div>
                  )}

                  {/* Input posisi + nama */}
                  <div className={`border-2 rounded-xl p-4 ${
                    lessonPositionValid === false ? 'border-red-300 bg-red-50' :
                    lessonPositionValid === true ? 'border-[#5C4FE5]/30 bg-[#F0EFFF]' :
                    'border-dashed border-[#E5E3FF] bg-[#F7F6FF]'
                  }`}>
                    <div className="flex items-center gap-3 mb-3">
                      <div>
                        <div className="text-xs text-[#7B78A8] mb-1">Posisi</div>
                        <input type="number" value={newLessonPosition}
                          onChange={(e) => validateLessonPosition(parseInt(e.target.value) || 1)}
                          min="1" required
                          className={`w-16 px-3 py-2 border-2 rounded-lg text-center font-semibold ${
                            lessonPositionValid === false ? 'border-red-400 text-red-600' : 'border-[#E5E3FF] text-[#5C4FE5]'
                          } bg-white focus:ring-2 focus:ring-[#5C4FE5]`}/>
                      </div>
                      <div className="flex-1">
                        <div className="text-xs text-[#7B78A8] mb-1">Nama lesson</div>
                        <input type="text" value={useExistingLesson ? (lessons.find((l: any) => l.id === useExistingLesson)?.lesson_name || '') : newLessonName}
                          onChange={(e) => { if (!useExistingLesson) setNewLessonName(e.target.value); }}
                          placeholder="Contoh: Week 13-16"
                          readOnly={!!useExistingLesson}
                          required={!useExistingLesson}
                          className={`w-full px-3 py-2 border-2 border-[#E5E3FF] rounded-lg bg-white text-gray-900 font-medium focus:ring-2 focus:ring-[#5C4FE5] ${useExistingLesson ? 'bg-gray-50 text-gray-600' : ''}`}/>
                      </div>
                    </div>
                    {lessonPositionValid !== null && (
                      <div className={`flex items-center gap-2 text-xs font-semibold ${lessonPositionValid ? 'text-green-700' : 'text-red-600'}`}>
                        <span>{lessonPositionValid ? '✅' : '🚫'}</span>
                        <span>{lessonPositionMsg}</span>
                      </div>
                    )}
                    {!lessonPositionValid && lessonPositionValid !== null && null}
                    {lessonPositionValid === null && (
                      <p className="text-xs text-[#7B78A8]">Posisi otomatis. Ubah angka jika ingin menaruh di urutan lain.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Lesson for NEW unit */}
              {selectedUnit === 'NEW' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Lesson (unit baru)</label>
                  <div className="border-2 border-dashed border-[#E5E3FF] bg-[#F7F6FF] rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="text-xs text-[#7B78A8] mb-1">Posisi</div>
                        <input type="number" value={1} readOnly
                          className="w-16 px-3 py-2 border-2 border-[#E5E3FF] rounded-lg text-center font-semibold text-[#5C4FE5] bg-gray-50"/>
                      </div>
                      <div className="flex-1">
                        <div className="text-xs text-[#7B78A8] mb-1">Nama lesson</div>
                        <input type="text" value={newLessonName}
                          onChange={(e) => setNewLessonName(e.target.value)}
                          placeholder="Contoh: Week 01-04" required
                          className="w-full px-3 py-2 border-2 border-[#E5E3FF] rounded-lg bg-white text-gray-900 font-medium focus:ring-2 focus:ring-[#5C4FE5]"/>
                      </div>
                    </div>
                    <p className="text-xs text-[#7B78A8] mt-2">Lesson pertama di unit baru ini</p>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {isEditing && (
        <>
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Level Kurikulum</label>
            <div className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg bg-gray-50 text-gray-600 font-medium">
              {editLevelName} 🔒 (tidak bisa diganti - mengacu ke siswa enrollment)
            </div>
          </div>

          {editChapterId && (
            <div className="border-t-2 border-gray-200 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">📚 Chapter Settings</h3>
              <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4 mb-4">
                <div className="flex gap-3">
                  <AlertCircle className="text-yellow-600 flex-shrink-0" size={20} />
                  <div className="text-sm text-yellow-800">
                    <p className="font-semibold mb-1">⚠️ Perhatian:</p>
                    <p>Mengubah nama Chapter akan mempengaruhi <strong>SEMUA materials, units, dan lessons</strong> dalam Chapter ini.</p>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Chapter Title *</label>
                <input type="text" value={editChapterTitle}
                  onChange={(e) => setEditChapterTitle(e.target.value)} required
                  className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900 font-medium"/>
              </div>
            </div>
          )}

          <div className="border-t-2 border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">📦 Unit Settings</h3>
            <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4 mb-4">
              <div className="flex gap-3">
                <AlertCircle className="text-yellow-600 flex-shrink-0" size={20} />
                <div className="text-sm text-yellow-800">
                  <p className="font-semibold mb-1">⚠️ Perhatian:</p>
                  <p>Mengubah nama Unit akan mempengaruhi <strong>SEMUA materials</strong> dalam Unit ini.</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Unit Name *</label>
                <input type="text" value={editUnitName}
                  onChange={(e) => setEditUnitName(e.target.value)} required
                  className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900 font-medium"/>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Unit Position *</label>
                <input type="number" value={editUnitPosition}
                  onChange={(e) => setEditUnitPosition(Math.max(parseInt(e.target.value) || 1, 1))}
                  min="1" required
                  className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900 font-medium"/>
              </div>
            </div>
          </div>

          <div className="border-t-2 border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">📄 Lesson Settings</h3>
            <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4 mb-4">
              <div className="flex gap-3">
                <AlertCircle className="text-yellow-600 flex-shrink-0" size={20} />
                <div className="text-sm text-yellow-800">
                  <p className="font-semibold mb-1">⚠️ Perhatian:</p>
                  <p>Mengubah nama Lesson akan mempengaruhi <strong>SEMUA materials</strong> dalam Lesson ini.</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Lesson Name *</label>
                <input type="text" value={editLessonName}
                  onChange={(e) => setEditLessonName(e.target.value)} required
                  className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900 font-medium"/>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Lesson Position *</label>
                <input type="number" value={editLessonPosition}
                  onChange={(e) => setEditLessonPosition(Math.max(parseInt(e.target.value) || 1, 1))}
                  min="1" required
                  className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900 font-medium"/>
              </div>
            </div>
          </div>
        </>
      )}

      <div className={isEditing ? 'border-t-2 border-gray-200 pt-6' : ''}>
        {isEditing && <h3 className="text-lg font-semibold text-gray-900 mb-4">📄 Material Content</h3>}

        <div className="bg-purple-50 border-2 border-[#5C4FE5]/30 rounded-xl p-4 mb-4">
          <p className="text-sm font-semibold text-[#5C4FE5] mb-1">📋 Konten per Tipe Akses</p>
          <p className="text-xs text-gray-600">Isi sesuai kebutuhan. Tidak semua field wajib diisi sekaligus.</p>
        </div>

        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <label className="block text-sm font-bold text-orange-700 mb-1">
            🎨 Canva URL <span className="text-xs font-normal">(untuk Tutor Owner)</span>
          </label>
          <input type="url" value={canvaUrl} onChange={(e) => setCanvaUrl(e.target.value)}
            placeholder="https://canva.link/..."
            className="w-full px-3 py-2.5 border-2 border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-400 bg-white text-gray-900 font-medium"/>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <label className="block text-sm font-bold text-blue-700 mb-1">
            📄 Konten Siswa – Google Drive PDF <span className="text-xs font-normal">(untuk Siswa EduKazia)</span>
          </label>
          <input type="url" value={slidesUrl} onChange={(e) => setSlidesUrl(e.target.value)}
            placeholder="https://drive.google.com/file/d/..."
            className="w-full px-3 py-2.5 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-400 bg-white text-gray-900 font-medium"/>
          <p className="text-xs text-blue-600 mt-1">⚠️ Pastikan file di-share ke service account EduKazia</p>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <label className="block text-sm font-bold text-green-700 mb-1">
            📊 Konten Tutor – Google Slides <span className="text-xs font-normal">(untuk Tutor Freelancer & B2B)</span>
          </label>
          <input type="url" value={tutorSlidesUrl} onChange={(e) => setTutorSlidesUrl(e.target.value)}
            placeholder="https://docs.google.com/presentation/d/..."
            className="w-full px-3 py-2.5 border-2 border-green-300 rounded-lg focus:ring-2 focus:ring-green-400 bg-white text-gray-900 font-medium"/>
          <p className="text-xs text-green-600 mt-1">⚠️ Pastikan file di-share ke service account EduKazia</p>
        </div>

        <div className="flex items-center gap-2">
          <input type="checkbox" id="isPublished" checked={isPublished}
            onChange={(e) => setIsPublished(e.target.checked)}
            className="w-4 h-4 text-[#5C4FE5] focus:ring-[#5C4FE5] border-gray-400 rounded"/>
          <label htmlFor="isPublished" className="text-sm font-semibold text-gray-900">
            Publish (siswa bisa lihat)
          </label>
        </div>
      </div>

      <div className="flex gap-3 pt-4 border-t-2 border-gray-200">
        <button type="button" onClick={onCancel}
          className="flex-1 px-4 py-2.5 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold transition-colors">
          Batal
        </button>
        <button type="submit" disabled={loading}
          className="flex-1 px-4 py-2.5 bg-[#5C4FE5] text-white rounded-lg hover:bg-[#4a3ec7] disabled:opacity-50 font-semibold shadow-md transition-all">
          {loading ? 'Menyimpan...' : isEditing ? 'Update' : 'Simpan'}
        </button>
      </div>
    </form>
  );
}
