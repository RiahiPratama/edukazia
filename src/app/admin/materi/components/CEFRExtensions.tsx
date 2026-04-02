import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import React, { useState, useRef } from 'react'
import { NodeViewWrapper } from '@tiptap/react'
import { createClient } from '@/lib/supabase/client'
import { Play, Pause, Upload, X, Loader2, Plus, Trash2 } from 'lucide-react'

// ============================================================
// AUDIO SENTENCE NODE
// ============================================================
const AudioSentenceView = ({ node, updateAttributes, deleteNode }: any) => {
  const [uploading, setUploading] = useState(false)
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const supabase = createClient()

  const uploadAudio = async (file: File) => {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('audio', file)
      const res = await fetch('/api/admin/cefr/audio', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Upload failed')
      const data = await res.json()
      updateAttributes({ storagePath: data.storage_path, storageBucket: 'audio' })
    } catch { alert('❌ Gagal upload audio') }
    finally { setUploading(false) }
  }

  const deleteAudio = async () => {
    if (!node.attrs.storagePath) return
    try {
      await fetch('/api/admin/cefr/audio', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storage_path: node.attrs.storagePath }),
      })
      updateAttributes({ storagePath: null })
    } catch { alert('❌ Gagal hapus audio') }
  }

  const togglePlay = () => {
    if (!node.attrs.storagePath) return
    if (playing && audioRef.current) {
      audioRef.current.pause()
      setPlaying(false)
      return
    }
    if (!audioRef.current) {
      const { data } = supabase.storage.from('audio').getPublicUrl(node.attrs.storagePath)
      audioRef.current = new Audio(data.publicUrl)
      audioRef.current.onended = () => setPlaying(false)
    }
    audioRef.current.play()
    setPlaying(true)
  }

  return (
    <NodeViewWrapper>
      <div className="flex items-center gap-3 p-3 my-2 bg-[#F7F6FF] border-2 border-[#E5E3FF] rounded-xl" contentEditable={false}>
        {/* Play/Upload */}
        {node.attrs.storagePath ? (
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={togglePlay}
              className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all
                ${playing ? 'bg-[#5C4FE5] text-white border-[#5C4FE5]' : 'bg-white text-[#5C4FE5] border-[#5C4FE5] hover:bg-[#5C4FE5] hover:text-white'}`}>
              {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>
            <button onClick={deleteAudio} className="p-1 text-red-400 hover:text-red-600">
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <label className={`flex items-center gap-1 px-3 py-1.5 border-2 border-dashed rounded-lg cursor-pointer text-xs flex-shrink-0
            ${uploading ? 'border-purple-400 bg-purple-50 text-purple-600' : 'border-gray-300 text-gray-500 hover:border-[#5C4FE5] hover:text-[#5C4FE5]'}`}>
            {uploading ? <><Loader2 className="w-3 h-3 animate-spin" />Upload...</> : <><Upload className="w-3 h-3" />Audio</>}
            <input type="file" accept="audio/*" className="hidden" disabled={uploading}
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadAudio(f) }} />
          </label>
        )}
        {/* Text fields */}
        <input type="text" value={node.attrs.text || ''} onChange={e => updateAttributes({ text: e.target.value })}
          placeholder="Teks Bahasa Inggris..." className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white focus:ring-1 focus:ring-[#5C4FE5]" />
        <input type="text" value={node.attrs.translation || ''} onChange={e => updateAttributes({ translation: e.target.value })}
          placeholder="Terjemahan Indonesia..." className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white focus:ring-1 focus:ring-[#5C4FE5]" />
        {/* Delete node */}
        <button onClick={deleteNode} className="p-1 text-red-400 hover:text-red-600 flex-shrink-0"><Trash2 className="w-4 h-4" /></button>
      </div>
    </NodeViewWrapper>
  )
}

export const AudioSentenceExtension = Node.create({
  name: 'audioSentence',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      text: { default: '' },
      translation: { default: '' },
      storagePath: { default: null },
      storageBucket: { default: 'audio' },
    }
  },
  parseHTML() { return [{ tag: 'audio-sentence' }] },
  renderHTML({ HTMLAttributes }) { return ['audio-sentence', mergeAttributes(HTMLAttributes)] },
  addNodeView() { return ReactNodeViewRenderer(AudioSentenceView) },
})

// ============================================================
// COLLAPSIBLE GROUP NODE
// ============================================================
type CollapsibleItem = { id: string; text: string; translation: string; storagePath: string | null; storageBucket: string }

const CollapsibleGroupView = ({ node, updateAttributes, deleteNode }: any) => {
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({})
  const supabase = createClient()

  const items: CollapsibleItem[] = node.attrs.items || []
  const color = node.attrs.color || 'blue'
  const defaultOpen = node.attrs.defaultOpen ?? true

  const COLORS: Record<string, string> = {
    blue: 'bg-blue-500 text-white', yellow: 'bg-yellow-400 text-yellow-900',
    green: 'bg-green-500 text-white', red: 'bg-red-500 text-white',
    purple: 'bg-[#5C4FE5] text-white', orange: 'bg-orange-400 text-white',
  }

  const generateId = () => `item_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`

  const addItem = () => {
    const newItem: CollapsibleItem = { id: generateId(), text: '', translation: '', storagePath: null, storageBucket: 'audio' }
    updateAttributes({ items: [...items, newItem] })
  }

  const updateItem = (id: string, updates: Partial<CollapsibleItem>) => {
    updateAttributes({ items: items.map(item => item.id === id ? { ...item, ...updates } : item) })
  }

  const deleteItem = (id: string) => {
    updateAttributes({ items: items.filter(item => item.id !== id) })
  }

  const uploadItemAudio = async (id: string, file: File) => {
    setUploadingId(id)
    try {
      const formData = new FormData(); formData.append('audio', file)
      const res = await fetch('/api/admin/cefr/audio', { method: 'POST', body: formData })
      if (!res.ok) throw new Error()
      const data = await res.json()
      updateItem(id, { storagePath: data.storage_path })
    } catch { alert('❌ Gagal upload audio') }
    finally { setUploadingId(null) }
  }

  const deleteItemAudio = async (id: string, storagePath: string) => {
    try {
      await fetch('/api/admin/cefr/audio', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storage_path: storagePath }),
      })
      updateItem(id, { storagePath: null })
    } catch { alert('❌ Gagal hapus audio') }
  }

  const togglePlay = (id: string, storagePath: string) => {
    Object.entries(audioRefs.current).forEach(([aid, a]) => { if (aid !== id) { a.pause(); a.currentTime = 0 } })
    if (playingId === id) { audioRefs.current[id]?.pause(); setPlayingId(null); return }
    if (!audioRefs.current[id]) {
      const { data } = supabase.storage.from('audio').getPublicUrl(storagePath)
      const audio = new Audio(data.publicUrl)
      audio.onended = () => setPlayingId(null)
      audioRefs.current[id] = audio
    }
    audioRefs.current[id].play(); setPlayingId(id)
  }

  return (
    <NodeViewWrapper>
      <div className="my-3 rounded-xl overflow-hidden border-2 border-[#E5E3FF]" contentEditable={false}>
        {/* Config bar */}
        <div className="bg-gray-50 px-4 py-3 flex items-center gap-3 flex-wrap border-b border-[#E5E3FF]">
          <span className="text-xs font-bold text-gray-600">Warna:</span>
          {Object.keys(COLORS).map(c => (
            <button key={c} onClick={() => updateAttributes({ color: c })}
              className={`px-2 py-1 text-xs font-semibold rounded-full border-2 capitalize ${COLORS[c]} ${color === c ? 'border-gray-700 ring-2 ring-offset-1 ring-gray-400' : 'border-transparent opacity-70'}`}>
              {c}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-600">Default terbuka:</label>
            <button onClick={() => updateAttributes({ defaultOpen: !defaultOpen })}
              className={`w-10 h-5 rounded-full transition-colors ${defaultOpen ? 'bg-[#5C4FE5]' : 'bg-gray-300'}`}>
              <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform mx-0.5 ${defaultOpen ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
          <button onClick={deleteNode} className="p-1 text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
        </div>

        {/* Header input */}
        <div className={`px-4 py-3 ${COLORS[color]}`}>
          <input type="text" value={node.attrs.header || ''} onChange={e => updateAttributes({ header: e.target.value })}
            placeholder="Teks header dropdown..."
            className="w-full bg-transparent placeholder-white/70 font-semibold text-sm focus:outline-none border-b border-white/30 pb-1" />
        </div>

        {/* Items */}
        <div className="bg-white divide-y divide-gray-100">
          {items.map((item, idx) => (
            <div key={item.id} className="px-4 py-3 flex items-center gap-3">
              <span className="text-xs text-gray-400 w-5 flex-shrink-0">{idx + 1}</span>
              {/* Audio */}
              {item.storagePath ? (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => togglePlay(item.id, item.storagePath!)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center border-2 text-xs transition-all
                      ${playingId === item.id ? 'bg-[#5C4FE5] text-white border-[#5C4FE5]' : 'bg-white text-[#5C4FE5] border-[#5C4FE5]'}`}>
                    {playingId === item.id ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 ml-px" />}
                  </button>
                  <button onClick={() => deleteItemAudio(item.id, item.storagePath!)} className="text-red-400 hover:text-red-600">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <label className={`flex items-center gap-1 px-2 py-1 border border-dashed rounded cursor-pointer text-xs flex-shrink-0
                  ${uploadingId === item.id ? 'border-purple-400 text-purple-600' : 'border-gray-300 text-gray-500 hover:border-[#5C4FE5]'}`}>
                  {uploadingId === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                  <input type="file" accept="audio/*" className="hidden" disabled={!!uploadingId}
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadItemAudio(item.id, f) }} />
                </label>
              )}
              <input type="text" value={item.text} onChange={e => updateItem(item.id, { text: e.target.value })}
                placeholder="Teks Inggris..." className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white focus:ring-1 focus:ring-[#5C4FE5]" />
              <input type="text" value={item.translation} onChange={e => updateItem(item.id, { translation: e.target.value })}
                placeholder="Terjemahan..." className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white focus:ring-1 focus:ring-[#5C4FE5]" />
              <button onClick={() => deleteItem(item.id)} className="text-red-400 hover:text-red-600 flex-shrink-0"><X className="w-4 h-4" /></button>
            </div>
          ))}
          <div className="px-4 py-2">
            <button onClick={addItem}
              className="w-full py-2 border-2 border-dashed border-[#5C4FE5]/40 text-[#5C4FE5] text-sm font-medium rounded-lg hover:bg-purple-50 transition-colors flex items-center justify-center gap-1">
              <Plus className="w-4 h-4" /> Tambah Item
            </button>
          </div>
        </div>
      </div>
    </NodeViewWrapper>
  )
}

