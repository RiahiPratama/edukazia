'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Calendar, Users, CreditCard, ExternalLink, Check, Pencil, Trash2, ChevronLeft } from 'lucide-react'

type KelasDetail = {
  id: string
  label: string
  status: string
  max_participants: number
  zoom_link: string | null
  courses: { name: string } | null
  class_types: { name: string } | null
  tutors: { id: string; profiles: { full_name: string } | null } | null
}

type Enrollment = {
  id: string
  student_id: string
  sessions_total: number
  session_start_offset: number
  sessions_used: number
  status: string
  student_name: string
}

type Session = {
  id: string
  scheduled_at: string
  status: string
  zoom_link: string | null
}

type Payment = {
  id: string
  amount: number
  status: string
  period_label: string | null
  method: string
  created_at: string
  student_name: string
}

const STATUS_SESI: Record<string, { label: string; cls: string }> = {
  scheduled:   { label: 'Terjadwal',      cls: 'bg-[#EEEDFE] text-[#3C3489]' },
  completed:   { label: 'Selesai',        cls: 'bg-[#E6F4EC] text-[#1A5C36]' },
  cancelled:   { label: 'Dibatalkan',     cls: 'bg-[#FEE9E9] text-[#991B1B]' },
  rescheduled: { label: 'Dijadwal Ulang', cls: 'bg-[#FEF3E2] text-[#92400E]' },
}

const STATUS_BAYAR: Record<string, { label: string; cls: string }> = {
  unpaid:  { label: 'Belum Bayar',        cls: 'bg-[#FEE9E9] text-[#991B1B]' },
  pending: { label: 'Menunggu',           cls: 'bg-[#FEF3E2] text-[#92400E]' },
  paid:    { label: 'Lunas',              cls: 'bg-[#E6F4EC] text-[#1A5C36]' },
  overdue: { label: 'Terlambat',          cls: 'bg-[#FEE9E9] text-[#7F1D1D]' },
}

const AVATAR_COLORS = ['#5C4FE5','#27A05A','#D97706','#DC2626','#0891B2','#7C3AED','#BE185D','#065F46']

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })
}
function fmtRp(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}
function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

