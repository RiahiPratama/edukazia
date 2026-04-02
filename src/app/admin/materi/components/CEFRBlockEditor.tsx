'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableCell } from '@tiptap/extension-table-cell'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import { useEffect, useState } from 'react'
import {
  Bold, Italic, Underline as UnderlineIcon, Highlighter, AlignLeft, AlignCenter,
  Table as TableIcon, Headphones, ChevronDown as CollapseIcon, Save, ArrowLeft,
  Check, Loader2, Minus, List, ListOrdered,
} from 'lucide-react'
import { AudioSentenceExtension, CollapsibleGroupExtension } from './CEFRExtensions'

type CEFRBlockEditorProps = {
  lessonId: string
  lessonName: string
  onBack: () => void
}

// ── Highlight Colors ─────────────────────────────────────────
const HIGHLIGHT_COLORS = [
  { name: 'Kuning', color: '#FEF08A' },
  { name: 'Biru', color: '#BAE6FD' },
  { name: 'Hijau', color: '#BBF7D0' },
  { name: 'Merah', color: '#FECACA' },
  { name: 'Ungu', color: '#DDD6FE' },
]

// ── Toolbar Button ───────────────────────────────────────────
const ToolbarBtn = ({ onClick, active, disabled, title, children }: any) => (
  <button onClick={onClick} disabled={disabled} title={title}
    className={`p-2 rounded-lg transition-colors text-sm font-medium
      ${active ? 'bg-[#5C4FE5] text-white' : 'text-gray-700 hover:bg-gray-100'}
      ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}>
    {children}
  </button>
)

const ToolbarDivider = () => <div className="w-px h-6 bg-gray-300 mx-1" />

// ── Main Component ───────────────────────────────────────────
export default function CEFRBlockEditor({ lessonId, lessonName, onBack }: CEFRBlockEditorProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [showHighlightPicker, setShowHighlightPicker] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3, 4] } }),
      Underline,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      AudioSentenceExtension,
      CollapsibleGroupExtension,
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[400px] px-6 py-4 text-gray-900',
      },
    },
  })

  // Load content
  useEffect(() => {
    if (!editor) return
    fetch(`/api/admin/cefr/${lessonId}`)
      .then(r => r.json())
      .then(data => {
        if (data.tiptap_content) {
          editor.commands.setContent(data.tiptap_content)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [lessonId, editor])

  const saveContent = async (shouldExit = false) => {
    if (!editor) return
    setSaving(true)
    try {
      const tiptap_content = editor.getJSON()
      const res = await fetch(`/api/admin/cefr/${lessonId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tiptap_content }),
      })
      if (!res.ok) throw new Error()
      setSavedAt(new Date().toLocaleTimeString('id-ID'))
      if (shouldExit) onBack()
    } catch {
      alert('❌ Gagal menyimpan konten')
    } finally {
      setSaving(false)
    }
  }

  const insertAudioSentence = () => {
    if (!editor) return
    editor.commands.insertContent({
      type: 'audioSentence',
      attrs: { text: '', translation: '', storagePath: null, storageBucket: 'audio' },
    })
  }

  const insertCollapsibleGroup = () => {
    if (!editor) return
    editor.commands.insertContent({
      type: 'collapsibleGroup',
      attrs: { header: '', color: 'blue', defaultOpen: true, items: [] },
    })
  }

  const insertTable = () => {
    if (!editor) return
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16">
        <div className="animate-spin w-10 h-10 border-4 border-[#5C4FE5] border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Block Editor CEFR</h2>
            <p className="text-sm text-gray-500">Lesson: <span className="font-semibold text-[#5C4FE5]">{lessonName}</span></p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {savedAt && (
            <span className="flex items-center gap-1 text-xs text-green-600">
              <Check className="w-3 h-3" /> Tersimpan {savedAt}
            </span>
          )}
          <button onClick={() => saveContent(false)} disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 border-2 border-[#5C4FE5] text-[#5C4FE5] rounded-lg hover:bg-purple-50 font-semibold disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Simpan
          </button>
          <button onClick={() => saveContent(true)} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#5C4FE5] text-white rounded-lg hover:bg-[#4a3ec7] font-semibold shadow-md disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Simpan & Keluar
          </button>
        </div>
      </div>

      {/* Editor Container */}
      <div className="bg-white border-2 border-gray-200 rounded-xl overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-0.5 p-2 border-b border-gray-200 flex-wrap bg-gray-50">
          {/* Headings */}
          <select value={editor?.isActive('heading', { level: 2 }) ? '2' : editor?.isActive('heading', { level: 3 }) ? '3' : editor?.isActive('heading', { level: 4 }) ? '4' : '0'}
            onChange={e => {
              const level = parseInt(e.target.value)
              if (level === 0) editor?.chain().focus().setParagraph().run()
              else editor?.chain().focus().toggleHeading({ level: level as 2|3|4 }).run()
            }}
            className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-700 bg-white focus:ring-1 focus:ring-[#5C4FE5] mr-1">
            <option value="0">Paragraf</option>
            <option value="2">Heading 2</option>
            <option value="3">Heading 3</option>
            <option value="4">Heading 4</option>
          </select>

          <ToolbarDivider />

          {/* Text formatting */}
          <ToolbarBtn onClick={() => editor?.chain().focus().toggleBold().run()} active={editor?.isActive('bold')} title="Bold">
            <Bold className="w-4 h-4" />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor?.chain().focus().toggleItalic().run()} active={editor?.isActive('italic')} title="Italic">
            <Italic className="w-4 h-4" />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor?.chain().focus().toggleUnderline().run()} active={editor?.isActive('underline')} title="Underline">
            <UnderlineIcon className="w-4 h-4" />
          </ToolbarBtn>

          <ToolbarDivider />

          {/* Highlight */}
          <div className="relative">
            <button onClick={() => setShowHighlightPicker(p => !p)}
              className={`p-2 rounded-lg transition-colors flex items-center gap-1 text-sm ${editor?.isActive('highlight') ? 'bg-yellow-100 text-yellow-700' : 'text-gray-700 hover:bg-gray-100'}`}
              title="Highlight">
              <Highlighter className="w-4 h-4" />
              <ChevronDown className="w-3 h-3" />
            </button>
            {showHighlightPicker && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-10 flex gap-1">
                {HIGHLIGHT_COLORS.map(({ name, color }) => (
                  <button key={color} onClick={() => { editor?.chain().focus().toggleHighlight({ color }).run(); setShowHighlightPicker(false) }}
                    className="w-6 h-6 rounded-full border-2 border-gray-300 hover:border-gray-600 transition-colors"
                    style={{ backgroundColor: color }} title={name} />
                ))}
                <button onClick={() => { editor?.chain().focus().unsetHighlight().run(); setShowHighlightPicker(false) }}
                  className="w-6 h-6 rounded-full border-2 border-gray-300 bg-white hover:border-gray-600 flex items-center justify-center"
                  title="Hapus highlight">
                  <Minus className="w-3 h-3 text-gray-500" />
                </button>
              </div>
            )}
          </div>

          <ToolbarDivider />

          {/* Lists */}
          <ToolbarBtn onClick={() => editor?.chain().focus().toggleBulletList().run()} active={editor?.isActive('bulletList')} title="Bullet List">
            <List className="w-4 h-4" />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor?.chain().focus().toggleOrderedList().run()} active={editor?.isActive('orderedList')} title="Numbered List">
            <ListOrdered className="w-4 h-4" />
          </ToolbarBtn>

          <ToolbarDivider />

          {/* Alignment */}
          <ToolbarBtn onClick={() => editor?.chain().focus().setTextAlign('left').run()} active={editor?.isActive({ textAlign: 'left' })} title="Rata Kiri">
            <AlignLeft className="w-4 h-4" />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor?.chain().focus().setTextAlign('center').run()} active={editor?.isActive({ textAlign: 'center' })} title="Rata Tengah">
            <AlignCenter className="w-4 h-4" />
          </ToolbarBtn>

          <ToolbarDivider />

          {/* Table */}
          <ToolbarBtn onClick={insertTable} title="Insert Tabel">
            <TableIcon className="w-4 h-4" />
          </ToolbarBtn>

          <ToolbarDivider />

          {/* Custom nodes */}
          <button onClick={insertAudioSentence}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-[#5C4FE5] border border-[#5C4FE5]/30 rounded-lg text-xs font-semibold hover:bg-purple-100 transition-colors">
            <Headphones className="w-3.5 h-3.5" />
            + Audio Sentence
          </button>
          <button onClick={insertCollapsibleGroup}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-300 rounded-lg text-xs font-semibold hover:bg-blue-100 transition-colors">
            <CollapseIcon className="w-3.5 h-3.5" />
            + Grup Dropdown
          </button>
        </div>

        {/* Table controls (shown when cursor in table) */}
        {editor?.isActive('table') && (
          <div className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 border-b border-blue-200 text-xs">
            <span className="font-semibold text-blue-700 mr-2">Tabel:</span>
            <button onClick={() => editor.chain().focus().addColumnAfter().run()} className="px-2 py-0.5 bg-white border border-blue-300 rounded text-blue-700 hover:bg-blue-100">+ Kolom</button>
            <button onClick={() => editor.chain().focus().addRowAfter().run()} className="px-2 py-0.5 bg-white border border-blue-300 rounded text-blue-700 hover:bg-blue-100">+ Baris</button>
            <button onClick={() => editor.chain().focus().deleteColumn().run()} className="px-2 py-0.5 bg-white border border-red-300 rounded text-red-700 hover:bg-red-50">- Kolom</button>
            <button onClick={() => editor.chain().focus().deleteRow().run()} className="px-2 py-0.5 bg-white border border-red-300 rounded text-red-700 hover:bg-red-50">- Baris</button>
            <button onClick={() => editor.chain().focus().deleteTable().run()} className="px-2 py-0.5 bg-red-100 border border-red-300 rounded text-red-700 hover:bg-red-200">Hapus Tabel</button>
          </div>
        )}

        {/* Editor Content */}
        <EditorContent editor={editor} />
      </div>

      {/* TipTap Styles */}
      <style>{`
        .tiptap h2 { font-size: 1.5rem; font-weight: 700; margin: 1.5rem 0 0.75rem; color: #1a1530; }
        .tiptap h3 { font-size: 1.25rem; font-weight: 700; margin: 1.25rem 0 0.5rem; color: #1a1530; }
        .tiptap h4 { font-size: 1.1rem; font-weight: 600; margin: 1rem 0 0.5rem; color: #4a4580; }
        .tiptap p { margin: 0.5rem 0; line-height: 1.7; }
        .tiptap ul { list-style: disc; padding-left: 1.5rem; margin: 0.5rem 0; }
        .tiptap ol { list-style: decimal; padding-left: 1.5rem; margin: 0.5rem 0; }
        .tiptap li { margin: 0.25rem 0; }
        .tiptap table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
        .tiptap td, .tiptap th { border: 1px solid #e5e3ff; padding: 0.5rem 0.75rem; min-width: 80px; }
        .tiptap th { background: #5C4FE5; color: white; font-weight: 600; }
        .tiptap tr:nth-child(even) td { background: #f7f6ff; }
        .tiptap .selectedCell { background: #ddd6fe !important; }
        .tiptap mark { border-radius: 0.2rem; padding: 0.1rem 0.2rem; }
      `}</style>
    </div>
  )
}

// Missing import fix
const ChevronDown = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
)
