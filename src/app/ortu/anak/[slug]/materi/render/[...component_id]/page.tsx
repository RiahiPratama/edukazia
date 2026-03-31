import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ComponentRenderer from './ComponentRenderer'

export default async function RenderMaterialPage({
  params
}: {
  params: Promise<{ component_id: string[] }>
}) {
  const { component_id } = await params
  const componentPath = Array.isArray(component_id) ? component_id.join('/') : component_id
  
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: materialContent } = await supabase
    .from('material_contents')
    .select(`
      material_id,
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
        </div>
      </div>
    )
  }

  const material = materialContent.materials as any
  const category = material?.category

  // For bacaan: Fetch JSX server-side
  if (category === 'bacaan') {
    const { data: componentData, error: downloadError } = await supabase
      .storage
      .from('components')
      .download(componentPath)

    if (downloadError || !componentData) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F7F6FF]">
          <div className="text-center">
            <h1 className="text-xl font-bold text-red-600">Component not found</h1>
            <p className="text-gray-600 mt-2">{downloadError?.message || 'Unknown error'}</p>
          </div>
        </div>
      )
    }

    const jsxCode = await componentData.text()

    // Strip import statements
    const cleanedJsxCode = jsxCode
      .replace(/import\s+.*?from\s+['"]react['"];?\n?/g, '')
      .replace(/import\s+.*?from\s+['"]lucide-react['"];?\n?/g, '')
      .trim()

    return (
      <ComponentRenderer 
        jsxCode={cleanedJsxCode}
        title={material?.title || 'Material'}
      />
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F6FF]">
      <div className="text-center">
        <h1 className="text-xl font-bold">Category not supported</h1>
        <p className="text-gray-600 mt-2">Category: {category}</p>
      </div>
    </div>
  )
}
