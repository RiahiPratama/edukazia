'use client';

import { useState, useEffect } from 'react';
import { BookOpen, Video, FileText, Headphones, Lock, ExternalLink, Play, ChevronDown } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import CEFRAudioPlayer from './components/CEFRAudioPlayer';

type Material = {
  id: string;
  title: string;
  type: string;
  category: string;
  level_id: string;
  lesson_id: string;
  order_number: number;
  content_data: any;
  created_at: string;
};

type ActiveClass = {
  class_id: string;
  class_name: string;
  course_name: string;
  level_id: string;
  level_name: string;
};

type GroupedMaterials = {
  lessonId: string;
  lessonName: string;
  materials: Material[];
};

type TabType = 'live_zoom' | 'bacaan' | 'kosakata' | 'cefr';

const tabs = [
  { id: 'live_zoom' as TabType, label: 'Live Zoom', icon: Video },
  { id: 'bacaan' as TabType, label: 'Bacaan', icon: BookOpen },
  { id: 'kosakata' as TabType, label: 'Kosakata', icon: FileText },
  { id: 'cefr' as TabType, label: 'CEFR', icon: Headphones },
];

export default function SiswaMateriPage() {
  const [activeClasses, setActiveClasses] = useState<ActiveClass[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [activeTab, setActiveTab] = useState<TabType>('live_zoom');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [lessons, setLessons] = useState<{ id: string; lesson_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  // Modal states
  const [showBacaanModal, setShowBacaanModal] = useState(false);
  const [selectedBacaan, setSelectedBacaan] = useState<Material | null>(null);
  const [bacaanComponent, setBacaanComponent] = useState<string>('');
  
  // CEFR player state
  const [showCEFRPlayer, setShowCEFRPlayer] = useState(false);
  const [selectedCEFR, setSelectedCEFR] = useState<Material | null>(null);

  const supabase = createClient();

  useEffect(() => {
    fetchActiveClasses();
  }, []);

  useEffect(() => {
    if (selectedClass) {
      fetchMaterials();
    }
  }, [selectedClass, activeTab]);

  const fetchActiveClasses = async () => {
    setLoading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get student profile
      const { data: studentData } = await supabase
        .from('students')
        .select('id')
        .eq('profile_id', user.id)
        .single();

      if (!studentData) return;

      // Get active enrollments
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select(`
          class_id,
          class_groups (
            id,
            name,
            level_id,
            course_id,
            courses (name),
            levels (name)
          )
        `)
        .eq('student_id', studentData.id)
        .gte('end_date', new Date().toISOString().split('T')[0]);

      if (!enrollments || enrollments.length === 0) {
        setHasAccess(false);
        setLoading(false);
        return;
      }

      // Format active classes
      const classes: ActiveClass[] = enrollments.map(e => ({
        class_id: e.class_groups.id,
        class_name: e.class_groups.name,
        course_name: e.class_groups.courses.name,
        level_id: e.class_groups.level_id,
        level_name: e.class_groups.levels.name,
      }));

      setActiveClasses(classes);
      setHasAccess(true);
      
      if (classes.length > 0) {
        setSelectedClass(classes[0].level_id);
      }
    } catch (error) {
      console.error('Error fetching active classes:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMaterials = async () => {
    try {
      const { data, error } = await supabase
        .from('materials')
        .select('*')
        .eq('category', activeTab)
        .eq('level_id', selectedClass)
        .eq('is_published', true)
        .order('order_number');

      if (error) throw error;

      setMaterials(data || []);

      // Fetch lesson names
      if (data && data.length > 0) {
        const lessonIds = [...new Set(data.map(m => m.lesson_id))];
        const { data: lessonsData } = await supabase
          .from('lessons')
          .select('id, lesson_name')
          .in('id', lessonIds);
        
        setLessons(lessonsData || []);
      }
    } catch (error) {
      console.error('Error fetching materials:', error);
    }
  };

  const groupByLesson = (): GroupedMaterials[] => {
    const groups: { [key: string]: GroupedMaterials } = {};

    materials.forEach(material => {
      const lessonId = material.lesson_id || 'no-lesson';
      
      if (!groups[lessonId]) {
        const lesson = lessons.find(l => l.id === lessonId);
        groups[lessonId] = {
          lessonId,
          lessonName: lesson?.lesson_name || material.title,
          materials: []
        };
      }

      groups[lessonId].materials.push(material);
    });

    return Object.values(groups).sort((a, b) => 
      a.lessonName.localeCompare(b.lessonName)
    );
  };

  const handleOpenMaterial = async (material: Material) => {
    const data = material.content_data;

    switch (material.category) {
      case 'live_zoom':
        if (data?.url) {
          window.open(data.url, '_blank');
        }
        break;
      
      case 'bacaan':
        if (data?.jsx_file_path) {
          // Fetch JSX component from storage
          const { data: fileData } = await supabase.storage
            .from('components')
            .download(data.jsx_file_path);
          
          if (fileData) {
            const text = await fileData.text();
            setBacaanComponent(text);
            setSelectedBacaan(material);
            setShowBacaanModal(true);
          }
        }
        break;
      
      case 'kosakata':
        if (data?.url) {
          window.open(data.url, '_blank');
        }
        break;
      
      case 'cefr':
        setSelectedCEFR(material);
        setShowCEFRPlayer(true);
        break;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'live_zoom': return <Video size={16} className="text-blue-600" />;
      case 'bacaan': return <BookOpen size={16} className="text-green-600" />;
      case 'kosakata': return <FileText size={16} className="text-yellow-600" />;
      case 'cefr': return <Headphones size={16} className="text-red-600" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F6FF] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-[#5C4FE5] border-t-transparent rounded-full mx-auto"></div>
          <p className="text-gray-600 mt-4">Memuat materi...</p>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-[#F7F6FF] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock size={40} className="text-gray-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Materi Terkunci</h2>
          <p className="text-gray-600 mb-6">
            Anda belum terdaftar di kelas manapun atau kelas Anda sudah berakhir.
          </p>
          <p className="text-sm text-gray-500">
            Hubungi admin untuk mendaftar kelas atau perpanjang kelas yang sudah ada.
          </p>
        </div>
      </div>
    );
  }

  const groupedMaterials = groupByLesson();
  const currentClass = activeClasses.find(c => c.level_id === selectedClass);

  return (
    <div className="min-h-screen bg-[#F7F6FF] p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">📚 Materi Pembelajaran</h1>
          <p className="text-gray-600 mt-1">Akses materi sesuai kelas yang Anda ikuti</p>
        </div>

        {/* Class Selector */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Kelas Aktif:
          </label>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="w-full px-4 py-3 text-base font-medium border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] focus:border-[#5C4FE5] bg-white text-gray-900"
          >
            {activeClasses.map((cls) => (
              <option key={cls.level_id} value={cls.level_id}>
                {cls.course_name} - {cls.level_name}
              </option>
            ))}
          </select>
          {currentClass && (
            <p className="text-sm text-gray-500 mt-2">
              Kelas: {currentClass.class_name}
            </p>
          )}
        </div>

        {/* Category Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-200 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors border-b-2 whitespace-nowrap ${
                  isActive
                    ? 'text-[#5C4FE5] border-[#5C4FE5]'
                    : 'text-gray-600 border-transparent hover:text-gray-900'
                }`}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Materials */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          {groupedMaterials.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                {getCategoryIcon(activeTab)}
              </div>
              <p className="text-gray-600 font-medium">Belum ada materi tersedia</p>
              <p className="text-sm text-gray-500 mt-1">
                Materi untuk kategori ini akan segera ditambahkan
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {groupedMaterials.map(group => (
                <div key={group.lessonId} className="border border-gray-200 rounded-lg overflow-hidden">
                  {/* Group Header */}
                  <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                    <div className="flex items-center gap-2">
                      <ChevronDown size={16} className="text-gray-500" />
                      <span className="font-medium text-gray-900">{group.lessonName}</span>
                      <span className="text-sm text-gray-500">({group.materials.length} materi)</span>
                    </div>
                  </div>

                  {/* Materials */}
                  <div className="divide-y divide-gray-100">
                    {group.materials.map(material => (
                      <div
                        key={material.id}
                        className="p-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              {getCategoryIcon(material.category)}
                              <h4 className="font-medium text-gray-900">{material.title}</h4>
                              <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">
                                Published
                              </span>
                            </div>

                            <div className="text-xs text-gray-500 mb-3">
                              Order: #{material.order_number}
                            </div>

                            <button
                              onClick={() => handleOpenMaterial(material)}
                              className="px-4 py-2 bg-[#5C4FE5] text-white rounded-lg hover:bg-[#4a3ec7] transition-colors flex items-center gap-2 text-sm font-medium"
                            >
                              <Play size={16} />
                              Buka Materi
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
      </div>

      {/* Bacaan Modal */}
      {showBacaanModal && selectedBacaan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                {selectedBacaan.title}
              </h3>
              <button
                onClick={() => {
                  setShowBacaanModal(false);
                  setSelectedBacaan(null);
                  setBacaanComponent('');
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
              >
                ×
              </button>
            </div>
            <div className="p-6">
              {/* Render JSX component here */}
              <div className="prose max-w-none">
                <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-4 rounded">
                  {bacaanComponent}
                </pre>
                <p className="text-sm text-gray-500 mt-4">
                  Note: Interactive component rendering will be implemented next
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CEFR Audio Player */}
      {showCEFRPlayer && selectedCEFR && (
        <CEFRAudioPlayer
          material={selectedCEFR}
          onClose={() => {
            setShowCEFRPlayer(false);
            setSelectedCEFR(null);
          }}
        />
      )}
    </div>
  );
}
