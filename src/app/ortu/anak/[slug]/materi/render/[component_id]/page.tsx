import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'

export default async function RenderMaterialPage({
  params
}: {
  params: Promise<{ component_id: string }>
}) {
  const { component_id } = await params
  const supabase = await createClient()

  // Get authenticated user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  // Fetch material content by storage_path (component_id)
  const { data: materialContent } = await supabase
    .from('material_contents')
    .select(`
      material_id,
      category,
      content_url,
      storage_path,
      materials (
        id,
        title
      )
    `)
    .eq('storage_path', component_id)
    .single()

  if (!materialContent) {
    notFound()
  }

  const category = materialContent.category

  // Handle different categories
  if (category === 'bacaan') {
    // Bacaan: Fetch JSX component from storage
    const { data: componentData } = await supabase
      .storage
      .from('components')
      .download(component_id)

    if (!componentData) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F7F6FF]">
          <div className="text-center">
            <h1 className="text-xl font-bold text-red-600">Component not found</h1>
            <p className="text-gray-600 mt-2">Storage path: {component_id}</p>
          </div>
        </div>
      )
    }

    const jsxCode = await componentData.text()

    return (
      <div className="min-h-screen bg-[#F7F6FF]">
        <iframe
          srcDoc={jsxCode}
          className="w-full h-screen border-0"
          sandbox="allow-scripts"
          title={(materialContent.materials as any)?.title || 'Bacaan Material'}
        />
      </div>
    )
  } else if (category === 'cefr') {
    // CEFR: Audio player + text content
    const audioUrl = materialContent.content_url

    // Fetch audio file from storage if needed
    const { data: audioData } = await supabase
      .storage
      .from('audio')
      .download(component_id)

    if (!audioData) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F7F6FF]">
          <div className="text-center">
            <h1 className="text-xl font-bold text-red-600">Audio not found</h1>
          </div>
        </div>
      )
    }

    const audioBlob = URL.createObjectURL(audioData)

    return (
      <div className="min-h-screen bg-[#F7F6FF] p-6">
        <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-8">
          <h1 className="text-2xl font-bold text-[#5C4FE5] mb-6">
            {(materialContent.materials as any)?.title || 'CEFR Material'}
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
