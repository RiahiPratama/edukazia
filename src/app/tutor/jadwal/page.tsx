import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CalendarDays, ExternalLink } from 'lucide-react'

const STATUS_MAP: Record<string, { label: string; pill: string }> = {
  scheduled:   { label: 'Terjadwal',      pill: 'bg-[#EEEDFE] text-[#3C3489]' },
  completed:   { label: 'Selesai',        pill: 'bg-[#E6F4EC] text-[#1A5C36]' },
  cancelled:   { label: 'Dibatalkan',     pill: 'bg-[#FEE9E9] text-[#991B1B]' },
  rescheduled: { label: 'Dijadwal Ulang', pill: 'bg-[#FEF3E2] text-[#92400E]' },
}

const DAY_NAMES = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']

export default async function TutorJadwalPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>
}) {
  const supabase = await createClient()

  // ── Auth ──
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // ── Ambil tutor_id ──
  const { data: tutor } = await supabase
    .from('tutors')
    .select('id')
    .eq('profile_id', user.id)
    .single()

  const tutorId = tutor?.id

  // ── Hitung minggu yang ditampilkan ──
  const params = await searchParams
  const now = new Date()
  const weekOffset = parseInt(params.week ?? '0')

  // Senin minggu ini
  const monday = new Date(now)
  const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1
  monday.setDate(now.getDate() - dayOfWeek + weekOffset * 7)
  monday.setHours(0, 0, 0, 0)

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)

  // Array 7 hari
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })

  // ── Ambil sesi minggu ini milik tutor ──
  const { data: sessions } = await supabase
    .from('sessions')
    .select(`
      id, scheduled_at, status, zoom_link,
      class_groups!inner(id, label, tutor_id, courses(name))
    `)
    .eq('class_groups.tutor_id', tutorId)
    .gte('scheduled_at', monday.toISOString())
    .lte('scheduled_at', sunday.toISOString())
    .order('scheduled_at')

  // ── Ambil semua sesi bulan ini untuk mini calendar ──
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastOfMonth  = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const { data: sessionsBulanIni } = await supabase
    .from('sessions')
    .select(`id, scheduled_at, class_groups!inner(tutor_id)`)
    .eq('class_groups.tutor_id', tutorId)
    .gte('scheduled_at', firstOfMonth.toISOString())
    .lte('scheduled_at', lastOfMonth.toISOString())
    .neq('status', 'cancelled')

  // ── Helper ──
  function fmtDate(d: Date) {
    return d.toISOString().split('T')[0]
  }
  function fmtTime(iso: string) {
    return new Date(iso).toLocaleTimeString('id-ID', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jayapura'
    })
  }
  function fmtHeaderDate(d: Date) {
    return d.toLocaleDateString('id-ID', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jayapura'
    })
  }
  function fmtMonthYear(d: Date) {
    return d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
  }

  const todayStr = fmtDate(now)
  const sessionDates = new Set(sessionsBulanIni?.map(s => s.scheduled_at.split('T')[0]) ?? [])

  // Group sessions by date
  const sessionsByDate: Record<string, typeof sessions> = {}
  sessions?.forEach(s => {
    const dateKey = s.scheduled_at.split('T')[0]
    if (!sessionsByDate[dateKey]) sessionsByDate[dateKey] = []
    sessionsByDate[dateKey]!.push(s)
  })

  const prevWeek = weekOffset - 1
  const nextWeek = weekOffset + 1

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-[#1A1640] font-['Sora']">Jadwal Mengajar</h1>
        <p className="text-sm text-[#7B78A8] mt-1">{fmtMonthYear(monday)}</p>
      </div>

      {/* Navigasi Minggu */}
      <div className="bg-white rounded-2xl border border-[#E5E3FF] p-4 mb-4">
        <div className="flex items-center justify-between mb-4">
          <Link
            href={`/tutor/jadwal?week=${prevWeek}`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E5E3FF] text-sm font-semibold text-[#4A4580] hover:bg-[#F0EFFF] hover:text-[#5C4FE5] transition"
          >
            ← Minggu Lalu
          </Link>
          <span className="text-sm font-bold text-[#1A1640]">
            {monday.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} –{' '}
            {sunday.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
          <Link
            href={`/tutor/jadwal?week=${nextWeek}`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E5E3FF] text-sm font-semibold text-[#4A4580] hover:bg-[#F0EFFF] hover:text-[#5C4FE5] transition"
          >
            Minggu Depan →
          </Link>
        </div>

        {/* Strip 7 hari */}
        <div className="grid grid-cols-7 gap-1">
          {weekDates.map((d, i) => {
            const dateStr    = fmtDate(d)
            const isToday    = dateStr === todayStr
            const hasSesi    = !!sessionsByDate[dateStr]?.length
            return (
              <div key={i} className="flex flex-col items-center gap-1">
                <span className="text-[10px] font-bold text-[#7B78A8] uppercase">{DAY_NAMES[i]}</span>
                <div className={[
                  'w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold transition',
                  isToday
                    ? 'bg-[#5C4FE5] text-white'
                    : hasSesi
                    ? 'bg-[#EEEDFE] text-[#3C3489]'
                    : 'text-[#4A4580]'
                ].join(' ')}>
                  {d.getDate()}
                </div>
                {hasSesi && !isToday && (
                  <div className="w-1.5 h-1.5 rounded-full bg-[#5C4FE5]"/>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Daftar Sesi per Hari */}
      <div className="space-y-4">
        {weekDates.map((d, i) => {
          const dateStr  = fmtDate(d)
          const daySessi = sessionsByDate[dateStr] ?? []
          const isToday  = dateStr === todayStr

          if (daySessi.length === 0) return null

          return (
            <div key={i} className="bg-white rounded-2xl border border-[#E5E3FF] overflow-hidden">
              {/* Header hari */}
              <div className={[
                'px-5 py-3 border-b border-[#E5E3FF] flex items-center justify-between',
                isToday ? 'bg-[#5C4FE5]' : 'bg-[#F7F6FF]'
              ].join(' ')}>
                <span className={[
                  'text-sm font-bold capitalize',
                  isToday ? 'text-white' : 'text-[#1A1640]'
                ].join(' ')}>
                  {fmtHeaderDate(d)}
                  {isToday && <span className="ml-2 text-xs font-semibold opacity-80">— Hari ini</span>}
                </span>
                <span className={[
                  'text-xs font-bold px-2 py-0.5 rounded-full',
                  isToday ? 'bg-white/20 text-white' : 'bg-[#EEEDFE] text-[#3C3489]'
                ].join(' ')}>
                  {daySessi.length} sesi
                </span>
              </div>

              {/* List sesi */}
              <div className="divide-y divide-[#F0EFFF]">
                {daySessi.map((s: any) => {
                  const status = STATUS_MAP[s.status] ?? { label: s.status, pill: 'bg-gray-100 text-gray-600' }
                  return (
                    <div key={s.id} className="flex items-center gap-4 px-5 py-4 hover:bg-[#F7F6FF] transition">
                      {/* Jam */}
                      <div className="w-14 flex-shrink-0 text-center">
                        <div className="text-sm font-black text-[#5C4FE5]">{fmtTime(s.scheduled_at)}</div>
                        <div className="text-[10px] text-[#7B78A8] font-semibold">WIT</div>
                      </div>

                      {/* Garis vertikal */}
                      <div className="w-0.5 h-10 bg-[#E5E3FF] flex-shrink-0 rounded-full"/>

                      {/* Info kelas */}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-[#1A1640] truncate">
                          {s.class_groups?.label ?? '—'}
                        </div>
                        <div className="text-xs text-[#7B78A8] mt-0.5">
                          {s.class_groups?.courses?.name ?? '—'}
                        </div>
                      </div>

                      {/* Status & Zoom */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-xs px-2.5 py-1 rounded-lg font-semibold ${status.pill}`}>
                          {status.label}
                        </span>
                        {s.zoom_link && (
                          <a
                            href={s.zoom_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg font-semibold hover:bg-blue-100 transition"
                          >
                            <ExternalLink size={11}/>
                            Zoom
                          </a>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* Kosong */}
        {Object.keys(sessionsByDate).length === 0 && (
          <div className="bg-white rounded-2xl border border-[#E5E3FF] p-10 text-center">
            <div className="flex justify-center mb-3">
              <CalendarDays size={36} strokeWidth={1.5} className="text-[#C4BFFF]"/>
            </div>
            <p className="text-sm font-semibold text-[#7B78A8]">Tidak ada sesi mengajar minggu ini</p>
            <p className="text-xs text-[#7B78A8] mt-1">Jadwal akan muncul setelah admin menambahkan sesi</p>
          </div>
        )}
      </div>
    </div>
  )
}
