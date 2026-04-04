'use client'

import { useRef } from 'react'

type LaporanEditorProps = {
  label:        string
  value:        string
  onChange:     (val: string) => void
  placeholder?: string
  rows?:        number
  hint?:        string
}

const TEMPLATE_MATERI = `---ID---
* [Topik/Materi 1]
* [Topik/Materi 2]
* [Topik/Materi 3]

---EN---
* [Topic/Material 1]
* [Topic/Material 2]
* [Topic/Material 3]`

const TEMPLATE_PERKEMBANGAN = `---ID---
[Tulis perkembangan siswa di sini...]

---EN---
[Write student's progress here...]`

const TEMPLATE_SARAN = `---ID---
[Tulis saran di sini...]

---EN---
[Write suggestion here...]`

export function LaporanEditor({
  label,
  value,
  onChange,
  placeholder,
  rows = 5,
  hint,
}: LaporanEditorProps) {
  const ref = useRef<HTMLTextAreaElement>(null)

  function insertAt(text: string) {
    const el = ref.current
    if (!el) return
    const start = el.selectionStart
    const end   = el.selectionEnd
    const before = value.slice(0, start)
    const after  = value.slice(end)
    const newVal = before + text + after
    onChange(newVal)
    // Restore cursor setelah insert
    setTimeout(() => {
      el.focus()
      el.setSelectionRange(start + text.length, start + text.length)
    }, 0)
  }

  function wrapSelection(prefix: string, suffix: string = '') {
    const el = ref.current
    if (!el) return
    const start    = el.selectionStart
    const end      = el.selectionEnd
    const selected = value.slice(start, end)
    const wrapped  = prefix + (selected || 'teks') + (suffix || prefix)
    const newVal   = value.slice(0, start) + wrapped + value.slice(end)
    onChange(newVal)
    setTimeout(() => {
      el.focus()
      el.setSelectionRange(start + prefix.length, start + prefix.length + (selected || 'teks').length)
    }, 0)
  }

  const inputCls = "w-full px-3 py-2.5 border border-[#E5E3FF] rounded-b-xl text-sm bg-white text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] transition font-mono leading-relaxed resize-y"

  return (
    <div>
      <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">
        {label}
      </label>

      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1.5 bg-[#F7F6FF] border border-[#E5E3FF] rounded-t-xl border-b-0 flex-wrap">

        {/* Format buttons */}
        <button type="button" onClick={() => insertAt('* ')}
          title="Bullet point"
          className="px-2 py-1 text-xs font-bold text-[#7B78A8] hover:bg-white hover:text-[#5C4FE5] rounded-md transition">
          • Bullet
        </button>
        <button type="button" onClick={() => wrapSelection('**')}
          title="Bold"
          className="px-2 py-1 text-xs font-bold text-[#7B78A8] hover:bg-white hover:text-[#5C4FE5] rounded-md transition">
          <strong>B</strong> Bold
        </button>

        <div className="w-px h-4 bg-[#E5E3FF] mx-1"/>

        {/* Language markers */}
        <button type="button" onClick={() => insertAt('\n---ID---\n')}
          title="Tambah marker Bahasa Indonesia"
          className="px-2 py-1 text-xs font-bold text-[#7B78A8] hover:bg-white hover:text-[#5C4FE5] rounded-md transition">
          🇮🇩 ---ID---
        </button>
        <button type="button" onClick={() => insertAt('\n---EN---\n')}
          title="Tambah marker English"
          className="px-2 py-1 text-xs font-bold text-[#7B78A8] hover:bg-white hover:text-[#5C4FE5] rounded-md transition">
          🇬🇧 ---EN---
        </button>

        <div className="w-px h-4 bg-[#E5E3FF] mx-1"/>

        {/* Template buttons */}
        {label.toLowerCase().includes('materi') && (
          <button type="button" onClick={() => onChange(TEMPLATE_MATERI)}
            className="px-2 py-1 text-[10px] font-bold text-[#5C4FE5] hover:bg-white rounded-md transition bg-[#EEEDFE]">
            📋 Template
          </button>
        )}
        {label.toLowerCase().includes('perkembangan') && (
          <button type="button" onClick={() => onChange(TEMPLATE_PERKEMBANGAN)}
            className="px-2 py-1 text-[10px] font-bold text-[#5C4FE5] hover:bg-white rounded-md transition bg-[#EEEDFE]">
            📋 Template
          </button>
        )}
        {label.toLowerCase().includes('saran') && (
          <button type="button" onClick={() => onChange(TEMPLATE_SARAN)}
            className="px-2 py-1 text-[10px] font-bold text-[#5C4FE5] hover:bg-white rounded-md transition bg-[#EEEDFE]">
            📋 Template
          </button>
        )}
      </div>

      <textarea
        ref={ref}
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className={inputCls}
      />

      {/* Panduan format */}
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5">
        <p className="text-[10px] text-[#7B78A8]">
          <span className="font-mono text-[#5C4FE5]">* teks</span> = bullet
        </p>
        <p className="text-[10px] text-[#7B78A8]">
          <span className="font-mono text-[#5C4FE5]">**teks**</span> = <strong>bold</strong>
        </p>
        <p className="text-[10px] text-[#7B78A8]">
          <span className="font-mono text-[#5C4FE5]">---ID---</span> / <span className="font-mono text-[#5C4FE5]">---EN---</span> = pisah bahasa
        </p>
        {hint && <p className="text-[10px] text-amber-600">{hint}</p>}
      </div>
    </div>
  )
}
