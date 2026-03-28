'use client';

import { useState } from 'react';
import { Upload, FileCode, X, Info } from 'lucide-react';
import HierarchySelector from './HierarchySelector';

type BacaanFormProps = {
  onCancel: () => void;
  onSave: (data: any) => void;
};

export default function BacaanForm({ onCancel, onSave }: BacaanFormProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    levelId: '',
    unitId: '',
    lessonId: '',
    orderNumber: 1,
    isPublished: true,
  });

  const [jsxFile, setJsxFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const validExtensions = ['.jsx', '.tsx'];
      const fileExtension = file.name.slice(file.name.lastIndexOf('.'));
      
      if (!validExtensions.includes(fileExtension)) {
        alert('File harus berformat .jsx atau .tsx');
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('File terlalu besar! Maksimal 5MB');
        return;
      }

      setJsxFile(file);
    }
  };

  const handleRemoveFile = () => {
    setJsxFile(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !jsxFile || !formData.lessonId) {
      alert('Mohon isi semua field yang required!');
      return;
    }

    const materialData = {
      title: formData.title,
      type: 'jsx',
      category: 'bacaan',
      level_id: formData.levelId,
      unit_id: formData.unitId,
      lesson_id: formData.lessonId,
      order_number: formData.orderNumber,
      is_published: formData.isPublished,
      content_data: {
        type: 'jsx',
        description: formData.description,
      },
      file: jsxFile, // Will be uploaded separately
    };

    onSave(materialData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-2">
          Judul Bacaan *
        </label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="Contoh: The Adventures of Tom Sawyer"
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

      {/* File Upload Section */}
      <div className="p-6 bg-gray-50 rounded-lg">
        <h4 className="text-base font-medium text-gray-900 mb-4">Upload JSX Component</h4>

        {!jsxFile ? (
          <label className="block cursor-pointer">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-[#5C4FE5] hover:bg-gray-100 transition-colors">
              <Upload size={48} className="mx-auto mb-4 text-gray-400" />
              <p className="text-sm font-medium text-gray-900 mb-1">
                Click to upload atau drag and drop
              </p>
              <p className="text-xs text-gray-600">
                File .jsx atau .tsx (max 5MB)
              </p>
            </div>
            <input
              type="file"
              accept=".jsx,.tsx"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
        ) : (
          <div className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <FileCode size={20} className="text-green-700" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{jsxFile.name}</p>
                <p className="text-xs text-gray-600">
                  {(jsxFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRemoveFile}
              className="p-1 text-red-600 hover:bg-red-50 rounded"
            >
              <X size={18} />
            </button>
          </div>
        )}

        {/* Info */}
        <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg mt-4">
          <Info size={18} className="text-blue-700 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-blue-700">
            <strong>Info:</strong> Component akan di-render dengan styling yang menarik untuk siswa
          </p>
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-2">
          Deskripsi Singkat
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Ringkasan cerita atau topik bacaan..."
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] focus:border-transparent resize-none"
        />
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
