'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, X, Check, Search, MessageCircle, Eye } from 'lucide-react'

type Payment = {
  id: string
  student_id: string
  enrollment_id: string
  amount: number
  base_amount: number
  registration_fee: number
  discount_amount: number
  discount_note: string | null
  method: string
  status: string
  period_label: string | null
  reference_note: string | null
  is_new_student: boolean
  wa_phone: string | null
  confirmed_at: string | null
  created_at: string
  student_name: string
  class_label: string
  class_type: string
}

type StudentOption = {
  id: string
  name: string
  enrollments: {
    id: string
    class_label: string
    class_type: string
    class_type_id: string
    base_price: number
    has_paid_registration: boolean
  }[]
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  unpaid:  { label: 'Belum Bayar',        cls: 'bg-[#FEE9E9] text-[#991B1B]' },
  pending: { label: 'Menunggu Konfirmasi', cls: 'bg-[#FEF3E2] text-[#92400E]' },
  paid:    { label: 'Lunas',              cls: 'bg-[#E6F4EC] text-[#1A5C36]' },
  overdue: { label: 'Terlambat',          cls: 'bg-[#FEE9E9] text-[#7F1D1D]' },
}

const REGISTRATION_FEE_DEFAULT = 100000

function formatRp(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

function PembayaranContent() {
  const supabase     = createClient()
  const searchParams = useSearchParams()

  const [payments,     setPayments]     = useState<Payment[]>([])
  const [students,     setStudents]     = useState<StudentOption[]>([])
  const [loading,      setLoading]      = useState(true)
  const [showModal,    setShowModal]    = useState(false)
  const [showDetail,   setShowDetail]   = useState<Payment | null>(null)
  const [saving,       setSaving]       = useState(false)
  const [formError,    setFormError]    = useState('')
  const [search,       setSearch]       = useState('')
  const [filterStatus, setFilterStatus] = useState('all')

  const [fStudentId,    setFStudentId]    = useState('')
  const [fEnrollmentId, setFEnrollmentId] = useState('')
  const [fBaseAmount,   setFBaseAmount]   = useState(0)
  const [fRegFee,       setFRegFee]       = useState(0)
  const [fIsNewStudent, setFIsNewStudent] = useState(false)
  const [fDiscount,     setFDiscount]     = useState(0)
  const [fDiscountNote, setFDiscountNote] = useState('')
  const [fMethod,       setFMethod]       = useState('transfer')
  const [fPeriodLabel,  setFPeriodLabel]  = useState('')
  const [fWaPhone,      setFWaPhone]      = useState('')
  const [fStatus,       setFStatus]       = useState('unpaid')

  const totalAmount     = fBaseAmount + fRegFee - fDiscount
  const selectedStudent = students.find(s => s.id === fStudentId)

  useEffect(() => { fetchAll() }, [])

  // Auto-open modal jika ?new=1 dan students sudah loaded
  useEffect(() => {
    if (searchParams.get('new') === '1' && students.length > 0) {
      openAdd()
    }
  }, [students])

  async function fetchAll() {
    setLoading(true)

    const { data: pays } = await supabase
      .from('payments')
      .select('id, student_id, enrollment_id, amount, base_amount, registration_fee, discount_amount, discount_note, method, status, period_label, reference_note, is_new_student, wa_phone, confirmed_at, created_at')
      .order('created_at', { ascending: false })

    if (pays && pays.length > 0) {
      const sIds = [...new Set(pays.map((p: any) => p.student_id))]
      const { data: studs } = await supabase.from('students').select('id, profile_id').in('id', sIds)
      const profIds = (studs ?? []).map((s: any) => s.profile_id).filter(Boolean)
      let nameMap: Record<string, string> = {}
      if (profIds.length > 0) {
        const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', profIds)
        const profMap = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.full_name]))
        nameMap = Object.fromEntries((studs ?? []).map((s: any) => [s.id, profMap[s.profile_id] ?? 'Siswa']))
      }

      const eIds = [...new Set(pays.map((p: any) => p.enrollment_id).filter(Boolean))]
      let classMap: Record<string, { label: string; type: string }> = {}
      if (eIds.length > 0) {
        const { data: enrs } = await supabase.from('enrollments').select('id, class_group_id').in('id', eIds)
        const cgIds = (enrs ?? []).map((e: any) => e.class_group_id).filter(Boolean)
        if (cgIds.length > 0) {
          const { data: cgs } = await supabase.from('class_groups').select('id, label, class_types(name)').in('id', cgIds)
          const cgMap = Object.fromEntries((cgs ?? []).map((c: any) => [c.id, { label: c.label, type: c.class_types?.name ?? '—' }]))
          classMap = Object.fromEntries((enrs ?? []).map((e: any) => [e.id, cgMap[e.class_group_id] ?? { label: '—', type: '—' }]))
        }
      }

      setPayments(pays.map((p: any) => ({
        ...p,
        student_name: nameMap[p.student_id] ?? 'Siswa',
        class_label:  classMap[p.enrollment_id]?.label ?? '—',
        class_type:   classMap[p.enrollment_id]?.type ?? '—',
      })))
    } else {
      setPayments([])
    }

    // Fetch students for form
    const { data: studs } = await supabase.from('students').select('id, profile_id')
    if (studs && studs.length > 0) {
      const profIds = studs.map((s: any) => s.profile_id).filter(Boolean)
      const { data: profs } = await supabase.from('profiles').select('id, full_name, phone').in('id', profIds)
      const profMap = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p]))

      const sIds = studs.map((s: any) => s.id)
      const { data: enrs } = await supabase.from('enrollments').select('id, student_id, class_group_id, status').in('student_id', sIds).eq('status', 'active')

      const cgIds = (enrs ?? []).map((e: any) => e.class_group_id).filter(Boolean)
      let cgMap: Record<string, any> = {}
      if (cgIds.length > 0) {
        const { data: cgs } = await supabase.from('class_groups').select('id, label, class_type_id, class_types(name, base_price)').in('id', cgIds)
        cgMap = Object.fromEntries((cgs ?? []).map((c: any) => [c.id, c]))
      }

      const { data: existingPays } = await supabase.from('payments').select('student_id').eq('is_new_student', true)
      const paidStudentIds = new Set((existingPays ?? []).map((p: any) => p.student_id))

      const studentOptions: StudentOption[] = studs.map((s: any) => {
        const prof = profMap[s.profile_id]
        const studentEnrolls = (enrs ?? [])
          .filter((e: any) => e.student_id === s.id)
          .map((e: any) => {
            const cg = cgMap[e.class_group_id]
            return {
              id:                    e.id,
              class_label:           cg?.label ?? '—',
              class_type:            cg?.class_types?.name ?? '—',
              class_type_id:         cg?.class_type_id ?? '',
              base_price:            cg?.class_types?.base_price ?? 0,
              has_paid_registration: paidStudentIds.has(s.id),
            }
          })
        return { id: s.id, name: prof?.full_name ?? 'Siswa', enrollments: studentEnrolls }
      })
      setStudents(studentOptions)
    }

    setLoading(false)
  }

  function openAdd() {
    setFStudentId(''); setFEnrollmentId(''); setFBaseAmount(0)
    setFRegFee(0); setFIsNewStudent(false); setFDiscount(0)
    setFDiscountNote(''); setFMethod('transfer'); setFPeriodLabel('')
    setFWaPhone(''); setFStatus('unpaid'); setFormError('')
    setShowModal(true)
  }

  function handleStudentChange(id: string) {
    setFStudentId(id); setFEnrollmentId(''); setFBaseAmount(0); setFRegFee(0); setFIsNewStudent(false)
  }

  function handleEnrollmentChange(eid: string) {
    setFEnrollmentId(eid)
    const enr = selectedStudent?.enrollments.find(e => e.id === eid)
    if (enr) {
      setFBaseAmount(enr.base_price)
      const isNew = !enr.has_paid_registration
      setFIsNewStudent(isNew)
      setFRegFee(isNew ? REGISTRATION_FEE_DEFAULT : 0)
    }
  }

  async function handleSave() {
    if (!fStudentId)    { setFormError('Pilih siswa.'); return }
    if (!fEnrollmentId) { setFormError('Pilih kelas.'); return }
    if (!fPeriodLabel)  { setFormError('Isi periode pembayaran.'); return }
    if (totalAmount <= 0) { setFormError('Total tagihan tidak valid.'); return }
    setSaving(true); setFormError('')

    const { error } = await supabase.from('payments').insert({
      student_id: fStudentId, enrollment_id: fEnrollmentId,
      amount: totalAmount, base_amount: fBaseAmount,
      registration_fee: fRegFee, discount_amount: fDiscount,
      discount_note: fDiscountNote || null, method: fMethod,
      status: fStatus, period_label: fPeriodLabel,
      is_new_student: fIsNewStudent, wa_phone: fWaPhone || null,
    })

    if (error) { setFormError(error.message); setSaving(false); return }
    setSaving(false); setShowModal(false); fetchAll()
  }

  async function handleConfirm(payment: Payment) {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('payments').update({
      status: 'paid', confirmed_by: user?.id ?? null,
      confirmed_at: new Date().toISOString(), paid_at: new Date().toISOString(),
    }).eq('id', payment.id)
    fetchAll()
  }

  function buildWaMessage(p: Payment) {
    const msg = `Halo ${p.student_name}, pembayaran Anda untuk kelas *${p.class_label}* periode *${p.period_label}* sebesar *${formatRp(p.amount)}* telah kami terima dan dikonfirmasi. Terima kasih! 🎉`
    return `https://wa.me/${p.wa_phone?.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`
  }

  const filtered = payments.filter(p => {
    const matchSearch = p.student_name.toLowerCase().includes(search.toLowerCase()) ||
      p.class_label.toLowerCase().includes(search.toLowerCase()) ||
      (p.period_label ?? '').toLowerCase().includes(search.toLowerCase())
    return matchSearch && (filterStatus === 'all' || p.status === filterStatus)
  })

  const totalLunas   = payments.filter(p => p.status === 'paid').reduce((a, p) => a + p.amount, 0)
  const totalPending = payments.filter(p => p.status === 'pending').length
  const totalUnpaid  = payments.filter(p => p.status === 'unpaid').length

  const inputCls = "w-full px-3.5 py-2.5 border border-[#E5E3FF] rounded-xl text-sm bg-[#F7F6FF] text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] focus:bg-white transition"

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-[#1A1640]" style={{fontFamily:'Sora,sans-serif'}}>Pembayaran</h1>
          <p className="text-sm text-[#7B78A8] mt-0.5">Kelola tagihan dan konfirmasi pembayaran siswa</p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#5C4FE5] text-white text-sm font-semibold rounded-xl hover:bg-[#3D34C4] transition active:scale-95">
          <Plus size={15}/> Buat Tagihan
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-[#E5E3FF] p-4">
          <p className="text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1">Total Lunas</p>
          <p className="text-xl font-black text-[#1A1640]">{formatRp(totalLunas)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-[#E5E3FF] p-4">
          <p className="text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1">Menunggu Konfirmasi</p>
          <p className="text-xl font-black text-[#D97706]">{totalPending} tagihan</p>
        </div>
        <div className="bg-white rounded-2xl border border-[#E5E3FF] p-4">
          <p className="text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1">Belum Bayar</p>
          <p className="text-xl font-black text-[#DC2626]">{totalUnpaid} tagihan</p>
        </div>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7B78A8]"/>
          <input type="text" placeholder="Cari nama siswa, kelas, atau periode..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-[#E5E3FF] rounded-xl bg-white text-[#1A1640] placeholder:text-[#7B78A8] focus:outline-none focus:border-[#5C4FE5] transition"/>
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-3.5 py-2.5 text-sm border border-[#E5E3FF] rounded-xl bg-white text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] transition">
          <option value="all">Semua Status</option>
          <option value="unpaid">Belum Bayar</option>
          <option value="pending">Menunggu Konfirmasi</option>
          <option value="paid">Lunas</option>
          <option value="overdue">Terlambat</option>
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-[#E5E3FF] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr style={{backgroundColor:'#F7F6FF'}}>
              <th className="text-left px-5 py-3.5 text-xs font-bold text-[#7B78A8] uppercase tracking-wider">Siswa</th>
              <th className="text-left px-5 py-3.5 text-xs font-bold text-[#7B78A8] uppercase tracking-wider hidden md:table-cell">Kelas</th>
              <th className="text-left px-5 py-3.5 text-xs font-bold text-[#7B78A8] uppercase tracking-wider hidden lg:table-cell">Periode</th>
              <th className="text-left px-5 py-3.5 text-xs font-bold text-[#7B78A8] uppercase tracking-wider">Total</th>
              <th className="text-left px-5 py-3.5 text-xs font-bold text-[#7B78A8] uppercase tracking-wider">Status</th>
              <th className="text-right px-5 py-3.5 text-xs font-bold text-[#7B78A8] uppercase tracking-wider">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E3FF]">
            {loading ? (
              Array.from({length:4}).map((_,i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-5 py-4"><div className="h-4 w-32 bg-gray-200 rounded"/></td>
                  <td className="px-5 py-4 hidden md:table-cell"><div className="h-4 w-28 bg-gray-200 rounded"/></td>
                  <td className="px-5 py-4 hidden lg:table-cell"><div className="h-4 w-20 bg-gray-200 rounded"/></td>
                  <td className="px-5 py-4"><div className="h-4 w-24 bg-gray-200 rounded"/></td>
                  <td className="px-5 py-4"><div className="h-4 w-20 bg-gray-200 rounded"/></td>
                  <td className="px-5 py-4"><div className="h-4 w-16 bg-gray-200 rounded ml-auto"/></td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-16 text-center">
                  <div className="text-3xl mb-3">💳</div>
                  <p className="text-sm font-semibold text-[#7B78A8]">
                    {search || filterStatus !== 'all' ? 'Tidak ada tagihan yang sesuai' : 'Belum ada tagihan'}
                  </p>
                  {!search && filterStatus === 'all' && (
                    <button onClick={openAdd} className="mt-3 text-sm text-[#5C4FE5] font-semibold hover:underline">+ Buat tagihan pertama</button>
                  )}
                </td>
              </tr>
            ) : (
              filtered.map(p => {
                const st = STATUS_MAP[p.status] ?? { label: p.status, cls: 'bg-gray-100 text-gray-600' }
                return (
                  <tr key={p.id} className="hover:bg-[#F7F6FF] transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-[#1A1640]">{p.student_name}</div>
                      <div className="text-xs text-[#7B78A8] mt-0.5">{fmtDate(p.created_at)}</div>
                    </td>
                    <td className="px-5 py-4 hidden md:table-cell">
                      <div className="text-[#1A1640] truncate max-w-[160px]">{p.class_label}</div>
                      <div className="text-xs text-[#7B78A8]">{p.class_type}</div>
                    </td>
                    <td className="px-5 py-4 hidden lg:table-cell text-[#7B78A8]">{p.period_label ?? '—'}</td>
                    <td className="px-5 py-4">
                      <div className="font-bold text-[#1A1640]">{formatRp(p.amount)}</div>
                      {p.is_new_student && <div className="text-[10px] text-[#5C4FE5] font-semibold mt-0.5">+ Biaya Daftar</div>}
                      {p.discount_amount > 0 && <div className="text-[10px] text-green-600 font-semibold">- Diskon {formatRp(p.discount_amount)}</div>}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${st.cls}`}>{st.label}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setShowDetail(p)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-[#5C4FE5] hover:bg-[#F0EEFF] transition" title="Detail">
                          <Eye size={14}/>
                        </button>
                        {p.status === 'pending' && (
                          <button onClick={() => handleConfirm(p)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#E6F4EC] text-[#1A5C36] hover:bg-[#C6E8D4] transition">
                            <Check size={12}/> Konfirmasi
                          </button>
                        )}
                        {p.status === 'unpaid' && (
                          <button onClick={async () => { await supabase.from('payments').update({status:'pending'}).eq('id',p.id); fetchAll() }}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#FEF3E2] text-[#92400E] hover:bg-[#FDE9BF] transition">
                            Sudah Bayar
                          </button>
                        )}
                        {p.status === 'paid' && p.wa_phone && (
                          <a href={buildWaMessage(p)} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-green-50 text-green-700 hover:bg-green-100 transition">
                            <MessageCircle size={12}/> WA
                          </a>
                        )}
                      </div>
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
              <h2 className="text-base font-bold text-[#1A1640]">Buat Tagihan Baru</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-[#F7F6FF] text-[#7B78A8]"><X size={16}/></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">Siswa <span className="text-red-500">*</span></label>
                <select value={fStudentId} onChange={e => handleStudentChange(e.target.value)} className={inputCls}>
                  <option value="">-- Pilih Siswa --</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              {fStudentId && (
                <div>
                  <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">Kelas <span className="text-red-500">*</span></label>
                  <select value={fEnrollmentId} onChange={e => handleEnrollmentChange(e.target.value)} className={inputCls}>
                    <option value="">-- Pilih Kelas --</option>
                    {selectedStudent?.enrollments.map(e => (
                      <option key={e.id} value={e.id}>{e.class_label} ({e.class_type})</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">Periode <span className="text-red-500">*</span></label>
                <input type="text" placeholder="Contoh: April 2026" value={fPeriodLabel}
                  onChange={e => setFPeriodLabel(e.target.value)} className={inputCls}/>
              </div>
              {fEnrollmentId && (
                <div className="bg-[#F7F6FF] border border-[#E5E3FF] rounded-xl p-4 space-y-3">
                  <p className="text-xs font-bold text-[#7B78A8] uppercase tracking-wide">Rincian Biaya</p>
                  <div>
                    <label className="block text-xs font-semibold text-[#7B78A8] mb-1">Biaya Paket</label>
                    <input type="number" value={fBaseAmount} onChange={e => setFBaseAmount(Number(e.target.value))} className={inputCls}/>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-[#7B78A8]">Biaya Pendaftaran</label>
                      <label className="flex items-center gap-1.5 text-xs text-[#7B78A8] cursor-pointer">
                        <input type="checkbox" checked={fIsNewStudent}
                          onChange={e => { setFIsNewStudent(e.target.checked); setFRegFee(e.target.checked ? REGISTRATION_FEE_DEFAULT : 0) }}
                          className="accent-[#5C4FE5]"/>
                        Siswa Baru
                      </label>
                    </div>
                    <input type="number" value={fRegFee} onChange={e => setFRegFee(Number(e.target.value))}
                      disabled={!fIsNewStudent} className={`${inputCls} ${!fIsNewStudent ? 'opacity-50 cursor-not-allowed' : ''}`}/>
                    {fIsNewStudent && <p className="text-xs text-[#5C4FE5] mt-1 font-semibold">Biaya pendaftaran sekali seumur hidup</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#7B78A8] mb-1">Diskon <span className="font-normal">(opsional)</span></label>
                    <input type="number" value={fDiscount} onChange={e => setFDiscount(Number(e.target.value))} placeholder="0" className={inputCls}/>
                    {fDiscount > 0 && (
                      <input type="text" value={fDiscountNote} onChange={e => setFDiscountNote(e.target.value)}
                        placeholder="Alasan diskon" className={`${inputCls} mt-2`}/>
                    )}
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-[#E5E3FF]">
                    <span className="text-sm font-bold text-[#1A1640]">Total Tagihan</span>
                    <span className="text-lg font-black text-[#5C4FE5]">{formatRp(totalAmount)}</span>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">Metode</label>
                  <select value={fMethod} onChange={e => setFMethod(e.target.value)} className={inputCls}>
                    <option value="transfer">Transfer Bank</option>
                    <option value="cash">Tunai</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">Status Awal</label>
                  <select value={fStatus} onChange={e => setFStatus(e.target.value)} className={inputCls}>
                    <option value="unpaid">Belum Bayar</option>
                    <option value="pending">Menunggu Konfirmasi</option>
                    <option value="paid">Lunas</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">
                  No. WhatsApp <span className="normal-case font-normal text-[#7B78A8]">(untuk notifikasi)</span>
                </label>
                <input type="text" placeholder="628xxxxxxxxxx" value={fWaPhone}
                  onChange={e => setFWaPhone(e.target.value)} className={inputCls}/>
              </div>
              {formError && <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 font-semibold">{formError}</div>}
            </div>
            <div className="px-6 pb-5 flex gap-3 sticky bottom-0 bg-white border-t border-[#E5E3FF] pt-4">
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-3 bg-[#5C4FE5] hover:bg-[#3D34C4] text-white font-bold rounded-xl text-sm transition disabled:opacity-60">
                {saving ? 'Menyimpan...' : 'Buat Tagihan'}
              </button>
              <button onClick={() => setShowModal(false)}
                className="px-5 py-3 border border-[#E5E3FF] text-[#4A4580] font-bold rounded-xl text-sm hover:bg-[#F0EFFF] transition">Batal</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detail */}
      {showDetail && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-[#1A1640]">Detail Tagihan</h2>
              <button onClick={() => setShowDetail(null)} className="p-1.5 rounded-lg hover:bg-[#F7F6FF] text-[#7B78A8]"><X size={16}/></button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-[#7B78A8]">Siswa</span><span className="font-semibold text-[#1A1640]">{showDetail.student_name}</span></div>
              <div className="flex justify-between"><span className="text-[#7B78A8]">Kelas</span><span className="font-semibold text-[#1A1640] text-right max-w-[180px]">{showDetail.class_label}</span></div>
              <div className="flex justify-between"><span className="text-[#7B78A8]">Periode</span><span className="font-semibold text-[#1A1640]">{showDetail.period_label ?? '—'}</span></div>
              <div className="flex justify-between"><span className="text-[#7B78A8]">Metode</span><span className="font-semibold text-[#1A1640] capitalize">{showDetail.method}</span></div>
              <div className="border-t border-[#E5E3FF] pt-3 space-y-2">
                <div className="flex justify-between"><span className="text-[#7B78A8]">Biaya Paket</span><span>{formatRp(showDetail.base_amount)}</span></div>
                {showDetail.registration_fee > 0 && <div className="flex justify-between"><span className="text-[#7B78A8]">Biaya Daftar</span><span>{formatRp(showDetail.registration_fee)}</span></div>}
                {showDetail.discount_amount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Diskon {showDetail.discount_note ? `(${showDetail.discount_note})` : ''}</span>
                    <span>- {formatRp(showDetail.discount_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-[#1A1640] text-base pt-1 border-t border-[#E5E3FF]">
                  <span>Total</span><span>{formatRp(showDetail.amount)}</span>
                </div>
              </div>
              {showDetail.confirmed_at && (
                <div className="flex justify-between text-xs text-[#7B78A8]">
                  <span>Dikonfirmasi</span><span>{fmtDate(showDetail.confirmed_at)}</span>
                </div>
              )}
            </div>
            {showDetail.status === 'paid' && showDetail.wa_phone && (
              <a href={buildWaMessage(showDetail)} target="_blank" rel="noopener noreferrer"
                className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl text-sm transition">
                <MessageCircle size={15}/> Kirim Notifikasi WA
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function PembayaranPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-[#7B78A8]">Memuat pembayaran...</div>}>
      <PembayaranContent />
    </Suspense>
  )
}
