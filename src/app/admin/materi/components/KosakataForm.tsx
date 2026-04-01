'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Check, AlertCircle } from 'lucide-react';

type Material = {
  id: string;
  title: string;
  content_data: any;
  order_number: number;
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
  const [juduls, setJuduls] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [lessons, setLessons] = useState<any[]>([]);

  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('');
  const [selectedJudul, setSelectedJudul] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('');
  const [selectedLesson, setSelectedLesson] = useState('');

  const [newJudulName, setNewJudulName] = useState('');
  const [newUnitName, setNewUnitName] = useState('');
  const [newLessonName, setNewLessonName] = useState('');

  const [fileType, setFileType] = useState('google_drive');
  const [url, setUrl] = useState('');
  const [orderNumber, setOrderNumber] = useState(1);
  const [isPublished, setIsPublished] = useState(false);

  // NEW: Edit mode fields
  const [editChapterId, setEditChapterId] = useState('');
  const [editChapterTitle, setEditChapterTitle] = useState('');
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
      setFileType(editData.content_data?.file_type || 'google_drive');
      setUrl(editData.content_data?.url || '');
      setOrderNumber(editData.order_number || 1);
      setIsPublished(editData.is_published || false);
      setEditMaterialTitle(editData.title || '');
      fetchEditModeData();
    }
  }, [editData]);

  const fetchEditModeData = async () => {
    if (!editData) return;
    setLoadingEditData(true);
    try {
      const { data: unitData } = await supabase.from('units').select('unit_name, position, chapter_id').eq('id', editData.unit_id).single();
      if (unitData) {
        setEditUnitName(unitData.unit_name);
        setEditUnitPosition(unitData.position || 1);
        
        // Fetch chapter data if chapter_id exists
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
      const { data: lessonData } = await supabase.from('lessons').select('lesson_name, position').eq('id', editData.lesson_id).single();
      if (lessonData) {
        setEditLessonName(lessonData.lesson_name);
        setEditLessonPosition(lessonData.position || 1);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoadingEditData(false);
    }
  };

  const fetchCourses = async () => {
    const { data } = await supabase.from('courses').select('*').eq('is_active', true);
    setCourses(data || []);
  };

  const fetchLevels = async (courseId: string) => {
    const { data } = await supabase.from('levels').select('*').eq('course_id', courseId);
    setLevels(data || []);
  };

  const fetchJuduls = async (levelId: string) => {
    const { data } = await supabase.from('juduls').select('*').eq('level_id', levelId);
    const uniqueJuduls = data?.reduce((acc: any[], curr) => {
      if (!acc.find(j => j.name === curr.name)) acc.push(curr);
      return acc;
    }, []) || [];
    setJuduls(uniqueJuduls);
  };

  const fetchUnits = async (judulId: string) => {
    const { data } = await supabase.from('units').select('*').eq('judul_id', judulId);
    setUnits(data || []);
  };

  const fetchLessons = async (unitId: string) => {
    const { data } = await supabase.from('lessons').select('*').eq('unit_id', unitId);
    setLessons(data || []);
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
        formData.append('content_data', JSON.stringify({ file_type: fileType, url }));
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
        formData.append('title', newLessonName || selectedLesson);
        formData.append('type', fileType);
        formData.append('category', 'kosakata');
        formData.append('course_id', selectedCourse);
        formData.append('level_id', selectedLevel);
        formData.append('judul_id', selectedJudul === 'NEW' ? 'NEW' : selectedJudul);
        formData.append('judul_name', newJudulName);
        formData.append('unit_id', selectedUnit === 'NEW' ? 'NEW' : selectedUnit);
        formData.append('unit_name', newUnitName);
        formData.append('lesson_id', selectedLesson === 'NEW' ? 'NEW' : selectedLesson);
        formData.append('lesson_name', newLessonName);
        formData.append('order_number', orderNumber.toString());
        formData.append('is_published', isPublished.toString());
        formData.append('content_data', JSON.stringify({ file_type: fileType, url }));

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
    return <div className="p-8 text-center"><div className="animate-spin w-8 h-8 border-4 border-[#5C4FE5] border-t-transparent rounded-full mx-auto"></div><p className="text-gray-600 mt-4">Memuat data...</p></div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {!isEditing && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Mata Pelajaran *</label>
            <select value={selectedCourse} onChange={(e) => { setSelectedCourse(e.target.value); fetchLevels(e.target.value); }} required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5]">
              <option value="">Pilih Mata Pelajaran</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Level *</label>
            <select value={selectedLevel} onChange={(e) => { setSelectedLevel(e.target.value); fetchJuduls(e.target.value); }} required disabled={!selectedCourse} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] disabled:bg-gray-100">
              <option value="">Pilih Level</option>
              {levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Judul *</label>
            <select value={selectedJudul} onChange={(e) => { setSelectedJudul(e.target.value); if (e.target.value !== 'NEW') fetchUnits(e.target.value); }} required disabled={!selectedLevel} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] disabled:bg-gray-100">
              <option value="">Pilih Judul</option>
              <option value="NEW">+ Buat Judul Baru</option>
              {juduls.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
            </select>
            {selectedJudul === 'NEW' && <input type="text" value={newJudulName} onChange={(e) => setNewJudulName(e.target.value)} placeholder="Nama Judul Baru" required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] mt-2" />}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Unit *</label>
            <select value={selectedUnit} onChange={(e) => { setSelectedUnit(e.target.value); if (e.target.value !== 'NEW') fetchLessons(e.target.value); }} required disabled={!selectedJudul} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] disabled:bg-gray-100">
              <option value="">Pilih Unit</option>
              <option value="NEW">+ Buat Unit Baru</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.unit_name}</option>)}
            </select>
            {selectedUnit === 'NEW' && <input type="text" value={newUnitName} onChange={(e) => setNewUnitName(e.target.value)} placeholder="Nama Unit Baru" required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] mt-2" />}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Lesson *</label>
            <select value={selectedLesson} onChange={(e) => setSelectedLesson(e.target.value)} required disabled={!selectedUnit} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] disabled:bg-gray-100">
              <option value="">Pilih Lesson</option>
              <option value="NEW">+ Buat Lesson Baru</option>
              {lessons.map((l) => <option key={l.id} value={l.id}>{l.lesson_name}</option>)}
            </select>
            {selectedLesson === 'NEW' && <input type="text" value={newLessonName} onChange={(e) => setNewLessonName(e.target.value)} placeholder="Nama Lesson Baru" required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] mt-2" />}
          </div>
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
                <input
                  type="text"
                  value={editChapterTitle}
                  onChange={(e) => setEditChapterTitle(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-400 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900"
                />
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
          <select value={fileType} onChange={(e) => setFileType(e.target.value)} required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5]">
            <option value="google_drive">Google Drive</option>
            <option value="canva">Canva</option>
            <option value="pdf">PDF Link</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">URL Link *</label>
          <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5]" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Order Number *</label>
          <input type="number" value={orderNumber} onChange={(e) => setOrderNumber(parseInt(e.target.value))} min="1" required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5]" />
        </div>

        <div className="flex items-center gap-2">
          <input type="checkbox" id="isPublished" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} className="w-4 h-4 text-[#5C4FE5] focus:ring-[#5C4FE5]" />
          <label htmlFor="isPublished" className="text-sm font-medium text-gray-700">Publish (siswa bisa lihat)</label>
        </div>
      </div>

      <div className="flex gap-3 pt-4 border-t-2 border-gray-200">
        <button type="button" onClick={onCancel} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Batal</button>
        <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-[#5C4FE5] text-white rounded-lg hover:bg-[#4a3ec7] disabled:opacity-50">{loading ? 'Menyimpan...' : isEditing ? 'Update' : 'Simpan'}</button>
      </div>
    </form>
  );
}
