'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Play, Pause, Volume2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

// ── Types ──────────────────────────────────────────────────────────────────────
type Block =
  | { id: string; type: 'heading'; level: 1 | 2 | 3; content: string }
  | { id: string; type: 'paragraph'; content: string }
  | { id: string; type: 'highlight'; content: string; color: 'blue' | 'yellow' | 'green' | 'red' }
  | { id: string; type: 'table'; headers: string[]; rows: string[][] }
  | { id: string; type: 'audio_sentence'; text: string; translation: string; storage_path: string | null; storage_bucket: string }

type CEFRRendererProps = {
  blocks: Block[]
  lessonName: string
}

// ── Highlight Colors ───────────────────────────────────────────────────────────
const HIGHLIGHT_COLORS = {
  blue: 'bg-blue-50 border-l-4 border-blue-400 text-blue-900',
  yellow: 'bg-yellow-50 border-l-4 border-yellow-400 text-yellow-900',
  green: 'bg-green-50 border-l-4 border-green-400 text-green-900',
  red: 'bg-red-50 border-l-4 border-red-400 text-red-900',
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function CEFRRenderer({ blocks, lessonName }: CEFRRendererProps) {
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({})
  const supabase = createClient()

  const toggleAudio = async (blockId: string, storagePath: string, storageBucket: string) => {
    // Stop semua audio yang sedang play
    Object.entries(audioRefs.current).forEach(([id, audio]) => {
      if (id !== blockId) {
        audio.pause()
        audio.currentTime = 0
      }
    })

    // Toggle play/pause
    if (playingId === blockId) {
      audioRefs.current[blockId]?.pause()
      setPlayingId(null)
      return
    }

    // Buat audio baru kalau belum ada
    if (!audioRefs.current[blockId]) {
      setLoadingId(blockId)
      try {
        const { data } = supabase.storage
          .from(storageBucket)
          .getPublicUrl(storagePath)

        const audio = new Audio(data.publicUrl)
        audio.onended = () => setPlayingId(null)
        audio.onerror = () => {
          setPlayingId(null)
          setLoadingId(null)
        }
        audioRefs.current[blockId] = audio
      } catch (err) {
        setLoadingId(null)
        return
      }
    }

    setLoadingId(null)
    audioRefs.current[blockId].play()
    setPlayingId(blockId)
  }

  const renderBlock = (block: Block) => {
    switch (block.type) {
      case 'heading':
        const HeadingTag = `h${block.level}` as 'h1' | 'h2' | 'h3'
        const headingClass = {
          1: 'text-2xl font-bold text-gray-900 mt-8 mb-4',
          2: 'text-xl font-bold text-gray-800 mt-6 mb-3',
          3: 'text-lg font-bold text-gray-700 mt-4 mb-2',
        }[block.level]
        return (
          <HeadingTag key={block.id} className={headingClass}>
            {block.content}
          </HeadingTag>
        )

      case 'paragraph':
        return (
          <p key={block.id} className="text-gray-700 leading-relaxed mb-4 text-base">
            {block.content}
          </p>
        )

      case 'highlight':
        return (
          <div key={block.id} className={`${HIGHLIGHT_COLORS[block.color]} rounded-lg p-4 mb-4`}>
            <p className="text-sm font-medium leading-relaxed">{block.content}</p>
          </div>
        )

      case 'table':
        return (
          <div key={block.id} className="overflow-x-auto mb-6 rounded-xl border border-gray-200 shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#5C4FE5] text-white">
                  {block.headers.map((h, i) => (
                    <th key={i} className="px-4 py-3 text-left font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, ri) => (
                  <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-[#F7F6FF]'}>
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-4 py-3 text-gray-700 border-t border-gray-100">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )

      case 'audio_sentence':
        const isPlaying = playingId === block.id
        const isLoading = loadingId === block.id
        const hasAudio = !!block.storage_path

        return (
          <div key={block.id}
            className={`flex items-center gap-3 p-3 rounded-xl mb-2 transition-colors
              ${isPlaying ? 'bg-[#5C4FE5]/10 border-2 border-[#5C4FE5]' : 'bg-[#F7F6FF] border-2 border-transparent hover:border-[#E5E3FF]'}`}>

            {/* Play Button */}
            <button
              onClick={() => hasAudio && toggleAudio(block.id, block.storage_path!, block.storage_bucket)}
              disabled={!hasAudio || isLoading}
              className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all
                ${hasAudio
                  ? isPlaying
                    ? 'bg-[#5C4FE5] text-white shadow-lg'
                    : 'bg-white text-[#5C4FE5] border-2 border-[#5C4FE5] hover:bg-[#5C4FE5] hover:text-white'
                  : 'bg-gray-100 text-gray-300 cursor-not-allowed'}`}
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-[#5C4FE5] border-t-transparent rounded-full animate-spin" />
              ) : isPlaying ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4 ml-0.5" />
              )}
            </button>

            {/* Text Content */}
            <div className="flex-1 min-w-0">
              <p className={`font-semibold text-base ${isPlaying ? 'text-[#5C4FE5]' : 'text-gray-900'}`}>
                {block.text}
              </p>
              {block.translation && (
                <p className="text-sm text-gray-500 mt-0.5">{block.translation}</p>
              )}
            </div>

            {/* Audio indicator */}
            {hasAudio && isPlaying && (
              <Volume2 className="w-4 h-4 text-[#5C4FE5] flex-shrink-0 animate-pulse" />
            )}
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F6FF]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-[#E5E3FF] shadow-sm">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
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
        {blocks.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500">Konten belum tersedia.</p>
          </div>
        ) : (
          <div>
            {blocks.map(block => renderBlock(block))}
          </div>
        )}
      </div>
    </div>
  )
}
