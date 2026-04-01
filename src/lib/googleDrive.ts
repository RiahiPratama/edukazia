// src/lib/googleDrive.ts

import { google } from 'googleapis'

/**
 * Initialize Google Drive API client
 */
export function getDriveClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!),
    scopes: ['https://www.googleapis.com/auth/drive']
  })

  return google.drive({ version: 'v3', auth })
}

/**
 * Extract Google Drive File ID from URL
 * Supports formats:
 * - https://drive.google.com/file/d/FILE_ID/view
 * - https://drive.google.com/open?id=FILE_ID
 */
export function extractFileId(url: string): string | null {
  if (!url) return null

  // Format: /file/d/FILE_ID/view
  const match1 = url.match(/\/file\/d\/([^\/]+)/)
  if (match1) return match1[1]

  // Format: ?id=FILE_ID
  const match2 = url.match(/[?&]id=([^&]+)/)
  if (match2) return match2[1]

  return null
}

/**
 * Share file to specific email (read-only)
 */
export async function shareFileToEmail(fileId: string, email: string) {
  const drive = getDriveClient()

  try {
    const permission = await drive.permissions.create({
      fileId,
      requestBody: {
        type: 'user',
        role: 'reader',
        emailAddress: email
      },
      fields: 'id'
    })

    return { success: true, permissionId: permission.data.id }
  } catch (error: any) {
    console.error('Error sharing file:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Remove file access from email
 */
export async function revokeFileAccess(fileId: string, email: string) {
  const drive = getDriveClient()

  try {
    // Get all permissions
    const permissions = await drive.permissions.list({
      fileId,
      fields: 'permissions(id,emailAddress)'
    })

    // Find permission ID for this email
    const permission = permissions.data.permissions?.find(
      p => p.emailAddress === email
    )

    if (!permission?.id) {
      return { success: false, error: 'Permission not found' }
    }

    // Delete permission
    await drive.permissions.delete({
      fileId,
      permissionId: permission.id
    })

    return { success: true }
  } catch (error: any) {
    console.error('Error revoking access:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Batch share multiple files to one email
 */
export async function batchShareFiles(fileIds: string[], email: string) {
  const results = await Promise.allSettled(
    fileIds.map(fileId => shareFileToEmail(fileId, email))
  )

  const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length
  const failed = results.length - successful

  return { successful, failed, total: results.length }
}

/**
 * Batch revoke access for multiple files
 */
export async function batchRevokeFiles(fileIds: string[], email: string) {
  const results = await Promise.allSettled(
    fileIds.map(fileId => revokeFileAccess(fileId, email))
  )

  const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length
  const failed = results.length - successful

  return { successful, failed, total: results.length }
}
