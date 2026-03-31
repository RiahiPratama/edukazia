'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface ComponentRendererProps {
  componentPath: string
  category: string
  title: string
}

export default function ComponentRenderer({ componentPath, category, title }: ComponentRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (category !== 'bacaan') return

    let mounted = true

    async function loadAndRenderComponent() {
      try {
        const supabase = createClient()

        // Fetch JSX from storage
        const { data: componentData, error: downloadError } = await supabase
          .storage
          .from('components')
          .download(componentPath)

        if (!mounted) return
        
        if (downloadError || !componentData) {
          setError('Component not found: ' + componentPath)
          setLoading(false)
          return
        }

        const jsxCode = await componentData.text()

        // Strip import statements
        const cleanedJsxCode = jsxCode
          .replace(/import\s+.*?from\s+['"]react['"];?\n?/g, '')
          .replace(/import\s+.*?from\s+['"]lucide-react['"];?\n?/g, '')
          .trim()

        // Wait for sandbox ready signal
        const handleMessage = (event: MessageEvent) => {
          if (event.data && event.data.type === 'SANDBOX_READY') {
            // Send component code to sandbox
            if (iframeRef.current?.contentWindow) {
              iframeRef.current.contentWindow.postMessage({
                type: 'RENDER_COMPONENT',
                code: cleanedJsxCode
              }, '*')
              
              if (mounted) {
                setLoading(false)
              }
            }
            
            // Cleanup listener
            window.removeEventListener('message', handleMessage)
          }
        }

        window.addEventListener('message', handleMessage)

        // Cleanup on unmount
        return () => {
          window.removeEventListener('message', handleMessage)
        }

      } catch (err: any) {
        if (mounted) {
          setError('Error loading component: ' + err.message)
          setLoading(false)
        }
      }
    }

    loadAndRenderComponent()

    return () => {
      mounted = false
    }
  }, [componentPath, category])

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

  if (category === 'bacaan') {
    return (
      <div className="min-h-screen bg-white relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#F7F6FF] z-10">
            <div className="text-[#5C4FE5] text-lg font-medium">Loading component...</div>
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

  // Other categories...
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F6FF]">
      <div className="text-center">
        <h1 className="text-xl font-bold">Category not supported yet</h1>
        <p className="text-gray-600 mt-2">Category: {category}</p>
      </div>
    </div>
  )
}
