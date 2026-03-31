import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'

export default async function RenderMaterialPage({
  params
}: {
  params: Promise<{ component_id: string[] }>
}) {
  const { component_id } = await params
  
  // Join array to get full path
  const componentPath = Array.isArray(component_id) ? component_id.join('/') : component_id
  
  const supabase = await createClient()

  // Get authenticated user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  // Fetch material content by storage_path
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

  // Handle bacaan category
  if (category === 'bacaan') {
    // Fetch JSX component from storage
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

    // Strip import statements
    const cleanedJsxCode = jsxCode
      .replace(/import\s+.*?from\s+['"]react['"];?\n?/g, '')
      .replace(/import\s+.*?from\s+['"]lucide-react['"];?\n?/g, '')
      .trim();

    // Escape backticks and ${} in JSX code for template literal
    const escapedJsxCode = cleanedJsxCode
      .replace(/\\/g, '\\\\')
      .replace(/`/g, '\\`')
      .replace(/\$/g, '\\$');

    // Create HTML wrapper
    const htmlWrapper = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${material?.title || 'Bacaan Material'}</title>
  
  <!-- React & ReactDOM -->
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  
  <!-- Babel Standalone -->
  <script src="https://unpkg.com/@babel/standalone@7.23.5/babel.min.js"></script>
  
  <!-- Lucide React Icons (ES Module) -->
  <script type="module">
    import * as LucideReact from 'https://cdn.jsdelivr.net/npm/lucide-react@0.263.1/dist/esm/lucide-react.js';
    window.LucideReact = LucideReact;
    window.lucideLoaded = true;
  </script>
  
  <!-- Tailwind CSS -->
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
    #loading {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 400px;
      color: #5C4FE5;
      font-size: 18px;
    }
  </style>
</head>
<body>
  <div id="root">
    <div id="loading">Loading component...</div>
  </div>
  
  <script>
    // Wait for all libraries to load
    function waitForLibraries() {
      return new Promise((resolve) => {
        const check = () => {
          if (window.React && window.ReactDOM && window.Babel && window.lucideLoaded) {
            resolve();
          } else {
            setTimeout(check, 100);
          }
        };
        check();
      });
    }
    
    waitForLibraries().then(() => {
      try {
        // Create Babel-transformed script
        const code = \`
          const { useState, useEffect, useRef, useCallback, useMemo } = React;
          const { BookOpen, ChevronDown, ChevronUp, Globe, AlertTriangle, Check, X, Info, ChevronRight, ChevronLeft } = window.LucideReact;
          
          ${escapedJsxCode}
          
          // Auto-detect component
          const Component = typeof PronunciationGuideAE !== 'undefined' ? PronunciationGuideAE : 
                            typeof App !== 'undefined' ? App :
                            () => React.createElement('div', { className: 'p-8 text-center text-red-600' }, 'Component not found');
          
          const root = ReactDOM.createRoot(document.getElementById('root'));
          root.render(React.createElement(Component));
        \`;
        
        // Transform and execute
        const transformed = Babel.transform(code, {
          presets: ['react']
        }).code;
        
        eval(transformed);
      } catch (error) {
        console.error('Error rendering component:', error);
        document.getElementById('root').innerHTML = \`
          <div style="padding: 32px; text-align: center;">
            <h2 style="color: #ef4444; font-size: 20px; font-weight: bold;">Error Loading Component</h2>
            <p style="color: #6b7280; margin-top: 8px;">\${error.message}</p>
          </div>
        \`;
      }
    });
  </script>
</body>
</html>
`;

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
    // CEFR: Audio player
    const audioUrl = materialContent.content_url

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

          <div className="mb-8">
            <audio controls className="w-full">
              <source src={audioBlob} type="audio/mpeg" />
              Your browser does not support the audio element.
            </audio>
          </div>

          {audioUrl && (
            <div className="prose max-w-none">
              <div dangerouslySetInnerHTML={{ __html: audioUrl }} />
            </div>
          )}
        </div>
      </div>
    )
  }

  // Fallback
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F6FF]">
      <div className="text-center">
        <h1 className="text-xl font-bold">Unknown material category</h1>
        <p className="text-gray-600 mt-2">Category: {category}</p>
      </div>
    </div>
  )
}
