import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function TutorPage() {
  const supabase = await createClient()

  const { data: tutors } = await supabase
    .from('tutors')
    .select(`
      id, rate_per_session, bank_name, bank_account, is_active,
      profiles ( full_name, phone ),
      tutor_courses ( courses ( name, color ) ),
      class_groups ( id, label, status )
    `)
    .order('created_at', { ascending: false })

  function formatRupiah(n: number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-[#1A1640] font-['Sora']">Data Tutor</h1>
          <p className="text-sm text-[#7B78A8] mt-1">{tutors?.filter(t => t.is_active).length ?? 0} tutor aktif</p>
        </div>
        <Link
          href="/admin/tutor/baru"
          className="bg-[#5C4FE5] text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-[#3D34C4] transition-colors"
        >
          + Tambah Tutor
        </Link>
      </div>

      {!tutors || tutors.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E5E3FF] p-12 text-center">
          <div className="text-5xl mb-4">👨‍🏫</div>
          <p className="font-bold text-[#1A1640] mb-2">Belum ada tutor terdaftar</p>
          <p className="text-sm text-[#7B78A8] mb-4">Tambahkan tutor untuk mulai membuat jadwal kelas</p>
          <Link href="/admin/tutor/baru" className="inline-flex items-center gap-2 bg-[#5C4FE5] text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-[#3D34C4] transition-colors">
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
                    <div className="w-10 h-10 rounded-full bg-[#5C4FE5] flex items-center justify-center text-white font-bold">
                      {(t.profiles?.full_name ?? 'T').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-bold text-[#1A1640]">{t.profiles?.full_name ?? '—'}</div>
                      <div className="text-xs text-[#7B78A8]">{t.profiles?.phone ?? '—'}</div>
                    </div>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${t.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {t.is_active ? 'Aktif' : 'Nonaktif'}
                  </span>
                </div>

                {/* Kursus yang dikuasai */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {t.tutor_courses?.map((tc: any) => (
                    <span
                      key={tc.courses?.name}
                      className="text-xs px-2 py-0.5 rounded-full font-semibold text-white"
                      style={{ background: tc.courses?.color ?? '#5C4FE5' }}
                    >
                      {tc.courses?.name}
                    </span>
                  ))}
                  {(!t.tutor_courses || t.tutor_courses.length === 0) && (
                    <span className="text-xs text-[#7B78A8]">Belum ada kursus</span>
                  )}
                </div>

                <div className="border-t border-[#F0EFFF] pt-3 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-[#7B78A8]">Tarif per sesi</div>
                    <div className="text-sm font-bold text-[#1A1640]">{formatRupiah(t.rate_per_session)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-[#7B78A8]">Kelas aktif</div>
                    <div className="text-sm font-bold text-[#1A1640]">{activeClasses.length} kelas</div>
                  </div>
                </div>

                <Link
                  href={`/admin/tutor/${t.id}`}
                  className="mt-3 w-full text-center block text-xs text-[#5C4FE5] font-semibold hover:underline"
                >
                  Lihat Detail →
                </Link>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
