import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import PaketTable from './components/PaketTable'

export default async function KursusPage() {
  const supabase = await createClient()

  const { data: kursus } = await supabase
    .from('courses')
    .select('*')
    .order('sort_order')

  const { data: paket } = await supabase
    .from('packages')
    .select(`
      id, name, total_sessions, price, is_active,
      courses ( name ),
      class_types ( name, max_participants )
    `)
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-[#1A1640]" style={{ fontFamily: 'Sora,sans-serif' }}>Kursus & Paket</h1>
          <p className="text-sm text-[#7B78A8] mt-1">Kelola mata pelajaran dan paket belajar</p>
        </div>
      </div>

      {/* Mata Pelajaran */}
      <div className="bg-white rounded-2xl border border-[#E5E3FF] p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-[#1A1640]">Mata Pelajaran</h2>
          <Link href="/admin/kursus/baru" className="text-sm bg-[#5C4FE5] text-white px-4 py-2 rounded-xl font-semibold hover:bg-[#3D34C4] transition-colors">
            + Tambah Kursus
          </Link>
        </div>
        {!kursus || kursus.length === 0 ? (
          <div className="text-center py-10 text-[#7B78A8]">
            <div className="text-4xl mb-3">📚</div>
            <p className="font-semibold mb-1">Belum ada kursus</p>
            <Link href="/admin/kursus/baru" className="text-sm text-[#5C4FE5] font-bold hover:underline">+ Tambah Kursus Pertama</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {kursus.map((k: any) => (
              <div key={k.id} className={`rounded-xl border p-4 ${k.is_active ? 'border-[#E5E3FF] bg-[#F7F6FF]' : 'border-gray-200 bg-gray-50 opacity-60'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-3 h-3 rounded-full" style={{ background: k.color ?? '#5C4FE5' }} />
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${k.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {k.is_active ? 'Aktif' : 'Nonaktif'}
                  </span>
                </div>
                <div className="font-bold text-[#1A1640] mb-1">{k.name}</div>
                <div className="text-xs text-[#7B78A8] mb-3 line-clamp-2">{k.description ?? '—'}</div>
                <Link href={`/admin/kursus/${k.id}`} className="text-xs text-[#5C4FE5] font-semibold hover:underline">Edit →</Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Paket Belajar */}
      <div className="bg-white rounded-2xl border border-[#E5E3FF] p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-[#1A1640]">Paket Belajar</h2>
          <Link href="/admin/kursus/paket/baru" className="text-sm bg-[#5C4FE5] text-white px-4 py-2 rounded-xl font-semibold hover:bg-[#3D34C4] transition-colors">
            + Tambah Paket
          </Link>
        </div>
        <PaketTable paket={(paket ?? []) as any} />
      </div>
    </div>
  )
}
