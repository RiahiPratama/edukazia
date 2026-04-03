'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import {
  TrendingDown,
  RefreshCw,
  ChevronDown,
  CheckCircle,
  Clock,
  Info,
  Banknote,
  Plus,
  X,
  AlertCircle,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

type HonorPayment = {
  id: string
  tutor_id: string
  tutor_name: string
  enrollment_id: string
  student_name: string
  course_name: string
  class_type: string
  amount: number
  sessions_count: number
  scheme: 'prepaid' | 'postpaid'
  paid_at: string
  notes: string | null
  created_at: string
}

type TutorOption = {
  id: string
  name: string
  rate_per_session: number
}

type EnrollmentOption = {
  id: string
  label: string // "Muzaamil — B.Arab Privat"
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

const schemeBadge = (scheme: string) =>
  scheme === 'prepaid' ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
      <Banknote size={10} />
      Di Depan
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
      <Clock size={10} />
      Setelah Sesi
    </span>
  )

// ─── Modal Catat Pembayaran ───────────────────────────────────────────────────

type ModalProps = {
  onClose: () => void
  onSuccess: () => void
}

function CatatPembayaranModal({ onClose, onSuccess }: ModalProps) {
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  )

  const [tutors, setTutors] = useState<TutorOption[]>([])
  const [enrollments, setEnrollments] = useState<EnrollmentOption[]>([])
  const [loadingTutors, setLoadingTutors] = useState(true)
  const [loadingEnrollments, setLoadingEnrollments] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    tutor_id: '',
    enrollment_id: '',
    sessions_count: '8',
    amount: '',
    scheme: 'prepaid',
    paid_at: new Date().toISOString().slice(0, 16), // datetime-local format
    notes: '',
  })

  // Fetch tutor options (non-owner, rate > 0)
  useEffect(() => {
    const fetchTutors = async () => {
      const { data: rawTutors } = await supabase
        .from('tutors')
        .select('id, profile_id, rate_per_session')
        .neq('tutor_type', 'owner')
        .gt('rate_per_session', 0)
        .eq('is_active', true)

      if (!rawTutors || rawTutors.length === 0) {
        setLoadingTutors(false)
        return
      }

      const profileIds = rawTutors.map((t) => t.profile_id).filter(Boolean)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', profileIds)

      const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))
      setTutors(
        rawTutors.map((t) => ({
          id: t.id,
          name: profileMap.get(t.profile_id)?.full_name ?? '—',
          rate_per_session: t.rate_per_session,
        }))
      )
      setLoadingTutors(false)
    }
    fetchTutors()
  }, [supabase])

  // Fetch enrollment options saat tutor dipilih
  const handleTutorChange = useCallback(
    async (tutorId: string) => {
      setForm((f) => ({ ...f, tutor_id: tutorId, enrollment_id: '', amount: '' }))
      if (!tutorId) {
        setEnrollments([])
        return
      }

      setLoadingEnrollments(true)

      // class_groups milik tutor ini
      const { data: cgs } = await supabase
        .from('class_groups')
        .select('id, course_id, class_type_id')
        .eq('tutor_id', tutorId)
        .eq('status', 'active')

      if (!cgs || cgs.length === 0) {
        setEnrollments([])
        setLoadingEnrollments(false)
        return
      }

      // Fetch courses + class_types untuk label
      const courseIds = [...new Set(cgs.map((c) => c.course_id).filter(Boolean))]
      const ctIds = [...new Set(cgs.map((c) => c.class_type_id).filter(Boolean))]

      const [{ data: courses }, { data: classTypes }] = await Promise.all([
        supabase.from('courses').select('id, name').in('id', courseIds),
        supabase.from('class_types').select('id, name').in('id', ctIds),
      ])

      const courseMap = new Map((courses ?? []).map((c) => [c.id, c]))
      const ctMap = new Map((classTypes ?? []).map((c) => [c.id, c]))
      const cgMap = new Map(cgs.map((c) => [c.id, c]))

      // Fetch enrollments dari kelas-kelas ini
      const cgIds = cgs.map((c) => c.id)
      const { data: enrs } = await supabase
        .from('enrollments')
        .select('id, class_group_id, student_id')
        .in('class_group_id', cgIds)
        .eq('status', 'active')

      if (!enrs || enrs.length === 0) {
        setEnrollments([])
        setLoadingEnrollments(false)
        return
      }

      // Fetch nama siswa
      const studentIds = [...new Set(enrs.map((e) => e.student_id).filter(Boolean))]
      const { data: students } = await supabase
        .from('students')
        .select('id, profile_id')
        .in('id', studentIds)

      const sProfileIds = (students ?? []).map((s) => s.profile_id).filter(Boolean)
      const { data: sProfiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', sProfileIds)

      const studentMap = new Map((students ?? []).map((s) => [s.id, s]))
      const sProfileMap = new Map((sProfiles ?? []).map((p) => [p.id, p]))

      const options: EnrollmentOption[] = enrs.map((e) => {
        const cg = cgMap.get(e.class_group_id)
        const course = courseMap.get(cg?.course_id)
        const ct = ctMap.get(cg?.class_type_id)
        const student = studentMap.get(e.student_id)
        const sProfile = sProfileMap.get(student?.profile_id)
        const courseName = [course?.name, ct?.name].filter(Boolean).join(' – ') || '—'
        return {
          id: e.id,
          label: `${sProfile?.full_name ?? '—'} — ${courseName}`,
        }
      })

      setEnrollments(options)
      setLoadingEnrollments(false)
    },
    [supabase]
  )

  // Auto-hitung amount saat tutor atau sessions_count berubah
  const autoFillAmount = useCallback(
    (tutorId: string, sessionsCount: string) => {
      const tutor = tutors.find((t) => t.id === tutorId)
      if (tutor && sessionsCount) {
        const total = tutor.rate_per_session * Number(sessionsCount)
        setForm((f) => ({ ...f, amount: String(total) }))
      }
    },
    [tutors]
  )

  const handleSubmit = async () => {
    setError('')

    if (!form.tutor_id || !form.enrollment_id || !form.amount || !form.paid_at) {
      setError('Tutor, enrollment, jumlah, dan tanggal bayar wajib diisi')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/tutor-honor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tutor_id: form.tutor_id,
          enrollment_id: form.enrollment_id,
          amount: Number(form.amount),
          sessions_count: Number(form.sessions_count),
          scheme: form.scheme,
          paid_at: new Date(form.paid_at).toISOString(),
          notes: form.notes || null,
        }),
      })

      const result = await res.json()
      if (!res.ok) throw new Error(result.error ?? 'Gagal menyimpan')

      onSuccess()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const selectedTutor = tutors.find((t) => t.id === form.tutor_id)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-[#E5E3FF] bg-white shadow-xl">

        {/* Header modal */}
        <div className="flex items-center justify-between border-b border-[#E5E3FF] px-6 py-4">
          <div>
            <h2 className="font-sora text-lg font-bold text-gray-900">Catat Pembayaran Honor</h2>
            <p className="text-xs text-gray-500 mt-0.5">Transfer honor dari EduKazia ke tutor</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-6 py-5">

          {/* Pilih Tutor */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Tutor <span className="text-red-500">*</span>
            </label>
            {loadingTutors ? (
              <div className="flex h-10 items-center gap-2 text-sm text-gray-400">
                <RefreshCw size={14} className="animate-spin" />
                Memuat tutor...
              </div>
            ) : (
              <div className="relative">
                <select
                  value={form.tutor_id}
                  onChange={(e) => {
                    handleTutorChange(e.target.value)
                    autoFillAmount(e.target.value, form.sessions_count)
                  }}
                  className="w-full appearance-none rounded-xl border border-[#E5E3FF] bg-white py-2.5 pl-3 pr-8 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#5C4FE5]/30"
                >
                  <option value="">— Pilih tutor —</option>
                  {tutors.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({fmt(t.rate_per_session)}/sesi)
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
            )}
          </div>

          {/* Pilih Enrollment */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Kelas (Enrollment) <span className="text-red-500">*</span>
            </label>
            {loadingEnrollments ? (
              <div className="flex h-10 items-center gap-2 text-sm text-gray-400">
                <RefreshCw size={14} className="animate-spin" />
                Memuat kelas...
              </div>
            ) : (
              <div className="relative">
                <select
                  value={form.enrollment_id}
                  disabled={!form.tutor_id}
                  onChange={(e) => setForm((f) => ({ ...f, enrollment_id: e.target.value }))}
                  className="w-full appearance-none rounded-xl border border-[#E5E3FF] bg-white py-2.5 pl-3 pr-8 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#5C4FE5]/30 disabled:bg-gray-50 disabled:text-gray-400"
                >
                  <option value="">
                    {!form.tutor_id
                      ? '— Pilih tutor dulu —'
                      : enrollments.length === 0
                      ? '— Tidak ada kelas aktif —'
                      : '— Pilih kelas —'}
                  </option>
                  {enrollments.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.label}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
            )}
          </div>

          {/* Jumlah Sesi + Skema */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Jumlah Sesi
              </label>
              <input
                type="number"
                min="1"
                value={form.sessions_count}
                onChange={(e) => {
                  setForm((f) => ({ ...f, sessions_count: e.target.value }))
                  autoFillAmount(form.tutor_id, e.target.value)
                }}
                className="w-full rounded-xl border border-[#E5E3FF] px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#5C4FE5]/30"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Skema Pembayaran
              </label>
              <div className="relative">
                <select
                  value={form.scheme}
                  onChange={(e) => setForm((f) => ({ ...f, scheme: e.target.value }))}
                  className="w-full appearance-none rounded-xl border border-[#E5E3FF] bg-white py-2.5 pl-3 pr-8 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#5C4FE5]/30"
                >
                  <option value="prepaid">Di Depan (Prepaid)</option>
                  <option value="postpaid">Setelah Sesi (Postpaid)</option>
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
            </div>
          </div>

          {/* Jumlah Bayar — auto-fill, bisa diedit manual */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Jumlah Dibayar (Rp) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">Rp</span>
              <input
                type="number"
                min="0"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder={
                  selectedTutor
                    ? `Auto: ${selectedTutor.rate_per_session} × ${form.sessions_count} sesi`
                    : '0'
                }
                className="w-full rounded-xl border border-[#E5E3FF] py-2.5 pl-9 pr-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#5C4FE5]/30"
              />
            </div>
            {selectedTutor && form.sessions_count && form.amount && (
              <p className="mt-1 text-xs text-gray-400">
                {fmt(selectedTutor.rate_per_session)} × {form.sessions_count} sesi ={' '}
                <span className="font-semibold text-[#5C4FE5]">{fmt(Number(form.amount))}</span>
              </p>
            )}
          </div>

          {/* Tanggal Transfer */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Tanggal Transfer <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              value={form.paid_at}
              onChange={(e) => setForm((f) => ({ ...f, paid_at: e.target.value }))}
              className="w-full rounded-xl border border-[#E5E3FF] px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#5C4FE5]/30"
            />
          </div>

          {/* Catatan opsional */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Catatan{' '}
              <span className="font-normal text-gray-400">(opsional)</span>
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              placeholder="Misal: Transfer BCA, ref #12345"
              className="w-full resize-none rounded-xl border border-[#E5E3FF] px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#5C4FE5]/30"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
              <AlertCircle size={15} className="flex-shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-[#E5E3FF] px-6 py-4">
          <button
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl border border-[#E5E3FF] px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
          >
            Batal
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-2 rounded-xl bg-[#5C4FE5] px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#4940c4] disabled:opacity-50"
          >
            {submitting ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <CheckCircle size={14} />
            )}
            {submitting ? 'Menyimpan...' : 'Simpan Pembayaran'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PengeluaranPage() {
  const [payments, setPayments] = useState<HonorPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [filterBulan, setFilterBulan] = useState('all')
  const [filterScheme, setFilterScheme] = useState('all')

  // ── Fetch dari API ────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/tutor-honor')
      const result = await res.json()
      setPayments(result.payments ?? [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Filter ────────────────────────────────────────────────────────────────
  const filtered = payments.filter((p) => {
    const matchBulan =
      filterBulan === 'all' ||
      new Date(p.paid_at)
        .toLocaleDateString('en-CA', { timeZone: 'Asia/Jayapura' })
        .slice(0, 7) === filterBulan
    const matchScheme = filterScheme === 'all' || p.scheme === filterScheme
    return matchBulan && matchScheme
  })

  // ── Summary ───────────────────────────────────────────────────────────────
  const totalPrepaid = filtered
    .filter((p) => p.scheme === 'prepaid')
    .reduce((a, b) => a + b.amount, 0)

  const totalPostpaid = filtered
    .filter((p) => p.scheme === 'postpaid')
    .reduce((a, b) => a + b.amount, 0)

  const totalAll = totalPrepaid + totalPostpaid

  // Daftar bulan dari paid_at (WIT)
  const allMonths = [
    ...new Set(
      payments.map((p) =>
        new Date(p.paid_at)
          .toLocaleDateString('en-CA', { timeZone: 'Asia/Jayapura' })
          .slice(0, 7)
      )
    ),
  ].sort().reverse()

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F7F6FF] p-6">

      {/* Modal */}
      {showModal && (
        <CatatPembayaranModal
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false)
            fetchData()
          }}
        />
      )}

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-sora text-2xl font-bold text-gray-900">Pengeluaran</h1>
          <p className="mt-1 text-sm text-gray-500">
            Honor tutor yang dibayar EduKazia
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            className="flex items-center gap-2 rounded-xl border border-[#E5E3FF] bg-white px-4 py-2 text-sm font-medium text-gray-600 shadow-sm transition hover:bg-[#F7F6FF] hover:text-[#5C4FE5]"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 rounded-xl bg-[#5C4FE5] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#4940c4]"
          >
            <Plus size={15} />
            Catat Pembayaran
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          {
            label: 'Total Honor Dibayar',
            value: fmt(totalAll),
            sub: `${filtered.length} transaksi`,
            icon: <TrendingDown size={20} />,
            color: 'from-rose-500 to-rose-400',
          },
          {
            label: 'Dibayar Di Depan',
            value: fmt(totalPrepaid),
            sub: `${filtered.filter((p) => p.scheme === 'prepaid').length} transaksi prepaid`,
            icon: <Banknote size={20} />,
            color: 'from-emerald-500 to-emerald-400',
          },
          {
            label: 'Dibayar Setelah Sesi',
            value: fmt(totalPostpaid),
            sub: `${filtered.filter((p) => p.scheme === 'postpaid').length} transaksi postpaid`,
            icon: <Clock size={20} />,
            color: 'from-amber-500 to-amber-400',
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
                {new Date(m + '-15').toLocaleDateString('id-ID', {
                  month: 'long',
                  year: 'numeric',
                })}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>

        <div className="relative">
          <select
            value={filterScheme}
            onChange={(e) => setFilterScheme(e.target.value)}
            className="appearance-none rounded-xl border border-[#E5E3FF] bg-white py-2 pl-3 pr-8 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#5C4FE5]/30"
          >
            <option value="all">Semua Skema</option>
            <option value="prepaid">Di Depan (Prepaid)</option>
            <option value="postpaid">Setelah Sesi (Postpaid)</option>
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>

        <span className="ml-auto text-sm text-gray-400">{filtered.length} transaksi</span>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-[#E5E3FF] bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw size={20} className="animate-spin text-[#5C4FE5]" />
            <span className="ml-2 text-sm text-gray-500">Memuat data...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#5C4FE5]/10">
              <Info size={22} className="text-[#5C4FE5]" />
            </div>
            <p className="font-semibold text-gray-700">Belum ada catatan pembayaran honor</p>
            <p className="mt-1 text-sm text-gray-400">
              Klik tombol "Catat Pembayaran" di atas untuk mulai mencatat
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-[#E5E3FF] bg-[#F7F6FF]">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Tutor</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Kelas (Siswa)</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Skema</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600">Sesi</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Jumlah</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Tanggal Transfer</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Catatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0EFFE]">
              {filtered.map((p) => (
                <tr key={p.id} className="transition hover:bg-[#F7F6FF]">
                  <td className="px-4 py-3 font-medium text-gray-800">{p.tutor_name}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800">{p.student_name}</p>
                    <p className="text-xs text-gray-400">{p.course_name} · {p.class_type}</p>
                  </td>
                  <td className="px-4 py-3">{schemeBadge(p.scheme)}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{p.sessions_count}x</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-800">
                    {fmt(p.amount)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">
                    {fmtDateWIT(p.paid_at)}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {p.notes ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            {/* Grand total — dua baris terpisah */}
            <tfoot className="border-t-2 border-[#E5E3FF] bg-[#F7F6FF]">
              {totalPrepaid > 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-2.5 text-xs font-medium text-gray-600">
                    <span className="inline-flex items-center gap-1">
                      <Banknote size={12} className="text-emerald-500" />
                      Sudah Dibayar Di Depan
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm font-bold text-emerald-600">
                    {fmt(totalPrepaid)}
                  </td>
                  <td colSpan={2} />
                </tr>
              )}
              {totalPostpaid > 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-2.5 text-xs font-medium text-gray-600">
                    <span className="inline-flex items-center gap-1">
                      <Clock size={12} className="text-amber-500" />
                      Dibayar Setelah Sesi
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm font-bold text-amber-600">
                    {fmt(totalPostpaid)}
                  </td>
                  <td colSpan={2} />
                </tr>
              )}
              <tr className="border-t border-[#E5E3FF]">
                <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-gray-700">
                  Total Pengeluaran Honor
                </td>
                <td className="px-4 py-3 text-right font-sora text-base font-bold text-rose-600">
                  {fmt(totalAll)}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  )
}
