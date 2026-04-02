'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Plus, Trash2, ChevronUp, ChevronDown, Save,
  Headphones, Type, AlignLeft, Table, Highlighter,
  Upload, X, Play, Pause, Loader2, Check, ArrowLeft
} from 'lucide-react';

// ============================================================
// TYPES
// ============================================================
type BlockType = 'heading' | 'paragraph' | 'highlight' | 'table' | 'audio_sentence' | 'collapsible_group' | 'inline_highlight';

type HeadingBlock = {
  id: string; type: 'heading';
  level: 1 | 2 | 3;
  content: string;
};

type ParagraphBlock = {
  id: string; type: 'paragraph';
  content: string;
};

type HighlightBlock = {
  id: string; type: 'highlight';
  content: string;
  color: 'blue' | 'yellow' | 'green' | 'red';
};

type TableBlock = {
  id: string; type: 'table';
  headers: string[];
  rows: string[][];
};

type AudioSentenceBlock = {
  id: string; type: 'audio_sentence';
  text: string;
  translation: string;
  storage_path: string | null;
  storage_bucket: string;
};

type CollapsibleGroupItem = { id: string; text: string; translation: string; storage_path: string | null; storage_bucket: string };
type InlineSegment = { id: string; text: string; highlighted: boolean; color: 'blue'|'yellow'|'green'|'red'; storage_path: string | null; storage_bucket: string };

type CollapsibleGroupBlock = { id: string; type: 'collapsible_group'; header: string; color: 'blue'|'yellow'|'green'|'red'; items: CollapsibleGroupItem[] };
type InlineHighlightBlock = { id: string; type: 'inline_highlight'; segments: InlineSegment[] };

type Block = HeadingBlock | ParagraphBlock | HighlightBlock | TableBlock | AudioSentenceBlock | CollapsibleGroupBlock | InlineHighlightBlock;

type CEFRBlockEditorProps = {
  lessonId: string;
  lessonName: string;
  onBack: () => void;
};

