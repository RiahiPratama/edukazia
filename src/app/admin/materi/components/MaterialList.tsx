'use client';

import { useState, useEffect, useRef } from 'react';
import { BookOpen, Video, FileText, Headphones, Trash2, Edit, ExternalLink, ChevronDown, ChevronRight, Library, Book, FileCheck, GraduationCap, Award, Star, Target, Lightbulb, Brain, Bookmark, BookMarked, Layers, Upload, LayoutList, FileImage, Loader2, Eye, EyeOff, MoreVertical, ArrowUpDown, FolderOutput } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import MoveChapterModal from './MoveChapterModal';
import MoveUnitModal from './MoveUnitModal';
import ReorderPanel from './ReorderPanel';

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

// ✅ Type diperbarui — sesuai schema DB terbaru
type MaterialWithHierarchy = {
  id: string;
  title: string;
  category: string;
  position: number;
  is_published: boolean;
  material_contents?: {
    content_url: string | null;
    storage_bucket: string | null;
    storage_path: string | null;
    canva_url?: string | null;
    slides_url?: string | null;
    student_content_url?: string | null;
  }[];
  created_at: string;
  lesson_id: string;
  lesson_name: string;
  lesson_position: number;
  unit_id: string;
  unit_name: string;
  unit_position: number;
  unit_icon: string | null;
  chapter_id: string | null;
  chapter_title: string | null;
  chapter_icon: string | null;
  chapter_order: number;
  level_id: string;
  level_name: string;
  level_sort_order: number;
};

type Level = { id: string; name: string; };
type Chapter = { id: string; chapter_title: string; };
type Unit = { id: string; unit_name: string; };
type Lesson = { id: string; lesson_name: string; };

type MaterialListProps = {
  category: 'live_zoom' | 'bacaan' | 'kosakata' | 'cefr';
  onEdit?: (material: any) => void;
  onEditContent?: (lessonId: string, lessonName: string) => void;
};

