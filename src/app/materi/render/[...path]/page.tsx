import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ComponentRenderer from './ComponentRenderer'

type PageProps = {
  params: Promise<{ path: string[] }>
}

export default async function RenderComponentPage({ params }: PageProps) {
  const { path } = await params
  
  // First segment is bucket name, rest is path inside bucket
  const bucketName = path[0]
  const componentPath = path.slice(1).join('/') + '.jsx'
  
  console.log('🔍 Bucket:', bucketName)
  console.log('🔍 Path:', componentPath)
  
  const supabase = await createClient()

  // Fetch component from Storage
  const { data, error } = await supabase.storage
    .from(bucketName)
    .download(componentPath)

  if (error) {
    console.error('❌ Storage error:', error)
    notFound()
  }
  
  if (!data) {
    console.error('❌ No data returned')
    notFound()
  }
  
  console.log('✅ File downloaded successfully!')

  // Read JSX content
  const jsxContent = await data.text()

  return <ComponentRenderer jsxContent={jsxContent} />
}
