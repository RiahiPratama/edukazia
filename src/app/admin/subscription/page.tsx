'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, CheckCircle2, XCircle, Clock, Edit, Trash2, X, Save, Loader2, CreditCard, Calendar } from 'lucide-react'

type Subscription = {
  id: string
  tutor_id: string
  plan_name: string | null
  status: string | null
  course_id: string | null
  level_id: string | null
  start_date: string | null
  end_date: string | null
  price_paid: number | null
  payment_method: string | null
  payment_notes: string | null
  payment_proof: string | null
  is_active: boolean
  created_at: string
  tutors?: { profiles: { full_name: string }[] | null } | null
  courses?: { name: string; color: string | null } | null
  levels?: { name: string } | null
}

type Tutor = { id: string; full_name: string; tutor_type: string }
type Course = { id: string; name: string; color: string | null }
type Level = { id: string; name: string }

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  active:    { label: 'Aktif',      color: 'bg-green-100 text-green-700 border-green-300',   icon: CheckCircle2 },
  pending:   { label: 'Pending',    color: 'bg-yellow-100 text-yellow-700 border-yellow-300', icon: Clock },
  expired:   { label: 'Expired',    color: 'bg-red-100 text-red-600 border-red-300',          icon: XCircle },
  cancelled: { label: 'Cancelled',  color: 'bg-gray-100 text-gray-500 border-gray-300',       icon: XCircle },
}

const EMPTY_FORM = {
  tutor_id: '',
  plan_name: 'B2B Solo',
  status: 'pending',
  course_id: '',
  level_id: '',
  start_date: '',
  end_date: '',
  price_paid: '',
  payment_method: '',
  payment_notes: '',
}

