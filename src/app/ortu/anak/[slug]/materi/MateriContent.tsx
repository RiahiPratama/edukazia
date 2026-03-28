'use client';

import { useState } from 'react';
import { BookOpen, FileText, Headphones, Video } from 'lucide-react';

interface Material {
  id: string;
  title: string;
  category: string;
  order_number: number;
  lesson_id: string;
  content_data: any;
}

interface Lesson {
  id: string;
  lesson_name: string;
  unit_id: string;
}

interface Unit {
  id: string;
  unit_name: string;
  judul_id: string;
}

interface Judul {
  id: string;
  name: string;
  level_id: string;
}

interface Level {
  id: string;
  name: string;
  course_id: string;
}

interface Course {
  id: string;
  name: string;
}

interface MateriContentProps {
  studentName: string;
  materials: Material[];
  lessons: Lesson[];
  units: Unit[];
  juduls: Judul[];
  levels: Level[];
  courses: Course[];
}

const categoryConfig = {
  'Live Zoom': { icon: Video, color: 'bg-purple-100 text-purple-600', label: 'Live Zoom' },
  'Bacaan': { icon: BookOpen, color: 'bg-blue-100 text-blue-600', label: 'Bacaan' },
  'Kosakata': { icon: FileText, color: 'bg-green-100 text-green-600', label: 'Kosakata' },
  'CEFR': { icon: Headphones, color: 'bg-yellow-100 text-yellow-600', label: 'CEFR' },
};

export default function MateriContent({
  studentName,
  materials,
  lessons,
  units,
  juduls,
  levels,
  courses,
}: MateriContentProps) {
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Build hierarchy lookup
  const lessonMap = new Map(lessons.map(l => [l.id, l]));
  const unitMap = new Map(units.map(u => [u.id, u]));
  const judulMap = new Map(juduls.map(j => [j.id, j]));
  const levelMap = new Map(levels.map(l => [l.id, l]));
  const courseMap = new Map(courses.map(c => [c.id, c]));

  // Enrich materials with hierarchy
  const enrichedMaterials = materials.map(material => {
    const lesson = lessonMap.get(material.lesson_id);
    const unit = lesson ? unitMap.get(lesson.unit_id) : undefined;
    const judul = unit ? judulMap.get(unit.judul_id) : undefined;
    const level = judul ? levelMap.get(judul.level_id) : undefined;
    const course = level ? courseMap.get(level.course_id) : undefined;

    return {
      ...material,
      lesson,
      unit,
      judul,
      level,
      course,
    };
  });

  // Filter materials
  const filteredMaterials = enrichedMaterials.filter(m => {
    const courseMatch = selectedCourse === 'all' || m.course?.id === selectedCourse;
    const categoryMatch = selectedCategory === 'all' || m.category === selectedCategory;
    return courseMatch && categoryMatch;
  });

  // Group by course > level > judul > unit > lesson
  const groupedMaterials = filteredMaterials.reduce((acc, material) => {
    if (!material.course || !material.level || !material.judul || !material.unit || !material.lesson) {
      return acc;
    }

    const courseKey = material.course.id;
    const levelKey = material.level.id;
    const judulKey = material.judul.id;
    const unitKey = material.unit.id;
    const lessonKey = material.lesson.id;

    if (!acc[courseKey]) {
      acc[courseKey] = { course: material.course, levels: {} };
    }
    if (!acc[courseKey].levels[levelKey]) {
      acc[courseKey].levels[levelKey] = { level: material.level, juduls: {} };
    }
    if (!acc[courseKey].levels[levelKey].juduls[judulKey]) {
      acc[courseKey].levels[levelKey].juduls[judulKey] = { judul: material.judul, units: {} };
    }
    if (!acc[courseKey].levels[levelKey].juduls[judulKey].units[unitKey]) {
      acc[courseKey].levels[levelKey].juduls[judulKey].units[unitKey] = { unit: material.unit, lessons: {} };
    }
    if (!acc[courseKey].levels[levelKey].juduls[judulKey].units[unitKey].lessons[lessonKey]) {
      acc[courseKey].levels[levelKey].juduls[judulKey].units[unitKey].lessons[lessonKey] = {
        lesson: material.lesson,
        materials: [],
      };
    }

    acc[courseKey].levels[levelKey].juduls[judulKey].units[unitKey].lessons[lessonKey].materials.push(material);
    return acc;
  }, {} as any);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Materi Pembelajaran</h1>
          <p className="text-gray-600">Untuk: {studentName}</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Course Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Mata Pelajaran</label>
              <select
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="all">Semua Mata Pelajaran</option>
                {courses.map(course => (
                  <option key={course.id} value={course.id}>{course.name}</option>
                ))}
              </select>
            </div>

            {/* Category Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Kategori Materi</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="all">Semua Kategori</option>
                <option value="Live Zoom">Live Zoom</option>
                <option value="Bacaan">Bacaan</option>
                <option value="Kosakata">Kosakata</option>
                <option value="CEFR">CEFR</option>
              </select>
            </div>
          </div>
        </div>

        {/* Materials */}
        {Object.keys(groupedMaterials).length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
            <p className="text-gray-500">Tidak ada materi yang tersedia dengan filter yang dipilih.</p>
          </div>
        ) : (
          Object.entries(groupedMaterials).map(([courseId, courseData]: [string, any]) => (
            <div key={courseId} className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">{courseData.course.name}</h2>

              {Object.entries(courseData.levels).map(([levelId, levelData]: [string, any]) => (
                <div key={levelId} className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-700 mb-3">{levelData.level.name}</h3>

                  {Object.entries(levelData.juduls).map(([judulId, judulData]: [string, any]) => (
                    <div key={judulId} className="mb-4">
                      <h4 className="text-md font-medium text-gray-600 mb-2">{judulData.judul.name}</h4>

                      {Object.entries(judulData.units).map(([unitId, unitData]: [string, any]) => (
                        <div key={unitId} className="mb-3 ml-4">
                          <h5 className="text-sm font-medium text-gray-500 mb-2">{unitData.unit.unit_name}</h5>

                          {Object.entries(unitData.lessons).map(([lessonId, lessonData]: [string, any]) => (
                            <div key={lessonId} className="ml-4 mb-3">
                              <h6 className="text-sm text-gray-400 mb-2">{lessonData.lesson.lesson_name}</h6>

                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {lessonData.materials
                                  .sort((a: Material, b: Material) => a.order_number - b.order_number)
                                  .map((material: Material) => {
                                    const config = categoryConfig[material.category as keyof typeof categoryConfig];
                                    const Icon = config?.icon || FileText;

                                    return (
                                      <div
                                        key={material.id}
                                        className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                                      >
                                        <div className="flex items-start gap-3">
                                          <div className={`w-10 h-10 rounded-lg ${config?.color} flex items-center justify-center flex-shrink-0`}>
                                            <Icon className="w-5 h-5" />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <h6 className="font-medium text-gray-900 text-sm mb-1 line-clamp-2">
                                              {material.title}
                                            </h6>
                                            <span className="text-xs text-gray-500">{config?.label}</span>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
