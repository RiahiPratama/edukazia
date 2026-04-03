'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import {
  TrendingUp,
  Users,
  Building2,
  RefreshCw,
  CheckCircle,
  Clock,
  XCircle,
  ChevronDown,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

type PaymentRow = {
  id: string
  amount: number
  method: string | null
  status: 'paid' | 'pending' | 'unpaid'
  period_label: string | null
  created_at: string
  student_name: string
  course_name: string
  class_type: string
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

type SummaryCard = {
  label: string
  value: string
  sub: string
  icon: React.ReactNode
  color: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

const statusBadge = (status: string) => {
  const map: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    paid: { label: 'Lunas', cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200', icon: <CheckCircle size={12} /> },
    pending: { label: 'Pending', cls: 'bg-yellow-50 text-yellow-700 border border-yellow-200', icon: <Clock size={12} /> },
    unpaid: { label: 'Belum Bayar', cls: 'bg-red-50 text-red-600 border border-red-200', icon: <XCircle size={12} /> },
    active: { label: 'Aktif', cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200', icon: <CheckCircle size={12} /> },
    expired: { label: 'Kadaluarsa', cls: 'bg-gray-100 text-gray-500 border border-gray-200', icon: <XCircle size={12} /> },
    cancelled: { label: 'Dibatalkan', cls: 'bg-red-50 text-red-600 border border-red-200', icon: <XCircle size={12} /> },
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
  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), [])

  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'kursus' | 'b2b'>('kursus')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterBulan, setFilterBulan] = useState<string>('all')

  // ── Fetch data ──────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true)

    // 1. Fetch payments (flat)
    const { data: rawPayments } = await supabase
      .from('payments')
      .select('id, amount, method, status, period_label, created_at, student_id, class_group_id')
      .order('created_at', { ascending: false })

    if (rawPayments && rawPayments.length > 0) {
      // 2. Fetch students
      const studentIds = [...new Set(rawPayments.map((p) => p.student_id).filter(Boolean))]
      const { data: students } = await supabase
        .from('students')
        .select('id, profile_id')
        .in('id', studentIds)

      // 3. Fetch profiles for students
      const profileIds = (students ?? []).map((s) => s.profile_id).filter(Boolean)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', profileIds)

      // 4. Fetch class_groups
      const cgIds = [...new Set(rawPayments.map((p) => p.class_group_id).filter(Boolean))]
      const { data: classGroups } = await supabase
        .from('class_groups')
        .select('id, course_id, class_type_id')
        .in('id', cgIds)

      // 5. Fetch courses
      const courseIds = [...new Set((classGroups ?? []).map((c) => c.course_id).filter(Boolean))]
      const { data: courses } = await supabase
        .from('courses')
        .select('id, name')
        .in('id', courseIds)

      // 6. Fetch class_types
      const ctIds = [...new Set((classGroups ?? []).map((c) => c.class_type_id).filter(Boolean))]
      const { data: classTypes } = await supabase
        .from('class_types')
        .select('id, name')
        .in('id', ctIds)

      // 7. Merge
      const merged: PaymentRow[] = rawPayments.map((p) => {
        const student = (students ?? []).find((s) => s.id === p.student_id)
        const profile = (profiles ?? []).find((pr) => pr.id === student?.profile_id)
        const cg = (classGroups ?? []).find((c) => c.id === p.class_group_id)
        const course = (courses ?? []).find((c) => c.id === cg?.course_id)
        const ct = (classTypes ?? []).find((c) => c.id === cg?.class_type_id)
        return {
          ...p,
          student_name: profile?.full_name ?? '—',
          course_name: course?.name ?? '—',
          class_type: ct?.name ?? '—',
        }
      })

      setPayments(merged)
    } else {
      setPayments([])
    }

    // ── B2B Subscriptions ────────────────────────────────────────────────────
    const { data: rawSubs } = await supabase
      .from('tutor_subscriptions')
      .select('id, plan_name, price_paid, payment_method, status, start_date, end_date, created_at, tutor_id, course_id')
      .order('created_at', { ascending: false })

    if (rawSubs && rawSubs.length > 0) {
      const tutorIds = [...new Set(rawSubs.map((s) => s.tutor_id).filter(Boolean))]
      const { data: tutors } = await supabase
        .from('tutors')
        .select('id, profile_id')
        .in('id', tutorIds)

      const tProfileIds = (tutors ?? []).map((t) => t.profile_id).filter(Boolean)
      const { data: tProfiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', tProfileIds)

      const cIds = [...new Set(rawSubs.map((s) => s.course_id).filter(Boolean))]
      const { data: courses2 } = await supabase
        .from('courses')
        .select('id, name')
        .in('id', cIds)

      const mergedSubs: SubscriptionRow[] = rawSubs.map((s) => {
        const tutor = (tutors ?? []).find((t) => t.id === s.tutor_id)
        const tProfile = (tProfiles ?? []).find((p) => p.id === tutor?.profile_id)
        const course = (courses2 ?? []).find((c) => c.id === s.course_id)
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

    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchData() }, [fetchData])

  // Reset filterStatus saat ganti tab agar tidak salah filter
  const handleTabChange = (tab: 'kursus' | 'b2b') => {
    setActiveTab(tab)
    setFilterStatus('all')
  }

  // ── Filtered data ───────────────────────────────────────────────────────────
  const filteredPayments = payments.filter((p) => {
    const matchStatus = filterStatus === 'all' || p.status === filterStatus
    const matchBulan =
      filterBulan === 'all' ||
      new Date(p.created_at).toISOString().slice(0, 7) === filterBulan
    return matchStatus && matchBulan
  })

  const filteredSubs = subscriptions.filter((s) => {
    const matchStatus = filterStatus === 'all' || s.status === filterStatus
    const matchBulan =
      filterBulan === 'all' ||
      new Date(s.created_at).toISOString().slice(0, 7) === filterBulan
    return matchStatus && matchBulan
  })

  // ── Summary numbers ─────────────────────────────────────────────────────────
  const totalKursus = payments.filter((p) => p.status === 'paid').reduce((a, b) => a + (b.amount ?? 0), 0)
  const totalB2B = subscriptions.filter((s) => s.status === 'active').reduce((a, b) => a + (b.price_paid ?? 0), 0)
  const totalPendapatan = totalKursus + totalB2B
  const pendingKursus = payments.filter((p) => p.status === 'pending').reduce((a, b) => a + (b.amount ?? 0), 0)

  // ── Available months for filter ─────────────────────────────────────────────
  const allMonths = [
    ...new Set([
      ...payments.map((p) => p.created_at.slice(0, 7)),
      ...subscriptions.map((s) => s.created_at.slice(0, 7)),
    ]),
  ].sort().reverse()

  const summary: SummaryCard[] = [
    {
      label: 'Total Pendapatan',
      value: fmt(totalPendapatan),
      sub: 'Kursus + B2B (lunas)',
      icon: <TrendingUp size={20} />,
      color: 'from-[#5C4FE5] to-[#7C6FF5]',
    },
    {
      label: 'Pendapatan Kursus',
      value: fmt(totalKursus),
      sub: `${payments.filter((p) => p.status === 'paid').length} pembayaran lunas`,
      icon: <Users size={20} />,
      color: 'from-emerald-500 to-emerald-400',
    },
    {
      label: 'Pendapatan B2B',
      value: fmt(totalB2B),
      sub: `${subscriptions.filter((s) => s.status === 'active').length} subscription aktif`,
      icon: <Building2 size={20} />,
      color: 'from-blue-500 to-blue-400',
    },
    {
      label: 'Menunggu Pembayaran',
      value: fmt(pendingKursus),
      sub: `${payments.filter((p) => p.status === 'pending').length} transaksi pending`,
      icon: <Clock size={20} />,
      color: 'from-amber-500 to-amber-400',
    },
  ]

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F7F6FF] p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-sora text-2xl font-bold text-gray-900">Pendapatan</h1>
          <p className="mt-1 text-sm text-gray-500">Pembayaran kursus siswa + subscription B2B</p>
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
        {summary.map((card) => (
          <div key={card.label} className="rounded-2xl bg-white border border-[#E5E3FF] shadow-sm overflow-hidden">
            <div className={`bg-gradient-to-r ${card.color} p-4`}>
              <div className="flex items-center justify-between">
                <span className="text-white/80 text-sm font-medium">{card.label}</span>
                <div className="text-white/80">{card.icon}</div>
              </div>
              <p className="mt-2 text-2xl font-bold text-white font-sora">{card.value}</p>
            </div>
            <div className="px-4 py-2 bg-white">
              <p className="text-xs text-gray-500">{card.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* Tab */}
        <div className="flex rounded-xl border border-[#E5E3FF] bg-white p-1 shadow-sm">
          <button
            onClick={() => handleTabChange('kursus')}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
              activeTab === 'kursus'
                ? 'bg-[#5C4FE5] text-white shadow-sm'
                : 'text-gray-600 hover:text-[#5C4FE5]'
            }`}
          >
            Kursus Siswa
          </button>
          <button
            onClick={() => handleTabChange('b2b')}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
              activeTab === 'b2b'
                ? 'bg-[#5C4FE5] text-white shadow-sm'
                : 'text-gray-600 hover:text-[#5C4FE5]'
            }`}
          >
            Subscription B2B
          </button>
        </div>

        {/* Status filter */}
        <div className="relative">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="appearance-none rounded-xl border border-[#E5E3FF] bg-white pl-3 pr-8 py-2 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#5C4FE5]/30"
          >
            <option value="all">Semua Status</option>
            {activeTab === 'kursus' ? (
              <>
                <option value="paid">Lunas</option>
                <option value="pending">Pending</option>
                <option value="unpaid">Belum Bayar</option>
              </>
            ) : (
              <>
                <option value="active">Aktif</option>
                <option value="expired">Kadaluarsa</option>
                <option value="cancelled">Dibatalkan</option>
              </>
            )}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>

        {/* Bulan filter */}
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

        <span className="ml-auto text-sm text-gray-400">
          {activeTab === 'kursus' ? filteredPayments.length : filteredSubs.length} data
        </span>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-[#E5E3FF] bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw size={20} className="animate-spin text-[#5C4FE5]" />
            <span className="ml-2 text-sm text-gray-500">Memuat data...</span>
          </div>
        ) : activeTab === 'kursus' ? (
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
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Tanggal</th>
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
                  <tr key={p.id} className="hover:bg-[#F7F6FF] transition">
                    <td className="px-4 py-3 font-medium text-gray-800">{p.student_name}</td>
                    <td className="px-4 py-3 text-gray-600">{p.course_name}</td>
                    <td className="px-4 py-3 text-gray-600">{p.class_type}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{p.period_label ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500 capitalize">{p.method ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-800">{fmt(p.amount)}</td>
                    <td className="px-4 py-3">{statusBadge(p.status)}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{fmtDate(p.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {filteredPayments.length > 0 && (
              <tfoot className="border-t-2 border-[#E5E3FF] bg-[#F7F6FF]">
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-sm font-semibold text-gray-700">
                    Total Lunas
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-[#5C4FE5]">
                    {fmt(filteredPayments.filter((p) => p.status === 'paid').reduce((a, b) => a + b.amount, 0))}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        ) : (
          // B2B Subscriptions table
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
                  <tr key={s.id} className="hover:bg-[#F7F6FF] transition">
                    <td className="px-4 py-3 font-medium text-gray-800">{s.tutor_name}</td>
                    <td className="px-4 py-3 text-gray-600">{s.course_name}</td>
                    <td className="px-4 py-3 text-gray-600 capitalize">{s.plan_name}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {fmtDate(s.start_date)} – {fmtDate(s.end_date)}
                    </td>
                    <td className="px-4 py-3 text-gray-500 capitalize">{s.payment_method ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-800">{fmt(s.price_paid)}</td>
                    <td className="px-4 py-3">{statusBadge(s.status)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {filteredSubs.length > 0 && (
              <tfoot className="border-t-2 border-[#E5E3FF] bg-[#F7F6FF]">
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-sm font-semibold text-gray-700">
                    Total Revenue B2B
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-[#5C4FE5]">
                    {fmt(filteredSubs.filter((s) => s.status === 'active').reduce((a, b) => a + b.price_paid, 0))}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </div>
    </div>
  )
}
