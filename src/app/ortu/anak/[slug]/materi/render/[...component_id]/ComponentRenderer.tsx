'use client'

import { useEffect, useRef, useState } from 'react'

interface ComponentRendererProps {
  jsxCode: string
  title: string
}

export default function ComponentRenderer({ jsxCode, title }: ComponentRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'SANDBOX_READY') {
        console.log('Sandbox ready, sending component code...')
        
        // Send component code to sandbox
        if (iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage({
            type: 'RENDER_COMPONENT',
            code: jsxCode
          }, '*')
          
          console.log('Component code sent to sandbox')
          
          if (mounted) {
            setLoading(false)
          }
        }
        
        // Cleanup listener
        window.removeEventListener('message', handleMessage)
      }
    }

    window.addEventListener('message', handleMessage)
    console.log('Waiting for sandbox ready signal...')

    // Cleanup
    return () => {
      mounted = false
      window.removeEventListener('message', handleMessage)
    }
  }, [jsxCode])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F6FF]">
        <div className="text-center">
          <h1 className="text-xl font-bold text-red-600">Error</h1>
          <p className="text-gray-600 mt-2">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white relative">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#F7F6FF] z-10">
          <div className="text-center">
            <div className="text-[#5C4FE5] text-lg font-medium mb-2">Loading component...</div>
            <div className="text-sm text-gray-500">Initializing React sandbox...</div>
          </div>
        </div>
      )}
      <iframe
        ref={iframeRef}
        src="/sandbox.html"
        className="w-full h-screen border-0"
        title={title}
      />
    </div>
  )
}
