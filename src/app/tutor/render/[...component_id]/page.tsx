import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import CEFRRenderer from '@/app/ortu/anak/[slug]/materi/render/[...component_id]/CEFRRenderer'
import IframeViewer from '@/components/IframeViewer'

function isUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
}

export default async function TutorRenderPage({
  params
}: {
  params: Promise<{ component_id: string[] }>
}) {
  const { component_id } = await params
  const componentPath = component_id.join('/')
  const supabase = await createClient()

  // Auth check — hanya tutor
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'tutor') redirect('/login')

  // ✅ CEFR — lesson UUID
  if (component_id.length === 1 && isUUID(component_id[0])) {
    const lessonId = component_id[0]

    const { data: lesson } = await supabase
      .from('lessons')
      .select('lesson_name')
      .eq('id', lessonId)
      .single()

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
            <p className="text-sm text-gray-500 mt-2">Materi CEFR sedang disiapkan.</p>
          </div>
        </div>
      )
    }

    const blocks = lessonContent.blocks || {}
    const tiptapContent = blocks?.tiptap_content || null

    return (
      <CEFRRenderer
        content={tiptapContent}
        lessonName={lesson?.lesson_name || ''}
      />
    )
  }

  // ✅ BACAAN — storage path (bacaan/xxx.jsx)
  const { data, error } = await supabase.storage
    .from('components')
    .download(componentPath)

  if (error || !data) notFound()

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
    <IframeViewer
      srcDoc={htmlDoc}
      sandbox="allow-scripts"
      title={componentName}
    />
  )
}
