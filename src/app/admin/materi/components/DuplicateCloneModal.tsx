'use client';

import { useState, useEffect } from 'react';
import { X, Copy, Layers, Loader2, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type Props = {
  mode: 'duplicate' | 'clone';
  // Duplicate mode
  materialId?: string;
  materialTitle?: string;
  sourceChapterTitle?: string;
  sourceUnitName?: string;
  sourceLessonName?: string;
  // Clone mode
  chapterId?: string;
  chapterTitle?: string;
  unitCount?: number;
  lessonCount?: number;
  // Shared
  currentLevelId: string;
  currentLevelName: string;
  onClose: () => void;
  onSuccess: () => void;
};

export default function DuplicateCloneModal({
  mode, materialId, materialTitle, sourceChapterTitle, sourceUnitName, sourceLessonName,
  chapterId, chapterTitle, unitCount, lessonCount,
  currentLevelId, currentLevelName, onClose, onSuccess,
}: Props) {
  const [levels, setLevels] = useState<{ id: string; name: string }[]>([]);
  const [targetLevelId, setTargetLevelId] = useState('');
  const [targetLevelName, setTargetLevelName] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  const isDuplicate = mode === 'duplicate';
  const title = isDuplicate ? 'Duplikat materi ke level lain' : 'Clone struktur ke level lain';
  const Icon = isDuplicate ? Copy : Layers;

  useEffect(() => {
    fetchLevels();
  }, []);

  useEffect(() => {
    if (targetLevelId) {
      const lvl = levels.find(l => l.id === targetLevelId);
      setTargetLevelName(lvl?.name || '');
    }
  }, [targetLevelId]);

  const fetchLevels = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('levels')
      .select('id, name')
      .order('sort_order');
    setLevels((data || []).filter(l => l.id !== currentLevelId));
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!targetLevelId) {
      alert('❌ Pilih level tujuan!');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/admin/structure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isDuplicate
            ? { action: 'duplicate_material', material_id: materialId, target_level_id: targetLevelId }
            : { action: 'clone_chapter', chapter_id: chapterId, target_level_id: targetLevelId }
        ),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.details || data.error);

      alert(`✅ ${data.message}`);
      onSuccess();
    } catch (err) {
      alert(`❌ Gagal: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-lg shadow-xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Icon className="w-5 h-5 text-[#5C4FE5]" />
            <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Source info */}
          {isDuplicate ? (
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Material yang diduplikat</label>
              <div className="mt-1 px-4 py-3 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="font-bold text-[#5C4FE5]">{materialTitle}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {sourceChapterTitle} → {sourceUnitName} → {sourceLessonName}
                </div>
              </div>
            </div>
          ) : (
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Chapter yang di-clone</label>
              <div className="mt-1 px-4 py-3 bg-purple-50 border border-purple-200 rounded-lg">
                <span className="font-bold text-[#5C4FE5]">{chapterTitle}</span>
                <span className="ml-2 px-2 py-0.5 bg-purple-200 text-purple-800 text-xs font-semibold rounded">
                  {unitCount} unit · {lessonCount} lesson
                </span>
              </div>
            </div>
          )}

          {/* From level */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Dari level</label>
            <div className="mt-1 px-4 py-3 bg-gray-100 rounded-lg text-gray-600 font-medium">
              {currentLevelName}
            </div>
          </div>

          {/* Target level */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {isDuplicate ? 'Duplikat ke level' : 'Clone ke level'}
            </label>
            {loading ? (
              <div className="mt-1 flex items-center gap-2 text-gray-400 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Memuat level...
              </div>
            ) : (
              <select
                value={targetLevelId}
                onChange={(e) => setTargetLevelId(e.target.value)}
                className="mt-1 w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#5C4FE5] focus:ring-2 focus:ring-[#5C4FE5]/20 bg-white font-medium"
              >
                <option value="">— Pilih level tujuan —</option>
                {levels.map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Info box */}
          {targetLevelId && (
            <div className="flex gap-2 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-blue-800">
                {isDuplicate ? (
                  <>
                    Material <strong>"{materialTitle}"</strong> akan diduplikat ke <strong>{targetLevelName}</strong>.
                    Struktur chapter/unit/lesson akan dibuat otomatis jika belum ada. File ikut ter-copy. Status default: Draft.
                  </>
                ) : (
                  <>
                    Struktur <strong>"{chapterTitle}"</strong> ({unitCount} unit, {lessonCount} lesson) akan di-clone
                    ke <strong>{targetLevelName}</strong>. Hanya struktur — <strong>tanpa materi dan file</strong>.
                  </>
                )}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button onClick={onClose} disabled={saving}
            className="px-5 py-2.5 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50">
            Batal
          </button>
          <button onClick={handleSubmit} disabled={saving || !targetLevelId}
            className="px-5 py-2.5 bg-[#5C4FE5] text-white font-semibold rounded-lg hover:bg-[#4a3ec7] transition-colors disabled:opacity-50 flex items-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Memproses...' : isDuplicate ? 'Duplikat' : 'Clone struktur'}
          </button>
        </div>
      </div>
    </div>
  );
}
