'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Plus, Minus, ChevronRight, Check, Loader2 } from 'lucide-react'

type Package  = { id: string; name: string; total_sessions: number; price: number }
type Session  = { scheduled_at: string; status: string }
type Enrollment = { id: string; student_id: string; student_name: string; sessions_total: number; sessions_used: number }
type JadwalRow = { date: string; time: string; repeat: number }
type PreviewSession = { date: string; time: string; isoDate: string }

const MAX_ROWS   = 5
const MAX_REPEAT = 16

function generateSessions(rows: JadwalRow[]): PreviewSession[] {
  const sessions: PreviewSession[] = []
  rows.forEach(row => {
    Array.from({ length: row.repeat }, (_, i) => {
      const d = new Date(`${row.date}T${row.time}:00`)
      d.setDate(d.getDate() + i * 7)
      sessions.push({
        date: d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }),
        time: row.time,
        isoDate: d.toISOString(),
      })
    })
  })
  // FIX: sort by actual date (ISO), bukan string display yang kacau secara alfabet
  return sessions.sort((a, b) => new Date(a.isoDate).getTime() - new Date(b.isoDate).getTime())
}

function today() {
  return new Date().toISOString().split('T')[0]
}

function formatRp(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

type Props = {
  kelasId: string
  kelasLabel: string
  kelasZoomLink: string | null
  kelasClassTypeId: string
  enrollment: Enrollment
  onClose: () => void
  onSuccess: () => void
}

export default function PerpanjangModal({
  kelasId,
  kelasLabel,
  kelasZoomLink,
  kelasClassTypeId,
  enrollment,
  onClose,
  onSuccess,
}: Props) {
  const supabase = createClient()

  const [step, setStep]         = useState<'form' | 'preview'>('form')
  const [packages, setPackages] = useState<Package[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')

  const [kelasCourseId, setKelasCourseId] = useState<string | null>(null)

  const [packageId,     setPackageId]     = useState('')
  const [jumlahPaket,   setJumlahPaket]   = useState(1)
  const [sessionsTotal, setSessionsTotal] = useState('8')
  const [startOffset,   setStartOffset]   = useState('1')
  const [payment,       setPayment]       = useState('')
  const [paymentMethod, setPaymentMethod] = useState('transfer')
  const [zoomLink,      setZoomLink]      = useState('')
  const [jadwalMode,    setJadwalMode]    = useState<'auto' | 'manual'>('auto')
  const [jadwalRows,    setJadwalRows]    = useState<JadwalRow[]>([{ date: today(), time: '08:00', repeat: 1 }])
  const [previewSessions, setPreviewSessions] = useState<PreviewSession[]>([])

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)

    // Fetch course_id dari class_groups
    const { data: kelasData } = await supabase
      .from('class_groups')
      .select('course_id')
      .eq('id', kelasId)
      .single()

    const courseId = kelasData?.course_id ?? null
    setKelasCourseId(courseId)

    // Filter packages by course_id + class_type_id
    const pkgQuery = supabase
      .from('packages')
      .select('id, name, total_sessions, price')
      .eq('is_active', true)

    if (courseId)         pkgQuery.eq('course_id', courseId)
    if (kelasClassTypeId) pkgQuery.eq('class_type_id', kelasClassTypeId)

    const [pkgRes, sessRes] = await Promise.all([
      pkgQuery,
      supabase
        .from('sessions')
        .select('scheduled_at, status')
        .eq('class_group_id', kelasId)
        .order('scheduled_at', { ascending: true }),
    ])

    setPackages(pkgRes.data ?? [])
    setSessions(sessRes.data ?? [])

    if (sessRes.data && sessRes.data.length > 0) {
      detectAndSetAutoJadwal(sessRes.data)
    }

    setLoading(false)
  }

  function detectAndSetAutoJadwal(allSessions: Session[]) {
    const patternMap: Record<string, { time: string; count: number; lastDate: string }> = {}
    allSessions.forEach(s => {
      const d = new Date(s.scheduled_at)
      const key = `${d.getDay()}-${d.toTimeString().substring(0, 5)}`
      if (!patternMap[key]) patternMap[key] = { time: d.toTimeString().substring(0, 5), count: 0, lastDate: s.scheduled_at }
      patternMap[key].count++
      if (new Date(s.scheduled_at) > new Date(patternMap[key].lastDate)) patternMap[key].lastDate = s.scheduled_at
    })

    const lastDate = new Date(allSessions[allSessions.length - 1].scheduled_at)
    const rows: JadwalRow[] = Object.values(patternMap)
      .sort((a, b) => new Date(a.lastDate).getDay() - new Date(b.lastDate).getDay())
      .map(p => {
        const nextDate = new Date(p.lastDate)
        nextDate.setDate(nextDate.getDate() + 7)
        while (nextDate <= lastDate) nextDate.setDate(nextDate.getDate() + 7)
        return { date: nextDate.toISOString().split('T')[0], time: p.time, repeat: 1 }
      })

    if (rows.length > 0) setJadwalRows(rows)
  }

  function handlePackageChange(id: string, qty?: number) {
    const pkg = packages.find(p => p.id === id)
    const q   = qty ?? jumlahPaket
    setPackageId(id)
    if (pkg) {
      setSessionsTotal((pkg.total_sessions * q).toString())
      setPayment((pkg.price * q).toString())
    }
  }

  function handleJumlahPaketChange(q: number) {
    const qty = Math.max(1, Math.min(6, q)) // min 1, max 6 paket
    setJumlahPaket(qty)
    const pkg = packages.find(p => p.id === packageId)
    if (pkg) {
      setSessionsTotal((pkg.total_sessions * qty).toString())
      setPayment((pkg.price * qty).toString())
    }
  }

  function addRow() {
    const last = jadwalRows[jadwalRows.length - 1]
    const d = new Date(`${last.date}T${last.time}`)
    d.setDate(d.getDate() + 7)
    setJadwalRows(prev => [...prev, { date: d.toISOString().split('T')[0], time: last.time, repeat: 1 }])
  }

  function removeRow(idx: number) {
    setJadwalRows(prev => prev.filter((_, i) => i !== idx))
  }

  function updateRow(idx: number, field: keyof JadwalRow, value: string | number) {
    setJadwalRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r))
  }

  const totalJadwalSesi = jadwalRows.reduce((a, r) => a + r.repeat, 0)

  function handlePreview() {
    if (!packageId) { setError('Pilih paket terlebih dahulu'); return }
    setError('')
    const generated = jadwalMode === 'auto'
      ? generateSessions(jadwalRows.map(r => ({ ...r, repeat: Math.ceil(parseInt(sessionsTotal) / jadwalRows.length) })))
      : generateSessions(jadwalRows)
    setPreviewSessions(generated)
    setStep('preview')
  }

  async function handleSave() {
    setSaving(true); setError('')
    try {
      // 1. Set enrollment LAMA jadi 'renewed'
      const { error: renewErr } = await supabase
        .from('enrollments')
        .update({ status: 'renewed' })
        .eq('id', enrollment.id)
      if (renewErr) throw new Error(`Gagal update enrollment lama: ${renewErr.message}`)

      // 2. Insert enrollment BARU
      // FIX: pakai enrolled_at bukan start_date (tidak ada di schema)
      const { data: newEnrollment, error: enrErr } = await supabase
        .from('enrollments')
        .insert({
          student_id:           enrollment.student_id,
          class_group_id:       kelasId,
          package_id:           packageId,
          sessions_total:       parseInt(sessionsTotal),
          sessions_used:        0,
          session_start_offset: parseInt(startOffset),
          enrolled_at:          new Date().toISOString(),
          status:               'active',
        })
        .select('id')
        .single()

      if (enrErr) {
        // ROLLBACK: kembalikan enrollment lama ke active kalau step 2 gagal
        await supabase.from('enrollments').update({ status: 'active' }).eq('id', enrollment.id)
        throw new Error(`Gagal buat enrollment baru: ${enrErr.message}`)
      }

      // 3. Generate & insert sessions baru
      const rows = jadwalMode === 'auto'
        ? jadwalRows.map(r => ({ ...r, repeat: Math.ceil(parseInt(sessionsTotal) / jadwalRows.length) }))
        : jadwalRows

      const allSessions: any[] = []
      rows.forEach(row => {
        Array.from({ length: row.repeat }, (_, i) => {
          const d = new Date(`${row.date}T${row.time}:00`)
          d.setDate(d.getDate() + i * 7)
          allSessions.push({
            class_group_id: kelasId,
            scheduled_at:   d.toISOString(),
            status:         'scheduled',
            zoom_link:      zoomLink || null,
          })
        })
      })

      if (allSessions.length > 0) {
        const { error: sessErr } = await supabase.from('sessions').insert(allSessions)
        if (sessErr) throw new Error(`Gagal buat jadwal: ${sessErr.message}`)
      }

      // 4. Update zoom link kelas + pastikan status active
      const { error: cgErr } = await supabase
        .from('class_groups')
        .update({ zoom_link: zoomLink || null, status: 'active' })
        .eq('id', kelasId)
      if (cgErr) console.error('Warning: gagal update zoom link:', cgErr.message)

      // 5. Insert payment jika ada nominal
      if (payment && parseInt(payment) > 0 && newEnrollment?.id) {
        const now = new Date()
        const { error: payErr } = await supabase.from('payments').insert({
          student_id:     enrollment.student_id,
          enrollment_id:  newEnrollment.id,
          amount:         parseInt(payment),
          base_amount:    parseInt(payment),
          method:         paymentMethod,
          payment_method: 'manual',
          status:         'pending',
          period_label:   `Perpanjang - ${now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`,
          paid_at:        now.toISOString(),
        })
        if (payErr) console.error('Warning: gagal insert payment:', payErr.message)
      }

      // ✅ Success notification
      alert('✅ Kelas berhasil diperpanjang!')

      // Kirim WA ke ortu — fire and forget
      fetch('/api/wa/notify-perpanjang', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id:     enrollment.student_id,
          class_group_id: kelasId,
          sessions_total: parseInt(sessionsTotal),
        }),
      }).catch(() => {})

      onSuccess()
    } catch (err: any) {
      console.error('[PerpanjangModal] Error:', err)
      setError(err.message ?? 'Gagal memperpanjang. Silakan coba lagi.')
      setStep('form')
    }
    setSaving(false)
  }

  const inputCls = "w-full px-3 py-2.5 border border-[#E5E3FF] rounded-xl text-sm bg-[#F7F6FF] text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] focus:bg-white transition"
  const labelCls = "block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E3FF] sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-lg font-black text-[#1A1640]">
              {step === 'form' ? '🔄 Perpanjang Kelas' : '👁 Preview Jadwal'}
            </h2>
            <p className="text-xs text-[#7B78A8]">{kelasLabel} · {enrollment.student_name}</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg">
            <X size={18}/>
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#5C4FE5]"/>
          </div>
        ) : step === 'form' ? (
          <div className="p-6 space-y-5">

            {/* 1. PAKET */}
            <div>
              <label className={labelCls}>1. Paket *</label>
              {packages.length === 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  Tidak ada paket aktif untuk kelas ini. Tambahkan paket di menu Kursus & Paket.
                </div>
              ) : (
                <>
                  <select value={packageId} onChange={e => handlePackageChange(e.target.value)} className={inputCls}>
                    <option value="">Pilih paket...</option>
                    {packages.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {p.total_sessions} sesi — {formatRp(p.price)}
                      </option>
                    ))}
                  </select>

                  {/* Jumlah Paket — hanya tampil kalau paket sudah dipilih */}
                  {packageId && (() => {
                    const pkg = packages.find(p => p.id === packageId)!
                    return (
                      <div className="mt-3 bg-[#F7F6FF] border border-[#E5E3FF] rounded-xl p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-0.5">Jumlah Paket</p>
                            <p className="text-[10px] text-[#7B78A8]">Bayar lebih dari 1 paket sekaligus</p>
                          </div>
                          {/* Stepper */}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleJumlahPaketChange(jumlahPaket - 1)}
                              disabled={jumlahPaket <= 1}
                              className="w-8 h-8 rounded-lg bg-white border border-[#E5E3FF] text-[#5C4FE5] font-bold text-lg flex items-center justify-center hover:bg-[#F0EFFF] disabled:opacity-30 transition">
                              −
                            </button>
                            <span className="w-6 text-center font-black text-[#1A1640] text-sm">{jumlahPaket}</span>
                            <button
                              onClick={() => handleJumlahPaketChange(jumlahPaket + 1)}
                              disabled={jumlahPaket >= 6}
                              className="w-8 h-8 rounded-lg bg-white border border-[#E5E3FF] text-[#5C4FE5] font-bold text-lg flex items-center justify-center hover:bg-[#F0EFFF] disabled:opacity-30 transition">
                              +
                            </button>
                          </div>
                        </div>

                        {/* Kalkulasi total */}
                        {jumlahPaket > 1 && (
                          <div className="mt-2.5 pt-2.5 border-t border-[#E5E3FF] grid grid-cols-2 gap-2 text-xs">
                            <div className="bg-white rounded-lg p-2 text-center">
                              <p className="text-[#7B78A8]">Total Sesi</p>
                              <p className="font-black text-[#5C4FE5] text-sm">{pkg.total_sessions} × {jumlahPaket} = {pkg.total_sessions * jumlahPaket} sesi</p>
                            </div>
                            <div className="bg-white rounded-lg p-2 text-center">
                              <p className="text-[#7B78A8]">Total Bayar</p>
                              <p className="font-black text-[#5C4FE5] text-sm">{formatRp(pkg.price * jumlahPaket)}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </>
              )}
            </div>

            {/* 2. PEMBAYARAN */}
            <div>
              <label className={labelCls}>2. Pembayaran</label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#7B78A8] mb-1 block">Nominal (Rp)</label>
                  <input type="number" value={payment} onChange={e => setPayment(e.target.value)} placeholder="0" className={inputCls}/>
                  {/* Indikator peringatan kalau nominal berbeda dari harga paket */}
                  {(() => {
                    const pkg = packages.find(p => p.id === packageId)
                    if (!pkg || !payment) return null
                    const expectedTotal = pkg.price * jumlahPaket
                    const inputTotal = parseInt(payment) || 0
                    if (inputTotal === expectedTotal) return null
                    const isDibawah = inputTotal < expectedTotal
                    return (
                      <p className={`text-[10px] mt-1 font-semibold flex items-center gap-1 ${isDibawah ? 'text-amber-600' : 'text-blue-600'}`}>
                        {isDibawah ? '⚠️' : 'ℹ️'} Berbeda dari harga paket ({formatRp(expectedTotal)})
                        {isDibawah && ' — pastikan ini disengaja'}
                      </p>
                    )
                  })()}
                </div>
                <div>
                  <label className="text-xs text-[#7B78A8] mb-1 block">Metode</label>
                  <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className={inputCls}>
                    <option value="transfer">Transfer Bank</option>
                    <option value="tunai">Tunai</option>
                    <option value="qris">QRIS</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 3. PENGATURAN SESI */}
            <div>
              <label className={labelCls}>3. Pengaturan Sesi</label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#7B78A8] mb-1 block">Total Sesi</label>
                  <input type="number" min={1} max={100} value={sessionsTotal} onChange={e => setSessionsTotal(e.target.value)} className={inputCls}/>
                  <p className="text-[10px] text-[#7B78A8] mt-1">Otomatis dari paket, bisa diedit</p>
                </div>
                <div>
                  <label className="text-xs text-[#7B78A8] mb-1 block">Mulai dari Sesi ke-</label>
                  <input type="number" min={1} max={parseInt(sessionsTotal)} value={startOffset} onChange={e => setStartOffset(e.target.value)} className={inputCls}/>
                  <p className="text-[10px] text-[#7B78A8] mt-1">
                    {startOffset === '1' ? 'Paket baru dari awal' : `Mulai sesi ke-${startOffset}`}
                  </p>
                </div>
              </div>
            </div>

            {/* 4. JADWAL */}
            <div>
              <label className={labelCls}>4. Jadwal</label>
              <div className="grid grid-cols-2 gap-2 mb-3">
                {[
                  { value: 'auto',   label: '📅 Ikuti Jadwal Sebelumnya', desc: 'Otomatis dari pola lama' },
                  { value: 'manual', label: '✏️ Jadwalkan Manual',         desc: 'Atur jadwal baru' },
                ].map(opt => (
                  <button type="button" key={opt.value}
                    onClick={() => setJadwalMode(opt.value as 'auto' | 'manual')}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${jadwalMode === opt.value ? 'border-[#5C4FE5] bg-[#F0EFFF]' : 'border-[#E5E3FF] hover:border-[#5C4FE5]'}`}>
                    <p className="text-xs font-bold text-[#1A1640]">{opt.label}</p>
                    <p className="text-[10px] text-[#7B78A8] mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>

              {jadwalMode === 'auto' && (
                <div className="bg-[#F7F6FF] rounded-xl border border-[#E5E3FF] p-3">
                  <p className="text-xs font-semibold text-[#5C4FE5] mb-2">Pola jadwal terdeteksi:</p>
                  {jadwalRows.length === 0 ? (
                    <p className="text-xs text-gray-400">Tidak ada pola jadwal sebelumnya</p>
                  ) : (
                    <div className="space-y-1.5">
                      {jadwalRows.map((row, idx) => {
                        const d = new Date(`${row.date}T${row.time}`)
                        return (
                          <div key={idx} className="flex items-center gap-2 text-xs text-[#1A1640]">
                            <span className="w-4 h-4 rounded-full bg-[#5C4FE5] text-white text-[10px] flex items-center justify-center font-bold">{idx + 1}</span>
                            <span className="font-semibold">{d.toLocaleDateString('id-ID', { weekday: 'long' })} jam {row.time}</span>
                            <span className="text-[#7B78A8]">(mulai {d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })})</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  <p className="text-[10px] text-[#7B78A8] mt-2">Total sesi akan dibagi merata sesuai pola jadwal di atas</p>
                </div>
              )}

              {jadwalMode === 'manual' && (
                <div className="space-y-3">
                  {jadwalRows.map((row, idx) => (
                    <div key={idx} className="bg-[#F7F6FF] rounded-xl border border-[#E5E3FF] p-3">
                      <div className="flex items-center justify-between mb-2.5">
                        <span className="text-xs font-semibold text-[#5C4FE5]">Jadwal {idx + 1}</span>
                        {jadwalRows.length > 1 && (
                          <button onClick={() => removeRow(idx)} className="p-1 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition">
                            <Minus size={13}/>
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <div>
                          <label className="block text-[10px] font-bold text-[#7B78A8] uppercase tracking-wide mb-1">Tanggal</label>
                          <input type="date" value={row.date} onChange={e => updateRow(idx, 'date', e.target.value)} className={inputCls}/>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-[#7B78A8] uppercase tracking-wide mb-1">Jam Mulai</label>
                          <input type="time" value={row.time} onChange={e => updateRow(idx, 'time', e.target.value)} className={inputCls}/>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-[#7B78A8] uppercase tracking-wide mb-1">Ulangi setiap minggu (maks {MAX_REPEAT})</label>
                        <div className="flex items-center gap-3">
                          <input type="range" min={1} max={MAX_REPEAT} value={row.repeat}
                            onChange={e => updateRow(idx, 'repeat', Number(e.target.value))}
                            className="flex-1 accent-[#5C4FE5]"/>
                          <span className="text-sm font-bold text-[#5C4FE5] min-w-[40px] text-right">{row.repeat}x</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {jadwalRows.length < MAX_ROWS && (
                    <button onClick={addRow}
                      className="w-full py-2.5 border-2 border-dashed border-[#C4BFFF] rounded-xl text-sm font-semibold text-[#5C4FE5] hover:bg-[#F0EEFF] transition flex items-center justify-center gap-2">
                      <Plus size={14}/> Tambah Jadwal Lain
                    </button>
                  )}
                  <div className="flex items-center justify-between px-4 py-2.5 bg-[#EEEDFE] rounded-xl">
                    <span className="text-xs font-semibold text-[#3C3489]">Total sesi</span>
                    <span className="text-sm font-bold text-[#5C4FE5]">{totalJadwalSesi} sesi</span>
                  </div>
                </div>
              )}
            </div>

            {/* 5. LINK ZOOM */}
            <div>
              <label className={labelCls}>5. Link Zoom</label>
              <input type="url" value={zoomLink} onChange={e => setZoomLink(e.target.value)}
                placeholder="Masukkan link Zoom baru..."
                className={inputCls}/>
              <p className="text-xs text-[#7B78A8] mt-1">Wajib diisi dengan link Zoom terbaru untuk periode ini</p>
            </div>

            {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-semibold">{error}</div>}
          </div>
        ) : (
          /* PREVIEW */
          <div className="p-6 space-y-4">
            <div className="bg-[#F0EFFF] rounded-xl p-4 border border-[#E5E3FF]">
              <p className="text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-2">Ringkasan</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#7B78A8]">Paket</span>
                  <span className="font-semibold text-[#1A1640]">{packages.find(p => p.id === packageId)?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#7B78A8]">Total Sesi</span>
                  <span className="font-semibold text-[#1A1640]">{sessionsTotal} sesi</span>
                </div>
                {payment && parseInt(payment) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-[#7B78A8]">Pembayaran</span>
                    <span className="font-semibold text-[#1A1640]">{formatRp(parseInt(payment))} · {paymentMethod}</span>
                  </div>
                )}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-2">
                Jadwal yang Akan Dibuat ({previewSessions.length} sesi)
              </p>
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {previewSessions.map((s, idx) => (
                  <div key={idx} className="flex items-center gap-3 px-3 py-2 bg-[#F7F6FF] rounded-lg text-xs">
                    <span className="w-5 h-5 rounded-full bg-[#5C4FE5] text-white flex items-center justify-center font-bold text-[10px] flex-shrink-0">{idx + 1}</span>
                    <span className="font-semibold text-[#1A1640]">{s.date}</span>
                    <span className="text-[#7B78A8] ml-auto">{s.time}</span>
                  </div>
                ))}
              </div>
            </div>
            {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-semibold">{error}</div>}
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#E5E3FF] flex gap-3 sticky bottom-0 bg-white">
          {step === 'form' ? (
            <>
              <button onClick={onClose}
                className="flex-1 py-2.5 border-2 border-[#E5E3FF] text-[#7B78A8] rounded-xl font-semibold text-sm hover:bg-gray-50">
                Batal
              </button>
              <button onClick={handlePreview} disabled={packages.length === 0}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#5C4FE5] text-white rounded-xl font-semibold text-sm hover:bg-[#4a3ec7] disabled:opacity-40 disabled:cursor-not-allowed">
                Preview Jadwal <ChevronRight size={15}/>
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setStep('form')}
                className="flex-1 py-2.5 border-2 border-[#E5E3FF] text-[#7B78A8] rounded-xl font-semibold text-sm hover:bg-gray-50">
                ← Kembali Edit
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#5C4FE5] text-white rounded-xl font-semibold text-sm hover:bg-[#4a3ec7] disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Check size={15}/>}
                {saving ? 'Menyimpan...' : 'Konfirmasi & Simpan'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
