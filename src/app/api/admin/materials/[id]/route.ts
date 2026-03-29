import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

type RouteParams = {
  params: Promise<{ id: string }>
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  const { id } = await params
  const supabase = await createClient()

  // 1. Check admin authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Verify admin role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
  }

  // 3. Get material details (need component_id for Storage deletion)
  const { data: material, error: fetchError } = await supabase
    .from('materials')
    .select('id, component_id, title')
    .eq('id', id)
    .single()

  if (fetchError || !material) {
    return NextResponse.json({ error: 'Material not found' }, { status: 404 })
  }

  // 4. Delete file from Storage (if component_id exists)
  let storageDeleted = false
  if (material.component_id) {
    // Extract bucket name and file path from component_id
    // Format: "components/bacaan/filename.jsx"
    // First segment is bucket, rest is path
    const parts = material.component_id.split('/')
    const bucketName = parts[0]
    const filePath = parts.slice(1).join('/')

    if (bucketName && filePath) {
      const { error: storageError } = await supabase.storage
        .from(bucketName)
        .remove([filePath])

      if (storageError) {
        console.error('Storage deletion error:', storageError)
        // Continue anyway - database deletion is more important
      } else {
        storageDeleted = true
      }
    }
  }

  // 5. Delete from database
  const { error: deleteError } = await supabase
    .from('materials')
    .delete()
    .eq('id', id)

  if (deleteError) {
    return NextResponse.json(
      { error: 'Failed to delete material from database', details: deleteError.message },
      { status: 500 }
    )
  }

  // 6. Return success response
  return NextResponse.json({
    success: true,
    message: 'Material deleted successfully',
    details: {
      material_id: id,
      title: material.title,
      storage_file_deleted: storageDeleted,
      component_id: material.component_id || null
    }
  })
}

// Optional: Add GET for material details
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: material, error } = await supabase
    .from('materials')
    .select(`
      *,
      courses(name, color),
      levels(name)
    `)
    .eq('id', id)
    .single()

  if (error || !material) {
    return NextResponse.json({ error: 'Material not found' }, { status: 404 })
  }

  return NextResponse.json({ material })
}
