'use client';

import { useState, useEffect } from 'react';
import { BookOpen, Video, FileText, Headphones, Trash2, Edit, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type Material = {
  id: string;
  title: string;
  type: string;
  category: string;
  course_id: string;
  level_id: string;
  unit_id: string;
  lesson_id: string;
  order_number: number;
  is_published: boolean;
  content_data: any;
  created_at: string;
};

type Level = { id: string; name: string; };
type Judul = { id: string; name: string; };
type Unit = { id: string; unit_name: string; };
type Lesson = { id: string; lesson_name: string; };

type MaterialListProps = {
  category: 'live_zoom' | 'bacaan' | 'kosakata' | 'cefr';
  onEdit?: (material: Material) => void;
};

export default function MaterialList({ category, onEdit }: MaterialListProps) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [filteredMaterials, setFilteredMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // NEW: Store unit and lesson data fetched from DB
  const [unitsMap, setUnitsMap] = useState<Map<string, string>>(new Map());
  const [lessonsMap, setLessonsMap] = useState<Map<string, string>>(new Map());

  // Filter states
  const [levels, setLevels] = useState<Level[]>([]);
  const [juduls, setJuduls] = useState<Judul[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);

  const [selectedLevel, setSelectedLevel] = useState('');
  const [selectedJudul, setSelectedJudul] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('');
  const [selectedLesson, setSelectedLesson] = useState('');

  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());

  const supabase = createClient();

  useEffect(() => {
    fetchMaterials();
    fetchLevels();
  }, [category]);

  useEffect(() => {
    if (selectedLevel) {
      fetchJuduls(selectedLevel);
    } else {
      setJuduls([]);
      setSelectedJudul('');
    }
  }, [selectedLevel]);

  useEffect(() => {
    if (selectedJudul) {
      fetchUnits(selectedJudul);
    } else {
      setUnits([]);
      setSelectedUnit('');
    }
  }, [selectedJudul]);

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
  }, [materials, selectedLevel, selectedJudul, selectedUnit, selectedLesson]);

  const fetchMaterials = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('materials')
        .select('*')
        .eq('category', category)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setMaterials(data || []);

      // NEW: Fetch unit and lesson names for all materials
      if (data && data.length > 0) {
        await fetchUnitAndLessonNames(data);
      }
    } catch (err) {
      console.error('Error fetching materials:', err);
      setError('Gagal memuat daftar materi');
    } finally {
      setLoading(false);
    }
  };

  // NEW: Fetch unit and lesson names from DB
  const fetchUnitAndLessonNames = async (materials: Material[]) => {
    const unitIds = [...new Set(materials.map(m => m.unit_id).filter(Boolean))];
    const lessonIds = [...new Set(materials.map(m => m.lesson_id).filter(Boolean))];

    // Fetch units
    if (unitIds.length > 0) {
      const { data: unitsData } = await supabase
        .from('units')
        .select('id, unit_name')
        .in('id', unitIds);

      const newUnitsMap = new Map<string, string>();
      unitsData?.forEach(u => newUnitsMap.set(u.id, u.unit_name));
      setUnitsMap(newUnitsMap);
    }

    // Fetch lessons
    if (lessonIds.length > 0) {
      const { data: lessonsData } = await supabase
        .from('lessons')
        .select('id, lesson_name')
        .in('id', lessonIds);

      const newLessonsMap = new Map<string, string>();
      lessonsData?.forEach(l => newLessonsMap.set(l.id, l.lesson_name));
      setLessonsMap(newLessonsMap);
    }
  };

  const fetchLevels = async () => {
    const { data } = await supabase
      .from('levels')
      .select('id, name')
      .order('sort_order');
    
    setLevels(data || []);
  };

  const fetchJuduls = async (levelId: string) => {
    const { data } = await supabase
      .from('juduls')
      .select('id, name')
      .eq('level_id', levelId)
      .order('name');
    
    const uniqueJuduls = data?.reduce((acc: Judul[], curr) => {
      if (!acc.find(j => j.name === curr.name)) {
        acc.push(curr);
      }
      return acc;
    }, []) || [];
    
    setJuduls(uniqueJuduls);
  };

  const fetchUnits = async (judulId: string) => {
    const { data } = await supabase
      .from('units')
      .select('id, unit_name')
      .eq('judul_id', judulId)
      .order('unit_number');
    
    setUnits(data || []);
  };

  const fetchLessons = async (unitId: string) => {
    const { data } = await supabase
      .from('lessons')
      .select('id, lesson_name')
      .eq('unit_id', unitId)
      .order('lesson_number');
    
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

  // NEW: Group by Unit → Lesson hierarchy
  const groupByUnitAndLesson = () => {
    const unitGroups: {
      [unitId: string]: {
        unitId: string;
        unitName: string;
        lessons: {
          [lessonId: string]: {
            lessonId: string;
            lessonName: string;
            materials: Material[];
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
          unitName: unitsMap.get(unitId) || 'Unit Tidak Diketahui',
          lessons: {}
        };
      }

      // Create lesson group within unit if not exists
      if (!unitGroups[unitId].lessons[lessonId]) {
        unitGroups[unitId].lessons[lessonId] = {
          lessonId,
          lessonName: lessonsMap.get(lessonId) || material.title || 'Lesson Tidak Diketahui',
          materials: []
        };
      }

      // Add material to lesson group
      unitGroups[unitId].lessons[lessonId].materials.push(material);
    });

    // Convert to array and sort
    return Object.values(unitGroups)
      .map(unitGroup => ({
        ...unitGroup,
        lessons: Object.values(unitGroup.lessons).sort((a, b) => 
          a.lessonName.localeCompare(b.lessonName)
        ),
        totalMaterials: Object.values(unitGroup.lessons).reduce((sum, lesson) => sum + lesson.materials.length, 0)
      }))
      .sort((a, b) => a.unitName.localeCompare(b.unitName));
  };

  const toggleUnit = (unitId: string) => {
    setExpandedUnits(prev => {
      const newSet = new Set(prev);
      if (newSet.has(unitId)) {
        newSet.delete(unitId);
      } else {
        newSet.add(unitId);
      }
      return newSet;
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Yakin ingin menghapus materi ini?')) return;

    try {
      const { error: deleteError } = await supabase
        .from('materials')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      alert('✅ Materi berhasil dihapus!');
      fetchMaterials();
    } catch (err) {
      console.error('Error deleting material:', err);
      alert('❌ Gagal menghapus materi');
    }
  };

  const getCategoryIcon = () => {
    switch (category) {
      case 'live_zoom': return <Video size={16} className="text-blue-600" />;
      case 'bacaan': return <BookOpen size={16} className="text-green-600" />;
      case 'kosakata': return <FileText size={16} className="text-yellow-600" />;
      case 'cefr': return <Headphones size={16} className="text-red-600" />;
    }
  };

  const getCategoryLabel = () => {
    switch (category) {
      case 'live_zoom': return 'Live Zoom';
      case 'bacaan': return 'Bacaan';
      case 'kosakata': return 'Kosakata';
      case 'cefr': return 'CEFR';
    }
  };

  const getContentPreview = (material: Material) => {
    const data = material.content_data;
    
    switch (category) {
      case 'live_zoom':
        return (
          <div className="text-sm text-gray-600">
            <span className="font-medium">{data?.platform || 'N/A'}</span>
            {data?.url && (
              <a 
                href={data.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="ml-2 text-[#5C4FE5] hover:underline inline-flex items-center gap-1"
              >
                <ExternalLink size={12} />
                Link
              </a>
            )}
          </div>
        );
      case 'bacaan':
        return (
          <div className="text-sm text-gray-600">
            {data?.jsx_file_path && (
              <span className="text-green-600">✓ Component</span>
            )}
          </div>
        );
      case 'kosakata':
        return (
          <div className="text-sm text-gray-600">
            <span className="font-medium">{data?.file_type || 'N/A'}</span>
          </div>
        );
      case 'cefr':
        return (
          <div className="text-sm text-gray-600 flex gap-2">
            {data?.audio_url && (
              <span className="text-red-600">✓ Audio</span>
            )}
            {data?.skill_focus && (
              <span className="text-xs px-2 py-0.5 bg-gray-100 rounded">
                {data.skill_focus}
              </span>
            )}
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-[#5C4FE5] border-t-transparent rounded-full mx-auto"></div>
        <p className="text-gray-600 mt-4">Memuat daftar materi...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">{error}</p>
        <button
          onClick={fetchMaterials}
          className="mt-4 px-4 py-2 bg-[#5C4FE5] text-white rounded-lg hover:bg-[#4a3ec7]"
        >
          Coba Lagi
        </button>
      </div>
    );
  }

  const groupedData = groupByUnitAndLesson();

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="grid grid-cols-4 gap-4 p-4 bg-white rounded-lg border-2 border-gray-200 shadow-sm">
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">Level</label>
          <select
            value={selectedLevel}
            onChange={(e) => {
              setSelectedLevel(e.target.value);
              setSelectedJudul('');
              setSelectedUnit('');
              setSelectedLesson('');
            }}
            className="w-full px-3 py-2.5 text-sm font-medium border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] focus:border-[#5C4FE5] bg-white text-gray-900"
          >
            <option value="">Semua Level</option>
            {levels.map(level => (
              <option key={level.id} value={level.id}>{level.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">Judul</label>
          <select
            value={selectedJudul}
            onChange={(e) => {
              setSelectedJudul(e.target.value);
              setSelectedUnit('');
              setSelectedLesson('');
            }}
            disabled={!selectedLevel}
            className="w-full px-3 py-2.5 text-sm font-medium border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] focus:border-[#5C4FE5] bg-white text-gray-900 disabled:bg-gray-100 disabled:text-gray-500"
          >
            <option value="">Semua Judul</option>
            {juduls.map(judul => (
              <option key={judul.id} value={judul.id}>{judul.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">Unit</label>
          <select
            value={selectedUnit}
            onChange={(e) => {
              setSelectedUnit(e.target.value);
              setSelectedLesson('');
            }}
            disabled={!selectedJudul}
            className="w-full px-3 py-2.5 text-sm font-medium border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] focus:border-[#5C4FE5] bg-white text-gray-900 disabled:bg-gray-100 disabled:text-gray-500"
          >
            <option value="">Semua Unit</option>
            {units.map(unit => (
              <option key={unit.id} value={unit.id}>{unit.unit_name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">Lesson</label>
          <select
            value={selectedLesson}
            onChange={(e) => setSelectedLesson(e.target.value)}
            disabled={!selectedUnit}
            className="w-full px-3 py-2.5 text-sm font-medium border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] focus:border-[#5C4FE5] bg-white text-gray-900 disabled:bg-gray-100 disabled:text-gray-500"
          >
            <option value="">Semua Lesson</option>
            {lessons.map(lesson => (
              <option key={lesson.id} value={lesson.id}>{lesson.lesson_name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          {filteredMaterials.length} Materi
        </h3>
      </div>

      {/* Hierarchical Grouped Materials */}
      {groupedData.length === 0 ? (
        <div className="p-8 text-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
            {getCategoryIcon()}
          </div>
          <p className="text-gray-600 font-medium">Tidak ada materi yang sesuai filter</p>
          <p className="text-sm text-gray-500 mt-1">
            {materials.length === 0 
              ? 'Klik tombol "Tambah Materi" untuk membuat materi baru'
              : 'Coba ubah filter atau reset filter'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {groupedData.map(unitGroup => {
            const isExpanded = expandedUnits.has(unitGroup.unitId);
            
            return (
              <div key={unitGroup.unitId} className="border-2 border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
                {/* Unit Header */}
                <button
                  onClick={() => toggleUnit(unitGroup.unitId)}
                  className="w-full px-4 py-3 bg-gradient-to-r from-[#5C4FE5]/5 to-purple-50 border-b-2 border-gray-200 hover:from-[#5C4FE5]/10 hover:to-purple-100 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {isExpanded ? <ChevronDown size={20} className="text-[#5C4FE5]" /> : <ChevronRight size={20} className="text-gray-500" />}
                      <span className="font-bold text-gray-900 text-lg">📦 {unitGroup.unitName}</span>
                      <span className="text-sm font-medium text-[#5C4FE5] bg-white px-2 py-0.5 rounded-full">
                        {unitGroup.totalMaterials} materi
                      </span>
                    </div>
                  </div>
                </button>

                {/* Lessons under this Unit */}
                {isExpanded && (
                  <div className="divide-y divide-gray-100">
                    {unitGroup.lessons.map(lessonGroup => (
                      <div key={lessonGroup.lessonId} className="bg-white">
                        {/* Lesson Header */}
                        <div className="px-6 py-3 bg-gray-50">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900">📄 {lessonGroup.lessonName}</span>
                            <span className="text-xs text-gray-500">({lessonGroup.materials.length} materi)</span>
                          </div>
                        </div>

                        {/* Materials in this lesson */}
                        <div className="divide-y divide-gray-100">
                          {lessonGroup.materials.map(material => (
                            <div
                              key={material.id}
                              className="px-6 py-4 hover:bg-gray-50 transition-colors"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    {getCategoryIcon()}
                                    <h4 className="font-medium text-gray-900">{material.title}</h4>
                                    {!material.is_published && (
                                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                                        Draft
                                      </span>
                                    )}
                                    {material.is_published && (
                                      <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">
                                        Published
                                      </span>
                                    )}
                                  </div>

                                  {getContentPreview(material)}

                                  <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                                    <span>Order: #{material.order_number}</span>
                                    <span>•</span>
                                    <span>{new Date(material.created_at).toLocaleDateString('id-ID', {
                                      day: 'numeric',
                                      month: 'short',
                                      year: 'numeric'
                                    })}</span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 ml-4">
                                  {onEdit && (
                                    <button
                                      onClick={() => onEdit(material)}
                                      className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                      title="Edit"
                                    >
                                      <Edit size={18} />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleDelete(material.id)}
                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Hapus"
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
