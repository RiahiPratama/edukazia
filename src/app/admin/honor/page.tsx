'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, X, Check, Search } from 'lucide-react'

type Tutor = {
  id: string
  profile_id: string
  is_owner: boolean
  bank_name: string | null
  bank_account: string | null
  bank_holder: string | null
  name: string
}

type ClassGroup = {
  id: string
  label: string
  class_type_id: string
  class_type_name: string
  tutor_id: string
  active_students: number
}

type HonorPayment = {
  id: string
  tutor_id: string
  class_group_id: string | null
  period_label: string | null
  sessions_done: number
  students_count: number
  class_type: string
  rate_per_session: number
  subtotal: number
  bonus: number
  total: number
  status: string
  notes: string | null
  paid_at: string | null
  created_at: string
  tutor_name: string
  class_label: string
}

const RATES: Record<string, number> = {
  'Privat':      50000,
  'Semi Privat': 30000,
  'Reguler':     15000,
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  unpaid: { label: 'Belum Dibayar', cls: 'bg-[#FEE9E9] text-[#991B1B]' },
  paid:   { label: 'Sudah Dibayar', cls: 'bg-[#E6F4EC] text-[#1A5C36]' },
}

function formatRp(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function HonorPage() {
  const supabase = createClient()

  const [payments,    setPayments]    = useState<HonorPayment[]>([])
  const [tutors,      setTutors]      = useState<Tutor[]>([])
  const [classGroups, setClassGroups] = useState<ClassGroup[]>([])
  const [loading,     setLoading]     = useState(true)
  const [showModal,   setShowModal]   = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [formError,   setFormError]   = useState('')
  const [search,      setSearch]      = useState('')
  const [filterStatus,setFilterStatus]= useState('all')

  // Form
  const [fTutorId,      setFTutorId]      = useState('')
  const [fClassGroupId, setFClassGroupId] = useState('')
  const [fPeriod,       setFPeriod]       = useState('')
  const [fSessionsDone, setFSessionsDone] = useState(0)
  const [fStudents,     setFStudents]     = useState(1)
  const [fRate,         setFRate]         = useState(0)
  const [fBonus,        setFBonus]        = useState(0)
  const [fBonusNote,    setFBonusNote]    = useState('')
  const [fNotes,        setFNotes]        = useState('')

  const selectedTutor      = tutors.find(t => t.id === fTutorId)
  const selectedClass      = classGroups.find(c => c.id === fClassGroupId)
  const tutorClasses       = classGroups.filter(c => c.tutor_id === fTutorId)
  const classType          = selectedClass?.class_type_name ?? ''
  const isPerStudent       = classType === 'Semi Privat' || classType === 'Reguler'
  const subtotal           = fRate * fSessionsDone * (isPerStudent ? fStudents : 1)
  const total              = subtotal + fBonus

  useEffect(() => { fetchAll() }, [])

  // Auto-fill rate & students saat pilih kelas
  useEffect(() => {
    if (selectedClass) {
      const rate = RATES[selectedClass.class_type_name] ?? 0
      setFRate(rate)
      setFStudents(selectedClass.active_students)
    }
  }, [fClassGroupId])

  async function fetchAll() {
    setLoading(true)

    // Fetch honor payments
    const { data: pays } = await supabase
      .from('tutor_payments')
      .select('id, tutor_id, class_group_id, period_label, sessions_done, students_count, class_type, rate_per_session, subtotal, bonus, total, status, notes, paid_at, created_at')
      .order('created_at', { ascending: false })

    // Fetch tutors
    const { data: tutorData } = await supabase
      .from('tutors')
      .select('id, profile_id, is_owner, bank_name, bank_account, bank_holder')
      .eq('is_active', true)

    let tutorNameMap: Record<string, string> = {}
    if (tutorData && tutorData.length > 0) {
      const profIds = tutorData.map((t: any) => t.profile_id).filter(Boolean)
      if (profIds.length > 0) {
        const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', profIds)
        const profMap = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.full_name]))
        tutorNameMap = Object.fromEntries(tutorData.map((t: any) => [t.id, profMap[t.profile_id] ?? 'Tutor']))
      }
      setTutors(tutorData.map((t: any) => ({ ...t, name: tutorNameMap[t.id] ?? 'Tutor' })))
    }

    // Fetch class groups + tipe + jumlah siswa aktif
    const { data: cg } = await supabase
      .from('class_groups')
      .select('id, label, class_type_id, tutor_id, class_types(name), enrollments(id, status)')
      .eq('status', 'active')

    const cgList: ClassGroup[] = (cg ?? []).map((c: any) => ({
      id:               c.id,
      label:            c.label,
      class_type_id:    c.class_type_id,
      class_type_name:  c.class_types?.name ?? '—',
      tutor_id:         c.tutor_id,
      active_students:  (c.enrollments ?? []).filter((e: any) => e.status === 'active').length,
    }))
    setClassGroups(cgList)

    // Merge class label & tutor name ke payments
    const cgMap = Object.fromEntries(cgList.map(c => [c.id, c.label]))
    setPayments((pays ?? []).map((p: any) => ({
      ...p,
      tutor_name:  tutorNameMap[p.tutor_id] ?? '—',
      class_label: cgMap[p.class_group_id] ?? '—',
    })))

    setLoading(false)
  }

  function openAdd() {
    setFTutorId(''); setFClassGroupId(''); setFPeriod('')
    setFSessionsDone(0); setFStudents(1); setFRate(0)
    setFBonus(0); setFBonusNote(''); setFNotes(''); setFormError('')
    setShowModal(true)
  }

  async function handleSave() {
    if (!fTutorId)    { setFormError('Pilih tutor.'); return }
    if (!fPeriod)     { setFormError('Isi periode.'); return }
    if (fSessionsDone <= 0) { setFormError('Jumlah sesi harus lebih dari 0.'); return }

    setSaving(true); setFormError('')

    const { error } = await supabase.from('tutor_payments').insert({
      tutor_id:        fTutorId,
      class_group_id:  fClassGroupId || null,
      period_label:    fPeriod,
      sessions_done:   fSessionsDone,
      students_count:  isPerStudent ? fStudents : 1,
      class_type:      classType || 'Privat',
      rate_per_session: fRate,
      subtotal,
      bonus:           fBonus,
      total,
      notes:           fBonusNote || fNotes || null,
      status:          'unpaid',
    })

    if (error) { setFormError(error.message); setSaving(false); return }
    setSaving(false); setShowModal(false); fetchAll()
  }

  async function markPaid(id: string) {
    await supabase.from('tutor_payments')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', id)
    fetchAll()
  }

  // Hitung sesi selesai otomatis dari DB
  async function autoFillSessions() {
    if (!fClassGroupId || !fPeriod) return
    const { data } = await supabase
      .from('sessions')
      .select('id')
      .eq('class_group_id', fClassGroupId)
      .eq('status', 'completed')
    setFSessionsDone(data?.length ?? 0)
  }

  const filtered = payments.filter(p => {
    const matchSearch = p.tutor_name.toLowerCase().includes(search.toLowerCase()) ||
      p.class_label.toLowerCase().includes(search.toLowerCase()) ||
      (p.period_label ?? '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || p.status === filterStatus
    return matchSearch && matchStatus
  })

  const totalBelumBayar = payments.filter(p => p.status === 'unpaid').reduce((a, p) => a + p.total, 0)
  const totalSudahBayar = payments.filter(p => p.status === 'paid').reduce((a, p) => a + p.total, 0)

  const inputCls = "w-full px-3.5 py-2.5 border border-[#E5E3FF] rounded-xl text-sm bg-[#F7F6FF] text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] focus:bg-white transition"

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-[#1A1640]" style={{fontFamily:'Sora,sans-serif'}}>Honor Tutor</h1>
          <p className="text-sm text-[#7B78A8] mt-0.5">Kelola dan catat pembayaran honor tutor</p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#5C4FE5] text-white text-sm font-semibold rounded-xl hover:bg-[#3D34C4] transition active:scale-95">
          <Plus size={15}/> Buat Tagihan Honor
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-[#E5E3FF] p-4">
          <p className="text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1">Belum Dibayar</p>
          <p className="text-xl font-black text-[#DC2626]">{formatRp(totalBelumBayar)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-[#E5E3FF] p-4">
          <p className="text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1">Sudah Dibayar</p>
          <p className="text-xl font-black text-[#27A05A]">{formatRp(totalSudahBayar)}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7B78A8]"/>
          <input type="text" placeholder="Cari nama tutor, kelas, atau periode..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-[#E5E3FF] rounded-xl bg-white text-[#1A1640] placeholder:text-[#7B78A8] focus:outline-none focus:border-[#5C4FE5] transition"/>
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-3.5 py-2.5 text-sm border border-[#E5E3FF] rounded-xl bg-white text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] transition">
          <option value="all">Semua Status</option>
          <option value="unpaid">Belum Dibayar</option>
          <option value="paid">Sudah Dibayar</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#E5E3FF] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr style={{backgroundColor:'#F7F6FF'}}>
              <th className="text-left px-5 py-3.5 text-xs font-bold text-[#7B78A8] uppercase tracking-wider">Tutor</th>
              <th className="text-left px-5 py-3.5 text-xs font-bold text-[#7B78A8] uppercase tracking-wider hidden md:table-cell">Kelas</th>
              <th className="text-left px-5 py-3.5 text-xs font-bold text-[#7B78A8] uppercase tracking-wider hidden lg:table-cell">Periode</th>
              <th className="text-left px-5 py-3.5 text-xs font-bold text-[#7B78A8] uppercase tracking-wider hidden lg:table-cell">Rincian</th>
              <th className="text-left px-5 py-3.5 text-xs font-bold text-[#7B78A8] uppercase tracking-wider">Total</th>
              <th className="text-left px-5 py-3.5 text-xs font-bold text-[#7B78A8] uppercase tracking-wider">Status</th>
              <th className="text-right px-5 py-3.5 text-xs font-bold text-[#7B78A8] uppercase tracking-wider">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E3FF]">
            {loading ? (
              Array.from({length:3}).map((_,i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-5 py-4"><div className="h-4 w-28 bg-gray-200 rounded"/></td>
                  <td className="px-5 py-4 hidden md:table-cell"><div className="h-4 w-32 bg-gray-200 rounded"/></td>
                  <td className="px-5 py-4 hidden lg:table-cell"><div className="h-4 w-20 bg-gray-200 rounded"/></td>
                  <td className="px-5 py-4 hidden lg:table-cell"><div className="h-4 w-24 bg-gray-200 rounded"/></td>
                  <td className="px-5 py-4"><div className="h-4 w-20 bg-gray-200 rounded"/></td>
                  <td className="px-5 py-4"><div className="h-4 w-20 bg-gray-200 rounded"/></td>
                  <td className="px-5 py-4"><div className="h-4 w-16 bg-gray-200 rounded ml-auto"/></td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-16 text-center">
                  <div className="text-3xl mb-3">💰</div>
                  <p className="text-sm font-semibold text-[#7B78A8]">
                    {search || filterStatus !== 'all' ? 'Tidak ada data yang sesuai' : 'Belum ada tagihan honor'}
                  </p>
                  {!search && filterStatus === 'all' && (
                    <button onClick={openAdd} className="mt-3 text-sm text-[#5C4FE5] font-semibold hover:underline">
                      + Buat tagihan pertama
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              filtered.map(p => {
                const st = STATUS_MAP[p.status] ?? { label: p.status, cls: 'bg-gray-100 text-gray-600' }
                const isPerSiswa = p.class_type === 'Semi Privat' || p.class_type === 'Reguler'
                return (
                  <tr key={p.id} className="hover:bg-[#F7F6FF] transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-[#1A1640]">{p.tutor_name}</div>
                      <div className="text-xs text-[#7B78A8] mt-0.5">{p.class_type}</div>
                    </td>
                    <td className="px-5 py-4 hidden md:table-cell">
                      <div className="text-[#1A1640] truncate max-w-[160px]">{p.class_label}</div>
                    </td>
                    <td className="px-5 py-4 hidden lg:table-cell text-[#7B78A8]">{p.period_label ?? '—'}</td>
                    <td className="px-5 py-4 hidden lg:table-cell">
                      <div className="text-xs text-[#7B78A8]">
                        {p.sessions_done} sesi × {formatRp(p.rate_per_session)}
                        {isPerSiswa && ` × ${p.students_count} siswa`}
                      </div>
                      {p.bonus > 0 && (
                        <div className="text-xs text-[#5C4FE5] font-semibold">+ Bonus {formatRp(p.bonus)}</div>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-bold text-[#1A1640]">{formatRp(p.total)}</div>
                      {p.paid_at && <div className="text-xs text-[#7B78A8]">{fmtDate(p.paid_at)}</div>}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${st.cls}`}>{st.label}</span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      {p.status === 'unpaid' && (
                        <button onClick={() => markPaid(p.id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#E6F4EC] text-[#1A5C36] hover:bg-[#C6E8D4] transition ml-auto">
                          <Check size={12}/> Tandai Dibayar
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Buat Tagihan */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E3FF] sticky top-0 bg-white z-10">
              <h2 className="text-base font-bold text-[#1A1640]">Buat Tagihan Honor</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-[#F7F6FF] text-[#7B78A8]"><X size={16}/></button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Tutor */}
              <div>
                <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">Tutor <span className="text-red-500">*</span></label>
                <select value={fTutorId} onChange={e => { setFTutorId(e.target.value); setFClassGroupId('') }} className={inputCls}>
                  <option value="">-- Pilih Tutor --</option>
                  {tutors.map(t => (
                    <option key={t.id} value={t.id}>{t.name}{t.is_owner ? ' (Pemilik)' : ''}</option>
                  ))}
                </select>
              </div>

              {/* Kelas */}
              {fTutorId && (
                <div>
                  <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">Kelas <span className="normal-case font-normal text-[#7B78A8]">(opsional)</span></label>
                  <select value={fClassGroupId} onChange={e => setFClassGroupId(e.target.value)} className={inputCls}>
                    <option value="">-- Pilih Kelas --</option>
                    {tutorClasses.map(c => (
                      <option key={c.id} value={c.id}>{c.label} ({c.class_type_name})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Periode */}
              <div>
                <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">Periode <span className="text-red-500">*</span></label>
                <input type="text" placeholder="Contoh: April 2026" value={fPeriod}
                  onChange={e => setFPeriod(e.target.value)} className={inputCls}/>
              </div>

              {/* Rincian Honor */}
              <div className="bg-[#F7F6FF] border border-[#E5E3FF] rounded-xl p-4 space-y-3">
                <p className="text-xs font-bold text-[#7B78A8] uppercase tracking-wide">Rincian Honor</p>

                {/* Jumlah Sesi */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-[#7B78A8] uppercase tracking-wide">Sesi Selesai</label>
                    {fClassGroupId && (
                      <button type="button" onClick={autoFillSessions}
                        className="text-xs text-[#5C4FE5] font-semibold hover:underline">
                        Hitung otomatis
                      </button>
                    )}
                  </div>
                  <input type="number" min={0} value={fSessionsDone}
                    onChange={e => setFSessionsDone(Number(e.target.value))} className={inputCls}/>
                </div>

                {/* Rate per sesi */}
                <div>
                  <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">
                    Rate per Sesi
                    {classType && <span className="ml-1 normal-case font-normal text-[#7B78A8]">(otomatis dari tipe kelas)</span>}
                  </label>
                  <input type="number" min={0} value={fRate}
                    onChange={e => setFRate(Number(e.target.value))} className={inputCls}/>
                  <p className="text-xs text-[#7B78A8] mt-1">
                    Privat: 50.000 · Semi Privat: 30.000×siswa · Reguler: 15.000×siswa
                  </p>
                </div>

                {/* Jumlah siswa (untuk semi privat & reguler) */}
                {isPerStudent && (
                  <div>
                    <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">Jumlah Siswa Aktif</label>
                    <input type="number" min={1} value={fStudents}
                      onChange={e => setFStudents(Number(e.target.value))} className={inputCls}/>
                  </div>
                )}

                {/* Preview subtotal */}
                <div className="flex items-center justify-between py-2 border-t border-[#E5E3FF]">
                  <span className="text-xs text-[#7B78A8]">
                    {fSessionsDone} sesi × {formatRp(fRate)}{isPerStudent ? ` × ${fStudents} siswa` : ''}
                  </span>
                  <span className="text-sm font-bold text-[#1A1640]">{formatRp(subtotal)}</span>
                </div>
              </div>

              {/* Bonus */}
              <div>
                <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">
                  Bonus <span className="normal-case font-normal text-[#7B78A8]">(opsional)</span>
                </label>
                <input type="number" min={0} value={fBonus} placeholder="0"
                  onChange={e => setFBonus(Number(e.target.value))} className={inputCls}/>
                {fBonus > 0 && (
                  <input type="text" value={fBonusNote} onChange={e => setFBonusNote(e.target.value)}
                    placeholder="Alasan bonus (prestasi, lebaran, dll)" className={`${inputCls} mt-2`}/>
                )}
              </div>

              {/* Total */}
              <div className="flex items-center justify-between px-4 py-3 bg-[#EEEDFE] rounded-xl">
                <span className="text-sm font-bold text-[#3C3489]">Total Honor</span>
                <span className="text-lg font-black text-[#5C4FE5]">{formatRp(total)}</span>
              </div>

              {/* Catatan */}
              <div>
                <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">
                  Catatan <span className="normal-case font-normal text-[#7B78A8]">(opsional)</span>
                </label>
                <input type="text" value={fNotes} onChange={e => setFNotes(e.target.value)}
                  placeholder="Catatan tambahan..." className={inputCls}/>
              </div>

              {/* Info pemilik */}
              {selectedTutor?.is_owner && (
                <div className="px-4 py-3 bg-[#FEF3E2] border border-[#FCD34D] rounded-xl">
                  <p className="text-xs font-semibold text-[#92400E]">
                    💡 Tutor ini adalah pemilik — honor akan dicatat sebagai keuntungan pemilik, bukan pengeluaran operasional.
                  </p>
                </div>
              )}

              {formError && (
                <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 font-semibold">{formError}</div>
              )}
            </div>

            <div className="px-6 pb-5 flex gap-3 sticky bottom-0 bg-white border-t border-[#E5E3FF] pt-4">
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-3 bg-[#5C4FE5] hover:bg-[#3D34C4] text-white font-bold rounded-xl text-sm transition disabled:opacity-60">
                {saving ? 'Menyimpan...' : 'Buat Tagihan Honor'}
              </button>
              <button onClick={() => setShowModal(false)}
                className="px-5 py-3 border border-[#E5E3FF] text-[#4A4580] font-bold rounded-xl text-sm hover:bg-[#F0EFFF] transition">
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
