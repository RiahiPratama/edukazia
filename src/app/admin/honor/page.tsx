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
  Clock,
  Info,
  Banknote,
  CalendarCheck,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

type TutorHonorRow = {
  tutor_id: string
  tutor_name: string
  tutor_type: string
  rate_per_session: number
  payment_scheme: 'prepaid' | 'postpaid'
  prepaid_paid_at: string | null
  total_sessions: number
  total_honor: number
  sessions: SessionDetail[]
}

type SessionDetail = {
  id: string
  scheduled_at: string
  class_name: string
  honor: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n)

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
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${map[type] ?? 'bg-gray-100 text-gray-600'}`}>
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

    // 1. Sesi completed
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

    // 2. class_groups → tutor_id, course_id, class_type_id
    const cgIds = [...new Set(sessions.map((s) => s.class_group_id).filter(Boolean))]
    const { data: classGroups } = await supabase
      .from('class_groups')
      .select('id, tutor_id, course_id, class_type_id')
      .in('id', cgIds)

    // 3. Tutors — exclude owner & rate=0, include payment_scheme + prepaid_paid_at
    const tutorIds = [...new Set((classGroups ?? []).map((c) => c.tutor_id).filter(Boolean))]
    const { data: tutors } = await supabase
      .from('tutors')
      .select('id, profile_id, tutor_type, rate_per_session, payment_scheme, prepaid_paid_at')
      .in('id', tutorIds)
      .neq('tutor_type', 'owner')
      .gt('rate_per_session', 0)

    if (!tutors || tutors.length === 0) {
      setHonorData([])
      setLoading(false)
      return
    }

    // 4. Profiles
    const profileIds = tutors.map((t) => t.profile_id).filter(Boolean)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', profileIds)

    // 5. Courses
    const courseIds = [...new Set((classGroups ?? []).map((c) => c.course_id).filter(Boolean))]
    const { data: courses } = await supabase
      .from('courses')
      .select('id, name')
      .in('id', courseIds)

    // 6. Class types
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

    // 8. Group sesi per tutor
    const tutorGroups = new Map<string, TutorHonorRow>()

    for (const session of sessions) {
      const cg = cgMap.get(session.class_group_id)
      if (!cg) continue

      const tutor = tutorMap.get(cg.tutor_id)
      if (!tutor) continue

      const profile = profileMap.get(tutor.profile_id)
      const course = courseMap.get(cg.course_id)
      const ct = ctMap.get(cg.class_type_id)
      const rate = tutor.rate_per_session
      const className = [course?.name, ct?.name].filter(Boolean).join(' – ') || '—'

      if (!tutorGroups.has(tutor.id)) {
        tutorGroups.set(tutor.id, {
          tutor_id: tutor.id,
          tutor_name: profile?.full_name ?? '—',
          tutor_type: tutor.tutor_type ?? 'internal',
          rate_per_session: rate,
          payment_scheme: tutor.payment_scheme ?? 'postpaid',
          prepaid_paid_at: tutor.prepaid_paid_at ?? null,
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

    setHonorData([...tutorGroups.values()].sort((a, b) => b.total_honor - a.total_honor))
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Filter ────────────────────────────────────────────────────────────────
  const filtered = honorData
    .map((t) => {
      const filteredSessions = t.sessions.filter((s) => {
        if (filterBulan === 'all') return true
        const wit = new Date(s.scheduled_at).toLocaleDateString('en-CA', {
          timeZone: 'Asia/Jayapura',
        })
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

  // ── Summary numbers ───────────────────────────────────────────────────────
  const prepaidData = filtered.filter((t) => t.payment_scheme === 'prepaid')
  const postpaidData = filtered.filter((t) => t.payment_scheme === 'postpaid')

  const totalHonorPrepaid = prepaidData.reduce((a, b) => a + b.total_honor, 0)
  const totalHonorPostpaid = postpaidData.reduce((a, b) => a + b.total_honor, 0)
  const totalHonorAll = totalHonorPrepaid + totalHonorPostpaid

  const totalSesi = filtered.reduce((a, b) => a + b.total_sessions, 0)
  const totalTutor = filtered.length

  // Daftar bulan dari scheduled_at (WIT)
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
  ].sort().reverse()

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
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: 'Total Honor',
            value: fmt(totalHonorAll),
            sub: `Dari ${totalSesi} sesi selesai`,
            icon: <TrendingDown size={20} />,
            color: 'from-rose-500 to-rose-400',
          },
          {
            label: 'Sudah Dibayar Di Depan',
            value: fmt(totalHonorPrepaid),
            sub: `${prepaidData.length} tutor skema prepaid`,
            icon: <Banknote size={20} />,
            color: 'from-emerald-500 to-emerald-400',
          },
          {
            label: 'Belum Dibayar',
            value: fmt(totalHonorPostpaid),
            sub: `${postpaidData.length} tutor skema postpaid`,
            icon: <Clock size={20} />,
            color: 'from-amber-500 to-amber-400',
          },
          {
            label: 'Tutor Dibayar',
            value: String(totalTutor),
            sub: totalTutor > 0
              ? `Rata-rata ${Math.round(totalSesi / totalTutor)} sesi/tutor`
              : 'Belum ada sesi',
            icon: <Users size={20} />,
            color: 'from-[#5C4FE5] to-[#7C6FF5]',
          },
        ].map((card) => (
          <div key={card.label} className="overflow-hidden rounded-2xl border border-[#E5E3FF] bg-white shadow-sm">
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
                {new Date(m + '-15').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" />
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
          <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" />
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

          {/* ── Accordion per tutor ─────────────────────────────────────────── */}
          {filtered.map((tutor) => {
            const isOpen = expandedTutor === tutor.tutor_id
            const isPrepaid = tutor.payment_scheme === 'prepaid'

            return (
              <div
                key={tutor.tutor_id}
                className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${
                  isPrepaid ? 'border-emerald-200' : 'border-[#E5E3FF]'
                }`}
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

                  {/* Avatar */}
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#5C4FE5]/10">
                    <span className="text-sm font-bold text-[#5C4FE5]">
                      {tutor.tutor_name.charAt(0).toUpperCase()}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-gray-800">{tutor.tutor_name}</span>
                      {tutorTypeBadge(tutor.tutor_type)}

                      {/* Badge prepaid */}
                      {isPrepaid && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
                          <Banknote size={10} />
                          Dibayar Di Depan
                        </span>
                      )}
                    </div>

                    <div className="mt-0.5 flex flex-wrap items-center gap-3">
                      <p className="text-xs text-gray-500">
                        {tutor.total_sessions} sesi · {fmt(tutor.rate_per_session)}/sesi
                      </p>
                      {/* Tampilkan kapan dibayar kalau prepaid */}
                      {isPrepaid && tutor.prepaid_paid_at && (
                        <p className="inline-flex items-center gap-1 text-xs text-emerald-600">
                          <CalendarCheck size={11} />
                          Dibayar {fmtDateWIT(tutor.prepaid_paid_at)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex-shrink-0 text-right">
                    <p className={`font-bold ${isPrepaid ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {fmt(tutor.total_honor)}
                    </p>
                    <p className="text-xs text-gray-400">
                      {isPrepaid ? 'sudah dibayar' : 'total honor'}
                    </p>
                  </div>
                </button>

                {/* Detail sesi */}
                {isOpen && (
                  <div className="border-t border-[#F0EFFE]">
                    <table className="w-full text-sm">
                      <thead className="bg-[#F7F6FF]">
                        <tr>
                          <th className="px-5 py-2 text-left text-xs font-semibold text-gray-500">Tanggal (WIT)</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Kelas</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Status</th>
                          <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500">Honor</th>
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
                              {isPrepaid ? (
                                /* Prepaid → tiap sesi sudah lunas */
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                                  <CheckCircle size={11} />
                                  Lunas
                                </span>
                              ) : (
                                /* Postpaid → menunggu akhir periode */
                                <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                                  <Clock size={11} />
                                  Menunggu Pembayaran
                                </span>
                              )}
                            </td>
                            <td className={`px-4 py-2.5 text-right font-medium ${isPrepaid ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {fmt(s.honor)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t border-[#E5E3FF] bg-[#F7F6FF]">
                        <tr>
                          <td colSpan={3} className="px-5 py-2.5 text-xs font-semibold text-gray-600">
                            Total Honor {tutor.tutor_name}
                            {isPrepaid && (
                              <span className="ml-2 font-normal text-emerald-600">
                                — Sudah Dibayar Di Depan
                              </span>
                            )}
                          </td>
                          <td className={`px-4 py-2.5 text-right text-sm font-bold ${isPrepaid ? 'text-emerald-600' : 'text-rose-600'}`}>
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

          {/* ── Grand Total — dua baris terpisah ────────────────────────────── */}
          <div className="overflow-hidden rounded-2xl border-2 border-[#5C4FE5]/20 bg-white shadow-sm">

            {/* Baris prepaid */}
            {totalHonorPrepaid > 0 && (
              <div className="flex items-center justify-between border-b border-[#F0EFFE] px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <Banknote size={15} className="text-emerald-500" />
                  <span className="text-sm font-medium text-gray-700">Sudah Dibayar Di Depan</span>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-600 border border-emerald-200">
                    {prepaidData.length} tutor
                  </span>
                </div>
                <span className="font-bold text-emerald-600">{fmt(totalHonorPrepaid)}</span>
              </div>
            )}

            {/* Baris postpaid */}
            {totalHonorPostpaid > 0 && (
              <div className="flex items-center justify-between border-b border-[#F0EFFE] px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <Clock size={15} className="text-amber-500" />
                  <span className="text-sm font-medium text-gray-700">Belum Dibayar</span>
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-600 border border-amber-200">
                    {postpaidData.length} tutor
                  </span>
                </div>
                <span className="font-bold text-rose-600">{fmt(totalHonorPostpaid)}</span>
              </div>
            )}

            {/* Total keseluruhan */}
            <div className="flex items-center justify-between px-5 py-4 bg-[#F7F6FF]">
              <span className="font-semibold text-gray-800">Total Pengeluaran Honor</span>
              <span className="font-sora text-xl font-bold text-rose-600">{fmt(totalHonorAll)}</span>
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
