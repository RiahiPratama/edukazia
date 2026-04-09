'use client'

import { useState, useRef } from 'react'
import { ZoomIn, ZoomOut, Maximize2, RotateCcw } from 'lucide-react'

type Props = {
  srcDoc?: string
  src?: string
  title?: string
  sandbox?: string
}

export default function IframeViewer({ srcDoc, src, title = 'Content', sandbox }: Props) {
  const [zoomLevel, setZoomLevel] = useState(1)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.15, 2.5))
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.15, 0.4))
  const handleZoomReset = () => setZoomLevel(1)
  const handleFullscreen = () => {
    const el = containerRef.current
    if (!el) return
    if (document.fullscreenElement) document.exitFullscreen()
    else el.requestFullscreen()
  }

  return (
    <div ref={containerRef} className="flex flex-col h-screen bg-white">
      {/* Toolbar */}
      <div className="flex items-center justify-end gap-1 px-4 py-2 bg-gray-50 border-b border-gray-200 flex-shrink-0">
        <button onClick={handleZoomOut} className="p-2 text-gray-500 hover:bg-gray-200 rounded-lg transition-colors" title="Zoom Out">
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="text-xs font-semibold text-gray-500 min-w-[40px] text-center">{Math.round(zoomLevel * 100)}%</span>
        <button onClick={handleZoomIn} className="p-2 text-gray-500 hover:bg-gray-200 rounded-lg transition-colors" title="Zoom In">
          <ZoomIn className="w-4 h-4" />
        </button>
        {zoomLevel !== 1 && (
          <button onClick={handleZoomReset} className="p-2 text-gray-500 hover:bg-gray-200 rounded-lg transition-colors" title="Reset Zoom">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}
        <button onClick={handleFullscreen} className="p-2 text-gray-500 hover:bg-gray-200 rounded-lg transition-colors" title="Fullscreen">
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Iframe */}
      <div className="flex-1 overflow-auto">
        <div style={{
          transform: `scale(${zoomLevel})`,
          transformOrigin: 'top center',
          width: `${100 / zoomLevel}%`,
          height: `${100 / zoomLevel}%`,
        }}>
          <iframe
            {...(srcDoc ? { srcDoc } : { src })}
            className="w-full h-full border-0"
            sandbox={sandbox}
            title={title}
          />
        </div>
      </div>
    </div>
  )
}
