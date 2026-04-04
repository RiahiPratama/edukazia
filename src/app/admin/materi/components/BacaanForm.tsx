'use client';

import { useState, useEffect } from 'react';
import { Upload, FileCode, X, Info, Check, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

// ✅ Type diperbarui — sesuai schema DB terbaru
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
  const [orderNumber, setOrderNumber] = useState(1);
  const [isPublished, setIsPublished] = useState(false);

  // NEW: Edit mode - Unit & Lesson fields
  const [editUnitName, setEditUnitName] = useState('');
  const [editUnitPosition, setEditUnitPosition] = useState(1);
  const [editLessonName, setEditLessonName] = useState('');
  const [editLessonPosition, setEditLessonPosition] = useState(1);
  const [editMaterialTitle, setEditMaterialTitle] = useState('');

  const [loading, setLoading] = useState(false);
  const [loadingEditData, setLoadingEditData] = useState(false);

  const supabase = createClient();

  const isEditing = !!editData;

  useEffect(() => {
    fetchCourses();
  }, []);

  useEffect(() => {
    if (editData) {
      setDescription(''); // description tidak lagi tersimpan di content_data
      setOrderNumber(editData.position || 1);
      setIsPublished(editData.is_published || false);
      setEditMaterialTitle(editData.title || '');
      fetchEditModeData();
    }
  }, [editData]);

  // NEW: Fetch unit & lesson data for edit mode
  const fetchEditModeData = async () => {
    if (!editData) return;

    setLoadingEditData(true);
    try {
      const { data: unitData } = await supabase
        .from('units')
        .select('unit_name, position')
        .eq('id', editData.unit_id)
        .single();

      if (unitData) {
        setEditUnitName(unitData.unit_name);
        setEditUnitPosition(unitData.position || 1);
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

  useEffect(() => {
    if (selectedLevels.length > 0 && !isEditing) {
      fetchChaptersForSelectedLevels();
    } else if (!isEditing) {
      setChapters([]);
      setSelectedChapter('');
    }
  }, [selectedLevels]);

  const fetchCourses = async () => {
    const { data } = await supabase.from('courses').select('*').eq('is_active', true);
    setCourses(data || []);
  };

  const fetchLevels = async (courseId: string) => {
    const { data } = await supabase.from('levels').select('*').eq('course_id', courseId);
    setLevels(data || []);
  };

  const fetchChaptersForSelectedLevels = async () => {
    if (selectedLevels.length === 0) return;
    // Fetch chapters untuk semua level yang dipilih
    const { data } = await supabase
      .from('chapters')
      .select('*')
      .in('level_id', selectedLevels)
      .order('order_number');
    setChapters(data || []);
  };

  const fetchUnits = async (chapterId: string) => {
    const { data } = await supabase
      .from('units')
      .select('*')
      .eq('chapter_id', chapterId) // ✅ pakai chapter_id bukan judul_id
      .order('position');
    setUnits(data || []);
  };

  const fetchLessons = async (unitId: string) => {
    const { data } = await supabase.from('lessons').select('*').eq('unit_id', unitId);
    setLessons(data || []);
  };

  const toggleLevel = (levelId: string) => {
    setSelectedLevels(prev => prev.includes(levelId) ? prev.filter(id => id !== levelId) : [...prev, levelId]);
  };

  const selectAllLevels = () => setSelectedLevels(levels.map(l => l.id));
  const clearAllLevels = () => setSelectedLevels([]);

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
      } else {
        if (selectedLevels.length === 0) {
          alert('Pilih minimal 1 level!');
          setLoading(false);
          return;
        }

        let successCount = 0;
        let failedLevels: string[] = [];

        for (const levelId of selectedLevels) {
          try {
            const formData = new FormData();
            // Use file name as title (remove extension)
            const materialTitle = jsxFile ? jsxFile.name.replace(/\.(jsx|tsx)$/, '') : (newLessonName || selectedLesson);
            formData.append('title', materialTitle);
            formData.append('type', 'bacaan');
            formData.append('category', 'bacaan');
            formData.append('course_id', selectedCourse);
            formData.append('level_id', levelId);
            // Send chapter info (judul = chapter)
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
            formData.append('content_data', JSON.stringify({ description }));
            if (jsxFile) formData.append('jsx_file', jsxFile);

            const response = await fetch('/api/admin/materials', { method: 'POST', body: formData });
            const result = await response.json();

            if (!response.ok) {
              const levelName = levels.find(l => l.id === levelId)?.name || levelId;
              failedLevels.push(levelName);
            } else {
              successCount++;
            }
          } catch (error) {
            const levelName = levels.find(l => l.id === levelId)?.name || levelId;
            failedLevels.push(levelName);
          }
        }

        if (successCount === selectedLevels.length) {
          alert(`✅ Material berhasil dibuat untuk ${successCount} level!`);
          onSave(); // Redirect back to dashboard
        } else if (successCount > 0) {
          alert(`⚠️ Material dibuat untuk ${successCount} level.\nGagal: ${failedLevels.join(', ')}`);
          onSave(); // Redirect even with partial success
        } else {
          alert(`❌ Gagal untuk semua level.\nLevel: ${failedLevels.join(', ')}`);
        }
      }
    } catch (error) {
      alert(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  if (loadingEditData) {
    return <div className="p-8 text-center"><div className="animate-spin w-8 h-8 border-4 border-[#5C4FE5] border-t-transparent rounded-full mx-auto"></div><p className="text-gray-600 mt-4">Memuat data...</p></div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {!isEditing && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Mata Pelajaran *</label>
            <select value={selectedCourse} onChange={(e) => { setSelectedCourse(e.target.value); fetchLevels(e.target.value); }} required className="w-full px-3 py-2 border border-gray-400 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900">
              <option value="">Pilih Mata Pelajaran</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Level * (Pilih 1 atau lebih)</label>
            {!selectedCourse ? (
              <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-500">Pilih Mata Pelajaran dulu</div>
            ) : levels.length === 0 ? (
              <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-500">Tidak ada level tersedia</div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-2 mb-2">
                  <button type="button" onClick={selectAllLevels} className="px-3 py-1 text-xs bg-[#5C4FE5] text-white rounded hover:bg-[#4a3ec7]">Pilih Semua</button>
                  <button type="button" onClick={clearAllLevels} className="px-3 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300">Clear</button>
                </div>
                {levels.map((level) => (
                  <label key={level.id} className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${selectedLevels.includes(level.id) ? 'bg-[#5C4FE5] text-white' : 'bg-gray-50 text-gray-900 hover:bg-gray-100 border border-gray-300'}`}>
                    <input type="checkbox" checked={selectedLevels.includes(level.id)} onChange={() => toggleLevel(level.id)} className="hidden" />
                    <div className={`w-5 h-5 border-2 rounded flex items-center justify-center flex-shrink-0 ${selectedLevels.includes(level.id) ? 'border-white bg-white' : 'border-gray-400 bg-white'}`}>
                      {selectedLevels.includes(level.id) && <Check size={14} className="text-[#5C4FE5]" />}
                    </div>
                    <span className="text-sm font-medium">{level.name}</span>
                  </label>
                ))}
              </div>
            )}
            {selectedLevels.length > 0 && <p className="mt-2 text-xs text-gray-700 font-medium">Material akan dibuat untuk {selectedLevels.length} level</p>}
          </div>

          {selectedLevels.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Chapter *</label>
              <select value={selectedChapter} onChange={(e) => { setSelectedChapter(e.target.value); if (e.target.value !== 'NEW') fetchUnits(e.target.value); }} required className="w-full px-3 py-2 border border-gray-400 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900">
                <option value="">Pilih Chapter</option>
                <option value="NEW">+ Buat Chapter Baru</option>
                {chapters.map((ch) => <option key={ch.id} value={ch.id}>{ch.chapter_title}</option>)}
              </select>
              {selectedChapter === 'NEW' && <input type="text" value={newChapterTitle} onChange={(e) => setNewChapterTitle(e.target.value)} placeholder="Nama Chapter Baru" required className="w-full px-3 py-2 border border-gray-400 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] mt-2 bg-white text-gray-900" />}
            </div>
          )}

          {selectedChapter && (
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Unit *</label>
              <select value={selectedUnit} onChange={(e) => { setSelectedUnit(e.target.value); if (e.target.value !== 'NEW') fetchLessons(e.target.value); }} required className="w-full px-3 py-2 border border-gray-400 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900">
                <option value="">Pilih Unit</option>
                <option value="NEW">+ Buat Unit Baru</option>
                {units.map((u) => <option key={u.id} value={u.id}>{u.unit_name}</option>)}
              </select>
              {selectedUnit === 'NEW' && (
                <div className="mt-2 space-y-2">
                  <input type="text" value={newUnitName} onChange={(e) => setNewUnitName(e.target.value)} placeholder="Nama Unit Baru" required className="w-full px-3 py-2 border border-gray-400 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900" />
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-semibold text-gray-700 whitespace-nowrap">Urutan Unit *</label>
                    <input type="number" value={newUnitPosition} onChange={(e) => setNewUnitPosition(parseInt(e.target.value) || 1)} min="1" required className="w-24 px-3 py-2 border border-gray-400 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900" />
                    <span className="text-xs text-gray-500">Menentukan urutan tampil unit di daftar materi</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {selectedUnit && (
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Lesson *</label>
              <select value={selectedLesson} onChange={(e) => setSelectedLesson(e.target.value)} required className="w-full px-3 py-2 border border-gray-400 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900">
                <option value="">Pilih Lesson</option>
                <option value="NEW">+ Buat Lesson Baru</option>
                {lessons.map((l) => <option key={l.id} value={l.id}>{l.lesson_name}</option>)}
              </select>
              {selectedLesson === 'NEW' && (
                <div className="mt-2 space-y-2">
                  <input type="text" value={newLessonName} onChange={(e) => setNewLessonName(e.target.value)} placeholder="Nama Lesson Baru" required className="w-full px-3 py-2 border border-gray-400 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900" />
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-semibold text-gray-700 whitespace-nowrap">Urutan Lesson *</label>
                    <input
                      type="number"
                      value={newLessonPosition}
                      onChange={(e) => setNewLessonPosition(parseInt(e.target.value) || 1)}
                      min="1"
                      required
                      className="w-24 px-3 py-2 border border-gray-400 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900"
                    />
                    <span className="text-xs text-gray-500">Menentukan urutan tampil lesson di daftar materi</span>
                  </div>
                </div>
              )}
            </div>
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
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">📚 Lesson Settings</h3>
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
        {isEditing && <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">📄 Material Content</h3>}

        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full px-3 py-2 border border-gray-400 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900" />
        </div>

        {/* Upload file JSX */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            File JSX Bacaan {!isEditing && <span className="text-red-500">*</span>}
          </label>
          <div className="flex items-center gap-3">
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".jsx,.tsx,.js"
                className="hidden"
                onChange={(e) => setJsxFile(e.target.files?.[0] ?? null)}
              />
              <span className="inline-flex items-center gap-2 px-4 py-2 border-2 border-dashed border-[#5C4FE5] text-[#5C4FE5] rounded-lg hover:bg-[#F7F6FF] transition-colors font-medium text-sm">
                {jsxFile ? '🔄 Ganti File' : '📂 Pilih File JSX'}
              </span>
            </label>
            {jsxFile ? (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-sm text-gray-600 truncate">{jsxFile.name}</span>
                <button
                  type="button"
                  onClick={() => setJsxFile(null)}
                  className="text-red-500 hover:text-red-700 text-xs flex-shrink-0"
                >
                  ✕ Hapus
                </button>
              </div>
            ) : (
              <span className="text-sm text-gray-400">
                {isEditing ? 'Kosongkan jika tidak ingin ganti file' : 'Pilih file .jsx atau .tsx'}
              </span>
            )}
          </div>
        </div>

        {/* Order Number hidden — default 1 */}

        <div className="flex items-center gap-2">
          <input type="checkbox" id="isPublished" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} className="w-4 h-4 text-[#5C4FE5] focus:ring-[#5C4FE5]" />
          <label htmlFor="isPublished" className="text-sm font-medium text-gray-900">Publish (siswa bisa lihat)</label>
        </div>
      </div>

      <div className="flex gap-3 pt-4 border-t-2 border-gray-200">
        <button type="button" onClick={onCancel} className="flex-1 px-4 py-2 border border-gray-400 text-gray-900 rounded-lg hover:bg-gray-50 font-medium">Batal</button>
        <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-[#5C4FE5] text-white rounded-lg hover:bg-[#4a3ec7] disabled:opacity-50 font-medium">{loading ? 'Menyimpan...' : isEditing ? 'Update' : 'Simpan'}</button>
      </div>
    </form>
  );
}
