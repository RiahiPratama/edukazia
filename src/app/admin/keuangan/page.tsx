'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import Link from 'next/link'
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  RefreshCw,
  ChevronDown,
  ArrowRight,
  Wallet,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

type MonthlySummary = {
  month: string // '2026-04'
  label: string // 'April 2026'
  pendapatan: number
  pengeluaran: number
  profit: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n)

const getMonthLabel = (ym: string) =>
  new Date(ym + '-15').toLocaleDateString('id-ID', {
    month: 'long',
    year: 'numeric',
  })

const getCurrentMonthWIT = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jayapura' }).slice(0, 7)

// ─── Component ───────────────────────────────────────────────────────────────

export default function KeuanganOverviewPage() {
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  )

  const [loading, setLoading] = useState(true)
  const [monthlies, setMonthlies] = useState<MonthlySummary[]>([])
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthWIT())

  const fetchData = useCallback(async () => {
    setLoading(true)

    // ── PENDAPATAN ──────────────────────────────────────────────────────────

    // 1. Payments siswa (status = 'paid')
    const { data: payments } = await supabase
      .from('payments')
      .select('amount, paid_at')
      .eq('status', 'paid')

    // 2. Tutor subscriptions (status = 'active')
    const { data: subs } = await supabase
      .from('tutor_subscriptions')
      .select('price_paid, created_at')
      .eq('status', 'active')

    // 3. Digital purchases / Pustaka (payment_status = 'paid')
    const { data: pustaka } = await supabase
      .from('digital_purchases')
      .select('amount_paid, created_at')
      .eq('payment_status', 'paid')

    // ── PENGELUARAN ─────────────────────────────────────────────────────────

    // 4. Tutor honor payments (source of truth — prepaid & postpaid)
    const { data: honors } = await supabase
      .from('tutor_honor_payments')
      .select('amount, paid_at')

    // ── Aggregate per month ─────────────────────────────────────────────────
    const monthMap = new Map<string, { pendapatan: number; pengeluaran: number }>()

    const addToMonth = (dateStr: string | null, amount: number, type: 'pendapatan' | 'pengeluaran') => {
      if (!dateStr) return
      const ym = new Date(dateStr).toLocaleDateString('en-CA', { timeZone: 'Asia/Jayapura' }).slice(0, 7)
      const existing = monthMap.get(ym) ?? { pendapatan: 0, pengeluaran: 0 }
      existing[type] += amount
      monthMap.set(ym, existing)
    }

    // Pendapatan
    ;(payments ?? []).forEach((p) => addToMonth(p.paid_at, p.amount, 'pendapatan'))
    ;(subs ?? []).forEach((s) => addToMonth(s.created_at, Number(s.price_paid), 'pendapatan'))
    ;(pustaka ?? []).forEach((p) => addToMonth(p.created_at, Number(p.amount_paid), 'pendapatan'))

    // Pengeluaran (hanya tutor_honor_payments — source of truth)
    ;(honors ?? []).forEach((h) => addToMonth(h.paid_at, h.amount, 'pengeluaran'))

    // Ensure current month exists
    const currentMonth = getCurrentMonthWIT()
    if (!monthMap.has(currentMonth)) {
      monthMap.set(currentMonth, { pendapatan: 0, pengeluaran: 0 })
    }

    // Sort descending
    const sorted: MonthlySummary[] = [...monthMap.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([month, data]) => ({
        month,
        label: getMonthLabel(month),
        pendapatan: data.pendapatan,
        pengeluaran: data.pengeluaran,
        profit: data.pendapatan - data.pengeluaran,
      }))

    setMonthlies(sorted)
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ── Current month data ──────────────────────────────────────────────────────
  const current = monthlies.find((m) => m.month === selectedMonth) ?? {
    month: selectedMonth,
    label: getMonthLabel(selectedMonth),
    pendapatan: 0,
    pengeluaran: 0,
    profit: 0,
  }

  // ── Bar chart max value for scaling ─────────────────────────────────────────
  const chartMonths = monthlies.slice(0, 6).reverse() // last 6 months, ascending
  const maxVal = Math.max(...chartMonths.map((m) => Math.max(m.pendapatan, m.pengeluaran)), 1)

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F7F6FF] p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-sora text-2xl font-bold text-gray-900">Ringkasan Keuangan</h1>
          <p className="mt-1 text-sm text-gray-500">
            Overview pendapatan, pengeluaran, dan profit
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="appearance-none rounded-xl border border-[#E5E3FF] bg-white py-2 pl-3 pr-8 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#5C4FE5]/30"
            >
              {monthlies.map((m) => (
                <option key={m.month} value={m.month}>
                  {m.label}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
            />
          </div>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 rounded-xl border border-[#E5E3FF] bg-white px-4 py-2 text-sm font-medium text-gray-600 shadow-sm transition hover:bg-[#F7F6FF] hover:text-[#5C4FE5]"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw size={20} className="animate-spin text-[#5C4FE5]" />
          <span className="ml-2 text-sm text-gray-500">Memuat data keuangan...</span>
        </div>
      ) : (
        <>
          {/* Profit Summary Cards */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="overflow-hidden rounded-2xl border border-[#E5E3FF] bg-white shadow-sm">
              <div className="bg-gradient-to-r from-emerald-500 to-emerald-400 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-white/80">Pendapatan</span>
                  <TrendingUp size={20} className="text-white/80" />
                </div>
                <p className="mt-2 font-sora text-2xl font-bold text-white">
                  {fmt(current.pendapatan)}
                </p>
              </div>
              <div className="flex items-center justify-between bg-white px-4 py-2">
                <p className="text-xs text-gray-500">{current.label}</p>
                <Link
                  href="/admin/keuangan/pendapatan"
                  className="flex items-center gap-1 text-xs font-medium text-[#5C4FE5] hover:underline"
                >
                  Detail <ArrowRight size={12} />
                </Link>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-[#E5E3FF] bg-white shadow-sm">
              <div className="bg-gradient-to-r from-rose-500 to-rose-400 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-white/80">Pengeluaran</span>
                  <TrendingDown size={20} className="text-white/80" />
                </div>
                <p className="mt-2 font-sora text-2xl font-bold text-white">
                  {fmt(current.pengeluaran)}
                </p>
              </div>
              <div className="flex items-center justify-between bg-white px-4 py-2">
                <p className="text-xs text-gray-500">{current.label}</p>
                <Link
                  href="/admin/keuangan/pengeluaran"
                  className="flex items-center gap-1 text-xs font-medium text-[#5C4FE5] hover:underline"
                >
                  Detail <ArrowRight size={12} />
                </Link>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-[#E5E3FF] bg-white shadow-sm">
              <div
                className={`bg-gradient-to-r p-4 ${
                  current.profit >= 0
                    ? 'from-[#5C4FE5] to-[#7C6FF5]'
                    : 'from-red-600 to-red-500'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-white/80">Profit</span>
                  <Wallet size={20} className="text-white/80" />
                </div>
                <p className="mt-2 font-sora text-2xl font-bold text-white">
                  {fmt(current.profit)}
                </p>
              </div>
              <div className="bg-white px-4 py-2">
                <p className="text-xs text-gray-500">
                  {current.profit >= 0 ? 'Positif' : 'Negatif'} — {current.label}
                </p>
              </div>
            </div>
          </div>

          {/* Monthly Chart — CSS bars */}
          <div className="mb-6 overflow-hidden rounded-2xl border border-[#E5E3FF] bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-[#E5E3FF] px-5 py-4">
              <div className="flex items-center gap-2">
                <BarChart3 size={18} className="text-[#5C4FE5]" />
                <h2 className="font-sora text-base font-semibold text-gray-900">Tren Bulanan</h2>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-400" />
                  Pendapatan
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm bg-rose-400" />
                  Pengeluaran
                </span>
              </div>
            </div>
            <div className="px-5 py-6">
              {chartMonths.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">Belum ada data</p>
              ) : (
                <div className="flex items-end gap-3" style={{ height: '200px' }}>
                  {chartMonths.map((m) => {
                    const hP = maxVal > 0 ? (m.pendapatan / maxVal) * 100 : 0
                    const hE = maxVal > 0 ? (m.pengeluaran / maxVal) * 100 : 0
                    const monthShort = new Date(m.month + '-15').toLocaleDateString('id-ID', {
                      month: 'short',
                    })
                    return (
                      <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
                        <div
                          className="flex w-full items-end gap-1"
                          style={{ height: '170px' }}
                        >
                          <div
                            className="flex-1 rounded-t-md bg-emerald-400 transition-all duration-500"
                            style={{ height: `${Math.max(hP, 2)}%` }}
                            title={`Pendapatan: ${fmt(m.pendapatan)}`}
                          />
                          <div
                            className="flex-1 rounded-t-md bg-rose-400 transition-all duration-500"
                            style={{ height: `${Math.max(hE, 2)}%` }}
                            title={`Pengeluaran: ${fmt(m.pengeluaran)}`}
                          />
                        </div>
                        <span className="text-[11px] text-gray-500">{monthShort}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Monthly Table */}
          <div className="overflow-hidden rounded-2xl border border-[#E5E3FF] bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="border-b border-[#E5E3FF] bg-[#F7F6FF]">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Bulan</th>
                  <th className="px-4 py-3 text-right font-semibold text-emerald-600">Pendapatan</th>
                  <th className="px-4 py-3 text-right font-semibold text-rose-600">Pengeluaran</th>
                  <th className="px-4 py-3 text-right font-semibold text-[#5C4FE5]">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0EFFE]">
                {monthlies.map((m) => (
                  <tr
                    key={m.month}
                    className={`transition hover:bg-[#F7F6FF] ${
                      m.month === selectedMonth ? 'bg-[#F0EFFE]' : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-medium text-gray-800">{m.label}</td>
                    <td className="px-4 py-3 text-right text-emerald-600">{fmt(m.pendapatan)}</td>
                    <td className="px-4 py-3 text-right text-rose-600">{fmt(m.pengeluaran)}</td>
                    <td
                      className={`px-4 py-3 text-right font-semibold ${
                        m.profit >= 0 ? 'text-[#5C4FE5]' : 'text-red-600'
                      }`}
                    >
                      {fmt(m.profit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Quick Links */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Link
              href="/admin/keuangan/pendapatan"
              className="flex items-center justify-between rounded-2xl border border-[#E5E3FF] bg-white p-4 shadow-sm transition hover:border-[#5C4FE5] hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
                  <TrendingUp size={20} className="text-emerald-500" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800">Detail Pendapatan</p>
                  <p className="text-xs text-gray-500">Kursus, Subscription B2B, Pustaka</p>
                </div>
              </div>
              <ArrowRight size={18} className="text-gray-400" />
            </Link>

            <Link
              href="/admin/keuangan/pengeluaran"
              className="flex items-center justify-between rounded-2xl border border-[#E5E3FF] bg-white p-4 shadow-sm transition hover:border-[#5C4FE5] hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50">
                  <TrendingDown size={20} className="text-rose-500" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800">Detail Pengeluaran</p>
                  <p className="text-xs text-gray-500">Honor tutor (prepaid & postpaid)</p>
                </div>
              </div>
              <ArrowRight size={18} className="text-gray-400" />
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
