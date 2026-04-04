import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ComponentRenderer from './ComponentRenderer'
import CEFRRenderer from './CEFRRenderer'

// Detect apakah string adalah UUID
function isUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
}

export default async function RenderPage({
  params
}: {
  params: Promise<{ component_id: string[] }>
}) {
  const { component_id } = await params
  const componentPath = component_id.join('/')
  
  const supabase = await createClient()

  // ✅ CEFR: component_id adalah lesson UUID
  if (component_id.length === 1 && isUUID(component_id[0])) {
    const lessonId = component_id[0]

    // Fetch lesson name
    const { data: lesson } = await supabase
      .from('lessons')
      .select('lesson_name')
      .eq('id', lessonId)
      .single()

    // Fetch konten dari lesson_contents
    const { data: lessonContent } = await supabase
      .from('lesson_contents')
      .select('blocks')
      .eq('lesson_id', lessonId)
      .single()

    if (!lessonContent) {
      return (
        <div className="min-h-screen bg-[#F7F6FF] flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl border-2 border-[#E5E3FF] p-8 text-center max-w-md">
            <p className="text-lg font-semibold text-gray-700">Konten belum tersedia</p>
            <p className="text-sm text-gray-500 mt-2">Tutor sedang mempersiapkan materi ini.</p>
          </div>
        </div>
      )
    }

    // Support both TipTap JSON dan legacy blocks
    const blocks = lessonContent.blocks || {}
    const tiptapContent = blocks?.tiptap_content || null
    const legacyBlocks = Array.isArray(blocks) ? blocks : (blocks?.blocks || [])

    return (
      <CEFRRenderer
        content={tiptapContent}
        lessonName={lesson?.lesson_name || ''}
      />
    )
  }

  // ✅ BACAAN: component_id adalah storage path (bacaan/xxx.jsx)
  const { data, error } = await supabase.storage
    .from('components')
    .download(componentPath)
  
  if (error || !data) {
    notFound()
  }
  
  const jsxContent = await data.text()

  const componentNameMatch = jsxContent.match(/export\s+default\s+function\s+(\w+)/) 
    ?? jsxContent.match(/export\s+default\s+(\w+)/)
  const componentName = componentNameMatch?.[1] || 'Component'
  
  const cleanJSX = jsxContent
    .replace(/import\s+.*?from\s+['"][^'"]+['"];?\n?/g, '')
    .replace(/export\s+default\s+function\s+/g, 'function ')
    .replace(/export\s+default\s+\w+;?\n?/g, '')
    .replace(/<BookOpen\s*([^>\/]*)\s*\/>/g, '<span className="inline-block">📖</span>')
    .replace(/<ChevronDown\s*([^>\/]*)\s*\/>/g, '<span className="inline-block">▼</span>')
    .replace(/<ChevronUp\s*([^>\/]*)\s*\/>/g, '<span className="inline-block">▲</span>')
    .replace(/<Globe\s*([^>\/]*)\s*\/>/g, '<span className="inline-block">🌐</span>')
    .replace(/<AlertTriangle\s*([^>\/]*)\s*\/>/g, '<span className="inline-block">⚠️</span>')
  
  const htmlDoc = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    const { useState } = React;
    
    ${cleanJSX}
    
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(<${componentName} />);
  </script>
</body>
</html>`
  
  return (
    <iframe
      srcDoc={htmlDoc}
      className="w-full h-screen border-0"
      sandbox="allow-scripts"
    />
  )
}
