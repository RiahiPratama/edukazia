'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import Link from 'next/link'
import { Search, Plus, Pencil, Trash2, GraduationCap, Phone, Mail, ChevronLeft, ChevronRight, RefreshCw, UserPlus } from 'lucide-react'
import ConfirmModal from '@/components/ui/ConfirmModal'

interface Siswa {
  id: string
  profile_id: string
  created_at: string
  status: string
  profiles: {
    id: string
    full_name: string
    email: string
    phone: string | null
    avatar_url: string | null
  } | null
}

const STATUS_OPTIONS = [
  { value: 'active',   label: 'Aktif',       cls: 'bg-[#E6F4EC] text-[#1A5C36]', dot: 'bg-[#27A05A]' },
  { value: 'jeda',     label: 'Jeda',         cls: 'bg-[#FEF3E2] text-[#92400E]', dot: 'bg-[#D97706]' },
  { value: 'inactive', label: 'Tidak Aktif',  cls: 'bg-[#FEE9E9] text-[#991B1B]', dot: 'bg-[#DC2626]' },
]

const AVATAR_COLORS: Record<string, string> = {
  active:   '#5C4FE5',
  jeda:     '#D97706',
  inactive: '#9CA3AF',
}

function getStatusStyle(status: string) {
  return STATUS_OPTIONS.find(s => s.value === status) ?? STATUS_OPTIONS[0]
}

function cycleStatus(current: string) {
  const order = ['active', 'jeda', 'inactive']
  const idx = order.indexOf(current)
  return order[(idx + 1) % order.length]
}

function cycleLabel(current: string) {
  const next = cycleStatus(current)
  return getStatusStyle(next).label
}

