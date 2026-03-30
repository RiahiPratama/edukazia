'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Check, AlertCircle, Sparkles } from 'lucide-react';

type Material = {
  id: string;
  title: string;
  content_data: any;
  order_number: number;
  is_published: boolean;
  unit_id: string;
  lesson_id: string;
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

  const [editUnitName, setEditUnitName] = useState('');
  const [editUnitPosition, setEditUnitPosition] = useState(1);
  const [editLessonName, setEditLessonName] = useState('');
  const [editLessonPosition, setEditLessonPosition] = useState(1);
  const [editMaterialTitle, setEditMaterialTitle] = useState('');

  const [levelsWithMaterials, setLevelsWithMaterials] = useState<Set<string>>(new Set());

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
      setEditMaterialTitle(editData.title || '');
      fetchEditModeData();
    }
  }, [editData]);

  const fetchEditModeData = async () => {
    if (!editData) return;
    setLoadingEditData(true);
    try {
      const { data: unitData } = await supabase.from('units').select('unit_name, position').eq('id', editData.unit_id).single();
      if (unitData) {
        setEditUnitName(unitData.unit_name);
        setEditUnitPosition(unitData.position || 1);
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

  useEffect(() => {
    if (selectedLevels.length > 0) {
      fetchJudulsForSelectedLevels();
    } else {
      setJuduls([]);
      setSelectedJudul('');
    }
  }, [selectedLevels]);

  useEffect(() => {
    if (selectedLesson && selectedLesson !== 'NEW') {
      checkExistingMaterials();
    } else {
      setLevelsWithMaterials(new Set());
    }
  }, [selectedLesson]);

  const checkExistingMaterials = async () => {
    if (!selectedLesson || selectedLesson === 'NEW') return;
    try {
      const { data } = await supabase.from('materials').select('level_id').eq('lesson_id', selectedLesson).eq('category', 'live_zoom');
      if (data) {
        const levelIds = new Set(data.map(m => m.level_id));
        setLevelsWithMaterials(levelIds);
      }
    } catch (error) {
      console.error('Error:', error);
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

  const fetchJudulsForSelectedLevels = async () => {
    if (selectedLevels.length === 0) return;
    const { data } = await supabase.from('juduls').select('*').in('level_id', selectedLevels);
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
        formData.append('content_data', JSON.stringify({ platform, url }));
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

        // ✅ FIX BUG #1: Create JUDUL first if NEW
        let actualJudulId = selectedJudul;
        
        if (selectedJudul === 'NEW' && newJudulName) {
          console.log('🆕 Creating Judul FIRST for all selected levels...');
          
          // Create judul for EACH selected level (juduls are level-specific)
          const judulIds: string[] = [];
          
          for (const levelId of selectedLevels) {
            const { data: newJudul, error: judulError } = await supabase
              .from('juduls')
              .insert({
                level_id: levelId,
                name: newJudulName,
              })
              .select()
              .single();

            if (judulError) {
              console.error('Judul creation error:', judulError);
              alert(`❌ Gagal membuat judul: ${judulError.message}`);
              setLoading(false);
              return;
            }

            judulIds.push(newJudul.id);
            console.log(`✅ Judul created for level ${levelId}:`, newJudul.id);
          }
          
          // Use first judul ID as reference for unit creation
          actualJudulId = judulIds[0];
        }

        // ✅ FIX BUG #2: Create UNIT once with proper judul_id
        let actualUnitId = selectedUnit;
        
        if (selectedUnit === 'NEW' && newUnitName) {
          console.log('🆕 Creating Unit ONCE with judul_id:', actualJudulId);
          
          const { data: newUnit, error: unitError } = await supabase
            .from('units')
            .insert({
              level_id: selectedLevels[0],
              judul_id: actualJudulId, // ✅ Use actual judul ID, not null!
              unit_name: newUnitName,
              unit_number: 0,
              position: 0,
            })
            .select()
            .single();

          if (unitError) {
            console.error('Unit creation error:', unitError);
            alert(`❌ Gagal membuat unit: ${unitError.message}`);
            setLoading(false);
            return;
          }

          actualUnitId = newUnit.id;
          console.log('✅ Unit created with ID:', actualUnitId);
        }

        // Create LESSON once
        let actualLessonId = selectedLesson;
        
        if (selectedLesson === 'NEW' && newLessonName && actualUnitId) {
          console.log('🆕 Creating Lesson ONCE:', newLessonName);
          
          const { data: newLesson, error: lessonError } = await supabase
            .from('lessons')
            .insert({
              unit_id: actualUnitId,
              lesson_name: newLessonName,
              lesson_number: 0,
              position: 0,
            })
            .select()
            .single();

          if (lessonError) {
            console.error('Lesson creation error:', lessonError);
            alert(`❌ Gagal membuat lesson: ${lessonError.message}`);
            setLoading(false);
            return;
          }

          actualLessonId = newLesson.id;
          console.log('✅ Lesson created with ID:', actualLessonId);
        }

        // Create materials for all levels
        let successCount = 0;
        let failedLevels: string[] = [];

        for (const levelId of selectedLevels) {
          try {
            // ✅ Material title = Lesson name only (level is filtered separately)
            const materialTitle = newLessonName || selectedLesson;
            
            const formData = new FormData();
            formData.append('title', materialTitle);
            formData.append('type', 'live_zoom');
            formData.append('category', 'live_zoom');
            formData.append('course_id', selectedCourse);
            formData.append('level_id', levelId);
            formData.append('judul_id', actualJudulId);
            formData.append('judul_name', '');
            formData.append('unit_id', actualUnitId);
            formData.append('unit_name', '');
            formData.append('lesson_id', actualLessonId);
            formData.append('lesson_name', '');
            formData.append('order_number', orderNumber.toString());
            formData.append('is_published', isPublished.toString());
            formData.append('content_data', JSON.stringify({ platform, url }));

            console.log(`📝 Creating material:`, materialTitle);

            const response = await fetch('/api/admin/materials', { method: 'POST', body: formData });
            const result = await response.json();

            if (!response.ok) {
              const levelName = levels.find(l => l.id === levelId)?.name || levelId;
              failedLevels.push(levelName);
              console.error(`Failed for ${levelName}:`, result);
            } else {
              successCount++;
              console.log(`✅ Material created for level ${levelId}`);
            }
          } catch (error) {
            const levelName = levels.find(l => l.id === levelId)?.name || levelId;
            failedLevels.push(levelName);
            console.error(`Error for ${levelName}:`, error);
          }
        }

        if (successCount === selectedLevels.length) {
          alert(`✅ Material berhasil dibuat untuk ${successCount} level!`);
          onSave();
        } else if (successCount > 0) {
          alert(`⚠️ Material dibuat untuk ${successCount} level.\nGagal: ${failedLevels.join(', ')}`);
          onSave();
        } else {
          alert(`❌ Gagal membuat material untuk semua level.\nLevel: ${failedLevels.join(', ')}`);
          setLoading(false);
        }
      }
    } catch (error) {
      alert(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
            <label className="block text-sm font-semibold text-gray-900 mb-2">Mata Pelajaran *</label>
            <select value={selectedCourse} onChange={(e) => { setSelectedCourse(e.target.value); fetchLevels(e.target.value); }} required className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] focus:border-[#5C4FE5] bg-white text-gray-900 font-medium">
              <option value="">Pilih Mata Pelajaran</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              Level * <span className="text-xs font-normal text-gray-500">(Klik untuk pilih multi-level)</span>
            </label>
            
            {!selectedCourse ? (
              <div className="px-4 py-8 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 text-center">
                <p className="text-gray-500 text-sm">Pilih Mata Pelajaran terlebih dahulu</p>
              </div>
            ) : levels.length === 0 ? (
              <div className="px-4 py-8 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 text-center">
                <p className="text-gray-500 text-sm">Tidak ada level tersedia</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gradient-to-r from-[#5C4FE5]/5 to-purple-50 rounded-lg border border-[#5C4FE5]/20">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-[#5C4FE5]" />
                    <span className="text-sm font-medium text-gray-700">
                      {selectedLevels.length === 0 ? 'Belum ada level dipilih' : `${selectedLevels.length} level dipilih`}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={selectAllLevels} className="px-3 py-1.5 text-xs font-semibold bg-white text-[#5C4FE5] border border-[#5C4FE5] rounded-md hover:bg-[#5C4FE5] hover:text-white transition-colors">
                      Pilih Semua
                    </button>
                    <button type="button" onClick={clearAllLevels} className="px-3 py-1.5 text-xs font-semibold bg-white text-gray-600 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors">
                      Clear
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {levels.map((level) => {
                    const hasMaterial = levelsWithMaterials.has(level.id);
                    const isSelected = selectedLevels.includes(level.id);
                    
                    return (
                      <button
                        key={level.id}
                        type="button"
                        onClick={() => toggleLevel(level.id)}
                        className={`relative px-3 py-2.5 rounded-lg border-2 font-medium text-sm transition-all duration-200 ${
                          isSelected
                            ? 'bg-[#5C4FE5] border-[#5C4FE5] text-white shadow-md scale-[1.02]'
                            : hasMaterial
                            ? 'bg-green-50 border-green-400 text-green-900 hover:border-green-500 hover:shadow-sm'
                            : 'bg-white border-gray-200 text-gray-700 hover:border-[#5C4FE5]/50 hover:shadow-sm'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate">{level.name}</span>
                          {isSelected && <Check size={14} className="flex-shrink-0" />}
                          {hasMaterial && !isSelected && (
                            <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" title="Sudah ada material" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {levelsWithMaterials.size > 0 && (
                  <div className="flex items-center gap-4 pt-2 text-xs text-gray-600">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      <span>Sudah ada material</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-[#5C4FE5]"></div>
                      <span>Dipilih</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {selectedLevels.length > 0 && (
            <>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Judul *</label>
                <select value={selectedJudul} onChange={(e) => { setSelectedJudul(e.target.value); if (e.target.value !== 'NEW') fetchUnits(e.target.value); }} required className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] focus:border-[#5C4FE5] bg-white text-gray-900 font-medium">
                  <option value="">Pilih Judul</option>
                  <option value="NEW">+ Buat Judul Baru</option>
                  {juduls.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
                </select>
                {selectedJudul === 'NEW' && <input type="text" value={newJudulName} onChange={(e) => setNewJudulName(e.target.value)} placeholder="Nama Judul Baru" required className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] mt-2 bg-white text-gray-900 font-medium" />}
              </div>

              {selectedJudul && (
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Unit *</label>
                  <select value={selectedUnit} onChange={(e) => { setSelectedUnit(e.target.value); if (e.target.value !== 'NEW') fetchLessons(e.target.value); }} required className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] focus:border-[#5C4FE5] bg-white text-gray-900 font-medium">
                    <option value="">Pilih Unit</option>
                    <option value="NEW">+ Buat Unit Baru</option>
                    {units.map((u) => <option key={u.id} value={u.id}>{u.unit_name}</option>)}
                  </select>
                  {selectedUnit === 'NEW' && <input type="text" value={newUnitName} onChange={(e) => setNewUnitName(e.target.value)} placeholder="Nama Unit Baru" required className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] mt-2 bg-white text-gray-900 font-medium" />}
                </div>
              )}

              {selectedUnit && (
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Lesson (Nama Materi) *</label>
                  <select value={selectedLesson} onChange={(e) => setSelectedLesson(e.target.value)} required className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] focus:border-[#5C4FE5] bg-white text-gray-900 font-medium">
                    <option value="">Pilih Lesson</option>
                    <option value="NEW">+ Buat Lesson Baru</option>
                    {lessons.map((l) => <option key={l.id} value={l.id}>{l.lesson_name}</option>)}
                  </select>
                  {selectedLesson === 'NEW' && <input type="text" value={newLessonName} onChange={(e) => setNewLessonName(e.target.value)} placeholder="Nama Lesson Baru" required className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] mt-2 bg-white text-gray-900 font-medium" />}
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
            <label className="block text-sm font-semibold text-gray-900 mb-2">Material Title *</label>
            <input type="text" value={editMaterialTitle} onChange={(e) => setEditMaterialTitle(e.target.value)} required className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900 font-medium" />
          </div>

          <div className="border-t-2 border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">📦 Unit Settings</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Unit Name *</label>
                <input type="text" value={editUnitName} onChange={(e) => setEditUnitName(e.target.value)} required className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900 font-medium" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Unit Position *</label>
                <input type="number" value={editUnitPosition} onChange={(e) => setEditUnitPosition(parseInt(e.target.value))} min="0" required className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900 font-medium" />
              </div>
            </div>
          </div>

          <div className="border-t-2 border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">📚 Lesson Settings</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Lesson Name *</label>
                <input type="text" value={editLessonName} onChange={(e) => setEditLessonName(e.target.value)} required className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900 font-medium" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Lesson Position *</label>
                <input type="number" value={editLessonPosition} onChange={(e) => setEditLessonPosition(parseInt(e.target.value))} min="0" required className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900 font-medium" />
              </div>
            </div>
          </div>
        </>
      )}

      <div className={isEditing ? 'border-t-2 border-gray-200 pt-6' : ''}>
        {isEditing && <h3 className="text-lg font-semibold text-gray-900 mb-4">📄 Material Content</h3>}

        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">Platform *</label>
          <select value={platform} onChange={(e) => setPlatform(e.target.value)} required className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900 font-medium">
            <option value="canva">Canva</option>
            <option value="zoom">Zoom</option>
            <option value="google_meet">Google Meet</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">URL Link *</label>
          <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." required className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900 font-medium" />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">Order Number *</label>
          <input type="number" value={orderNumber} onChange={(e) => setOrderNumber(parseInt(e.target.value))} min="1" required className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900 font-medium" />
        </div>

        <div className="flex items-center gap-2">
          <input type="checkbox" id="isPublished" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} className="w-4 h-4 text-[#5C4FE5] focus:ring-[#5C4FE5] border-gray-400 rounded" />
          <label htmlFor="isPublished" className="text-sm font-semibold text-gray-900">Publish (siswa bisa lihat)</label>
        </div>
      </div>

      <div className="flex gap-3 pt-4 border-t-2 border-gray-200">
        <button type="button" onClick={onCancel} className="flex-1 px-4 py-2.5 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold transition-colors">
          Batal
        </button>
        <button type="submit" disabled={loading} className="flex-1 px-4 py-2.5 bg-[#5C4FE5] text-white rounded-lg hover:bg-[#4a3ec7] disabled:opacity-50 font-semibold shadow-md transition-all">
          {loading ? 'Menyimpan...' : isEditing ? 'Update' : 'Simpan'}
        </button>
      </div>
    </form>
  );
}
