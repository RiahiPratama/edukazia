import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'

export default async function RenderJSXPage({
  params
}: {
  params: Promise<{ component_id: string[] }>
}) {
  const { component_id } = await params
  const componentPath = component_id.join('/')
  
  const supabase = await createClient()
  
  const { data, error } = await supabase.storage
    .from('components')
    .download(componentPath)
  
  if (error || !data) {
    notFound()
  }
  
  const jsxContent = await data.text()
  
  // Extract component name
  const componentNameMatch = jsxContent.match(/export\s+default\s+(\w+)/)
  const componentName = componentNameMatch?.[1] || 'Component'
  
  // Clean JSX and REPLACE Lucide icons with emoji
  const cleanJSX = jsxContent
    .replace(/import\s+.*?from\s+['"][^'"]+['"];?\n?/g, '')
    .replace(/export\s+default\s+\w+;?\n?/g, '')
    // Replace Lucide icons with emoji
    .replace(/<BookOpen\s*([^>\/]*)\s*\/>/g, '<span className="inline-block">📖</span>')
    .replace(/<ChevronDown\s*([^>\/]*)\s*\/>/g, '<span className="inline-block">▼</span>')
    .replace(/<ChevronUp\s*([^>\/]*)\s*\/>/g, '<span className="inline-block">▲</span>')
    .replace(/<Globe\s*([^>\/]*)\s*\/>/g, '<span className="inline-block">🌐</span>')
    .replace(/<AlertTriangle\s*([^>\/]*)\s*\/>/g, '<span className="inline-block">⚠️</span>')
  
  // NO ESCAPING - srcDoc handles it automatically!
  
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
