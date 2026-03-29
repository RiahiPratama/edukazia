'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Check } from 'lucide-react';

type Material = {
  id: string;
  title: string;
  content_data: any;
  order_number: number;
  is_published: boolean;
};

type LiveZoomFormProps = {
  onSave: () => void;
  onCancel: () => void;
  editData?: Material | null;
};

export default function LiveZoomFormMultiLevel({ onSave, onCancel, editData }: LiveZoomFormProps) {
  const [courses, setCourses] = useState<any[]>([]);
  const [levels, setLevels] = useState<any[]>([]);
  const [juduls, setJuduls] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [lessons, setLessons] = useState<any[]>([]);

  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [selectedJudul, setSelectedJudul] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('');
  const [selectedLesson, setSelectedLesson] = useState('');

  const [newJudulName, setNewJudulName] = useState('');
  const [newUnitName, setNewUnitName] = useState('');
  const [newLessonName, setNewLessonName] = useState('');

  const [platform, setPlatform] = useState('canva');
  const [url, setUrl] = useState('');
  const [orderNumber, setOrderNumber] = useState(1);
  const [isPublished, setIsPublished] = useState(false);

  const [loading, setLoading] = useState(false);

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
    }
  }, [editData]);

  // FIX: Auto-fetch juduls when levels are selected
  useEffect(() => {
    if (selectedLevels.length > 0) {
      fetchJudulsForSelectedLevels();
    } else {
      setJuduls([]);
      setSelectedJudul('');
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

  // FIX: Fetch juduls for ALL selected levels
  const fetchJudulsForSelectedLevels = async () => {
    if (selectedLevels.length === 0) return;

    const { data } = await supabase
      .from('juduls')
      .select('*')
      .in('level_id', selectedLevels);
    
    // Deduplicate by name
    const uniqueJuduls = data?.reduce((acc: any[], curr) => {
      if (!acc.find(j => j.name === curr.name)) {
        acc.push(curr);
      }
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

  const toggleLevel = (levelId: string) => {
    setSelectedLevels(prev => {
      if (prev.includes(levelId)) {
        return prev.filter(id => id !== levelId);
      } else {
        return [...prev, levelId];
      }
    });
  };

  const selectAllLevels = () => {
    setSelectedLevels(levels.map(l => l.id));
  };

  const clearAllLevels = () => {
    setSelectedLevels([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isEditing) {
        // EDIT mode - single update
        const formData = new FormData();
        formData.append('material_id', editData.id);
        formData.append('title', newLessonName || selectedLesson);
        formData.append('order_number', orderNumber.toString());
        formData.append('is_published', isPublished.toString());
        formData.append('content_data', JSON.stringify({ platform, url }));

        const response = await fetch('/api/admin/materials', {
          method: 'PATCH',
          body: formData,
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to update material');
        }

        alert('✅ Material berhasil diupdate!');
        onSave();
      } else {
        // CREATE mode - loop through selected levels
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
            formData.append('title', newLessonName || selectedLesson);
            formData.append('type', 'live_zoom');
            formData.append('category', 'live_zoom');
            formData.append('course_id', selectedCourse);
            formData.append('level_id', levelId);
            formData.append('judul_id', selectedJudul === 'NEW' ? 'NEW' : selectedJudul);
            formData.append('judul_name', newJudulName);
            formData.append('unit_id', selectedUnit === 'NEW' ? 'NEW' : selectedUnit);
            formData.append('unit_name', newUnitName);
            formData.append('lesson_id', selectedLesson === 'NEW' ? 'NEW' : selectedLesson);
            formData.append('lesson_name', newLessonName);
            formData.append('order_number', orderNumber.toString());
            formData.append('is_published', isPublished.toString());
            formData.append('content_data', JSON.stringify({ platform, url }));

            const response = await fetch('/api/admin/materials', {
              method: 'POST',
              body: formData,
            });

            const result = await response.json();

            if (!response.ok) {
              const levelName = levels.find(l => l.id === levelId)?.name || levelId;
              failedLevels.push(levelName);
              console.error(`Failed for level ${levelName}:`, result);
            } else {
              successCount++;
            }
          } catch (error) {
            const levelName = levels.find(l => l.id === levelId)?.name || levelId;
            failedLevels.push(levelName);
            console.error(`Error for level ${levelName}:`, error);
          }
        }

        if (successCount === selectedLevels.length) {
          alert(`✅ Material berhasil dibuat untuk ${successCount} level!`);
          // FIX: Don't call onSave() to keep checkbox state
          // Instead, just reset non-level fields
          setNewJudulName('');
          setNewUnitName('');
          setNewLessonName('');
          setPlatform('canva');
          setUrl('');
          setOrderNumber(1);
          // Keep selectedLevels and isPublished as is!
        } else if (successCount > 0) {
          alert(`⚠️ Material dibuat untuk ${successCount} level.\nGagal untuk: ${failedLevels.join(', ')}`);
          // Partial success - reset non-level fields
          setNewJudulName('');
          setNewUnitName('');
          setNewLessonName('');
          setPlatform('canva');
          setUrl('');
          setOrderNumber(1);
        } else {
          alert(`❌ Gagal membuat material untuk semua level.\nLevel: ${failedLevels.join(', ')}`);
        }
      }
    } catch (error) {
      console.error('Error:', error);
      alert(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {!isEditing && (
        <>
          {/* Course Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Mata Pelajaran *
            </label>
            <select
              value={selectedCourse}
              onChange={(e) => {
                setSelectedCourse(e.target.value);
                fetchLevels(e.target.value);
                setSelectedLevels([]);
              }}
              required
              className="w-full px-3 py-2 border border-gray-400 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900"
            >
              <option value="">Pilih Mata Pelajaran</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Multi-Level Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Level * (Pilih 1 atau lebih)
            </label>
            
            {levels.length > 0 && (
              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={selectAllLevels}
                  className="px-3 py-1 text-xs bg-gray-100 text-gray-900 rounded hover:bg-gray-200 font-medium"
                >
                  Pilih Semua
                </button>
                <button
                  type="button"
                  onClick={clearAllLevels}
                  className="px-3 py-1 text-xs bg-gray-100 text-gray-900 rounded hover:bg-gray-200 font-medium"
                >
                  Hapus Semua
                </button>
                <span className="text-xs text-gray-700 self-center ml-auto font-medium">
                  {selectedLevels.length} level dipilih
                </span>
              </div>
            )}

            {!selectedCourse ? (
              <div className="p-4 bg-gray-100 border border-gray-400 rounded-lg text-sm text-gray-700 font-medium">
                Pilih Mata Pelajaran dulu
              </div>
            ) : levels.length === 0 ? (
              <div className="p-4 bg-gray-100 border border-gray-400 rounded-lg text-sm text-gray-700 font-medium">
                Tidak ada level tersedia
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 p-4 border border-gray-400 rounded-lg max-h-60 overflow-y-auto bg-white">
                {levels.map((level) => (
                  <label
                    key={level.id}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedLevels.includes(level.id)
                        ? 'bg-[#5C4FE5] text-white'
                        : 'bg-gray-50 text-gray-900 hover:bg-gray-100 border border-gray-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedLevels.includes(level.id)}
                      onChange={() => toggleLevel(level.id)}
                      className="hidden"
                    />
                    <div className={`w-5 h-5 border-2 rounded flex items-center justify-center flex-shrink-0 ${
                      selectedLevels.includes(level.id)
                        ? 'border-white bg-white'
                        : 'border-gray-400 bg-white'
                    }`}>
                      {selectedLevels.includes(level.id) && (
                        <Check size={14} className="text-[#5C4FE5]" />
                      )}
                    </div>
                    <span className="text-sm font-medium">{level.name}</span>
                  </label>
                ))}
              </div>
            )}

            {selectedLevels.length > 0 && (
              <p className="mt-2 text-xs text-gray-700 font-medium">
                Material akan dibuat untuk {selectedLevels.length} level yang dipilih
              </p>
            )}
          </div>

          {/* Judul */}
          {selectedLevels.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Judul *
              </label>
              <select
                value={selectedJudul}
                onChange={(e) => {
                  setSelectedJudul(e.target.value);
                  if (e.target.value !== 'NEW') {
                    fetchUnits(e.target.value);
                  }
                }}
                required
                className="w-full px-3 py-2 border border-gray-400 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900"
              >
                <option value="">Pilih Judul</option>
                <option value="NEW">+ Buat Judul Baru</option>
                {juduls.map((j) => (
                  <option key={j.id} value={j.id}>{j.name}</option>
                ))}
              </select>
              {selectedJudul === 'NEW' && (
                <input
                  type="text"
                  value={newJudulName}
                  onChange={(e) => setNewJudulName(e.target.value)}
                  placeholder="Nama Judul Baru"
                  required
                  className="w-full px-3 py-2 border border-gray-400 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] mt-2 bg-white text-gray-900 placeholder-gray-500"
                />
              )}
            </div>
          )}

          {/* Unit */}
          {selectedJudul && (
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Unit *
              </label>
              <select
                value={selectedUnit}
                onChange={(e) => {
                  setSelectedUnit(e.target.value);
                  if (e.target.value !== 'NEW') {
                    fetchLessons(e.target.value);
                  }
                }}
                required
                className="w-full px-3 py-2 border border-gray-400 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900"
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
                  placeholder="Nama Unit Baru"
                  required
                  className="w-full px-3 py-2 border border-gray-400 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] mt-2 bg-white text-gray-900 placeholder-gray-500"
                />
              )}
            </div>
          )}

          {/* Lesson */}
          {selectedUnit && (
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Lesson (Nama Materi) *
              </label>
              <select
                value={selectedLesson}
                onChange={(e) => setSelectedLesson(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-400 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900"
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
                  placeholder="Nama Lesson Baru (akan menjadi judul materi)"
                  required
                  className="w-full px-3 py-2 border border-gray-400 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] mt-2 bg-white text-gray-900 placeholder-gray-500"
                />
              )}
            </div>
          )}
        </>
      )}

      {/* Material Content Fields */}
      {isEditing && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-blue-800">
            <strong>Editing:</strong> {editData.title}
          </p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-900 mb-2">
          Platform *
        </label>
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          required
          className="w-full px-3 py-2 border border-gray-400 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900"
        >
          <option value="canva">Canva</option>
          <option value="zoom">Zoom</option>
          <option value="google_meet">Google Meet</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-900 mb-2">
          URL Link *
        </label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://..."
          required
          className="w-full px-3 py-2 border border-gray-400 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900 placeholder-gray-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-900 mb-2">
          Order Number *
        </label>
        <input
          type="number"
          value={orderNumber}
          onChange={(e) => setOrderNumber(parseInt(e.target.value))}
          min="1"
          required
          className="w-full px-3 py-2 border border-gray-400 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900"
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isPublished"
          checked={isPublished}
          onChange={(e) => setIsPublished(e.target.checked)}
          className="w-4 h-4 text-[#5C4FE5] focus:ring-[#5C4FE5] border-gray-400"
        />
        <label htmlFor="isPublished" className="text-sm font-medium text-gray-900">
          Publish (siswa bisa lihat)
        </label>
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 border border-gray-400 text-gray-900 rounded-lg hover:bg-gray-50 font-medium"
        >
          Batal
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 px-4 py-2 bg-[#5C4FE5] text-white rounded-lg hover:bg-[#4a3ec7] disabled:opacity-50 font-medium"
        >
          {loading ? 'Menyimpan...' : isEditing ? 'Update' : 'Simpan'}
        </button>
      </div>
    </form>
  );
}
