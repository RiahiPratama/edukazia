'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Plus, X, Minus, Calendar, Trash2, Archive, ChevronDown, ChevronUp, Search, Users, GraduationCap, UserCircle, ArrowUpDown } from 'lucide-react'
import ConfirmModal from '@/components/ui/ConfirmModal'

type Kelas = {
  id: string
  label: string
  status: string
  max_participants: number
  created_at: string
  courses: { id: string; name: string; color: string | null } | null
  class_types: { name: string } | null
  tutors: { id: string; profiles: { full_name: string } | null } | null
  enrollments: { 
    id: string
    status: string
    student_name?: string
  }[]
}

type Course = { id: string; name: string; color: string | null; count: number }
type Tutor = { id: string; full_name: string; count: number }
type JadwalRow = { date: string; time: string; repeat: number }

const MAX_ROWS   = 5
const MAX_REPEAT = 16

function generateSessions(row: JadwalRow, classGroupId: string) {
  return Array.from({ length: row.repeat }, (_, i) => {
    const d = new Date(`${row.date}T${row.time}:00`)
    d.setDate(d.getDate() + i * 7)
    return { class_group_id: classGroupId, scheduled_at: d.toISOString(), status: 'scheduled', zoom_link: null }
  })
}

export default function KelasPage() {
  const supabase = createClient()

  const [kelasList,   setKelasList]   = useState<Kelas[]>([])
  const [loading,     setLoading]     = useState(true)
  const [showArsip,   setShowArsip]   = useState(false)

  // Search & Filter states
  const [searchQuery,    setSearchQuery]    = useState('')
  const [selectedCourse, setSelectedCourse] = useState('semua')
  const [selectedTutor,  setSelectedTutor]  = useState('semua')
  const [sortBy,         setSortBy]         = useState('terbaru')

  // Modal states...
  const [archiveId,    setArchiveId]    = useState<string | null>(null)
  const [archiveLabel, setArchiveLabel] = useState('')
  const [archiving,    setArchiving]    = useState(false)

  const [restoreId,    setRestoreId]    = useState<string | null>(null)
  const [restoreLabel, setRestoreLabel] = useState('')
  const [restoring,    setRestoring]    = useState(false)

  const [showJadwal,    setShowJadwal]    = useState(false)
  const [selectedKelas, setSelectedKelas] = useState<Kelas | null>(null)
  const [jadwalRows,    setJadwalRows]    = useState<JadwalRow[]>([{ date: today(), time: '08:00', repeat: 1 }])
  const [fZoom,         setFZoom]         = useState('')
  const [saving,        setSaving]        = useState(false)
  const [jadwalError,   setJadwalError]   = useState('')
  const [jadwalSuccess, setJadwalSuccess] = useState('')

  const [deleteId,       setDeleteId]       = useState<string | null>(null)
  const [deleteLabel,    setDeleteLabel]    = useState('')
  const [deleting,       setDeleting]       = useState(false)
  const [deleteError,    setDeleteError]    = useState('')
  const [deleteWarning,  setDeleteWarning]  = useState<{ enrollments: number; payments: number } | null>(null)
  const [checkingDelete, setCheckingDelete] = useState(false)

  function today() {
    const d = new Date()
    const offset = d.getTimezoneOffset()
    const local  = new Date(d.getTime() - offset * 60 * 1000)
    return local.toISOString().split('T')[0]
  }

  useEffect(() => { fetchKelas() }, [])

  async function fetchKelas() {
    setLoading(true)
    
    try {
      // SIMPLIFIED QUERY - tanpa nested students untuk avoid error
      const { data, error } = await supabase
        .from('class_groups')
        .select(`
          id, label, status, max_participants, created_at,
          courses(id, name, color), 
          class_types(name),
          tutors(id, profiles(full_name)),
          enrollments(id, status, student_id)
        `)
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('❌ Error fetching kelas:', error)
        setKelasList([])
        setLoading(false)
        return
      }

      if (!data || data.length === 0) {
        console.log('⚠️ No kelas data found')
        setKelasList([])
        setLoading(false)
        return
      }

      console.log('✅ Fetched kelas:', data.length)

      // Enrich dengan student names secara terpisah
      const enrichedData = await Promise.all(
        data.map(async (kelas: any) => {
          if (kelas.enrollments && kelas.enrollments.length > 0) {
            // Get unique student IDs
            const studentIds = [...new Set(
              kelas.enrollments
                .map((e: any) => e.student_id)
                .filter(Boolean)
            )]

            if (studentIds.length > 0) {
              // Fetch student profiles
              const { data: students } = await supabase
                .from('students')
                .select('id, profiles(full_name)')
                .in('id', studentIds)

              // Map student names back to enrollments
              const studentMap = new Map(
                students?.map((s: any) => [s.id, s.profiles?.full_name]) ?? []
              )

              kelas.enrollments = kelas.enrollments.map((e: any) => ({
                ...e,
                student_name: studentMap.get(e.student_id)
              }))
            }
          }
          return kelas
        })
      )

      console.log('✅ Enriched with student names')
      setKelasList(enrichedData as Kelas[])
    } catch (err) {
      console.error('❌ Unexpected error:', err)
      setKelasList([])
    }
    
    setLoading(false)
  }

  // Compute courses list
  const coursesList = useMemo<Course[]>(() => {
    const courseMap = new Map<string, Course>()
    kelasList.filter(k => k.status === 'active').forEach(k => {
      if (k.courses) {
        const existing = courseMap.get(k.courses.id)
        if (existing) {
          existing.count++
        } else {
          courseMap.set(k.courses.id, {
            id: k.courses.id,
            name: k.courses.name,
            color: k.courses.color,
            count: 1
          })
        }
      }
    })
    return Array.from(courseMap.values()).sort((a, b) => b.count - a.count)
  }, [kelasList])

  // Compute tutors list
  const tutorsList = useMemo<Tutor[]>(() => {
    const tutorMap = new Map<string, Tutor>()
    kelasList.filter(k => k.status === 'active').forEach(k => {
      if (k.tutors?.profiles?.full_name) {
        const existing = tutorMap.get(k.tutors.id)
        if (existing) {
          existing.count++
        } else {
          tutorMap.set(k.tutors.id, {
            id: k.tutors.id,
            full_name: k.tutors.profiles.full_name,
            count: 1
          })
        }
      }
    })
    return Array.from(tutorMap.values()).sort((a, b) => b.count - a.count)
  }, [kelasList])

  // Filtered & sorted kelas
  const filteredKelas = useMemo(() => {
    let filtered = kelasList.filter(k => k.status === 'active')

    if (selectedCourse !== 'semua') {
      filtered = filtered.filter(k => k.courses?.id === selectedCourse)
    }

    if (selectedTutor !== 'semua') {
      filtered = filtered.filter(k => k.tutors?.id === selectedTutor)
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(k => {
        const siswaMatch = k.enrollments?.some(e => 
          e.student_name?.toLowerCase().includes(query)
        )
        const kelasMatch = k.label.toLowerCase().includes(query)
        const tutorMatch = k.tutors?.profiles?.full_name?.toLowerCase().includes(query)
        return siswaMatch || kelasMatch || tutorMatch
      })
    }

    if (sortBy === 'terbaru') {
      filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    } else if (sortBy === 'nama') {
      filtered.sort((a, b) => a.label.localeCompare(b.label))
    } else if (sortBy === 'progress') {
      filtered.sort((a, b) => {
        const aActive = a.enrollments?.filter(e => e.status === 'active').length ?? 0
        const bActive = b.enrollments?.filter(e => e.status === 'active').length ?? 0
        return aActive - bActive
      })
    } else if (sortBy === 'terbanyak') {
      filtered.sort((a, b) => {
        const aActive = a.enrollments?.filter(e => e.status === 'active').length ?? 0
        const bActive = b.enrollments?.filter(e => e.status === 'active').length ?? 0
        return bActive - aActive
      })
    }

    return filtered
  }, [kelasList, selectedCourse, selectedTutor, searchQuery, sortBy])

  function openJadwal(k: Kelas) {
    setSelectedKelas(k)
    setJadwalRows([{ date: today(), time: '08:00', repeat: 1 }])
    setFZoom('')
    setJadwalError('')
    setJadwalSuccess('')
    setShowJadwal(true)
  }

  function openArchive(k: Kelas) {
    setArchiveId(k.id)
    setArchiveLabel(k.label)
  }

  async function handleArchive() {
    if (!archiveId) return
    setArchiving(true)
    await supabase.from('class_groups').update({ status: 'inactive' }).eq('id', archiveId)
    setArchiving(false)
    setArchiveId(null)
    fetchKelas()
  }

  function openRestore(k: Kelas) {
    setRestoreId(k.id)
    setRestoreLabel(k.label)
  }

  async function handleRestore() {
    if (!restoreId) return
    setRestoring(true)
    await supabase.from('class_groups').update({ status: 'active' }).eq('id', restoreId)
    setRestoring(false)
    setRestoreId(null)
    fetchKelas()
  }

  async function openDelete(k: Kelas) {
    setDeleteId(k.id)
    setDeleteLabel(k.label)
    setDeleteError('')
    setDeleteWarning(null)
    setCheckingDelete(true)

    const { count: enrollCount } = await supabase
      .from('enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('class_group_id', k.id)

    const { data: enrIds } = await supabase
      .from('enrollments')
      .select('id')
      .eq('class_group_id', k.id)

    let payCount = 0
    if (enrIds && enrIds.length > 0) {
      const { count } = await supabase
        .from('payments')
        .select('*', { count: 'exact', head: true })
        .in('enrollment_id', enrIds.map((e: any) => e.id))
      payCount = count ?? 0
    }

    setCheckingDelete(false)
    if ((enrollCount ?? 0) > 0 || payCount > 0) {
      setDeleteWarning({ enrollments: enrollCount ?? 0, payments: payCount })
    }
  }

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true); setDeleteError('')

    const { data: enrIds } = await supabase
      .from('enrollments').select('id').eq('class_group_id', deleteId)
    if (enrIds && enrIds.length > 0) {
      await supabase.from('payments').delete().in('enrollment_id', enrIds.map((e: any) => e.id))
    }
    await supabase.from('attendances').delete().in('session_id',
      (await supabase.from('sessions').select('id').eq('class_group_id', deleteId)).data?.map((s: any) => s.id) ?? []
    )
    await supabase.from('sessions').delete().eq('class_group_id', deleteId)
    await supabase.from('enrollments').delete().eq('class_group_id', deleteId)
    const { error } = await supabase.from('class_groups').delete().eq('id', deleteId)
    if (error) { setDeleteError(error.message); setDeleting(false); return }
    setDeleting(false)
    setDeleteId(null)
    setDeleteWarning(null)
    fetchKelas()
  }

  function addRow() {
    if (jadwalRows.length >= MAX_ROWS) return
    const last = jadwalRows[jadwalRows.length - 1]
    const next = new Date(`${last.date}T00:00:00`)
    next.setDate(next.getDate() + 7)
    const offset = next.getTimezoneOffset()
    const local  = new Date(next.getTime() - offset * 60 * 1000)
    setJadwalRows(prev => [...prev, { date: local.toISOString().split('T')[0], time: last.time, repeat: 1 }])
  }

  function removeRow(idx: number) { setJadwalRows(prev => prev.filter((_, i) => i !== idx)) }

  function updateRow(idx: number, field: keyof JadwalRow, value: string | number) {
    setJadwalRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r))
  }

  async function handleSaveJadwal() {
    if (!selectedKelas) return
    setSaving(true); setJadwalError(''); setJadwalSuccess('')
    const allSessions: any[] = []
    for (const row of jadwalRows) {
      if (!row.date || !row.time) continue
      generateSessions(row, selectedKelas.id).forEach(s => allSessions.push({ ...s, zoom_link: fZoom || null }))
    }
    if (allSessions.length === 0) { setJadwalError('Isi minimal satu jadwal.'); setSaving(false); return }
    const { error } = await supabase.from('sessions').insert(allSessions)
    if (error) { setJadwalError(error.message); setSaving(false); return }
    setJadwalSuccess(`${allSessions.length} sesi berhasil dijadwalkan!`)
    setSaving(false)
    setTimeout(() => setShowJadwal(false), 1500)
  }

  const totalSesi = jadwalRows.reduce((a, r) => a + r.repeat, 0)

  const statusLabel: Record<string, string> = { active: 'Aktif', inactive: 'Nonaktif' }
  const statusColor: Record<string, string> = {
    active:   'bg-green-100 text-green-700',
    inactive: 'bg-gray-100 text-gray-500',
  }
  const inputCls = "w-full px-3 py-2 border border-[#E5E3FF] rounded-lg text-sm bg-white text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] transition"

  const kelasArsip = kelasList.filter(k => k.status === 'inactive')

  // Stats
  const totalActiveKelas = kelasList.filter(k => k.status === 'active').length
  const totalSiswa = new Set(
    kelasList
      .filter(k => k.status === 'active')
      .flatMap(k => k.enrollments?.filter(e => e.status === 'active').map(e => e.student_id) ?? [])
      .filter(Boolean)
  ).size
  const totalTutor = tutorsList.length

  function KelasCard({ k, isArsip = false }: { k: Kelas; isArsip?: boolean }) {
    const activeEnroll = k.enrollments?.filter((e: any) => e.status === 'active').length ?? 0
    const isFull = activeEnroll >= k.max_participants
    return (
      <div className={`bg-white rounded-2xl border p-5 hover:shadow-sm transition-all ${isArsip ? 'border-gray-200 opacity-80' : 'border-[#E5E3FF]'}`}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="font-bold text-[#1A1640] truncate">{k.label}</div>
            <div className="text-xs text-[#7B78A8] mt-0.5">{k.courses?.name} · {k.class_types?.name}</div>
          </div>
          <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusColor[k.status] ?? 'bg-gray-100 text-gray-500'}`}>
              {statusLabel[k.status] ?? k.status}
            </span>
            {!isArsip && (
              <button onClick={() => openArchive(k)}
                className="p-1 rounded-lg text-gray-300 hover:text-[#5C4FE5] hover:bg-[#F0EEFF] transition-colors"
                title="Arsipkan Kelas">
                <Archive size={13}/>
              </button>
            )}
            {isArsip && (
              <button onClick={() => openRestore(k)}
                className="p-1 rounded-lg text-gray-300 hover:text-green-600 hover:bg-green-50 transition-colors"
                title="Aktifkan Kembali">
                <Archive size={13}/>
              </button>
            )}
            <button onClick={() => openDelete(k)}
              className="p-1 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Hapus Kelas">
              <Trash2 size={13}/>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-[#4A4580] mb-3">
          <UserCircle size={16} className="text-[#7B78A8]"/>
          <span>{k.tutors?.profiles?.full_name ?? '—'}</span>
        </div>

        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-[#7B78A8]">Peserta</div>
          <div className={`text-sm font-bold ${isFull ? 'text-red-600' : 'text-green-600'}`}>
            {activeEnroll}/{k.max_participants}
          </div>
        </div>

        <div className="w-full h-1.5 bg-[#E5E3FF] rounded-full overflow-hidden mb-4">
          <div className={`h-full rounded-full ${isFull ? 'bg-red-400' : 'bg-[#5C4FE5]'}`}
            style={{ width: `${Math.min((activeEnroll / k.max_participants) * 100, 100)}%` }}/>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Link href={`/admin/kelas/${k.id}/edit`}
            className="text-center py-2 bg-[#5C4FE5] text-white text-xs font-bold rounded-lg hover:bg-[#3D34C4] transition-colors">
            Edit
          </Link>
          {!isArsip && (
            <button onClick={() => openJadwal(k)}
              className="flex items-center justify-center gap-1 py-2 bg-[#E6B800] text-[#7A5C00] text-xs font-bold rounded-lg hover:bg-[#F5C800] transition-colors">
              <Calendar size={11}/> Jadwal
            </button>
          )}
          {isArsip && (
            <button onClick={() => openRestore(k)}
              className="flex items-center justify-center gap-1 py-2 bg-green-100 text-green-700 text-xs font-bold rounded-lg hover:bg-green-200 transition-colors">
              Aktifkan
            </button>
          )}
          <Link href={`/admin/kelas/${k.id}`}
            className="text-center py-2 border border-[#E5E3FF] text-[#4A4580] text-xs font-bold rounded-lg hover:bg-[#F0EFFF] transition-colors">
            Detail
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-[#1A1640]" style={{fontFamily:'Sora,sans-serif'}}>Manajemen Kelas</h1>
          <p className="text-sm text-[#7B78A8] mt-1 flex items-center gap-3">
            <span className="flex items-center gap-1">
              <GraduationCap size={14} className="text-[#5C4FE5]"/>
              {totalActiveKelas} kelas aktif
            </span>
            <span className="flex items-center gap-1">
              <Users size={14} className="text-[#5C4FE5]"/>
              {totalSiswa} siswa
            </span>
            <span className="flex items-center gap-1">
              <UserCircle size={14} className="text-[#5C4FE5]"/>
              {totalTutor} tutor
            </span>
          </p>
        </div>
        <Link href="/admin/kelas/baru"
          className="bg-[#5C4FE5] text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-[#3D34C4] transition-colors">
          + Buat Kelas
        </Link>
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-2xl border border-[#E5E3FF] p-4 mb-5">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7B78A8]"/>
            <input
              type="text"
              placeholder="Cari nama siswa, kelas, atau tutor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-[#E5E3FF] rounded-xl text-sm bg-[#F7F6FF] text-[#1A1640] placeholder:text-[#7B78A8] focus:outline-none focus:border-[#5C4FE5] focus:bg-white transition"
            />
          </div>

          {/* Filter Tutor */}
          <div className="relative">
            <UserCircle size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7B78A8] pointer-events-none"/>
            <select
              value={selectedTutor}
              onChange={(e) => setSelectedTutor(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-[#E5E3FF] rounded-xl text-sm bg-white text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] transition appearance-none cursor-pointer">
              <option value="semua">Semua Tutor</option>
              {tutorsList.map(t => (
                <option key={t.id} value={t.id}>
                  {t.full_name} ({t.count})
                </option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7B78A8] pointer-events-none"/>
          </div>

          {/* Sort */}
          <div className="relative">
            <ArrowUpDown size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7B78A8] pointer-events-none"/>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-[#E5E3FF] rounded-xl text-sm bg-white text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] transition appearance-none cursor-pointer">
              <option value="terbaru">Terbaru</option>
              <option value="nama">Nama A-Z</option>
              <option value="progress">Progress Terendah</option>
              <option value="terbanyak">Terbanyak Siswa</option>
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7B78A8] pointer-events-none"/>
          </div>
        </div>
      </div>

      {/* Course Tabs */}
      {coursesList.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          <button
            onClick={() => setSelectedCourse('semua')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              selectedCourse === 'semua'
                ? 'bg-[#5C4FE5] text-white'
                : 'bg-white border border-[#E5E3FF] text-[#4A4580] hover:bg-[#F0EEFF]'
            }`}>
            Semua ({totalActiveKelas})
          </button>
          {coursesList.map(course => (
            <button
              key={course.id}
              onClick={() => setSelectedCourse(course.id)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                selectedCourse === course.id
                  ? 'text-white'
                  : 'bg-white border-2 hover:opacity-80'
              }`}
              style={
                selectedCourse === course.id
                  ? { backgroundColor: course.color ?? '#5C4FE5' }
                  : { borderColor: course.color ?? '#E5E3FF', color: course.color ?? '#4A4580' }
              }>
              {course.name} ({course.count})
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({length: 3}).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-[#E5E3FF] p-5 animate-pulse">
              <div className="h-4 w-32 bg-gray-200 rounded mb-2"/>
              <div className="h-3 w-24 bg-gray-200 rounded mb-4"/>
              <div className="h-3 w-full bg-gray-200 rounded mb-6"/>
              <div className="flex gap-2">
                <div className="flex-1 h-8 bg-gray-200 rounded-lg"/>
                <div className="flex-1 h-8 bg-gray-200 rounded-lg"/>
                <div className="flex-1 h-8 bg-gray-200 rounded-lg"/>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {filteredKelas.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#E5E3FF] p-12 text-center mb-6">
              <div className="text-5xl mb-4">🔍</div>
              <p className="font-bold text-[#1A1640] mb-2">
                {searchQuery || selectedCourse !== 'semua' || selectedTutor !== 'semua'
                  ? 'Tidak ada kelas yang cocok'
                  : 'Belum ada kelas aktif'}
              </p>
              <p className="text-sm text-[#7B78A8] mb-4">
                {searchQuery || selectedCourse !== 'semua' || selectedTutor !== 'semua'
                  ? 'Coba ubah filter atau kata kunci pencarian'
                  : 'Buat kelas pertama untuk mulai mendaftarkan siswa'}
              </p>
              {!searchQuery && selectedCourse === 'semua' && selectedTutor === 'semua' && (
                <Link href="/admin/kelas/baru"
                  className="inline-flex items-center gap-2 bg-[#5C4FE5] text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-[#3D34C4] transition-colors">
                  + Buat Kelas Pertama
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {filteredKelas.map((k: any) => <KelasCard key={k.id} k={k} />)}
            </div>
          )}

          {kelasArsip.length > 0 && (
            <div>
              <button
                onClick={() => setShowArsip(prev => !prev)}
                className="flex items-center gap-2 w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-semibold text-[#7B78A8] hover:bg-gray-100 transition-colors mb-3">
                <Archive size={15} className="text-gray-400"/>
                Arsip Kelas
                <span className="ml-1 text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full font-bold">
                  {kelasArsip.length}
                </span>
                <span className="ml-auto">
                  {showArsip ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}
                </span>
              </button>

              {showArsip && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {kelasArsip.map((k: any) => <KelasCard key={k.id} k={k} isArsip />)}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* All modals remain the same... */}
      <ConfirmModal
        open={!!archiveId}
        title="Arsipkan Kelas?"
        description={`Kelas "${archiveLabel}" akan diarsipkan. Kelas tidak muncul di jadwal aktif, tapi semua data tetap tersimpan. Bisa diaktifkan kembali kapan saja.`}
        confirmText="Ya, Arsipkan"
        cancelText="Batal"
        loading={archiving}
        onConfirm={handleArchive}
        onCancel={() => setArchiveId(null)}
      />

      <ConfirmModal
        open={!!restoreId}
        title="Aktifkan Kembali?"
        description={`Kelas "${restoreLabel}" akan diaktifkan kembali.`}
        confirmText="Ya, Aktifkan"
        cancelText="Batal"
        loading={restoring}
        onConfirm={handleRestore}
        onCancel={() => setRestoreId(null)}
      />

      {deleteId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={20} className="text-red-500"/>
            </div>
            <h2 className="text-base font-bold text-[#1A1640] text-center mb-2">Hapus Kelas?</h2>

            {checkingDelete ? (
              <p className="text-sm text-[#7B78A8] text-center py-2">Memeriksa data terkait...</p>
            ) : deleteWarning && (deleteWarning.enrollments > 0 || deleteWarning.payments > 0) ? (
              <div className="space-y-3">
                <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-xs font-bold text-amber-800 mb-1">⚠️ Kelas ini memiliki data terkait:</p>
                  {deleteWarning.enrollments > 0 && (
                    <p className="text-xs text-amber-700">• {deleteWarning.enrollments} siswa terdaftar</p>
                  )}
                  {deleteWarning.payments > 0 && (
                    <p className="text-xs text-amber-700">• {deleteWarning.payments} riwayat pembayaran</p>
                  )}
                  <p className="text-xs text-amber-700 mt-1.5 font-medium">
                    Semua data akan ikut terhapus permanen.
                  </p>
                </div>
                <p className="text-xs text-[#7B78A8] text-center">
                  Pertimbangkan <strong>Arsipkan</strong> daripada hapus — data tetap tersimpan dan kelas bisa diaktifkan kembali.
                </p>
                {deleteError && <p className="text-xs text-red-600 text-center">{deleteError}</p>}
                <div className="flex gap-2 mt-2">
                  <button onClick={() => { setDeleteId(null); setDeleteWarning(null) }}
                    className="flex-1 py-2.5 border border-[#E5E3FF] text-[#4A4580] font-semibold rounded-xl text-sm hover:bg-[#F7F6FF] transition">
                    Batal
                  </button>
                  <button onClick={() => { setDeleteId(null); setDeleteWarning(null); const k = kelasList.find(k => k.id === deleteId); if (k) openArchive(k) }}
                    className="flex-1 py-2.5 bg-[#5C4FE5] text-white font-bold rounded-xl text-sm hover:bg-[#3D34C4] transition">
                    Arsipkan
                  </button>
                  <button onClick={handleDelete} disabled={deleting}
                    className="flex-1 py-2.5 bg-red-500 text-white font-bold rounded-xl text-sm hover:bg-red-600 transition disabled:opacity-60">
                    {deleting ? '...' : 'Hapus'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-[#7B78A8] text-center">
                  Kelas &quot;{deleteLabel}&quot; akan dihapus permanen beserta semua jadwal dan sesi.
                </p>
                {deleteError && <p className="text-xs text-red-600 text-center">{deleteError}</p>}
                <div className="flex gap-2">
                  <button onClick={() => { setDeleteId(null); setDeleteWarning(null) }}
                    className="flex-1 py-2.5 border border-[#E5E3FF] text-[#4A4580] font-semibold rounded-xl text-sm hover:bg-[#F7F6FF] transition">
                    Batal
                  </button>
                  <button onClick={handleDelete} disabled={deleting}
                    className="flex-1 py-2.5 bg-red-500 text-white font-bold rounded-xl text-sm hover:bg-red-600 transition disabled:opacity-60">
                    {deleting ? 'Menghapus...' : 'Ya, Hapus'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showJadwal && selectedKelas && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E3FF] sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-base font-bold text-[#1A1640]">Jadwalkan Sesi</h2>
                <p className="text-xs text-[#7B78A8] mt-0.5">{selectedKelas.label}</p>
              </div>
              <button onClick={() => setShowJadwal(false)} className="p-1.5 rounded-lg hover:bg-[#F7F6FF] text-[#7B78A8]">
                <X size={16}/>
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-[#7B78A8] uppercase tracking-wide">Jadwal</label>
                  <span className="text-xs text-[#7B78A8]">{jadwalRows.length}/{MAX_ROWS} jadwal</span>
                </div>
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
                        <label className="block text-[10px] font-bold text-[#7B78A8] uppercase tracking-wide mb-1">
                          Ulangi setiap minggu <span className="normal-case font-normal">(1 = sekali saja, maks {MAX_REPEAT})</span>
                        </label>
                        <div className="flex items-center gap-3">
                          <input type="range" min={1} max={MAX_REPEAT} value={row.repeat}
                            onChange={e => updateRow(idx, 'repeat', Number(e.target.value))}
                            className="flex-1 accent-[#5C4FE5]"/>
                          <span className="text-sm font-bold text-[#5C4FE5] min-w-[60px] text-right">
                            {row.repeat}x
                            {row.repeat > 1 && <span className="text-[10px] font-normal text-[#7B78A8] block">≈ {Math.ceil(row.repeat / 4)} bln</span>}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {jadwalRows.length < MAX_ROWS && (
                  <button onClick={addRow}
                    className="mt-3 w-full py-2.5 border-2 border-dashed border-[#C4BFFF] rounded-xl text-sm font-semibold text-[#5C4FE5] hover:bg-[#F0EEFF] transition flex items-center justify-center gap-2">
                    <Plus size={14}/> Tambah Jadwal Lain
                  </button>
                )}
                <div className="mt-3 flex items-center justify-between px-4 py-2.5 bg-[#EEEDFE] rounded-xl">
                  <span className="text-xs font-semibold text-[#3C3489]">Total sesi yang akan dibuat</span>
                  <span className="text-sm font-bold text-[#5C4FE5]">
                    {totalSesi} sesi
                    {totalSesi >= 8 && <span className="text-[10px] font-normal ml-1">(≈ {Math.ceil((totalSesi - 1) / 8)} periode)</span>}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">
                  Link Zoom <span className="normal-case font-normal text-[#7B78A8]">(opsional)</span>
                </label>
                <input type="url" placeholder="https://zoom.us/j/..." value={fZoom}
                  onChange={e => setFZoom(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-[#E5E3FF] rounded-xl text-sm bg-[#F7F6FF] text-[#1A1640] placeholder:text-[#7B78A8] focus:outline-none focus:border-[#5C4FE5] transition"/>
              </div>

              {jadwalError   && <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 font-semibold">{jadwalError}</div>}
              {jadwalSuccess && <div className="px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 font-semibold">✅ {jadwalSuccess}</div>}
            </div>

            <div className="px-6 pb-5 flex gap-3 sticky bottom-0 bg-white border-t border-[#E5E3FF] pt-4">
              <button onClick={handleSaveJadwal} disabled={saving}
                className="flex-1 py-3 bg-[#5C4FE5] hover:bg-[#3D34C4] text-white font-bold rounded-xl text-sm transition disabled:opacity-60">
                {saving ? 'Menyimpan...' : `Jadwalkan ${totalSesi} Sesi`}
              </button>
              <button onClick={() => setShowJadwal(false)}
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
