'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import {
  TrendingUp,
  Users,
  Building2,
  Clock,
  RefreshCw,
  CheckCircle,
  XCircle,
  ChevronDown,
  ExternalLink,
  Tag,
  Library,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

type PaymentRow = {
  id: string
  student_name: string
  course_name: string
  class_type: string
  period_label: string | null
  method: string | null
  payment_method: string | null
  base_amount: number
  registration_fee: number
  discount_amount: number
  amount: number
  status: string
  paid_at: string
  is_new_student: boolean
  bukti_transfer_url: string | null
}

type SubscriptionRow = {
  id: string
  plan_name: string
  price_paid: number
  payment_method: string | null
  status: string
  start_date: string
  end_date: string
  created_at: string
  tutor_name: string
  course_name: string
}

type PustakaRow = {
  id: string
  product_name: string
  buyer_name: string
  buyer_type: string
  amount_paid: number
  payment_method: string | null
  payment_status: string
  proof_url: string | null
  created_at: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n)

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Jayapura',
  })

const statusBadge = (status: string) => {
  const map: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    paid: {
      label: 'Lunas',
      cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
      icon: <CheckCircle size={11} />,
    },
    active: {
      label: 'Aktif',
      cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
      icon: <CheckCircle size={11} />,
    },
    pending: {
      label: 'Pending',
      cls: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
      icon: <Clock size={11} />,
    },
    unpaid: {
      label: 'Belum Bayar',
      cls: 'bg-red-50 text-red-600 border border-red-200',
      icon: <XCircle size={11} />,
    },
    expired: {
      label: 'Kadaluarsa',
      cls: 'bg-gray-100 text-gray-600 border border-gray-200',
      icon: <Clock size={11} />,
    },
    rejected: {
      label: 'Ditolak',
      cls: 'bg-red-50 text-red-600 border border-red-200',
      icon: <XCircle size={11} />,
    },
  }
  const s = map[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600', icon: null }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>
      {s.icon}
      {s.label}
    </span>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PendapatanPage() {
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  )

  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([])
  const [pustaka, setPustaka] = useState<PustakaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'kursus' | 'b2b' | 'pustaka'>('kursus')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterBulan, setFilterBulan] = useState(
    () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jayapura' }).slice(0, 7)
  )

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true)

    // ═══ 1. PAYMENTS SISWA ═══════════════════════════════════════════════════
    const { data: rawPayments } = await supabase
      .from('payments')
      .select(
        'id, student_id, enrollment_id, amount, base_amount, registration_fee, discount_amount, method, payment_method, status, period_label, paid_at, is_new_student, bukti_transfer_url'
      )
      .order('paid_at', { ascending: false })

    if (rawPayments && rawPayments.length > 0) {
      const enrollmentIds = [...new Set(rawPayments.map((p) => p.enrollment_id).filter(Boolean))]
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('id, class_group_id')
        .in('id', enrollmentIds)

      const cgIds = [...new Set((enrollments ?? []).map((e) => e.class_group_id).filter(Boolean))]
      const { data: classGroups } = await supabase
        .from('class_groups')
        .select('id, course_id, class_type_id')
        .in('id', cgIds)

      const courseIds = [...new Set((classGroups ?? []).map((c) => c.course_id).filter(Boolean))]
      const { data: courses } = await supabase.from('courses').select('id, name').in('id', courseIds)

      const ctIds = [...new Set((classGroups ?? []).map((c) => c.class_type_id).filter(Boolean))]
      const { data: classTypes } = await supabase.from('class_types').select('id, name').in('id', ctIds)

      const studentIds = [...new Set(rawPayments.map((p) => p.student_id).filter(Boolean))]
      const { data: students } = await supabase.from('students').select('id, profile_id').in('id', studentIds)

      const profileIds = (students ?? []).map((s) => s.profile_id).filter(Boolean)
      const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', profileIds)

      const enrollmentMap = new Map((enrollments ?? []).map((e) => [e.id, e]))
      const cgMap = new Map((classGroups ?? []).map((c) => [c.id, c]))
      const courseMap = new Map((courses ?? []).map((c) => [c.id, c]))
      const ctMap = new Map((classTypes ?? []).map((c) => [c.id, c]))
      const studentMap = new Map((students ?? []).map((s) => [s.id, s]))
      const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))

      const merged: PaymentRow[] = rawPayments.map((p) => {
        const enr = enrollmentMap.get(p.enrollment_id)
        const cg = cgMap.get(enr?.class_group_id)
        const course = courseMap.get(cg?.course_id)
        const ct = ctMap.get(cg?.class_type_id)
        const student = studentMap.get(p.student_id)
        const profile = profileMap.get(student?.profile_id)
        return {
          id: p.id,
          student_name: profile?.full_name ?? '—',
          course_name: course?.name ?? '—',
          class_type: ct?.name ?? '—',
          period_label: p.period_label,
          method: p.method,
          payment_method: p.payment_method,
          base_amount: p.base_amount ?? 0,
          registration_fee: p.registration_fee ?? 0,
          discount_amount: p.discount_amount ?? 0,
          amount: p.amount ?? 0,
          status: p.status,
          paid_at: p.paid_at,
          is_new_student: p.is_new_student ?? false,
          bukti_transfer_url: p.bukti_transfer_url,
        }
      })
      setPayments(merged)
    } else {
      setPayments([])
    }

    // ═══ 2. B2B SUBSCRIPTIONS ════════════════════════════════════════════════
    const { data: rawSubs } = await supabase
      .from('tutor_subscriptions')
      .select('id, plan_name, price_paid, payment_method, status, start_date, end_date, created_at, tutor_id, course_id')
      .order('created_at', { ascending: false })

    if (rawSubs && rawSubs.length > 0) {
      const tutorIds = [...new Set(rawSubs.map((s) => s.tutor_id).filter(Boolean))]
      const { data: tutors } = await supabase.from('tutors').select('id, profile_id').in('id', tutorIds)

      const tProfileIds = (tutors ?? []).map((t) => t.profile_id).filter(Boolean)
      const { data: tProfiles } = await supabase.from('profiles').select('id, full_name').in('id', tProfileIds)

      const cIds = [...new Set(rawSubs.map((s) => s.course_id).filter(Boolean))]
      const { data: courses2 } = await supabase.from('courses').select('id, name').in('id', cIds)

      const tutorMap2 = new Map((tutors ?? []).map((t) => [t.id, t]))
      const tProfileMap = new Map((tProfiles ?? []).map((p) => [p.id, p]))
      const courseMap2 = new Map((courses2 ?? []).map((c) => [c.id, c]))

      const mergedSubs: SubscriptionRow[] = rawSubs.map((s) => {
        const tutor = tutorMap2.get(s.tutor_id)
        const tProfile = tProfileMap.get(tutor?.profile_id)
        const course = courseMap2.get(s.course_id)
        return {
          ...s,
          tutor_name: tProfile?.full_name ?? '—',
          course_name: course?.name ?? '—',
        }
      })
      setSubscriptions(mergedSubs)
    } else {
      setSubscriptions([])
    }

    // ═══ 3. PUSTAKA / DIGITAL PURCHASES ═════════════════════════════════════
    const { data: rawPustaka } = await supabase
      .from('digital_purchases')
      .select('id, product_id, buyer_type, buyer_name, buyer_profile_id, amount_paid, payment_method, payment_status, proof_url, created_at')
      .order('created_at', { ascending: false })

    if (rawPustaka && rawPustaka.length > 0) {
      // Fetch product names
      const productIds = [...new Set(rawPustaka.map((p) => p.product_id).filter(Boolean))]
      let productMap = new Map<string, string>()

      if (productIds.length > 0) {
        const { data: products } = await supabase
          .from('digital_products')
          .select('id, title')
          .in('id', productIds)
        productMap = new Map((products ?? []).map((p) => [p.id, p.title]))
      }

      // Fetch buyer names from profiles if buyer_name is empty
      const profileBuyerIds = rawPustaka
        .filter((p) => !p.buyer_name && p.buyer_profile_id)
        .map((p) => p.buyer_profile_id)
        .filter(Boolean)

      let buyerProfileMap = new Map<string, string>()
      if (profileBuyerIds.length > 0) {
        const { data: bProfiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', profileBuyerIds)
        buyerProfileMap = new Map((bProfiles ?? []).map((p) => [p.id, p.full_name]))
      }

      const mergedPustaka: PustakaRow[] = rawPustaka.map((p) => ({
        id: p.id,
        product_name: productMap.get(p.product_id) ?? '—',
        buyer_name: p.buyer_name || buyerProfileMap.get(p.buyer_profile_id) || '—',
        buyer_type: p.buyer_type,
        amount_paid: Number(p.amount_paid),
        payment_method: p.payment_method,
        payment_status: p.payment_status,
        proof_url: p.proof_url,
        created_at: p.created_at,
      }))
      setPustaka(mergedPustaka)
    } else {
      setPustaka([])
    }

    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleTabChange = (tab: 'kursus' | 'b2b' | 'pustaka') => {
    setActiveTab(tab)
    setFilterStatus('all')
  }

  // ── Filter ────────────────────────────────────────────────────────────────
  const filteredPayments = payments.filter((p) => {
    const matchStatus = filterStatus === 'all' || p.status === filterStatus
    const matchBulan = filterBulan === 'all' || p.paid_at?.slice(0, 7) === filterBulan
    return matchStatus && matchBulan
  })

  const filteredSubs = subscriptions.filter((s) => {
    const matchStatus = filterStatus === 'all' || s.status === filterStatus
    const matchBulan = filterBulan === 'all' || s.created_at?.slice(0, 7) === filterBulan
    return matchStatus && matchBulan
  })

  const filteredPustaka = pustaka.filter((p) => {
    const matchStatus = filterStatus === 'all' || p.payment_status === filterStatus
    const matchBulan = filterBulan === 'all' || p.created_at?.slice(0, 7) === filterBulan
    return matchStatus && matchBulan
  })

  // ── Summary ───────────────────────────────────────────────────────────────
  const totalKursus = filteredPayments
    .filter((p) => p.status === 'paid')
    .reduce((a, b) => a + b.amount, 0)

  const totalB2B = filteredSubs
    .filter((s) => s.status === 'active')
    .reduce((a, b) => a + b.price_paid, 0)

  const totalPustaka = filteredPustaka
    .filter((p) => p.payment_status === 'paid')
    .reduce((a, b) => a + b.amount_paid, 0)

  const totalPendapatan = totalKursus + totalB2B + totalPustaka

  const pendingKursus = filteredPayments
    .filter((p) => p.status === 'pending' || p.status === 'unpaid')
    .reduce((a, b) => a + b.amount, 0)

  const allMonths = [
    ...new Set([
      ...payments.filter((p) => p.paid_at).map((p) => p.paid_at.slice(0, 7)),
      ...subscriptions.filter((s) => s.created_at).map((s) => s.created_at.slice(0, 7)),
      ...pustaka.filter((p) => p.created_at).map((p) => p.created_at.slice(0, 7)),
    ]),
  ]
    .sort()
    .reverse()

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F7F6FF] p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-sora text-2xl font-bold text-gray-900">Pendapatan</h1>
          <p className="mt-1 text-sm text-gray-500">
            Pembayaran kursus siswa, subscription B2B, dan penjualan Pustaka
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
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          {
            label: 'Total Pendapatan',
            value: fmt(totalPendapatan),
            sub: 'Semua sumber (lunas)',
            icon: <TrendingUp size={20} />,
            color: 'from-[#5C4FE5] to-[#7C6FF5]',
          },
          {
            label: 'Pendapatan Kursus',
            value: fmt(totalKursus),
            sub: `${filteredPayments.filter((p) => p.status === 'paid').length} transaksi lunas`,
            icon: <Users size={20} />,
            color: 'from-emerald-500 to-emerald-400',
          },
          {
            label: 'Pendapatan B2B',
            value: fmt(totalB2B),
            sub: `${filteredSubs.filter((s) => s.status === 'active').length} subscription aktif`,
            icon: <Building2 size={20} />,
            color: 'from-blue-500 to-blue-400',
          },
          {
            label: 'Penjualan Pustaka',
            value: fmt(totalPustaka),
            sub: `${filteredPustaka.filter((p) => p.payment_status === 'paid').length} penjualan lunas`,
            icon: <Library size={20} />,
            color: 'from-purple-500 to-purple-400',
          },
          {
            label: 'Belum Lunas',
            value: fmt(pendingKursus),
            sub: `${filteredPayments.filter((p) => p.status === 'pending' || p.status === 'unpaid').length} transaksi`,
            icon: <Clock size={20} />,
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
        {/* Tab */}
        <div className="flex rounded-xl border border-[#E5E3FF] bg-white p-1 shadow-sm">
          {([
            { key: 'kursus', label: 'Kursus Siswa' },
            { key: 'b2b', label: 'Subscription B2B' },
            { key: 'pustaka', label: 'Pustaka' },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
                activeTab === tab.key
                  ? 'bg-[#5C4FE5] text-white shadow-sm'
                  : 'text-gray-600 hover:text-[#5C4FE5]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filter Bulan */}
        <div className="relative">
          <select
            value={filterBulan}
            onChange={(e) => setFilterBulan(e.target.value)}
            className="appearance-none rounded-xl border border-[#E5E3FF] bg-white py-2 pl-3 pr-8 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#5C4FE5]/30"
          >
            <option value="all">Semua Periode</option>
            {allMonths.map((m) => (
              <option key={m} value={m}>
                {new Date(m + '-15').toLocaleDateString('id-ID', {
                  month: 'long',
                  year: 'numeric',
                })}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>

        {/* Filter Status */}
        <div className="relative">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="appearance-none rounded-xl border border-[#E5E3FF] bg-white py-2 pl-3 pr-8 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#5C4FE5]/30"
          >
            <option value="all">Semua Status</option>
            {activeTab === 'kursus' ? (
              <>
                <option value="paid">Lunas</option>
                <option value="pending">Pending</option>
                <option value="unpaid">Belum Bayar</option>
              </>
            ) : activeTab === 'b2b' ? (
              <>
                <option value="active">Aktif</option>
                <option value="expired">Kadaluarsa</option>
                <option value="cancelled">Dibatalkan</option>
              </>
            ) : (
              <>
                <option value="paid">Lunas</option>
                <option value="pending">Pending</option>
                <option value="rejected">Ditolak</option>
              </>
            )}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>

        <span className="ml-auto text-sm text-gray-400">
          {activeTab === 'kursus'
            ? filteredPayments.length
            : activeTab === 'b2b'
            ? filteredSubs.length
            : filteredPustaka.length}{' '}
          data
        </span>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-[#E5E3FF] bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw size={20} className="animate-spin text-[#5C4FE5]" />
            <span className="ml-2 text-sm text-gray-500">Memuat data...</span>
          </div>
        ) : activeTab === 'kursus' ? (
          /* ═══ TABEL KURSUS ═══ */
          <table className="w-full text-sm">
            <thead className="border-b border-[#E5E3FF] bg-[#F7F6FF]">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Siswa</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Kursus</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Tipe</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Periode</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Metode</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Jumlah</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Tanggal Bayar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0EFFE]">
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400">
                    Tidak ada data pembayaran
                  </td>
                </tr>
              ) : (
                filteredPayments.map((p) => (
                  <tr key={p.id} className="transition hover:bg-[#F7F6FF]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-gray-800">{p.student_name}</span>
                        {p.is_new_student && (
                          <span className="rounded-full bg-[#5C4FE5]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#5C4FE5]">
                            Baru
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{p.course_name}</td>
                    <td className="px-4 py-3 text-gray-600">{p.class_type}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{p.period_label ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs capitalize text-gray-600">{p.method ?? '—'}</span>
                        {p.bukti_transfer_url && (
                          <a
                            href={p.bukti_transfer_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] text-[#5C4FE5] hover:underline"
                          >
                            <ExternalLink size={10} />
                            Bukti
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="font-semibold text-gray-800">{fmt(p.amount)}</span>
                        {p.discount_amount > 0 && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600">
                            <Tag size={9} />
                            Diskon {fmt(p.discount_amount)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">{statusBadge(p.status)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">
                      {p.paid_at ? fmtDate(p.paid_at) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filteredPayments.length > 0 && (
              <tfoot className="border-t-2 border-[#E5E3FF] bg-[#F7F6FF]">
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-sm font-semibold text-gray-700">
                    Total Lunas
                    {filterBulan !== 'all' && (
                      <span className="ml-1 font-normal text-gray-400">
                        ({new Date(filterBulan + '-15').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })})
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-[#5C4FE5]">
                    {fmt(totalKursus)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        ) : activeTab === 'b2b' ? (
          /* ═══ TABEL SUBSCRIPTION B2B ═══ */
          <table className="w-full text-sm">
            <thead className="border-b border-[#E5E3FF] bg-[#F7F6FF]">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Tutor</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Kursus</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Plan</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Periode</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Metode</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Harga</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0EFFE]">
              {filteredSubs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    Tidak ada data subscription
                  </td>
                </tr>
              ) : (
                filteredSubs.map((s) => (
                  <tr key={s.id} className="transition hover:bg-[#F7F6FF]">
                    <td className="px-4 py-3 font-medium text-gray-800">{s.tutor_name}</td>
                    <td className="px-4 py-3 text-gray-600">{s.course_name}</td>
                    <td className="px-4 py-3 capitalize text-gray-600">{s.plan_name}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">
                      {fmtDate(s.start_date)} – {fmtDate(s.end_date)}
                    </td>
                    <td className="px-4 py-3 capitalize text-gray-500">{s.payment_method ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-800">{fmt(s.price_paid)}</td>
                    <td className="px-4 py-3">{statusBadge(s.status)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {filteredSubs.length > 0 && (
              <tfoot className="border-t-2 border-[#E5E3FF] bg-[#F7F6FF]">
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-sm font-semibold text-gray-700">Total Revenue B2B</td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-[#5C4FE5]">{fmt(totalB2B)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        ) : (
          /* ═══ TABEL PUSTAKA ═══ */
          <table className="w-full text-sm">
            <thead className="border-b border-[#E5E3FF] bg-[#F7F6FF]">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Produk</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Pembeli</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Tipe</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Metode</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Jumlah</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Tanggal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0EFFE]">
              {filteredPustaka.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    Belum ada penjualan Pustaka
                  </td>
                </tr>
              ) : (
                filteredPustaka.map((p) => (
                  <tr key={p.id} className="transition hover:bg-[#F7F6FF]">
                    <td className="px-4 py-3 font-medium text-gray-800">{p.product_name}</td>
                    <td className="px-4 py-3 text-gray-600">{p.buyer_name}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        p.buyer_type === 'internal'
                          ? 'bg-[#5C4FE5]/10 text-[#5C4FE5]'
                          : 'bg-blue-50 text-blue-700'
                      }`}>
                        {p.buyer_type === 'internal' ? 'Internal' : 'Eksternal'}
                      </span>
                    </td>
                    <td className="px-4 py-3 capitalize text-gray-500">{p.payment_method ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-800">{fmt(p.amount_paid)}</td>
                    <td className="px-4 py-3">{statusBadge(p.payment_status)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">
                      {p.created_at ? fmtDate(p.created_at) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filteredPustaka.length > 0 && (
              <tfoot className="border-t-2 border-[#E5E3FF] bg-[#F7F6FF]">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-gray-700">Total Penjualan Pustaka</td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-[#5C4FE5]">{fmt(totalPustaka)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </div>
    </div>
  )
}
