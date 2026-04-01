// src/app/api/materials/revoke/route.ts

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { extractFileId, batchRevokeFiles } from '@/lib/googleDrive'

export async function POST(request: NextRequest) {
  try {
    const { studentId, levelId } = await request.json()

    if (!studentId || !levelId) {
      return NextResponse.json(
        { error: 'Missing studentId or levelId' },
        { status: 400 }
      )
    }

    // Initialize Supabase Admin
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Get student email
    const { data: student } = await supabase
      .from('students')
      .select('profiles!students_profile_id_fkey(email)')
      .eq('id', studentId)
      .single()

    const studentEmail = (Array.isArray((student as any)?.profiles) 
      ? (student as any).profiles[0]?.email 
      : (student as any)?.profiles?.email) as string

    if (!studentEmail) {
      return NextResponse.json(
        { error: 'Student email not found' },
        { status: 404 }
      )
    }

    // Get all Kosakata materials for this level
    const { data: materials } = await supabase
      .from('materials')
      .select('id, title, content_data')
      .eq('level_id', levelId)
      .eq('type', 'kosakata')

    if (!materials || materials.length === 0) {
      return NextResponse.json(
        { message: 'No materials found', revoked: 0 },
        { status: 200 }
      )
    }

    // Extract Google Drive File IDs
    const fileIds: string[] = []
    materials.forEach((material: any) => {
      const url = material.content_data?.url
      if (url) {
        const fileId = extractFileId(url)
        if (fileId) fileIds.push(fileId)
      }
    })

    if (fileIds.length === 0) {
      return NextResponse.json(
        { message: 'No valid Google Drive URLs found', revoked: 0 },
        { status: 200 }
      )
    }

    // Revoke access for all files
    const result = await batchRevokeFiles(fileIds, studentEmail)

    // Log the action
    await supabase.from('material_access_logs').insert({
      profile_id: studentId,
      event: 'batch_revoke',
      metadata: {
        level_id: levelId,
        email: studentEmail,
        files_revoked: result.successful,
        files_failed: result.failed
      }
    })

    return NextResponse.json({
      success: true,
      revoked: result.successful,
      failed: result.failed,
      total: result.total,
      studentEmail
    })

  } catch (error: any) {
    console.error('Revoke materials error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
