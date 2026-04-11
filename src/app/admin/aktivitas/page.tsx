'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Activity, Users, Filter, RefreshCw,
  ChevronLeft, ChevronRight, UserCheck, UserX, BarChart3,
  Send, Clock, X
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
  const [peakHours, setPeakHours]             = useState<number[]>(Array(24).fill(0))

  // Clickable card data
  const [inactiveUsers, setInactiveUsers]     = useState<any[]>([])
  const [showInactive, setShowInactive]       = useState(false)
  const [todayUsers, setTodayUsers]           = useState<any[]>([])
  const [showToday, setShowToday]             = useState(false)
  const [weekUsers, setWeekUsers]             = useState<any[]>([])
  const [showWeek, setShowWeek]               = useState(false)

  // Retention
  const [churnedUsers, setChurnedUsers]       = useState<any[]>([])

  // WA sending state
  const [sendingWA, setSendingWA]             = useState<Record<string, 'loading' | 'sent' | 'failed' | 'skipped'>>({})
  const [blasting, setBlasting]               = useState(false)

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

    // Login hari ini
    const { data: todayData } = await supabase
      .from('user_activity')
      .select('user_id, user_role, created_at')
      .neq('user_role', 'admin')
      .gte('created_at', startToday)
      .lte('created_at', endToday)

    const todayMap = new Map<string, { role: string; time: string }>()
    todayData?.forEach(d => {
      if (!todayMap.has(d.user_id)) todayMap.set(d.user_id, { role: d.user_role, time: d.created_at })
    })
    setLoginHariIni(todayMap.size)

    // Aktif minggu ini
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    const { data: weekData } = await supabase
      .from('user_activity')
      .select('user_id, user_role, created_at')
      .neq('user_role', 'admin')
      .gte('created_at', weekAgo.toISOString())

    const weekMap = new Map<string, { role: string; time: string }>()
    weekData?.forEach(d => {
      if (!weekMap.has(d.user_id)) weekMap.set(d.user_id, { role: d.user_role, time: d.created_at })
    })
    setAktifMingguIni(weekMap.size)

    // All profiles yang bisa login
    const { data: allProfiles } = await supabase
      .from('profiles')
      .select('id, full_name, role, phone')
      .in('role', ['parent', 'tutor', 'student'])
      .not('email', 'is', null)

    // Tidak aktif
    const inactiveProfiles = (allProfiles ?? []).filter(p => !weekMap.has(p.id))
    setTidakAktif(inactiveProfiles.length)

    // Ambil nama siswa untuk setiap ortu
    const allIds = (allProfiles ?? []).map(p => p.id)
    const { data: allStudents } = await supabase
      .from('students')
      .select('id, profile_id, parent_profile_id')
      .in('parent_profile_id', allIds)

    const studentProfIds = [...new Set((allStudents ?? []).map(s => s.profile_id).filter(Boolean))]
    const { data: studentProfs } = studentProfIds.length > 0
      ? await supabase.from('profiles').select('id, full_name').in('id', studentProfIds)
      : { data: [] }
    const sNameMap: Record<string, string> = {}
    studentProfs?.forEach(p => { sNameMap[p.id] = p.full_name ?? '' })

    function getChildNames(profileId: string) {
      const kids = (allStudents ?? []).filter(s => s.parent_profile_id === profileId)
      const isDiriSendiri = kids.length === 1 && kids[0].profile_id === profileId
      if (isDiriSendiri) return 'Diri Sendiri'
      return kids.map(k => sNameMap[k.profile_id] ?? '').filter(Boolean).join(', ') || '—'
    }

    // Last seen untuk inactive
    const inactiveIds = inactiveProfiles.map(p => p.id)
    let lastSeenMap: Record<string, string> = {}
    if (inactiveIds.length > 0) {
      const { data: lastAct } = await supabase
        .from('user_activity')
        .select('user_id, created_at')
        .in('user_id', inactiveIds)
        .order('created_at', { ascending: false })
      lastAct?.forEach(a => {
        if (!lastSeenMap[a.user_id]) lastSeenMap[a.user_id] = a.created_at
      })
    }

    setInactiveUsers(inactiveProfiles.map(p => ({
      id: p.id, name: p.full_name, role: p.role, phone: p.phone,
      children: getChildNames(p.id),
      lastSeen: lastSeenMap[p.id] ?? null,
    })))

    // Today users detail
    setTodayUsers([...todayMap.entries()].map(([id, info]) => ({
      id, name: userNames[id] ?? (allProfiles ?? []).find(p => p.id === id)?.full_name ?? id.slice(0, 8),
      role: info.role, time: info.time,
      children: getChildNames(id),
    })))

    // Week users detail
    setWeekUsers([...weekMap.entries()].map(([id, info]) => ({
      id, name: userNames[id] ?? (allProfiles ?? []).find(p => p.id === id)?.full_name ?? id.slice(0, 8),
      role: info.role, time: info.time,
      children: getChildNames(id),
    })))

    // Retention: aktif 2 minggu lalu tapi nggak minggu ini
    const twoWeeksAgo = new Date()
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
    const { data: prevData } = await supabase
      .from('user_activity')
      .select('user_id, user_role')
      .neq('user_role', 'admin')
      .gte('created_at', twoWeeksAgo.toISOString())
      .lt('created_at', weekAgo.toISOString())

    const prevSet = new Set(prevData?.map(d => d.user_id) ?? [])
    const churned = [...prevSet].filter(id => !weekMap.has(id))
    setChurnedUsers(churned.map(id => ({
      id, name: (allProfiles ?? []).find(p => p.id === id)?.full_name ?? id.slice(0, 8),
      role: prevData?.find(d => d.user_id === id)?.user_role ?? '—',
      children: getChildNames(id),
    })))

    // Peak hours (7 hari)
    const hours = Array(24).fill(0)
    weekData?.forEach(d => {
      const h = new Date(d.created_at).toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Jayapura' })
      hours[parseInt(h)] = (hours[parseInt(h)] || 0) + 1
    })
    setPeakHours(hours)

    // Top pages
    const { data: pageData } = await supabase
      .from('user_activity')
      .select('page')
      .neq('user_role', 'admin')
      .gte('created_at', weekAgo.toISOString())

    const pc: Record<string, number> = {}
    pageData?.forEach(a => { pc[a.page] = (pc[a.page] ?? 0) + 1 })
    setTopPages(
      Object.entries(pc).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([page, count]) => ({ page, count }))
    )
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

  async function sendWAToUser(profileId: string) {
    setSendingWA(prev => ({ ...prev, [profileId]: 'loading' }))
    try {
      const res = await fetch('/api/wa/notify-inactive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_id: profileId }),
      })
      const data = await res.json()
      if (data.sent > 0) {
        setSendingWA(prev => ({ ...prev, [profileId]: 'sent' }))
      } else {
        const reason = data.details?.[0]?.reason ?? ''
        setSendingWA(prev => ({ ...prev, [profileId]: reason.includes('Sudah dikirim') ? 'skipped' : 'failed' }))
      }
    } catch {
      setSendingWA(prev => ({ ...prev, [profileId]: 'failed' }))
    }
  }

  async function blastAll() {
    setBlasting(true)
    try {
      const res = await fetch('/api/wa/notify-inactive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      data.details?.forEach((d: any) => {
        const prof = inactiveUsers.find(u => u.name === d.name)
        if (prof) {
          setSendingWA(prev => ({
            ...prev,
            [prof.id]: d.sent ? 'sent' : d.reason?.includes('Sudah dikirim') ? 'skipped' : 'failed'
          }))
        }
      })
    } catch {}
    setBlasting(false)
  }

  function resetFilters() { setFilterRole(''); setFilterFrom(''); setFilterTo(''); setPage(1) }

  function closeAllPanels() { setShowInactive(false); setShowToday(false); setShowWeek(false) }

  function togglePanel(panel: 'inactive' | 'today' | 'week') {
    closeAllPanels()
    if (panel === 'inactive') setShowInactive(prev => !prev)
    if (panel === 'today') setShowToday(prev => !prev)
    if (panel === 'week') setShowWeek(prev => !prev)
  }

  const totalPages = Math.ceil(totalCount / PER_PAGE)
  const hasFilters = filterRole || filterFrom || filterTo
  const peakMax = Math.max(...peakHours, 1)

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-black text-[#1A1640] font-['Sora']">Aktivitas User</h1>
        <p className="text-sm text-[#7B78A8] mt-1">Monitor siapa yang login dan buka halaman apa</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          { key: 'today', num: loginHariIni, label: 'Login Hari Ini', icon: <UserCheck size={16} />, color: '#5C4FE5', bg: '#EEEDFE', active: showToday },
          { key: 'week', num: aktifMingguIni, label: 'Aktif Minggu Ini', icon: <Users size={16} />, color: '#166534', bg: '#DCFCE7', active: showWeek },
          { key: 'inactive', num: tidakAktif, label: 'Tidak Aktif (>7hr)', icon: <UserX size={16} />, color: '#991B1B', bg: '#FEE2E2', active: showInactive },
          { key: 'log', num: totalCount, label: 'Total Log', icon: <Activity size={16} />, color: '#92400E', bg: '#FEF3C7', active: false },
        ].map((s) => (
          <div
            key={s.key}
            onClick={s.key !== 'log' ? () => togglePanel(s.key as any) : undefined}
            className={`bg-white border rounded-2xl p-4 transition-colors ${s.key !== 'log' ? 'cursor-pointer hover:shadow-sm' : ''}`}
            style={{ borderColor: s.active ? s.color : '#E5E3FF' }}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: s.bg, color: s.color }}>
                {s.icon}
              </div>
            </div>
            <div className="text-2xl font-black" style={{ color: s.color }}>{s.num}</div>
            <div className="text-xs text-[#7B78A8] font-semibold mt-0.5">
              {s.label}
              {s.key !== 'log' && <span className="text-[10px] ml-1">— klik detail</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Panel: Login Hari Ini */}
      {showToday && todayUsers.length > 0 && (
        <div className="bg-white border border-[#EEEDFE] rounded-2xl p-4 mb-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <UserCheck size={14} className="text-[#5C4FE5]" />
              <p className="text-xs font-bold text-[#5C4FE5] uppercase tracking-wide">Login Hari Ini</p>
            </div>
            <button onClick={() => setShowToday(false)} className="p-1 rounded hover:bg-[#F0EFFF]"><X size={14} className="text-[#7B78A8]" /></button>
          </div>
          <div className="space-y-2">
            {todayUsers.map(u => {
              const rm = ROLE_LABELS[u.role] ?? { label: u.role, color: '#666', bg: '#f0f0f0' }
              return (
                <div key={u.id} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-[#F7F6FF]">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ background: rm.color }}>{u.name.charAt(0).toUpperCase()}</div>
                  <span className="text-xs font-semibold text-[#1A1640] flex-1">{u.name}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: rm.bg, color: rm.color }}>{rm.label}</span>
                  <span className="text-[10px] text-[#7B78A8]">{fmtTime(u.time)} WIT</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Panel: Aktif Minggu Ini */}
      {showWeek && weekUsers.length > 0 && (
        <div className="bg-white border border-[#DCFCE7] rounded-2xl p-4 mb-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users size={14} className="text-[#166534]" />
              <p className="text-xs font-bold text-[#166534] uppercase tracking-wide">Aktif Minggu Ini</p>
            </div>
            <button onClick={() => setShowWeek(false)} className="p-1 rounded hover:bg-[#F0FFF4]"><X size={14} className="text-[#7B78A8]" /></button>
          </div>
          <div className="space-y-2">
            {weekUsers.map(u => {
              const rm = ROLE_LABELS[u.role] ?? { label: u.role, color: '#666', bg: '#f0f0f0' }
              return (
                <div key={u.id} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-[#F7F6FF]">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ background: rm.color }}>{u.name.charAt(0).toUpperCase()}</div>
                  <span className="text-xs font-semibold text-[#1A1640] flex-1">{u.name}</span>
                  <span className="text-[10px] text-[#7B78A8]">{u.children}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: rm.bg, color: rm.color }}>{rm.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Panel: Tidak Aktif + WA */}
      {showInactive && inactiveUsers.length > 0 && (
        <div className="bg-white border border-[#FEE2E2] rounded-2xl p-4 mb-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <UserX size={14} className="text-[#991B1B]" />
              <p className="text-xs font-bold text-[#991B1B] uppercase tracking-wide">User Tidak Aktif {'>'} 7 Hari</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={blastAll}
                disabled={blasting}
                className="px-3 py-1.5 bg-[#991B1B] text-white text-[11px] font-bold rounded-lg hover:bg-[#7F1D1D] transition flex items-center gap-1.5 disabled:opacity-50">
                <Send size={11} />
                {blasting ? 'Mengirim...' : 'Blast Semua'}
              </button>
              <button onClick={() => setShowInactive(false)} className="p-1 rounded hover:bg-[#FEF2F2]"><X size={14} className="text-[#7B78A8]" /></button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#FEE2E2]">
                  <th className="px-3 py-2 text-[10px] font-bold text-[#7B78A8] uppercase tracking-wide">Nama</th>
                  <th className="px-3 py-2 text-[10px] font-bold text-[#7B78A8] uppercase tracking-wide">Siswa</th>
                  <th className="px-3 py-2 text-[10px] font-bold text-[#7B78A8] uppercase tracking-wide">Role</th>
                  <th className="px-3 py-2 text-[10px] font-bold text-[#7B78A8] uppercase tracking-wide">Terakhir Aktif</th>
                  <th className="px-3 py-2 text-[10px] font-bold text-[#7B78A8] uppercase tracking-wide">WA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#FEF3C7]">
                {inactiveUsers.map(u => {
                  const rm = ROLE_LABELS[u.role] ?? { label: u.role, color: '#666', bg: '#f0f0f0' }
                  const waState = sendingWA[u.id]
                  return (
                    <tr key={u.id} className="hover:bg-[#FFF8F8] transition-colors">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0" style={{ background: rm.color }}>
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-xs font-semibold text-[#1A1640]">{u.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-[#7B78A8] max-w-[150px] truncate">{u.children}</td>
                      <td className="px-3 py-2.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: rm.bg, color: rm.color }}>{rm.label}</span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-[#7B78A8]">
                        {u.lastSeen ? fmtDate(u.lastSeen) : 'Belum pernah'}
                      </td>
                      <td className="px-3 py-2.5">
                        {waState === 'sent' ? (
                          <span className="text-[10px] font-bold text-[#166534] bg-[#DCFCE7] px-2 py-0.5 rounded-full">Terkirim ✓</span>
                        ) : waState === 'skipped' ? (
                          <span className="text-[10px] font-bold text-[#92400E] bg-[#FEF3C7] px-2 py-0.5 rounded-full">Sudah dikirim</span>
                        ) : waState === 'failed' ? (
                          <span className="text-[10px] font-bold text-[#991B1B] bg-[#FEE2E2] px-2 py-0.5 rounded-full">Gagal</span>
                        ) : waState === 'loading' ? (
                          <span className="text-[10px] text-[#7B78A8]">Mengirim...</span>
                        ) : (
                          <button
                            onClick={() => sendWAToUser(u.id)}
                            disabled={!u.phone}
                            className="text-[10px] font-bold text-[#5C4FE5] bg-[#EEEDFE] px-2.5 py-1 rounded-lg hover:bg-[#5C4FE5] hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1">
                            <Send size={10} />
                            {u.phone ? 'Kirim' : 'No HP'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Retention Alert */}
      {churnedUsers.length > 0 && (
        <div className="bg-[#FEF3C7] border border-[#FAC775] rounded-2xl p-4 mb-5">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={14} className="text-[#92400E]" />
            <p className="text-xs font-bold text-[#92400E] uppercase tracking-wide">
              Berhenti Akses Minggu Ini — {churnedUsers.length} user
            </p>
          </div>
          <p className="text-xs text-[#92400E] mb-3">User yang minggu lalu aktif tapi minggu ini tidak. Prioritas follow-up.</p>
          <div className="flex flex-wrap gap-2">
            {churnedUsers.map(u => {
              const rm = ROLE_LABELS[u.role] ?? { label: u.role, color: '#666', bg: '#f0f0f0' }
              return (
                <div key={u.id} className="flex items-center gap-1.5 bg-white border border-[#FAC775] rounded-lg px-2.5 py-1.5">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white" style={{ background: rm.color }}>{u.name.charAt(0).toUpperCase()}</div>
                  <span className="text-[11px] font-semibold text-[#1A1640]">{u.name}</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: rm.bg, color: rm.color }}>{rm.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Peak Hours + Top Pages side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        {/* Peak Hours */}
        <div className="bg-white border border-[#E5E3FF] rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={14} className="text-[#5C4FE5]" />
            <p className="text-xs font-bold text-[#7B78A8] uppercase tracking-wide">Jam Sibuk (7 Hari) — WIT</p>
          </div>
          <div className="flex items-end gap-[3px] h-24">
            {peakHours.map((count, h) => (
              <div key={h} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full rounded-sm transition-all"
                  style={{
                    height: `${Math.max((count / peakMax) * 80, 2)}px`,
                    background: count === peakMax && count > 0 ? '#5C4FE5' : count > 0 ? '#C4BFFF' : '#F0EFFF',
                  }}
                />
                {h % 3 === 0 && <span className="text-[8px] text-[#7B78A8]">{h}</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Top Pages */}
        {topPages.length > 0 && (
          <div className="bg-white border border-[#E5E3FF] rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 size={14} className="text-[#5C4FE5]" />
              <p className="text-xs font-bold text-[#7B78A8] uppercase tracking-wide">Halaman Populer (7 Hari)</p>
            </div>
            <div className="space-y-2">
              {topPages.map((tp, i) => {
                const maxCount = topPages[0].count
                const pct = Math.round((tp.count / maxCount) * 100)
                return (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-32 lg:w-40 text-xs font-semibold text-[#1A1640] truncate">{tp.page}</div>
                    <div className="flex-1 h-5 bg-[#F0EFFF] rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-[#5C4FE5] transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="text-xs font-bold text-[#5C4FE5] w-8 text-right">{tp.count}x</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

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

      {/* Activity Log Table */}
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
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0" style={{ background: roleMeta.color }}>
                              {name.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-xs font-semibold text-[#1A1640] truncate max-w-[120px]">{name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: roleMeta.bg, color: roleMeta.color }}>{roleMeta.label}</span>
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
            <div className="flex items-center justify-between px-4 py-3 border-t border-[#E5E3FF]">
              <p className="text-xs text-[#7B78A8]">{(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, totalCount)} dari {totalCount}</p>
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
