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
    .select('id, template_id, title, category')
    .eq('id', id)
    .single()

  if (fetchError || !material) {
    return NextResponse.json({ error: 'Material not found' }, { status: 404 })
  }

  // 4. Delete file from Storage (if template_id exists)
  let storageDeleted = false
  if (material.template_id) {
    // Determine bucket based on category
    let bucketName = 'components'
    if (material.category === 'cefr') {
      bucketName = 'audio'
    }

    const { error: storageError } = await supabase.storage
      .from(bucketName)
      .remove([material.template_id])

    if (storageError) {
      console.error('Storage deletion error:', storageError)
      // Continue anyway - database deletion is more important
    } else {
      storageDeleted = true
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
      template_id: material.template_id || null
    }
  })
}

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
      lessons(id, lesson_name, unit_id, units(id, unit_name, level_id))
    `)
    .eq('id', id)
    .single()

  if (error || !material) {
    return NextResponse.json({ error: 'Material not found' }, { status: 404 })
  }

  return NextResponse.json({ material })
}

export async function PATCH(
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

  // 3. Parse request body
  const body = await request.json()
  const { 
    title,
    category,
    lesson_id,
    position,
    canva_urls,
    template_id,
    content_data
  } = body

  // 4. Build update object - only include provided fields
  const updateData: any = {}
  
  if (title !== undefined) updateData.title = title
  if (category !== undefined) updateData.category = category
  if (lesson_id !== undefined) updateData.lesson_id = lesson_id
  if (position !== undefined) updateData.position = position
  if (template_id !== undefined) updateData.template_id = template_id
  
  // Handle content_data and canva_urls
  if (content_data !== undefined) {
    updateData.content_data = content_data
    
    // IMPORTANT: If content_data has a Canva URL, also save to canva_urls array
    if (content_data.platform === 'canva' && content_data.url) {
      updateData.canva_urls = [content_data.url]
      console.log('✅ Saving to canva_urls from content_data:', content_data.url)
    }
  }
  
  // Direct canva_urls takes precedence
  if (canva_urls !== undefined) {
    updateData.canva_urls = canva_urls
    console.log('✅ Saving to canva_urls directly:', canva_urls)
  }
  
  // Always update timestamp
  updateData.updated_at = new Date().toISOString()

  // 5. Update material
  const { data: updatedMaterial, error: updateError } = await supabase
    .from('materials')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (updateError) {
    console.error('Material update error:', updateError)
    return NextResponse.json(
      { error: 'Failed to update material', details: updateError.message },
      { status: 500 }
    )
  }

  // 6. Return success response
  return NextResponse.json({
    success: true,
    message: 'Material updated successfully',
    material: updatedMaterial
  })
}
