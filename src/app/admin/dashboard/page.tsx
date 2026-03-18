import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function AdminDashboard() {
  const supabase = await createClient()

  // Fetch semua data summary sekaligus
  const [
    { count: totalSiswa },
    { count: totalTutor },
    { count: totalKelas },
    { data: sesiHariIni },
    { data: pembayaranTerbaru },
  ] = await Promise.all([
    supabase.from('students').select('*', { count: 'exact', head: true }),
    supabase.from('tutors').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('class_groups').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('sessions')
      .select(`
        id, scheduled_at, zoom_link, status,
        class_groups ( label, courses ( name ) )
      `)
      .gte('scheduled_at', new Date().toISOString().split('T')[0] + 'T00:00:00')
      .lte('scheduled_at', new Date().toISOString().split('T')[0] + 'T23:59:59')
      .order('scheduled_at'),
    supabase.from('payments')
      .select(`
        id, amount, method, paid_at,
        students ( profiles ( full_name ) )
      `)
      .order('paid_at', { ascending: false })
      .limit(5),
  ])

  // Hitung total pembayaran bulan ini
  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const { data: pembayaranBulanIni } = await supabase
    .from('payments')
    .select('amount')
    .gte('paid_at', firstOfMonth)

  const totalBulanIni = pembayaranBulanIni?.reduce((sum, p) => sum + p.amount, 0) ?? 0

  function formatRupiah(n: number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Makassar' })
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const statusColor: Record<string, string> = {
    scheduled: 'bg-blue-50 text-blue-700',
    completed: 'bg-green-50 text-green-700',
    cancelled: 'bg-red-50 text-red-700',
    rescheduled: 'bg-yellow-50 text-yellow-700',
  }

  const statusLabel: Record<string, string> = {
    scheduled: 'Terjadwal',
    completed: 'Selesai',
    cancelled: 'Dibatalkan',
    rescheduled: 'Reschedule',
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-[#1A1640] font-['Sora']">Dashboard</h1>
        <p className="text-sm text-[#7B78A8] mt-1">
          {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Makassar' })}
        </p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Pendapatan Bulan Ini', value: formatRupiah(totalBulanIni), icon: '💰', color: 'bg-purple-50 border-purple-100', iconBg: 'bg-[#5C4FE5]' },
          { label: 'Siswa Aktif', value: String(totalSiswa ?? 0), icon: '👨‍🎓', color: 'bg-blue-50 border-blue-100', iconBg: 'bg-blue-500' },
          { label: 'Tutor Aktif', value: String(totalTutor ?? 0), icon: '👨‍🏫', color: 'bg-green-50 border-green-100', iconBg: 'bg-green-500' },
          { label: 'Kelas Berjalan', value: String(totalKelas ?? 0), icon: '🏫', color: 'bg-yellow-50 border-yellow-100', iconBg: 'bg-yellow-500' },
        ].map(m => (
          <div key={m.label} className={`bg-white rounded-2xl border p-4 ${m.color}`}>
            <div className={`w-10 h-10 rounded-xl ${m.iconBg} flex items-center justify-center text-lg mb-3`}>
              {m.icon}
            </div>
            <div className="text-2xl font-black text-[#1A1640] font-['Sora']">{m.value}</div>
            <div className="text-xs text-[#7B78A8] font-semibold mt-1">{m.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Sesi hari ini */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[#E5E3FF] p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-[#1A1640]">Sesi Hari Ini</h2>
            <Link href="/admin/jadwal" className="text-xs text-[#5C4FE5] font-semibold hover:underline">
              Lihat semua →
            </Link>
          </div>
          {!sesiHariIni || sesiHariIni.length === 0 ? (
            <div className="text-center py-8 text-[#7B78A8] text-sm">
              <div className="text-3xl mb-2">📅</div>
              Tidak ada sesi hari ini
            </div>
          ) : (
            <div className="space-y-3">
              {sesiHariIni.map((s: any) => (
                <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-[#F7F6FF] transition-colors border border-[#F0EFFF]">
                  <div className="w-12 text-center flex-shrink-0">
                    <div className="text-sm font-bold text-[#5C4FE5]">{formatTime(s.scheduled_at)}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-[#1A1640] truncate">
                      {s.class_groups?.label ?? '—'}
                    </div>
                    <div className="text-xs text-[#7B78A8]">{s.class_groups?.courses?.name ?? '—'}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {s.zoom_link && (
                      <a href={s.zoom_link} target="_blank" rel="noopener noreferrer"
                        className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-lg font-semibold hover:bg-blue-100 transition-colors">
                        Zoom
                      </a>
                    )}
                    <span className={`text-xs px-2 py-1 rounded-lg font-semibold ${statusColor[s.status] ?? 'bg-gray-50 text-gray-700'}`}>
                      {statusLabel[s.status] ?? s.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Link
            href="/admin/jadwal"
            className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-[#E5E3FF] text-sm text-[#7B78A8] hover:border-[#5C4FE5] hover:text-[#5C4FE5] transition-colors font-semibold"
          >
            + Buat Jadwal Baru
          </Link>
        </div>

        {/* Pembayaran terbaru */}
        <div className="bg-white rounded-2xl border border-[#E5E3FF] p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-[#1A1640]">Pembayaran Terbaru</h2>
            <Link href="/admin/pembayaran" className="text-xs text-[#5C4FE5] font-semibold hover:underline">
              Lihat semua →
            </Link>
          </div>
          {!pembayaranTerbaru || pembayaranTerbaru.length === 0 ? (
            <div className="text-center py-8 text-[#7B78A8] text-sm">
              <div className="text-3xl mb-2">💳</div>
              Belum ada pembayaran
            </div>
          ) : (
            <div className="space-y-3">
              {pembayaranTerbaru.map((p: any) => (
                <div key={p.id} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#F0EFFF] flex items-center justify-center text-xs font-bold text-[#5C4FE5] flex-shrink-0">
                    {(p.students?.profiles?.full_name ?? 'S').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-[#1A1640] truncate">
                      {p.students?.profiles?.full_name ?? '—'}
                    </div>
                    <div className="text-xs text-[#7B78A8]">{formatDate(p.paid_at)}</div>
                  </div>
                  <div className="text-xs font-bold text-green-600 flex-shrink-0">
                    +{formatRupiah(p.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
          <Link
            href="/admin/pembayaran"
            className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-[#E5E3FF] text-sm text-[#7B78A8] hover:border-[#5C4FE5] hover:text-[#5C4FE5] transition-colors font-semibold"
          >
            + Catat Pembayaran
          </Link>
        </div>
      </div>

      {/* Quick actions */}
      <div className="mt-4 bg-white rounded-2xl border border-[#E5E3FF] p-5">
        <h2 className="font-bold text-[#1A1640] mb-4">Aksi Cepat</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { href: '/admin/siswa/baru', icon: '👨‍🎓', label: 'Tambah Siswa' },
            { href: '/admin/tutor/baru', icon: '👨‍🏫', label: 'Tambah Tutor' },
            { href: '/admin/kelas/baru', icon: '🏫', label: 'Buat Kelas' },
            { href: '/admin/jadwal', icon: '📅', label: 'Buat Jadwal' },
            { href: '/admin/pembayaran', icon: '💳', label: 'Catat Bayar' },
            { href: '/admin/honor', icon: '💰', label: 'Honor Tutor' },
          ].map(a => (
            <Link
              key={a.href}
              href={a.href}
              className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-[#F0EFFF] transition-colors text-center group"
            >
              <div className="w-10 h-10 rounded-xl bg-[#F0EFFF] group-hover:bg-[#5C4FE5] flex items-center justify-center text-lg transition-colors">
                {a.icon}
              </div>
              <span className="text-xs font-semibold text-[#4A4580] group-hover:text-[#5C4FE5]">{a.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
