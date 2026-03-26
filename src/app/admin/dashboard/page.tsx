import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import {
  CalendarDays, GraduationCap, Users, BookOpen,
  Coins, DollarSign, UserPlus, FileText, ClipboardList,
} from 'lucide-react'
import SesiHariIniAdminClient from './SesiHariIniAdminClient'
import AnnouncementSection from './AnnouncementSection'

export default async function AdminDashboard() {
  const supabase = await createClient()

  // Rentang hari ini WIT
  const todayWIT = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jayapura' })
  const startUTC = `${todayWIT}T00:00:00+09:00`
  const endUTC   = `${todayWIT}T23:59:59+09:00`

  // Fetch announcements aktif hari ini
  const { data: announcements } = await supabase
    .from('announcements')
    .select('*')
    .eq('is_active', true)
    .lte('start_date', todayWIT)
    .gte('end_date', todayWIT)
    .order('priority', { ascending: true })

  const [
    { count: totalSiswa },
    { count: totalTutor },
    { count: totalKelas },
    { data: sesiHariIni },
    { data: laporanTerbaru },
  ] = await Promise.all([
    supabase.from('students').select('*', { count: 'exact', head: true }),
    supabase.from('tutors').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('class_groups').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('sessions')
      .select(`id, scheduled_at, zoom_link, status,
        class_groups(label, tutor_id, courses(name), class_types(name))`)
      .gte('scheduled_at', startUTC)
      .lte('scheduled_at', endUTC)
      .order('scheduled_at'),
    // Laporan tutor terbaru (gantikan pembayaran terbaru)
    supabase.from('session_reports')
      .select(`
        id, confirmed_at, material_notes,
        sessions(
          scheduled_at,
          class_groups(label, courses(name))
        ),
        tutors(profiles(full_name))
      `)
      .order('confirmed_at', { ascending: false })
      .limit(5),
  ])

  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const { data: pembayaranBulanIni } = await supabase
    .from('payments').select('amount').gte('paid_at', firstOfMonth)

  const totalBulanIni = pembayaranBulanIni?.reduce((sum, p) => sum + p.amount, 0) ?? 0

  function formatRupiah(n: number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
  }
  function formatDateTime(iso: string) {
    return new Date(iso).toLocaleDateString('id-ID', {
      weekday: 'short', day: 'numeric', month: 'short',
      hour: '2-digit', minute: '2-digit',
      timeZone: 'Asia/Jayapura',
    })
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-black text-[#1A1640] font-['Sora']">Dashboard</h1>
        <p className="text-sm text-[#7B78A8] mt-1">
          {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jayapura' })}
        </p>
      </div>

      {/* Pengumuman */}
      <AnnouncementSection announcements={announcements ?? []} />

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-purple-100 p-4">
          <div className="w-10 h-10 rounded-xl bg-[#5C4FE5] flex items-center justify-center mb-3">
            <DollarSign size={20} color="white" strokeWidth={2}/>
          </div>
          <div className="text-2xl font-black text-[#1A1640]">{formatRupiah(totalBulanIni)}</div>
          <div className="text-xs text-[#7B78A8] font-semibold mt-1">Pendapatan Bulan Ini</div>
        </div>
        <div className="bg-white rounded-2xl border border-blue-100 p-4">
          <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center mb-3">
            <GraduationCap size={20} color="white" strokeWidth={2}/>
          </div>
          <div className="text-2xl font-black text-[#1A1640]">{totalSiswa ?? 0}</div>
          <div className="text-xs text-[#7B78A8] font-semibold mt-1">Siswa Aktif</div>
        </div>
        <div className="bg-white rounded-2xl border border-green-100 p-4">
          <div className="w-10 h-10 rounded-xl bg-green-500 flex items-center justify-center mb-3">
            <Users size={20} color="white" strokeWidth={2}/>
          </div>
          <div className="text-2xl font-black text-[#1A1640]">{totalTutor ?? 0}</div>
          <div className="text-xs text-[#7B78A8] font-semibold mt-1">Tutor Aktif</div>
        </div>
        <div className="bg-white rounded-2xl border border-yellow-100 p-4">
          <div className="w-10 h-10 rounded-xl bg-yellow-500 flex items-center justify-center mb-3">
            <BookOpen size={20} color="white" strokeWidth={2}/>
          </div>
          <div className="text-2xl font-black text-[#1A1640]">{totalKelas ?? 0}</div>
          <div className="text-xs text-[#7B78A8] font-semibold mt-1">Kelas Berjalan</div>
        </div>
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
          <SesiHariIniAdminClient sesiHariIni={sesiHariIni ?? []} />
        </div>

        {/* Laporan Tutor Terbaru — menggantikan Pembayaran Terbaru */}
        <div className="bg-white rounded-2xl border border-[#E5E3FF] p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-[#1A1640]">Laporan Tutor</h2>
            <Link href="/admin/absensi" className="text-xs text-[#5C4FE5] font-semibold hover:underline">
              Lihat semua →
            </Link>
          </div>
          {!laporanTerbaru || laporanTerbaru.length === 0 ? (
            <div className="text-center py-8 text-[#7B78A8] text-sm">
              <ClipboardList size={32} strokeWidth={1.5} className="text-[#C4BFFF] mx-auto mb-2"/>
              Belum ada laporan
            </div>
          ) : (
            <div className="space-y-3">
              {laporanTerbaru.map((lap: any) => {
                const tutor = Array.isArray(lap.tutors) ? lap.tutors[0] : lap.tutors
                const sesi  = Array.isArray(lap.sessions) ? lap.sessions[0] : lap.sessions
                const cg    = Array.isArray(sesi?.class_groups) ? sesi?.class_groups[0] : sesi?.class_groups
                const tutorName = tutor?.profiles?.full_name ?? '—'
                const kelasLabel = cg?.label ?? '—'
                const courseName = cg?.courses?.name ?? ''
                return (
                  <div key={lap.id} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#F0EFFF] flex items-center justify-center text-xs font-bold text-[#5C4FE5] flex-shrink-0 mt-0.5">
                      {tutorName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-[#1A1640] truncate">
                        {tutorName}
                      </div>
                      <div className="text-xs text-[#7B78A8] truncate">
                        {kelasLabel}{courseName ? ` · ${courseName}` : ''}
                      </div>
                      <div className="text-[10px] text-[#A09EC0] mt-0.5">
                        {formatDateTime(lap.confirmed_at)}
                      </div>
                      {lap.material_notes && (
                        <div className="text-[10px] text-[#7B78A8] mt-1 line-clamp-2 leading-relaxed bg-[#F7F6FF] rounded-lg px-2 py-1">
                          {lap.material_notes}
                        </div>
                      )}
                    </div>
                    <Link
                      href={`/admin/absensi`}
                      className="flex-shrink-0 text-[#C4BFFF] hover:text-[#5C4FE5] transition-colors mt-0.5"
                    >
                      <FileText size={13}/>
                    </Link>
                  </div>
                )
              })}
            </div>
          )}
          <Link href="/admin/absensi"
            className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-[#E5E3FF] text-sm text-[#7B78A8] hover:border-[#5C4FE5] hover:text-[#5C4FE5] transition-colors font-semibold">
            <ClipboardList size={14}/>
            Lihat Semua Laporan
          </Link>
        </div>
      </div>

      {/* Quick actions */}
      <div className="mt-4 bg-white rounded-2xl border border-[#E5E3FF] p-5">
        <h2 className="font-bold text-[#1A1640] mb-4">Aksi Cepat</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { href: '/admin/siswa/baru',   icon: <GraduationCap size={18}/>, label: 'Tambah Siswa' },
            { href: '/admin/daftarkan',    icon: <UserPlus size={18}/>,      label: 'Daftarkan ke Kelas' },
            { href: '/admin/jadwal?new=1', icon: <CalendarDays size={18}/>,  label: 'Buat Jadwal' },
            { href: '/admin/tutor/baru',   icon: <Users size={18}/>,         label: 'Tambah Tutor' },
            { href: '/admin/honor',        icon: <Coins size={18}/>,         label: 'Honor Tutor' },
          ].map((item) => (
            <Link key={item.href} href={item.href}
              className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-[#F0EFFF] transition-colors text-center group">
              <div className="w-10 h-10 rounded-xl bg-[#F0EFFF] group-hover:bg-[#5C4FE5] flex items-center justify-center transition-colors">
                <span className="text-[#5C4FE5] group-hover:text-white transition-colors">
                  {item.icon}
                </span>
              </div>
              <span className="text-xs font-semibold text-[#4A4580] group-hover:text-[#5C4FE5]">
                {item.label}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
