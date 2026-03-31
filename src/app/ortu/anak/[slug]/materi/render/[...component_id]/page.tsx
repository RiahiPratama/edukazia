import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'

export default async function RenderMaterialPage({
  params
}: {
  params: Promise<{ component_id: string[] }>
}) {
  const { component_id } = await params
  
  // Join array to get full path (e.g., ["bacaan", "file.jsx"] -> "bacaan/file.jsx")
  const componentPath = Array.isArray(component_id) ? component_id.join('/') : component_id
  
  const supabase = await createClient()

  // Get authenticated user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  // Fetch material content by storage_path (component_id)
  const { data: materialContent } = await supabase
    .from('material_contents')
    .select(`
      material_id,
      content_url,
      storage_path,
      materials (
        id,
        title,
        category
      )
    `)
    .eq('storage_path', componentPath)
    .single()

  if (!materialContent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F6FF]">
        <div className="text-center">
          <h1 className="text-xl font-bold text-red-600">Material not found</h1>
          <p className="text-gray-600 mt-2">Storage path: {componentPath}</p>
        </div>
      </div>
    )
  }

  const material = materialContent.materials as any
  const category = material?.category

  // Handle different categories
  if (category === 'bacaan') {
    // Bacaan: Fetch JSX component from storage
    const { data: componentData, error: downloadError } = await supabase
      .storage
      .from('components')
      .download(componentPath)

    if (downloadError || !componentData) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F7F6FF]">
          <div className="text-center">
            <h1 className="text-xl font-bold text-red-600">Component not found</h1>
            <p className="text-gray-600 mt-2">Storage path: {componentPath}</p>
            {downloadError && (
              <p className="text-sm text-red-500 mt-2">Error: {downloadError.message}</p>
            )}
          </div>
        </div>
      )
    }

    const jsxCode = await componentData.text()

    // Strip import statements from JSX code
    const cleanedJsxCode = jsxCode
      .replace(/import\s+.*?from\s+['"]react['"];?\n?/g, '')
      .replace(/import\s+.*?from\s+['"]lucide-react['"];?\n?/g, '')
      .trim();

    // Create HTML wrapper with React runtime + Babel for JSX transpilation
    const htmlWrapper = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script src="https://unpkg.com/lucide-react@0.263.1/dist/umd/lucide-react.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body {
      margin: 0;
      padding: 20px;
      font-family: system-ui, -apple-system, sans-serif;
      background: #F7F6FF;
    }
    #root {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    // Map React hooks and lucide icons to global scope
    const { useState, useEffect, useRef, useCallback, useMemo } = React;
    const { BookOpen, ChevronDown, ChevronUp, Globe, AlertTriangle, Check, X, Info, ChevronRight, ChevronLeft } = lucideReact;
    
    ${cleanedJsxCode}
    
    // Auto-detect component name and render
    const Component = typeof PronunciationGuideAE !== 'undefined' ? PronunciationGuideAE : 
                      typeof App !== 'undefined' ? App :
                      () => <div className="p-8 text-center text-red-600">Component not found</div>;
    
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(<Component />);
  </script>
</body>
</html>
`

    return (
      <div className="min-h-screen bg-white">
        <iframe
          srcDoc={htmlWrapper}
          className="w-full h-screen border-0"
          title={material?.title || 'Bacaan Material'}
        />
      </div>
    )
  } else if (category === 'cefr') {
    // CEFR: Audio player + text content
    const audioUrl = materialContent.content_url

    // Fetch audio file from storage if needed
    const { data: audioData, error: audioError } = await supabase
      .storage
      .from('audio')
      .download(componentPath)

    if (audioError || !audioData) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F7F6FF]">
          <div className="text-center">
            <h1 className="text-xl font-bold text-red-600">Audio not found</h1>
            <p className="text-gray-600 mt-2">Storage path: {componentPath}</p>
            {audioError && (
              <p className="text-sm text-red-500 mt-2">Error: {audioError.message}</p>
            )}
          </div>
        </div>
      )
    }

    const audioBlob = URL.createObjectURL(audioData)

    return (
      <div className="min-h-screen bg-[#F7F6FF] p-6">
        <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-8">
          <h1 className="text-2xl font-bold text-[#5C4FE5] mb-6">
            {material?.title || 'CEFR Material'}
          </h1>

          {/* Audio Player */}
          <div className="mb-8">
            <audio controls className="w-full">
              <source src={audioBlob} type="audio/mpeg" />
              Your browser does not support the audio element.
            </audio>
          </div>

          {/* Text Content (if available in content_url as markup) */}
          {audioUrl && (
            <div className="prose max-w-none">
              <div dangerouslySetInnerHTML={{ __html: audioUrl }} />
            </div>
          )}
        </div>
      </div>
    )
  }

  // Fallback for unknown category
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F6FF]">
      <div className="text-center">
        <h1 className="text-xl font-bold">Unknown material category</h1>
        <p className="text-gray-600 mt-2">Category: {category}</p>
      </div>
    </div>
  )
}