export const CollapsibleGroupExtension = Node.create({
  name: 'collapsibleGroup',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      header: { default: '' },
      color: { default: 'blue' },
      defaultOpen: { default: true },
      items: { default: [] },
    }
  },
  parseHTML() { return [{ tag: 'collapsible-group' }] },
  renderHTML({ HTMLAttributes }) { return ['collapsible-group', mergeAttributes(HTMLAttributes)] },
  addNodeView() { return ReactNodeViewRenderer(CollapsibleGroupView) },
})

// ============================================================
// AUDIO HIGHLIGHT NODE (INLINE)
// ============================================================
const HIGHLIGHT_COLORS_MAP: Record<string, { bg: string; border: string; text: string }> = {
  '#FEF08A': { bg: 'bg-yellow-100', border: 'border-yellow-400', text: 'text-yellow-900' },
  '#BAE6FD': { bg: 'bg-blue-100', border: 'border-blue-400', text: 'text-blue-900' },
  '#BBF7D0': { bg: 'bg-green-100', border: 'border-green-400', text: 'text-green-900' },
  '#FECACA': { bg: 'bg-red-100', border: 'border-red-400', text: 'text-red-900' },
  '#DDD6FE': { bg: 'bg-purple-100', border: 'border-purple-400', text: 'text-purple-900' },
}

