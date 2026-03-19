import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  CalendarDays, BookOpen, Users, Coins, Clock
} from 'lucide-react'

export default async function TutorDashboard() {
  const supabase = await createClient()

  // ── Ambil user yang sedang login ──
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // ── Ambil data tutor berdasarkan profile_id ──
  // ⚠️ Sesuaikan nama kolom FK jika berbeda (misal: user_id, profiles_id, dst)
  const { data: tutor } = await supabase
    .from('tutors')
    .select('id')
    .eq('profile_id', user.id)
    .single()

  // ── Ambil nama tutor dari profiles ──
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const tutorId = tutor?.id
  const tutorName = profile?.full_name ?? 'Tutor'
  const firstName = tutorName.split(' ')[0]

  // ── Tanggal & waktu ──
  const now = new Date()
  const todayStart = now.toISOString().split('T')[0] + 'T00:00:00'
  const todayEnd   = now.toISOString().split('T')[0] + 'T23:59:59'

  // Awal & akhir minggu ini (Senin–Minggu)
  const day = now.getDay() === 0 ? 6 : now.getDay() - 1 // 0=Senin
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - day)
  weekStart.setHours(0, 0, 0, 0)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)

  // Awal bulan ini
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  // ── Query paralel ──
  const [
    { data: kelasAktif },
    { data: sesiHariIni },
    { data: sesiMingguIni },
    { data: honorBulanIni },
  ] = await Promise.all([
    // Kelas aktif milik tutor ini
    supabase
      .from('class_groups')
      .select('id, label, status, zoom_link, courses(name), class_types(name)')
      .eq('tutor_id', tutorId)
      .eq('status', 'active'),

    // Sesi hari ini
    supabase
      .from('sessions')
      .select(`id, scheduled_at, zoom_link, status, class_groups!inner(label, tutor_id, courses(name))`)
      .eq('class_groups.tutor_id', tutorId)
      .gte('scheduled_at', todayStart)
      .lte('scheduled_at', todayEnd)
      .order('scheduled_at'),

    // Sesi minggu ini (untuk summary card)
    supabase
      .from('sessions')
      .select(`id, scheduled_at, class_groups!inner(tutor_id)`)
      .eq('class_groups.tutor_id', tutorId)
      .gte('scheduled_at', weekStart.toISOString())
      .lte('scheduled_at', weekEnd.toISOString())
      .neq('status', 'cancelled'),

    // Honor bulan ini
    supabase
      .from('tutor_payments')
      .select('amount')
      .eq('tutor_id', tutorId)
      .gte('paid_at', firstOfMonth),
  ])

  // ── Hitung jumlah siswa unik dari kelas aktif ──
  const kelasIds = kelasAktif?.map(k => k.id) ?? []
  const { data: enrollments } = kelasIds.length > 0
    ? await supabase
        .from('enrollments')
        .select('student_id')
        .in('class_group_id', kelasIds)
    : { data: [] }

  const totalSiswa  = new Set(enrollments?.map(e => e.student_id)).size
  const totalKelas  = kelasAktif?.length ?? 0
  const totalSesiMingguIni = sesiMingguIni?.length ?? 0
  const totalHonor  = honorBulanIni?.reduce((sum, h) => sum + h.amount, 0) ?? 0

  // ── Helper ──
  function formatRupiah(n: number) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency', currency: 'IDR', maximumFractionDigits: 0
    }).format(n)
  }
  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('id-ID', {
      hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jayapura'
    })
  }
  function formatTanggal(iso: string) {
    return new Date(iso).toLocaleDateString('id-ID', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      timeZone: 'Asia/Jayapura'
    })
  }

  const statusColor: Record<string, string> = {
    scheduled:   'bg-blue-50 text-blue-700',
    completed:   'bg-green-50 text-green-700',
    cancelled:   'bg-red-50 text-red-700',
    rescheduled: 'bg-yellow-50 text-yellow-700',
  }
  const statusLabel: Record<string, string> = {
    scheduled:   'Terjadwal',
    completed:   'Selesai',
    cancelled:   'Dibatalkan',
    rescheduled: 'Reschedule',
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-[#1A1640] font-['Sora']">
          Halo, {firstName} 👋
        </h1>
        <p className="text-sm text-[#7B78A8] mt-1">
          {formatTanggal(now.toISOString())}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Sesi minggu ini */}
        <div className="bg-white rounded-2xl border border-purple-100 p-4">
          <div className="w-10 h-10 rounded-xl bg-[#5C4FE5] flex items-center justify-center mb-3">
            <CalendarDays size={20} color="white" strokeWidth={2} />
          </div>
          <div className="text-2xl font-black text-[#1A1640]">{totalSesiMingguIni}</div>
          <div className="text-xs text-[#7B78A8] font-semibold mt-1">Sesi Minggu Ini</div>
        </div>

        {/* Kelas aktif */}
        <div className="bg-white rounded-2xl border border-blue-100 p-4">
          <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center mb-3">
            <BookOpen size={20} color="white" strokeWidth={2} />
          </div>
          <div className="text-2xl font-black text-[#1A1640]">{totalKelas}</div>
          <div className="text-xs text-[#7B78A8] font-semibold mt-1">Kelas Aktif</div>
        </div>

        {/* Jumlah siswa */}
        <div className="bg-white rounded-2xl border border-green-100 p-4">
          <div className="w-10 h-10 rounded-xl bg-green-500 flex items-center justify-center mb-3">
            <Users size={20} color="white" strokeWidth={2} />
          </div>
          <div className="text-2xl font-black text-[#1A1640]">{totalSiswa}</div>
          <div className="text-xs text-[#7B78A8] font-semibold mt-1">Siswa Diajar</div>
        </div>

        {/* Honor bulan ini */}
        <div className="bg-white rounded-2xl border border-yellow-100 p-4">
          <div className="w-10 h-10 rounded-xl bg-yellow-500 flex items-center justify-center mb-3">
            <Coins size={20} color="white" strokeWidth={2} />
          </div>
          <div className="text-2xl font-black text-[#1A1640]">{formatRupiah(totalHonor)}</div>
          <div className="text-xs text-[#7B78A8] font-semibold mt-1">Honor Bulan Ini</div>
        </div>
      </div>

      {/* Sesi Hari Ini */}
      <div className="bg-white rounded-2xl border border-[#E5E3FF] p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-[#1A1640]">Sesi Hari Ini</h2>
          <Link href="/tutor/jadwal" className="text-xs text-[#5C4FE5] font-semibold hover:underline">
            Lihat semua →
          </Link>
        </div>

        {!sesiHariIni || sesiHariIni.length === 0 ? (
          <div className="text-center py-8 text-[#7B78A8] text-sm">
            <div className="flex justify-center mb-2">
              <CalendarDays size={32} strokeWidth={1.5} className="text-[#C4BFFF]" />
            </div>
            Tidak ada sesi mengajar hari ini
          </div>
        ) : (
          <div className="space-y-3">
            {sesiHariIni.map((s: any) => (
              <div
                key={s.id}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-[#F7F6FF] transition-colors border border-[#F0EFFF]"
              >
                {/* Jam */}
                <div className="w-14 text-center flex-shrink-0">
                  <div className="text-sm font-black text-[#5C4FE5]">{formatTime(s.scheduled_at)}</div>
                  <div className="text-[10px] text-[#7B78A8] font-semibold">WIT</div>
                </div>

                {/* Info kelas */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-[#1A1640] truncate">
                    {s.class_groups?.label ?? '—'}
                  </div>
                  <div className="text-xs text-[#7B78A8]">
                    {s.class_groups?.courses?.name ?? '—'}
                  </div>
                </div>

                {/* Aksi */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {s.zoom_link && (
                    <a
                      href={s.zoom_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg font-semibold hover:bg-blue-100 transition-colors"
                    >
                      Buka Zoom
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
      </div>

      {/* Kelas Aktif */}
      <div className="bg-white rounded-2xl border border-[#E5E3FF] p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-[#1A1640]">Kelas Aktif Saya</h2>
          <Link href="/tutor/kelas" className="text-xs text-[#5C4FE5] font-semibold hover:underline">
            Lihat detail →
          </Link>
        </div>

        {!kelasAktif || kelasAktif.length === 0 ? (
          <div className="text-center py-8 text-[#7B78A8] text-sm">
            <div className="flex justify-center mb-2">
              <BookOpen size={32} strokeWidth={1.5} className="text-[#C4BFFF]" />
            </div>
            Belum ada kelas aktif
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {kelasAktif.map((k: any) => (
              <Link
                key={k.id}
                href={`/tutor/kelas`}
                className="flex items-center gap-3 p-3 rounded-xl border border-[#F0EFFF] hover:border-[#5C4FE5] hover:bg-[#F7F6FF] transition-all group"
              >
                <div className="w-9 h-9 rounded-xl bg-[#F0EFFF] group-hover:bg-[#5C4FE5] flex items-center justify-center transition-colors flex-shrink-0">
                  <BookOpen size={16} className="text-[#5C4FE5] group-hover:text-white transition-colors" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[#1A1640] truncate">{k.label}</div>
                  <div className="text-xs text-[#7B78A8]">{(k.courses as any)?.name ?? '—'}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
