'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import {
  TrendingDown,
  Users,
  BookOpen,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  Info,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

type TutorHonorRow = {
  tutor_id: string
  tutor_name: string
  tutor_type: string
  rate_per_session: number
  total_sessions: number
  total_honor: number
  sessions: SessionDetail[]
}

type SessionDetail = {
  id: string
  scheduled_at: string
  class_name: string  // "Bahasa Inggris – Privat"
  honor: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n)

// scheduled_at dari DB adalah UTC (+00), konversi ke WIT (Asia/Jayapura = UTC+9)
const fmtDateWIT = (s: string) =>
  new Date(s).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Jayapura',
  })

const tutorTypeBadge = (type: string) => {
  const map: Record<string, string> = {
    internal: 'bg-blue-100 text-blue-700',
    b2b: 'bg-orange-100 text-orange-700',
    hybrid: 'bg-emerald-100 text-emerald-700',
  }
  const label: Record<string, string> = {
    internal: 'Freelancer',
    b2b: 'B2B',
    hybrid: 'Hybrid',
  }
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${map[type] ?? 'bg-gray-100 text-gray-600'}`}
    >
      {label[type] ?? type}
    </span>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PengeluaranPage() {
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  )

  const [honorData, setHonorData] = useState<TutorHonorRow[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedTutor, setExpandedTutor] = useState<string | null>(null)
  const [filterBulan, setFilterBulan] = useState('all')
  const [filterType, setFilterType] = useState('all')

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true)

    // 1. Fetch semua sesi completed
    const { data: sessions } = await supabase
      .from('sessions')
      .select('id, class_group_id, scheduled_at, status')
      .eq('status', 'completed')
      .order('scheduled_at', { ascending: false })

    if (!sessions || sessions.length === 0) {
      setHonorData([])
      setLoading(false)
      return
    }

    // 2. Fetch class_groups → tutor_id, course_id, class_type_id
    //    (tutor_id ada di class_groups, bukan di sessions)
    const cgIds = [...new Set(sessions.map((s) => s.class_group_id).filter(Boolean))]
    const { data: classGroups } = await supabase
      .from('class_groups')
      .select('id, tutor_id, course_id, class_type_id')
      .in('id', cgIds)

    // 3. Fetch tutors — exclude owner (rate=0, bukan pengeluaran bisnis)
    //    dan exclude rate_per_session=0 (akun test / belum diset)
    const tutorIds = [...new Set((classGroups ?? []).map((c) => c.tutor_id).filter(Boolean))]
    const { data: tutors } = await supabase
      .from('tutors')
      .select('id, profile_id, tutor_type, rate_per_session')
      .in('id', tutorIds)
      .neq('tutor_type', 'owner')
      .gt('rate_per_session', 0)

    // Kalau setelah filter tidak ada tutor yang eligible, selesai
    if (!tutors || tutors.length === 0) {
      setHonorData([])
      setLoading(false)
      return
    }

    // 4. Fetch profiles untuk nama tutor
    const profileIds = tutors.map((t) => t.profile_id).filter(Boolean)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', profileIds)

    // 5. Fetch courses → nama kursus
    const courseIds = [...new Set((classGroups ?? []).map((c) => c.course_id).filter(Boolean))]
    const { data: courses } = await supabase
      .from('courses')
      .select('id, name')
      .in('id', courseIds)

    // 6. Fetch class_types → nama tipe kelas
    const ctIds = [...new Set((classGroups ?? []).map((c) => c.class_type_id).filter(Boolean))]
    const { data: classTypes } = await supabase
      .from('class_types')
      .select('id, name')
      .in('id', ctIds)

    // 7. Lookup maps
    const cgMap = new Map((classGroups ?? []).map((c) => [c.id, c]))
    const tutorMap = new Map(tutors.map((t) => [t.id, t]))
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))
    const courseMap = new Map((courses ?? []).map((c) => [c.id, c]))
    const ctMap = new Map((classTypes ?? []).map((c) => [c.id, c]))

    // 8. Group sesi per tutor — hanya tutor yang lolos filter
    const tutorGroups = new Map<string, TutorHonorRow>()

    for (const session of sessions) {
      const cg = cgMap.get(session.class_group_id)
      if (!cg) continue

      // Skip sesi milik owner / rate=0 (tutorMap hanya berisi tutor eligible)
      const tutor = tutorMap.get(cg.tutor_id)
      if (!tutor) continue

      const profile = profileMap.get(tutor.profile_id)
      const course = courseMap.get(cg.course_id)
      const ct = ctMap.get(cg.class_type_id)
      const rate = tutor.rate_per_session

      // Nama kelas: "Bahasa Inggris – Privat"
      const className =
        [course?.name, ct?.name].filter(Boolean).join(' – ') || '—'

      if (!tutorGroups.has(tutor.id)) {
        tutorGroups.set(tutor.id, {
          tutor_id: tutor.id,
          tutor_name: profile?.full_name ?? '—',
          tutor_type: tutor.tutor_type ?? 'internal',
          rate_per_session: rate,
          total_sessions: 0,
          total_honor: 0,
          sessions: [],
        })
      }

      const row = tutorGroups.get(tutor.id)!
      row.total_sessions += 1
      row.total_honor += rate
      row.sessions.push({
        id: session.id,
        scheduled_at: session.scheduled_at,
        class_name: className,
        honor: rate,
      })
    }

    // Sort by total_honor DESC
    setHonorData([...tutorGroups.values()].sort((a, b) => b.total_honor - a.total_honor))
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ── Filter ────────────────────────────────────────────────────────────────
  const filtered = honorData
    .map((t) => {
      // Filter sesi per bulan
      const filteredSessions = t.sessions.filter((s) => {
        if (filterBulan === 'all') return true
        // scheduled_at UTC → ambil bulan berdasarkan WIT
        const wit = new Date(s.scheduled_at).toLocaleDateString('en-CA', {
          timeZone: 'Asia/Jayapura',
        }) // format: "YYYY-MM-DD"
        return wit.slice(0, 7) === filterBulan
      })
      return {
        ...t,
        sessions: filteredSessions,
        total_sessions: filteredSessions.length,
        total_honor: filteredSessions.reduce((a, b) => a + b.honor, 0),
      }
    })
    .filter((t) => {
      const matchType = filterType === 'all' || t.tutor_type === filterType
      return matchType && t.total_sessions > 0
    })

  // ── Summary ───────────────────────────────────────────────────────────────
  const totalHonor = filtered.reduce((a, b) => a + b.total_honor, 0)
  const totalSesi = filtered.reduce((a, b) => a + b.total_sessions, 0)
  const totalTutor = filtered.length

  // Daftar bulan dari scheduled_at (konversi ke WIT)
  const allMonths = [
    ...new Set(
      honorData.flatMap((t) =>
        t.sessions.map((s) =>
          new Date(s.scheduled_at)
            .toLocaleDateString('en-CA', { timeZone: 'Asia/Jayapura' })
            .slice(0, 7)
        )
      )
    ),
  ]
    .sort()
    .reverse()

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F7F6FF] p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-sora text-2xl font-bold text-gray-900">Pengeluaran</h1>
          <p className="mt-1 text-sm text-gray-500">
            Honor tutor freelancer per sesi yang selesai
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 rounded-xl border border-[#E5E3FF] bg-white px-4 py-2 text-sm font-medium text-gray-600 shadow-sm transition hover:bg-[#F7F6FF] hover:text-[#5C4FE5]"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          {
            label: 'Total Honor',
            value: fmt(totalHonor),
            sub: `Dari ${totalSesi} sesi selesai`,
            icon: <TrendingDown size={20} />,
            color: 'from-rose-500 to-rose-400',
          },
          {
            label: 'Tutor Dibayar',
            value: String(totalTutor),
            sub: 'Yang punya sesi selesai',
            icon: <Users size={20} />,
            color: 'from-[#5C4FE5] to-[#7C6FF5]',
          },
          {
            label: 'Total Sesi',
            value: String(totalSesi),
            sub:
              totalTutor > 0
                ? `Rata-rata ${Math.round(totalSesi / totalTutor)} sesi/tutor`
                : 'Belum ada sesi',
            icon: <BookOpen size={20} />,
            color: 'from-amber-500 to-amber-400',
          },
        ].map((card) => (
          <div
            key={card.label}
            className="overflow-hidden rounded-2xl border border-[#E5E3FF] bg-white shadow-sm"
          >
            <div className={`bg-gradient-to-r ${card.color} p-4`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white/80">{card.label}</span>
                <div className="text-white/80">{card.icon}</div>
              </div>
              <p className="mt-2 font-sora text-2xl font-bold text-white">{card.value}</p>
            </div>
            <div className="bg-white px-4 py-2">
              <p className="text-xs text-gray-500">{card.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <select
            value={filterBulan}
            onChange={(e) => setFilterBulan(e.target.value)}
            className="appearance-none rounded-xl border border-[#E5E3FF] bg-white py-2 pl-3 pr-8 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#5C4FE5]/30"
          >
            <option value="all">Semua Bulan</option>
            {allMonths.map((m) => (
              <option key={m} value={m}>
                {new Date(m + '-15').toLocaleDateString('id-ID', {
                  month: 'long',
                  year: 'numeric',
                })}
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
          />
        </div>

        <div className="relative">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="appearance-none rounded-xl border border-[#E5E3FF] bg-white py-2 pl-3 pr-8 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#5C4FE5]/30"
          >
            <option value="all">Semua Tipe</option>
            <option value="internal">Freelancer</option>
            <option value="b2b">B2B</option>
            <option value="hybrid">Hybrid</option>
          </select>
          <ChevronDown
            size={14}
            className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
          />
        </div>

        <span className="ml-auto text-sm text-gray-400">{filtered.length} tutor</span>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center rounded-2xl border border-[#E5E3FF] bg-white py-20 shadow-sm">
          <RefreshCw size={20} className="animate-spin text-[#5C4FE5]" />
          <span className="ml-2 text-sm text-gray-500">Menghitung honor...</span>
        </div>
      ) : filtered.length === 0 ? (
        /* Empty state — informatif, bukan error */
        <div className="rounded-2xl border border-[#E5E3FF] bg-white py-16 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#5C4FE5]/10">
            <Info size={22} className="text-[#5C4FE5]" />
          </div>
          <p className="font-semibold text-gray-700">Belum ada honor yang perlu dibayarkan</p>
          <p className="mt-1 text-sm text-gray-400">
            {honorData.length === 0
              ? 'Sesi tutor freelancer belum ada yang berstatus selesai'
              : 'Tidak ada data untuk filter yang dipilih'}
          </p>
          <p className="mt-3 text-xs text-gray-300">
            Honor owner tidak dihitung sebagai pengeluaran bisnis
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Accordion per tutor */}
          {filtered.map((tutor) => {
            const isOpen = expandedTutor === tutor.tutor_id
            return (
              <div
                key={tutor.tutor_id}
                className="overflow-hidden rounded-2xl border border-[#E5E3FF] bg-white shadow-sm"
              >
                {/* Header baris tutor */}
                <button
                  onClick={() => setExpandedTutor(isOpen ? null : tutor.tutor_id)}
                  className="flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-[#F7F6FF]"
                >
                  <ChevronRight
                    size={16}
                    className={`flex-shrink-0 text-[#5C4FE5] transition-transform ${isOpen ? 'rotate-90' : ''}`}
                  />

                  {/* Avatar inisial */}
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#5C4FE5]/10">
                    <span className="text-sm font-bold text-[#5C4FE5]">
                      {tutor.tutor_name.charAt(0).toUpperCase()}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-gray-800">{tutor.tutor_name}</span>
                      {tutorTypeBadge(tutor.tutor_type)}
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {tutor.total_sessions} sesi · {fmt(tutor.rate_per_session)}/sesi
                    </p>
                  </div>

                  <div className="flex-shrink-0 text-right">
                    <p className="font-bold text-rose-600">{fmt(tutor.total_honor)}</p>
                    <p className="text-xs text-gray-400">total honor</p>
                  </div>
                </button>

                {/* Detail sesi */}
                {isOpen && (
                  <div className="border-t border-[#F0EFFE]">
                    <table className="w-full text-sm">
                      <thead className="bg-[#F7F6FF]">
                        <tr>
                          <th className="px-5 py-2 text-left text-xs font-semibold text-gray-500">
                            Tanggal (WIT)
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">
                            Kelas
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">
                            Status
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500">
                            Honor
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F0EFFE]">
                        {tutor.sessions.map((s) => (
                          <tr key={s.id} className="hover:bg-[#F7F6FF]/50">
                            <td className="whitespace-nowrap px-5 py-2.5 text-xs text-gray-600">
                              {fmtDateWIT(s.scheduled_at)}
                            </td>
                            <td className="px-4 py-2.5 text-gray-700">{s.class_name}</td>
                            <td className="px-4 py-2.5">
                              <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                                <CheckCircle size={11} />
                                Selesai
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right font-medium text-rose-600">
                              {fmt(s.honor)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t border-[#E5E3FF] bg-[#F7F6FF]">
                        <tr>
                          <td
                            colSpan={3}
                            className="px-5 py-2.5 text-xs font-semibold text-gray-600"
                          >
                            Total Honor {tutor.tutor_name}
                          </td>
                          <td className="px-4 py-2.5 text-right text-sm font-bold text-rose-600">
                            {fmt(tutor.total_honor)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            )
          })}

          {/* Grand total */}
          <div className="flex items-center justify-between rounded-2xl border-2 border-[#5C4FE5]/20 bg-white p-4">
            <div>
              <span className="font-semibold text-gray-700">Total Pengeluaran Honor</span>
              {filterBulan !== 'all' && (
                <span className="ml-2 text-sm text-gray-400">
                  (
                  {new Date(filterBulan + '-15').toLocaleDateString('id-ID', {
                    month: 'long',
                    year: 'numeric',
                  })}
                  )
                </span>
              )}
            </div>
            <span className="font-sora text-xl font-bold text-rose-600">{fmt(totalHonor)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
