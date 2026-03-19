import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Coins } from 'lucide-react'

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  unpaid: { label: 'Belum Dibayar', cls: 'bg-[#FEE9E9] text-[#991B1B]' },
  paid:   { label: 'Sudah Dibayar', cls: 'bg-[#E6F4EC] text-[#1A5C36]' },
}

function formatRp(n: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', maximumFractionDigits: 0
  }).format(n)
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric'
  })
}

export default async function TutorHonorPage() {
  const supabase = await createClient()

  // ── Auth ──
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // ── Ambil tutor_id ──
  const { data: tutor } = await supabase
    .from('tutors')
    .select('id, bank_name, bank_account, bank_holder')
    .eq('profile_id', user.id)
    .single()

  const tutorId = tutor?.id

  // ── Ambil riwayat honor ──
  const { data: payments } = await supabase
    .from('tutor_payments')
    .select(`
      id, period_label, sessions_done, students_count,
      class_type, rate_per_session, subtotal, bonus, total,
      status, notes, paid_at, created_at,
      class_groups(label)
    `)
    .eq('tutor_id', tutorId)
    .order('created_at', { ascending: false })

  // ── Summary ──
  const totalDibayar  = payments?.filter(p => p.status === 'paid').reduce((s, p) => s + p.total, 0) ?? 0
  const totalBelumDibayar = payments?.filter(p => p.status === 'unpaid').reduce((s, p) => s + p.total, 0) ?? 0

  // Honor bulan ini
  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const honorBulanIni = payments
    ?.filter(p => p.created_at >= firstOfMonth)
    .reduce((s, p) => s + p.total, 0) ?? 0

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-[#1A1640] font-['Sora']">Honor Saya</h1>
        <p className="text-sm text-[#7B78A8] mt-1">Riwayat pembayaran honor mengajar</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-purple-100 p-4">
          <div className="w-10 h-10 rounded-xl bg-[#5C4FE5] flex items-center justify-center mb-3">
            <Coins size={20} color="white" strokeWidth={2}/>
          </div>
          <div className="text-xl font-black text-[#1A1640]">{formatRp(honorBulanIni)}</div>
          <div className="text-xs text-[#7B78A8] font-semibold mt-1">Honor Bulan Ini</div>
        </div>
        <div className="bg-white rounded-2xl border border-green-100 p-4">
          <div className="w-10 h-10 rounded-xl bg-green-500 flex items-center justify-center mb-3">
            <Coins size={20} color="white" strokeWidth={2}/>
          </div>
          <div className="text-xl font-black text-[#1A1640]">{formatRp(totalDibayar)}</div>
          <div className="text-xs text-[#7B78A8] font-semibold mt-1">Total Sudah Dibayar</div>
        </div>
        <div className="bg-white rounded-2xl border border-red-100 p-4">
          <div className="w-10 h-10 rounded-xl bg-red-400 flex items-center justify-center mb-3">
            <Coins size={20} color="white" strokeWidth={2}/>
          </div>
          <div className="text-xl font-black text-[#1A1640]">{formatRp(totalBelumDibayar)}</div>
          <div className="text-xs text-[#7B78A8] font-semibold mt-1">Belum Dibayar</div>
        </div>
      </div>

      {/* Info Rekening */}
      {(tutor?.bank_name || tutor?.bank_account) && (
        <div className="bg-white rounded-2xl border border-[#E5E3FF] p-5 mb-6">
          <p className="text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-3">Info Rekening Pembayaran</p>
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <div className="text-xs text-[#7B78A8]">Bank</div>
              <div className="text-sm font-bold text-[#1A1640]">{tutor.bank_name ?? '—'}</div>
            </div>
            <div>
              <div className="text-xs text-[#7B78A8]">No. Rekening</div>
              <div className="text-sm font-bold text-[#1A1640]">{tutor.bank_account ?? '—'}</div>
            </div>
            <div>
              <div className="text-xs text-[#7B78A8]">Atas Nama</div>
              <div className="text-sm font-bold text-[#1A1640]">{tutor.bank_holder ?? '—'}</div>
            </div>
          </div>
        </div>
      )}

      {/* Riwayat Honor */}
      <div className="bg-white rounded-2xl border border-[#E5E3FF] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E5E3FF]">
          <h2 className="font-bold text-[#1A1640]">Riwayat Honor</h2>
        </div>

        {!payments || payments.length === 0 ? (
          <div className="p-12 text-center">
            <div className="flex justify-center mb-3">
              <Coins size={36} strokeWidth={1.5} className="text-[#C4BFFF]"/>
            </div>
            <p className="text-sm font-semibold text-[#7B78A8]">Belum ada riwayat honor</p>
            <p className="text-xs text-[#7B78A8] mt-1">Honor akan muncul setelah admin membuat tagihan</p>
          </div>
        ) : (
          <div className="divide-y divide-[#F0EFFF]">
            {payments.map((p: any) => {
              const st          = STATUS_MAP[p.status] ?? STATUS_MAP.unpaid
              const isPerSiswa  = p.class_type === 'Semi Privat' || p.class_type === 'Reguler'

              return (
                <div key={p.id} className="px-5 py-4 hover:bg-[#F7F6FF] transition">
                  <div className="flex items-start justify-between gap-3">
                    {/* Kiri */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-[#1A1640]">
                          {p.period_label ?? '—'}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.cls}`}>
                          {st.label}
                        </span>
                      </div>

                      {/* Kelas */}
                      {p.class_groups?.label && (
                        <div className="text-xs text-[#7B78A8] mt-0.5">
                          {p.class_groups.label} · {p.class_type}
                        </div>
                      )}

                      {/* Rincian */}
                      <div className="text-xs text-[#7B78A8] mt-1">
                        {p.sessions_done} sesi × {formatRp(p.rate_per_session)}
                        {isPerSiswa && ` × ${p.students_count} siswa`}
                        {' '}= {formatRp(p.subtotal)}
                        {p.bonus > 0 && (
                          <span className="text-[#5C4FE5] font-semibold ml-1">
                            + Bonus {formatRp(p.bonus)}
                          </span>
                        )}
                      </div>

                      {/* Catatan */}
                      {p.notes && (
                        <div className="text-xs text-[#7B78A8] mt-0.5 italic">"{p.notes}"</div>
                      )}

                      {/* Tanggal dibayar */}
                      {p.paid_at && (
                        <div className="text-xs text-green-600 font-semibold mt-0.5">
                          Dibayar {fmtDate(p.paid_at)}
                        </div>
                      )}
                    </div>

                    {/* Kanan — Total */}
                    <div className="text-right flex-shrink-0">
                      <div className="text-base font-black text-[#1A1640]">{formatRp(p.total)}</div>
                      <div className="text-xs text-[#7B78A8]">{fmtDate(p.created_at)}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
