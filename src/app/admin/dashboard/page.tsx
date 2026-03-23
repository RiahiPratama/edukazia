import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import {
  CalendarDays, GraduationCap, Users, BookOpen,
  CreditCard, Coins, DollarSign
} from 'lucide-react'
import SesiHariIniAdminClient from './SesiHariIniAdminClient'

export default async function AdminDashboard() {
  const supabase = await createClient()

  // Rentang hari ini WIT
  const todayWIT = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jayapura' })
  const startUTC = `${todayWIT}T00:00:00+09:00`
  const endUTC   = `${todayWIT}T23:59:59+09:00`

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
      .select(`id, scheduled_at, zoom_link, status,
        class_groups(label, tutor_id, courses(name), class_types(name))`)
      .gte('scheduled_at', startUTC)
      .lte('scheduled_at', endUTC)
      .order('scheduled_at'),
    supabase.from('payments')
      .select(`id, amount, method, paid_at, students(profiles(full_name))`)
      .order('paid_at', { ascending: false })
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
  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-black text-[#1A1640] font-['Sora']">Dashboard</h1>
        <p className="text-sm text-[#7B78A8] mt-1">
          {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jayapura' })}
        </p>
      </div>

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
        {/* Sesi hari ini — client component untuk countdown */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[#E5E3FF] p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-[#1A1640]">Sesi Hari Ini</h2>
            <Link href="/admin/jadwal" className="text-xs text-[#5C4FE5] font-semibold hover:underline">
              Lihat semua →
            </Link>
          </div>
          <SesiHariIniAdminClient sesiHariIni={sesiHariIni ?? []} />
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
              <CreditCard size={32} strokeWidth={1.5} className="text-[#C4BFFF] mx-auto mb-2"/>
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
          <Link href="/admin/pembayaran?new=1"
            className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-[#E5E3FF] text-sm text-[#7B78A8] hover:border-[#5C4FE5] hover:text-[#5C4FE5] transition-colors font-semibold">
            + Catat Pembayaran
          </Link>
        </div>
      </div>

      {/* Quick actions */}
      <div className="mt-4 bg-white rounded-2xl border border-[#E5E3FF] p-5">
        <h2 className="font-bold text-[#1A1640] mb-4">Aksi Cepat</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { href: '/admin/siswa/baru',      icon: <GraduationCap size={18}/>, label: 'Tambah Siswa' },
            { href: '/admin/tutor/baru',      icon: <Users size={18}/>,         label: 'Tambah Tutor' },
            { href: '/admin/kelas/baru',      icon: <BookOpen size={18}/>,      label: 'Buat Kelas' },
            { href: '/admin/jadwal?new=1',    icon: <CalendarDays size={18}/>,  label: 'Buat Jadwal' },
            { href: '/admin/pembayaran?new=1',icon: <CreditCard size={18}/>,    label: 'Catat Bayar' },
            { href: '/admin/honor',           icon: <Coins size={18}/>,         label: 'Honor Tutor' },
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
