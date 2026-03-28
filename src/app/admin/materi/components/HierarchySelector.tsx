'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type HierarchySelectorProps = {
  onCourseChange?: (courseId: string) => void;
  onLevelChange?: (levelId: string) => void;
  onJudulChange?: (judulId: string, judulName: string) => void;
  onUnitChange?: (unitId: string, unitName: string) => void;
  onLessonChange?: (lessonId: string, lessonName: string) => void;
  onOrderChange?: (order: number) => void;
};

type Course = {
  id: string;
  name: string;
};

type Level = {
  id: string;
  name: string;
  description: string;
  target_age: string;
};

type Judul = {
  id: string;
  name: string;
  description: string;
};

type Unit = {
  id: string;
  name: string;
  sort_order: number;
};

type Lesson = {
  id: string;
  name: string;
  sort_order: number;
};

export default function HierarchySelector({
  onCourseChange,
  onLevelChange,
  onJudulChange,
  onUnitChange,
  onLessonChange,
  onOrderChange,
}: HierarchySelectorProps) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [juduls, setJuduls] = useState<Judul[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);

  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('');
  const [selectedJudul, setSelectedJudul] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('');
  const [selectedLesson, setSelectedLesson] = useState('');
  
  // New state for inline creation
  const [judulMode, setJudulMode] = useState<'select' | 'create'>('select');
  const [unitMode, setUnitMode] = useState<'select' | 'create'>('select');
  const [lessonMode, setLessonMode] = useState<'select' | 'create'>('select');
  
  const [newJudulName, setNewJudulName] = useState('');
  const [newUnitName, setNewUnitName] = useState('');
  const [newLessonName, setNewLessonName] = useState('');
  
  const [orderNumber, setOrderNumber] = useState(1);

  const supabase = createClient();

  // Fetch courses on mount
  useEffect(() => {
    fetchCourses();
  }, []);

  // Fetch levels when course changes
  useEffect(() => {
    if (selectedCourse) {
      fetchLevels(selectedCourse);
    } else {
      setLevels([]);
      setSelectedLevel('');
    }
  }, [selectedCourse]);

  // Fetch juduls when level changes
  useEffect(() => {
    if (selectedLevel) {
      fetchJuduls(selectedLevel);
    } else {
      setJuduls([]);
      setSelectedJudul('');
      setJudulMode('select');
    }
  }, [selectedLevel]);

  // Fetch units when judul changes
  useEffect(() => {
    if (selectedJudul && judulMode === 'select') {
      fetchUnits(selectedJudul);
    } else {
      setUnits([]);
      setSelectedUnit('');
      setUnitMode('select');
    }
  }, [selectedJudul, judulMode]);

  // Fetch lessons when unit changes
  useEffect(() => {
    if (selectedUnit && unitMode === 'select') {
      fetchLessons(selectedUnit);
    } else {
      setLessons([]);
      setSelectedLesson('');
      setLessonMode('select');
    }
  }, [selectedUnit, unitMode]);

  const fetchCourses = async () => {
    const { data, error } = await supabase
      .from('courses')
      .select('id, name')
      .eq('is_active', true)
      .order('sort_order');

    if (error) {
      console.error('Error fetching courses:', error);
    } else {
      setCourses(data || []);
    }
  };

  const fetchLevels = async (courseId: string) => {
    const { data, error } = await supabase
      .from('levels')
      .select('id, name, description, target_age')
      .eq('course_id', courseId)
      .eq('is_active', true)
      .order('sort_order');

    if (error) {
      console.error('Error fetching levels:', error);
    } else {
      setLevels(data || []);
    }
  };

  const fetchJuduls = async (levelId: string) => {
    const { data, error } = await supabase
      .from('juduls')
      .select('id, name, description')
      .eq('level_id', levelId)
      .eq('is_active', true)
      .order('sort_order');

    if (error) {
      console.error('Error fetching juduls:', error);
    } else {
      setJuduls(data || []);
    }
  };

  const fetchUnits = async (judulId: string) => {
    const { data, error } = await supabase
      .from('units')
      .select('id, name, sort_order')
      .eq('judul_id', judulId)
      .eq('is_active', true)
      .order('sort_order');

    if (error) {
      console.error('Error fetching units:', error);
    } else {
      setUnits(data || []);
    }
  };

  const fetchLessons = async (unitId: string) => {
    const { data, error } = await supabase
      .from('lessons')
      .select('id, name, sort_order')
      .eq('unit_id', unitId)
      .eq('is_active', true)
      .order('sort_order');

    if (error) {
      console.error('Error fetching lessons:', error);
    } else {
      setLessons(data || []);
    }
  };

  const handleCourseChange = (courseId: string) => {
    setSelectedCourse(courseId);
    setSelectedLevel('');
    setSelectedJudul('');
    setSelectedUnit('');
    setSelectedLesson('');
    onCourseChange?.(courseId);
  };

  const handleLevelChange = (levelId: string) => {
    setSelectedLevel(levelId);
    setSelectedJudul('');
    setSelectedUnit('');
    setSelectedLesson('');
    setJudulMode('select');
    setUnitMode('select');
    setLessonMode('select');
    onLevelChange?.(levelId);
  };

  const handleJudulChange = (value: string) => {
    if (judulMode === 'select') {
      setSelectedJudul(value);
      onJudulChange?.(value, juduls.find(j => j.id === value)?.name || '');
    }
  };

  const handleJudulModeToggle = () => {
    if (judulMode === 'select') {
      setJudulMode('create');
      setSelectedJudul('');
      setNewJudulName('');
    } else {
      setJudulMode('select');
      setNewJudulName('');
    }
  };

  const handleNewJudulChange = (value: string) => {
    setNewJudulName(value);
    // Pass 'NEW' as ID and the name
    onJudulChange?.('NEW', value);
  };

  const handleUnitModeToggle = () => {
    if (unitMode === 'select') {
      setUnitMode('create');
      setSelectedUnit('');
      setNewUnitName('');
    } else {
      setUnitMode('select');
      setNewUnitName('');
    }
  };

  const handleNewUnitChange = (value: string) => {
    setNewUnitName(value);
    onUnitChange?.('NEW', value);
  };

  const handleLessonModeToggle = () => {
    if (lessonMode === 'select') {
      setLessonMode('create');
      setSelectedLesson('');
      setNewLessonName('');
    } else {
      setLessonMode('select');
      setNewLessonName('');
    }
  };

  const handleNewLessonChange = (value: string) => {
    setNewLessonName(value);
    onLessonChange?.('NEW', value);
  };

  const handleOrderChange = (value: number) => {
    setOrderNumber(value);
    onOrderChange?.(value);
  };

  return (
    <div className="p-6 bg-[#F7F6FF] rounded-lg border border-[#E5E3FF]">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp size={18} className="text-[#5C4FE5]" />
        <h4 className="text-base font-medium text-[#5C4FE5]">Hierarki Materi</h4>
      </div>

      {/* 1. Course */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-900 mb-2">
          1. Pelajaran *
        </label>
        <select
          value={selectedCourse}
          onChange={(e) => handleCourseChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] focus:border-transparent bg-white text-gray-900"
        >
          <option value="">Pilih pelajaran...</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.name}
            </option>
          ))}
        </select>
      </div>

      {/* 2. Level */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-900 mb-2">
          2. Level *
        </label>
        <select
          value={selectedLevel}
          onChange={(e) => handleLevelChange(e.target.value)}
          disabled={!selectedCourse}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] focus:border-transparent bg-white text-gray-900 disabled:bg-gray-100 disabled:cursor-not-allowed"
        >
          <option value="">Pilih level...</option>
          {levels.map((level) => (
            <option key={level.id} value={level.id}>
              {level.name} - {level.description} ({level.target_age})
            </option>
          ))}
        </select>
      </div>

      {/* 3. Judul */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-900">
            3. Judul *
          </label>
          <button
            type="button"
            onClick={handleJudulModeToggle}
            disabled={!selectedLevel}
            className="flex items-center gap-1 text-xs px-2 py-1 text-[#5C4FE5] hover:bg-[#5C4FE5] hover:text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={14} />
            {judulMode === 'select' ? 'Tambah Baru' : 'Pilih Existing'}
          </button>
        </div>
        
        {judulMode === 'select' ? (
          <select
            value={selectedJudul}
            onChange={(e) => handleJudulChange(e.target.value)}
            disabled={!selectedLevel}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] focus:border-transparent bg-white text-gray-900 disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            <option value="">Pilih judul...</option>
            {juduls.map((judul) => (
              <option key={judul.id} value={judul.id}>
                {judul.name}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            value={newJudulName}
            onChange={(e) => handleNewJudulChange(e.target.value)}
            placeholder="Ketik nama judul baru (contoh: Part of Speech)"
            className="w-full px-3 py-2 border border-[#5C4FE5] rounded-lg focus:ring-2 focus:ring-[#5C4FE5] focus:border-transparent text-gray-900 placeholder:text-gray-400 bg-blue-50"
          />
        )}
        <p className="text-xs text-gray-600 mt-1">
          {judulMode === 'select' ? 'Judul akan difilter berdasarkan level' : 'Judul baru akan dibuat otomatis'}
        </p>
      </div>

      {/* 4. Unit */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-900">
            4. Unit *
          </label>
          <button
            type="button"
            onClick={handleUnitModeToggle}
            disabled={!selectedJudul && judulMode === 'select'}
            className="flex items-center gap-1 text-xs px-2 py-1 text-[#5C4FE5] hover:bg-[#5C4FE5] hover:text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={14} />
            {unitMode === 'select' ? 'Tambah Baru' : 'Pilih Existing'}
          </button>
        </div>
        
        {unitMode === 'select' ? (
          <select
            value={selectedUnit}
            onChange={(e) => {
              setSelectedUnit(e.target.value);
              onUnitChange?.(e.target.value, units.find(u => u.id === e.target.value)?.name || '');
            }}
            disabled={!selectedJudul && judulMode === 'select'}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] focus:border-transparent bg-white text-gray-900 disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            <option value="">Pilih unit...</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            value={newUnitName}
            onChange={(e) => handleNewUnitChange(e.target.value)}
            placeholder="Ketik nama unit baru (contoh: Unit 01 - Noun)"
            className="w-full px-3 py-2 border border-[#5C4FE5] rounded-lg focus:ring-2 focus:ring-[#5C4FE5] focus:border-transparent text-gray-900 placeholder:text-gray-400 bg-blue-50"
          />
        )}
        <p className="text-xs text-gray-600 mt-1">
          {unitMode === 'select' ? 'Unit akan difilter berdasarkan judul' : 'Unit baru akan dibuat otomatis'}
        </p>
      </div>

      {/* 5. Lesson */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-900">
            5. Lesson *
          </label>
          <button
            type="button"
            onClick={handleLessonModeToggle}
            disabled={!selectedUnit && unitMode === 'select'}
            className="flex items-center gap-1 text-xs px-2 py-1 text-[#5C4FE5] hover:bg-[#5C4FE5] hover:text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={14} />
            {lessonMode === 'select' ? 'Tambah Baru' : 'Pilih Existing'}
          </button>
        </div>
        
        {lessonMode === 'select' ? (
          <select
            value={selectedLesson}
            onChange={(e) => {
              setSelectedLesson(e.target.value);
              onLessonChange?.(e.target.value, lessons.find(l => l.id === e.target.value)?.name || '');
            }}
            disabled={!selectedUnit && unitMode === 'select'}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] focus:border-transparent bg-white text-gray-900 disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            <option value="">Pilih lesson...</option>
            {lessons.map((lesson) => (
              <option key={lesson.id} value={lesson.id}>
                {lesson.name}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            value={newLessonName}
            onChange={(e) => handleNewLessonChange(e.target.value)}
            placeholder="Ketik nama lesson baru (contoh: Lesson 01 - Apa itu Noun?)"
            className="w-full px-3 py-2 border border-[#5C4FE5] rounded-lg focus:ring-2 focus:ring-[#5C4FE5] focus:border-transparent text-gray-900 placeholder:text-gray-400 bg-blue-50"
          />
        )}
        <p className="text-xs text-gray-600 mt-1">
          {lessonMode === 'select' ? 'Lesson akan difilter berdasarkan unit' : 'Lesson baru akan dibuat otomatis'}
        </p>
      </div>

      {/* 6. Order Number */}
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-2">
          6. Order Number *
        </label>
        <input
          type="number"
          min="1"
          value={orderNumber}
          onChange={(e) => handleOrderChange(parseInt(e.target.value))}
          className="w-40 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] focus:border-transparent text-gray-900"
        />
        <p className="text-xs text-gray-600 mt-1">
          Urutan materi dalam lesson (1, 2, 3...)
        </p>
      </div>
    </div>
  );
}
