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
