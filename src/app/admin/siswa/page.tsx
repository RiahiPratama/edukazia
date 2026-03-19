'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import Link from 'next/link'
import { Search, Plus, Pencil, Trash2, GraduationCap, Phone, Mail, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'

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
  { value: 'active',   label: 'Aktif',        cls: 'bg-[#E6F4EC] text-[#1A5C36]' },
  { value: 'jeda',     label: 'Jeda',          cls: 'bg-[#FEF3E2] text-[#92400E]' },
  { value: 'inactive', label: 'Tidak Aktif',   cls: 'bg-[#FEE9E9] text-[#991B1B]' },
]

function getStatusStyle(status: string) {
  return STATUS_OPTIONS.find(s => s.value === status) ?? STATUS_OPTIONS[0]
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
  const [statusMenuId, setStatusMenuId] = useState<string | null>(null)
  const [updatingId,   setUpdatingId]   = useState<string | null>(null)

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
        const matchSearch =
          s.profiles?.full_name?.toLowerCase().includes(q) ||
          s.profiles?.email?.toLowerCase().includes(q) ||
          s.profiles?.phone?.toLowerCase().includes(q)
        const matchStatus = filterStatus === 'all' || s.status === filterStatus
        return matchSearch && matchStatus
      })
    )
    setPage(1)
  }, [search, filterStatus, siswaList])

  // Tutup dropdown status saat klik di luar
  useEffect(() => {
    function handleClickOutside() { setStatusMenuId(null) }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

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
    } catch (err: any) {
      setError(err.message ?? 'Gagal memuat data siswa')
    } finally {
      setLoading(false)
    }
  }

  async function handleStatusChange(siswaId: string, newStatus: string) {
    setUpdatingId(siswaId); setStatusMenuId(null)
    await supabase.from('students').update({ status: newStatus }).eq('id', siswaId)
    setSiswaList(prev => prev.map(s => s.id === siswaId ? { ...s, status: newStatus } : s))
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

  // Summary counts
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
        <Link href="/admin/siswa/baru"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
          style={{ backgroundColor: '#5C4FE5' }}>
          <Plus size={16}/> Tambah Siswa
        </Link>
      </div>

      {/* Summary status */}
      {!loading && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: 'Aktif',      count: countActive,   value: 'active',   cls: 'border-[#A7F3D0] bg-[#E6F4EC]', textCls: 'text-[#1A5C36]' },
            { label: 'Jeda',       count: countJeda,     value: 'jeda',     cls: 'border-[#FCD34D] bg-[#FEF3E2]', textCls: 'text-[#92400E]' },
            { label: 'Tidak Aktif',count: countInactive, value: 'inactive', cls: 'border-[#FCA5A5] bg-[#FEE9E9]', textCls: 'text-[#991B1B]' },
          ].map(s => (
            <button key={s.value} onClick={() => setFilterStatus(filterStatus === s.value ? 'all' : s.value)}
              className={`rounded-xl border-2 p-3 text-left transition-all ${s.cls} ${filterStatus === s.value ? 'ring-2 ring-offset-1 ring-[#5C4FE5]' : 'hover:opacity-80'}`}>
              <div className={`text-xl font-black ${s.textCls}`}>{s.count}</div>
              <div className={`text-xs font-semibold ${s.textCls}`}>{s.label}</div>
            </button>
          ))}
        </div>
      )}

      {/* Search + filter */}
      <div className="flex gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7B78A8]"/>
          <input type="text" placeholder="Cari nama, email, atau no. telepon..."
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
                  <td className="px-5 py-4"><div className="h-4 w-20 bg-gray-200 rounded"/></td>
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
                const nama    = siswa.profiles?.full_name ?? '—'
                const email   = siswa.profiles?.email ?? '—'
                const phone   = siswa.profiles?.phone ?? '—'
                const tanggal = siswa.created_at
                  ? new Date(siswa.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                  : '—'
                const statusStyle = getStatusStyle(siswa.status)
                const isMenuOpen  = statusMenuId === siswa.id
                const isUpdating  = updatingId === siswa.id

                return (
                  <tr key={siswa.id} className="bg-white hover:bg-[#F7F6FF] transition-colors">
                    <td className="px-5 py-4 text-[#7B78A8] text-xs font-medium">{(page-1)*PER_PAGE+idx+1}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        {siswa.profiles?.avatar_url ? (
                          <img src={siswa.profiles.avatar_url} alt={nama} className="w-9 h-9 rounded-full object-cover flex-shrink-0"/>
                        ) : (
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                            style={{ backgroundColor: siswa.status === 'inactive' ? '#9CA3AF' : siswa.status === 'jeda' ? '#D97706' : '#5C4FE5' }}>
                            {getInitials(nama)}
                          </div>
                        )}
                        <div>
                          <span className={`font-medium ${siswa.status === 'inactive' ? 'text-gray-400' : 'text-[#1A1640]'}`}>{nama}</span>
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
                    {/* Status dropdown */}
                    <td className="px-5 py-4">
                      <div className="relative" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => setStatusMenuId(isMenuOpen ? null : siswa.id)}
                          disabled={isUpdating}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all hover:opacity-80 ${statusStyle.cls} ${isUpdating ? 'opacity-60' : ''}`}>
                          {isUpdating ? '...' : statusStyle.label}
                          <ChevronDown size={10} className={`transition-transform ${isMenuOpen ? 'rotate-180' : ''}`}/>
                        </button>
                        {isMenuOpen && (
                          <div className="absolute left-0 top-8 z-30 bg-white rounded-xl border border-[#E5E3FF] shadow-lg overflow-hidden min-w-[130px]">
                            {STATUS_OPTIONS.map(opt => (
                              <button key={opt.value}
                                onClick={() => handleStatusChange(siswa.id, opt.value)}
                                className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold text-left hover:bg-[#F7F6FF] transition-colors ${siswa.status === opt.value ? 'bg-[#F0EEFF]' : ''}`}>
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${opt.value === 'active' ? 'bg-[#27A05A]' : opt.value === 'jeda' ? 'bg-[#D97706]' : 'bg-[#DC2626]'}`}/>
                                <span className="text-[#1A1640]">{opt.label}</span>
                                {siswa.status === opt.value && <span className="ml-auto text-[#5C4FE5]">✓</span>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
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

      {/* Modal hapus */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 shadow-xl max-w-sm w-full">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
              <Trash2 size={22} className="text-red-500"/>
            </div>
            <h3 className="text-lg font-bold text-[#1A1640] mb-1">Hapus Siswa?</h3>
            <p className="text-sm text-[#7B78A8] mb-2">Data siswa akan dihapus permanen.</p>
            <p className="text-xs text-[#7B78A8] mb-6 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
              💡 Jika siswa kemungkinan kembali, gunakan status <strong>Jeda</strong> atau <strong>Tidak Aktif</strong> daripada menghapus.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-[#7B78A8] border transition-colors hover:bg-gray-50" style={{ borderColor: '#E5E3FF' }}>
                Batal
              </button>
              <button onClick={() => handleDelete(deleteId)} disabled={deleting}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-70">
                {deleting ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
