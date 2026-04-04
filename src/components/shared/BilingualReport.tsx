'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, ExternalLink, BookOpen, TrendingUp, Lightbulb, Video } from 'lucide-react'

// ── Parser ────────────────────────────────────────────────────────────────────
// Pisahkan konten berdasarkan marker ---ID--- dan ---EN---
function parseBilingual(text: string): { id: string; en: string } {
  if (!text) return { id: '', en: '' }

  const idMarker = '---ID---'
  const enMarker = '---EN---'

  const idIdx = text.indexOf(idMarker)
  const enIdx = text.indexOf(enMarker)

  // Kalau tidak ada marker → tampil sebagai ID saja
  if (idIdx === -1 && enIdx === -1) return { id: text.trim(), en: '' }

  let idContent = ''
  let enContent = ''

  if (idIdx !== -1 && enIdx !== -1) {
    if (idIdx < enIdx) {
      idContent = text.slice(idIdx + idMarker.length, enIdx).trim()
      enContent = text.slice(enIdx + enMarker.length).trim()
    } else {
      enContent = text.slice(enIdx + enMarker.length, idIdx).trim()
      idContent = text.slice(idIdx + idMarker.length).trim()
    }
  } else if (idIdx !== -1) {
    idContent = text.slice(idIdx + idMarker.length).trim()
  } else {
    enContent = text.slice(enIdx + enMarker.length).trim()
  }

  return { id: idContent, en: enContent }
}

// ── Markdown renderer sederhana ───────────────────────────────────────────────
// Support: * bullet, **bold**, baris kosong = paragraf baru
function renderMarkdown(text: string) {
  if (!text) return null

  const lines = text.split('\n')
  const elements: JSX.Element[] = []
  let bulletGroup: string[] = []
  let keyCounter = 0

  const flushBullets = () => {
    if (bulletGroup.length > 0) {
      elements.push(
        <ul key={`ul-${keyCounter++}`} className="list-none space-y-1 my-2">
          {bulletGroup.map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-[#5C4FE5] font-bold mt-0.5 flex-shrink-0">•</span>
              <span dangerouslySetInnerHTML={{ __html: boldify(item) }}/>
            </li>
          ))}
        </ul>
      )
      bulletGroup = []
    }
  }

  lines.forEach((line, i) => {
    const trimmed = line.trim()
    if (!trimmed) {
      flushBullets()
      return
    }
    if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
      bulletGroup.push(trimmed.slice(2))
    } else {
      flushBullets()
      elements.push(
        <p key={`p-${keyCounter++}`} className="text-sm leading-relaxed"
          dangerouslySetInnerHTML={{ __html: boldify(trimmed) }}/>
      )
    }
  })
  flushBullets()

  return elements
}

function boldify(text: string): string {
  return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
}

// ── Props ─────────────────────────────────────────────────────────────────────
type LaporanField = {
  materi:       string | null
  perkembangan: string | null
  saranSiswa:   string | null
  saranOrtu:    string | null
  recordingUrl: string | null
}