// ============================================================
// HELPERS
// ============================================================
const generateId = () => `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const HIGHLIGHT_COLORS = {
  blue: 'bg-blue-50 border-blue-300 text-blue-900',
  yellow: 'bg-yellow-50 border-yellow-300 text-yellow-900',
  green: 'bg-green-50 border-green-300 text-green-900',
  red: 'bg-red-50 border-red-300 text-red-900',
};

const BLOCK_LABELS: Record<BlockType, string> = {
  heading: 'Heading',
  paragraph: 'Paragraf',
  highlight: 'Highlight Box',
  table: 'Tabel',
  audio_sentence: 'Kalimat + Audio',
  collapsible_group: 'Grup Dropdown',
  inline_highlight: 'Teks Inline+Audio',
};

const BLOCK_ICONS: Record<BlockType, any> = {
  heading: Type,
  paragraph: AlignLeft,
  highlight: Highlighter,
  table: Table,
  audio_sentence: Headphones,
  collapsible_group: ChevronDown,
  inline_highlight: Highlighter,
};

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function CEFRBlockEditor({ lessonId, lessonName, onBack }: CEFRBlockEditorProps) {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [uploadingAudioId, setUploadingAudioId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});
  const supabase = createClient();

  useEffect(() => {
    fetchBlocks();
  }, [lessonId]);

  const fetchBlocks = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/cefr/${lessonId}`);
      const data = await res.json();
      setBlocks(data.blocks || []);
      if (data.updated_at) {
        setSavedAt(new Date(data.updated_at).toLocaleTimeString('id-ID'));
      }
    } catch (err) {
      console.error('Error fetching blocks:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveBlocks = async (shouldExit = false) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/cefr/${lessonId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocks }),
      });
      if (!res.ok) throw new Error('Failed to save');
      setSavedAt(new Date().toLocaleTimeString('id-ID'));
      if (shouldExit) {
        onBack(); // ✅ Kembali ke daftar materi
      }
    } catch (err) {
      alert('❌ Gagal menyimpan konten');
    } finally {
      setSaving(false);
    }
  };

  // ── Block Operations ──────────────────────────────────────
  const addBlock = (type: BlockType) => {
    const id = generateId();
    let newBlock: Block;

    switch (type) {
      case 'heading':
        newBlock = { id, type, level: 2, content: '' };
        break;
      case 'paragraph':
        newBlock = { id, type, content: '' };
        break;
      case 'highlight':
        newBlock = { id, type, content: '', color: 'blue' };
        break;
      case 'table':
        newBlock = { id, type, headers: ['Kolom 1', 'Kolom 2'], rows: [['', '']] };
        break;
      case 'audio_sentence':
        newBlock = { id, type, text: '', translation: '', storage_path: null, storage_bucket: 'audio' };
        break;
      case 'collapsible_group':
        newBlock = { id, type, header: '', color: 'blue', items: [] };
        break;
      case 'inline_highlight':
        newBlock = { id, type, segments: [{ id: generateId(), text: '', highlighted: false, color: 'yellow', storage_path: null, storage_bucket: 'audio' }] };
        break;
    }

    setBlocks(prev => [...prev, newBlock]);
    setShowAddMenu(false);
  };

  const deleteBlock = (id: string) => {
    if (!confirm('Hapus block ini?')) return;
    setBlocks(prev => prev.filter(b => b.id !== id));
  };

  const moveBlock = (id: string, direction: 'up' | 'down') => {
    setBlocks(prev => {
      const idx = prev.findIndex(b => b.id === id);
      if (direction === 'up' && idx === 0) return prev;
      if (direction === 'down' && idx === prev.length - 1) return prev;
      const newBlocks = [...prev];
      const swap = direction === 'up' ? idx - 1 : idx + 1;
      [newBlocks[idx], newBlocks[swap]] = [newBlocks[swap], newBlocks[idx]];
      return newBlocks;
    });
  };

  const updateBlock = (id: string, updates: Partial<Block>) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, ...updates } as Block : b));
  };

  // ── Audio Operations ──────────────────────────────────────
  const uploadAudio = async (blockId: string, file: File) => {
    setUploadingAudioId(blockId);
    try {
      const formData = new FormData();
      formData.append('audio', file);

      const res = await fetch('/api/admin/cefr/audio', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();

      updateBlock(blockId, {
        storage_path: data.storage_path,
        storage_bucket: 'audio',
      });
    } catch (err) {
      alert('❌ Gagal upload audio');
    } finally {
      setUploadingAudioId(null);
    }
  };

  const deleteAudio = async (blockId: string, storagePath: string) => {
    try {
      await fetch('/api/admin/cefr/audio', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storage_path: storagePath }),
      });
      updateBlock(blockId, { storage_path: null });
    } catch (err) {
      alert('❌ Gagal hapus audio');
    }
  };

  const togglePlay = (blockId: string, storagePath: string) => {
    const audio = audioRefs.current[blockId];

    if (playingId === blockId && audio) {
      audio.pause();
      setPlayingId(null);
      return;
    }

    // Stop yang lain
    Object.entries(audioRefs.current).forEach(([id, a]) => {
      if (id !== blockId) a.pause();
    });

    if (!audioRefs.current[blockId]) {
      const { data } = supabase.storage.from('audio').getPublicUrl(storagePath);
      const newAudio = new Audio(data.publicUrl);
      newAudio.onended = () => setPlayingId(null);
      audioRefs.current[blockId] = newAudio;
    }

    audioRefs.current[blockId].play();
    setPlayingId(blockId);
  };

  // ── Collapsible Group Operations ─────────────────────────
  const addGroupItem = (blockId: string) => {
    setBlocks(prev => prev.map(b => {
      if (b.id !== blockId || b.type !== 'collapsible_group') return b;
      const newItem: CollapsibleGroupItem = { id: generateId(), text: '', translation: '', storage_path: null, storage_bucket: 'audio' };
      return { ...b, items: [...b.items, newItem] };
    }));
  };
  const updateGroupItem = (blockId: string, itemId: string, updates: Partial<CollapsibleGroupItem>) => {
    setBlocks(prev => prev.map(b => {
      if (b.id !== blockId || b.type !== 'collapsible_group') return b;
      return { ...b, items: b.items.map(item => item.id === itemId ? { ...item, ...updates } : item) };
    }));
  };
  const deleteGroupItem = (blockId: string, itemId: string) => {
    setBlocks(prev => prev.map(b => {
      if (b.id !== blockId || b.type !== 'collapsible_group') return b;
      return { ...b, items: b.items.filter(item => item.id !== itemId) };
    }));
  };
  const deleteGroupItemAudio = async (blockId: string, itemId: string, storagePath: string) => {
    try {
      await fetch('/api/admin/cefr/audio', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storage_path: storagePath }),
      });
      updateGroupItem(blockId, itemId, { storage_path: null });
    } catch { alert('❌ Gagal hapus audio'); }
  };

  const uploadGroupItemAudio = async (blockId: string, itemId: string, file: File) => {
    setUploadingAudioId(`${blockId}_${itemId}`);
    try {
      const formData = new FormData(); formData.append('audio', file);
      const res = await fetch('/api/admin/cefr/audio', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      updateGroupItem(blockId, itemId, { storage_path: data.storage_path });
    } catch { alert('❌ Gagal upload audio'); }
    finally { setUploadingAudioId(null); }
  };

  // ── Inline Highlight Operations ───────────────────────────
  const addSegment = (blockId: string) => {
    setBlocks(prev => prev.map(b => {
      if (b.id !== blockId || b.type !== 'inline_highlight') return b;
      const newSeg: InlineSegment = { id: generateId(), text: '', highlighted: false, color: 'yellow', storage_path: null, storage_bucket: 'audio' };
      return { ...b, segments: [...b.segments, newSeg] };
    }));
  };
  const updateSegment = (blockId: string, segId: string, updates: Partial<InlineSegment>) => {
    setBlocks(prev => prev.map(b => {
      if (b.id !== blockId || b.type !== 'inline_highlight') return b;
      return { ...b, segments: b.segments.map(s => s.id === segId ? { ...s, ...updates } : s) };
    }));
  };
  const deleteSegment = (blockId: string, segId: string) => {
    setBlocks(prev => prev.map(b => {
      if (b.id !== blockId || b.type !== 'inline_highlight') return b;
      return { ...b, segments: b.segments.filter(s => s.id !== segId) };
    }));
  };
  const deleteSegmentAudio = async (blockId: string, segId: string, storagePath: string) => {
    try {
      await fetch('/api/admin/cefr/audio', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storage_path: storagePath }),
      });
      updateSegment(blockId, segId, { storage_path: null });
    } catch { alert('❌ Gagal hapus audio'); }
  };

  const uploadSegmentAudio = async (blockId: string, segId: string, file: File) => {
    setUploadingAudioId(`${blockId}_${segId}`);
    try {
      const formData = new FormData(); formData.append('audio', file);
      const res = await fetch('/api/admin/cefr/audio', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      updateSegment(blockId, segId, { storage_path: data.storage_path });
    } catch { alert('❌ Gagal upload audio'); }
    finally { setUploadingAudioId(null); }
  };

  // ── Table Operations ──────────────────────────────────────
  const addTableRow = (blockId: string, colCount: number) => {
    setBlocks(prev => prev.map(b => {
      if (b.id !== blockId || b.type !== 'table') return b;
      return { ...b, rows: [...b.rows, Array(colCount).fill('')] };
    }));
  };

  const addTableCol = (blockId: string) => {
    setBlocks(prev => prev.map(b => {
      if (b.id !== blockId || b.type !== 'table') return b;
      return {
        ...b,
        headers: [...b.headers, `Kolom ${b.headers.length + 1}`],
        rows: b.rows.map(r => [...r, '']),
      };
    }));
  };

  const updateTableCell = (blockId: string, type: 'header' | 'cell', rowIdx: number, colIdx: number, value: string) => {
    setBlocks(prev => prev.map(b => {
      if (b.id !== blockId || b.type !== 'table') return b;
      if (type === 'header') {
        const headers = [...b.headers];
        headers[colIdx] = value;
        return { ...b, headers };
      } else {
        const rows = b.rows.map((r, ri) => ri === rowIdx ? r.map((c, ci) => ci === colIdx ? value : c) : r);
        return { ...b, rows };
      }
    }));
  };

  // ── Render Blocks ─────────────────────────────────────────
  const renderBlock = (block: Block, idx: number) => {
    const isFirst = idx === 0;
    const isLast = idx === blocks.length - 1;

    return (
      <div key={block.id} className="group relative bg-white border-2 border-gray-200 rounded-xl p-4 hover:border-[#5C4FE5] transition-colors">
        {/* Block Controls */}
        <div className="absolute right-3 top-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => moveBlock(block.id, 'up')} disabled={isFirst} className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30" title="Naik">
            <ChevronUp className="w-4 h-4" />
          </button>
          <button onClick={() => moveBlock(block.id, 'down')} disabled={isLast} className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30" title="Turun">
            <ChevronDown className="w-4 h-4" />
          </button>
          <button onClick={() => deleteBlock(block.id)} className="p-1 text-red-400 hover:text-red-600" title="Hapus">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Block Type Label */}
        <div className="flex items-center gap-2 mb-3">
          {(() => { const Icon = BLOCK_ICONS[block.type]; return <Icon className="w-4 h-4 text-[#5C4FE5]" />; })()}
          <span className="text-xs font-semibold text-[#5C4FE5] uppercase tracking-wide">{BLOCK_LABELS[block.type]}</span>
        </div>

        {/* Block Content Editor */}
        {block.type === 'heading' && (
          <div className="space-y-2">
            <div className="flex gap-2">
              {[1, 2, 3].map(l => (
                <button key={l} onClick={() => updateBlock(block.id, { level: l as 1|2|3 })}
                  className={`px-2 py-1 text-xs font-bold rounded ${block.level === l ? 'bg-[#5C4FE5] text-white' : 'bg-gray-100 text-gray-700'}`}>
                  H{l}
                </button>
              ))}
            </div>
            <input type="text" value={block.content}
              onChange={e => updateBlock(block.id, { content: e.target.value })}
              placeholder="Judul section..."
              className={`w-full bg-transparent border-b-2 border-gray-300 focus:border-[#5C4FE5] outline-none font-bold text-gray-900 pb-1
                ${block.level === 1 ? 'text-2xl' : block.level === 2 ? 'text-xl' : 'text-lg'}`}
            />
          </div>
        )}

        {block.type === 'paragraph' && (
          <textarea value={block.content}
            onChange={e => updateBlock(block.id, { content: e.target.value })}
            placeholder="Tulis paragraf penjelasan..."
            rows={4}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-900 focus:ring-2 focus:ring-[#5C4FE5] focus:border-[#5C4FE5] resize-y"
          />
        )}

        {block.type === 'highlight' && (
          <div className="space-y-2">
            <div className="flex gap-2">
              {(['blue', 'yellow', 'green', 'red'] as const).map(c => (
                <button key={c} onClick={() => updateBlock(block.id, { color: c })}
                  className={`px-3 py-1 text-xs font-semibold rounded-full border-2 capitalize
                    ${block.color === c ? 'border-gray-700' : 'border-gray-300'}
                    ${c === 'blue' ? 'bg-blue-100 text-blue-700' : c === 'yellow' ? 'bg-yellow-100 text-yellow-700' : c === 'green' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {c}
                </button>
              ))}
            </div>
            <textarea value={block.content}
              onChange={e => updateBlock(block.id, { content: e.target.value })}
              placeholder="Konten highlight box..."
              rows={3}
              className={`w-full border-2 rounded-lg p-3 text-sm font-medium resize-y focus:outline-none ${HIGHLIGHT_COLORS[block.color]}`}
            />
          </div>
        )}

        {block.type === 'table' && (
          <div className="overflow-x-auto space-y-3">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  {block.headers.map((h, ci) => (
                    <th key={ci} className="border border-gray-300 p-1">
                      <input value={h}
                        onChange={e => updateTableCell(block.id, 'header', 0, ci, e.target.value)}
                        className="w-full bg-gray-100 font-semibold text-gray-900 p-1 rounded text-center focus:outline-none focus:ring-1 focus:ring-[#5C4FE5]"
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => (
                      <td key={ci} className="border border-gray-300 p-1">
                        <input value={cell}
                          onChange={e => updateTableCell(block.id, 'cell', ri, ci, e.target.value)}
                          className="w-full text-gray-900 p-1 rounded focus:outline-none focus:ring-1 focus:ring-[#5C4FE5]"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex gap-2">
              <button onClick={() => addTableRow(block.id, block.headers.length)}
                className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 font-medium">
                + Tambah Baris
              </button>
              <button onClick={() => addTableCol(block.id)}
                className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 font-medium">
                + Tambah Kolom
              </button>
            </div>
          </div>
        )}

        {block.type === 'audio_sentence' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Teks Bahasa Inggris *</label>
                <input type="text" value={block.text}
                  onChange={e => updateBlock(block.id, { text: e.target.value })}
                  placeholder="I am a student."
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm font-medium text-gray-900 focus:ring-2 focus:ring-[#5C4FE5] focus:border-[#5C4FE5] bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Terjemahan Indonesia *</label>
                <input type="text" value={block.translation}
                  onChange={e => updateBlock(block.id, { translation: e.target.value })}
                  placeholder="Saya seorang siswa."
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm font-medium text-gray-900 focus:ring-2 focus:ring-[#5C4FE5] focus:border-[#5C4FE5] bg-white"
                />
              </div>
            </div>

            {/* Audio Upload */}
            <div className="flex items-center gap-3">
              {block.storage_path ? (
                <>
                  <button onClick={() => togglePlay(block.id, block.storage_path!)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-colors
                      ${playingId === block.id ? 'bg-purple-600 text-white' : 'bg-[#5C4FE5] text-white hover:bg-[#4a3ec7]'}`}>
                    {playingId === block.id
                      ? <><Pause className="w-4 h-4" /> Stop</>
                      : <><Play className="w-4 h-4" /> Play</>}
                  </button>
                  <span className="text-xs text-gray-500 font-mono flex-1">
                    {block.storage_path.split('/').pop()}
                  </span>
                  <button onClick={() => deleteAudio(block.id, block.storage_path!)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg" title="Hapus audio">
                    <X className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <label className={`flex items-center gap-2 px-4 py-2 border-2 border-dashed rounded-lg cursor-pointer transition-colors
                  ${uploadingAudioId === block.id ? 'border-purple-400 bg-purple-50' : 'border-gray-300 hover:border-[#5C4FE5] hover:bg-purple-50'}`}>
                  {uploadingAudioId === block.id
                    ? <><Loader2 className="w-4 h-4 text-[#5C4FE5] animate-spin" /><span className="text-sm text-[#5C4FE5] font-medium">Mengupload...</span></>
                    : <><Upload className="w-4 h-4 text-gray-500" /><span className="text-sm text-gray-600 font-medium">Upload Audio (.mp3)</span></>}
                  <input type="file" accept="audio/*" className="hidden"
                    disabled={!!uploadingAudioId}
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadAudio(block.id, f); }}
                  />
                </label>
              )}
            </div>
          </div>
        )}

        {/* ✅ COLLAPSIBLE GROUP */}
        {block.type === 'collapsible_group' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <label className="text-xs font-semibold text-gray-600">Warna Header:</label>
              {(['blue','yellow','green','red'] as const).map(c => (
                <button key={c} onClick={() => updateBlock(block.id, { color: c })}
                  className={`px-3 py-1 text-xs font-semibold rounded-full border-2 capitalize
                    ${(block as any).color === c ? 'border-gray-700' : 'border-gray-200'}
                    ${c === 'blue' ? 'bg-blue-100 text-blue-700' : c === 'yellow' ? 'bg-yellow-100 text-yellow-700' : c === 'green' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {c}
                </button>
              ))}
            </div>
            <input type="text" value={(block as any).header || ''}
              onChange={e => updateBlock(block.id, { header: e.target.value } as any)}
              placeholder="Teks header dropdown (contoh: Contoh langsung peraga)..."
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm font-semibold text-gray-900 focus:ring-2 focus:ring-[#5C4FE5] bg-white"
            />
            <div className="space-y-2 pl-4 border-l-4 border-[#5C4FE5]/30">
              {((block as any).items || []).map((item: any, idx: number) => {
                const audioKey = `${block.id}_${item.id}`;
                return (
                  <div key={item.id} className="bg-gray-50 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-500">Item {idx + 1}</span>
                      <button onClick={() => deleteGroupItem(block.id, item.id)} className="p-1 text-red-400 hover:text-red-600">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="text" value={item.text} onChange={e => updateGroupItem(block.id, item.id, { text: e.target.value })}
                        placeholder="I am a student." className="px-2 py-1.5 border border-gray-300 rounded text-sm text-gray-900 bg-white focus:ring-1 focus:ring-[#5C4FE5]" />
                      <input type="text" value={item.translation} onChange={e => updateGroupItem(block.id, item.id, { translation: e.target.value })}
                        placeholder="Saya seorang siswa." className="px-2 py-1.5 border border-gray-300 rounded text-sm text-gray-900 bg-white focus:ring-1 focus:ring-[#5C4FE5]" />
                    </div>
                    {item.storage_path ? (
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span className="font-mono">{item.storage_path.split('/').pop()}</span>
                        <button onClick={() => updateGroupItem(block.id, item.id, { storage_path: null })} className="text-red-400"><X className="w-3 h-3" /></button>
                      </div>
                    ) : (
                      <label className={`inline-flex items-center gap-2 px-3 py-1.5 border border-dashed rounded cursor-pointer text-xs ${uploadingAudioId === audioKey ? 'border-purple-400 bg-purple-50' : 'border-gray-300 hover:border-[#5C4FE5]'}`}>
                        {uploadingAudioId === audioKey ? <><Loader2 className="w-3 h-3 text-[#5C4FE5] animate-spin" />Uploading...</> : <><Upload className="w-3 h-3 text-gray-400" />Upload Audio</>}
                        <input type="file" accept="audio/*" className="hidden" disabled={!!uploadingAudioId}
                          onChange={e => { const f = e.target.files?.[0]; if (f) uploadGroupItemAudio(block.id, item.id, f); }} />
                      </label>
                    )}
                  </div>
                );
              })}
              <button onClick={() => addGroupItem(block.id)}
                className="w-full py-2 border-2 border-dashed border-[#5C4FE5]/40 text-[#5C4FE5] text-sm font-medium rounded-lg hover:bg-purple-50 transition-colors">
                + Tambah Item
              </button>
            </div>
          </div>
        )}

        {/* ✅ INLINE HIGHLIGHT */}
        {block.type === 'inline_highlight' && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500 font-medium px-1">
              Preview: {((block as any).segments || []).map((s: any) => s.text).join(' ')}
            </p>
            <div className="space-y-2">
              {((block as any).segments || []).map((seg: any, idx: number) => {
                const segKey = `${block.id}_${seg.id}`;
                return (
                  <div key={seg.id} className={`flex items-center gap-2 p-2 rounded-lg border flex-wrap ${seg.highlighted ? 'bg-yellow-50 border-yellow-300' : 'bg-gray-50 border-gray-200'}`}>
                    <span className="text-xs text-gray-400 w-4">{idx + 1}</span>
                    <input type="text" value={seg.text} onChange={e => updateSegment(block.id, seg.id, { text: e.target.value })}
                      placeholder="Teks..." className="flex-1 min-w-[120px] px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white focus:ring-1 focus:ring-[#5C4FE5]" />
                    <label className="flex items-center gap-1 text-xs font-medium text-gray-600 cursor-pointer">
                      <input type="checkbox" checked={seg.highlighted} onChange={e => updateSegment(block.id, seg.id, { highlighted: e.target.checked })} className="w-3 h-3" />
                      Highlight
                    </label>
                    {seg.highlighted && (
                      <div className="flex items-center gap-1">
                        {(['blue','yellow','green','red'] as const).map(c => (
                          <button key={c} onClick={() => updateSegment(block.id, seg.id, { color: c })}
                            className={`w-4 h-4 rounded-full border-2 ${seg.color === c ? 'border-gray-700' : 'border-transparent'} ${c === 'blue' ? 'bg-blue-400' : c === 'yellow' ? 'bg-yellow-400' : c === 'green' ? 'bg-green-400' : 'bg-red-400'}`} />
                        ))}
                        {seg.storage_path ? (
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <span className="font-mono truncate max-w-[80px]">{seg.storage_path.split('/').pop()}</span>
                            <button onClick={() => deleteSegmentAudio(block.id, seg.id, seg.storage_path!)} className="text-red-400"><X className="w-3 h-3" /></button>
                          </div>
                        ) : (
                          <label className={`flex items-center gap-1 px-2 py-0.5 border border-dashed rounded cursor-pointer text-xs ${uploadingAudioId === segKey ? 'border-purple-400' : 'border-gray-300 hover:border-[#5C4FE5]'}`}>
                            {uploadingAudioId === segKey ? <Loader2 className="w-3 h-3 text-[#5C4FE5] animate-spin" /> : <><Upload className="w-3 h-3 text-gray-400" /><span>Audio</span></>}
                            <input type="file" accept="audio/*" className="hidden" disabled={!!uploadingAudioId}
                              onChange={e => { const f = e.target.files?.[0]; if (f) uploadSegmentAudio(block.id, seg.id, f); }} />
                          </label>
                        )}
                      </div>
                    )}
                    <button onClick={() => deleteSegment(block.id, seg.id)} className="p-1 text-red-400 hover:text-red-600"><X className="w-3 h-3" /></button>
                  </div>
                );
              })}
            </div>
            <button onClick={() => addSegment(block.id)}
              className="w-full py-1.5 border-2 border-dashed border-[#5C4FE5]/40 text-[#5C4FE5] text-xs font-medium rounded-lg hover:bg-purple-50 transition-colors">
              + Tambah Segmen
            </button>
          </div>
        )}
      </div>
    );
  };

  // ── Main Render ───────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center p-16">
        <div className="animate-spin w-10 h-10 border-4 border-[#5C4FE5] border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Block Editor CEFR</h2>
            <p className="text-sm text-gray-500">Lesson: <span className="font-semibold text-[#5C4FE5]">{lessonName}</span></p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {savedAt && (
            <div className="flex items-center gap-1 text-xs text-green-600">
              <Check className="w-3 h-3" />
              Tersimpan {savedAt}
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={() => saveBlocks(false)} disabled={saving}
              className="flex items-center gap-2 px-4 py-2.5 border-2 border-[#5C4FE5] text-[#5C4FE5] rounded-lg hover:bg-purple-50 disabled:opacity-50 font-semibold transition-all">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Simpan
            </button>
            <button onClick={() => saveBlocks(true)} disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#5C4FE5] text-white rounded-lg hover:bg-[#4a3ec7] disabled:opacity-50 font-semibold shadow-md transition-all">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Simpan & Keluar
            </button>
          </div>
        </div>
      </div>

      {/* Blocks */}
      <div className="space-y-3">
        {blocks.length === 0 && (
          <div className="text-center py-16 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
            <Headphones className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">Belum ada konten</p>
            <p className="text-sm mt-1">Klik "+ Tambah Block" untuk mulai menambahkan konten</p>
          </div>
        )}
        {blocks.map((block, idx) => renderBlock(block, idx))}
      </div>

      {/* Add Block Button */}
      <div className="relative">
        <button onClick={() => setShowAddMenu(prev => !prev)}
          className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-[#5C4FE5] text-[#5C4FE5] rounded-xl hover:bg-purple-50 font-semibold transition-colors">
          <Plus className="w-5 h-5" />
          Tambah Block
        </button>

        {showAddMenu && (
          <div className="absolute bottom-full mb-2 left-0 right-0 bg-white border-2 border-[#5C4FE5] rounded-xl shadow-xl p-3 z-10">
            <p className="text-xs font-semibold text-gray-500 mb-2 px-1">Pilih tipe block:</p>
            <div className="grid grid-cols-7 gap-2">
              {(Object.keys(BLOCK_LABELS) as BlockType[]).map(type => {
                const Icon = BLOCK_ICONS[type];
                return (
                  <button key={type} onClick={() => addBlock(type)}
                    className="flex flex-col items-center gap-1 p-3 rounded-lg hover:bg-purple-50 text-gray-700 hover:text-[#5C4FE5] transition-colors border border-gray-200 hover:border-[#5C4FE5]">
                    <Icon className="w-5 h-5" />
                    <span className="text-xs font-medium text-center">{BLOCK_LABELS[type]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Block count info */}
      {blocks.length > 0 && (
        <div className="text-xs text-gray-400 text-center">
          {blocks.length} block · {blocks.filter(b => b.type === 'audio_sentence').length} audio sentence
        </div>
      )}
    </div>
  );
}
