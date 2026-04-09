'use client';

import { useState } from 'react';
import { BookOpen, Video, FileText, Headphones, Plus, List } from 'lucide-react';
import LiveZoomForm from './components/LiveZoomForm';
import BacaanForm from './components/BacaanForm';
import KosakataForm from './components/KosakataForm';
import CEFRForm from './components/CEFRForm';
import CEFRBlockEditor from './components/CEFRBlockEditor';
import MaterialList from './components/MaterialList';
import ProgressOverview from './components/ProgressOverview';

type TabType = 'live_zoom' | 'bacaan' | 'kosakata' | 'cefr';

// ✅ Type diperbarui — sesuai schema DB terbaru
type Material = {
  id: string;
  title: string;
  category: string;
  level_id: string;
  unit_id: string;
  lesson_id: string;
  position: number;
  is_published: boolean;
  material_contents?: {
    content_url: string | null;
    storage_bucket: string | null;
    storage_path: string | null;
  }[];
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
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);

  // ✅ CEFR Block Editor state
  const [cefrEditorLesson, setCefrEditorLesson] = useState<{ id: string; name: string } | null>(null);

  const handleEdit = (material: Material) => {
    setEditingMaterial(material);
    setShowForm(true);
  };

  const handleSave = () => {
    setShowForm(false);
    setEditingMaterial(null);
    setRefreshKey(prev => prev + 1);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingMaterial(null);
  };

  // ✅ CEFR: setelah simpan form → buka block editor
  const handleCEFRSaveWithLesson = (lessonId: string, lessonName: string) => {
    setShowForm(false);
    setEditingMaterial(null);
    setCefrEditorLesson({ id: lessonId, name: lessonName });
  };

  // ✅ CEFR: kembali dari block editor ke daftar materi
  const handleCEFREditorBack = () => {
    setCefrEditorLesson(null);
    setRefreshKey(prev => prev + 1);
  };

  // ✅ CEFR: buka block editor langsung dari daftar materi
  const handleCEFREditContent = (lessonId: string, lessonName: string) => {
    setCefrEditorLesson({ id: lessonId, name: lessonName });
  };

  const renderForm = () => {
    switch (activeTab) {
      case 'live_zoom':
        return <LiveZoomForm onSave={handleSave} onCancel={handleCancel} editData={editingMaterial} />;
      case 'bacaan':
        return <BacaanForm onSave={handleSave} onCancel={handleCancel} editData={editingMaterial} />;
      case 'kosakata':
        return <KosakataForm onSave={handleSave} onCancel={handleCancel} editData={editingMaterial} />;
      case 'cefr':
        return (
          <CEFRForm
            onSave={handleSave}
            onSaveWithLesson={handleCEFRSaveWithLesson}
            onCancel={handleCancel}
            editData={editingMaterial}
          />
        );
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
                  setCefrEditorLesson(null);
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

          {/* ✅ CEFR Block Editor — tampil saat lessonId tersedia */}
          {activeTab === 'cefr' && cefrEditorLesson ? (
            <CEFRBlockEditor
              lessonId={cefrEditorLesson.id}
              lessonName={cefrEditorLesson.name}
              onBack={handleCEFREditorBack}
            />
          ) : (
            <>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  {showForm
                    ? `${editingMaterial ? 'Edit' : 'Tambah'} Materi ${tabs.find(t => t.id === activeTab)?.label}`
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
                      onClick={handleCancel}
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
                <>
                  <ProgressOverview category={activeTab} />
                  <MaterialList
                    key={refreshKey}
                    category={activeTab}
                    onEdit={handleEdit}
                    onEditContent={activeTab === 'cefr' ? handleCEFREditContent : undefined}
                  />
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
