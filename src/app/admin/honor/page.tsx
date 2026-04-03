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
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

type TutorHonorRow = {
  tutor_id: string
  tutor_name: string
  tutor_type: string
  employment_status: string | null
  rate_per_session: number
  monthly_salary: number | null
  total_sessions: number
  total_honor: number
  sessions: SessionRow[]
}

type SessionRow = {
  id: string
  scheduled_at: string
  status: string
  class_name: string
  course_name: string
  honor: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

const tutorTypeBadge = (type: string) => {
  const map: Record<string, string> = {
    owner: 'bg-purple-100 text-purple-700',
    internal: 'bg-blue-100 text-blue-700',
    b2b: 'bg-orange-100 text-orange-700',
    hybrid: 'bg-emerald-100 text-emerald-700',
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${map[type] ?? 'bg-gray-100 text-gray-600'}`}>
      {type}
    </span>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PengeluaranPage() {
  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), [])

  const [honorData, setHonorData] = useState<TutorHonorRow[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedTutor, setExpandedTutor] = useState<string | null>(null)
  const [filterBulan, setFilterBulan] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')

  // ── Fetch data ──────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true)

    // 1. Fetch completed sessions
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

    // 2. Fetch class_groups (to get tutor_id, course_id, class_type_id)
    const cgIds = [...new Set(sessions.map((s) => s.class_group_id).filter(Boolean))]
    const { data: classGroups } = await supabase
      .from('class_groups')
      .select('id, tutor_id, course_id, class_type_id')
      .in('id', cgIds)

    // 3. Fetch tutors
    const tutorIds = [...new Set((classGroups ?? []).map((c) => c.tutor_id).filter(Boolean))]
    const { data: tutors } = await supabase
      .from('tutors')
      .select('id, profile_id, tutor_type, employment_status, rate_per_session, monthly_salary')
      .in('id', tutorIds)

    // 4. Fetch profiles for tutors
    const profileIds = (tutors ?? []).map((t) => t.profile_id).filter(Boolean)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', profileIds)

    // 5. Fetch courses
    const courseIds = [...new Set((classGroups ?? []).map((c) => c.course_id).filter(Boolean))]
    const { data: courses } = await supabase
      .from('courses')
      .select('id, name')
      .in('id', courseIds)

    // 5b. Fetch class_types (untuk construct nama kelas: "Bahasa Inggris - Privat")
    const ctIds = [...new Set((classGroups ?? []).map((c) => c.class_type_id).filter(Boolean))]
    const { data: classTypes } = await supabase
      .from('class_types')
      .select('id, name')
      .in('id', ctIds)

    // 6. Build lookup maps
    const cgMap = new Map((classGroups ?? []).map((c) => [c.id, c]))
    const tutorMap = new Map((tutors ?? []).map((t) => [t.id, t]))
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))
    const courseMap = new Map((courses ?? []).map((c) => [c.id, c]))
    const classTypeMap = new Map((classTypes ?? []).map((c) => [c.id, c]))

    // 7. Group sessions by tutor
    const tutorGroups = new Map<string, TutorHonorRow>()

    for (const session of sessions) {
      const cg = cgMap.get(session.class_group_id)
      if (!cg) continue

      const tutor = tutorMap.get(cg.tutor_id)
      if (!tutor) continue

      const profile = profileMap.get(tutor.profile_id)
      const course = courseMap.get(cg.course_id)
      const classType = classTypeMap.get(cg.class_type_id)
      const rate = tutor.rate_per_session ?? 0
      // Construct nama kelas dari kursus + tipe karena class_groups tidak punya kolom name
      const className = [course?.name, classType?.name].filter(Boolean).join(' – ') || '—'
      const courseName = course?.name ?? '—'

      if (!tutorGroups.has(tutor.id)) {
        tutorGroups.set(tutor.id, {
          tutor_id: tutor.id,
          tutor_name: profile?.full_name ?? '—',
          tutor_type: tutor.tutor_type ?? 'internal',
          employment_status: tutor.employment_status,
          rate_per_session: rate,
          monthly_salary: tutor.monthly_salary,
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
        status: session.status,
        class_name: className,
        course_name: courseName,
        honor: rate,
      })
    }

    setHonorData([...tutorGroups.values()].sort((a, b) => b.total_honor - a.total_honor))
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Filtered data ───────────────────────────────────────────────────────────
  const filtered = honorData
    .map((t) => {
      const filteredSessions = t.sessions.filter((s) => {
        const matchBulan =
          filterBulan === 'all' || s.scheduled_at.slice(0, 7) === filterBulan
        return matchBulan
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
      const hasSession = t.total_sessions > 0
      return matchType && hasSession
    })

  // ── Summary ─────────────────────────────────────────────────────────────────
  const totalHonor = filtered.reduce((a, b) => a + b.total_honor, 0)
  const totalSesi = filtered.reduce((a, b) => a + b.total_sessions, 0)
  const totalTutor = filtered.length

  // ── Available months ────────────────────────────────────────────────────────
  const allMonths = [
    ...new Set(honorData.flatMap((t) => t.sessions.map((s) => s.scheduled_at.slice(0, 7)))),
  ].sort().reverse()

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F7F6FF] p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-sora text-2xl font-bold text-gray-900">Pengeluaran</h1>
          <p className="mt-1 text-sm text-gray-500">Honor tutor berdasarkan sesi yang selesai</p>
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
        <div className="rounded-2xl overflow-hidden border border-[#E5E3FF] bg-white shadow-sm">
          <div className="bg-gradient-to-r from-rose-500 to-rose-400 p-4">
            <div className="flex items-center justify-between">
              <span className="text-white/80 text-sm font-medium">Total Honor</span>
              <TrendingDown size={20} className="text-white/80" />
            </div>
            <p className="mt-2 text-2xl font-bold text-white font-sora">{fmt(totalHonor)}</p>
          </div>
          <div className="px-4 py-2">
            <p className="text-xs text-gray-500">Dari {totalSesi} sesi selesai</p>
          </div>
        </div>

        <div className="rounded-2xl overflow-hidden border border-[#E5E3FF] bg-white shadow-sm">
          <div className="bg-gradient-to-r from-[#5C4FE5] to-[#7C6FF5] p-4">
            <div className="flex items-center justify-between">
              <span className="text-white/80 text-sm font-medium">Total Tutor Aktif</span>
              <Users size={20} className="text-white/80" />
            </div>
            <p className="mt-2 text-2xl font-bold text-white font-sora">{totalTutor}</p>
          </div>
          <div className="px-4 py-2">
            <p className="text-xs text-gray-500">Yang ada sesi selesai</p>
          </div>
        </div>

        <div className="rounded-2xl overflow-hidden border border-[#E5E3FF] bg-white shadow-sm">
          <div className="bg-gradient-to-r from-amber-500 to-amber-400 p-4">
            <div className="flex items-center justify-between">
              <span className="text-white/80 text-sm font-medium">Total Sesi</span>
              <BookOpen size={20} className="text-white/80" />
            </div>
            <p className="mt-2 text-2xl font-bold text-white font-sora">{totalSesi}</p>
          </div>
          <div className="px-4 py-2">
            <p className="text-xs text-gray-500">
              Rata-rata {totalTutor > 0 ? Math.round(totalSesi / totalTutor) : 0} sesi/tutor
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <select
            value={filterBulan}
            onChange={(e) => setFilterBulan(e.target.value)}
            className="appearance-none rounded-xl border border-[#E5E3FF] bg-white pl-3 pr-8 py-2 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#5C4FE5]/30"
          >
            <option value="all">Semua Bulan</option>
            {allMonths.map((m) => (
              <option key={m} value={m}>
                {new Date(m + '-01').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>

        <div className="relative">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="appearance-none rounded-xl border border-[#E5E3FF] bg-white pl-3 pr-8 py-2 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#5C4FE5]/30"
          >
            <option value="all">Semua Tipe</option>
            <option value="owner">Owner</option>
            <option value="internal">Internal (Freelancer)</option>
            <option value="b2b">B2B</option>
            <option value="hybrid">Hybrid</option>
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>

        <span className="ml-auto text-sm text-gray-400">{filtered.length} tutor</span>
      </div>

      {/* Accordion table by tutor */}
      {loading ? (
        <div className="flex items-center justify-center rounded-2xl border border-[#E5E3FF] bg-white py-20 shadow-sm">
          <RefreshCw size={20} className="animate-spin text-[#5C4FE5]" />
          <span className="ml-2 text-sm text-gray-500">Menghitung honor...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-[#E5E3FF] bg-white py-16 text-center shadow-sm">
          <p className="text-gray-400">Tidak ada data honor untuk filter ini</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((tutor) => {
            const isOpen = expandedTutor === tutor.tutor_id
            return (
              <div
                key={tutor.tutor_id}
                className="rounded-2xl border border-[#E5E3FF] bg-white shadow-sm overflow-hidden"
              >
                {/* Tutor header row */}
                <button
                  onClick={() => setExpandedTutor(isOpen ? null : tutor.tutor_id)}
                  className="w-full px-5 py-4 flex items-center gap-4 hover:bg-[#F7F6FF] transition text-left"
                >
                  <ChevronRight
                    size={16}
                    className={`text-[#5C4FE5] transition-transform ${isOpen ? 'rotate-90' : ''}`}
                  />

                  {/* Avatar */}
                  <div className="h-9 w-9 rounded-full bg-[#5C4FE5]/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-[#5C4FE5]">
                      {tutor.tutor_name.charAt(0).toUpperCase()}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-800">{tutor.tutor_name}</span>
                      {tutorTypeBadge(tutor.tutor_type)}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {tutor.total_sessions} sesi · {fmt(tutor.rate_per_session)}/sesi
                    </p>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-rose-600">{fmt(tutor.total_honor)}</p>
                    <p className="text-xs text-gray-400">total honor</p>
                  </div>
                </button>

                {/* Session detail rows */}
                {isOpen && (
                  <div className="border-t border-[#F0EFFE]">
                    <table className="w-full text-sm">
                      <thead className="bg-[#F7F6FF]">
                        <tr>
                          <th className="px-5 py-2 text-left text-xs font-semibold text-gray-500">Tanggal</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Kelas</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Kursus</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Status</th>
                          <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500">Honor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F0EFFE]">
                        {tutor.sessions.map((s) => (
                          <tr key={s.id} className="hover:bg-[#F7F6FF]/50">
                            <td className="px-5 py-2.5 text-gray-600 text-xs whitespace-nowrap">
                              {fmtDate(s.scheduled_at)}
                            </td>
                            <td className="px-4 py-2.5 text-gray-700">{s.class_name}</td>
                            <td className="px-4 py-2.5 text-gray-500">{s.course_name}</td>
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
                          <td colSpan={4} className="px-5 py-2.5 text-xs font-semibold text-gray-600">
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
          <div className="rounded-2xl border-2 border-[#5C4FE5]/20 bg-white p-4 flex items-center justify-between">
            <span className="font-semibold text-gray-700">Total Pengeluaran Honor</span>
            <span className="text-xl font-bold text-rose-600 font-sora">{fmt(totalHonor)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
