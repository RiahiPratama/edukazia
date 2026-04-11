'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Activity, Users, Clock, AlertTriangle, Filter, RefreshCw,
  ChevronLeft, ChevronRight, UserCheck, UserX, BarChart3
} from 'lucide-react'

const ROLE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  tutor:   { label: 'Tutor',  color: '#0C447C', bg: '#E6F1FB' },
  parent:  { label: 'Ortu',   color: '#3B6D11', bg: '#EAF3DE' },
  student: { label: 'Siswa',  color: '#92400E', bg: '#FEF3C7' },
}

const PER_PAGE = 20

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

export default function AdminAktivitasPage() {
  const supabase = createClient()

  const [logs, setLogs]         = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [page, setPage]         = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  const [loginHariIni, setLoginHariIni]       = useState(0)
  const [aktifMingguIni, setAktifMingguIni]   = useState(0)
  const [tidakAktif, setTidakAktif]           = useState(0)
  const [topPages, setTopPages]               = useState<{ page: string; count: number }[]>([])
  const [inactiveUsers, setInactiveUsers]     = useState<{ id: string; name: string; role: string; lastSeen: string | null }[]>([])
  const [showInactive, setShowInactive]       = useState(false)
  const [filterRole, setFilterRole]       = useState('')
  const [filterFrom, setFilterFrom]       = useState('')
  const [filterTo, setFilterTo]           = useState('')

  const [userNames, setUserNames] = useState<Record<string, string>>({})

  useEffect(() => { fetchStats(); fetchUserNames() }, [])
  useEffect(() => { fetchLogs() }, [page, filterRole, filterFrom, filterTo])

  async function fetchUserNames() {
    const { data } = await supabase.from('profiles').select('id, full_name, role').neq('role', 'admin')
    if (!data) return
    const map: Record<string, string> = {}
    data.forEach(p => { map[p.id] = p.full_name ?? p.id.slice(0, 8) })
    setUserNames(map)
  }

  async function fetchStats() {
    const todayWIT = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jayapura' })
    const startToday = `${todayWIT}T00:00:00+09:00`
    const endToday = `${todayWIT}T23:59:59+09:00`

    // Login hari ini (unique users, exclude admin)
    const { data: todayData } = await supabase
      .from('user_activity')
      .select('user_id')
      .neq('user_role', 'admin')
      .gte('created_at', startToday)
      .lte('created_at', endToday)

    const uniqueToday = new Set(todayData?.map(d => d.user_id) ?? [])
    setLoginHariIni(uniqueToday.size)

    // Aktif minggu ini (exclude admin)
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    const { data: weekData } = await supabase
      .from('user_activity')
      .select('user_id')
      .neq('user_role', 'admin')
      .gte('created_at', weekAgo.toISOString())

    const uniqueWeek = new Set(weekData?.map(d => d.user_id) ?? [])
    setAktifMingguIni(uniqueWeek.size)

    // Tidak aktif: profiles yang BISA login (punya email) dan TIDAK ada di weekData
    const { data: allProfiles } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .in('role', ['parent', 'tutor', 'student'])
      .not('email', 'is', null)

    const inactiveProfiles = (allProfiles ?? []).filter(p => !uniqueWeek.has(p.id))
    setTidakAktif(inactiveProfiles.length)

    // Fetch last seen untuk inactive users
    if (inactiveProfiles.length > 0) {
      const inactiveIds = inactiveProfiles.map(p => p.id)
      const { data: lastActivities } = await supabase
        .from('user_activity')
        .select('user_id, created_at')
        .in('user_id', inactiveIds)
        .order('created_at', { ascending: false })

      const lastSeenMap: Record<string, string> = {}
      lastActivities?.forEach(a => {
        if (!lastSeenMap[a.user_id]) lastSeenMap[a.user_id] = a.created_at
      })

      setInactiveUsers(
        inactiveProfiles.map(p => ({
          id: p.id,
          name: p.full_name ?? p.id.slice(0, 8),
          role: p.role,
          lastSeen: lastSeenMap[p.id] ?? null,
        })).sort((a, b) => {
          if (!a.lastSeen && !b.lastSeen) return 0
          if (!a.lastSeen) return -1
          if (!b.lastSeen) return 1
          return 0
        })
      )
    }

    // Top pages (exclude admin)
    const { data: allActivity } = await supabase
      .from('user_activity')
      .select('page')
      .neq('user_role', 'admin')
      .gte('created_at', weekAgo.toISOString())

    if (allActivity) {
      const pageCounts: Record<string, number> = {}
      allActivity.forEach(a => {
        pageCounts[a.page] = (pageCounts[a.page] ?? 0) + 1
      })
      const sorted = Object.entries(pageCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([page, count]) => ({ page, count }))
      setTopPages(sorted)
    }
  }

  async function fetchLogs() {
    setLoading(true)

    let query = supabase
      .from('user_activity')
      .select('*', { count: 'exact' })
      .neq('user_role', 'admin')
      .order('created_at', { ascending: false })
      .range((page - 1) * PER_PAGE, page * PER_PAGE - 1)

    if (filterRole) query = query.eq('user_role', filterRole)
    if (filterFrom) query = query.gte('created_at', filterFrom + 'T00:00:00+09:00')
    if (filterTo)   query = query.lte('created_at', filterTo + 'T23:59:59+09:00')

    const { data, count } = await query
    setLogs(data ?? [])
    setTotalCount(count ?? 0)
    setLoading(false)
  }

  function resetFilters() {
    setFilterRole('')
    setFilterFrom('')
    setFilterTo('')
    setPage(1)
  }

  const totalPages = Math.ceil(totalCount / PER_PAGE)
  const hasFilters = filterRole || filterFrom || filterTo

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-black text-[#1A1640] font-['Sora']">Aktivitas User</h1>
        <p className="text-sm text-[#7B78A8] mt-1">Monitor siapa yang login dan buka halaman apa</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          { num: loginHariIni,   label: 'Login Hari Ini',     icon: <UserCheck size={16} />, color: '#5C4FE5', bg: '#EEEDFE', clickable: false },
          { num: aktifMingguIni, label: 'Aktif Minggu Ini',   icon: <Users size={16} />,     color: '#166534', bg: '#DCFCE7', clickable: false },
          { num: tidakAktif,     label: 'Tidak Aktif (>7hr)', icon: <UserX size={16} />,     color: '#991B1B', bg: '#FEE2E2', clickable: true },
          { num: totalCount,     label: 'Total Log',          icon: <Activity size={16} />,  color: '#92400E', bg: '#FEF3C7', clickable: false },
        ].map((s, i) => (
          <div
            key={i}
            onClick={s.clickable ? () => setShowInactive(!showInactive) : undefined}
            className={`bg-white border rounded-2xl p-4 ${s.clickable ? 'cursor-pointer hover:border-[#991B1B] transition-colors' : ''}`}
            style={{ borderColor: s.clickable && showInactive ? '#991B1B' : '#E5E3FF' }}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: s.bg, color: s.color }}>
                {s.icon}
              </div>
            </div>
            <div className="text-2xl font-black" style={{ color: s.color }}>{s.num}</div>
            <div className="text-xs text-[#7B78A8] font-semibold mt-0.5">
              {s.label}
              {s.clickable && <span className="ml-1 text-[10px]">— klik untuk detail</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Daftar User Tidak Aktif */}
      {showInactive && inactiveUsers.length > 0 && (
        <div className="bg-white border border-[#FEE2E2] rounded-2xl p-4 mb-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <UserX size={14} className="text-[#991B1B]" />
              <p className="text-xs font-bold text-[#991B1B] uppercase tracking-wide">User Tidak Aktif {'>'} 7 Hari</p>
            </div>
            <button onClick={() => setShowInactive(false)} className="text-xs text-[#7B78A8] hover:text-[#991B1B] transition">
              Tutup
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#FEE2E2]">
                  <th className="px-3 py-2 text-[10px] font-bold text-[#7B78A8] uppercase tracking-wide">Nama</th>
                  <th className="px-3 py-2 text-[10px] font-bold text-[#7B78A8] uppercase tracking-wide">Role</th>
                  <th className="px-3 py-2 text-[10px] font-bold text-[#7B78A8] uppercase tracking-wide">Terakhir Aktif</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#FEF3C7]">
                {inactiveUsers.map(u => {
                  const roleMeta = ROLE_LABELS[u.role] ?? { label: u.role, color: '#666', bg: '#f0f0f0' }
                  return (
                    <tr key={u.id} className="hover:bg-[#FFF8F8] transition-colors">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                            style={{ background: roleMeta.color }}>
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-xs font-semibold text-[#1A1640]">{u.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: roleMeta.bg, color: roleMeta.color }}>
                          {roleMeta.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-[#7B78A8]">
                        {u.lastSeen ? fmtDate(u.lastSeen) : 'Belum pernah login'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top Pages */}
      {topPages.length > 0 && (
        <div className="bg-white border border-[#E5E3FF] rounded-2xl p-4 mb-5">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 size={14} className="text-[#5C4FE5]" />
            <p className="text-xs font-bold text-[#7B78A8] uppercase tracking-wide">Halaman Paling Sering Dibuka (7 Hari)</p>
          </div>
          <div className="space-y-2">
            {topPages.map((tp, i) => {
              const maxCount = topPages[0].count
              const pct = Math.round((tp.count / maxCount) * 100)
              return (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-36 lg:w-48 text-xs font-semibold text-[#1A1640] truncate">{tp.page}</div>
                  <div className="flex-1 h-5 bg-[#F0EFFF] rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-[#5C4FE5] transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-xs font-bold text-[#5C4FE5] w-10 text-right">{tp.count}x</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border border-[#E5E3FF] rounded-2xl px-4 py-3 mb-4 flex items-center gap-3 flex-wrap">
        <Filter size={14} className="text-[#7B78A8]" />
        <select value={filterRole} onChange={e => { setFilterRole(e.target.value); setPage(1) }}
          className="px-2.5 py-1.5 border border-[#E5E3FF] rounded-lg text-xs text-[#1A1640] bg-white focus:outline-none focus:border-[#5C4FE5]">
          <option value="">Semua Role</option>
          <option value="tutor">Tutor</option>
          <option value="parent">Ortu</option>
          <option value="student">Siswa</option>
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
          <div className="p-12 text-center text-sm text-[#7B78A8]">
            <Activity size={32} strokeWidth={1.5} className="text-[#C4BFFF] mx-auto mb-2" />
            Belum ada data aktivitas
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[#E5E3FF] bg-[#F7F6FF]">
                    <th className="px-4 py-3 text-[10px] font-bold text-[#7B78A8] uppercase tracking-wide">User</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-[#7B78A8] uppercase tracking-wide">Role</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-[#7B78A8] uppercase tracking-wide">Halaman</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-[#7B78A8] uppercase tracking-wide">Waktu</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-[#7B78A8] uppercase tracking-wide">Device</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0EFFF]">
                  {logs.map((log: any) => {
                    const roleMeta = ROLE_LABELS[log.user_role] ?? { label: log.user_role, color: '#666', bg: '#f0f0f0' }
                    const name = userNames[log.user_id] ?? log.user_id?.slice(0, 8) ?? '—'
                    const w = log.metadata?.w
                    const device = w ? (w < 768 ? 'Mobile' : w < 1024 ? 'Tablet' : 'Desktop') : '—'

                    return (
                      <tr key={log.id} className="hover:bg-[#F7F6FF] transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                              style={{ background: roleMeta.color }}>
                              {name.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-xs font-semibold text-[#1A1640] truncate max-w-[120px]">{name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{ background: roleMeta.bg, color: roleMeta.color }}>
                            {roleMeta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-[#1A1640] font-mono max-w-[200px] truncate">{log.page}</td>
                        <td className="px-4 py-3">
                          <div className="text-xs text-[#1A1640]">{fmtDate(log.created_at)}</div>
                          <div className="text-[10px] text-[#9B97B2]">{fmtTime(log.created_at)} WIT</div>
                        </td>
                        <td className="px-4 py-3 text-xs text-[#7B78A8]">{device}</td>
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
