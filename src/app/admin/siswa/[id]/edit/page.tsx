import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import EnrollmentLevelManager from '@/components/admin/EnrollmentLevelManager'

export default async function AdminEditSiswaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  // Check auth
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Check admin role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/admin')

  // Fetch student data
  const { data: student } = await supabase
    .from('students')
    .select('*')
    .eq('id', id)
    .single()

  if (!student) notFound()

  return (
    <div className="min-h-screen bg-[#F7F6FF] pb-20">
      {/* Header */}
      <div className="bg-white border-b border-[#E5E3FF] sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <h1 className="text-[20px] font-black text-[#1A1530]">Edit Siswa</h1>
          <p className="text-[12px] text-[#9B97B2] mt-0.5">
            Kelola data siswa dan assignment level
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        {/* Data Siswa Section */}
        <div className="bg-white rounded-2xl border border-[#E5E3FF] p-6">
          <h2 className="text-[18px] font-bold text-[#1A1530] mb-4">Data Siswa</h2>
          
          {/* TODO: Tambahkan form existing Anda di sini */}
          {/* Contoh: */}
          <div className="space-y-4">
            <div>
              <label className="block text-[13px] font-semibold text-[#4A4580] mb-2">
                Nama Relasi
              </label>
              <input
                type="text"
                value={student.relation_name || ''}
                disabled
                className="w-full px-3 py-2.5 border-2 border-[#E5E3FF] rounded-lg text-[14px] bg-[#F7F6FF] text-[#9B97B2]"
              />
            </div>
            
            <div>
              <label className="block text-[13px] font-semibold text-[#4A4580] mb-2">
                Hubungan
              </label>
              <input
                type="text"
                value={student.relation_role || ''}
                disabled
                className="w-full px-3 py-2.5 border-2 border-[#E5E3FF] rounded-lg text-[14px] bg-[#F7F6FF] text-[#9B97B2]"
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#4A4580] mb-2">
                Slug
              </label>
              <input
                type="text"
                value={student.slug || ''}
                disabled
                className="w-full px-3 py-2.5 border-2 border-[#E5E3FF] rounded-lg text-[14px] bg-[#F7F6FF] text-[#9B97B2]"
              />
            </div>

            {/* Tambahkan field lain sesuai kebutuhan */}
          </div>
        </div>

        {/* ENROLLMENT & LEVEL MANAGER - SECTION BARU */}
        <EnrollmentLevelManager studentId={id} />

        {/* Section lain jika ada */}
      </div>
    </div>
  )
}
