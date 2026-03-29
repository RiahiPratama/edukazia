'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

type Props = {
  materialId: string
  materialTitle: string
  onDeleteSuccess?: () => void
}

export default function DeleteMaterialButton({ materialId, materialTitle, onDeleteSuccess }: Props) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setIsDeleting(true)
    setError(null)

    try {
      // THIS IS THE KEY! Call DELETE API route
      const response = await fetch(`/api/admin/materials/${materialId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete material')
      }

      // Success!
      console.log('Deletion successful:', data)
      setShowConfirm(false)
      
      if (onDeleteSuccess) {
        onDeleteSuccess()
      } else {
        router.refresh()
      }

      // Show success message
      const storageMsg = data.details.storage_file_deleted 
        ? '\nFile di Storage juga terhapus! ✅' 
        : '\nFile di Storage tidak ditemukan.'
      
      alert(`✅ Material "${materialTitle}" berhasil dihapus!${storageMsg}`)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus material')
      console.error('Delete error:', err)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      {/* Delete Button */}
      <button
        onClick={() => setShowConfirm(true)}
        disabled={isDeleting}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Hapus Material"
      >
        <Trash2 size={16} />
        <span>Hapus</span>
      </button>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 size={24} className="text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  Hapus Material?
                </h3>
                <p className="text-sm text-gray-500">
                  Tindakan ini tidak bisa dibatalkan
                </p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-700">
                <strong>Material:</strong> {materialTitle}
              </p>
              <p className="text-xs text-gray-600 mt-2">
                File di Storage (jika ada) juga akan dihapus secara otomatis.
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowConfirm(false)
                  setError(null)
                }}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
