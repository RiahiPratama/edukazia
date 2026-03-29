import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ComponentRenderer from './ComponentRenderer'

type PageProps = {
  params: Promise<{ path: string[] }>
}

export default async function RenderComponentPage({ params }: PageProps) {
  const { path } = await params
  const componentPath = path.join('/') + '.jsx'
  
  const supabase = await createClient()

  // Fetch component from Storage
  const { data, error } = await supabase.storage
    .from('components')
    .download(componentPath)

  if (error || !data) {
    notFound()
  }

  // Read JSX content
  const jsxContent = await data.text()

  return <ComponentRenderer jsxContent={jsxContent} />
}
