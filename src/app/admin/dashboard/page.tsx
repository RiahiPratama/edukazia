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

  // ── Laporan belum diisi: sesi completed 7 hari terakhir, siswa hadir, tapi belum ada laporan ──
  const weekAgoISO = new Date(Date.now() - 7 * 86400000).toISOString()

  const { data: recentCompleted } = await supabase
    .from('sessions')
    .select('id, scheduled_at, class_group_id')
    .eq('status', 'completed')
    .gte('scheduled_at', weekAgoISO)
    .order('scheduled_at', { ascending: false })

  const rcIds = (recentCompleted ?? []).map(s => s.id)

  const [{ data: rcAttendances }, { data: rcReports }] = await Promise.all([
    rcIds.length > 0
      ? supabase.from('attendances').select('session_id, student_id').eq('status', 'hadir').in('session_id', rcIds)
      : Promise.resolve({ data: [] }),
    rcIds.length > 0
      ? supabase.from('session_reports').select('session_id, student_id').in('session_id', rcIds)
      : Promise.resolve({ data: [] }),
  ])

  const reportSet = new Set((rcReports ?? []).map(r => `${r.session_id}-${r.student_id}`))
  const belumDiisiRaw = (rcAttendances ?? []).filter(a => !reportSet.has(`${a.session_id}-${a.student_id}`))

  // Ambil info kelas + siswa + tutor untuk belum diisi
  const belumStudentIds = [...new Set(belumDiisiRaw.map(b => b.student_id))]
  const belumCgIds = [...new Set((recentCompleted ?? []).filter(s => belumDiisiRaw.some(b => b.session_id === s.id)).map(s => s.class_group_id))]

  const [{ data: belumStudents }, { data: belumCgs }] = await Promise.all([
    belumStudentIds.length > 0
      ? supabase.from('students').select('id, profile_id').in('id', belumStudentIds)
      : Promise.resolve({ data: [] }),
    belumCgIds.length > 0
      ? supabase.from('class_groups').select('id, label, tutor_id').in('id', belumCgIds)
      : Promise.resolve({ data: [] }),
  ])

  const belumProfIds = (belumStudents ?? []).map(s => s.profile_id).filter(Boolean)
  const belumTutorIds = [...new Set((belumCgs ?? []).map(c => c.tutor_id).filter(Boolean))]

  const [{ data: belumProfiles }, { data: belumTutors }] = await Promise.all([
    belumProfIds.length > 0
      ? supabase.from('profiles').select('id, full_name').in('id', belumProfIds)
      : Promise.resolve({ data: [] }),
    belumTutorIds.length > 0
      ? supabase.from('tutors').select('id, profile_id').in('id', belumTutorIds)
      : Promise.resolve({ data: [] }),
  ])

  const belumTutorProfIds = (belumTutors ?? []).map(t => t.profile_id).filter(Boolean)
  const { data: belumTutorProfiles } = belumTutorProfIds.length > 0
    ? await supabase.from('profiles').select('id, full_name').in('id', belumTutorProfIds)
    : { data: [] }

  const bProfMap = Object.fromEntries((belumProfiles ?? []).map(p => [p.id, p.full_name]))
  const bStudentMap = Object.fromEntries((belumStudents ?? []).map(s => [s.id, bProfMap[s.profile_id] ?? 'Siswa']))
  const bTutorProfMap = Object.fromEntries((belumTutorProfiles ?? []).map(p => [p.id, p.full_name]))
  const bTutorMap = Object.fromEntries((belumTutors ?? []).map(t => [t.id, bTutorProfMap[t.profile_id] ?? 'Tutor']))
  const bCgMap = Object.fromEntries((belumCgs ?? []).map(c => [c.id, { label: c.label, tutorName: bTutorMap[c.tutor_id] ?? 'Tutor' }]))

  const laporanBelumDiisi = belumDiisiRaw.map(b => {
    const sesi = (recentCompleted ?? []).find(s => s.id === b.session_id)
    const cg = bCgMap[sesi?.class_group_id ?? '']
    return {
      sessionId: b.session_id,
      studentId: b.student_id,
      studentName: bStudentMap[b.student_id] ?? 'Siswa',
      kelasLabel: cg?.label ?? '—',
      tutorName: cg?.tutorName ?? 'Tutor',
      scheduledAt: sesi?.scheduled_at ?? '',
    }
  }).sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())

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

        {/* Laporan Tutor — belum diisi + terbaru */}
        <div className="bg-white rounded-2xl border border-[#E5E3FF] p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-[#1A1640]">Laporan Tutor</h2>
            <Link href="/admin/laporan" className="text-xs text-[#5C4FE5] font-semibold hover:underline">
              Lihat semua →
            </Link>
          </div>

          {/* Summary */}
          <div className="flex gap-2 mb-4">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-700">
              {(laporanTerbaru ?? []).length > 0 ? `${(laporanTerbaru ?? []).length}+ sudah diisi` : '0 diisi'}
            </span>
            {laporanBelumDiisi.length > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700 animate-pulse">
                {laporanBelumDiisi.length} belum diisi!
              </span>
            )}
          </div>

          {/* Belum diisi (prioritas) */}
          {laporanBelumDiisi.length > 0 && (
            <div className="mb-4">
              <p className="text-[10px] font-bold text-red-600 uppercase tracking-wider mb-2">Belum Diisi</p>
              <div className="space-y-2">
                {laporanBelumDiisi.slice(0, 5).map((item: any, idx: number) => (
                  <div key={`${item.sessionId}-${item.studentId}`} className="flex items-start gap-2.5 px-3 py-2 rounded-xl bg-red-50/50 border border-red-100">
                    <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center text-[9px] font-bold text-red-600 flex-shrink-0 mt-0.5">
                      {item.tutorName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-[#1A1640] truncate">
                        {item.kelasLabel} · {item.studentName}
                      </div>
                      <div className="text-[10px] text-[#7B78A8]">
                        Tutor: {item.tutorName} · {formatDateTime(item.scheduledAt)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Laporan terbaru (sudah diisi) */}
          {!laporanTerbaru || laporanTerbaru.length === 0 ? (
            laporanBelumDiisi.length === 0 && (
              <div className="text-center py-6 text-[#7B78A8] text-sm">
                <ClipboardList size={32} strokeWidth={1.5} className="text-[#C4BFFF] mx-auto mb-2"/>
                Belum ada laporan
              </div>
            )
          ) : (
            <div>
              <p className="text-[10px] font-bold text-green-600 uppercase tracking-wider mb-2">Terbaru</p>
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
                        href={`/admin/laporan`}
                        className="flex-shrink-0 text-[#C4BFFF] hover:text-[#5C4FE5] transition-colors mt-0.5"
                      >
                        <FileText size={13}/>
                      </Link>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          <Link href="/admin/laporan"
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
