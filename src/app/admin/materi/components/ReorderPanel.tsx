'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, GripVertical, Loader2, RotateCcw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type ReorderItem = {
  id: string;
  name: string;
  position: number;
  childCount: number;
};

type Props = {
  mode: 'units' | 'lessons';
  parentId: string;           // chapter_id for units, unit_id for lessons
  parentName: string;         // chapter title or unit name
  parentBadge?: string;       // e.g. level name
  onClose: () => void;
  onSuccess: () => void;
};

export default function ReorderPanel({ mode, parentId, parentName, parentBadge, onClose, onSuccess }: Props) {
  const [items, setItems] = useState<ReorderItem[]>([]);
  const [originalItems, setOriginalItems] = useState<ReorderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const supabase = createClient();

  const isUnits = mode === 'units';
  const label = isUnits ? 'unit' : 'lesson';
  const childLabel = isUnits ? 'lesson' : 'materi';

  useEffect(() => {
    fetchItems();
  }, [parentId]);

  const fetchItems = async () => {
    setLoading(true);

    if (isUnits) {
      // Fetch units in this chapter
      const { data: units } = await supabase
        .from('units')
        .select('id, unit_name, position')
        .eq('chapter_id', parentId)
        .order('position', { ascending: true });

      if (units) {
        // Count lessons per unit
        const unitIds = units.map(u => u.id);
        const { data: lessons } = await supabase
          .from('lessons')
          .select('id, unit_id')
          .in('unit_id', unitIds);

        const lessonCountMap: Record<string, number> = {};
        lessons?.forEach(l => {
          lessonCountMap[l.unit_id] = (lessonCountMap[l.unit_id] || 0) + 1;
        });

        const mapped = units.map(u => ({
          id: u.id,
          name: u.unit_name,
          position: u.position || 0,
          childCount: lessonCountMap[u.id] || 0,
        }));
        setItems(mapped);
        setOriginalItems(mapped);
      }
    } else {
      // Fetch lessons in this unit
      const { data: lessons } = await supabase
        .from('lessons')
        .select('id, lesson_name, position')
        .eq('unit_id', parentId)
        .order('position', { ascending: true });

      if (lessons) {
        // Count materials per lesson
        const lessonIds = lessons.map(l => l.id);
        const { data: materials } = await supabase
          .from('materials')
          .select('id, lesson_id')
          .in('lesson_id', lessonIds);

        const materialCountMap: Record<string, number> = {};
        materials?.forEach(m => {
          materialCountMap[m.lesson_id] = (materialCountMap[m.lesson_id] || 0) + 1;
        });

        const mapped = lessons.map(l => ({
          id: l.id,
          name: l.lesson_name,
          position: l.position || 0,
          childCount: materialCountMap[l.id] || 0,
        }));
        setItems(mapped);
        setOriginalItems(mapped);
      }
    }

    setLoading(false);
  };

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  }, []);

  const handleDrop = (index: number) => {
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newItems = [...items];
    const [movedItem] = newItems.splice(dragIndex, 1);
    newItems.splice(index, 0, movedItem);
    setItems(newItems);
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  // Mobile: move up/down buttons
  const moveItem = (fromIndex: number, direction: 'up' | 'down') => {
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= items.length) return;

    const newItems = [...items];
    [newItems[fromIndex], newItems[toIndex]] = [newItems[toIndex], newItems[fromIndex]];
    setItems(newItems);
  };

  const handleReset = () => {
    setItems([...originalItems]);
  };

  const hasChanges = JSON.stringify(items.map(i => i.id)) !== JSON.stringify(originalItems.map(i => i.id));

  const handleSave = async () => {
    if (!hasChanges) {
      onClose();
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/admin/structure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: isUnits ? 'reorder_units' : 'reorder_lessons',
          ...(isUnits ? { chapter_id: parentId } : { unit_id: parentId }),
          ...(isUnits ? { unit_ids: items.map(i => i.id) } : { lesson_ids: items.map(i => i.id) }),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.details || data.error);

      alert(`✅ ${data.message}`);
      onSuccess();
    } catch (err) {
      alert(`❌ Gagal update urutan: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Reorder {label}</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {parentName}
              {parentBadge && <span className="ml-1 text-[#5C4FE5]">({parentBadge})</span>}
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-8 gap-2 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Memuat {label}...</span>
            </div>
          ) : items.length === 0 ? (
            <p className="text-center text-gray-400 py-8">Belum ada {label} di sini</p>
          ) : (
            <>
              <p className="text-xs text-gray-400 mb-3">Drag & drop atau gunakan tombol ↑↓ untuk mengubah urutan</p>
              <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                {items.map((item, index) => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={() => handleDrop(index)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all cursor-grab active:cursor-grabbing
                      ${dragIndex === index
                        ? 'opacity-50 border-dashed border-[#5C4FE5] bg-purple-50'
                        : dragOverIndex === index
                          ? 'border-[#5C4FE5] bg-purple-50 shadow-sm'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }
                    `}
                  >
                    <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0" />
                    <span className="w-6 h-6 flex items-center justify-center bg-gray-100 text-gray-500 text-xs font-bold rounded">
                      {index + 1}
                    </span>
                    <span className="flex-1 text-sm font-semibold text-gray-800 truncate">{item.name}</span>
                    <span className="text-xs text-gray-400 flex-shrink-0">{item.childCount} {childLabel}</span>
                    {/* Mobile up/down */}
                    <div className="flex flex-col gap-0.5 sm:hidden">
                      <button
                        onClick={(e) => { e.stopPropagation(); moveItem(index, 'up'); }}
                        disabled={index === 0}
                        className="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs"
                      >▲</button>
                      <button
                        onClick={(e) => { e.stopPropagation(); moveItem(index, 'down'); }}
                        disabled={index === items.length - 1}
                        className="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs"
                      >▼</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
          <button
            onClick={handleReset}
            disabled={!hasChanges || saving}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-30 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-5 py-2.5 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Batal
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="px-5 py-2.5 bg-[#5C4FE5] text-white font-semibold rounded-lg hover:bg-[#4a3ec7] transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? 'Menyimpan...' : 'Simpan urutan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
