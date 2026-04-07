'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Bell, Send, AlertTriangle, Filter, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react'

const TYPE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  wa_reminder_absensi: { label: 'Reminder Absensi', color: '#5C4FE5', bg: '#EEEDFE' },
  wa_reminder_kelas:   { label: 'Reminder Kelas',   color: '#0C447C', bg: '#E6F1FB' },
  wa_laporan_ortu:     { label: 'Laporan Tutor',     color: '#3B6D11', bg: '#EAF3DE' },
  wa_paket_sisa_2:     { label: 'Sisa 2 Sesi',       color: '#633806', bg: '#FAEEDA' },
  wa_paket_sisa_1:     { label: 'Sisa 1 Sesi',       color: '#72243E', bg: '#FBEAF0' },
  wa_paket_selesai:    { label: 'Paket Selesai',      color: '#791F1F', bg: '#FCEBEB' },
  wa_perpanjang_paket:      { label: 'Perpanjangan',       color: '#166534', bg: '#DCFCE7' },
  wa_reminder_kelas_siswa: { label: 'Reminder Siswa',     color: '#7C3AED', bg: '#EDE9FE' },
}

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  sent:   { label: 'Terkirim', color: '#166534', bg: '#DCFCE7' },
  failed: { label: 'Gagal',    color: '#991B1B', bg: '#FEE2E2' },
}

const PER_PAGE = 15

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jayapura',
  })
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('id-ID', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jayapura',
  })
}
function fmtPhone(phone: string) {
  if (!phone || phone.length < 8) return phone
  return phone.slice(0, 4) + '****' + phone.slice(-4)
}

