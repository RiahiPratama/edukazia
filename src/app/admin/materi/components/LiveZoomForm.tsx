'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AlertCircle } from 'lucide-react';

type Material = {
  id: string;
  title: string;
  content_data: any;
  order_number: number;
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
  const [newLessonName, setNewLessonName] = useState('');

  const [platform, setPlatform] = useState('canva');
  const [url, setUrl] = useState('');
  const [orderNumber, setOrderNumber] = useState(1);
  const [isPublished, setIsPublished] = useState(false);

  // Edit mode states
  const [editLevelName, setEditLevelName] = useState('');
  const [editChapterTitle, setEditChapterTitle] = useState('');
  const [editChapterId, setEditChapterId] = useState('');
  const [editUnitName, setEditUnitName] = useState('');
  const [editUnitPosition, setEditUnitPosition] = useState(0);
  const [editLessonName, setEditLessonName] = useState('');
  const [editLessonPosition, setEditLessonPosition] = useState(0);

  const [loading, setLoading] = useState(false);
  const [loadingEditData, setLoadingEditData] = useState(false);

  const supabase = createClient();
  const isEditing = !!editData;

  useEffect(() => {
    fetchCourses();
  }, []);

  useEffect(() => {
    if (editData) {
      setPlatform(editData.content_data?.platform || 'canva');
      setUrl(editData.content_data?.url || '');
      setOrderNumber(editData.order_number || 1);
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
        setEditUnitPosition(unitData.position || 0);
        
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
        setEditLessonPosition(lessonData.position || 0);
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
      // STRICT: Only fetch units FROM THIS CHAPTER
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
    // STRICT: Only units from this chapter
    const { data } = await supabase.from('units').select('*').eq('chapter_id', chapterId).order('position');
    setUnits(data || []);
  };

  const fetchLessons = async (unitId: string) => {
    const { data } = await supabase.from('lessons').select('*').eq('unit_id', unitId).order('position');
    setLessons(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isEditing) {
        // EDIT MODE
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
        formData.append('content_data', JSON.stringify({ platform, url }));

        const response = await fetch('/api/admin/materials', { method: 'PATCH', body: formData });
        const result = await response.json();
        
        if (!response.ok) throw new Error(result.error || 'Failed to update');
        
        alert('✅ Material berhasil diupdate!');
        onSave();
      } else {
        // CREATE MODE - STRICT VALIDATION
        if (!selectedLevel) {
          alert('❌ Level harus dipilih!');
          setLoading(false);
          return;
        }

        if (!selectedChapter || selectedChapter === 'NEW') {
          if (selectedChapter !== 'NEW') {
            alert('❌ Chapter harus dipilih!');
            setLoading(false);
            return;
          }
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
            ? (existingChapters[0].order_number + 1)
            : 1;

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

          if (chapterError) {
            alert(`❌ Gagal membuat chapter: ${chapterError.message}`);
            setLoading(false);
            return;
          }
          actualChapterId = newChapter.id;
        }

        // STRICT VALIDATION: Chapter must be selected
        if (!actualChapterId || actualChapterId === 'NEW') {
          alert('❌ Chapter harus dipilih atau dibuat!');
          setLoading(false);
          return;
        }

        // Create Unit if NEW
        let actualUnitId = selectedUnit;
        if (selectedUnit === 'NEW' && newUnitName) {
          const { data: newUnit, error: unitError } = await supabase
            .from('units')
            .insert({
              level_id: selectedLevel,
              chapter_id: actualChapterId, // STRICT: Must have chapter_id
              unit_name: newUnitName,
              unit_number: 0,
              position: 0,
            })
            .select()
            .single();

          if (unitError) {
            alert(`❌ Gagal membuat unit: ${unitError.message}`);
            setLoading(false);
            return;
          }
          actualUnitId = newUnit.id;
        }

        // Create Lesson if NEW
        let actualLessonId = selectedLesson;
        if (selectedLesson === 'NEW' && newLessonName && actualUnitId) {
          const { data: existingLessons } = await supabase
            .from('lessons')
            .select('position')
            .eq('unit_id', actualUnitId)
            .order('position', { ascending: false })
            .limit(1);

          const nextPosition = existingLessons && existingLessons.length > 0
            ? (existingLessons[0].position + 1)
            : 0;

          const { data: newLesson, error: lessonError } = await supabase
            .from('lessons')
            .insert({
              unit_id: actualUnitId,
              lesson_name: newLessonName,
              position: nextPosition,
            })
            .select()
            .single();

          if (lessonError) {
            alert(`❌ Gagal membuat lesson: ${lessonError.message}`);
            setLoading(false);
            return;
          }
          actualLessonId = newLesson.id;
        }

        // Create Material
        const formData = new FormData();
        formData.append('title', newLessonName || selectedLesson);
        formData.append('type', 'live_zoom');
        formData.append('category', 'live_zoom');
        formData.append('course_id', selectedCourse);
        formData.append('level_id', selectedLevel);
        formData.append('unit_id', actualUnitId);
        formData.append('lesson_id', actualLessonId);
        formData.append('order_number', orderNumber.toString());
        formData.append('is_published', isPublished.toString());
        formData.append('content_data', JSON.stringify({ platform, url }));

        const response = await fetch('/api/admin/materials', { method: 'POST', body: formData });
        const result = await response.json();

        if (!response.ok) throw new Error(result.error || 'Failed to create');

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
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Mata Pelajaran *</label>
            <select
              value={selectedCourse}
              onChange={(e) => {
                setSelectedCourse(e.target.value);
                fetchLevels(e.target.value);
              }}
              required
              className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] focus:border-[#5C4FE5] bg-white text-gray-900 font-medium"
            >
              <option value="">Pilih Mata Pelajaran</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Level Kurikulum *</label>
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              required
              className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] focus:border-[#5C4FE5] bg-white text-gray-900 font-medium"
            >
              <option value="">Pilih Level</option>
              {levels.map((level) => (
                <option key={level.id} value={level.id}>{level.name}</option>
              ))}
            </select>
          </div>

          {selectedLevel && (
            <>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Chapter * (WAJIB)</label>
                <select
                  value={selectedChapter}
                  onChange={(e) => setSelectedChapter(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] focus:border-[#5C4FE5] bg-white text-gray-900 font-medium"
                >
                  <option value="">Pilih Chapter</option>
                  <option value="NEW">+ Buat Chapter Baru</option>
                  {chapters.map((ch) => (
                    <option key={ch.id} value={ch.id}>{ch.chapter_title}</option>
                  ))}
                </select>
                {selectedChapter === 'NEW' && (
                  <input
                    type="text"
                    value={newChapterTitle}
                    onChange={(e) => setNewChapterTitle(e.target.value)}
                    placeholder="Nama Chapter Baru (contoh: Mover)"
                    required
                    className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] mt-2 bg-white text-gray-900 font-medium"
                  />
                )}
                <p className="text-xs text-gray-600 mt-2">
                  🔒 Unit hanya akan menampilkan yang sesuai dengan Chapter yang dipilih
                </p>
              </div>

              {selectedChapter && (
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Unit *</label>
                  <select
                    value={selectedUnit}
                    onChange={(e) => setSelectedUnit(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] focus:border-[#5C4FE5] bg-white text-gray-900 font-medium"
                  >
                    <option value="">Pilih Unit</option>
                    <option value="NEW">+ Buat Unit Baru</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>{u.unit_name}</option>
                    ))}
                  </select>
                  {selectedUnit === 'NEW' && (
                    <input
                      type="text"
                      value={newUnitName}
                      onChange={(e) => setNewUnitName(e.target.value)}
                      placeholder="Nama Unit Baru (contoh: 01 Clothes I like)"
                      required
                      className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] mt-2 bg-white text-gray-900 font-medium"
                    />
                  )}
                </div>
              )}

              {selectedUnit && (
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Lesson (Nama Materi) *</label>
                  <select
                    value={selectedLesson}
                    onChange={(e) => setSelectedLesson(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] focus:border-[#5C4FE5] bg-white text-gray-900 font-medium"
                  >
                    <option value="">Pilih Lesson</option>
                    <option value="NEW">+ Buat Lesson Baru</option>
                    {lessons.map((l) => (
                      <option key={l.id} value={l.id}>{l.lesson_name}</option>
                    ))}
                  </select>
                  {selectedLesson === 'NEW' && (
                    <input
                      type="text"
                      value={newLessonName}
                      onChange={(e) => setNewLessonName(e.target.value)}
                      placeholder="Nama Lesson Baru (contoh: 01_The Magic Crystal)"
                      required
                      className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] mt-2 bg-white text-gray-900 font-medium"
                    />
                  )}
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
                <input
                  type="text"
                  value={editChapterTitle}
                  onChange={(e) => setEditChapterTitle(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900 font-medium"
                />
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
                <input
                  type="text"
                  value={editUnitName}
                  onChange={(e) => setEditUnitName(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900 font-medium"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Unit Position *</label>
                <input
                  type="number"
                  value={editUnitPosition}
                  onChange={(e) => setEditUnitPosition(parseInt(e.target.value))}
                  min="0"
                  required
                  className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900 font-medium"
                />
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
                <input
                  type="text"
                  value={editLessonName}
                  onChange={(e) => setEditLessonName(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900 font-medium"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Lesson Position *</label>
                <input
                  type="number"
                  value={editLessonPosition}
                  onChange={(e) => setEditLessonPosition(parseInt(e.target.value))}
                  min="0"
                  required
                  className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900 font-medium"
                />
              </div>
            </div>
          </div>
        </>
      )}

      <div className={isEditing ? 'border-t-2 border-gray-200 pt-6' : ''}>
        {isEditing && <h3 className="text-lg font-semibold text-gray-900 mb-4">📄 Material Content</h3>}

        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">Platform *</label>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            required
            className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900 font-medium"
          >
            <option value="canva">Canva</option>
            <option value="zoom">Zoom</option>
            <option value="google_meet">Google Meet</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">URL Link *</label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            required
            className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900 font-medium"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">Order Number *</label>
          <input
            type="number"
            value={orderNumber}
            onChange={(e) => setOrderNumber(parseInt(e.target.value))}
            min="1"
            required
            className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900 font-medium"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isPublished"
            checked={isPublished}
            onChange={(e) => setIsPublished(e.target.checked)}
            className="w-4 h-4 text-[#5C4FE5] focus:ring-[#5C4FE5] border-gray-400 rounded"
          />
          <label htmlFor="isPublished" className="text-sm font-semibold text-gray-900">
            Publish (siswa bisa lihat)
          </label>
        </div>
      </div>

      <div className="flex gap-3 pt-4 border-t-2 border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2.5 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold transition-colors"
        >
          Batal
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 px-4 py-2.5 bg-[#5C4FE5] text-white rounded-lg hover:bg-[#4a3ec7] disabled:opacity-50 font-semibold shadow-md transition-all"
        >
          {loading ? 'Menyimpan...' : isEditing ? 'Update' : 'Simpan'}
        </button>
      </div>
    </form>
  );
}
