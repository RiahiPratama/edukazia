'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Play, Pause, ChevronDown, ArrowLeft, Volume2 } from 'lucide-react'

type CEFRRendererProps = {
  content: any // TipTap JSON or legacy blocks
  lessonName: string
}

// ── Highlight color map ───────────────────────────────────────
const HIGHLIGHT_MAP: Record<string, string> = {
  '#FEF08A': 'bg-yellow-100',
  '#BAE6FD': 'bg-blue-100',
  '#BBF7D0': 'bg-green-100',
  '#FECACA': 'bg-red-100',
  '#DDD6FE': 'bg-purple-100',
}

// ── Collapsible Group Colors ──────────────────────────────────
const GROUP_COLORS: Record<string, string> = {
  blue: 'bg-blue-500 text-white',
  yellow: 'bg-yellow-400 text-yellow-900',
  green: 'bg-green-500 text-white',
  red: 'bg-red-500 text-white',
  purple: 'bg-[#5C4FE5] text-white',
  orange: 'bg-orange-400 text-white',
}

export default function CEFRRenderer({ content, lessonName }: CEFRRendererProps) {
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    // Initialize open groups based on defaultOpen attribute
    // Use same key format as renderNode: node_${idx}
    const open = new Set<string>()
    if (content?.content) {
      content.content.forEach((node: any, idx: number) => {
        if (node.type === 'collapsibleGroup' && node.attrs?.defaultOpen !== false) {
          open.add(`node_${idx}`)
        }
      })
    }
    return open
  })
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({})
  const supabase = createClient()

  const toggleAudio = (id: string, storagePath: string) => {
    Object.entries(audioRefs.current).forEach(([aid, a]) => {
      if (aid !== id) { a.pause(); a.currentTime = 0 }
    })

    if (playingId === id) {
      audioRefs.current[id]?.pause()
      setPlayingId(null)
      return
    }

    if (!audioRefs.current[id]) {
      const { data } = supabase.storage.from('audio').getPublicUrl(storagePath)
      const audio = new Audio(data.publicUrl)
      audio.onended = () => setPlayingId(null)
      audioRefs.current[id] = audio
    }

    audioRefs.current[id].play()
    setPlayingId(id)
  }

  const toggleGroup = (id: string) => {
    setOpenGroups(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ── Render text marks (bold, italic, underline, highlight) ──
  const renderMarks = (text: string, marks: any[] = []) => {
    let el: any = text
    marks.forEach(mark => {
      if (mark.type === 'bold') el = <strong>{el}</strong>
      else if (mark.type === 'italic') el = <em>{el}</em>
      else if (mark.type === 'underline') el = <u>{el}</u>
      else if (mark.type === 'highlight') {
        const bgClass = HIGHLIGHT_MAP[mark.attrs?.color] || 'bg-yellow-100'
        el = <mark className={`${bgClass} rounded px-0.5`}>{el}</mark>
      }
    })
    return el
  }

  // ── Render audio highlight inline ────────────────────────────
  const renderAudioHighlight = (node: any, id: string) => {
    const { text, color, storagePath } = node.attrs || {}
    const isPlaying = playingId === id
    const hasAudio = !!storagePath

    const COLORS_INLINE: Record<string, string> = {
      '#FEF08A': 'bg-yellow-100 border-yellow-400 text-yellow-900',
      '#BAE6FD': 'bg-blue-100 border-blue-400 text-blue-900',
      '#BBF7D0': 'bg-green-100 border-green-400 text-green-900',
      '#FECACA': 'bg-red-100 border-red-400 text-red-900',
      '#DDD6FE': 'bg-purple-100 border-purple-400 text-purple-900',
    }
    const colorClass = COLORS_INLINE[color] || COLORS_INLINE['#FEF08A']

    return (
      <span key={id} className={`inline-flex items-center gap-0.5 mx-0.5 px-1.5 py-0.5 rounded border font-semibold ${colorClass}`}>
        <span>{text}</span>
        {hasAudio && (
          <button
            onClick={() => toggleAudio(id, storagePath)}
            className={`w-4 h-4 rounded-full inline-flex items-center justify-center ml-0.5 flex-shrink-0 transition-all
              ${isPlaying ? 'bg-[#5C4FE5] text-white' : 'bg-white/80 text-[#5C4FE5] border border-[#5C4FE5] hover:bg-[#5C4FE5] hover:text-white'}`}>
            {isPlaying ? <Pause className="w-2 h-2" /> : <Play className="w-2 h-2 ml-px" />}
          </button>
        )}
      </span>
    )
  }

  // ── Render inline content (text nodes) ──────────────────────
  const renderInline = (nodes: any[] = []) => {
    return nodes.map((node, idx) => {
      if (node.type === 'text') {
        return <span key={idx}>{renderMarks(node.text, node.marks)}</span>
      }
      if (node.type === 'hardBreak') return <br key={idx} />
      if (node.type === 'audioHighlight') {
        return renderAudioHighlight(node, `ah_${idx}_${node.attrs?.text}`)
      }
      return null
    })
  }

  // ── Render table ─────────────────────────────────────────────
  const renderTable = (node: any, idx: number) => (
    <div key={idx} className="overflow-x-auto mb-6 rounded-xl border border-gray-200 shadow-sm">
      <table className="w-full text-sm">
        <tbody>
          {node.content?.map((row: any, ri: number) => (
            <tr key={ri} className={ri === 0 ? '' : ri % 2 === 0 ? 'bg-white' : 'bg-[#F7F6FF]'}>
              {row.content?.map((cell: any, ci: number) => {
                const Tag = cell.type === 'tableHeader' ? 'th' : 'td'
                const cellClass = cell.type === 'tableHeader'
                  ? 'bg-[#5C4FE5] text-white font-semibold px-4 py-2.5 text-left'
                  : 'px-4 py-2.5 text-gray-700 border-t border-gray-100'
                return (
                  <Tag key={ci} className={cellClass}>
                    {cell.content?.map((p: any, pi: number) => (
                      <span key={pi}>{renderInline(p.content)}</span>
                    ))}
                  </Tag>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  // ── Render audio sentence ─────────────────────────────────────
  const renderAudioSentence = (node: any, id: string) => {
    const { text, translation, storagePath } = node.attrs || {}
    const isPlaying = playingId === id
    const hasAudio = !!storagePath

    return (
      <div className={`flex items-center gap-3 p-3 rounded-xl mb-2 transition-colors
        ${isPlaying ? 'bg-[#5C4FE5]/10 border-2 border-[#5C4FE5]' : 'bg-[#F7F6FF] border-2 border-transparent hover:border-[#E5E3FF]'}`}>
        <button
          onClick={() => hasAudio && toggleAudio(id, storagePath)}
          disabled={!hasAudio}
          className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all
            ${hasAudio ? isPlaying ? 'bg-[#5C4FE5] text-white shadow-lg' : 'bg-white text-[#5C4FE5] border-2 border-[#5C4FE5] hover:bg-[#5C4FE5] hover:text-white' : 'bg-gray-100 text-gray-300 cursor-not-allowed'}`}>
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>
        <div className="flex-1">
          <p className={`font-semibold text-base ${isPlaying ? 'text-[#5C4FE5]' : 'text-gray-900'}`}>{text}</p>
          {translation && <p className="text-sm text-gray-500">{translation}</p>}
        </div>
        {hasAudio && isPlaying && <Volume2 className="w-4 h-4 text-[#5C4FE5] animate-pulse flex-shrink-0" />}
      </div>
    )
  }

  // ── Render collapsible group ──────────────────────────────────
  const renderCollapsibleGroup = (node: any, groupId: string) => {
    const { header, color, items } = node.attrs || {}
    const isOpen = openGroups.has(groupId)
    const colorClass = GROUP_COLORS[color] || GROUP_COLORS.blue

    return (
      <div className="mb-4 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
        <button onClick={() => toggleGroup(groupId)}
          className={`w-full flex items-center justify-between px-4 py-3 font-semibold text-sm transition-colors ${colorClass}`}>
          <span>{header}</span>
          <ChevronDown className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
        {isOpen && (
          <div className="bg-white divide-y divide-gray-100">
            {(items || []).map((item: any) => {
              const itemId = `${groupId}_${item.id}`
              const isPlaying = playingId === itemId
              return (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                  <button
                    onClick={() => item.storagePath && toggleAudio(itemId, item.storagePath)}
                    disabled={!item.storagePath}
                    className={`w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center border-2 transition-all
                      ${item.storagePath ? isPlaying ? 'bg-[#5C4FE5] text-white border-[#5C4FE5]' : 'bg-white text-[#5C4FE5] border-[#5C4FE5] hover:bg-[#5C4FE5] hover:text-white' : 'bg-gray-100 text-gray-300 cursor-not-allowed border-gray-200'}`}>
                    {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 ml-px" />}
                  </button>
                  <div>
                    <p className={`font-semibold text-sm ${isPlaying ? 'text-[#5C4FE5]' : 'text-gray-900'}`}>{item.text}</p>
                    {item.translation && <p className="text-xs text-gray-500">{item.translation}</p>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ── Main render node ──────────────────────────────────────────
  const renderNode = (node: any, idx: number): React.ReactNode => {
    const key = `node_${idx}`

    switch (node.type) {
      case 'heading': {
        const level = node.attrs?.level || 2
        const classes: Record<number, string> = {
          2: 'text-2xl font-bold text-gray-900 mt-8 mb-4',
          3: 'text-xl font-bold text-gray-800 mt-6 mb-3',
          4: 'text-lg font-semibold text-gray-700 mt-4 mb-2',
        }
        const Tag = `h${level}` as 'h2' | 'h3' | 'h4'
        const align = node.attrs?.textAlign || 'left'
        return <Tag key={key} className={classes[level]} style={{ textAlign: align }}>{renderInline(node.content)}</Tag>
      }

      case 'paragraph': {
        const align = node.attrs?.textAlign || 'left'
        return (
          <p key={key} className="text-gray-700 leading-relaxed mb-4 text-base" style={{ textAlign: align }}>
            {renderInline(node.content)}
          </p>
        )
      }

      case 'bulletList':
        return (
          <ul key={key} className="list-disc pl-6 mb-4 space-y-1">
            {node.content?.map((item: any, i: number) => (
              <li key={i} className="text-gray-700">{item.content?.map((p: any, j: number) => <span key={j}>{renderInline(p.content)}</span>)}</li>
            ))}
          </ul>
        )

      case 'orderedList':
        return (
          <ol key={key} className="list-decimal pl-6 mb-4 space-y-1">
            {node.content?.map((item: any, i: number) => (
              <li key={i} className="text-gray-700">{item.content?.map((p: any, j: number) => <span key={j}>{renderInline(p.content)}</span>)}</li>
            ))}
          </ol>
        )

      case 'blockquote':
        return (
          <blockquote key={key} className="border-l-4 border-[#5C4FE5] pl-4 py-2 mb-4 bg-purple-50 rounded-r-lg text-gray-700 italic">
            {node.content?.map((n: any, i: number) => renderNode(n, i))}
          </blockquote>
        )

      case 'table':
        return renderTable(node, idx)

      case 'audioSentence':
        return <div key={key}>{renderAudioSentence(node, key)}</div>

      case 'collapsibleGroup':
        return <div key={key}>{renderCollapsibleGroup(node, key)}</div>

      case 'horizontalRule':
        return <hr key={key} className="my-6 border-gray-200" />

      default:
        return null
    }
  }

  // ── Main output ───────────────────────────────────────────────
  const nodes = content?.content || []

  return (
    <div className="min-h-screen bg-[#F7F6FF]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-[#E5E3FF] shadow-sm">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <button onClick={() => window.history.back()} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-bold text-gray-900 text-lg leading-tight">{lessonName}</h1>
            <p className="text-xs text-gray-500">CEFR Learning Material</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-8">
        {nodes.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p>Konten belum tersedia.</p>
          </div>
        ) : (
          <div>{nodes.map((node: any, idx: number) => renderNode(node, idx))}</div>
        )}
      </div>
    </div>
  )
}