type BilingualReportProps = {
  laporan:       LaporanField
  audience:      'tutor' | 'ortu' | 'siswa'
  defaultOpen?:  boolean
  sessionLabel?: string
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function BilingualReport({
  laporan,
  audience,
  defaultOpen = false,
  sessionLabel,
}: BilingualReportProps) {
  const [isOpen,  setIsOpen]  = useState(defaultOpen)
  const [lang,    setLang]    = useState<'id' | 'en'>('id')

  const hasContent = laporan.materi || laporan.perkembangan || laporan.saranSiswa || laporan.saranOrtu

  if (!hasContent) {
    return (
      <div className="text-xs text-[#7B78A8] italic py-1">
        Laporan belum diisi oleh tutor
      </div>
    )
  }

  // Parse semua field
  const materi       = parseBilingual(laporan.materi ?? '')
  const perkembangan = parseBilingual(laporan.perkembangan ?? '')
  const saranSiswa   = parseBilingual(laporan.saranSiswa ?? '')
  const saranOrtu    = parseBilingual(laporan.saranOrtu ?? '')

  // Cek apakah ada konten EN di field manapun
  const hasEN = !!(materi.en || perkembangan.en || saranSiswa.en || saranOrtu.en)

  // Fields yang tampil berdasarkan audience
  const showMateri       = true
  const showPerkembangan = true
  const showSaranSiswa   = audience === 'tutor' || audience === 'siswa'
  const showSaranOrtu    = audience === 'tutor' || audience === 'ortu'
  const showRecording    = audience === 'tutor'

  const getText = (parsed: { id: string; en: string }) => {
    if (lang === 'en' && parsed.en) return parsed.en
    return parsed.id || parsed.en // fallback ke EN kalau ID kosong
  }

  return (
    <div className="border border-[#E5E3FF] rounded-xl overflow-hidden">

      {/* Toggle header */}
      <button
        onClick={() => setIsOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-[#F7F6FF] hover:bg-[#EEEDFE] transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <BookOpen size={13} className="text-[#5C4FE5]"/>
          <span className="text-xs font-bold text-[#1A1640]">
            {sessionLabel ? `Laporan — ${sessionLabel}` : 'Laporan Belajar'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {hasEN && !isOpen && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">
              ID · EN
            </span>
          )}
          {isOpen
            ? <ChevronUp size={14} className="text-[#5C4FE5]"/>
            : <ChevronDown size={14} className="text-[#7B78A8]"/>}
        </div>
      </button>

      {/* Content */}
      {isOpen && (
        <div className="px-4 py-4 space-y-4 bg-white">

          {/* Tab bahasa — hanya tampil kalau ada EN */}
          {hasEN && (
            <div className="flex gap-1 p-1 bg-[#F7F6FF] rounded-lg w-fit">
              <button
                onClick={() => setLang('id')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                  lang === 'id'
                    ? 'bg-white text-[#5C4FE5] shadow-sm'
                    : 'text-[#7B78A8] hover:text-[#1A1640]'
                }`}
              >
                🇮🇩 Indonesia
              </button>
              <button
                onClick={() => setLang('en')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                  lang === 'en'
                    ? 'bg-white text-[#5C4FE5] shadow-sm'
                    : 'text-[#7B78A8] hover:text-[#1A1640]'
                }`}
              >
                🇬🇧 English
              </button>
            </div>
          )}

          {/* MATERI */}
          {showMateri && getText(materi) && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <BookOpen size={12} className="text-[#5C4FE5]"/>
                <p className="text-[10px] font-bold text-[#5C4FE5] uppercase tracking-wide">
                  Materi
                </p>
              </div>
              <div className="text-[#1A1640] pl-1">
                {renderMarkdown(getText(materi))}
              </div>
            </div>
          )}

          {/* PERKEMBANGAN */}
          {showPerkembangan && getText(perkembangan) && (
            <div className={showMateri && getText(materi) ? 'border-t border-[#F0EFFF] pt-4' : ''}>
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingUp size={12} className="text-green-600"/>
                <p className="text-[10px] font-bold text-green-600 uppercase tracking-wide">
                  Perkembangan Siswa
                </p>
              </div>
              <div className="text-[#1A1640] pl-1">
                {renderMarkdown(getText(perkembangan))}
              </div>
            </div>
          )}

          {/* SARAN */}
          {(showSaranSiswa || showSaranOrtu) &&
            (getText(saranSiswa) || getText(saranOrtu)) && (
            <div className="border-t border-[#F0EFFF] pt-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Lightbulb size={12} className="text-amber-500"/>
                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wide">
                  Saran
                </p>
              </div>
              <div className="space-y-2 pl-1">
                {showSaranSiswa && getText(saranSiswa) && (
                  <div className="bg-blue-50 rounded-lg p-3">
                    <p className="text-[10px] font-bold text-blue-700 mb-1.5">
                      Untuk Siswa
                    </p>
                    <div className="text-blue-900">
                      {renderMarkdown(getText(saranSiswa))}
                    </div>
                  </div>
                )}
                {showSaranOrtu && getText(saranOrtu) && (
                  <div className="bg-purple-50 rounded-lg p-3">
                    <p className="text-[10px] font-bold text-[#5C4FE5] mb-1.5">
                      Untuk Orang Tua
                    </p>
                    <div className="text-[#3C3489]">
                      {renderMarkdown(getText(saranOrtu))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* RECORDING — tutor only */}
          {showRecording && laporan.recordingUrl && (
            <div className="border-t border-[#F0EFFF] pt-3">
              <a
                href={laporan.recordingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs font-bold text-[#5C4FE5] hover:underline"
              >
                <Video size={13}/>
                Lihat Recording Sesi
                <ExternalLink size={11}/>
              </a>
            </div>
          )}

        </div>
      )}
    </div>
  )
}