const AudioHighlightView = ({ node, updateAttributes, deleteNode }: any) => {
  const [uploading, setUploading] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const supabase = createClient()

  const color = node.attrs.color || '#FEF08A'
  const colorStyle = HIGHLIGHT_COLORS_MAP[color] || HIGHLIGHT_COLORS_MAP['#FEF08A']

  const uploadAudio = async (file: File) => {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('audio', file)
      const res = await fetch('/api/admin/cefr/audio', { method: 'POST', body: formData })
      if (!res.ok) throw new Error()
      const data = await res.json()
      updateAttributes({ storagePath: data.storage_path })
    } catch { alert('❌ Gagal upload audio') }
    finally { setUploading(false) }
  }

  const deleteAudio = async () => {
    if (!node.attrs.storagePath) return
    try {
      await fetch('/api/admin/cefr/audio', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storage_path: node.attrs.storagePath }),
      })
      updateAttributes({ storagePath: null })
    } catch { alert('❌ Gagal hapus audio') }
  }

  const togglePlay = () => {
    if (!node.attrs.storagePath) return
    if (playing && audioRef.current) {
      audioRef.current.pause()
      setPlaying(false)
      return
    }
    if (!audioRef.current) {
      const { data } = supabase.storage.from('audio').getPublicUrl(node.attrs.storagePath)
      audioRef.current = new Audio(data.publicUrl)
      audioRef.current.onended = () => setPlaying(false)
    }
    audioRef.current.play()
    setPlaying(true)
  }

  return (
    <NodeViewWrapper as="span" className="relative inline">
      {/* Inline highlight with play button */}
      <span
        className={`inline-flex items-center gap-0.5 mx-0.5 px-1.5 py-0.5 rounded border font-medium cursor-pointer
          ${colorStyle.bg} ${colorStyle.border} ${colorStyle.text}`}
        onClick={() => setShowEdit(s => !s)}
      >
        <span className="text-sm">{node.attrs.text || '...'}</span>
        {node.attrs.storagePath && (
          <button onClick={e => { e.stopPropagation(); togglePlay() }}
            className={`w-4 h-4 rounded-full inline-flex items-center justify-center ml-0.5 flex-shrink-0
              ${playing ? 'bg-[#5C4FE5] text-white' : 'bg-white/80 text-[#5C4FE5] border border-[#5C4FE5]'}`}>
            {playing ? <Pause className="w-2 h-2" /> : <Play className="w-2 h-2 ml-px" />}
          </button>
        )}
      </span>

      {/* Edit popup */}
      {showEdit && (
        <span className="absolute top-7 left-0 z-50 bg-white border-2 border-[#5C4FE5] rounded-xl shadow-xl p-3 min-w-[280px] flex flex-col gap-2"
          contentEditable={false}>
          <span className="text-xs font-bold text-gray-600 mb-1">Edit Audio Highlight</span>

          {/* Text input */}
          <input type="text" value={node.attrs.text || ''} onChange={e => updateAttributes({ text: e.target.value })}
            placeholder="Teks yang di-highlight..."
            className="px-2 py-1.5 border border-gray-300 rounded text-sm text-gray-900 bg-white focus:ring-1 focus:ring-[#5C4FE5] w-full" />

          {/* Color picker */}
          <span className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500">Warna:</span>
            {Object.keys(HIGHLIGHT_COLORS_MAP).map(c => (
              <button key={c} onClick={() => updateAttributes({ color: c })}
                className={`w-5 h-5 rounded-full border-2 ${color === c ? 'border-gray-700 ring-2 ring-offset-1 ring-gray-400' : 'border-gray-300'}`}
                style={{ backgroundColor: c }} />
            ))}
          </span>

          {/* Audio */}
          {node.attrs.storagePath ? (
            <span className="flex items-center gap-2 text-xs text-gray-500">
              <span className="font-mono truncate flex-1">{node.attrs.storagePath.split('/').pop()}</span>
              <button onClick={deleteAudio} className="text-red-400 hover:text-red-600"><X className="w-3 h-3" /></button>
            </span>
          ) : (
            <label className={`flex items-center gap-2 px-3 py-1.5 border border-dashed rounded cursor-pointer text-xs w-full
              ${uploading ? 'border-purple-400 text-purple-600' : 'border-gray-300 text-gray-500 hover:border-[#5C4FE5]'}`}>
              {uploading ? <><Loader2 className="w-3 h-3 animate-spin" />Uploading...</> : <><Upload className="w-3 h-3" />Upload Audio (.mp3)</>}
              <input type="file" accept="audio/*" className="hidden" disabled={uploading}
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadAudio(f) }} />
            </label>
          )}

          {/* Actions */}
          <span className="flex justify-between mt-1">
            <button onClick={deleteNode} className="text-xs text-red-500 hover:text-red-700 font-medium">
              🗑️ Hapus node
            </button>
            <button onClick={() => setShowEdit(false)} className="text-xs text-gray-500 hover:text-gray-700 font-medium">
              ✓ Selesai
            </button>
          </span>
        </span>
      )}
    </NodeViewWrapper>
  )
}

export const AudioHighlightExtension = Node.create({
  name: 'audioHighlight',
  group: 'inline',
  inline: true,
  atom: true,
  addAttributes() {
    return {
      text: { default: '' },
      color: { default: '#FEF08A' },
      storagePath: { default: null },
      storageBucket: { default: 'audio' },
    }
  },
  parseHTML() { return [{ tag: 'audio-highlight' }] },
  renderHTML({ HTMLAttributes }) { return ['audio-highlight', mergeAttributes(HTMLAttributes)] },
  addNodeView() { return ReactNodeViewRenderer(AudioHighlightView) },
})
