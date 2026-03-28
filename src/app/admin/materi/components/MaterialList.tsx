'use client';

import { useState } from 'react';
import { BookOpen, Video, FileText, Headphones, Plus, List } from 'lucide-react';
import LiveZoomForm from './components/LiveZoomForm';
import BacaanForm from './components/BacaanForm';
import KosakataForm from './components/KosakataForm';
import CEFRForm from './components/CEFRForm';
import MaterialList from './components/MaterialList';

type TabType = 'live_zoom' | 'bacaan' | 'kosakata' | 'cefr';

const tabs = [
  { id: 'live_zoom' as TabType, label: 'Live Zoom', icon: Video, color: 'bg-blue-500' },
  { id: 'bacaan' as TabType, label: 'Bacaan', icon: BookOpen, color: 'bg-green-500' },
  { id: 'kosakata' as TabType, label: 'Kosakata', icon: FileText, color: 'bg-yellow-500' },
  { id: 'cefr' as TabType, label: 'CEFR', icon: Headphones, color: 'bg-red-500' },
];

export default function MateriTutorPage() {
  const [activeTab, setActiveTab] = useState<TabType>('live_zoom');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(true);
  const [view, setView] = useState<'form' | 'list'>('list'); // Default to list view

  const handleSave = async (materialData: any) => {
    console.log('Saving material:', materialData);
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      
      // Basic fields
      formData.append('title', materialData.title || '');
      formData.append('type', materialData.type);
      formData.append('category', materialData.category);
      
      // Hierarchy fields
      formData.append('course_id', materialData.course_id || '');
      formData.append('level_id', materialData.level_id || '');
      
      // NEW: Inline creation fields
      formData.append('judul_id', materialData.judul_id || '');
      formData.append('judul_name', materialData.judul_name || '');
      formData.append('unit_id', materialData.unit_id || '');
      formData.append('unit_name', materialData.unit_name || '');
      formData.append('lesson_id', materialData.lesson_id || '');
      formData.append('lesson_name', materialData.lesson_name || '');
      
      // Other fields
      formData.append('order_number', materialData.order_number?.toString() || '1');
      formData.append('is_published', materialData.is_published?.toString() || 'false');
      formData.append('content_data', JSON.stringify(materialData.content_data));

      // File upload (if exists)
      if (materialData.file) {
        formData.append('file', materialData.file);
      }

      console.log('FormData prepared, sending to API...');

      const response = await fetch('/api/admin/materials', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      console.log('API Response:', result);

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create material');
      }

      alert('✅ Material berhasil disimpan!');
      
      // Force form remount to reset all state
      setShowForm(false);
      setTimeout(() => {
        setShowForm(true);
      }, 10);

    } catch (error) {
      console.error('Error saving material:', error);
      alert(`❌ Gagal menyimpan material: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (confirm('Batalkan perubahan?')) {
      setShowForm(false);
      setTimeout(() => setShowForm(true), 100);
    }
  };

  const renderForm = () => {
    if (!showForm) return null;

    switch (activeTab) {
      case 'live_zoom':
        return (
          <LiveZoomForm
            onSave={handleSave}
            onCancel={handleCancel}
            isSubmitting={isSubmitting}
          />
        );
      case 'bacaan':
        return (
          <BacaanForm
            onSave={handleSave}
            onCancel={handleCancel}
            isSubmitting={isSubmitting}
          />
        );
      case 'kosakata':
        return (
          <KosakataForm
            onSave={handleSave}
            onCancel={handleCancel}
            isSubmitting={isSubmitting}
          />
        );
      case 'cefr':
        return (
          <CEFRForm
            onSave={handleSave}
            onCancel={handleCancel}
            isSubmitting={isSubmitting}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Materi Tutor</h1>
          <p className="text-gray-600">
            Kelola materi pembelajaran untuk siswa
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2 mb-6">
          <div className="flex gap-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  disabled={isSubmitting}
                  className={`
                    flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-all flex-1
                    ${isActive
                      ? 'bg-[#5C4FE5] text-white shadow-md'
                      : 'text-gray-600 hover:bg-gray-100'
                    }
                    disabled:opacity-50 disabled:cursor-not-allowed
                  `}
                >
                  <Icon size={20} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Form Container */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          {/* Header with toggle buttons */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              {view === 'form' ? 'Tambah' : 'Daftar'} Materi {tabs.find(t => t.id === activeTab)?.label}
            </h2>
            
            <div className="flex gap-2">
              <button
                onClick={() => setView('list')}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all
                  ${view === 'list'
                    ? 'bg-[#5C4FE5] text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                  }
                `}
              >
                <List size={18} />
                Daftar Materi
              </button>
              <button
                onClick={() => {
                  setView('form');
                  setShowForm(false);
                  setTimeout(() => setShowForm(true), 10);
                }}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all
                  ${view === 'form'
                    ? 'bg-[#5C4FE5] text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                  }
                `}
              >
                <Plus size={18} />
                Tambah Materi
              </button>
            </div>
          </div>

          {/* Content */}
          {view === 'form' ? renderForm() : (
            <MaterialList 
              category={activeTab}
              onEdit={(material) => {
                // TODO: Implement edit functionality
                console.log('Edit material:', material);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
