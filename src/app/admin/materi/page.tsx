'use client';

import { useState } from 'react';
import { BookOpen, Video, FileText, Headphones, Plus, List } from 'lucide-react';
import LiveZoomForm from './components/LiveZoomForm';
import BacaanForm from './components/BacaanForm';
import KosakataForm from './components/KosakataForm';
import CEFRForm from './components/CEFRForm';
import MaterialList from './components/MaterialList';

type TabType = 'live_zoom' | 'bacaan' | 'kosakata' | 'cefr';

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

const tabs = [
  { id: 'live_zoom' as TabType, label: 'Live Zoom', icon: Video },
  { id: 'bacaan' as TabType, label: 'Bacaan', icon: BookOpen },
  { id: 'kosakata' as TabType, label: 'Kosakata', icon: FileText },
  { id: 'cefr' as TabType, label: 'CEFR', icon: Headphones },
];

export default function MateriTutorPage() {
  const [activeTab, setActiveTab] = useState<TabType>('live_zoom');
  const [showForm, setShowForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleEdit = (material: Material) => {
    // TODO: Implement edit functionality
    alert('Edit functionality coming soon!');
    console.log('Edit material:', material);
  };

  const handleFormClose = () => {
    setShowForm(false);
    // Refresh material list
    setRefreshKey(prev => prev + 1);
  };

  const renderForm = () => {
    switch (activeTab) {
      case 'live_zoom':
        return <LiveZoomForm />;
      case 'bacaan':
        return <BacaanForm />;
      case 'kosakata':
        return <KosakataForm />;
      case 'cefr':
        return <CEFRForm />;
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F6FF] p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Materi Tutor</h1>
          <p className="text-gray-600 mt-1">Kelola materi pembelajaran untuk semua kategori</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-200">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setShowForm(false);
                }}
                className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors border-b-2 ${
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

        {/* Content */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              {showForm 
                ? `Tambah Materi ${tabs.find(t => t.id === activeTab)?.label}`
                : `Daftar Materi ${tabs.find(t => t.id === activeTab)?.label}`
              }
            </h2>
            <div className="flex gap-2">
              {!showForm ? (
                <>
                  <button
                    onClick={() => setShowForm(false)}
                    className="px-4 py-2 bg-[#5C4FE5] text-white rounded-lg hover:bg-[#4a3ec7] transition-colors flex items-center gap-2 font-medium"
                  >
                    <List size={18} />
                    Daftar Materi
                  </button>
                  <button
                    onClick={() => setShowForm(true)}
                    className="px-4 py-2 bg-white text-[#5C4FE5] border-2 border-[#5C4FE5] rounded-lg hover:bg-[#F7F6FF] transition-colors flex items-center gap-2 font-medium"
                  >
                    <Plus size={18} />
                    Tambah Materi
                  </button>
                </>
              ) : (
                <button
                  onClick={handleFormClose}
                  className="px-4 py-2 bg-white text-[#5C4FE5] border-2 border-[#5C4FE5] rounded-lg hover:bg-[#F7F6FF] transition-colors flex items-center gap-2 font-medium"
                >
                  <List size={18} />
                  Kembali ke Daftar
                </button>
              )}
            </div>
          </div>

          {showForm ? (
            renderForm()
          ) : (
            <MaterialList key={refreshKey} category={activeTab} onEdit={handleEdit} />
          )}
        </div>
      </div>
    </div>
  );
}
