'use client';

import { useState, useEffect } from 'react';
import { Upload, FileAudio, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type Material = {
  id: string;
  title: string;
  content_data: any;
  order_number: number;
  is_published: boolean;
};

type CEFRFormProps = {
  onSave: () => void;
  onCancel: () => void;
  editData?: Material | null;
};

export default function CEFRForm({ onSave, onCancel, editData }: CEFRFormProps) {
  const [courses, setCourses] = useState<any[]>([]);
  const [levels, setLevels] = useState<any[]>([]);
  const [juduls, setJuduls] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [lessons, setLessons] = useState<any[]>([]);

  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('');
  const [selectedJudul, setSelectedJudul] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('');
  const [selectedLesson, setSelectedLesson] = useState('');

  const [newJudulName, setNewJudulName] = useState('');
  const [newUnitName, setNewUnitName] = useState('');
  const [newLessonName, setNewLessonName] = useState('');

  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [transcript, setTranscript] = useState('');
  const [skillFocus, setSkillFocus] = useState('listening');
  const [orderNumber, setOrderNumber] = useState(1);
  const [isPublished, setIsPublished] = useState(false);

  const [loading, setLoading] = useState(false);

  const supabase = createClient();

  const isEditing = !!editData;

  useEffect(() => {
    fetchCourses();
  }, []);

  useEffect(() => {
    if (editData) {
      // Pre-fill form with edit data
      setTranscript(editData.content_data?.transcript || '');
      setSkillFocus(editData.content_data?.skill_focus || 'listening');
      setOrderNumber(editData.order_number || 1);
      setIsPublished(editData.is_published || false);
    }
  }, [editData]);

  const fetchCourses = async () => {
    const { data } = await supabase.from('courses').select('*').eq('is_active', true);
    setCourses(data || []);
  };

  const fetchLevels = async (courseId: string) => {
    const { data } = await supabase.from('levels').select('*').eq('course_id', courseId);
    setLevels(data || []);
  };

  const fetchJuduls = async (levelId: string) => {
    const { data } = await supabase.from('juduls').select('*').eq('level_id', levelId);
    setJuduls(data || []);
  };

  const fetchUnits = async (judulId: string) => {
    const { data } = await supabase.from('units').select('*').eq('judul_id', judulId);
    setUnits(data || []);
  };

  const fetchLessons = async (unitId: string) => {
    const { data } = await supabase.from('lessons').select('*').eq('unit_id', unitId);
    setLessons(data || []);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validExtensions = ['.mp3', '.wav', '.m4a'];
      const fileExtension = file.name.slice(file.name.lastIndexOf('.'));
      
      if (!validExtensions.includes(fileExtension)) {
        alert('File harus berformat audio (.mp3, .wav, .m4a)');
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        alert('File terlalu besar! Maksimal 10MB');
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
    setLoading(true);

    try {
      const formData = new FormData();

      if (isEditing) {
        // UPDATE existing material
        formData.append('material_id', editData.id);
        formData.append('title', newLessonName || selectedLesson);
        formData.append('order_number', orderNumber.toString());
        formData.append('is_published', isPublished.toString());
        formData.append('content_data', JSON.stringify({ 
          transcript,
          skill_focus: skillFocus
        }));

        // Add new audio file if selected
        if (audioFile) {
          formData.append('file', audioFile);
        }

        const response = await fetch('/api/admin/materials', {
          method: 'PATCH',
          body: formData,
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to update material');
        }

        alert('✅ Material berhasil diupdate!');
      } else {
        // CREATE new material
        if (!audioFile) {
          alert('File audio harus diupload!');
          setLoading(false);
          return;
        }

        formData.append('title', newLessonName || selectedLesson);
        formData.append('type', 'audio');
        formData.append('category', 'cefr');
        formData.append('course_id', selectedCourse);
        formData.append('level_id', selectedLevel);
        formData.append('judul_id', selectedJudul === 'NEW' ? 'NEW' : selectedJudul);
        formData.append('judul_name', newJudulName);
        formData.append('unit_id', selectedUnit === 'NEW' ? 'NEW' : selectedUnit);
        formData.append('unit_name', newUnitName);
        formData.append('lesson_id', selectedLesson === 'NEW' ? 'NEW' : selectedLesson);
        formData.append('lesson_name', newLessonName);
        formData.append('order_number', orderNumber.toString());
        formData.append('is_published', isPublished.toString());
        formData.append('content_data', JSON.stringify({ 
          transcript,
          skill_focus: skillFocus
        }));
        formData.append('file', audioFile);

        const response = await fetch('/api/admin/materials', {
          method: 'POST',
          body: formData,
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to create material');
        }

        alert('✅ Material CEFR berhasil dibuat!');
      }

      onSave();
    } catch (error) {
      console.error('Error:', error);
      alert(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Only show hierarchy fields when creating (not editing) */}
      {!isEditing && (
        <>
          {/* Course Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mata Pelajaran *
            </label>
            <select
              value={selectedCourse}
              onChange={(e) => {
                setSelectedCourse(e.target.value);
                fetchLevels(e.target.value);
              }}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5]"
            >
              <option value="">Pilih Mata Pelajaran</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Level Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Level *
            </label>
            <select
              value={selectedLevel}
              onChange={(e) => {
                setSelectedLevel(e.target.value);
                fetchJuduls(e.target.value);
              }}
              required
              disabled={!selectedCourse}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] disabled:bg-gray-100"
            >
              <option value="">Pilih Level</option>
              {levels.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>

          {/* Judul */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Judul *
            </label>
            <select
              value={selectedJudul}
              onChange={(e) => {
                setSelectedJudul(e.target.value);
                if (e.target.value !== 'NEW') {
                  fetchUnits(e.target.value);
                }
              }}
              required
              disabled={!selectedLevel}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] disabled:bg-gray-100"
            >
              <option value="">Pilih Judul</option>
              <option value="NEW">+ Buat Judul Baru</option>
              {juduls.map((j) => (
                <option key={j.id} value={j.id}>{j.name}</option>
              ))}
            </select>
            {selectedJudul === 'NEW' && (
              <input
                type="text"
                value={newJudulName}
                onChange={(e) => setNewJudulName(e.target.value)}
                placeholder="Nama Judul Baru"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] mt-2"
              />
            )}
          </div>

          {/* Unit */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Unit *
            </label>
            <select
              value={selectedUnit}
              onChange={(e) => {
                setSelectedUnit(e.target.value);
                if (e.target.value !== 'NEW') {
                  fetchLessons(e.target.value);
                }
              }}
              required
              disabled={!selectedJudul}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] disabled:bg-gray-100"
            >
              <option value="">Pilih Unit</option>
              <option value="NEW">+ Buat Unit Baru</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>{u.unit_name}</option>
              ))}
            </select>
            {selectedUnit === 'NEW' && (
              <input
                type="text"
                value={newUnitName}
                onChange={(e) => setNewUnitName(e.target.value)}
                placeholder="Nama Unit Baru"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] mt-2"
              />
            )}
          </div>

          {/* Lesson */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Lesson (Nama Materi) *
            </label>
            <select
              value={selectedLesson}
              onChange={(e) => setSelectedLesson(e.target.value)}
              required
              disabled={!selectedUnit}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] disabled:bg-gray-100"
            >
              <option value="">Pilih Lesson</option>
              <option value="NEW">+ Buat Lesson Baru</option>
              {lessons.map((l) => (
                <option key={l.id} value={l.id}>{l.lesson_name}</option>
              ))}
            </select>
            {selectedLesson === 'NEW' && (
              <input
                type="text"
                value={newLessonName}
                onChange={(e) => setNewLessonName(e.target.value)}
                placeholder="Nama Lesson Baru (akan menjadi judul materi)"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5] mt-2"
              />
            )}
          </div>
        </>
      )}

      {/* Material Content Fields (shown for both create and edit) */}
      {isEditing && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-blue-800">
            <strong>Editing:</strong> {editData.title}
          </p>
        </div>
      )}

      {/* Audio File Upload */}
      <div className="p-6 bg-gray-50 rounded-lg">
        <h4 className="text-base font-medium text-gray-900 mb-4">
          Upload Audio File {isEditing && '(Upload file baru untuk replace)'}
        </h4>

        {!audioFile ? (
          <label className="block cursor-pointer">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-[#5C4FE5] hover:bg-gray-100 transition-colors">
              <Upload size={48} className="mx-auto mb-4 text-gray-400" />
              <p className="text-sm font-medium text-gray-900 mb-1">
                Click to upload atau drag and drop
              </p>
              <p className="text-xs text-gray-600">
                File audio .mp3, .wav, .m4a (max 10MB)
              </p>
            </div>
            <input
              type="file"
              accept=".mp3,.wav,.m4a"
              onChange={handleFileChange}
              className="hidden"
              disabled={loading}
            />
          </label>
        ) : (
          <div className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <FileAudio size={20} className="text-purple-700" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{audioFile.name}</p>
                <p className="text-xs text-gray-600">
                  {(audioFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRemoveFile}
              disabled={loading}
              className="p-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
            >
              <X size={18} />
            </button>
          </div>
        )}
      </div>

      {/* Skill Focus */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Skill Focus *
        </label>
        <select
          value={skillFocus}
          onChange={(e) => setSkillFocus(e.target.value)}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5]"
        >
          <option value="listening">Listening</option>
          <option value="speaking">Speaking</option>
          <option value="pronunciation">Pronunciation</option>
        </select>
      </div>

      {/* Transcript */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Transcript *
        </label>
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Full transcript of the audio..."
          rows={6}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5]"
          disabled={loading}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Order Number *
        </label>
        <input
          type="number"
          value={orderNumber}
          onChange={(e) => setOrderNumber(parseInt(e.target.value))}
          min="1"
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C4FE5]"
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isPublished"
          checked={isPublished}
          onChange={(e) => setIsPublished(e.target.checked)}
          className="w-4 h-4 text-[#5C4FE5] focus:ring-[#5C4FE5]"
        />
        <label htmlFor="isPublished" className="text-sm font-medium text-gray-700">
          Publish (siswa bisa lihat)
        </label>
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
        >
          Batal
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 px-4 py-2 bg-[#5C4FE5] text-white rounded-lg hover:bg-[#4a3ec7] disabled:opacity-50"
        >
          {loading ? 'Menyimpan...' : isEditing ? 'Update' : 'Simpan'}
        </button>
      </div>
    </form>
  );
}
