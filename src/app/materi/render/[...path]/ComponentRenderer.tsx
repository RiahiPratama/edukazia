'use client'

import { useEffect, useRef } from 'react'

type Props = {
  jsxContent: string
}

export default function ComponentRenderer({ jsxContent }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    if (!iframeRef.current) return

    // Extract component name from export default
    const componentNameMatch = jsxContent.match(/export\s+default\s+(\w+)/)
    const componentName = componentNameMatch ? componentNameMatch[1] : 'Component'

    // Remove import and export statements, replace Lucide imports with emoji/SVG placeholders
    const cleanedJsx = jsxContent
      .replace(/import\s+.*?from\s+['"][^'"]+['"];?\n?/g, '')
      .replace(/export\s+default\s+\w+;?\n?/g, '')
      // Replace Lucide icon components with simple div placeholders
      .replace(/<BookOpen\s*([^>]*)\s*\/>/g, '<span className="inline-block">📖</span>')
      .replace(/<ChevronDown\s*([^>]*)\s*\/>/g, '<span className="inline-block">▼</span>')
      .replace(/<ChevronUp\s*([^>]*)\s*\/>/g, '<span className="inline-block">▲</span>')
      .replace(/<Globe\s*([^>]*)\s*\/>/g, '<span className="inline-block">🌐</span>')
      .replace(/<AlertTriangle\s*([^>]*)\s*\/>/g, '<span className="inline-block">⚠️</span>')

    // Create HTML document with React
    const htmlContent = `
<!DOCTYPE html>
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
    
    ${cleanedJsx}
    
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(<${componentName} />);
  </script>
</body>
</html>
    `

    // Write HTML to iframe
    const iframeDoc = iframeRef.current.contentDocument
    if (iframeDoc) {
      iframeDoc.open()
      iframeDoc.write(htmlContent)
      iframeDoc.close()
    }
  }, [jsxContent])

  return (
    <iframe
      ref={iframeRef}
      className="w-full h-screen border-0"
      title="Component"
      sandbox="allow-scripts allow-same-origin"
    />
  )
}
