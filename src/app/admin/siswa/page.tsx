import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function SiswaPage() {
  const supabase = await createClient()

  const { data: siswa } = await supabase
    .from('students')
    .select(`
      id, grade, school,
      profiles!students_profile_id_fkey ( full_name, phone ),
      parent:profiles!students_parent_profile_id_fkey ( full_name, phone ),
      enrollments ( id, sessions_used, sessions_total, status,
        class_groups ( label, courses ( name ) )
      )
    `)
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-[#1A1640]" style={{ fontFamily: 'Sora,sans-serif' }}>Data Siswa</h1>
          <p className="text-sm text-[#7B78A8] mt-1">{siswa?.length ?? 0} siswa terdaftar</p>
        </div>
        <Link href="/admin/siswa/baru" className="bg-[#5C4FE5] text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-[#3D34C4] transition-colors">
          + Tambah Siswa
        </Link>
      </div>

      {!siswa || siswa.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E5E3FF] p-12 text-center">
          <div className="text-5xl mb-4">👨‍🎓</div>
          <p className="font-bold text-[#1A1640] mb-2">Belum ada siswa terdaftar</p>
          <p className="text-sm text-[#7B78A8] mb-4">Tambahkan siswa pertama untuk mulai mengelola kelas</p>
          <Link href="/admin/siswa/baru" className="inline-flex items-center gap-2 bg-[#5C4FE5] text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-[#3D34C4] transition-colors">
            + Tambah Siswa Pertama
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E5E3FF] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F7F6FF]">
                <tr>
                  <th className="text-left py-3 px-4 text-xs font-bold text-[#7B78A8] uppercase tracking-wide">Siswa</th>
                  <th className="text-left py-3 px-4 text-xs font-bold text-[#7B78A8] uppercase tracking-wide">Orang Tua</th>
                  <th className="text-left py-3 px-4 text-xs font-bold text-[#7B78A8] uppercase tracking-wide">Sekolah</th>
                  <th className="text-left py-3 px-4 text-xs font-bold text-[#7B78A8] uppercase tracking-wide">Kelas Aktif</th>
                  <th className="text-left py-3 px-4 text-xs font-bold text-[#7B78A8] uppercase tracking-wide">Kuota</th>
                  <th className="py-3 px-4" />
                </tr>
              </thead>
              <tbody>
                {siswa.map((s: any) => {
                  const activeEnroll = s.enrollments?.find((e: any) => e.status === 'active')
                  const sisa = activeEnroll ? activeEnroll.sessions_total - activeEnroll.sessions_used : null
                  const pct = activeEnroll ? Math.round((activeEnroll.sessions_used / activeEnroll.sessions_total) * 100) : 0
                  return (
                    <tr key={s.id} className="border-t border-[#F0EFFF] hover:bg-[#F7F6FF] transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#5C4FE5] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {(s.profiles?.full_name ?? 'S').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-[#1A1640]">{s.profiles?.full_name ?? '—'}</div>
                            <div className="text-xs text-[#7B78A8]">{s.profiles?.phone ?? '—'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-[#4A4580]">{s.parent?.full_name ?? '—'}</div>
                        <div className="text-xs text-[#7B78A8]">{s.parent?.phone ?? '—'}</div>
                      </td>
                      <td className="py-3 px-4 text-[#4A4580]">
                        <div>{s.school ?? '—'}</div>
                        <div className="text-xs text-[#7B78A8]">{s.grade ?? '—'}</div>
                      </td>
                      <td className="py-3 px-4">
                        {activeEnroll ? (
                          <div>
                            <div className="text-xs font-semibold text-[#1A1640]">{activeEnroll.class_groups?.label ?? '—'}</div>
                            <div className="text-xs text-[#7B78A8]">{activeEnroll.class_groups?.courses?.name ?? '—'}</div>
                          </div>
                        ) : <span className="text-xs text-[#7B78A8]">Belum ada kelas</span>}
                      </td>
                      <td className="py-3 px-4">
                        {activeEnroll ? (
                          <div>
                            <div className="text-xs font-semibold text-[#1A1640] mb-1">{sisa} sisa dari {activeEnroll.sessions_total}</div>
                            <div className="w-24 h-1.5 bg-[#E5E3FF] rounded-full overflow-hidden">
                              <div className="h-full bg-[#5C4FE5] rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        ) : <span className="text-xs text-[#7B78A8]">—</span>}
                      </td>
                      <td className="py-3 px-4">
                        <Link href={`/admin/siswa/${s.id}`} className="text-xs text-[#5C4FE5] font-semibold hover:underline">Detail →</Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}