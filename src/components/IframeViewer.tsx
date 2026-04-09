'use client'

import { useRef } from 'react'
import { Maximize2 } from 'lucide-react'

type Props = {
  srcDoc?: string
  src?: string
  title?: string
  sandbox?: string
}

export default function IframeViewer({ srcDoc, src, title = 'Content', sandbox }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  const handleFullscreen = () => {
    const el = containerRef.current
    if (!el) return
    if (document.fullscreenElement) document.exitFullscreen()
    else el.requestFullscreen()
  }

  return (
    <div ref={containerRef} className="flex flex-col h-screen bg-white">
      <div className="flex items-center justify-end px-4 py-2 bg-gray-50 border-b border-gray-200 flex-shrink-0">
        <button onClick={handleFullscreen} className="p-2 text-gray-500 hover:bg-gray-200 rounded-lg transition-colors" title="Fullscreen">
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        <iframe
          {...(srcDoc ? { srcDoc } : { src })}
          className="w-full h-full border-0"
          sandbox={sandbox}
          title={title}
        />
      </div>
    </div>
  )
}
