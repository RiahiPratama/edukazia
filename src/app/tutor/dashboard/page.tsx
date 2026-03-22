import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { BookOpen, Users, Coins } from 'lucide-react'
import SesiHariIniClient from './SesiHariIniClient'

export default async function TutorDashboard() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: tutor } = await supabase
    .from('tutors').select('id').eq('profile_id', user.id).single()

  const { data: profile } = await supabase
    .from('profiles').select('full_name').eq('id', user.id).single()

  const tutorId   = tutor?.id
  const tutorName = profile?.full_name ?? 'Tutor'
  const firstName = tutorName.split(' ')[0]

  const now = new Date()

  // Hari ini WIT
  const todayWIT   = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Jayapura' })
  const startUTC   = `${todayWIT}T00:00:00+09:00`
  const endUTC     = `${todayWIT}T23:59:59+09:00`

  // Besok WIT
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  const tomorrowWIT   = tomorrow.toLocaleDateString('en-CA', { timeZone: 'Asia/Jayapura' })
  const tomorrowStart = `${tomorrowWIT}T00:00:00+09:00`
  const tomorrowEnd   = `${tomorrowWIT}T23:59:59+09:00`

  // Minggu ini
  const day = now.getDay() === 0 ? 6 : now.getDay() - 1
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - day)
  weekStart.setHours(0, 0, 0, 0)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)

  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [
    { data: kelasAktif },
    { data: sesiHariIni },
    { data: sesiMingguIni },
    { data: sesiHariEsok },
    { data: honorBulanIni },
  ] = await Promise.all([
    supabase
      .from('class_groups')
      .select('id, label, status, zoom_link, courses(name), class_types(name)')
      .eq('tutor_id', tutorId)
      .eq('status', 'active'),

    supabase
      .from('sessions')
      .select(`id, scheduled_at, zoom_link, status, class_groups!inner(id, label, tutor_id, courses(name))`)
      .eq('class_groups.tutor_id', tutorId)
      .gte('scheduled_at', startUTC)
      .lte('scheduled_at', endUTC)
      .order('scheduled_at'),

    supabase
      .from('sessions')
      .select(`id, scheduled_at, class_groups!inner(tutor_id)`)
      .eq('class_groups.tutor_id', tutorId)
      .gte('scheduled_at', weekStart.toISOString())
      .lte('scheduled_at', weekEnd.toISOString())
      .neq('status', 'cancelled'),

    supabase
      .from('sessions')
      .select(`id, scheduled_at, zoom_link, status, class_groups!inner(label, tutor_id, courses(name))`)
      .eq('class_groups.tutor_id', tutorId)
      .gte('scheduled_at', tomorrowStart)
      .lte('scheduled_at', tomorrowEnd)
      .order('scheduled_at'),

    supabase
      .from('tutor_payments')
      .select('amount')
      .eq('tutor_id', tutorId)
      .gte('paid_at', firstOfMonth),
  ])

  const kelasIds = kelasAktif?.map(k => k.id) ?? []
  const { data: enrollments } = kelasIds.length > 0
    ? await supabase.from('enrollments').select('student_id').in('class_group_id', kelasIds)
    : { data: [] }

  const totalSiswa         = new Set(enrollments?.map(e => e.student_id)).size
  const totalKelas         = kelasAktif?.length ?? 0
  const totalSesiMingguIni = sesiMingguIni?.length ?? 0
  const totalHonor         = honorBulanIni?.reduce((sum, h) => sum + h.amount, 0) ?? 0

  function formatRupiah(n: number) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency', currency: 'IDR', maximumFractionDigits: 0
    }).format(n)
  }
  function formatTanggal(iso: string) {
    return new Date(iso).toLocaleDateString('id-ID', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jayapura'
    })
  }
  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('id-ID', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jayapura'
    })
  }
  function formatTanggalPendek(iso: string) {
    return new Date(iso).toLocaleDateString('id-ID', {
      weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Jayapura'
    })
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-[#1A1640] font-['Sora']">
          Halo, {firstName} 👋
        </h1>
        <p className="text-sm text-[#7B78A8] mt-1">{formatTanggal(now.toISOString())}</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-purple-100 p-4">
          <div className="w-10 h-10 rounded-xl bg-[#5C4FE5] flex items-center justify-center mb-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <div className="text-2xl font-black text-[#1A1640]">{totalSesiMingguIni}</div>
          <div className="text-xs text-[#7B78A8] font-semibold mt-1">Sesi Minggu Ini</div>
        </div>
        <div className="bg-white rounded-2xl border border-blue-100 p-4">
          <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center mb-3">
            <BookOpen size={20} color="white" strokeWidth={2}/>
          </div>
          <div className="text-2xl font-black text-[#1A1640]">{totalKelas}</div>
          <div className="text-xs text-[#7B78A8] font-semibold mt-1">Kelas Aktif</div>
        </div>
        <div className="bg-white rounded-2xl border border-green-100 p-4">
          <div className="w-10 h-10 rounded-xl bg-green-500 flex items-center justify-center mb-3">
            <Users size={20} color="white" strokeWidth={2}/>
          </div>
          <div className="text-2xl font-black text-[#1A1640]">{totalSiswa}</div>
          <div className="text-xs text-[#7B78A8] font-semibold mt-1">Siswa Diajar</div>
        </div>
        <div className="bg-white rounded-2xl border border-yellow-100 p-4">
          <div className="w-10 h-10 rounded-xl bg-yellow-500 flex items-center justify-center mb-3">
            <Coins size={20} color="white" strokeWidth={2}/>
          </div>
          <div className="text-2xl font-black text-[#1A1640]">{formatRupiah(totalHonor)}</div>
          <div className="text-xs text-[#7B78A8] font-semibold mt-1">Honor Bulan Ini</div>
        </div>
      </div>

      {/* Sesi Hari Ini — pakai client component untuk countdown */}
      <div className="bg-white rounded-2xl border border-[#E5E3FF] p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-[#1A1640]">Sesi Hari Ini</h2>
          <Link href="/tutor/jadwal" className="text-xs text-[#5C4FE5] font-semibold hover:underline">
            Lihat semua →
          </Link>
        </div>
        <SesiHariIniClient sesiHariIni={sesiHariIni ?? []} />
      </div>

      {/* Notifikasi Sesi Besok */}
      {sesiHariEsok && sesiHariEsok.length > 0 && (
        <div className="bg-[#EEEDFE] border border-[#C4BFFF] rounded-2xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5C4FE5" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
              <span className="text-sm font-bold text-[#3C3489]">
                Besok — {formatTanggalPendek(tomorrowStart)}
              </span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#5C4FE5] text-white">
              {sesiHariEsok.length} sesi
            </span>
          </div>
          <div className="space-y-2">
            {sesiHariEsok.map((s: any) => (
              <div key={s.id} className="flex items-center gap-3 bg-white rounded-xl px-3 py-2">
                <div className="text-sm font-black text-[#5C4FE5] flex-shrink-0 w-12 text-center">
                  {formatTime(s.scheduled_at)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-[#1A1640] truncate">
                    {s.class_groups?.label ?? '—'}
                  </div>
                  <div className="text-[10px] text-[#7B78A8]">
                    {s.class_groups?.courses?.name ?? '—'}
                  </div>
                </div>
                {s.zoom_link && (
                  <a href={s.zoom_link} target="_blank" rel="noopener noreferrer"
                    className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-lg font-semibold hover:bg-blue-100 transition flex-shrink-0">
                    Zoom
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

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
            <BookOpen size={32} strokeWidth={1.5} className="text-[#C4BFFF] mx-auto mb-2"/>
            Belum ada kelas aktif
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {kelasAktif.map((k: any) => (
              <Link key={k.id} href="/tutor/kelas"
                className="flex items-center gap-3 p-3 rounded-xl border border-[#F0EFFF] hover:border-[#5C4FE5] hover:bg-[#F7F6FF] transition-all group">
                <div className="w-9 h-9 rounded-xl bg-[#F0EFFF] group-hover:bg-[#5C4FE5] flex items-center justify-center transition-colors flex-shrink-0">
                  <BookOpen size={16} className="text-[#5C4FE5] group-hover:text-white transition-colors"/>
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
