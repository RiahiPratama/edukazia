'use client';

import { useState, useEffect } from 'react';
import { BookOpen, Video, FileText, Headphones, Trash2, Edit, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type MaterialWithHierarchy = {
  id: string;
  title: string;
  category: string;
  position: number;
  is_published: boolean;
  content_data: any;
  created_at: string;
  lesson_id: string;
  lesson_name: string;
  unit_id: string;
  unit_name: string;
  chapter_id: string | null;
  chapter_title: string | null;
  level_id: string;
  level_name: string;
};

type Level = { id: string; name: string; };
type Chapter = { id: string; chapter_title: string; };
type Unit = { id: string; unit_name: string; };
type Lesson = { id: string; lesson_name: string; };

type MaterialListProps = {
  category: 'live_zoom' | 'bacaan' | 'kosakata' | 'cefr';
  onEdit?: (material: any) => void;
};

export default function MaterialList({ category, onEdit }: MaterialListProps) {
  const [materials, setMaterials] = useState<MaterialWithHierarchy[]>([]);
  const [filteredMaterials, setFilteredMaterials] = useState<MaterialWithHierarchy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [levels, setLevels] = useState<Level[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);

  const [selectedLevel, setSelectedLevel] = useState('');
  const [selectedChapter, setSelectedChapter] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('');
  const [selectedLesson, setSelectedLesson] = useState('');

  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [editingPosition, setEditingPosition] = useState<number>(0);
  const [savingPosition, setSavingPosition] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    fetchMaterials();
    fetchLevels();
  }, [category]);

  useEffect(() => {
    if (selectedLevel) {
      fetchChapters(selectedLevel);
    } else {
      setChapters([]);
      setSelectedChapter('');
    }
  }, [selectedLevel]);

  useEffect(() => {
    if (selectedChapter) {
      if (selectedChapter === 'ALL') {
        fetchAllUnits(selectedLevel);
      } else {
        fetchUnits(selectedChapter);
      }
    } else {
      setUnits([]);
      setSelectedUnit('');
    }
  }, [selectedChapter]);

  useEffect(() => {
    if (selectedUnit) {
      fetchLessons(selectedUnit);
    } else {
      setLessons([]);
      setSelectedLesson('');
    }
  }, [selectedUnit]);

  useEffect(() => {
    applyFilters();
  }, [materials, selectedLevel, selectedChapter, selectedUnit, selectedLesson]);

  const fetchMaterials = async () => {
    setLoading(true);
    setError(null);

    try {
      // STEP 1: Fetch materials (flat)
      const { data: materialsData, error: materialsError } = await supabase
        .from('materials')
        .select('id, title, category, position, is_published, content_data, created_at, lesson_id')
        .eq('category', category)
        .order('created_at', { ascending: false });

      if (materialsError) throw materialsError;
      if (!materialsData || materialsData.length === 0) {
        setMaterials([]);
        setLoading(false);
        return;
      }

      // STEP 2: Get unique lesson IDs
      const lessonIds = [...new Set(materialsData.map(m => m.lesson_id).filter(Boolean))];

      // STEP 3: Fetch lessons (flat)
      const { data: lessonsData, error: lessonsError } = await supabase
        .from('lessons')
        .select('id, lesson_name, unit_id')
        .in('id', lessonIds);

      if (lessonsError) throw lessonsError;

      // STEP 4: Get unique unit IDs
      const unitIds = [...new Set(lessonsData?.map(l => l.unit_id).filter(Boolean) || [])];

      // STEP 5: Fetch units (flat)
      const { data: unitsData, error: unitsError } = await supabase
        .from('units')
        .select('id, unit_name, chapter_id, level_id')
        .in('id', unitIds);

      if (unitsError) throw unitsError;

      // STEP 6: Get unique chapter IDs and level IDs
      const chapterIds = [...new Set(unitsData?.map(u => u.chapter_id).filter(Boolean) || [])];
      const levelIds = [...new Set(unitsData?.map(u => u.level_id).filter(Boolean) || [])];

      // STEP 7: Fetch chapters (flat)
      const { data: chaptersData } = await supabase
        .from('chapters')
        .select('id, chapter_title')
        .in('id', chapterIds);

      // STEP 8: Fetch levels (flat)
      const { data: levelsData } = await supabase
        .from('levels')
        .select('id, name')
        .in('id', levelIds);

      // STEP 9: Create lookup maps
      const lessonsMap = new Map(lessonsData?.map(l => [l.id, l]) || []);
      const unitsMap = new Map(unitsData?.map(u => [u.id, u]) || []);
      const chaptersMap = new Map(chaptersData?.map(ch => [ch.id, ch]) || []);
      const levelsMap = new Map(levelsData?.map(lv => [lv.id, lv]) || []);

      // STEP 10: Merge data in JavaScript
      const materialsWithHierarchy: MaterialWithHierarchy[] = materialsData.map(material => {
        const lesson = lessonsMap.get(material.lesson_id);
        const unit = lesson ? unitsMap.get(lesson.unit_id) : null;
        const chapter = unit?.chapter_id ? chaptersMap.get(unit.chapter_id) : null;
        const level = unit?.level_id ? levelsMap.get(unit.level_id) : null;

        return {
          id: material.id,
          title: material.title,
          category: material.category,
          position: material.position,
          is_published: material.is_published,
          content_data: material.content_data,
          created_at: material.created_at,
          lesson_id: material.lesson_id,
          lesson_name: lesson?.lesson_name || 'Unknown Lesson',
          unit_id: lesson?.unit_id || '',
          unit_name: unit?.unit_name || 'Unknown Unit',
          chapter_id: unit?.chapter_id || null,
          chapter_title: chapter?.chapter_title || null,
          level_id: unit?.level_id || '',
          level_name: level?.name || 'Unknown Level',
        };
      });

      setMaterials(materialsWithHierarchy);
    } catch (err) {
      console.error('Error fetching materials:', err);
      setError('Gagal memuat daftar materi');
    } finally {
      setLoading(false);
    }
  };

  const fetchLevels = async () => {
    const { data } = await supabase
      .from('levels')
      .select('id, name')
      .order('sort_order');
    
    setLevels(data || []);
  };

  const fetchChapters = async (levelId: string) => {
    const { data } = await supabase
      .from('chapters')
      .select('id, chapter_title')
      .eq('level_id', levelId)
      .order('order_number');
    
    setChapters(data || []);
  };

  const fetchUnits = async (chapterId: string) => {
    const { data } = await supabase
      .from('units')
      .select('id, unit_name')
      .eq('chapter_id', chapterId)
      .order('position');
    
    setUnits(data || []);
  };

  const fetchAllUnits = async (levelId: string) => {
    const { data } = await supabase
      .from('units')
      .select('id, unit_name')
      .eq('level_id', levelId)
      .order('position');
    
    setUnits(data || []);
  };

  const fetchLessons = async (unitId: string) => {
    const { data } = await supabase
      .from('lessons')
      .select('id, lesson_name')
      .eq('unit_id', unitId)
      .order('position');
    
    setLessons(data || []);
  };

  const applyFilters = () => {
    let filtered = [...materials];

    if (selectedLevel) {
      filtered = filtered.filter(m => m.level_id === selectedLevel);
    }
    if (selectedUnit) {
      filtered = filtered.filter(m => m.unit_id === selectedUnit);
    }
    if (selectedLesson) {
      filtered = filtered.filter(m => m.lesson_id === selectedLesson);
    }

    setFilteredMaterials(filtered);
  };

  const groupByUnitAndLesson = () => {
    const unitGroups: {
      [unitId: string]: {
        unitId: string;
        unitName: string;
        lessons: {
          [lessonId: string]: {
            lessonId: string;
            lessonName: string;
            materials: MaterialWithHierarchy[];
          }
        }
      }
    } = {};

    filteredMaterials.forEach(material => {
      const unitId = material.unit_id || 'no-unit';
      const lessonId = material.lesson_id || 'no-lesson';

      // Create unit group if not exists
      if (!unitGroups[unitId]) {
        unitGroups[unitId] = {
          unitId,
          unitName: material.unit_name || 'Unit Tidak Diketahui',
          lessons: {}
        };
      }

      // Create lesson group within unit if not exists
      if (!unitGroups[unitId].lessons[lessonId]) {
        unitGroups[unitId].lessons[lessonId] = {
          lessonId,
          lessonName: material.lesson_name || 'Lesson Tidak Diketahui',
          materials: []
        };
      }

      // Add material to lesson group
      unitGroups[unitId].lessons[lessonId].materials.push(material);
    });

    return unitGroups;
  };

  const toggleUnit = (unitId: string) => {
    const newExpanded = new Set(expandedUnits);
    if (newExpanded.has(unitId)) {
      newExpanded.delete(unitId);
    } else {
      newExpanded.add(unitId);
    }
    setExpandedUnits(newExpanded);
  };

  const handleDelete = async (materialId: string) => {
    if (!confirm('Yakin ingin menghapus material ini?')) return;

    try {
      const response = await fetch(`/api/admin/materials/${materialId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete');

      alert('✅ Material berhasil dihapus!');
      fetchMaterials();
    } catch (error) {
      alert('❌ Gagal menghapus material');
    }
  };

  const startEditPosition = (unitId: string, currentPosition: number) => {
    setEditingUnitId(unitId);
    setEditingPosition(currentPosition);
  };

  const cancelEditPosition = () => {
    setEditingUnitId(null);
    setEditingPosition(0);
  };

  const saveUnitPosition = async (unitId: string) => {
    setSavingPosition(true);
    try {
      const formData = new FormData();
      formData.append('position', editingPosition.toString());

      const response = await fetch(`/api/admin/units/${unitId}`, {
        method: 'PATCH',
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to update position');

      alert('✅ Urutan unit berhasil diupdate!');
      setEditingUnitId(null);
      fetchMaterials(); // Refresh to show new order
    } catch (error) {
      alert('❌ Gagal mengupdate urutan unit');
    } finally {
      setSavingPosition(false);
    }
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'live_zoom': return <Video className="w-5 h-5" />;
      case 'bacaan': return <BookOpen className="w-5 h-5" />;
      case 'kosakata': return <FileText className="w-5 h-5" />;
      case 'cefr': return <Headphones className="w-5 h-5" />;
      default: return <FileText className="w-5 h-5" />;
    }
  };

  const getContentUrl = (material: MaterialWithHierarchy) => {
    if (material.category === 'live_zoom') {
      return material.content_data?.url || material.content_data?.zoom_link || '#';
    }
    if (material.category === 'kosakata') {
      return material.content_data?.url || material.content_data?.canva_link || '#';
    }
    return '#';
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-[#5C4FE5] border-t-transparent rounded-full mx-auto"></div>
        <p className="text-gray-600 mt-4">Memuat materi...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">{error}</p>
        <button
          onClick={() => fetchMaterials()}
          className="mt-4 px-4 py-2 bg-[#5C4FE5] text-white rounded-lg hover:bg-[#4a3ec7]"
        >
          Coba Lagi
        </button>
      </div>
    );
  }

  const unitGroups = groupByUnitAndLesson();
  const totalMaterials = filteredMaterials.length;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="grid grid-cols-4 gap-4">
        <select
          value={selectedLevel}
          onChange={(e) => setSelectedLevel(e.target.value)}
          className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white"
        >
          <option value="">Semua Level</option>
          {levels.map((level) => (
            <option key={level.id} value={level.id}>{level.name}</option>
          ))}
        </select>

        <select
          value={selectedChapter}
          onChange={(e) => setSelectedChapter(e.target.value)}
          className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white"
        >
          <option value="">Semua Chapter</option>
          <option value="ALL">📦 Semua Unit (Tanpa Filter)</option>
          {chapters.map((ch) => (
            <option key={ch.id} value={ch.id}>{ch.chapter_title}</option>
          ))}
        </select>

        <select
          value={selectedUnit}
          onChange={(e) => setSelectedUnit(e.target.value)}
          className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white"
        >
          <option value="">Semua Unit</option>
          {units.map((unit) => (
            <option key={unit.id} value={unit.id}>{unit.unit_name}</option>
          ))}
        </select>

        <select
          value={selectedLesson}
          onChange={(e) => setSelectedLesson(e.target.value)}
          className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white"
        >
          <option value="">Semua Lesson</option>
          {lessons.map((lesson) => (
            <option key={lesson.id} value={lesson.id}>{lesson.lesson_name}</option>
          ))}
        </select>
      </div>

      {/* Count */}
      <div className="text-lg font-semibold text-gray-900">
        {totalMaterials} Materi
      </div>

      {/* Material List Grouped by Unit → Lesson */}
      <div className="space-y-4">
        {Object.values(unitGroups).map((unitGroup) => {
          // Get first material to extract unit data
          const firstLesson = Object.values(unitGroup.lessons)[0];
          const firstMaterial = firstLesson?.materials[0];
          const unitData = materials.find(m => m.unit_id === unitGroup.unitId);
          const isEditing = editingUnitId === unitGroup.unitId;

          return (
            <div key={unitGroup.unitId} className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
              {/* Unit Header */}
              <div className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3 flex-1">
                  <button
                    onClick={() => toggleUnit(unitGroup.unitId)}
                    className="flex items-center gap-3"
                  >
                    {expandedUnits.has(unitGroup.unitId) ? (
                      <ChevronDown className="w-5 h-5 text-gray-600" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-600" />
                    )}
                    <span className="text-lg font-semibold text-gray-900">
                      📦 {unitGroup.unitName}
                    </span>
                  </button>

                  {/* Position Controls */}
                  {!isEditing ? (
                    <div className="flex items-center gap-2 ml-4">
                      <span className="text-sm text-gray-600">
                        Urutan: <span className="font-semibold">{unitData?.position || 0}</span>
                      </span>
                      <button
                        onClick={() => startEditPosition(unitGroup.unitId, unitData?.position || 0)}
                        className="p-1.5 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                        title="Edit urutan"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 ml-4">
                      <span className="text-sm text-gray-600">Urutan:</span>
                      <input
                        type="number"
                        value={editingPosition}
                        onChange={(e) => setEditingPosition(parseInt(e.target.value) || 0)}
                        min="0"
                        className="w-20 px-2 py-1 border-2 border-[#5C4FE5] rounded text-sm font-semibold focus:ring-2 focus:ring-[#5C4FE5]"
                        autoFocus
                      />
                      <button
                        onClick={() => saveUnitPosition(unitGroup.unitId)}
                        disabled={savingPosition}
                        className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
                        title="Simpan"
                      >
                        {savingPosition ? (
                          <div className="animate-spin w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full" />
                        ) : (
                          <span className="text-lg">✓</span>
                        )}
                      </button>
                      <button
                        onClick={cancelEditPosition}
                        disabled={savingPosition}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                        title="Batal"
                      >
                        <span className="text-lg">✕</span>
                      </button>
                    </div>
                  )}
                </div>

                <span className="text-sm text-gray-600">
                  {Object.keys(unitGroup.lessons).length} lesson
                </span>
              </div>

              {/* Lessons under this unit */}
              {expandedUnits.has(unitGroup.unitId) && (
              <div className="border-t-2 border-gray-200">
                {Object.values(unitGroup.lessons).map((lessonGroup) => {
                  // Get first material for this lesson (usually only 1)
                  const material = lessonGroup.materials[0];
                  if (!material) return null;

                  return (
                    <div 
                      key={lessonGroup.lessonId} 
                      className="px-6 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors border-b border-gray-200 last:border-b-0"
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-[#5C4FE5]">
                          {getCategoryIcon(material.category)}
                        </div>
                        <span className="text-sm font-semibold text-gray-700">
                          ▸ {lessonGroup.lessonName}
                        </span>
                        {material.is_published && (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded">
                            Published
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {(material.category === 'live_zoom' || material.category === 'kosakata') && (
                          <a
                            href={getContentUrl(material)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Buka link"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                        {onEdit && (
                          <button
                            onClick={() => onEdit(material)}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(material.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Hapus"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {totalMaterials === 0 && (
        <div className="text-center py-12 text-gray-500">
          Belum ada materi. Klik "Tambah Materi" untuk membuat materi baru.
        </div>
      )}
    </div>
  );
}