export default function SiswaPage() {
  const [siswaList,    setSiswaList]    = useState<Siswa[]>([])
  const [filtered,     setFiltered]     = useState<Siswa[]>([])
  const [search,       setSearch]       = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)
  const [page,         setPage]         = useState(1)
  const [deleteId,     setDeleteId]     = useState<string | null>(null)
  const [deleting,     setDeleting]     = useState(false)
  const [updatingId,   setUpdatingId]   = useState<string | null>(null)
  const [parentMap,    setParentMap]    = useState<Record<string, { email: string; phone: string }>>({})

  const PER_PAGE = 10

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => { fetchSiswa() }, [])

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(
      siswaList.filter(s => {
        const parent = parentMap[s.id]
        const matchSearch = !q ||
          s.profiles?.full_name?.toLowerCase().includes(q) ||
          s.profiles?.email?.toLowerCase().includes(q) ||
          s.profiles?.phone?.toLowerCase().includes(q) ||
          parent?.email?.toLowerCase().includes(q) ||
          parent?.phone?.toLowerCase().includes(q)
        const matchStatus = filterStatus === 'all' || s.status === filterStatus
        return matchSearch && matchStatus
      })
    )
    setPage(1)
  }, [search, filterStatus, siswaList, parentMap])

  async function fetchSiswa() {
    setLoading(true); setError(null)
    try {
      const { data: students, error: studentsErr } = await supabase
        .from('students').select('id, profile_id, created_at, status').order('created_at', { ascending: false })
      if (studentsErr) throw studentsErr
      if (!students || students.length === 0) { setSiswaList([]); setFiltered([]); setLoading(false); return }

      const profileIds = students.map((s: any) => s.profile_id).filter(Boolean)
      const { data: profiles, error: profilesErr } = await supabase
        .from('profiles').select('id, full_name, email, phone, avatar_url').in('id', profileIds)
      if (profilesErr) throw profilesErr

      const profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]))
      const merged: Siswa[] = students.map((s: any) => ({
        ...s,
        status: s.status ?? 'active',
        profiles: profileMap[s.profile_id] ?? null,
      }))
      const sorted = merged.sort((a, b) =>
        (a.profiles?.full_name ?? '').localeCompare(b.profiles?.full_name ?? '', 'id')
      )
      setSiswaList(sorted); setFiltered(sorted)

      // Fetch parent data untuk search via ortu
      const { data: studentRows } = await supabase
        .from('students')
        .select('id, parent_profile_id, relation_phone, relation_email')
        .in('id', students.map((s: any) => s.id))

      const parentProfileIds = [...new Set(
        (studentRows ?? []).map((s: any) => s.parent_profile_id).filter(Boolean)
      )]
      const { data: parentProfiles } = parentProfileIds.length > 0
        ? await supabase.from('profiles').select('id, email, phone').in('id', parentProfileIds)
        : { data: [] }

      const parentProfMap = Object.fromEntries((parentProfiles ?? []).map((p: any) => [p.id, p]))
      const pMap: Record<string, { email: string; phone: string }> = {}
      ;(studentRows ?? []).forEach((s: any) => {
        const pp = parentProfMap[s.parent_profile_id]
        pMap[s.id] = {
          email: (pp?.email ?? '') + ' ' + (s.relation_email ?? ''),
          phone: (pp?.phone ?? '') + ' ' + (s.relation_phone ?? ''),
        }
      })
      setParentMap(pMap)
    } catch (err: any) {
      setError(err.message ?? 'Gagal memuat data siswa')
    } finally {
      setLoading(false)
    }
  }

  async function handleStatusCycle(siswa: Siswa) {
    const newStatus = cycleStatus(siswa.status)
    setUpdatingId(siswa.id)
    await supabase.from('students').update({ status: newStatus }).eq('id', siswa.id)
    setSiswaList(prev => prev.map(s => s.id === siswa.id ? { ...s, status: newStatus } : s))
    setUpdatingId(null)
  }

  async function handleDelete(id: string) {
    setDeleting(true)
    const { error } = await supabase.from('students').delete().eq('id', id)
    if (!error) setSiswaList(prev => prev.filter(s => s.id !== id))
    setDeleteId(null); setDeleting(false)
  }

  function getInitials(name: string) {
    return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
  }

  const totalPages = Math.ceil(filtered.length / PER_PAGE)
  const paginated  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  const countActive   = siswaList.filter(s => s.status === 'active').length
  const countJeda     = siswaList.filter(s => s.status === 'jeda').length
  const countInactive = siswaList.filter(s => s.status === 'inactive').length

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1640]">Daftar Siswa</h1>
          <p className="text-sm text-[#7B78A8] mt-0.5">{loading ? '...' : `${siswaList.length} siswa terdaftar`}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/daftarkan"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 active:scale-95 border"
            style={{ borderColor: '#5C4FE5', color: '#5C4FE5', backgroundColor: '#EEEDFE' }}>
            <UserPlus size={16}/> Daftarkan ke Kelas
          </Link>
          <Link href="/admin/siswa/baru"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
            style={{ backgroundColor: '#5C4FE5' }}>
            <Plus size={16}/> Tambah Siswa
          </Link>
        </div>
      </div>

      {/* Summary cards */}
      {!loading && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: 'Aktif',       count: countActive,   value: 'active',   border: 'border-[#A7F3D0]', bg: 'bg-[#E6F4EC]', text: 'text-[#1A5C36]' },
            { label: 'Jeda',        count: countJeda,     value: 'jeda',     border: 'border-[#FCD34D]', bg: 'bg-[#FEF3E2]', text: 'text-[#92400E]' },
            { label: 'Tidak Aktif', count: countInactive, value: 'inactive', border: 'border-[#FCA5A5]', bg: 'bg-[#FEE9E9]', text: 'text-[#991B1B]' },
          ].map(s => (
            <button key={s.value}
              onClick={() => setFilterStatus(filterStatus === s.value ? 'all' : s.value)}
              className={`rounded-xl border-2 p-3 text-left transition-all ${s.bg} ${s.border} ${filterStatus === s.value ? 'ring-2 ring-offset-1 ring-[#5C4FE5]' : 'hover:opacity-80'}`}>
              <div className={`text-xl font-black ${s.text}`}>{s.count}</div>
              <div className={`text-xs font-semibold ${s.text}`}>{s.label}</div>
            </button>
          ))}
        </div>
      )}

      {/* Search + filter */}
      <div className="flex gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7B78A8]"/>
          <input type="text" placeholder="Cari nama, email, no. HP siswa atau orang tua..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border outline-none transition-all focus:ring-2 focus:ring-[#5C4FE5]/30 focus:border-[#5C4FE5]"
            style={{ borderColor: '#E5E3FF', backgroundColor: '#F7F6FF', color: '#1A1640' }}/>
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-3.5 py-2.5 text-sm border border-[#E5E3FF] rounded-xl bg-white text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] transition">
          <option value="all">Semua Status</option>
          <option value="active">Aktif</option>
          <option value="jeda">Jeda</option>
          <option value="inactive">Tidak Aktif</option>
        </select>
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600">⚠️ {error}</div>
      )}

      {/* Table */}
      <div className="rounded-2xl border overflow-hidden shadow-sm" style={{ borderColor: '#E5E3FF' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: '#F7F6FF' }}>
              <th className="text-left px-5 py-3.5 font-semibold text-[#7B78A8] text-xs uppercase tracking-wider w-12">#</th>
              <th className="text-left px-5 py-3.5 font-semibold text-[#7B78A8] text-xs uppercase tracking-wider">Nama Siswa</th>
              <th className="text-left px-5 py-3.5 font-semibold text-[#7B78A8] text-xs uppercase tracking-wider hidden md:table-cell">Email</th>
              <th className="text-left px-5 py-3.5 font-semibold text-[#7B78A8] text-xs uppercase tracking-wider hidden lg:table-cell">Telepon</th>
              <th className="text-left px-5 py-3.5 font-semibold text-[#7B78A8] text-xs uppercase tracking-wider">Status</th>
              <th className="text-right px-5 py-3.5 font-semibold text-[#7B78A8] text-xs uppercase tracking-wider">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: '#E5E3FF' }}>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-5 py-4"><div className="h-4 w-4 bg-gray-200 rounded"/></td>
                  <td className="px-5 py-4"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-full bg-gray-200"/><div className="h-4 w-32 bg-gray-200 rounded"/></div></td>
                  <td className="px-5 py-4 hidden md:table-cell"><div className="h-4 w-40 bg-gray-200 rounded"/></td>
                  <td className="px-5 py-4 hidden lg:table-cell"><div className="h-4 w-28 bg-gray-200 rounded"/></td>
                  <td className="px-5 py-4"><div className="h-5 w-20 bg-gray-200 rounded-full"/></td>
                  <td className="px-5 py-4"><div className="h-4 w-16 bg-gray-200 rounded ml-auto"/></td>
                </tr>
              ))
            ) : paginated.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-16 text-center">
                  <div className="flex flex-col items-center gap-3 text-[#7B78A8]">
                    <GraduationCap size={40} strokeWidth={1.5}/>
                    <p className="font-medium">{search || filterStatus !== 'all' ? 'Siswa tidak ditemukan' : 'Belum ada siswa terdaftar'}</p>
                    {!search && filterStatus === 'all' && (
                      <Link href="/admin/siswa/baru" className="text-sm font-semibold mt-1 hover:underline" style={{ color: '#5C4FE5' }}>
                        + Tambah siswa pertama
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              paginated.map((siswa, idx) => {
                const nama       = siswa.profiles?.full_name ?? '—'
                const email      = siswa.profiles?.email ?? '—'
                const phone      = siswa.profiles?.phone ?? '—'
                const statusSt   = getStatusStyle(siswa.status)
                const isUpdating = updatingId === siswa.id
                return (
                  <tr key={siswa.id} className="bg-white hover:bg-[#F7F6FF] transition-colors">
                    <td className="px-5 py-4 text-[#7B78A8] text-xs font-medium">{(page-1)*PER_PAGE+idx+1}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                          style={{ backgroundColor: AVATAR_COLORS[siswa.status] ?? '#5C4FE5' }}>
                          {getInitials(nama)}
                        </div>
                        <div>
                          <span className={`font-medium ${siswa.status === 'inactive' ? 'text-gray-400' : 'text-[#1A1640]'}`}>{nama}</span>
                          {search && !nama.toLowerCase().includes(search.toLowerCase()) && parentMap[siswa.id] && (
                            <p className="text-[10px] text-[#7B78A8] mt-0.5">ditemukan via orang tua</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 hidden md:table-cell">
                      <div className="flex items-center gap-1.5 text-[#7B78A8]">
                        <Mail size={13} className="flex-shrink-0"/>
                        <span className="truncate max-w-[200px]">{email}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 hidden lg:table-cell">
                      <div className="flex items-center gap-1.5 text-[#7B78A8]">
                        <Phone size={13} className="flex-shrink-0"/>
                        <span>{phone}</span>
                      </div>
                    </td>
                    {/* Status — klik untuk cycle */}
                    <td className="px-5 py-4">
                      <button
                        onClick={() => handleStatusCycle(siswa)}
                        disabled={isUpdating}
                        title={`Ganti ke: ${cycleLabel(siswa.status)}`}
                        className={`group flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all hover:opacity-75 active:scale-95 disabled:opacity-50 ${statusSt.cls}`}>
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusSt.dot}`}/>
                        {isUpdating
                          ? <RefreshCw size={10} className="animate-spin"/>
                          : statusSt.label}
                      </button>
                      <p className="text-[9px] text-[#7B78A8] mt-0.5 pl-1">klik untuk ganti</p>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/admin/siswa/${siswa.id}/edit`}
                          className="p-1.5 rounded-lg text-[#7B78A8] hover:text-[#5C4FE5] hover:bg-[#F0EEFF] transition-colors" title="Edit">
                          <Pencil size={15}/>
                        </Link>
                        <button onClick={() => setDeleteId(siswa.id)}
                          className="p-1.5 rounded-lg text-[#7B78A8] hover:text-red-500 hover:bg-red-50 transition-colors" title="Hapus">
                          <Trash2 size={15}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>

        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t" style={{ borderColor: '#E5E3FF', backgroundColor: '#F7F6FF' }}>
            <span className="text-xs text-[#7B78A8]">Halaman {page} dari {totalPages}</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1}
                className="p-1.5 rounded-lg disabled:opacity-40 hover:bg-white transition-colors border" style={{ borderColor: '#E5E3FF' }}>
                <ChevronLeft size={15}/>
              </button>
              {Array.from({ length: totalPages }, (_, i) => i+1)
                .filter(p => p===1 || p===totalPages || Math.abs(p-page)<=1)
                .reduce<(number|'...')[]>((acc, p, i, arr) => {
                  if (i>0 && (p as number)-(arr[i-1] as number)>1) acc.push('...')
                  acc.push(p); return acc
                }, [])
                .map((p, i) => p==='...' ? (
                  <span key={`dots-${i}`} className="px-2 text-[#7B78A8] text-xs">…</span>
                ) : (
                  <button key={p} onClick={() => setPage(p as number)}
                    className="w-8 h-8 rounded-lg text-xs font-medium transition-colors"
                    style={{ backgroundColor: page===p?'#5C4FE5':'white', color: page===p?'white':'#374151', border: `1px solid ${page===p?'#5C4FE5':'#E5E3FF'}` }}>
                    {p}
                  </button>
                ))}
              <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages}
                className="p-1.5 rounded-lg disabled:opacity-40 hover:bg-white transition-colors border" style={{ borderColor: '#E5E3FF' }}>
                <ChevronRight size={15}/>
              </button>
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!deleteId}
        title="Hapus Siswa?"
        description="Data siswa akan dihapus permanen dan tidak dapat dikembalikan."
        confirmText="Ya, Hapus"
        loading={deleting}
        note="Jika siswa kemungkinan kembali, gunakan status Jeda atau Tidak Aktif daripada hapus permanen."
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}
