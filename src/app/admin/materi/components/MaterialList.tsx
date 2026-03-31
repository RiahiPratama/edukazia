'use client';

import { useState, useEffect } from 'react';
import { BookOpen, Video, FileText, Headphones, Trash2, Edit, ExternalLink, ChevronDown, ChevronRight, Library, Book, FileCheck, GraduationCap, Award, Star, Target, Lightbulb, Brain, Bookmark, BookMarked, Layers } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

// Available icons for chapters and units
const ICON_OPTIONS = [
  { value: 'Library', label: 'Library', Component: Library },
  { value: 'Book', label: 'Book', Component: Book },
  { value: 'BookOpen', label: 'BookOpen', Component: BookOpen },
  { value: 'GraduationCap', label: 'GraduationCap', Component: GraduationCap },
  { value: 'Award', label: 'Award', Component: Award },
  { value: 'Star', label: 'Star', Component: Star },
  { value: 'Target', label: 'Target', Component: Target },
  { value: 'Lightbulb', label: 'Lightbulb', Component: Lightbulb },
  { value: 'Brain', label: 'Brain', Component: Brain },
  { value: 'Bookmark', label: 'Bookmark', Component: Bookmark },
  { value: 'BookMarked', label: 'BookMarked', Component: BookMarked },
  { value: 'Layers', label: 'Layers', Component: Layers },
];