// ✅ Dropdown Menu Component — reusable untuk chapter & unit
function DropdownMenu({ items, onClose }: { items: { label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean }[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  return (
    <div ref={ref} className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-40 min-w-[200px]">
      {items.map((item, i) => (
        <button
          key={i}
          onClick={() => { item.onClick(); onClose(); }}
          className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2.5 hover:bg-gray-50 transition-colors ${
            item.danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700'
          }`}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
}

export default function MaterialList({ category, onEdit, onEditContent }: MaterialListProps) {
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

  // Material edit states (URL-based)
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [editingMaterialTitle, setEditingMaterialTitle] = useState<string>('');
  const [editingMaterialUrl, setEditingMaterialUrl] = useState<string>('');
  const [editingCanvaUrl, setEditingCanvaUrl] = useState<string>('');
  const [editingStudentUrl, setEditingStudentUrl] = useState<string>('');
  const [editingSlidesUrl, setEditingSlidesUrl] = useState<string>('');
  const [savingMaterial, setSavingMaterial] = useState(false);

  // File replacement states (bacaan & cefr)
  const [replacingFileId, setReplacingFileId] = useState<string | null>(null);
  const [replacingFile, setReplacingFile] = useState<File | null>(null);
  const [savingFile, setSavingFile] = useState(false);

  // PDF Convert states
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [convertProgress, setConvertProgress] = useState<string>('');

  // ✅ NEW: Dropdown menu state
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // ✅ NEW: Modal states for structure management
  const [moveChapterData, setMoveChapterData] = useState<{
    chapterId: string; chapterTitle: string; currentLevelId: string;
    currentLevelName: string; unitCount: number; lessonCount: number;
  } | null>(null);

  const [moveUnitData, setMoveUnitData] = useState<{
    unitId: string; unitName: string; currentChapterId: string;
    currentChapterTitle: string; currentLevelName: string; lessonCount: number;
  } | null>(null);

  const [reorderData, setReorderData] = useState<{
    mode: 'units' | 'lessons'; parentId: string; parentName: string; parentBadge?: string;
  } | null>(null);

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
        .select(`
          id, title, category, position, is_published, created_at, lesson_id,
          material_contents (
            content_url,
            storage_bucket,
            storage_path,
            canva_url,
            slides_url,
            student_content_url
          )
        `)
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
        .select('id, lesson_name, unit_id, position')
        .in('id', lessonIds)
        .order('position', { ascending: true });

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
        .select('id, chapter_title, icon, order_number')
        .in('id', chapterIds)
        .order('order_number', { ascending: true });

      const { data: levelsData } = await supabase
        .from('levels')
        .select('id, name, sort_order')
        .in('id', levelIds)
        .order('sort_order', { ascending: true });

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
          material_contents: material.material_contents,
          created_at: material.created_at,
          lesson_id: material.lesson_id,
          lesson_name: lesson?.lesson_name || 'Unknown Lesson',
          lesson_position: lesson?.position || 0,
          unit_id: lesson?.unit_id || '',
          unit_name: unit?.unit_name || 'Unknown Unit',
          unit_position: unit?.position || 0,
          unit_icon: unit?.icon || null,
          chapter_id: unit?.chapter_id || null,
          chapter_title: chapter?.chapter_title || null,
          chapter_icon: chapter?.icon || null,
          chapter_order: chapter?.order_number || 0,
          level_id: unit?.level_id || '',
          level_name: level?.name || 'Unknown Level',
          level_sort_order: level?.sort_order || 0,
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
        chapterOrder: number;
        levelId: string;
        levelName: string;
        levelSortOrder: number;
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
                lessonPosition: number;
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
          chapterOrder: material.chapter_order || 0,
          levelId: material.level_id || '',
          levelName: material.level_name || '',
          levelSortOrder: material.level_sort_order || 0,
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
          lessonPosition: material.lesson_position || 0,
          materials: []
        };
      }

      chapterGroups[chapterId].units[unitId].lessons[lessonId].materials.push(material);
    });

    return chapterGroups;
  };

  const toggleUnit = (unitId: string) => {
    const newExpanded = new Set(expandedUnits);
    if (newExpanded.has(unitId)) newExpanded.delete(unitId);
    else newExpanded.add(unitId);
    setExpandedUnits(newExpanded);
  };

  const toggleChapter = (chapterId: string) => {
    const newExpanded = new Set(expandedChapters);
    if (newExpanded.has(chapterId)) newExpanded.delete(chapterId);
    else newExpanded.add(chapterId);
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
      const response = await fetch(`/api/admin/materials/${materialId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete');
      alert('✅ Material berhasil dihapus!');
      fetchMaterials();
    } catch (error) {
      alert('❌ Gagal menghapus material');
    }
  };

  const handleTogglePublish = async (materialId: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/admin/materials/${materialId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_published: !currentStatus }),
      });
      if (!response.ok) throw new Error();
      fetchMaterials();
    } catch {
      alert('❌ Gagal mengubah status publish');
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

  // PDF CONVERT FUNCTION
  const convertPDF = async (materialId: string, pdfFile: File) => {
    setConvertingId(materialId);
    setConvertProgress('Mengupload PDF...');
    try {
      const formData = new FormData();
      formData.append('pdf', pdfFile);
      formData.append('material_id', materialId);

      setConvertProgress('Mengkonversi halaman...');
      const res = await fetch('/api/admin/materials/pdf-convert', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details || data.error);

      alert(`✅ ${data.message}`);
      fetchMaterials();
    } catch (err) {
      alert(`❌ Gagal convert: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setConvertingId(null);
      setConvertProgress('');
    }
  };

  // MATERIAL EDIT FUNCTIONS
  const startEditMaterial = (materialId: string, currentTitle: string, currentUrl: string, category: string, canvaUrl?: string, slidesUrl?: string) => {
    setEditingMaterialId(materialId);
    const detectedTitle = detectPlatformFromUrl(currentUrl, category);
    setEditingMaterialTitle(detectedTitle);
    setEditingMaterialUrl(currentUrl);
    setEditingCanvaUrl(canvaUrl || '');
    setEditingStudentUrl('');
    setEditingSlidesUrl(slidesUrl || '');
  };

  const cancelEditMaterial = () => {
    setEditingMaterialId(null);
    setEditingMaterialTitle('');
    setEditingMaterialUrl('');
    setEditingCanvaUrl('');
    setEditingStudentUrl('');
    setEditingSlidesUrl('');
  };

  const saveMaterial = async (materialId: string, category: string) => {
    const autoTitle = detectPlatformFromUrl(editingCanvaUrl || editingMaterialUrl || editingSlidesUrl, category);

    setSavingMaterial(true);
    try {
      const formData = new FormData();
      formData.append('title', autoTitle);
      formData.append('url', editingCanvaUrl || editingMaterialUrl || '');
      formData.append('canva_url', editingCanvaUrl);
      formData.append('student_content_url', editingStudentUrl || '');
      formData.append('slides_url', editingSlidesUrl);

      const response = await fetch(`/api/admin/materials/${materialId}`, {
        method: 'PATCH',
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to update');

      alert('✅ Material berhasil diupdate!');
      cancelEditMaterial();
      fetchMaterials();
    } catch (error) {
      alert('❌ Gagal mengupdate material');
    } finally {
      setSavingMaterial(false);
    }
  };

  // ✅ Ganti file untuk bacaan & cefr
  const startReplaceFile = (materialId: string) => {
    setReplacingFileId(materialId);
    setReplacingFile(null);
  };

  const cancelReplaceFile = () => {
    setReplacingFileId(null);
    setReplacingFile(null);
  };

  const saveReplaceFile = async (material: MaterialWithHierarchy) => {
    if (!replacingFile) {
      alert('❌ Pilih file terlebih dahulu!');
      return;
    }

    setSavingFile(true);
    try {
      const mc = material.material_contents?.[0];
      if (!mc?.storage_bucket) throw new Error('Storage bucket tidak ditemukan');

      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(7);
      const ext = replacingFile.name.split('.').pop()?.toLowerCase() || 'jsx';
      const folder = material.category === 'bacaan' ? 'bacaan' : 'cefr';
      const newPath = `${folder}/${timestamp}-${random}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(mc.storage_bucket)
        .upload(newPath, replacingFile);

      if (uploadError) throw new Error(uploadError.message);

      if (mc.storage_path) {
        await supabase.storage.from(mc.storage_bucket).remove([mc.storage_path]);
      }

      const { error: updateError } = await supabase
        .from('material_contents')
        .update({ storage_path: newPath })
        .eq('material_id', material.id);

      if (updateError) throw new Error(updateError.message);

      alert('✅ File berhasil diganti!');
      setReplacingFileId(null);
      setReplacingFile(null);
      fetchMaterials();
    } catch (error) {
      alert(`❌ Gagal ganti file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSavingFile(false);
    }
  };

  // Platform detection helper
  const detectPlatformFromUrl = (url: string, category: string): string => {
    if (!url) return category === 'live_zoom' ? 'Live Class' : 'Kosakata';
    const urlLower = url.toLowerCase();
    if (urlLower.includes('zoom.us') || urlLower.includes('zoom.com')) return 'Live Zoom';
    if (urlLower.includes('meet.google.com') || urlLower.includes('meet.app.goo.gl')) return 'Live GMeet';
    if (urlLower.includes('teams.microsoft.com') || urlLower.includes('teams.live.com')) return 'Live MS Teams';
    if (urlLower.includes('webex.com')) return 'Live Webex';
    if (urlLower.includes('canva.com')) return 'Kosakata Canva';
    if (urlLower.includes('docs.google.com') || urlLower.includes('drive.google.com')) return 'Kosakata GDocs';
    if (urlLower.includes('figma.com')) return 'Kosakata Figma';
    return category === 'live_zoom' ? 'Live Class' : 'Kosakata';
  };

  const getExternalUrl = (material: MaterialWithHierarchy): string => {
    const contentUrl = material.material_contents?.[0]?.content_url;
    if (contentUrl && contentUrl.startsWith('http')) return contentUrl;
    return '#';
  };

  const getStorageUrl = (material: MaterialWithHierarchy): string => {
    const mc = material.material_contents?.[0];
    if (!mc?.storage_bucket || !mc?.storage_path) return '#';
    const { data } = supabase.storage.from(mc.storage_bucket).getPublicUrl(mc.storage_path);
    return data.publicUrl;
  };

  const getMaterialDisplayName = (material: MaterialWithHierarchy): string => {
    if (material.category === 'bacaan' || material.category === 'cefr') return material.title || 'Bacaan';
    return detectPlatformFromUrl(getExternalUrl(material), material.category);
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

  // ✅ NEW: Helper to count total lessons in a chapter group
  const countChapterLessons = (chapterGroup: any): number => {
    let total = 0;
    Object.values(chapterGroup.units).forEach((unitGroup: any) => {
      total += Object.keys(unitGroup.lessons).length;
    });
    return total;
  };

  // ✅ NEW: Handle structure management success — refresh materials
  const handleStructureSuccess = () => {
    setMoveChapterData(null);
    setMoveUnitData(null);
    setReorderData(null);
    fetchMaterials();
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
        <button onClick={() => fetchMaterials()} className="mt-4 px-4 py-2 bg-[#5C4FE5] text-white rounded-lg hover:bg-[#4a3ec7]">
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
        {Object.values(chapterGroups)
          .sort((a, b) => {
            if (a.levelSortOrder !== b.levelSortOrder) return a.levelSortOrder - b.levelSortOrder
            return (a.chapterOrder || 0) - (b.chapterOrder || 0)
          })
          .map((chapterGroup) => {
          const ChapterIcon = getIconComponent(chapterGroup.chapterIcon);
          const isEditingChapter = editingChapterId === chapterGroup.chapterId;
          const unitCount = Object.keys(chapterGroup.units).length;
          const lessonCount = countChapterLessons(chapterGroup);

          return (
            <div key={chapterGroup.chapterId} className="bg-white rounded-xl border-2 border-[#5C4FE5] overflow-hidden">
              {/* Chapter Header */}
              {!isEditingChapter ? (
                <div className="w-full px-6 py-4 flex items-center justify-between hover:bg-purple-50 transition-colors bg-gradient-to-r from-purple-50 to-white">
                  <button onClick={() => toggleChapter(chapterGroup.chapterId)} className="flex items-center gap-3">
                    {expandedChapters.has(chapterGroup.chapterId) ? <ChevronDown className="w-6 h-6 text-[#5C4FE5]" /> : <ChevronRight className="w-6 h-6 text-[#5C4FE5]" />}
                    <ChapterIcon className="w-6 h-6 text-[#5C4FE5]" />
                    <div className="flex flex-col items-start">
                      {chapterGroup.levelName && (
                        <span className="text-xs font-semibold text-[#7B78A8] leading-none mb-0.5">{chapterGroup.levelName}</span>
                      )}
                      <span className="text-xl font-bold text-[#5C4FE5]">{chapterGroup.chapterTitle}</span>
                    </div>
                  </button>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 font-semibold">{unitCount} unit</span>
                    {/* ✅ NEW: ⋯ Dropdown Menu for Chapter */}
                    <div className="relative">
                      <button
                        onClick={() => setOpenDropdown(openDropdown === `ch-${chapterGroup.chapterId}` ? null : `ch-${chapterGroup.chapterId}`)}
                        className="p-2 text-gray-500 hover:bg-white hover:text-gray-700 rounded-lg transition-colors"
                        title="Opsi chapter"
                      >
                        <MoreVertical className="w-5 h-5" />
                      </button>
                      {openDropdown === `ch-${chapterGroup.chapterId}` && (
                        <DropdownMenu
                          onClose={() => setOpenDropdown(null)}
                          items={[
                            {
                              label: 'Rename chapter',
                              icon: <Edit className="w-4 h-4" />,
                              onClick: () => startEditChapter(chapterGroup.chapterId, chapterGroup.chapterTitle, chapterGroup.chapterIcon),
                            },
                            {
                              label: 'Reorder unit',
                              icon: <ArrowUpDown className="w-4 h-4" />,
                              onClick: () => setReorderData({
                                mode: 'units',
                                parentId: chapterGroup.chapterId,
                                parentName: chapterGroup.chapterTitle,
                                parentBadge: chapterGroup.levelName,
                              }),
                            },
                            {
                              label: 'Pindah ke level lain',
                              icon: <FolderOutput className="w-4 h-4" />,
                              onClick: () => setMoveChapterData({
                                chapterId: chapterGroup.chapterId,
                                chapterTitle: chapterGroup.chapterTitle,
                                currentLevelId: chapterGroup.levelId,
                                currentLevelName: chapterGroup.levelName,
                                unitCount,
                                lessonCount,
                              }),
                            },
                          ]}
                        />
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="w-full px-6 py-4 bg-gradient-to-r from-purple-50 to-white">
                  <div className="flex items-center gap-3">
                    <input type="text" value={editingChapterTitle} onChange={(e) => setEditingChapterTitle(e.target.value)} placeholder="Nama Chapter" className="flex-1 px-3 py-2 border-2 border-[#5C4FE5] rounded-lg text-lg font-bold focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900" />
                    <select value={editingChapterIcon} onChange={(e) => setEditingChapterIcon(e.target.value)} className="px-3 py-2 border-2 border-[#5C4FE5] rounded-lg focus:ring-2 focus:ring-[#5C4FE5] bg-white text-gray-900 font-semibold">
                      {ICON_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
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
                  {Object.values(chapterGroup.units)
                    .sort((a, b) => {
                      const posDiff = (a.unitPosition || 0) - (b.unitPosition || 0);
                      if (posDiff !== 0) return posDiff;
                      return a.unitName.localeCompare(b.unitName);
                    })
                    .map((unitGroup) => {
                    const UnitIcon = getIconComponent(unitGroup.unitIcon);
                    const isEditingUnit = editingUnitId === unitGroup.unitId;
                    const unitLessonCount = Object.keys(unitGroup.lessons).length;

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
                                <span className="text-sm text-gray-500 ml-2">Urutan: <span className="font-semibold">{unitGroup.unitPosition || 0}</span></span>
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
                          {!isEditingUnit && (
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-600">{unitLessonCount} lesson</span>
                              {/* ✅ NEW: ⋯ Dropdown Menu for Unit */}
                              <div className="relative">
                                <button
                                  onClick={() => setOpenDropdown(openDropdown === `un-${unitGroup.unitId}` ? null : `un-${unitGroup.unitId}`)}
                                  className="p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 rounded-lg transition-colors"
                                  title="Opsi unit"
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </button>
                                {openDropdown === `un-${unitGroup.unitId}` && (
                                  <DropdownMenu
                                    onClose={() => setOpenDropdown(null)}
                                    items={[
                                      {
                                        label: 'Rename unit',
                                        icon: <Edit className="w-4 h-4" />,
                                        onClick: () => startEditPosition(unitGroup.unitId, unitGroup.unitName, unitGroup.unitIcon, unitGroup.unitPosition || 0),
                                      },
                                      {
                                        label: 'Reorder lesson',
                                        icon: <ArrowUpDown className="w-4 h-4" />,
                                        onClick: () => setReorderData({
                                          mode: 'lessons',
                                          parentId: unitGroup.unitId,
                                          parentName: unitGroup.unitName,
                                          parentBadge: chapterGroup.chapterTitle,
                                        }),
                                      },
                                      {
                                        label: 'Pindah ke chapter lain',
                                        icon: <FolderOutput className="w-4 h-4" />,
                                        onClick: () => setMoveUnitData({
                                          unitId: unitGroup.unitId,
                                          unitName: unitGroup.unitName,
                                          currentChapterId: chapterGroup.chapterId,
                                          currentChapterTitle: chapterGroup.chapterTitle,
                                          currentLevelName: chapterGroup.levelName,
                                          lessonCount: unitLessonCount,
                                        }),
                                      },
                                    ]}
                                  />
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Lessons under this unit */}
                        {expandedUnits.has(unitGroup.unitId) && (
                          <div className="bg-white">
                            {Object.values(unitGroup.lessons)
                              .sort((a, b) => {
                                const posDiff = (a.lessonPosition || 0) - (b.lessonPosition || 0);
                                if (posDiff !== 0) return posDiff;
                                return a.lessonName.localeCompare(b.lessonName);
                              })
                              .map((lessonGroup) => {
                              if (lessonGroup.materials.length === 0) return null;
                              
                              const lessonPosition = lessonGroup.lessonPosition || 0;
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
                                        const isUrlBased = material.category === 'live_zoom' || material.category === 'kosakata';
                                        const materialUrl = isUrlBased ? getExternalUrl(material) : getStorageUrl(material);
                                        const isReplacingFile = replacingFileId === material.id;

                                        return isReplacingFile ? (
                                          <div key={material.id} className="px-6 py-3 bg-orange-50 border-b border-gray-100">
                                            <div className="flex items-center gap-3">
                                              <div className="text-gray-400">{getCategoryIcon(material.category)}</div>
                                              <span className="text-sm font-semibold text-gray-700">{getMaterialDisplayName(material)}</span>
                                              <label className="flex items-center gap-2 px-3 py-2 border-2 border-dashed border-orange-400 rounded-lg cursor-pointer hover:bg-orange-100 transition-colors">
                                                <Upload className="w-4 h-4 text-orange-600" />
                                                <span className="text-sm text-orange-700 font-medium">
                                                  {replacingFile ? replacingFile.name : 'Pilih file baru (.jsx)'}
                                                </span>
                                                <input type="file" accept=".jsx,.tsx" className="hidden" onChange={(e) => setReplacingFile(e.target.files?.[0] || null)} />
                                              </label>
                                              <button onClick={() => saveReplaceFile(material)} disabled={savingFile || !replacingFile}
                                                className="px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white font-bold rounded-lg hover:from-green-600 hover:to-green-700 shadow-lg transition-all disabled:opacity-50 text-sm">
                                                {savingFile ? 'Mengupload...' : 'GANTI'}
                                              </button>
                                              <button onClick={cancelReplaceFile} disabled={savingFile}
                                                className="px-4 py-2 bg-gray-500 text-white font-semibold rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 text-sm">
                                                CANCEL
                                              </button>
                                            </div>
                                          </div>
                                        ) : isEditingMaterial ? (
                                          <div key={material.id} className="px-6 py-4 bg-blue-50 border-b border-gray-100">
                                            <div className="space-y-3">
                                              {material.category === 'live_zoom' ? (
                                                <>
                                                  <div className="flex items-center gap-2">
                                                    <div className="text-gray-400">{getCategoryIcon(material.category)}</div>
                                                    <span className="text-sm font-bold text-gray-700">Edit Konten Live Zoom</span>
                                                  </div>
                                                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 space-y-1">
                                                    <label className="text-xs font-bold text-orange-700">🎨 Canva URL (Owner)</label>
                                                    <input type="url" value={editingCanvaUrl} onChange={e => setEditingCanvaUrl(e.target.value)}
                                                      placeholder="https://canva.link/..." className="w-full px-3 py-2 border border-orange-300 rounded text-sm bg-white text-gray-900 focus:ring-1 focus:ring-orange-400" />
                                                  </div>
                                                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1">
                                                    <label className="text-xs font-bold text-blue-700">📄 Konten Siswa – Google Drive PDF</label>
                                                    <input type="url" value={editingStudentUrl} onChange={e => setEditingStudentUrl(e.target.value)}
                                                      placeholder="https://drive.google.com/file/d/..." className="w-full px-2 py-1.5 border border-blue-300 rounded text-sm bg-white text-gray-900 focus:ring-1 focus:ring-blue-400" />
                                                  </div>
                                                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-1">
                                                    <label className="text-xs font-bold text-green-700">📊 Google Slides (Freelancer & B2B)</label>
                                                    <input type="url" value={editingSlidesUrl} onChange={e => setEditingSlidesUrl(e.target.value)}
                                                      placeholder="https://docs.google.com/presentation/d/..." className="w-full px-3 py-2 border border-green-300 rounded text-sm bg-white text-gray-900 focus:ring-1 focus:ring-green-400" />
                                                  </div>
                                                </>
                                              ) : (
                                                <div className="flex items-center gap-3">
                                                  <div className="text-gray-400">{getCategoryIcon(material.category)}</div>
                                                  <input type="url" value={editingMaterialUrl}
                                                    onChange={e => { setEditingMaterialUrl(e.target.value); setEditingMaterialTitle(detectPlatformFromUrl(e.target.value, material.category)); }}
                                                    placeholder="https://..." className="flex-1 px-3 py-2 border-2 border-blue-500 rounded text-sm focus:ring-2 focus:ring-blue-500 bg-white text-gray-900" />
                                                </div>
                                              )}
                                              <div className="flex gap-2 justify-end">
                                                <button onClick={cancelEditMaterial} disabled={savingMaterial}
                                                  className="px-4 py-2 bg-gray-500 text-white font-semibold rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 text-sm">
                                                  CANCEL
                                                </button>
                                                <button onClick={() => saveMaterial(material.id, material.category)} disabled={savingMaterial}
                                                  className="px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white font-bold rounded-lg hover:from-green-600 hover:to-green-700 shadow-lg transition-all disabled:opacity-50 text-sm">
                                                  {savingMaterial ? 'Saving...' : 'UPDATE'}
                                                </button>
                                              </div>
                                            </div>
                                          </div>
                                        ) : (
                                          <div key={material.id} className="px-6 py-2.5 flex items-center justify-between hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0">
                                            <div className="flex items-center gap-3">
                                              <div className="text-gray-400">{getCategoryIcon(material.category)}</div>
                                              <span className="text-sm font-semibold text-gray-700">{getMaterialDisplayName(material)}</span>
                                              {(material.category === 'bacaan' || material.category === 'cefr') && (
                                                <span className="text-xs text-gray-400 font-mono">
                                                  {material.material_contents?.[0]?.storage_path?.split('/').pop() || '-'}
                                                </span>
                                              )}
                                              {material.is_published && (
                                                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded">Published</span>
                                              )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                              {isUrlBased && (
                                                <a href={materialUrl} target="_blank" rel="noopener noreferrer"
                                                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Buka link">
                                                  <ExternalLink className="w-4 h-4" />
                                                </a>
                                              )}
                                              {isUrlBased && (
                                                <button
                                                  onClick={() => startEditMaterial(material.id, material.title, materialUrl, material.category, material.material_contents?.[0]?.canva_url || '', material.material_contents?.[0]?.slides_url || '')}
                                                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="Edit link">
                                                  <Edit className="w-4 h-4" />
                                                </button>
                                              )}
                                              {material.category === 'live_zoom' && (
                                                convertingId === material.id ? (
                                                  <div className="flex items-center gap-1 px-2 py-1 text-xs text-purple-600">
                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                    <span>{convertProgress || 'Converting...'}</span>
                                                  </div>
                                                ) : (
                                                  <label className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors cursor-pointer" title="Upload & Convert PDF ke Slides">
                                                    <FileImage className="w-4 h-4" />
                                                    <input type="file" accept="application/pdf" className="hidden"
                                                      onChange={e => { const f = e.target.files?.[0]; if (f) convertPDF(material.id, f); }} />
                                                  </label>
                                                )
                                              )}
                                              {material.category === 'cefr' && onEditContent && (
                                                <button onClick={() => onEditContent(material.lesson_id, material.lesson_name)}
                                                  className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors" title="Edit konten block">
                                                  <LayoutList className="w-4 h-4" />
                                                </button>
                                              )}
                                              {material.category === 'bacaan' && (
                                                <button onClick={() => startReplaceFile(material.id)}
                                                  className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors" title="Ganti file">
                                                  <Upload className="w-4 h-4" />
                                                </button>
                                              )}
                                              <button
                                                onClick={() => handleTogglePublish(material.id, material.is_published)}
                                                className={`p-2 rounded-lg transition-colors ${material.is_published ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}
                                                title={material.is_published ? 'Unpublish' : 'Publish'}>
                                                {material.is_published ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                              </button>
                                              <button onClick={() => handleDelete(material.id)}
                                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Hapus material">
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

      {/* ✅ MODALS */}
      {moveChapterData && (
        <MoveChapterModal
          {...moveChapterData}
          onClose={() => setMoveChapterData(null)}
          onSuccess={handleStructureSuccess}
        />
      )}

      {moveUnitData && (
        <MoveUnitModal
          {...moveUnitData}
          onClose={() => setMoveUnitData(null)}
          onSuccess={handleStructureSuccess}
        />
      )}

      {reorderData && (
        <ReorderPanel
          {...reorderData}
          onClose={() => setReorderData(null)}
          onSuccess={handleStructureSuccess}
        />
      )}
    </div>
  );
}