export default function KelasDetailPage() {
  const params  = useParams()
  const kelasId = params.id as string
  const supabase = createClient()

  const [kelas,       setKelas]       = useState<KelasDetail | null>(null)
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [sessions,    setSessions]    = useState<Session[]>([])
  const [payments,    setPayments]    = useState<Payment[]>([])
  const [loading,     setLoading]     = useState(true)
  const [activeTab,   setActiveTab]   = useState<'siswa' | 'jadwal' | 'pembayaran'>('siswa')

  useEffect(() => { fetchAll() }, [kelasId])

  async function fetchAll() {
    setLoading(true)

    // Fetch kelas
    const { data: k } = await supabase
      .from('class_groups')
      .select('id, label, status, max_participants, zoom_link, courses(name), class_types(name), tutors(id, profiles(full_name))')
      .eq('id', kelasId).single()
    setKelas(k as any)

    // Fetch enrollments + nama siswa
    const { data: enr } = await supabase
      .from('enrollments')
      .select('id, student_id, sessions_total, session_start_offset, sessions_used, status')
      .eq('class_group_id', kelasId)

    if (enr && enr.length > 0) {
      const sIds = enr.map((e: any) => e.student_id)
      const { data: studs } = await supabase.from('students').select('id, profile_id').in('id', sIds)
      const profIds = (studs ?? []).map((s: any) => s.profile_id).filter(Boolean)
      let nameMap: Record<string, string> = {}
      if (profIds.length > 0) {
        const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', profIds)
        const profMap = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.full_name]))
        nameMap = Object.fromEntries((studs ?? []).map((s: any) => [s.id, profMap[s.profile_id] ?? 'Siswa']))
      }
      setEnrollments(enr.map((e: any) => ({ ...e, student_name: nameMap[e.student_id] ?? 'Siswa' })))
    }

    // Fetch sessions
    const { data: sess } = await supabase
      .from('sessions')
      .select('id, scheduled_at, status, zoom_link')
      .eq('class_group_id', kelasId)
      .order('scheduled_at', { ascending: true })
    setSessions((sess ?? []) as Session[])

    // Fetch payments
    const { data: pays } = await supabase
      .from('payments')
      .select('id, amount, status, period_label, method, created_at, student_id')
      .eq('enrollment_id', kelasId) // fallback, coba via enrollment
      .order('created_at', { ascending: false })

    // Fetch via enrollments jika perlu
    const enrollIds = (enr ?? []).map((e: any) => e.id)
    let payList: any[] = []
    if (enrollIds.length > 0) {
      const { data: pays2 } = await supabase
        .from('payments')
        .select('id, amount, status, period_label, method, created_at, student_id')
        .in('enrollment_id', enrollIds)
        .order('created_at', { ascending: false })
      payList = pays2 ?? []
    }

    // Nama siswa untuk payment
    const sIds2 = [...new Set(payList.map((p: any) => p.student_id))]
    let payNameMap: Record<string, string> = {}
    if (sIds2.length > 0) {
      const { data: studs2 } = await supabase.from('students').select('id, profile_id').in('id', sIds2)
      const profIds2 = (studs2 ?? []).map((s: any) => s.profile_id).filter(Boolean)
      if (profIds2.length > 0) {
        const { data: profs2 } = await supabase.from('profiles').select('id, full_name').in('id', profIds2)
        const profMap2 = Object.fromEntries((profs2 ?? []).map((p: any) => [p.id, p.full_name]))
        payNameMap = Object.fromEntries((studs2 ?? []).map((s: any) => [s.id, profMap2[s.profile_id] ?? 'Siswa']))
      }
    }
    setPayments(payList.map((p: any) => ({ ...p, student_name: payNameMap[p.student_id] ?? '—' })))

    setLoading(false)
  }

  async function markSessionComplete(id: string) {
    await supabase.from('sessions').update({ status: 'completed' }).eq('id', id)
    fetchAll()
  }

  async function deleteSession(id: string) {
    await supabase.from('sessions').delete().eq('id', id)
    fetchAll()
  }

  const statusLabel: Record<string, string> = { active: 'Aktif', inactive: 'Nonaktif', completed: 'Selesai' }
  const statusColor: Record<string, string>  = {
    active: 'bg-green-100 text-green-700', inactive: 'bg-gray-100 text-gray-500', completed: 'bg-blue-100 text-blue-700'
  }

  const selesai    = sessions.filter(s => s.status === 'completed').length
  const terjadwal  = sessions.filter(s => s.status === 'scheduled').length
  const totalLunas = payments.filter(p => p.status === 'paid').reduce((a, p) => a + p.amount, 0)

  if (loading) return <div className="p-6 text-sm text-[#7B78A8]">Memuat detail kelas...</div>
  if (!kelas)  return <div className="p-6 text-sm text-red-500">Kelas tidak ditemukan.</div>

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/kelas" className="text-[#7B78A8] hover:text-[#5C4FE5] transition-colors">
          <ChevronLeft size={20}/>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-[#1A1640] truncate" style={{fontFamily:'Sora,sans-serif'}}>{kelas.label}</h1>
            <span className={`text-xs font-semibold px-2 py-1 rounded-full flex-shrink-0 ${statusColor[kelas.status] ?? 'bg-gray-100 text-gray-500'}`}>
              {statusLabel[kelas.status] ?? kelas.status}
            </span>
          </div>
          <p className="text-sm text-[#7B78A8] mt-0.5">
            {kelas.courses?.name} · {kelas.class_types?.name} · {(kelas.tutors as any)?.profiles?.full_name ?? '—'}
          </p>
        </div>
        <Link href={`/admin/kelas/${kelasId}/edit`}
          className="flex items-center gap-1.5 px-3 py-2 bg-[#5C4FE5] text-white text-xs font-bold rounded-lg hover:bg-[#3D34C4] transition">
          <Pencil size={12}/> Edit
        </Link>
      </div>

      {/* Info bar */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white rounded-2xl border border-[#E5E3FF] p-4 text-center">
          <div className="text-2xl font-black text-[#5C4FE5]">{enrollments.filter(e => e.status === 'active').length}/{kelas.max_participants}</div>
          <div className="text-xs text-[#7B78A8] mt-0.5 font-semibold">Peserta Aktif</div>
        </div>
        <div className="bg-white rounded-2xl border border-[#E5E3FF] p-4 text-center">
          <div className="text-2xl font-black text-[#27A05A]">{selesai}</div>
          <div className="text-xs text-[#7B78A8] mt-0.5 font-semibold">Sesi Selesai</div>
        </div>
        <div className="bg-white rounded-2xl border border-[#E5E3FF] p-4 text-center">
          <div className="text-2xl font-black text-[#1A1640]">{fmtRp(totalLunas)}</div>
          <div className="text-xs text-[#7B78A8] mt-0.5 font-semibold">Total Lunas</div>
        </div>
      </div>

      {/* Zoom link */}
      {kelas.zoom_link && (
        <div className="bg-[#EEEDFE] rounded-xl px-4 py-3 mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[#3C3489]">Link Zoom</p>
            <p className="text-xs text-[#5C4FE5] truncate max-w-[280px]">{kelas.zoom_link}</p>
          </div>
          <a href={kelas.zoom_link} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 px-3 py-1.5 bg-[#5C4FE5] text-white text-xs font-bold rounded-lg hover:bg-[#3D34C4] transition">
            <ExternalLink size={12}/> Buka
          </a>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-[#F7F6FF] p-1 rounded-xl mb-5 border border-[#E5E3FF]">
        {([
          { key: 'siswa',      label: 'Siswa',      icon: <Users size={13}/>,       count: enrollments.length },
          { key: 'jadwal',     label: 'Jadwal',     icon: <Calendar size={13}/>,    count: sessions.length },
          { key: 'pembayaran', label: 'Pembayaran', icon: <CreditCard size={13}/>,  count: payments.length },
        ] as const).map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={[
              'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all',
              activeTab === tab.key ? 'bg-white text-[#5C4FE5] shadow-sm' : 'text-[#7B78A8] hover:text-[#1A1640]'
            ].join(' ')}>
            {tab.icon} {tab.label}
            {tab.count > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${activeTab === tab.key ? 'bg-[#EEEDFE] text-[#5C4FE5]' : 'bg-[#E5E3FF] text-[#7B78A8]'}`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab: Siswa */}
      {activeTab === 'siswa' && (
        <div className="bg-white rounded-2xl border border-[#E5E3FF] overflow-hidden">
          {enrollments.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-[#7B78A8]">Belum ada siswa terdaftar.</div>
          ) : (
            enrollments.map((enr, idx) => {
              const pct = Math.min(((enr.session_start_offset - 1 + (enr.sessions_used ?? 0)) / enr.sessions_total) * 100, 100)
              const st  = enr.status === 'active' ? { label: 'Aktif', cls: 'bg-[#E6F4EC] text-[#1A5C36]' }
                        : enr.status === 'inactive' ? { label: 'Berhenti', cls: 'bg-[#FEE9E9] text-[#991B1B]' }
                        : { label: enr.status, cls: 'bg-gray-100 text-gray-600' }
              return (
                <div key={enr.id} className={`flex items-center gap-3 px-5 py-4 ${idx < enrollments.length - 1 ? 'border-b border-[#E5E3FF]' : ''}`}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{backgroundColor: AVATAR_COLORS[idx % AVATAR_COLORS.length]}}>
                    {getInitials(enr.student_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-[#1A1640]">{enr.student_name}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-24 h-1.5 bg-[#E5E3FF] rounded-full overflow-hidden">
                        <div className="h-full bg-[#5C4FE5] rounded-full" style={{width: `${pct}%`}}/>
                      </div>
                      <span className="text-[10px] font-bold text-[#5C4FE5]">
                        {enr.session_start_offset}/{enr.sessions_total} sesi
                      </span>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${st.cls}`}>{st.label}</span>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Tab: Jadwal */}
      {activeTab === 'jadwal' && (
        <div className="bg-white rounded-2xl border border-[#E5E3FF] overflow-hidden">
          {sessions.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <div className="text-3xl mb-3">📅</div>
              <p className="text-sm text-[#7B78A8] font-semibold">Belum ada sesi dijadwalkan</p>
              <p className="text-xs text-[#7B78A8] mt-1">Gunakan tombol <strong>Jadwal</strong> di halaman Manajemen Kelas</p>
            </div>
          ) : (
            <>
              {/* Summary sesi */}
              <div className="px-5 py-3 bg-[#F7F6FF] border-b border-[#E5E3FF] flex items-center gap-4 text-xs">
                <span className="text-[#7B78A8]">Total: <strong className="text-[#1A1640]">{sessions.length} sesi</strong></span>
                <span className="text-[#7B78A8]">Selesai: <strong className="text-[#27A05A]">{selesai}</strong></span>
                <span className="text-[#7B78A8]">Terjadwal: <strong className="text-[#5C4FE5]">{terjadwal}</strong></span>
              </div>
              {sessions.map((s, idx) => {
                const st = STATUS_SESI[s.status] ?? { label: s.status, cls: 'bg-gray-100 text-gray-600' }
                return (
                  <div key={s.id} className={`flex items-center gap-4 px-5 py-3.5 hover:bg-[#F7F6FF] transition-colors ${idx < sessions.length - 1 ? 'border-b border-[#E5E3FF]' : ''}`}>
                    <div className="min-w-[36px] text-center">
                      <div className="text-xs font-bold text-[#5C4FE5]">{idx + 1}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-[#1A1640]">{fmtDate(s.scheduled_at)}</div>
                      <div className="text-xs text-[#7B78A8]">{fmtTime(s.scheduled_at)}</div>
                    </div>
                    {s.zoom_link && (
                      <a href={s.zoom_link} target="_blank" rel="noopener noreferrer"
                        className="text-[#5C4FE5] hover:opacity-70 transition">
                        <ExternalLink size={13}/>
                      </a>
                    )}
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${st.cls}`}>{st.label}</span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {s.status === 'scheduled' && (
                        <button onClick={() => markSessionComplete(s.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition" title="Tandai Selesai">
                          <Check size={13}/>
                        </button>
                      )}
                      <button onClick={() => deleteSession(s.id)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition" title="Hapus">
                        <Trash2 size={13}/>
                      </button>
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </div>
      )}

      {/* Tab: Pembayaran */}
      {activeTab === 'pembayaran' && (
        <div className="bg-white rounded-2xl border border-[#E5E3FF] overflow-hidden">
          {payments.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <div className="text-3xl mb-3">💳</div>
              <p className="text-sm text-[#7B78A8] font-semibold">Belum ada data pembayaran</p>
              <Link href="/admin/pembayaran"
                className="mt-3 inline-block text-sm text-[#5C4FE5] font-semibold hover:underline">
                + Buat tagihan di menu Pembayaran
              </Link>
            </div>
          ) : (
            payments.map((p, idx) => {
              const st = STATUS_BAYAR[p.status] ?? { label: p.status, cls: 'bg-gray-100 text-gray-600' }
              return (
                <div key={p.id} className={`flex items-center gap-4 px-5 py-4 hover:bg-[#F7F6FF] transition-colors ${idx < payments.length - 1 ? 'border-b border-[#E5E3FF]' : ''}`}>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-[#1A1640]">{p.student_name}</div>
                    <div className="text-xs text-[#7B78A8] mt-0.5">
                      {p.period_label ?? '—'} · {p.method === 'transfer' ? 'Transfer Bank' : 'Tunai'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-[#1A1640]">{fmtRp(p.amount)}</div>
                    <div className="text-xs text-[#7B78A8]">{new Date(p.created_at).toLocaleDateString('id-ID', {day:'numeric',month:'short',year:'numeric'})}</div>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${st.cls}`}>{st.label}</span>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Tab: Ketersediaan */}
      {tab === 'ketersediaan' && (
        <div className="space-y-3">
          {(() => {
            const availability = (tutor.availability ?? {}) as Record<string, string[]>
            const HARI = ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu']
            const adaData = HARI.some(h => (availability[h] ?? []).length > 0)
            if (!adaData) return (
              <div className="bg-white rounded-2xl border border-[#E5E3FF] p-8 text-center">
                <p className="text-sm text-[#7B78A8]">Tutor belum mengisi ketersediaan mengajar.</p>
              </div>
            )
            return HARI.map(hari => {
              const jam = availability[hari] ?? []
              if (jam.length === 0) return null
              return (
                <div key={hari} className="bg-white rounded-2xl border border-[#E5E3FF] overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#F0EFFF] bg-[#EEEDFE] flex items-center justify-between">
                    <p className="text-sm font-bold text-[#3C3489]">{hari}</p>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#5C4FE5] text-white">
                      {jam.length} jam
                    </span>
                  </div>
                  <div className="px-4 py-3 flex flex-wrap gap-2">
                    {jam.map((j: string) => (
                      <span key={j} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#EEEDFE] text-[#3C3489] border border-[#CECBF6]">
                        {j}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })
          })()}
        </div>
      )}

    </div>
  )
}
