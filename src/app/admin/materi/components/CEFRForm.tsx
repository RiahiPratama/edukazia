'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AlertCircle, Check } from 'lucide-react';

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

type CEFRFormProps = {
  onSave: () => void;
  onSaveWithLesson: (lessonId: string, lessonName: string) => void;
  onCancel: () => void;
  editData?: Material | null;
};

export default function CEFRForm({ onSave, onSaveWithLesson, onCancel, editData }: CEFRFormProps) {
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

  const [orderNumber, setOrderNumber] = useState(1);
  const [isPublished, setIsPublished] = useState(false);

  const [editUnitName, setEditUnitName] = useState('');
  const [editUnitPosition, setEditUnitPosition] = useState(1);
  const [editLessonName, setEditLessonName] = useState('');
  const [editLessonPosition, setEditLessonPosition] = useState(1);
  const [editMaterialTitle, setEditMaterialTitle] = useState('');

  const [loading, setLoading] = useState(false);
  const [loadingEditData, setLoadingEditData] = useState(false);

  const supabase = createClient();
  const isEditing = !!editData;

  useEffect(() => { fetchCourses(); }, []);

  useEffect(() => {
    if (editData) {
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
    } catch (err) { console.error(err); }
    finally { setLoadingEditData(false); }
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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const formData = new FormData();

      if (isEditing) {
        formData.append('material_id', editData.id);
        formData.append('title', editMaterialTitle);
        formData.append('order_number', orderNumber.toString());
        formData.append('is_published', isPublished.toString());
        formData.append('content_data', JSON.stringify({}));
        formData.append('unit_id', editData.unit_id);
        formData.append('lesson_id', editData.lesson_id);
        formData.append('unit_name', editUnitName);
        formData.append('unit_position', editUnitPosition.toString());
        formData.append('lesson_name', editLessonName);
        formData.append('lesson_position', editLessonPosition.toString());

        const response = await fetch('/api/admin/materials', { method: 'PATCH', body: formData });
        const result = await response.json();
        if (!response.ok) throw new Error(`${result.error}: ${result.details || ''}`);
        onSaveWithLesson(editData.lesson_id, editLessonName);
      } else {
        if (!selectedLevel) { alert('❌ Level harus dipilih!'); setLoading(false); return; }
        if (!selectedChapter) { alert('❌ Chapter harus dipilih!'); setLoading(false); return; }
        if (!selectedUnit) { alert('❌ Unit harus dipilih!'); setLoading(false); return; }
        if (!selectedLesson) { alert('❌ Lesson harus dipilih!'); setLoading(false); return; }

        formData.append('title', newLessonName || selectedLesson);
        formData.append('category', 'cefr');
        formData.append('course_id', selectedCourse);
        formData.append('level_id', selectedLevel);
        formData.append('chapter_id', selectedChapter === 'NEW' ? 'NEW' : selectedChapter);
        formData.append('chapter_name', newChapterTitle);
        formData.append('unit_id', selectedUnit === 'NEW' ? 'NEW' : selectedUnit);
        formData.append('unit_name', newUnitName);
        formData.append('unit_position_new', newUnitPosition.toString());
        formData.append('lesson_id', selectedLesson === 'NEW' ? 'NEW' : selectedLesson);
        formData.append('lesson_name', newLessonName);
        formData.append('lesson_position_new', newLessonPosition.toString());
        formData.append('order_number', orderNumber.toString());
        formData.append('is_published', isPublished.toString());
        formData.append('content_data', JSON.stringify({}));

        const response = await fetch('/api/admin/materials', { method: 'POST', body: formData });
        const result = await response.json();
        if (!response.ok) throw new Error(`${result.error}: ${result.details || ''}`);

        const lessonId = result.material?.lesson_id || selectedLesson;
        const lessonName = selectedLesson === 'NEW' ? newLessonName : (lessons.find(l => l.id === selectedLesson)?.lesson_name || '');

        onSaveWithLesson(lessonId, lessonName);
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
      <div className="bg-purple-50 border-2 border-[#5C4FE5] rounded-xl p-4">
        <div className="flex gap-3">
          <Check className="text-[#5C4FE5] flex-shrink-0 mt-0.5" size={18} />
          <div className="text-sm text-purple-800">
            <p className="font-semibold mb-1">📝 CEFR — Block Editor</p>
            <p>Setelah klik "Simpan", kamu akan diarahkan ke <strong>Block Editor</strong> untuk menambahkan konten lesson.</p>
          </div>
        </div>
      </div>

      {!isEditing && (
        <>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Mata Pelajaran *</label>
            <select value={selectedCourse} onChange={e => { setSelectedCourse(e.target.value); fetchLevels(e.target.value); }} required
              className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900">
              <option value="">Pilih Mata Pelajaran</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Level *</label>
            <select value={selectedLevel} onChange={e => { setSelectedLevel(e.target.value); fetchChapters(e.target.value); }} required disabled={!selectedCourse}
              className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900 disabled:bg-gray-100">
              <option value="">Pilih Level</option>
              {levels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Chapter *</label>
            <select value={selectedChapter} onChange={e => { setSelectedChapter(e.target.value); if (e.target.value !== 'NEW') fetchUnits(e.target.value); }} required disabled={!selectedLevel}
              className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900 disabled:bg-gray-100">
              <option value="">Pilih Chapter</option>
              <option value="NEW">+ Buat Chapter Baru</option>
              {chapters.map(c => <option key={c.id} value={c.id}>{c.chapter_title}</option>)}
            </select>
            {selectedChapter === 'NEW' && (
              <input type="text" value={newChapterTitle} onChange={e => setNewChapterTitle(e.target.value)} placeholder="Nama Chapter Baru" required
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] mt-2 bg-white text-gray-900" />
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Unit *</label>
            <select value={selectedUnit} onChange={e => { setSelectedUnit(e.target.value); if (e.target.value !== 'NEW') fetchLessons(e.target.value); }} required disabled={!selectedChapter}
              className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900 disabled:bg-gray-100">
              <option value="">Pilih Unit</option>
              <option value="NEW">+ Buat Unit Baru</option>
              {units.map(u => <option key={u.id} value={u.id}>{u.unit_name}</option>)}
            </select>
            {selectedUnit === 'NEW' && (
              <div className="mt-2 space-y-2">
                <input type="text" value={newUnitName} onChange={e => setNewUnitName(e.target.value)} placeholder="Nama Unit Baru" required
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900" />
                <div className="flex items-center gap-3">
                  <label className="text-sm font-semibold text-gray-700 whitespace-nowrap">Urutan Unit *</label>
                  <input type="number" value={newUnitPosition} onChange={e => setNewUnitPosition(parseInt(e.target.value) || 1)} min="1" required
                    className="w-24 px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900" />
                  <span className="text-xs text-gray-500">Urutan tampil unit</span>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Lesson *</label>
            <select value={selectedLesson} onChange={e => setSelectedLesson(e.target.value)} required disabled={!selectedUnit}
              className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900 disabled:bg-gray-100">
              <option value="">Pilih Lesson</option>
              <option value="NEW">+ Buat Lesson Baru</option>
              {lessons.map(l => <option key={l.id} value={l.id}>{l.lesson_name}</option>)}
            </select>
            {selectedLesson === 'NEW' && (
              <div className="mt-2 space-y-2">
                <input type="text" value={newLessonName} onChange={e => setNewLessonName(e.target.value)} placeholder="Nama Lesson Baru" required
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900" />
                <div className="flex items-center gap-3">
                  <label className="text-sm font-semibold text-gray-700 whitespace-nowrap">Urutan Lesson *</label>
                  <input type="number" value={newLessonPosition} onChange={e => setNewLessonPosition(parseInt(e.target.value) || 1)} min="1" required
                    className="w-24 px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900" />
                  <span className="text-xs text-gray-500">Urutan tampil lesson</span>
                </div>
              </div>
            )}
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
                <p>Mengubah nama Unit/Lesson akan mempengaruhi <strong>SEMUA materials</strong> dalam Unit/Lesson ini.</p>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Material Title *</label>
            <input type="text" value={editMaterialTitle} onChange={e => setEditMaterialTitle(e.target.value)} required
              className="w-full px-3 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Unit Name *</label>
              <input type="text" value={editUnitName} onChange={e => setEditUnitName(e.target.value)} required
                className="w-full px-3 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Unit Position *</label>
              <input type="number" value={editUnitPosition} onChange={e => setEditUnitPosition(parseInt(e.target.value))} min="0" required
                className="w-full px-3 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Lesson Name *</label>
              <input type="text" value={editLessonName} onChange={e => setEditLessonName(e.target.value)} required
                className="w-full px-3 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Lesson Position *</label>
              <input type="number" value={editLessonPosition} onChange={e => setEditLessonPosition(parseInt(e.target.value))} min="0" required
                className="w-full px-3 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900" />
            </div>
          </div>
        </>
      )}

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Order Number *</label>
        <input type="number" value={orderNumber} onChange={e => setOrderNumber(parseInt(e.target.value))} min="1" required
          className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900" />
      </div>

      <div className="flex items-center gap-2">
        <input type="checkbox" id="isPublished" checked={isPublished} onChange={e => setIsPublished(e.target.checked)}
          className="w-4 h-4 text-[#5C4FE5] focus:ring-[#5C4FE5]" />
        <label htmlFor="isPublished" className="text-sm font-semibold text-gray-700">Publish (siswa bisa lihat)</label>
      </div>

      <div className="flex gap-3 pt-4 border-t-2 border-gray-200">
        <button type="button" onClick={onCancel}
          className="flex-1 px-4 py-2.5 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold">
          Batal
        </button>
        <button type="submit" disabled={loading}
          className="flex-1 px-4 py-2.5 bg-[#5C4FE5] text-white rounded-lg hover:bg-[#4a3ec7] disabled:opacity-50 font-semibold shadow-md">
          {loading ? 'Menyimpan...' : isEditing ? 'Update & Edit Konten →' : 'Simpan & Edit Konten →'}
        </button>
      </div>
    </form>
  );
}
