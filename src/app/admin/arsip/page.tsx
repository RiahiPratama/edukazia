'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Archive, RotateCcw, Trash2 } from 'lucide-react'
import ConfirmModal from '@/components/ui/ConfirmModal'

export default function AdminArsipPage() {
  const supabase = createClient()
  const [kelasList, setKelasList] = useState<any[]>([])
  const [loading,   setLoading]   = useState(true)

  const [restoreId,    setRestoreId]    = useState<string | null>(null)
  const [restoreLabel, setRestoreLabel] = useState('')
  const [restoring,    setRestoring]    = useState(false)

  const [deleteId,    setDeleteId]    = useState<string | null>(null)
  const [deleteLabel, setDeleteLabel] = useState('')
  const [deleting,    setDeleting]    = useState(false)

  useEffect(() => { fetchArsip() }, [])

  async function fetchArsip() {
    setLoading(true)
    const { data } = await supabase
      .from('class_groups')
      .select(`id, label, status, max_participants, created_at,
        courses(name, color), class_types(name),
        tutors(profiles(full_name)),
        enrollments(id, status)`)
      .eq('status', 'inactive')
      .order('created_at', { ascending: false })
    setKelasList(data ?? [])
    setLoading(false)
  }

  async function handleRestore() {
    if (!restoreId) return
    setRestoring(true)
    await supabase.from('class_groups').update({ status: 'active' }).eq('id', restoreId)
    setRestoring(false)
    setRestoreId(null)
    fetchArsip()
  }

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    await supabase.from('sessions').delete().eq('class_group_id', deleteId)
    await supabase.from('enrollments').delete().eq('class_group_id', deleteId)
    await supabase.from('class_groups').delete().eq('id', deleteId)
    setDeleting(false)
    setDeleteId(null)
    fetchArsip()
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-black text-[#1A1640]" style={{ fontFamily: 'Sora, sans-serif' }}>Arsip Kelas</h1>
        <p className="text-sm text-[#7B78A8] mt-1">Kelas yang sudah tidak aktif</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-[#E5E3FF] p-5 animate-pulse">
              <div className="h-4 w-32 bg-gray-200 rounded mb-2"/>
              <div className="h-3 w-24 bg-gray-200 rounded mb-4"/>
              <div className="h-8 bg-gray-200 rounded-lg"/>
            </div>
          ))}
        </div>
      ) : kelasList.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E5E3FF] p-12 text-center">
          <Archive size={40} strokeWidth={1.5} className="text-[#C4BFFF] mx-auto mb-3"/>
          <p className="font-bold text-[#1A1640] mb-1">Belum ada kelas diarsipkan</p>
          <p className="text-sm text-[#7B78A8] mb-4">Kelas yang diarsipkan dari halaman Kelas akan muncul di sini</p>
          <Link href="/admin/kelas" className="inline-flex items-center gap-2 text-[#5C4FE5] font-semibold text-sm hover:underline">
            ← Kembali ke Manajemen Kelas
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {kelasList.map((k: any) => {
            const totalEnroll  = k.enrollments?.length ?? 0
            const archivedDate = new Date(k.created_at).toLocaleDateString('id-ID', {
              day: 'numeric', month: 'short', year: 'numeric'
            })
            return (
              <div key={k.id} className="bg-white rounded-2xl border border-gray-200 p-5 opacity-90 hover:opacity-100 transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-[#7B78A8] truncate">{k.label}</div>
                    <div className="text-xs text-[#9B97B2] mt-0.5">{k.courses?.name} · {k.class_types?.name}</div>
                  </div>
                  <div className="flex items-center gap-1.5 ml-2">
                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-gray-100 text-gray-500">
                      Arsip
                    </span>
                    <button onClick={() => { setDeleteId(k.id); setDeleteLabel(k.label) }}
                      className="p-1 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Hapus Permanen">
                      <Trash2 size={13}/>
                    </button>
                  </div>
                </div>

                <div className="text-sm text-[#7B78A8] mb-3">
                  👨‍🏫 {k.tutors?.profiles?.full_name ?? '—'}
                </div>

                <div className="flex items-center justify-between text-xs text-[#9B97B2] mb-4">
                  <span>{totalEnroll} siswa terdaftar</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => { setRestoreId(k.id); setRestoreLabel(k.label) }}
                    className="flex items-center justify-center gap-1.5 py-2 bg-green-50 text-green-700 text-xs font-bold rounded-lg hover:bg-green-100 transition-colors">
                    <RotateCcw size={11}/> Aktifkan
                  </button>
                  <Link href={`/admin/kelas/${k.id}`}
                    className="text-center py-2 border border-[#E5E3FF] text-[#4A4580] text-xs font-bold rounded-lg hover:bg-[#F0EFFF] transition-colors">
                    Detail
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <ConfirmModal
        open={!!restoreId}
        title="Aktifkan Kembali?"
        description={`Kelas "${restoreLabel}" akan diaktifkan kembali dan muncul di Manajemen Kelas.`}
        confirmText="Ya, Aktifkan"
        cancelText="Batal"
        loading={restoring}
        onConfirm={handleRestore}
        onCancel={() => setRestoreId(null)}
      />

      <ConfirmModal
        open={!!deleteId}
        title="Hapus Permanen?"
        description={`Kelas "${deleteLabel}" akan dihapus permanen beserta semua data. Tindakan ini tidak bisa dibatalkan.`}
        confirmText="Ya, Hapus"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}
