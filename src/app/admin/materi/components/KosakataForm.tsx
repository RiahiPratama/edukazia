'use client';

import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import HierarchySelector from './HierarchySelector';

type KosakataFormProps = {
  onCancel: () => void;
  onSave: (data: any) => void;
};

export default function KosakataForm({ onCancel, onSave }: KosakataFormProps) {
  const [formData, setFormData] = useState({
    title: '',
    fileType: 'sheets',
    url: '',
    topics: '',
    levelId: '',
    unitId: '',
    lessonId: '',
    orderNumber: 1,
    isPublished: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.url || !formData.lessonId) {
      alert('Mohon isi semua field yang required!');
      return;
    }

    const topicsArray = formData.topics
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    const materialData = {
      title: formData.title,
      type: 'url',
      category: 'kosakata',
      level_id: formData.levelId,
      unit_id: formData.unitId,
      lesson_id: formData.lessonId,
      order_number: formData.orderNumber,
      is_published: formData.isPublished,
      content_data: {
        type: 'url',
        file_type: formData.fileType,
        url: formData.url,
        topics: topicsArray,
      },
    };

    onSave(materialData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-2">
          Judul Kosakata *
        </label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="Contoh: Vocabulary - Daily Activities"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] focus:border-transparent"
          required
        />
      </div>

      {/* Hierarchy Selector */}
      <HierarchySelector
        onLevelChange={(levelId) => setFormData({ ...formData, levelId })}
        onUnitChange={(unitId) => setFormData({ ...formData, unitId })}
        onLessonChange={(lessonId) => setFormData({ ...formData, lessonId })}
        onOrderChange={(orderNumber) => setFormData({ ...formData, orderNumber })}
      />

      {/* Google Drive Link Section */}
      <div className="p-6 bg-gray-50 rounded-lg">
        <h4 className="text-base font-medium text-gray-900 mb-4">Google Drive Link</h4>

        {/* File Type */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Tipe File
          </label>
          <select
            value={formData.fileType}
            onChange={(e) => setFormData({ ...formData, fileType: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] focus:border-transparent bg-white"
          >
            <option value="sheets">Google Sheets</option>
            <option value="docs">Google Docs</option>
            <option value="pdf">PDF</option>
          </select>
        </div>

        {/* URL */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Google Drive URL *
          </label>
          <input
            type="url"
            value={formData.url}
            onChange={(e) => setFormData({ ...formData, url: e.target.value })}
            placeholder="https://drive.google.com/file/d/..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] focus:border-transparent"
            required
          />
          <p className="text-xs text-gray-600 mt-1">
            Paste shareable link dari Google Drive
          </p>
        </div>

        {/* Warning */}
        <div className="flex items-start gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <AlertCircle size={18} className="text-yellow-700 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-yellow-700">
            <strong>Note:</strong> Pastikan file sudah di-share dengan "Anyone with the link can view"
          </p>
        </div>
      </div>

      {/* Topics */}
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-2">
          Topik Kosakata
        </label>
        <input
          type="text"
          value={formData.topics}
          onChange={(e) => setFormData({ ...formData, topics: e.target.value })}
          placeholder="Contoh: Verbs, Nouns, Adjectives"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] focus:border-transparent"
        />
        <p className="text-xs text-gray-600 mt-1">
          Pisahkan dengan koma untuk multiple topics
        </p>
      </div>

      {/* Publish Checkbox */}
      <div>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.isPublished}
            onChange={(e) => setFormData({ ...formData, isPublished: e.target.checked })}
            className="mt-1 w-4 h-4 text-[#5C4FE5] border-gray-300 rounded focus:ring-[#5C4FE5]"
          />
          <div>
            <span className="text-sm font-medium text-gray-900">Publish materi</span>
            <p className="text-xs text-gray-600 mt-0.5">
              Materi akan langsung terlihat oleh siswa
            </p>
          </div>
        </label>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Batal
        </button>
        <button
          type="submit"
          className="px-6 py-2 bg-[#5C4FE5] text-white rounded-lg hover:bg-[#4a3ec7] transition-colors"
        >
          Simpan Materi
        </button>
      </div>
    </form>
  );
}
