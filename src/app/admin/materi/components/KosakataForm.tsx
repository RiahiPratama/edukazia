'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AlertCircle } from 'lucide-react';

// ✅ FIX 1: Type diperbarui — hapus content_data & order_number, tambah material_contents
type Material = {
  id: string;
  title: string;
  material_contents?: { content_url: string | null }[];
  position: number;
  is_published: boolean;
  unit_id: string;
  lesson_id: string;
};

type KosakataFormProps = {
  onSave: () => void;
  onCancel: () => void;
  editData?: Material | null;
};

export default function KosakataForm({ onSave, onCancel, editData }: KosakataFormProps) {
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

  const [fileType, setFileType] = useState('google_drive');
  const [url, setUrl] = useState('');
  const [orderNumber, setOrderNumber] = useState(1);
  const [isPublished, setIsPublished] = useState(false);

  // Edit mode fields
  const [editChapterId, setEditChapterId] = useState('');
  const [editChapterTitle, setEditChapterTitle] = useState('');
  const [editUnitName, setEditUnitName] = useState('');
  const [editUnitPosition, setEditUnitPosition] = useState(1);
  const [editLessonName, setEditLessonName] = useState('');
  const [editLessonPosition, setEditLessonPosition] = useState(1);
  const [editMaterialTitle, setEditMaterialTitle] = useState('');

  const [lessonHasMaterial, setLessonHasMaterial] = useState<Record<string, boolean>>({})
  const [lessonPositionValid, setLessonPositionValid] = useState<boolean | null>(null)
  const [lessonPositionMsg, setLessonPositionMsg] = useState('')
  const [useExistingLesson, setUseExistingLesson] = useState<string | null>(null)

  const [loading, setLoading] = useState(false);
  const [loadingEditData, setLoadingEditData] = useState(false);

  const supabase = createClient();
  const isEditing = !!editData;

  // ✅ FIX 3: Helper detect fileType dari URL — tidak perlu content_data lagi
  const detectFileTypeFromUrl = (inputUrl: string): string => {
    if (!inputUrl) return 'google_drive';
    const lower = inputUrl.toLowerCase();
    if (lower.includes('canva.com')) return 'canva';
    if (lower.includes('docs.google.com') || lower.includes('drive.google.com')) return 'google_drive';
    return 'pdf';
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  // ✅ FIX 2: Baca URL dari material_contents, bukan content_data
  useEffect(() => {
    if (editData) {
      const contentUrl = editData.material_contents?.[0]?.content_url || '';
      setUrl(contentUrl);
      setFileType(detectFileTypeFromUrl(contentUrl));
      setOrderNumber(editData.position || 1);
      setIsPublished(editData.is_published || false);
      setEditMaterialTitle(editData.title || '');
      fetchEditModeData();
    }
  }, [editData]);

  // ✅ FIX 4: fetchEditModeData sudah tidak perlu fetch material_contents
  // karena URL sudah tersedia di editData.material_contents dari parent
  const fetchEditModeData = async () => {
    if (!editData) return;
    setLoadingEditData(true);
    try {
      const { data: unitData } = await supabase
        .from('units')
        .select('unit_name, position, chapter_id')
        .eq('id', editData.unit_id)
        .single();

      if (unitData) {
        setEditUnitName(unitData.unit_name);
        setEditUnitPosition(unitData.position || 1);

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
        setEditLessonPosition(lessonData.position || 1);
      }
    } catch (error) {
      console.error('Error fetching edit data:', error);
    } finally {
      setLoadingEditData(false);
    }
  };

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
    if (data && data.length > 0) {
      const lessonIds = data.map((l: any) => l.id);
      const { data: mats } = await supabase.from('materials').select('lesson_id').in('lesson_id', lessonIds).eq('category', 'kosakata');
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
      const hasMat = lessonHasMaterial[existing.id];
      if (hasMat) {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const formData = new FormData();

      if (isEditing) {
        formData.append('material_id', editData.id);
        formData.append('title', editMaterialTitle);
        formData.append('chapter_id', editChapterId || '');
        formData.append('chapter_title', editChapterTitle);
        formData.append('order_number', orderNumber.toString());
        formData.append('is_published', isPublished.toString());
        // content_data di sini adalah nama field FormData (bukan kolom DB)
        // route.ts membaca ini untuk extract URL → content_url di material_contents
        formData.append('content_data', JSON.stringify({ url }));
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
      } else {
        // Validasi
        if (!selectedLevel) { alert('❌ Level harus dipilih!'); setLoading(false); return; }
        if (lessonPositionValid === false) { alert('❌ Posisi lesson sudah terisi!'); setLoading(false); return; }
        if (!selectedChapter) { alert('❌ Chapter harus dipilih!'); setLoading(false); return; }
        if (!selectedUnit) { alert('❌ Unit harus dipilih!'); setLoading(false); return; }
        if (!selectedLesson) { alert('❌ Lesson harus dipilih!'); setLoading(false); return; }
        if (!url) { alert('❌ URL tidak boleh kosong!'); setLoading(false); return; }

        formData.append('title', newLessonName || selectedLesson);
        formData.append('category', 'kosakata');
        formData.append('course_id', selectedCourse);
        formData.append('level_id', selectedLevel);
        formData.append('chapter_id', selectedChapter === 'NEW' ? 'NEW' : selectedChapter);
        formData.append('chapter_name', newChapterTitle);
        formData.append('unit_id', selectedUnit === 'NEW' ? 'NEW' : selectedUnit);
        formData.append('unit_name', newUnitName);
        formData.append('unit_position_new', newUnitPosition.toString());
        formData.append('lesson_id', selectedLesson === 'NEW' ? 'NEW' : selectedLesson);
        formData.append('lesson_name', newLessonName);
        formData.append('lesson_position_new', newLessonPosition.toString()); // ✅ posisi lesson baru
        formData.append('order_number', orderNumber.toString());
        formData.append('is_published', isPublished.toString());
        // content_data di sini adalah nama field FormData (bukan kolom DB)
        // route.ts membaca ini untuk extract URL → content_url di material_contents
        formData.append('content_data', JSON.stringify({ url }));

        const response = await fetch('/api/admin/materials', { method: 'POST', body: formData });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to create');
        alert('✅ Material Kosakata berhasil dibuat!');
        onSave();
      }
    } catch (error) {
      alert(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
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
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Mata Pelajaran *</label>
            <select value={selectedCourse}
              onChange={(e) => { setSelectedCourse(e.target.value); setSelectedLevel(''); setSelectedChapter(''); setSelectedUnit(''); setSelectedLesson(''); fetchLevels(e.target.value); }}
              required className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] focus:border-[#5C4FE5] bg-white text-gray-900 font-medium">
              <option value="">Pilih Mata Pelajaran</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {selectedCourse && levels.length > 0 && (
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Level Kurikulum *</label>
              <div className="flex flex-wrap gap-2">
                {levels.map((level) => (
                  <button key={level.id} type="button"
                    onClick={() => { setSelectedLevel(level.id); setSelectedChapter(''); setSelectedUnit(''); setSelectedLesson(''); fetchChapters(level.id); }}
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
              <div className="flex items-center gap-2 px-4 py-2.5 bg-[#F0EFFF] rounded-xl text-sm">
                <span className="text-[#7B78A8]">📍</span>
                <span className="font-semibold text-[#5C4FE5]">{courses.find(c => c.id === selectedCourse)?.name}</span>
                <span className="text-[#C4BFFF]">→</span>
                <span className="font-semibold text-[#5C4FE5]">{levels.find(l => l.id === selectedLevel)?.name}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Chapter *</label>
                  <select value={selectedChapter} onChange={(e) => { setSelectedChapter(e.target.value); setSelectedUnit(''); setSelectedLesson(''); if (e.target.value !== 'NEW') fetchUnits(e.target.value); }} required
                    className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] focus:border-[#5C4FE5] bg-white text-gray-900 font-medium">
                    <option value="">Pilih Chapter</option>
                    <option value="NEW">+ Buat Chapter Baru</option>
                    {chapters.map((ch) => <option key={ch.id} value={ch.id}>{ch.chapter_title}</option>)}
                  </select>
                  {selectedChapter === 'NEW' && (
                    <input type="text" value={newChapterTitle} onChange={(e) => setNewChapterTitle(e.target.value)} placeholder="Nama Chapter Baru" required
                      className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] mt-2 bg-white text-gray-900 font-medium"/>
                  )}
                </div>
                {selectedChapter && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Unit *</label>
                    <select value={selectedUnit} onChange={(e) => { setSelectedUnit(e.target.value); setSelectedLesson(''); if (e.target.value !== 'NEW') fetchLessons(e.target.value); }} required
                      className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] focus:border-[#5C4FE5] bg-white text-gray-900 font-medium">
                      <option value="">Pilih Unit</option>
                      <option value="NEW">+ Buat Unit Baru</option>
                      {units.map((u) => <option key={u.id} value={u.id}>{u.unit_name}</option>)}
                    </select>
                    {selectedUnit === 'NEW' && (
                      <div className="mt-2 space-y-2">
                        <input type="text" value={newUnitName} onChange={(e) => setNewUnitName(e.target.value)} placeholder="Nama Unit Baru" required
                          className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900 font-medium"/>
                        <div className="flex items-center gap-3">
                          <label className="text-sm font-semibold text-gray-700 whitespace-nowrap">Urutan *</label>
                          <input type="number" value={newUnitPosition} onChange={(e) => setNewUnitPosition(parseInt(e.target.value) || 1)} min="1" required
                            className="w-24 px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900 font-medium"/>
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
                    const lastEmpty = [...lessons].reverse().find((l: any) => !lessonHasMaterial[l.id]);
                    return (<>
                      {lastWithMat && (
                        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">Lesson terakhir:</span>
                            <span className="text-sm font-semibold text-gray-900">{lastWithMat.position}. {lastWithMat.lesson_name}</span>
                          </div>
                          <span className="text-xs px-2.5 py-1 rounded-full bg-green-50 text-green-700 font-semibold">sudah ada materi</span>
                        </div>
                      )}
                      {lastEmpty && !lastWithMat && (
                        <div className="px-4 py-3 bg-gray-50 rounded-xl mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">Lesson kosong:</span>
                            <span className="text-sm font-semibold text-gray-900">{lastEmpty.position}. {lastEmpty.lesson_name}</span>
                            <span className="text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-semibold">belum ada materi</span>
                          </div>
                        </div>
                      )}
                    </>);
                  })() : (
                    <div className="px-4 py-3 bg-gray-50 rounded-xl mb-3">
                      <span className="text-sm text-gray-500 italic">Belum ada lesson di unit ini</span>
                    </div>
                  )}
                  <div className={`border-2 rounded-xl p-4 ${lessonPositionValid === false ? 'border-red-300 bg-red-50' : lessonPositionValid === true ? 'border-[#5C4FE5]/30 bg-[#F0EFFF]' : 'border-dashed border-[#E5E3FF] bg-[#F7F6FF]'}`}>
                    <div className="flex items-center gap-3 mb-3">
                      <div>
                        <div className="text-xs text-[#7B78A8] mb-1">Posisi</div>
                        <input type="number" value={newLessonPosition} onChange={(e) => validateLessonPosition(parseInt(e.target.value) || 1)} min="1" required
                          className={`w-16 px-3 py-2 border-2 rounded-lg text-center font-semibold ${lessonPositionValid === false ? 'border-red-400 text-red-600' : 'border-[#E5E3FF] text-[#5C4FE5]'} bg-white focus:ring-2 focus:ring-[#5C4FE5]`}/>
                      </div>
                      <div className="flex-1">
                        <div className="text-xs text-[#7B78A8] mb-1">Nama lesson</div>
                        <input type="text" value={useExistingLesson ? (lessons.find((l: any) => l.id === useExistingLesson)?.lesson_name || '') : newLessonName}
                          onChange={(e) => { if (!useExistingLesson) setNewLessonName(e.target.value); }}
                          placeholder="Contoh: Week 13-16" readOnly={!!useExistingLesson} required={!useExistingLesson}
                          className={`w-full px-3 py-2 border-2 border-[#E5E3FF] rounded-lg bg-white text-gray-900 font-medium focus:ring-2 focus:ring-[#5C4FE5] ${useExistingLesson ? 'bg-gray-50 text-gray-600' : ''}`}/>
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
                <label className="block text-sm font-medium text-gray-900 mb-2">Chapter Title *</label>
                <input type="text" value={editChapterTitle} onChange={(e) => setEditChapterTitle(e.target.value)} required className="w-full px-3 py-2 border border-gray-400 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900" />
              </div>
            </div>
          )}

          <div className="border-t-2 border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">📦 Unit Settings</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Unit Name *</label>
                <input type="text" value={editUnitName} onChange={(e) => setEditUnitName(e.target.value)} required className="w-full px-3 py-2 border border-gray-400 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Unit Position *</label>
                <input type="number" value={editUnitPosition} onChange={(e) => setEditUnitPosition(parseInt(e.target.value))} min="0" required className="w-full px-3 py-2 border border-gray-400 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900" />
              </div>
            </div>
          </div>

          <div className="border-t-2 border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">📚 Lesson Settings</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Lesson Name *</label>
                <input type="text" value={editLessonName} onChange={(e) => setEditLessonName(e.target.value)} required className="w-full px-3 py-2 border border-gray-400 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Lesson Position *</label>
                <input type="number" value={editLessonPosition} onChange={(e) => setEditLessonPosition(parseInt(e.target.value))} min="0" required className="w-full px-3 py-2 border border-gray-400 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900" />
              </div>
            </div>
          </div>
        </>
      )}

      <div className={isEditing ? 'border-t-2 border-gray-200 pt-6' : ''}>
        {isEditing && <h3 className="text-lg font-semibold text-gray-900 mb-4">📄 Material Content</h3>}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">File Type *</label>
          <select
            value={fileType}
            onChange={(e) => setFileType(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900"
          >
            <option value="google_drive">Google Drive</option>
            <option value="canva">Canva</option>
            <option value="pdf">PDF Link</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">URL Link *</label>
          <input
            type="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setFileType(detectFileTypeFromUrl(e.target.value));
            }}
            placeholder="https://..."
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900"
          />
        </div>

        {/* Order Number hidden — default 1 */}

        <div className="flex items-center gap-2">
          <input type="checkbox" id="isPublished" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} className="w-4 h-4 text-[#5C4FE5] focus:ring-[#5C4FE5]" />
          <label htmlFor="isPublished" className="text-sm font-medium text-gray-700">Publish (siswa bisa lihat)</label>
        </div>
      </div>

      <div className="flex gap-3 pt-4 border-t-2 border-gray-200">
        <button type="button" onClick={onCancel} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Batal</button>
        <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-[#5C4FE5] text-white rounded-lg hover:bg-[#4a3ec7] disabled:opacity-50 font-semibold">
          {loading ? 'Menyimpan...' : isEditing ? 'Update' : 'Simpan'}
        </button>
      </div>
    </form>
  );
}