export default function AdminNotifikasiPage() {
  const supabase = createClient()

  const [logs, setLogs]           = useState<any[]>([])
  const [stats, setStats]         = useState<{ total: number; sent: number; failed: number; rate: number }>({ total: 0, sent: 0, failed: 0, rate: 0 })
  const [typeStats, setTypeStats] = useState<Record<string, { sent: number; failed: number }>>({})
  const [loading, setLoading]     = useState(true)
  const [page, setPage]           = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  // Filters
  const [filterType, setFilterType]     = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterFrom, setFilterFrom]     = useState('')
  const [filterTo, setFilterTo]         = useState('')

  useEffect(() => { fetchStats() }, [])
  useEffect(() => { fetchLogs() }, [page, filterType, filterStatus, filterFrom, filterTo])

  async function fetchStats() {
    const { data } = await supabase
      .from('notification_logs')
      .select('type, status')

    if (!data) return

    const total  = data.length
    const sent   = data.filter(d => d.status === 'sent').length
    const failed = data.filter(d => d.status === 'failed').length
    const rate   = total > 0 ? Math.round((sent / total) * 100) : 0

    setStats({ total, sent, failed, rate })

    // Per-type stats
    const ts: Record<string, { sent: number; failed: number }> = {}
    data.forEach(d => {
      if (!ts[d.type]) ts[d.type] = { sent: 0, failed: 0 }
      if (d.status === 'sent') ts[d.type].sent++
      else ts[d.type].failed++
    })
    setTypeStats(ts)
  }

  async function fetchLogs() {
    setLoading(true)

    let query = supabase
      .from('notification_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * PER_PAGE, page * PER_PAGE - 1)

    if (filterType)   query = query.eq('type', filterType)
    if (filterStatus) query = query.eq('status', filterStatus)
    if (filterFrom)   query = query.gte('created_at', filterFrom + 'T00:00:00+09:00')
    if (filterTo)     query = query.lte('created_at', filterTo + 'T23:59:59+09:00')

    const { data, count } = await query
    setLogs(data ?? [])
    setTotalCount(count ?? 0)
    setLoading(false)
  }

  function resetFilters() {
    setFilterType('')
    setFilterStatus('')
    setFilterFrom('')
    setFilterTo('')
    setPage(1)
  }

  const totalPages = Math.ceil(totalCount / PER_PAGE)
  const hasFilters = filterType || filterStatus || filterFrom || filterTo

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-black text-[#1A1640] font-['Sora']">Notifikasi WhatsApp</h1>
        <p className="text-sm text-[#7B78A8] mt-1">Monitor semua pesan WA otomatis yang dikirim via Fonnte</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          { num: stats.total,         label: 'Total Pesan',    icon: <Bell size={16} />,           color: '#5C4FE5', bg: '#EEEDFE' },
          { num: stats.sent,          label: 'Terkirim',       icon: <Send size={16} />,           color: '#166534', bg: '#DCFCE7' },
          { num: stats.failed,        label: 'Gagal',          icon: <AlertTriangle size={16} />,  color: '#991B1B', bg: '#FEE2E2' },
          { num: `${stats.rate}%`,    label: 'Success Rate',   icon: <Send size={16} />,           color: stats.rate >= 90 ? '#166534' : stats.rate >= 70 ? '#92400E' : '#991B1B', bg: stats.rate >= 90 ? '#DCFCE7' : stats.rate >= 70 ? '#FEF3C7' : '#FEE2E2' },
        ].map((s, i) => (
          <div key={i} className="bg-white border border-[#E5E3FF] rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: s.bg, color: s.color }}>
                {s.icon}
              </div>
            </div>
            <div className="text-2xl font-black" style={{ color: s.color }}>{s.num}</div>
            <div className="text-xs text-[#7B78A8] font-semibold mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Per-Type Breakdown */}
      {Object.keys(typeStats).length > 0 && (
        <div className="bg-white border border-[#E5E3FF] rounded-2xl p-4 mb-5">
          <p className="text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-3">Per Tipe Notifikasi</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {Object.entries(typeStats).map(([type, data]) => {
              const meta = TYPE_LABELS[type] ?? { label: type, color: '#666', bg: '#f0f0f0' }
              const total = data.sent + data.failed
              const rate  = total > 0 ? Math.round((data.sent / total) * 100) : 0
              return (
                <div key={type} className="rounded-xl px-3 py-2.5 border" style={{ borderColor: meta.bg, background: `${meta.bg}40` }}>
                  <p className="text-[11px] font-bold" style={{ color: meta.color }}>{meta.label}</p>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-lg font-black" style={{ color: meta.color }}>{data.sent}</span>
                    <span className="text-[10px] text-[#7B78A8]">/ {total}</span>
                    <span className="text-[10px] font-semibold ml-auto" style={{ color: rate >= 90 ? '#166534' : '#991B1B' }}>{rate}%</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border border-[#E5E3FF] rounded-2xl px-4 py-3 mb-4 flex items-center gap-3 flex-wrap">
        <Filter size={14} className="text-[#7B78A8]" />
        <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1) }}
          className="px-2.5 py-1.5 border border-[#E5E3FF] rounded-lg text-xs text-[#1A1640] bg-white focus:outline-none focus:border-[#5C4FE5]">
          <option value="">Semua Tipe</option>
          {Object.entries(TYPE_LABELS).map(([key, val]) => (
            <option key={key} value={key}>{val.label}</option>
          ))}
        </select>
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1) }}
          className="px-2.5 py-1.5 border border-[#E5E3FF] rounded-lg text-xs text-[#1A1640] bg-white focus:outline-none focus:border-[#5C4FE5]">
          <option value="">Semua Status</option>
          <option value="sent">Terkirim</option>
          <option value="failed">Gagal</option>
        </select>
        <input type="date" value={filterFrom} onChange={e => { setFilterFrom(e.target.value); setPage(1) }}
          className="px-2.5 py-1.5 border border-[#E5E3FF] rounded-lg text-xs text-[#1A1640] focus:outline-none focus:border-[#5C4FE5]" />
        <span className="text-xs text-[#7B78A8]">s/d</span>
        <input type="date" value={filterTo} onChange={e => { setFilterTo(e.target.value); setPage(1) }}
          className="px-2.5 py-1.5 border border-[#E5E3FF] rounded-lg text-xs text-[#1A1640] focus:outline-none focus:border-[#5C4FE5]" />
        {hasFilters && (
          <button onClick={resetFilters}
            className="px-3 py-1.5 border border-[#E5E3FF] text-[#7B78A8] text-xs font-bold rounded-lg hover:bg-[#F0EFFF] transition">
            Reset
          </button>
        )}
        <button onClick={() => { fetchStats(); fetchLogs() }}
          className="ml-auto px-3 py-1.5 bg-[#5C4FE5] text-white text-xs font-bold rounded-lg hover:bg-[#3D34C4] transition flex items-center gap-1.5">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E5E3FF] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-[#7B78A8]">Memuat data...</div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-sm text-[#7B78A8]">Belum ada log notifikasi</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[#E5E3FF] bg-[#F7F6FF]">
                    <th className="px-4 py-3 text-[10px] font-bold text-[#7B78A8] uppercase tracking-wide">Tipe</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-[#7B78A8] uppercase tracking-wide">Penerima</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-[#7B78A8] uppercase tracking-wide">Siswa</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-[#7B78A8] uppercase tracking-wide">Kelas</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-[#7B78A8] uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-[#7B78A8] uppercase tracking-wide">Tanggal</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-[#7B78A8] uppercase tracking-wide">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0EFFF]">
                  {logs.map((log: any) => {
                    const typeMeta   = TYPE_LABELS[log.type] ?? { label: log.type, color: '#666', bg: '#f0f0f0' }
                    const statusMeta = STATUS_STYLES[log.status] ?? { label: log.status, color: '#666', bg: '#f0f0f0' }
                    const payload    = log.payload ?? {}

                    return (
                      <tr key={log.id} className="hover:bg-[#F7F6FF] transition-colors">
                        <td className="px-4 py-3">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{ background: typeMeta.bg, color: typeMeta.color }}>
                            {typeMeta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-xs text-[#1A1640] font-medium">{payload.parentName ?? '—'}</div>
                          <div className="text-[10px] text-[#9B97B2]">{fmtPhone(log.target)}</div>
                        </td>
                        <td className="px-4 py-3 text-xs text-[#1A1640]">{payload.studentName ?? '—'}</td>
                        <td className="px-4 py-3 text-xs text-[#7B78A8]">{payload.kelasLabel ?? payload.kursusLabel ?? '—'}</td>
                        <td className="px-4 py-3">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{ background: statusMeta.bg, color: statusMeta.color }}>
                            {statusMeta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-xs text-[#1A1640]">{fmtDate(log.created_at)}</div>
                          <div className="text-[10px] text-[#9B97B2]">{fmtTime(log.created_at)} WIT</div>
                        </td>
                        <td className="px-4 py-3 text-[10px] text-[#9B97B2] max-w-[150px] truncate">
                          {log.response ?? '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-[#E5E3FF]">
              <p className="text-xs text-[#7B78A8]">
                {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, totalCount)} dari {totalCount}
              </p>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="p-1.5 rounded-lg border border-[#E5E3FF] hover:bg-[#F0EFFF] disabled:opacity-30 transition">
                  <ChevronLeft size={14} className="text-[#7B78A8]" />
                </button>
                <span className="text-xs font-semibold text-[#5C4FE5]">{page} / {totalPages || 1}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                  className="p-1.5 rounded-lg border border-[#E5E3FF] hover:bg-[#F0EFFF] disabled:opacity-30 transition">
                  <ChevronRight size={14} className="text-[#7B78A8]" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
