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

  const { data: componentData } = await supabase.storage.from('components').download(componentPath)
  if (!componentData) notFound()

  const jsxContent = await componentData.text()
  
  return <ComponentRenderer jsxContent={jsxContent} />
}
