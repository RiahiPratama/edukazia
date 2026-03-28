'use client';

import { useState, useEffect } from 'react';
import { TrendingUp } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type HierarchySelectorProps = {
  onCourseChange?: (courseId: string) => void;
  onLevelChange?: (levelId: string) => void;
  onUnitChange?: (unitId: string) => void;
  onLessonChange?: (lessonId: string) => void;
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
  onUnitChange,
  onLessonChange,
  onOrderChange,
}: HierarchySelectorProps) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);

  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('');
  const [selectedLesson, setSelectedLesson] = useState('');
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

  // Fetch units when level changes
  useEffect(() => {
    if (selectedLevel) {
      fetchUnits(selectedLevel);
    } else {
      setUnits([]);
      setSelectedUnit('');
    }
  }, [selectedLevel]);

  // Fetch lessons when unit changes
  useEffect(() => {
    if (selectedUnit) {
      fetchLessons(selectedUnit);
    } else {
      setLessons([]);
      setSelectedLesson('');
    }
  }, [selectedUnit]);

  const fetchCourses = async () => {
    const { data, error } = await supabase
      .from('courses')
      .select('id, name')
      .eq('is_active', true)
      .order('sort_order');

    if (error) {
      console.error('Error fetching courses:', error);
    } else {
      console.log('Courses fetched:', data);
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
      console.log('Levels fetched:', data);
      setLevels(data || []);
    }
  };

  const fetchUnits = async (levelId: string) => {
    const { data, error } = await supabase
      .from('units')
      .select('id, name, sort_order')
      .eq('level_id', levelId)
      .eq('is_active', true)
      .order('sort_order');

    if (error) {
      console.error('Error fetching units:', error);
    } else {
      console.log('Units fetched:', data);
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
      console.log('Lessons fetched:', data);
      setLessons(data || []);
    }
  };

  const handleCourseChange = (courseId: string) => {
    setSelectedCourse(courseId);
    setSelectedLevel('');
    setSelectedUnit('');
    setSelectedLesson('');
    onCourseChange?.(courseId);
  };

  const handleLevelChange = (levelId: string) => {
    setSelectedLevel(levelId);
    setSelectedUnit('');
    setSelectedLesson('');
    onLevelChange?.(levelId);
  };

  const handleUnitChange = (unitId: string) => {
    setSelectedUnit(unitId);
    setSelectedLesson('');
    onUnitChange?.(unitId);
  };

  const handleLessonChange = (lessonId: string) => {
    setSelectedLesson(lessonId);
    onLessonChange?.(lessonId);
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
        <p className="text-xs text-gray-600 mt-1">
          Level akan difilter berdasarkan pelajaran yang dipilih
        </p>
      </div>

      {/* 3. Unit */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-900 mb-2">
          3. Unit *
        </label>
        <select
          value={selectedUnit}
          onChange={(e) => handleUnitChange(e.target.value)}
          disabled={!selectedLevel}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] focus:border-transparent bg-white text-gray-900 disabled:bg-gray-100 disabled:cursor-not-allowed"
        >
          <option value="">Pilih unit...</option>
          {units.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-600 mt-1">
          Unit akan difilter berdasarkan level yang dipilih
        </p>
      </div>

      {/* 4. Lesson */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-900 mb-2">
          4. Lesson *
        </label>
        <select
          value={selectedLesson}
          onChange={(e) => handleLessonChange(e.target.value)}
          disabled={!selectedUnit}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] focus:border-transparent bg-white text-gray-900 disabled:bg-gray-100 disabled:cursor-not-allowed"
        >
          <option value="">Pilih lesson...</option>
          {lessons.map((lesson) => (
            <option key={lesson.id} value={lesson.id}>
              {lesson.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-600 mt-1">
          Lesson akan difilter berdasarkan unit yang dipilih
        </p>
      </div>

      {/* 5. Order Number */}
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-2">
          5. Order Number *
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
