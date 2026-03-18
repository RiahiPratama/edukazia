import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function KelasPage() {
  const supabase = await createClient()

  const { data: kelas } = await supabase
    .from('class_groups')
    .select(`
      id, label, status, max_participants,
      courses ( name, color ),
      class_types ( name ),
      tutors ( profiles ( full_name ) ),
      enrollments ( id, status )
    `)
    .order('created_at', { ascending: false })

  const statusLabel: Record<string, string> = {
    active: 'Aktif', inactive: 'Nonaktif', completed: 'Selesai'
  }
  const statusColor: Record<string, string> = {
    active:    'bg-green-100 text-green-700',
    inactive:  'bg-gray-100 text-gray-500',
    completed: 'bg-blue-100 text-blue-700',
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-[#1A1640]" style={{fontFamily:'Sora,sans-serif'}}>Manajemen Kelas</h1>
          <p className="text-sm text-[#7B78A8] mt-1">{kelas?.length ?? 0} kelas terdaftar</p>
        </div>
        <Link href="/admin/kelas/baru"
          className="bg-[#5C4FE5] text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-[#3D34C4] transition-colors">
          + Buat Kelas
        </Link>
      </div>

      {!kelas || kelas.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E5E3FF] p-12 text-center">
          <div className="text-5xl mb-4">🏫</div>
          <p className="font-bold text-[#1A1640] mb-2">Belum ada kelas</p>
          <p className="text-sm text-[#7B78A8] mb-4">Buat kelas pertama untuk mulai mendaftarkan siswa</p>
          <Link href="/admin/kelas/baru"
            className="inline-flex items-center gap-2 bg-[#5C4FE5] text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-[#3D34C4] transition-colors">
            + Buat Kelas Pertama
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {kelas.map((k: any) => {
            const activeEnroll = k.enrollments?.filter((e: any) => e.status === 'active').length ?? 0
            const isFull = activeEnroll >= k.max_participants
            return (
              <div key={k.id} className="bg-white rounded-2xl border border-[#E5E3FF] p-5 hover:shadow-sm transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-[#1A1640] truncate">{k.label}</div>
                    <div className="text-xs text-[#7B78A8] mt-0.5">{k.courses?.name} · {k.class_types?.name}</div>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ml-2 flex-shrink-0 ${statusColor[k.status] ?? 'bg-gray-100 text-gray-500'}`}>
                    {statusLabel[k.status] ?? k.status}
                  </span>
                </div>

                <div className="text-sm text-[#4A4580] mb-3">
                  👨‍🏫 {(k.tutors as any)?.profiles?.full_name ?? '—'}
                </div>

                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-[#7B78A8]">Peserta</div>
                  <div className={`text-sm font-bold ${isFull ? 'text-red-600' : 'text-green-600'}`}>
                    {activeEnroll}/{k.max_participants}
                  </div>
                </div>

                <div className="w-full h-1.5 bg-[#E5E3FF] rounded-full overflow-hidden mb-4">
                  <div
                    className={`h-full rounded-full ${isFull ? 'bg-red-400' : 'bg-[#5C4FE5]'}`}
                    style={{ width: `${Math.min((activeEnroll / k.max_participants) * 100, 100)}%` }}
                  />
                </div>

                {/* Tombol — hanya Edit Kelas & Detail */}
                <div className="flex gap-2">
                  <Link href={`/admin/kelas/${k.id}/edit`}
                    className="flex-1 text-center py-2 bg-[#5C4FE5] text-white text-xs font-bold rounded-lg hover:bg-[#3D34C4] transition-colors">
                    Edit Kelas
                  </Link>
                  <Link href={`/admin/kelas/${k.id}`}
                    className="flex-1 text-center py-2 border border-[#E5E3FF] text-[#4A4580] text-xs font-bold rounded-lg hover:bg-[#F0EFFF] transition-colors">
                    Detail
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
