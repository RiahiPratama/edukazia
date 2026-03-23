import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CalendarDays, ExternalLink } from 'lucide-react'

export const dynamic = 'force-dynamic'

const STATUS_MAP: Record<string, { label: string; pill: string }> = {
  scheduled:   { label: 'Terjadwal',      pill: 'bg-[#EEEDFE] text-[#3C3489]' },
  completed:   { label: 'Selesai',        pill: 'bg-[#E6F4EC] text-[#1A5C36]' },
  cancelled:   { label: 'Dibatalkan',     pill: 'bg-[#FEE9E9] text-[#991B1B]' },
  rescheduled: { label: 'Dijadwal Ulang', pill: 'bg-[#FEF3E2] text-[#92400E]' },
  holiday:     { label: 'Libur',          pill: 'bg-teal-50 text-teal-700' },
}

const DAY_NAMES = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']

export default async function TutorJadwalPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: tutor } = await supabase
    .from('tutors').select('id').eq('profile_id', user.id).single()
  const tutorId    = tutor?.id
  const params     = await searchParams
  const weekOffset = parseInt(params.week ?? '0')

  // Satu kali konversi WIT — tidak double
  const todayWITStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jayapura' })
  const todayWIT    = new Date(todayWITStr + 'T00:00:00+09:00')
  const dayOfWeek   = todayWIT.getDay() === 0 ? 6 : todayWIT.getDay() - 1

  const monday = new Date(todayWIT)
  monday.setDate(todayWIT.getDate() - dayOfWeek + weekOffset * 7)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  const toUTC = (d: Date) => new Date(d.getTime() - 9 * 60 * 60 * 1000).toISOString()

  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday); d.setDate(monday.getDate() + i); return d
  })

  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, scheduled_at, status, zoom_link, class_groups!inner(id, label, tutor_id, courses(name))')
    .eq('class_groups.tutor_id', tutorId)
    .gte('scheduled_at', toUTC(monday))
    .lte('scheduled_at', toUTC(sunday))
    .order('scheduled_at')

  const firstOfMonth = new Date(todayWITStr.slice(0, 7) + '-01T00:00:00+09:00')
  const lastOfMonth  = new Date(firstOfMonth)
  lastOfMonth.setMonth(lastOfMonth.getMonth() + 1)
  lastOfMonth.setDate(lastOfMonth.getDate() - 1)

  const { data: sessionsBulanIni } = await supabase
    .from('sessions')
    .select('id, scheduled_at, class_groups!inner(tutor_id)')
    .eq('class_groups.tutor_id', tutorId)
    .gte('scheduled_at', toUTC(firstOfMonth))
    .lte('scheduled_at', toUTC(lastOfMonth))
    .neq('status', 'cancelled')

  const fmtKey  = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Jayapura' })
  const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jayapura' })
  const fmtHeader = (d: Date) => d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jayapura' })
  const fmtMonth  = (d: Date) => d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric', timeZone: 'Asia/Jayapura' })
  const dKey = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jayapura' })

  const sessionDates = new Set((sessionsBulanIni ?? []).map(s => fmtKey(s.scheduled_at)))
  const sessionsByDate: Record<string, any[]> = {}
  sessions?.forEach(s => {
    const k = fmtKey(s.scheduled_at)
    if (!sessionsByDate[k]) sessionsByDate[k] = []
    sessionsByDate[k].push(s)
  })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-black text-[#1A1640] font-['Sora']">Jadwal Mengajar</h1>
        <p className="text-sm text-[#7B78A8] mt-1">{fmtMonth(monday)}</p>
      </div>

      <div className="bg-white rounded-2xl border border-[#E5E3FF] p-4 mb-4">
        <div className="flex items-center justify-between mb-4">
          <Link href={`/tutor/jadwal?week=${weekOffset - 1}`}
            className="px-3 py-1.5 rounded-xl border border-[#E5E3FF] text-sm font-semibold text-[#4A4580] hover:bg-[#F0EFFF] hover:text-[#5C4FE5] transition">
            ← Minggu Lalu
          </Link>
          <span className="text-sm font-bold text-[#1A1640]">
            {monday.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'Asia/Jayapura' })} –{' '}
            {sunday.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jayapura' })}
          </span>
          <Link href={`/tutor/jadwal?week=${weekOffset + 1}`}
            className="px-3 py-1.5 rounded-xl border border-[#E5E3FF] text-sm font-semibold text-[#4A4580] hover:bg-[#F0EFFF] hover:text-[#5C4FE5] transition">
            Minggu Depan →
          </Link>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {weekDates.map((d, i) => {
            const ds = dKey(d); const isToday = ds === todayWITStr; const has = sessionDates.has(ds)
            return (
              <div key={i} className="flex flex-col items-center gap-1">
                <span className="text-[10px] font-bold text-[#7B78A8] uppercase">{DAY_NAMES[i]}</span>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold ${isToday ? 'bg-[#5C4FE5] text-white' : has ? 'bg-[#EEEDFE] text-[#3C3489]' : 'text-[#4A4580]'}`}>
                  {parseInt(ds.slice(-2))}
                </div>
                {has && !isToday && <div className="w-1.5 h-1.5 rounded-full bg-[#5C4FE5]"/>}
              </div>
            )
          })}
        </div>
      </div>

      <div className="space-y-4">
        {weekDates.map((d, i) => {
          const ds = dKey(d); const daySessi = sessionsByDate[ds] ?? []; const isToday = ds === todayWITStr
          if (!daySessi.length) return null
          return (
            <div key={i} className="bg-white rounded-2xl border border-[#E5E3FF] overflow-hidden">
              <div className={`px-5 py-3 border-b border-[#E5E3FF] flex items-center justify-between ${isToday ? 'bg-[#5C4FE5]' : 'bg-[#F7F6FF]'}`}>
                <span className={`text-sm font-bold ${isToday ? 'text-white' : 'text-[#1A1640]'}`}>
                  {fmtHeader(d)}{isToday && <span className="ml-2 text-xs opacity-80">— Hari Ini</span>}
                </span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isToday ? 'bg-white/20 text-white' : 'bg-[#EEEDFE] text-[#3C3489]'}`}>
                  {daySessi.length} sesi
                </span>
              </div>
              <div className="divide-y divide-[#F0EFFF]">
                {daySessi.map((s: any) => {
                  const st = STATUS_MAP[s.status] ?? { label: s.status, pill: 'bg-gray-100 text-gray-600' }
                  return (
                    <div key={s.id} className="flex items-center gap-4 px-5 py-4 hover:bg-[#F7F6FF] transition">
                      <div className="w-14 flex-shrink-0 text-center">
                        <div className="text-sm font-black text-[#5C4FE5]">{fmtTime(s.scheduled_at)}</div>
                        <div className="text-[10px] text-[#7B78A8] font-semibold">WIT</div>
                      </div>
                      <div className="w-0.5 h-10 bg-[#E5E3FF] flex-shrink-0 rounded-full"/>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-[#1A1640] truncate">{s.class_groups?.label ?? '—'}</div>
                        <div className="text-xs text-[#7B78A8] mt-0.5">{s.class_groups?.courses?.name ?? '—'}</div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-xs px-2.5 py-1 rounded-lg font-semibold ${st.pill}`}>{st.label}</span>
                        {s.zoom_link && (
                          <a href={s.zoom_link} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg font-semibold hover:bg-blue-100 transition">
                            <ExternalLink size={11}/> Zoom
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
        {!Object.keys(sessionsByDate).length && (
          <div className="bg-white rounded-2xl border border-[#E5E3FF] p-10 text-center">
            <CalendarDays size={36} strokeWidth={1.5} className="text-[#C4BFFF] mx-auto mb-3"/>
            <p className="text-sm font-semibold text-[#7B78A8]">Tidak ada sesi mengajar minggu ini</p>
          </div>
        )}
      </div>
    </div>
  )
}
