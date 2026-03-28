'use client';

import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import HierarchySelector from './HierarchySelector';

type LiveZoomFormProps = {
  onCancel: () => void;
  onSave: (data: any) => void;
  isSubmitting?: boolean;
};

export default function LiveZoomForm({ onCancel, onSave, isSubmitting }: LiveZoomFormProps) {
  const [formData, setFormData] = useState({
    platform: '',
    url: '',
    courseId: '',
    levelId: '',
    judulId: '',
    judulName: '',
    unitId: '',
    unitName: '',
    lessonId: '',
    lessonName: '',
    orderNumber: 1,
    isPublished: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.platform || !formData.url || !formData.lessonName) {
      alert('Mohon isi semua field yang required!');
      return;
    }

    const materialData = {
      title: formData.lessonName, // Lesson name = Material title
      type: 'live_zoom', // ✅ Correct enum value!
      category: 'live_zoom',
      course_id: formData.courseId,
      level_id: formData.levelId,
      judul_id: formData.judulId,
      judul_name: formData.judulName,
      unit_id: formData.unitId,
      unit_name: formData.unitName,
      lesson_id: formData.lessonId,
      lesson_name: formData.lessonName,
      order_number: formData.orderNumber,
      is_published: formData.isPublished,
      content_data: {
        type: 'url',
        platform: formData.platform,
        url: formData.url,
      },
    };

    onSave(materialData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Hierarchy Selector */}
      <HierarchySelector
        onCourseChange={(courseId) => setFormData({ ...formData, courseId })}
        onLevelChange={(levelId) => setFormData({ ...formData, levelId })}
        onJudulChange={(judulId, judulName) => setFormData({ ...formData, judulId, judulName })}
        onUnitChange={(unitId, unitName) => setFormData({ ...formData, unitId, unitName })}
        onLessonChange={(lessonId, lessonName) => setFormData({ ...formData, lessonId, lessonName })}
        onOrderChange={(orderNumber) => setFormData({ ...formData, orderNumber })}
      />

      {/* URL Link Section */}
      <div className="p-6 bg-gray-50 rounded-lg">
        <h4 className="text-base font-medium text-gray-900 mb-4">URL Link</h4>

        {/* Platform */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Platform *
          </label>
          <select
            value={formData.platform}
            onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] focus:border-transparent bg-white text-gray-900"
            required
            disabled={isSubmitting}
          >
            <option value="">Pilih platform...</option>
            <option value="canva">Canva</option>
            <option value="google_drive">Google Drive</option>
            <option value="other">Lainnya</option>
          </select>
        </div>

        {/* URL */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-900 mb-2">
            URL Link *
          </label>
          <input
            type="url"
            value={formData.url}
            onChange={(e) => setFormData({ ...formData, url: e.target.value })}
            placeholder="https://www.canva.com/design/..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] focus:border-transparent text-gray-900 placeholder:text-gray-400"
            required
            disabled={isSubmitting}
          />
          <p className="text-xs text-gray-600 mt-1">
            Paste link dari Canva atau Google Drive
          </p>
        </div>

        {/* Warning */}
        <div className="flex items-start gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <AlertCircle size={18} className="text-yellow-700 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-yellow-700">
            <strong>Note:</strong> Pastikan link sudah di-share dengan akses "Anyone with the link"
          </p>
        </div>
      </div>

      {/* Publish Checkbox */}
      <div>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.isPublished}
            onChange={(e) => setFormData({ ...formData, isPublished: e.target.checked })}
            className="mt-1 w-4 h-4 text-[#5C4FE5] border-gray-300 rounded focus:ring-[#5C4FE5]"
            disabled={isSubmitting}
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
          disabled={isSubmitting}
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Batal
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-6 py-2 bg-[#5C4FE5] text-white rounded-lg hover:bg-[#4a3ec7] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Menyimpan...' : 'Simpan Materi'}
        </button>
      </div>
    </form>
  );
}