export default function TutorSubscriptionPage() {
  const supabase = createClient()
  const [subs, setSubs] = useState<Subscription[]>([])
  const [tutors, setTutors] = useState<Tutor[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [levels, setLevels] = useState<Level[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [subsRes, tutorsRes, coursesRes, levelsRes] = await Promise.all([
      supabase.from('tutor_subscriptions')
        .select(`
          id, tutor_id, plan_name, status, course_id, level_id,
          start_date, end_date, price_paid, payment_method, payment_notes,
          payment_proof, is_active, created_at,
          tutors:tutor_id(profiles:profile_id(full_name)),
          courses:course_id(name, color),
          levels:level_id(name)
        `)
        .order('created_at', { ascending: false }),
      supabase.from('tutors')
        .select('id, tutor_type, profiles:profile_id(full_name)')
        .in('tutor_type', ['b2b', 'hybrid', 'internal']),
      supabase.from('courses').select('id, name, color').eq('is_active', true),
      supabase.from('levels').select('id, name').order('name'),
    ])

    setSubs(subsRes.data ?? [])
    setTutors((tutorsRes.data ?? []).map((t: any) => ({
      id: t.id,
      tutor_type: t.tutor_type,
      full_name: Array.isArray(t.profiles) ? t.profiles[0]?.full_name : t.profiles?.full_name ?? '—'
    })))
    setCourses(coursesRes.data ?? [])
    setLevels(levelsRes.data ?? [])
    setLoading(false)
  }

  function openAdd() {
    setForm(EMPTY_FORM)
    setEditId(null)
    setShowForm(true)
  }

  function openEdit(s: Subscription) {
    setForm({
      tutor_id: s.tutor_id,
      plan_name: s.plan_name ?? 'B2B Solo',
      status: s.status ?? 'pending',
      course_id: s.course_id ?? '',
      level_id: s.level_id ?? '',
      start_date: s.start_date ?? '',
      end_date: s.end_date ?? '',
      price_paid: s.price_paid?.toString() ?? '',
      payment_method: s.payment_method ?? '',
      payment_notes: s.payment_notes ?? '',
    })
    setEditId(s.id)
    setShowForm(true)
  }

  async function handleSave() {
    if (!form.tutor_id) { alert('Pilih tutor dulu'); return }
    setSaving(true)
    try {
      const isActive = form.status === 'active'
      const payload = {
        tutor_id: form.tutor_id,
        plan_name: form.plan_name || 'B2B Solo',
        status: form.status,
        is_active: isActive,
        course_id: form.course_id || null,
        level_id: form.level_id || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        price_paid: form.price_paid ? parseFloat(form.price_paid) : null,
        payment_method: form.payment_method || null,
        payment_notes: form.payment_notes || null,
        updated_at: new Date().toISOString(),
      }

      if (editId) {
        await supabase.from('tutor_subscriptions').update(payload).eq('id', editId)
      } else {
        await supabase.from('tutor_subscriptions').insert(payload)
      }

      // Update tutor_type ke hybrid kalau sebelumnya internal dan subscription active
      if (isActive) {
        const tutor = tutors.find(t => t.id === form.tutor_id)
        if (tutor?.tutor_type === 'internal') {
          await supabase.from('tutors')
            .update({ tutor_type: 'hybrid' })
            .eq('id', form.tutor_id)
        }
      }

      setShowForm(false)
      fetchAll()
    } catch { alert('❌ Gagal menyimpan') }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Hapus subscription ini?')) return
    await supabase.from('tutor_subscriptions').delete().eq('id', id)
    fetchAll()
  }

  const formatRp = (n: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)

  const isExpiringSoon = (end: string | null) =>
    end && new Date(end) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) &&
    new Date(end) > new Date()

  const inputCls = "w-full px-3 py-2.5 border border-[#E5E3FF] rounded-xl text-sm bg-[#F7F6FF] text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] focus:bg-white transition"
  const labelCls = "block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5"

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-[#1A1640]" style={{ fontFamily: 'Sora, sans-serif' }}>
            Subscription Tutor B2B
          </h1>
          <p className="text-sm text-[#7B78A8] mt-1">
            {subs.filter(s => s.status === 'active').length} subscription aktif
          </p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 bg-[#5C4FE5] text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-[#4a3ec7] transition-colors">
          <Plus size={16} /> Tambah Subscription
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center p-16">
          <Loader2 className="w-8 h-8 animate-spin text-[#5C4FE5]" />
        </div>
      ) : subs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E5E3FF] p-12 text-center">
          <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="font-bold text-[#1A1640] mb-1">Belum ada subscription</p>
          <p className="text-sm text-[#7B78A8] mb-4">Tambahkan subscription untuk tutor B2B</p>
          <button onClick={openAdd}
            className="inline-flex items-center gap-2 bg-[#5C4FE5] text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-[#4a3ec7] transition-colors">
            + Tambah Pertama
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E5E3FF] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#F7F6FF] border-b border-[#E5E3FF]">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-bold text-[#7B78A8] uppercase tracking-wide">Tutor</th>
                <th className="text-left px-5 py-3 text-xs font-bold text-[#7B78A8] uppercase tracking-wide">Paket</th>
                <th className="text-left px-5 py-3 text-xs font-bold text-[#7B78A8] uppercase tracking-wide">Kursus</th>
                <th className="text-left px-5 py-3 text-xs font-bold text-[#7B78A8] uppercase tracking-wide">Periode</th>
                <th className="text-left px-5 py-3 text-xs font-bold text-[#7B78A8] uppercase tracking-wide">Status</th>
                <th className="text-left px-5 py-3 text-xs font-bold text-[#7B78A8] uppercase tracking-wide">Bayar</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F7F6FF]">
              {subs.map(s => {
                const status = STATUS_CONFIG[s.status ?? 'pending'] ?? STATUS_CONFIG.pending
                const StatusIcon = status.icon
                const tutorName = (s.tutors as any)?.profiles?.[0]?.full_name ?? '—'
                const courseName = (s.courses as any)?.name
                const courseColor = (s.courses as any)?.color
                const expiring = isExpiringSoon(s.end_date)

                return (
                  <tr key={s.id} className="hover:bg-[#F7F6FF] transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-[#1A1640]">{tutorName}</p>
                      <p className="text-xs text-[#7B78A8]">{s.plan_name}</p>
                    </td>
                    <td className="px-5 py-4">
                      {courseName ? (
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full text-white"
                          style={{ background: courseColor || '#5C4FE5' }}>
                          {courseName}
                        </span>
                      ) : <span className="text-xs text-gray-400">Semua kursus</span>}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1 text-xs text-[#7B78A8]">
                        <Calendar size={11} />
                        <span>
                          {s.start_date ? new Date(s.start_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}
                          {' → '}
                          {s.end_date ? new Date(s.end_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}
                        </span>
                      </div>
                      {expiring && (
                        <p className="text-xs text-orange-500 font-semibold mt-0.5">⚠️ Hampir expired</p>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${status.color}`}>
                        <StatusIcon size={11} /> {status.label}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-xs font-semibold text-[#1A1640]">
                        {s.price_paid ? formatRp(s.price_paid) : '—'}
                      </p>
                      {s.payment_method && <p className="text-xs text-[#7B78A8]">{s.payment_method}</p>}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(s)}
                          className="p-1.5 text-gray-400 hover:text-[#5C4FE5] hover:bg-purple-50 rounded-lg transition-colors">
                          <Edit size={13} />
                        </button>
                        <button onClick={() => handleDelete(s.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E3FF] sticky top-0 bg-white">
              <h2 className="text-lg font-black text-[#1A1640]">
                {editId ? 'Edit Subscription' : 'Tambah Subscription'}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Tutor */}
              <div>
                <label className={labelCls}>Tutor *</label>
                <select value={form.tutor_id}
                  onChange={e => setForm(p => ({ ...p, tutor_id: e.target.value }))}
                  className={inputCls}>
                  <option value="">Pilih tutor...</option>
                  {tutors.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.full_name} ({t.tutor_type})
                    </option>
                  ))}
                </select>
              </div>

              {/* Plan name */}
              <div>
                <label className={labelCls}>Nama Paket</label>
                <input value={form.plan_name}
                  onChange={e => setForm(p => ({ ...p, plan_name: e.target.value }))}
                  placeholder="B2B Solo / B2B Bimbel..." className={inputCls} />
              </div>

              {/* Course */}
              <div>
                <label className={labelCls}>Kursus (kosongkan = semua kursus)</label>
                <select value={form.course_id}
                  onChange={e => setForm(p => ({ ...p, course_id: e.target.value }))}
                  className={inputCls}>
                  <option value="">Semua kursus</option>
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Status */}
              <div>
                <label className={labelCls}>Status</label>
                <div className="grid grid-cols-4 gap-2">
                  {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                    <button type="button" key={key}
                      onClick={() => setForm(p => ({ ...p, status: key }))}
                      className={`py-2 rounded-xl border-2 text-xs font-bold transition-all
                        ${form.status === key
                          ? `${cfg.color} ring-2 ring-offset-1 ring-[#5C4FE5]`
                          : 'border-[#E5E3FF] text-gray-400 hover:border-[#5C4FE5]'}`}>
                      {cfg.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tanggal */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Mulai</label>
                  <input type="date" value={form.start_date}
                    onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))}
                    className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Berakhir</label>
                  <input type="date" value={form.end_date}
                    onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))}
                    className={inputCls} />
                </div>
              </div>

              {/* Pembayaran */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Harga (Rp)</label>
                  <input type="number" value={form.price_paid}
                    onChange={e => setForm(p => ({ ...p, price_paid: e.target.value }))}
                    placeholder="150000" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Metode Bayar</label>
                  <input value={form.payment_method}
                    onChange={e => setForm(p => ({ ...p, payment_method: e.target.value }))}
                    placeholder="Transfer BCA..." className={inputCls} />
                </div>
              </div>

              {/* Catatan */}
              <div>
                <label className={labelCls}>Catatan Pembayaran</label>
                <textarea value={form.payment_notes}
                  onChange={e => setForm(p => ({ ...p, payment_notes: e.target.value }))}
                  placeholder="Catatan internal..." rows={2}
                  className={inputCls + ' resize-none'} />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[#E5E3FF] flex gap-3 sticky bottom-0 bg-white">
              <button onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 border-2 border-[#E5E3FF] text-[#7B78A8] rounded-xl font-semibold text-sm hover:bg-gray-50">
                Batal
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#5C4FE5] text-white rounded-xl font-semibold text-sm hover:bg-[#4a3ec7] disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={15} />}
                {editId ? 'Update' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
