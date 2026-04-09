'use client';

import { useState, useEffect } from 'react';
import { X, ArrowDown, Loader2, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type Props = {
  unitId: string;
  unitName: string;
  currentChapterId: string;
  currentChapterTitle: string;
  currentLevelName: string;
  lessonCount: number;
  onClose: () => void;
  onSuccess: () => void;
};

export default function MoveUnitModal({
  unitId, unitName, currentChapterId, currentChapterTitle, currentLevelName,
  lessonCount, onClose, onSuccess,
}: Props) {
  const [levels, setLevels] = useState<{ id: string; name: string }[]>([]);
  const [chapters, setChapters] = useState<{ id: string; chapter_title: string; level_id: string }[]>([]);
  const [selectedLevelId, setSelectedLevelId] = useState('');
  const [targetChapterId, setTargetChapterId] = useState('');
  const [targetChapterTitle, setTargetChapterTitle] = useState('');
  const [targetPosition, setTargetPosition] = useState<'end' | number>('end');
  const [existingUnitCount, setExistingUnitCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    fetchLevels();
  }, []);

  useEffect(() => {
    if (selectedLevelId) {
      fetchChapters(selectedLevelId);
      setTargetChapterId('');
      setTargetPosition('end');
    } else {
      setChapters([]);
    }
  }, [selectedLevelId]);

  useEffect(() => {
    if (targetChapterId) {
      fetchUnitCount(targetChapterId);
      const ch = chapters.find(c => c.id === targetChapterId);
      setTargetChapterTitle(ch?.chapter_title || '');
      setTargetPosition('end');
    }
  }, [targetChapterId]);

  const fetchLevels = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('levels')
      .select('id, name')
      .order('sort_order');
    setLevels(data || []);
    setLoading(false);
  };

  const fetchChapters = async (levelId: string) => {
    const { data } = await supabase
      .from('chapters')
      .select('id, chapter_title, level_id')
      .eq('level_id', levelId)
      .order('order_number');

    // Filter out current chapter
    setChapters((data || []).filter(c => c.id !== currentChapterId));
  };

  const fetchUnitCount = async (chapterId: string) => {
    const { count } = await supabase
      .from('units')
      .select('id', { count: 'exact', head: true })
      .eq('chapter_id', chapterId);
    setExistingUnitCount(count || 0);
  };

  const handleSubmit = async () => {
    if (!targetChapterId) {
      alert('❌ Pilih chapter tujuan!');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/admin/structure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'move_unit',
          unit_id: unitId,
          target_chapter_id: targetChapterId,
          target_position: targetPosition === 'end' ? null : targetPosition,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.details || data.error);

      alert(`✅ ${data.message}`);
      onSuccess();
    } catch (err) {
      alert(`❌ Gagal pindah unit: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const positionOptions = [];
  for (let i = 1; i <= existingUnitCount + 1; i++) {
    positionOptions.push(i);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-lg shadow-xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">Pindah unit ke chapter lain</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Unit info */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Unit</label>
            <div className="mt-1 px-4 py-3 bg-purple-50 border border-purple-200 rounded-lg">
              <span className="font-bold text-[#5C4FE5]">{unitName}</span>
              <span className="ml-2 px-2 py-0.5 bg-purple-200 text-purple-800 text-xs font-semibold rounded">
                {lessonCount} lesson
              </span>
            </div>
          </div>

          {/* From chapter */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Dari chapter</label>
            <div className="mt-1 px-4 py-3 bg-gray-100 rounded-lg text-gray-600 font-medium">
              {currentChapterTitle} <span className="text-gray-400">({currentLevelName})</span>
            </div>
          </div>

          {/* Arrow */}
          <div className="flex justify-center">
            <ArrowDown className="w-6 h-6 text-[#5C4FE5]" />
          </div>

          {/* Filter by level first */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Pilih level</label>
            {loading ? (
              <div className="mt-1 flex items-center gap-2 text-gray-400 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Memuat...
              </div>
            ) : (
              <select
                value={selectedLevelId}
                onChange={(e) => setSelectedLevelId(e.target.value)}
                className="mt-1 w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#5C4FE5] focus:ring-2 focus:ring-[#5C4FE5]/20 bg-white font-medium"
              >
                <option value="">— Pilih level —</option>
                {levels.map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Target chapter */}
          {selectedLevelId && (
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Pindah ke chapter</label>
              {chapters.length === 0 ? (
                <p className="mt-1 text-sm text-gray-400">Tidak ada chapter lain di level ini</p>
              ) : (
                <select
                  value={targetChapterId}
                  onChange={(e) => setTargetChapterId(e.target.value)}
                  className="mt-1 w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#5C4FE5] focus:ring-2 focus:ring-[#5C4FE5]/20 bg-white font-medium"
                >
                  <option value="">— Pilih chapter tujuan —</option>
                  {chapters.map(c => (
                    <option key={c.id} value={c.id}>{c.chapter_title}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Target position */}
          {targetChapterId && (
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Posisi di chapter tujuan</label>
              <select
                value={targetPosition === 'end' ? 'end' : targetPosition}
                onChange={(e) => setTargetPosition(e.target.value === 'end' ? 'end' : parseInt(e.target.value))}
                className="mt-1 w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#5C4FE5] focus:ring-2 focus:ring-[#5C4FE5]/20 bg-white font-medium"
              >
                <option value="end">Di akhir (setelah unit terakhir)</option>
                {positionOptions.map(i => (
                  <option key={i} value={i}>Posisi ke-{i}</option>
                ))}
              </select>
            </div>
          )}

          {/* Info box */}
          {targetChapterId && (
            <div className="flex gap-2 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-blue-800">
                Unit <strong>"{unitName}"</strong> beserta {lessonCount} lesson akan dipindah
                ke chapter <strong>"{targetChapterTitle}"</strong>. Lesson dan materi tetap utuh.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-5 py-2.5 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Batal
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !targetChapterId}
            className="px-5 py-2.5 bg-[#5C4FE5] text-white font-semibold rounded-lg hover:bg-[#4a3ec7] transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Memindah...' : 'Pindah unit'}
          </button>
        </div>
      </div>
    </div>
  );
}
