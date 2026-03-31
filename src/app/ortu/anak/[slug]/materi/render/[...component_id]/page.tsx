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

  // Fetch material content
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

    // Encode JSX code for safe transmission
    const encodedCode = encodeURIComponent(cleanedJsxCode);

    return (
      <div className="min-h-screen bg-white">
        <iframe
          src={`/sandbox.html?code=${encodedCode}`}
          className="w-full h-screen border-0"
          title={material?.title || 'Bacaan Material'}
          sandbox="allow-scripts allow-same-origin"
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
