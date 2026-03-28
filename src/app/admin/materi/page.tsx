'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import LiveZoomForm from './components/LiveZoomForm';
import BacaanForm from './components/BacaanForm';
import KosakataForm from './components/KosakataForm';
import CEFRForm from './components/CEFRForm';

type TabType = 'live_zoom' | 'bacaan' | 'kosakata' | 'cefr';

export default function MateriPage() {
  const [activeTab, setActiveTab] = useState<TabType>('live_zoom');
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const tabs = [
    { id: 'live_zoom' as TabType, label: 'Live Zoom', badge: 'URL Link', color: 'bg-blue-100 text-blue-700' },
    { id: 'bacaan' as TabType, label: 'Bacaan', badge: '.jsx Component', color: 'bg-green-100 text-green-700' },
    { id: 'kosakata' as TabType, label: 'Kosakata', badge: 'Google Drive', color: 'bg-yellow-100 text-yellow-700' },
    { id: 'cefr' as TabType, label: 'CEFR', badge: 'Audio + Text', color: 'bg-red-100 text-red-700' },
  ];

  const handleSave = async (materialData: any) => {
    setIsSubmitting(true);

    try {
      // Prepare FormData for file upload
      const formData = new FormData();
      
      formData.append('title', materialData.title);
      formData.append('type', materialData.type);
      formData.append('category', materialData.category);
      formData.append('level_id', materialData.level_id || '');
      formData.append('unit_id', materialData.unit_id || '');
      formData.append('lesson_id', materialData.lesson_id);
      formData.append('order_number', materialData.order_number.toString());
      formData.append('is_published', materialData.is_published.toString());
      formData.append('content_data', JSON.stringify(materialData.content_data));

      // Add file if exists
      if (materialData.file) {
        formData.append('file', materialData.file);
      }

      // Call API
      const response = await fetch('/api/admin/materials', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save material');
      }

      // Success!
      alert('✅ Material berhasil disimpan!');
      setShowForm(false);
      
      // TODO: Refresh material list here
      window.location.reload(); // Temporary solution

    } catch (error) {
      console.error('Save error:', error);
      alert('❌ Gagal menyimpan material: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (isSubmitting) return;
    setShowForm(false);
  };

  const renderForm = () => {
    const formProps = {
      onCancel: handleCancel,
      onSave: handleSave,
      isSubmitting,
    };

    switch (activeTab) {
      case 'live_zoom':
        return <LiveZoomForm {...formProps} />;
      case 'bacaan':
        return <BacaanForm {...formProps} />;
      case 'kosakata':
        return <KosakataForm {...formProps} />;
      case 'cefr':
        return <CEFRForm {...formProps} />;
      default:
        return null;
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Materi Ajar</h1>
            <p className="text-sm text-gray-600 mt-1">Kelola semua materi pembelajaran</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            disabled={showForm}
            className="flex items-center gap-2 px-4 py-2 bg-[#5C4FE5] text-white rounded-lg hover:bg-[#4a3ec7] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={20} />
            Tambah Materi Baru
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                if (isSubmitting) return;
                setActiveTab(tab.id);
                setShowForm(false);
              }}
              disabled={isSubmitting}
              className={`
                px-6 py-3 font-medium text-sm transition-colors relative
                ${activeTab === tab.id
                  ? 'text-[#5C4FE5] border-b-2 border-[#5C4FE5]'
                  : 'text-gray-600 hover:text-gray-900'
                }
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg border border-gray-200">
        {!showForm ? (
          // Empty State
          <div className="p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
              <Plus size={32} className="text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Belum ada materi {tabs.find(t => t.id === activeTab)?.label}
            </h3>
            <p className="text-gray-600 mb-6">
              Klik tombol "Tambah Materi Baru" untuk membuat materi pertama
            </p>
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg ${tabs.find(t => t.id === activeTab)?.color}`}>
              <span className="text-sm font-medium">{tabs.find(t => t.id === activeTab)?.badge}</span>
            </div>
          </div>
        ) : (
          // Form
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Tambah Materi {tabs.find(t => t.id === activeTab)?.label}
              </h2>
              <span className={`px-3 py-1 rounded-lg text-sm font-medium ${tabs.find(t => t.id === activeTab)?.color}`}>
                {tabs.find(t => t.id === activeTab)?.badge}
              </span>
            </div>
            
            {/* Render appropriate form */}
            {renderForm()}
          </div>
        )}
      </div>

      {/* Material List (placeholder for now) */}
      {!showForm && (
        <div className="mt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Daftar Materi {tabs.find(t => t.id === activeTab)?.label}
          </h3>
          <div className="bg-white rounded-lg border border-gray-200 p-6 text-center text-gray-500">
            Materi akan ditampilkan di sini setelah dibuat
          </div>
        </div>
      )}
    </div>
  );
}