// Helper to get icon component
const getIconComponent = (iconName: string | null) => {
  if (!iconName) return Library;
  const icon = ICON_OPTIONS.find(opt => opt.value === iconName);
  return icon ? icon.Component : Library;
};

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
  unit_position: number;
  unit_icon: string | null;
  chapter_id: string | null;
  chapter_title: string | null;
  chapter_icon: string | null;
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
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  
  // Chapter edit states
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [editingChapterTitle, setEditingChapterTitle] = useState<string>('');
  const [editingChapterIcon, setEditingChapterIcon] = useState<string>('Library');
  const [savingChapter, setSavingChapter] = useState(false);
  
  // Unit edit states
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [editingUnitName, setEditingUnitName] = useState<string>('');
  const [editingUnitIcon, setEditingUnitIcon] = useState<string>('Book');
  const [editingPosition, setEditingPosition] = useState<number>(0);
  const [savingPosition, setSavingPosition] = useState(false);

  // Lesson edit states
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [editingLessonName, setEditingLessonName] = useState<string>('');
  const [editingLessonPosition, setEditingLessonPosition] = useState<number>(0);
  const [savingLesson, setSavingLesson] = useState(false);

  // Material edit states
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [editingMaterialTitle, setEditingMaterialTitle] = useState<string>('');
  const [editingMaterialUrl, setEditingMaterialUrl] = useState<string>('');
  const [savingMaterial, setSavingMaterial] = useState(false);

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

      const lessonIds = [...new Set(materialsData.map(m => m.lesson_id).filter(Boolean))];

      const { data: lessonsData, error: lessonsError } = await supabase
        .from('lessons')
        .select('id, lesson_name, unit_id')
        .in('id', lessonIds);

      if (lessonsError) throw lessonsError;

      const unitIds = [...new Set(lessonsData?.map(l => l.unit_id).filter(Boolean) || [])];

      const { data: unitsData, error: unitsError } = await supabase
        .from('units')
        .select('id, unit_name, chapter_id, level_id, position, icon')
        .in('id', unitIds);

      if (unitsError) throw unitsError;

      const chapterIds = [...new Set(unitsData?.map(u => u.chapter_id).filter(Boolean) || [])];
      const levelIds = [...new Set(unitsData?.map(u => u.level_id).filter(Boolean) || [])];

      const { data: chaptersData } = await supabase
        .from('chapters')
        .select('id, chapter_title, icon')
        .in('id', chapterIds);

      const { data: levelsData } = await supabase
        .from('levels')
        .select('id, name')
        .in('id', levelIds);

      const lessonsMap = new Map(lessonsData?.map(l => [l.id, l]) || []);
      const unitsMap = new Map(unitsData?.map(u => [u.id, u]) || []);
      const chaptersMap = new Map(chaptersData?.map(ch => [ch.id, ch]) || []);
      const levelsMap = new Map(levelsData?.map(lv => [lv.id, lv]) || []);

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
          unit_position: unit?.position || 0,
          unit_icon: unit?.icon || null,
          chapter_id: unit?.chapter_id || null,
          chapter_title: chapter?.chapter_title || null,
          chapter_icon: chapter?.icon || null,
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
    const { data } = await supabase.from('levels').select('id, name').order('sort_order');
    setLevels(data || []);
  };

  const fetchChapters = async (levelId: string) => {
    const { data } = await supabase.from('chapters').select('id, chapter_title').eq('level_id', levelId).order('order_number');
    setChapters(data || []);
  };

  const fetchUnits = async (chapterId: string) => {
    const { data } = await supabase.from('units').select('id, unit_name').eq('chapter_id', chapterId).order('position');
    setUnits(data || []);
  };

  const fetchAllUnits = async (levelId: string) => {
    const { data } = await supabase.from('units').select('id, unit_name').eq('level_id', levelId).order('position');
    setUnits(data || []);
  };

  const fetchLessons = async (unitId: string) => {
    const { data } = await supabase.from('lessons').select('id, lesson_name').eq('unit_id', unitId).order('position');
    setLessons(data || []);
  };

  const applyFilters = () => {
    let filtered = [...materials];
    if (selectedLevel) filtered = filtered.filter(m => m.level_id === selectedLevel);
    if (selectedUnit) filtered = filtered.filter(m => m.unit_id === selectedUnit);
    if (selectedLesson) filtered = filtered.filter(m => m.lesson_id === selectedLesson);
    setFilteredMaterials(filtered);
  };

  const groupByChapterUnitAndLesson = () => {
    const chapterGroups: {
      [chapterId: string]: {
        chapterId: string;
        chapterTitle: string;
        chapterIcon: string;
        units: {
          [unitId: string]: {
            unitId: string;
            unitName: string;
            unitPosition: number;
            unitIcon: string;
            lessons: {
              [lessonId: string]: {
                lessonId: string;
                lessonName: string;
                materials: MaterialWithHierarchy[];
              }
            }
          }
        }
      }
    } = {};

    filteredMaterials.forEach(material => {
      const chapterId = material.chapter_id || 'no-chapter';
      const unitId = material.unit_id || 'no-unit';
      const lessonId = material.lesson_id || 'no-lesson';

      if (!chapterGroups[chapterId]) {
        chapterGroups[chapterId] = {
          chapterId,
          chapterTitle: material.chapter_title || 'Chapter Tidak Diketahui',
          chapterIcon: material.chapter_icon || 'Library',
          units: {}
        };
      }

      if (!chapterGroups[chapterId].units[unitId]) {
        chapterGroups[chapterId].units[unitId] = {
          unitId,
          unitName: material.unit_name || 'Unit Tidak Diketahui',
          unitPosition: material.unit_position || 0,
          unitIcon: material.unit_icon || 'Book',
          lessons: {}
        };
      }

      if (!chapterGroups[chapterId].units[unitId].lessons[lessonId]) {
        chapterGroups[chapterId].units[unitId].lessons[lessonId] = {
          lessonId,
          lessonName: material.lesson_name || 'Lesson Tidak Diketahui',
          materials: []
        };
      }

      chapterGroups[chapterId].units[unitId].lessons[lessonId].materials.push(material);
    });

    return chapterGroups;
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

  const toggleChapter = (chapterId: string) => {
    const newExpanded = new Set(expandedChapters);
    if (newExpanded.has(chapterId)) {
      newExpanded.delete(chapterId);
    } else {
      newExpanded.add(chapterId);
    }
    setExpandedChapters(newExpanded);
  };

  // CHAPTER EDIT FUNCTIONS
  const startEditChapter = (chapterId: string, currentTitle: string, currentIcon: string) => {
    setEditingChapterId(chapterId);
    setEditingChapterTitle(currentTitle);
    setEditingChapterIcon(currentIcon || 'Library');
  };

  const cancelEditChapter = () => {
    setEditingChapterId(null);
    setEditingChapterTitle('');
    setEditingChapterIcon('Library');
  };

  const saveChapter = async (chapterId: string) => {
    if (!editingChapterTitle.trim()) {
      alert('❌ Nama chapter tidak boleh kosong!');
      return;
    }

    setSavingChapter(true);
    try {
      const formData = new FormData();
      formData.append('chapter_title', editingChapterTitle);
      formData.append('icon', editingChapterIcon);

      const response = await fetch(`/api/admin/chapters/${chapterId}`, {
        method: 'PATCH',
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to update');

      alert('✅ Chapter berhasil diupdate!');
      setEditingChapterId(null);
      fetchMaterials();
    } catch (error) {
      alert('❌ Gagal mengupdate chapter');
    } finally {
      setSavingChapter(false);
    }
  };

  // UNIT EDIT FUNCTIONS
  const startEditPosition = (unitId: string, currentName: string, currentIcon: string, currentPosition: number) => {
    setEditingUnitId(unitId);
    setEditingUnitName(currentName);
    setEditingUnitIcon(currentIcon || 'Book');
    setEditingPosition(currentPosition);
  };

  const cancelEditPosition = () => {
    setEditingUnitId(null);
    setEditingUnitName('');
    setEditingUnitIcon('Book');
    setEditingPosition(0);
  };

  const saveUnitPosition = async (unitId: string) => {
    if (!editingUnitName.trim()) {
      alert('❌ Nama unit tidak boleh kosong!');
      return;
    }

    setSavingPosition(true);
    try {
      const formData = new FormData();
      formData.append('unit_name', editingUnitName);
      formData.append('icon', editingUnitIcon);
      formData.append('position', editingPosition.toString());

      const response = await fetch(`/api/admin/units/${unitId}`, {
        method: 'PATCH',
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to update');

      alert('✅ Unit berhasil diupdate!');
      setEditingUnitId(null);
      fetchMaterials();
    } catch (error) {
      alert('❌ Gagal mengupdate unit');
    } finally {
      setSavingPosition(false);
    }
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

  // LESSON EDIT FUNCTIONS
  const startEditLesson = (lessonId: string, currentName: string, currentPosition: number) => {
    setEditingLessonId(lessonId);
    setEditingLessonName(currentName);
    setEditingLessonPosition(currentPosition || 0);
  };

  const cancelEditLesson = () => {
    setEditingLessonId(null);
    setEditingLessonName('');
    setEditingLessonPosition(0);
  };

  const saveLesson = async (lessonId: string) => {
    if (!editingLessonName.trim()) {
      alert('❌ Nama lesson tidak boleh kosong!');
      return;
    }

    setSavingLesson(true);
    try {
      const formData = new FormData();
      formData.append('lesson_name', editingLessonName);
      formData.append('position', editingLessonPosition.toString());

      const response = await fetch(`/api/admin/lessons/${lessonId}`, {
        method: 'PATCH',
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to update');

      alert('✅ Lesson berhasil diupdate!');
      setEditingLessonId(null);
      fetchMaterials();
    } catch (error) {
      alert('❌ Gagal mengupdate lesson');
    } finally {
      setSavingLesson(false);
    }
  };

  // MATERIAL EDIT FUNCTIONS
  const startEditMaterial = (materialId: string, currentTitle: string, currentUrl: string) => {
    setEditingMaterialId(materialId);
    setEditingMaterialTitle(currentTitle);
    setEditingMaterialUrl(currentUrl);
  };

  const cancelEditMaterial = () => {
    setEditingMaterialId(null);
    setEditingMaterialTitle('');
    setEditingMaterialUrl('');
  };

  const saveMaterial = async (materialId: string) => {
    if (!editingMaterialTitle.trim()) {
      alert('❌ Nama material tidak boleh kosong!');
      return;
    }

    if (!editingMaterialUrl.trim()) {
      alert('❌ Link tidak boleh kosong!');
      return;
    }

    setSavingMaterial(true);
    try {
      const formData = new FormData();
      formData.append('title', editingMaterialTitle);
      formData.append('url', editingMaterialUrl);

      const response = await fetch(`/api/admin/materials/${materialId}`, {
        method: 'PATCH',
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to update');

      alert('✅ Material berhasil diupdate!');
      setEditingMaterialId(null);
      fetchMaterials();
    } catch (error) {
      alert('❌ Gagal mengupdate material');
    } finally {
      setSavingMaterial(false);
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

  const chapterGroups = groupByChapterUnitAndLesson();
  const totalMaterials = filteredMaterials.length;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="grid grid-cols-4 gap-4">
        <select value={selectedLevel} onChange={(e) => setSelectedLevel(e.target.value)} className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white">
          <option value="">Semua Level</option>
          {levels.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}
        </select>
        <select value={selectedChapter} onChange={(e) => setSelectedChapter(e.target.value)} className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white">
          <option value="">Semua Chapter</option>
          <option value="ALL">📦 Semua Unit (Tanpa Filter)</option>
          {chapters.map((ch) => <option key={ch.id} value={ch.id}>{ch.chapter_title}</option>)}
        </select>
        <select value={selectedUnit} onChange={(e) => setSelectedUnit(e.target.value)} className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white">
          <option value="">Semua Unit</option>
          {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.unit_name}</option>)}
        </select>
        <select value={selectedLesson} onChange={(e) => setSelectedLesson(e.target.value)} className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white">
          <option value="">Semua Lesson</option>
          {lessons.map((lesson) => <option key={lesson.id} value={lesson.id}>{lesson.lesson_name}</option>)}
        </select>
      </div>

      <div className="text-lg font-semibold text-gray-900">{totalMaterials} Materi</div>

      {/* Material List Grouped by Chapter → Unit → Lesson */}
      <div className="space-y-4">
        {Object.values(chapterGroups).map((chapterGroup) => {
          const ChapterIcon = getIconComponent(chapterGroup.chapterIcon);
          const isEditingChapter = editingChapterId === chapterGroup.chapterId;

          return (
            <div key={chapterGroup.chapterId} className="bg-white rounded-xl border-2 border-[#5C4FE5] overflow-hidden">
              {/* Chapter Header */}
              {!isEditingChapter ? (
                <div className="w-full px-6 py-4 flex items-center justify-between hover:bg-purple-50 transition-colors bg-gradient-to-r from-purple-50 to-white">
                  <button onClick={() => toggleChapter(chapterGroup.chapterId)} className="flex items-center gap-3">
                    {expandedChapters.has(chapterGroup.chapterId) ? <ChevronDown className="w-6 h-6 text-[#5C4FE5]" /> : <ChevronRight className="w-6 h-6 text-[#5C4FE5]" />}
                    <ChapterIcon className="w-6 h-6 text-[#5C4FE5]" />
                    <span className="text-xl font-bold text-[#5C4FE5]">{chapterGroup.chapterTitle}</span>
                  </button>
                  <div className="flex items-center gap-3">
                    <button onClick={() => startEditChapter(chapterGroup.chapterId, chapterGroup.chapterTitle, chapterGroup.chapterIcon)} className="p-2 text-gray-600 hover:bg-white rounded-lg transition-colors" title="Edit chapter">
                      <Edit className="w-4 h-4" />
                    </button>
                    <span className="text-sm text-gray-600 font-semibold">{Object.keys(chapterGroup.units).length} unit</span>
                  </div>
                </div>
              ) : (
                <div className="w-full px-6 py-4 bg-gradient-to-r from-purple-50 to-white">
                  <div className="flex items-center gap-3">
                    <input type="text" value={editingChapterTitle} onChange={(e) => setEditingChapterTitle(e.target.value)} placeholder="Nama Chapter" className="flex-1 px-3 py-2 border-2 border-[#5C4FE5] rounded-lg text-lg font-bold focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900" />
                    <select value={editingChapterIcon} onChange={(e) => setEditingChapterIcon(e.target.value)} className="px-3 py-2 border-2 border-[#5C4FE5] rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900 font-semibold">
                      {ICON_OPTIONS.map(opt => {
                        const Icon = opt.Component;
                        return <option key={opt.value} value={opt.value}>{opt.label}</option>;
                      })}
                    </select>
                    <div className="flex gap-2">
                      {ICON_OPTIONS.slice(0, 6).map(opt => {
                        const Icon = opt.Component;
                        return (
                          <button key={opt.value} onClick={() => setEditingChapterIcon(opt.value)} className={`p-2 rounded-lg transition-all ${editingChapterIcon === opt.value ? 'bg-[#5C4FE5] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`} title={opt.label}>
                            <Icon className="w-5 h-5" />
                          </button>
                        );
                      })}
                    </div>
                    <button onClick={() => saveChapter(chapterGroup.chapterId)} disabled={savingChapter} className="px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white font-bold rounded-lg hover:from-green-600 hover:to-green-700 shadow-lg hover:shadow-xl transition-all disabled:opacity-50">
                      {savingChapter ? 'Saving...' : 'UPDATE'}
                    </button>
                    <button onClick={cancelEditChapter} disabled={savingChapter} className="px-4 py-2 bg-gray-500 text-white font-semibold rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50">CANCEL</button>
                  </div>
                </div>
              )}

              {/* Units under this chapter */}
              {expandedChapters.has(chapterGroup.chapterId) && (
                <div className="border-t-2 border-[#5C4FE5]">
                  {Object.values(chapterGroup.units).map((unitGroup) => {
                    const UnitIcon = getIconComponent(unitGroup.unitIcon);
                    const isEditingUnit = editingUnitId === unitGroup.unitId;

                    return (
                      <div key={unitGroup.unitId} className="border-b-2 border-gray-200 last:border-b-0">
                        {/* Unit Header */}
                        <div className="px-8 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors bg-gray-50">
                          <div className="flex items-center gap-3 flex-1">
                            {!isEditingUnit ? (
                              <>
                                <button onClick={() => toggleUnit(unitGroup.unitId)} className="flex items-center gap-3">
                                  {expandedUnits.has(unitGroup.unitId) ? <ChevronDown className="w-5 h-5 text-gray-600" /> : <ChevronRight className="w-5 h-5 text-gray-600" />}
                                  <UnitIcon className="w-5 h-5 text-[#5C4FE5]" />
                                  <span className="text-lg font-semibold text-gray-900">{unitGroup.unitName}</span>
                                </button>
                                <div className="flex items-center gap-2 ml-4">
                                  <span className="text-sm text-gray-600">Urutan: <span className="font-semibold">{unitGroup.unitPosition || 0}</span></span>
                                  <button onClick={() => startEditPosition(unitGroup.unitId, unitGroup.unitName, unitGroup.unitIcon, unitGroup.unitPosition || 0)} className="p-1.5 text-gray-600 hover:bg-gray-100 rounded transition-colors" title="Edit nama, icon & urutan">
                                    <Edit className="w-4 h-4" />
                                  </button>
                                </div>
                              </>
                            ) : (
                              <div className="flex items-center gap-3 flex-1">
                                <input type="text" value={editingUnitName} onChange={(e) => setEditingUnitName(e.target.value)} placeholder="Nama Unit" className="flex-1 px-3 py-1.5 border-2 border-[#5C4FE5] rounded text-base font-semibold focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900 placeholder-gray-400" />
                                <select value={editingUnitIcon} onChange={(e) => setEditingUnitIcon(e.target.value)} className="px-2 py-1.5 border-2 border-[#5C4FE5] rounded focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900 text-sm font-semibold">
                                  {ICON_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                </select>
                                <div className="flex gap-1">
                                  {ICON_OPTIONS.slice(0, 4).map(opt => {
                                    const Icon = opt.Component;
                                    return (
                                      <button key={opt.value} onClick={() => setEditingUnitIcon(opt.value)} className={`p-1.5 rounded transition-all ${editingUnitIcon === opt.value ? 'bg-[#5C4FE5] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`} title={opt.label}>
                                        <Icon className="w-4 h-4" />
                                      </button>
                                    );
                                  })}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-gray-600">Urutan:</span>
                                  <input type="number" value={editingPosition} onChange={(e) => setEditingPosition(parseInt(e.target.value) || 0)} min="0" className="w-20 px-2 py-1 border-2 border-[#5C4FE5] rounded text-sm font-semibold focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900" />
                                </div>
                                <button onClick={() => saveUnitPosition(unitGroup.unitId)} disabled={savingPosition} className="px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white font-bold rounded-lg hover:from-green-600 hover:to-green-700 shadow-lg hover:shadow-xl transition-all disabled:opacity-50">
                                  {savingPosition ? 'Saving...' : 'UPDATE'}
                                </button>
                                <button onClick={cancelEditPosition} disabled={savingPosition} className="px-4 py-2 bg-gray-500 text-white font-semibold rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50">CANCEL</button>
                              </div>
                            )}
                          </div>
                          {!isEditingUnit && <span className="text-sm text-gray-600">{Object.keys(unitGroup.lessons).length} lesson</span>}
                        </div>

                        {/* Lessons under this unit */}
                        {expandedUnits.has(unitGroup.unitId) && (
                          <div className="bg-white">
                            {Object.values(unitGroup.lessons).sort((a, b) => {
                              const posA = a.materials[0]?.position || 0;
                              const posB = b.materials[0]?.position || 0;
                              return posA - posB;
                            }).map((lessonGroup) => {
                              if (lessonGroup.materials.length === 0) return null;
                              
                              const lessonPosition = lessonGroup.materials[0]?.position || 0;
                              const isEditingLesson = editingLessonId === lessonGroup.lessonId;

                              return (
                                <div key={lessonGroup.lessonId} className="border-b border-gray-200 last:border-b-0">
                                  {/* LESSON HEADER */}
                                  {!isEditingLesson ? (
                                    <div className="px-6 py-2.5 flex items-center justify-between hover:bg-gray-50 transition-colors bg-gray-50">
                                      <div className="flex items-center gap-3">
                                        <FileCheck className="w-5 h-5 text-[#5C4FE5]" />
                                        <span className="text-sm font-bold text-gray-900">{lessonGroup.lessonName}</span>
                                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-semibold rounded">
                                          Urutan: {lessonPosition}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <button
                                          onClick={() => startEditLesson(lessonGroup.lessonId, lessonGroup.lessonName, lessonPosition)}
                                          className="p-1.5 text-gray-600 hover:bg-white rounded transition-colors"
                                          title="Edit lesson"
                                        >
                                          <Edit className="w-4 h-4" />
                                        </button>
                                        <span className="text-xs text-gray-600">{lessonGroup.materials.length} material</span>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="px-6 py-3 bg-purple-50">
                                      <div className="flex items-center gap-3">
                                        <input
                                          type="text"
                                          value={editingLessonName}
                                          onChange={(e) => setEditingLessonName(e.target.value)}
                                          placeholder="Nama Lesson"
                                          className="flex-1 px-3 py-2 border-2 border-[#5C4FE5] rounded text-sm font-bold focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900"
                                        />
                                        <div className="flex items-center gap-2">
                                          <span className="text-sm text-gray-700 font-semibold">Urutan:</span>
                                          <input
                                            type="number"
                                            value={editingLessonPosition}
                                            onChange={(e) => setEditingLessonPosition(parseInt(e.target.value) || 0)}
                                            min="0"
                                            className="w-20 px-2 py-2 border-2 border-[#5C4FE5] rounded text-sm font-bold focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900"
                                          />
                                        </div>
                                        <button
                                          onClick={() => saveLesson(lessonGroup.lessonId)}
                                          disabled={savingLesson}
                                          className="px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white font-bold rounded-lg hover:from-green-600 hover:to-green-700 shadow-lg hover:shadow-xl transition-all disabled:opacity-50 text-sm"
                                        >
                                          {savingLesson ? 'Saving...' : 'UPDATE'}
                                        </button>
                                        <button
                                          onClick={cancelEditLesson}
                                          disabled={savingLesson}
                                          className="px-4 py-2 bg-gray-500 text-white font-semibold rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 text-sm"
                                        >
                                          CANCEL
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                  {/* MATERIALS UNDER THIS LESSON */}
                                  {!isEditingLesson && (
                                    <div className="pl-8">
                                      {lessonGroup.materials.map((material) => {
                                        const isEditingMaterial = editingMaterialId === material.id;
                                        const materialUrl = getContentUrl(material);

                                        return isEditingMaterial ? (
                                          <div key={material.id} className="px-6 py-3 bg-blue-50 border-b border-gray-100">
                                            <div className="flex items-center gap-3">
                                              <div className="text-gray-400">{getCategoryIcon(material.category)}</div>
                                              <input
                                                type="text"
                                                value={editingMaterialTitle}
                                                onChange={(e) => setEditingMaterialTitle(e.target.value)}
                                                placeholder="Nama material (contoh: Live Zoom, Live GMeet)"
                                                className="w-64 px-3 py-2 border-2 border-blue-500 rounded text-sm font-semibold focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                                              />
                                              <input
                                                type="url"
                                                value={editingMaterialUrl}
                                                onChange={(e) => setEditingMaterialUrl(e.target.value)}
                                                placeholder="https://zoom.us/... atau https://meet.google.com/..."
                                                className="flex-1 px-3 py-2 border-2 border-blue-500 rounded text-sm focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                                              />
                                              <button
                                                onClick={() => saveMaterial(material.id)}
                                                disabled={savingMaterial}
                                                className="px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white font-bold rounded-lg hover:from-green-600 hover:to-green-700 shadow-lg hover:shadow-xl transition-all disabled:opacity-50 text-sm"
                                              >
                                                {savingMaterial ? 'Saving...' : 'UPDATE'}
                                              </button>
                                              <button
                                                onClick={cancelEditMaterial}
                                                disabled={savingMaterial}
                                                className="px-4 py-2 bg-gray-500 text-white font-semibold rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 text-sm"
                                              >
                                                CANCEL
                                              </button>
                                            </div>
                                          </div>
                                        ) : (
                                          <div key={material.id} className="px-6 py-2.5 flex items-center justify-between hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0">
                                            <div className="flex items-center gap-3">
                                              <div className="text-gray-400">{getCategoryIcon(material.category)}</div>
                                              <span className="text-sm font-semibold text-gray-700">{material.title}</span>
                                              {material.is_published && (
                                                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded">Published</span>
                                              )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                              {(material.category === 'live_zoom' || material.category === 'kosakata') && (
                                                <a
                                                  href={materialUrl}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                  title="Buka link"
                                                >
                                                  <ExternalLink className="w-4 h-4" />
                                                </a>
                                              )}
                                              <button
                                                onClick={() => startEditMaterial(material.id, material.title, materialUrl)}
                                                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                                title="Edit material"
                                              >
                                                <Edit className="w-4 h-4" />
                                              </button>
                                              <button
                                                onClick={() => handleDelete(material.id)}
                                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Hapus material"
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
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {totalMaterials === 0 && (
        <div className="text-center py-12 text-gray-500">
          Belum ada materi. Klik "Tambah Materi" untuk membuat materi baru.
        </div>
      )}
    </div>
  );
}
