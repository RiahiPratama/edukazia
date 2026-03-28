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
  course_name: string;
};

type Level = {
  id: string;
  level_number: string;
  level_name: string;
  age_group: string;
};

type Unit = {
  id: string;
  unit_number: number;
  unit_name: string;
};

type Lesson = {
  id: string;
  lesson_number: number;
  lesson_name: string;
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
      .select('id, course_name')
      .order('course_name');

    if (!error && data) {
      setCourses(data);
    } else {
      console.error('Error fetching courses:', error);
    }
  };

  const fetchLevels = async (courseId: string) => {
    const { data, error } = await supabase
      .from('levels')
      .select('id, level_number, level_name, age_group')
      .eq('course_id', courseId)
      .order('level_number');

    if (!error && data) {
      setLevels(data);
    } else {
      console.error('Error fetching levels:', error);
    }
  };

  const fetchUnits = async (levelId: string) => {
    const { data, error } = await supabase
      .from('units')
      .select('id, unit_number, unit_name')
      .eq('level_id', levelId)
      .order('unit_number');

    if (!error && data) {
      setUnits(data);
    } else {
      console.error('Error fetching units:', error);
    }
  };

  const fetchLessons = async (unitId: string) => {
    const { data, error } = await supabase
      .from('lessons')
      .select('id, lesson_number, lesson_name')
      .eq('unit_id', unitId)
      .order('lesson_number');

    if (!error && data) {
      setLessons(data);
    } else {
      console.error('Error fetching lessons:', error);
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
              {course.course_name}
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
              {level.level_number} - {level.level_name} ({level.age_group})
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
              Unit {unit.unit_number.toString().padStart(2, '0')} - {unit.unit_name}
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
              Lesson {lesson.lesson_number.toString().padStart(2, '0')} - {lesson.lesson_name}
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
