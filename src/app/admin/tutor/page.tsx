'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Plus, Trash2 } from 'lucide-react'
import ConfirmModal from '@/components/ui/ConfirmModal'

export default function TutorPage() {
  const supabase = createClient()
  const [tutors,    setTutors]    = useState<any[]>([])
  const [loading,   setLoading]   = useState(true)
  const [deleteId,  setDeleteId]  = useState<string | null>(null)
  const [deleting,  setDeleting]  = useState(false)
  const [deleteName,setDeleteName]= useState('')

  useEffect(() => { fetchTutors() }, [])

  async function fetchTutors() {
    setLoading(true)
    const { data } = await supabase
      .from('tutors')
      .select(`id, rate_per_session, bank_name, bank_account, is_active,
        profiles:profile_id(full_name, phone),
        tutor_courses(courses(name, color)),
        class_groups(id, label, status)`)
      .order('created_at', { ascending: false })
    setTutors(data ?? [])
    setLoading(false)
  }

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    await supabase.from('tutor_courses').delete().eq('tutor_id', deleteId)
    await supabase.from('tutors').delete().eq('id', deleteId)
    setDeleting(false); setDeleteId(null)
    fetchTutors()
  }

  function formatRp(n: number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-[#1A1640]" style={{fontFamily:'Sora,sans-serif'}}>Data Tutor</h1>
          <p className="text-sm text-[#7B78A8] mt-1">{tutors.filter(t => t.is_active).length} tutor aktif</p>
        </div>
        <Link href="/admin/tutor/baru"
          className="bg-[#5C4FE5] text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-[#3D34C4] transition-colors">
          + Tambah Tutor
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({length:3}).map((_,i) => (
            <div key={i} className="bg-white rounded-2xl border border-[#E5E3FF] p-5 animate-pulse">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-gray-200"/>
                <div><div className="h-4 w-28 bg-gray-200 rounded mb-1"/><div className="h-3 w-20 bg-gray-200 rounded"/></div>
              </div>
              <div className="h-3 w-full bg-gray-200 rounded mb-4"/>
              <div className="h-8 w-full bg-gray-200 rounded-lg"/>
            </div>
          ))}
        </div>
      ) : tutors.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E5E3FF] p-12 text-center">
          <div className="text-5xl mb-4">👨‍🏫</div>
          <p className="font-bold text-[#1A1640] mb-2">Belum ada tutor terdaftar</p>
          <p className="text-sm text-[#7B78A8] mb-4">Tambahkan tutor untuk mulai membuat jadwal kelas</p>
          <Link href="/admin/tutor/baru"
            className="inline-flex items-center gap-2 bg-[#5C4FE5] text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-[#3D34C4] transition-colors">
            + Tambah Tutor Pertama
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tutors.map((t: any) => {
            const activeClasses = t.class_groups?.filter((c: any) => c.status === 'active') ?? []
            return (
              <div key={t.id} className={`bg-white rounded-2xl border p-5 transition-all hover:shadow-sm ${t.is_active ? 'border-[#E5E3FF]' : 'border-gray-200 opacity-60'}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#5C4FE5] flex items-center justify-center text-white font-bold text-sm">
                      {(t.profiles?.full_name ?? 'T').split(' ').slice(0,2).map((n:string)=>n[0]).join('').toUpperCase()}
                    </div>
                    <div>
                      <div className="font-bold text-[#1A1640]">{t.profiles?.full_name ?? '—'}</div>
                      <div className="text-xs text-[#7B78A8]">{t.profiles?.phone ?? '—'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${t.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {t.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                    <button onClick={() => { setDeleteId(t.id); setDeleteName(t.profiles?.full_name ?? 'Tutor') }}
                      className="p-1 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors" title="Hapus">
                      <Trash2 size={13}/>
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-3">
                  {t.tutor_courses?.map((tc: any) => (
                    <span key={tc.courses?.name}
                      className="text-xs px-2 py-0.5 rounded-full font-semibold text-white"
                      style={{background: tc.courses?.color ?? '#5C4FE5'}}>
                      {tc.courses?.name}
                    </span>
                  ))}
                </div>

                <div className="border-t border-[#F0EFFF] pt-3 flex items-center justify-between mb-3">
                  <div>
                    <div className="text-xs text-[#7B78A8]">Tarif per sesi</div>
                    <div className="text-sm font-bold text-[#1A1640]">{formatRp(t.rate_per_session)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-[#7B78A8]">Kelas aktif</div>
                    <div className="text-sm font-bold text-[#1A1640]">{activeClasses.length} kelas</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Link href={`/admin/tutor/${t.id}`}
                    className="text-center py-2 bg-[#5C4FE5] text-white text-xs font-bold rounded-lg hover:bg-[#3D34C4] transition-colors">
                    Detail
                  </Link>
                  <Link href={`/admin/tutor/${t.id}/edit`}
                    className="text-center py-2 border border-[#E5E3FF] text-[#4A4580] text-xs font-bold rounded-lg hover:bg-[#F0EFFF] transition-colors">
                    Edit
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <ConfirmModal
        open={!!deleteId}
        title="Hapus Tutor?"
        description={`Tutor "${deleteName}" akan dihapus permanen beserta semua data kursusnya.`}
        confirmText="Ya, Hapus"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}
