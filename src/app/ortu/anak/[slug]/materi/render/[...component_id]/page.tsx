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

  // Fetch material metadata only (not JSX content)
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

  // Pass to client component for rendering
  return (
    <ComponentRenderer 
      componentPath={componentPath}
      category={category}
      title={material?.title || 'Material'}
    />
  )
}
