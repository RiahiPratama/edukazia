'use client';

import { useState } from 'react';
import { Upload, Music, X } from 'lucide-react';
import HierarchySelector from './HierarchySelector';
import RichTextEditor from './RichTextEditor';

type CEFRFormProps = {
  onCancel: () => void;
  onSave: (data: any) => void;
};

export default function CEFRForm({ onCancel, onSave }: CEFRFormProps) {
  const [formData, setFormData] = useState({
    title: '',
    textContent: '',
    skillFocus: 'pronunciation',
    cefrSkill: 'speaking',
    levelId: '',
    unitId: '',
    lessonId: '',
    orderNumber: 1,
    isPublished: true,
  });

  const [audioFile, setAudioFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/x-m4a'];
      if (!validTypes.includes(file.type)) {
        alert('File harus berformat MP3, WAV, atau M4A');
        return;
      }

      // Validate file size (max 50MB)
      if (file.size > 50 * 1024 * 1024) {
        alert('File terlalu besar! Maksimal 50MB');
        return;
      }

      setAudioFile(file);
    }
  };

  const handleRemoveFile = () => {
    setAudioFile(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !audioFile || !formData.textContent || !formData.lessonId) {
      alert('Mohon isi semua field yang required!');
      return;
    }

    const materialData = {
      title: formData.title,
      type: 'audio',
      category: 'cefr',
      level_id: formData.levelId,
      unit_id: formData.unitId,
      lesson_id: formData.lessonId,
      order_number: formData.orderNumber,
      is_published: formData.isPublished,
      content_data: {
        type: 'audio',
        text_content_html: formData.textContent,
        skill_focus: formData.skillFocus,
        cefr_skill: formData.cefrSkill,
      },
      file: audioFile, // Will be uploaded separately
    };

    onSave(materialData);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-2">
          Judul Materi *
        </label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="Contoh: Pronunciation Practice - Th Sounds"
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

      {/* Audio Upload Section */}
      <div className="p-6 bg-gray-50 rounded-lg">
        <h4 className="text-base font-medium text-gray-900 mb-4">Upload Audio File</h4>

        {!audioFile ? (
          <label className="block cursor-pointer">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-[#5C4FE5] hover:bg-gray-100 transition-colors">
              <Upload size={48} className="mx-auto mb-4 text-gray-400" />
              <p className="text-sm font-medium text-gray-900 mb-1">
                Click to upload atau drag and drop
              </p>
              <p className="text-xs text-gray-600">
                MP3, WAV, atau M4A (max 50MB)
              </p>
            </div>
            <input
              type="file"
              accept="audio/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
        ) : (
          <div className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <Music size={20} className="text-red-700" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{audioFile.name}</p>
                <p className="text-xs text-gray-600">
                  {formatFileSize(audioFile.size)}
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
      </div>

      {/* Rich Text Editor */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-900">
            Text Content (Transcript) *
          </label>
          <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
            Rich Text Editor
          </span>
        </div>
        <RichTextEditor
          value={formData.textContent}
          onChange={(value) => setFormData({ ...formData, textContent: value })}
          placeholder="Masukkan text/transcript dari audio untuk pronunciation & listening practice..."
        />
        <p className="text-xs text-gray-600 mt-2">
          Text ini akan ditampilkan bersamaan dengan audio player
        </p>
      </div>

      {/* Skill Options */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Skill Focus
          </label>
          <select
            value={formData.skillFocus}
            onChange={(e) => setFormData({ ...formData, skillFocus: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] focus:border-transparent bg-white"
          >
            <option value="pronunciation">Pronunciation</option>
            <option value="listening">Listening</option>
            <option value="both">Both</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            CEFR Skill
          </label>
          <select
            value={formData.cefrSkill}
            onChange={(e) => setFormData({ ...formData, cefrSkill: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] focus:border-transparent bg-white"
          >
            <option value="speaking">Speaking</option>
            <option value="listening">Listening</option>
            <option value="reading">Reading</option>
            <option value="writing">Writing</option>
          </select>
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
