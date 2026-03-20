'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CalendarDays, Check, MessageCircle, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'

type StatusAbsen = 'hadir' | 'izin' | 'sakit' | 'alpha'

const STATUS_OPTIONS: { value: StatusAbsen; label: string; color: string; active: string }[] = [
  { value: 'hadir', label: 'Hadir', color: 'border-[#E5E3FF] text-[#4A4580] hover:border-green-400 hover:text-green-600',    active: 'border-green-500 bg-green-50 text-green-700 font-bold' },
  { value: 'izin',  label: 'Izin',  color: 'border-[#E5E3FF] text-[#4A4580] hover:border-blue-400 hover:text-blue-600',     active: 'border-blue-500 bg-blue-50 text-blue-700 font-bold' },
  { value: 'sakit', label: 'Sakit', color: 'border-[#E5E3FF] text-[#4A4580] hover:border-yellow-400 hover:text-yellow-600', active: 'border-yellow-500 bg-yellow-50 text-yellow-700 font-bold' },
  { value: 'alpha', label: 'Alpha', color: 'border-[#E5E3FF] text-[#4A4580] hover:border-red-400 hover:text-red-600',       active: 'border-red-500 bg-red-50 text-red-700 font-bold' },
]

const AVATAR_COLORS = [
  { bg: '#EEEDFE', text: '#3C3489' },
  { bg: '#E6F1FB', text: '#0C447C' },
  { bg: '#EAF3DE', text: '#3B6D11' },
  { bg: '#FAEEDA', text: '#633806' },
  { bg: '#FCEBEB', text: '#791F1F' },
  { bg: '#FBEAF0', text: '#72243E' },
]

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase()
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('id-ID', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jayapura'
  })
}
function fmtTanggal() {
  return new Date().toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jayapura'
  })
}

// FIX: hitung range UTC yang benar untuk hari ini WIT (UTC+9)
function getTodayWITRangeUTC() {
  const now = new Date()
  // Konversi ke WIT
  const witNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jayapura' }))
  const today  = witNow.toISOString().split('T')[0] // YYYY-MM-DD WIT

  // WIT 00:00:00 = UTC hari sebelumnya jam 15:00:00
  // WIT 23:59:59 = UTC hari ini jam 14:59:59
  const prevDay = new Date(witNow)
  prevDay.setDate(prevDay.getDate() - 1)
  const prevDate = prevDay.toISOString().split('T')[0]

  const startUtc = `${prevDate}T15:00:00+00:00`
  const endUtc   = `${today}T14:59:59+00:00`

  return { startUtc, endUtc }
}

type ReportField = { materi: string; perkembangan: string; saranSiswa: string; saranOrtu: string }

export default function TutorAbsensiPage() {
  const supabase   = createClient()
  const adminPhone = (process.env.NEXT_PUBLIC_WA_NUMBER ?? '').replace(/\D/g, '')

  const [tutorId,      setTutorId]      = useState<string | null>(null)
  const [sesiHariIni,  setSesiHariIni]  = useState<any[]>([])
  const [selectedSesi, setSelectedSesi] = useState<any | null>(null)
  const [siswaList,    setSiswaList]    = useState<any[]>([])
  const [absensiMap,   setAbsensiMap]   = useState<Record<string, StatusAbsen>>({})
  const [notesMap,     setNotesMap]     = useState<Record<string, string>>({})
  const [reportMap,    setReportMap]    = useState<Record<string, ReportField>>({})
  const [expandReport, setExpandReport] = useState<Record<string, boolean>>({})
  const [savedSesiIds, setSavedSesiIds] = useState<Set<string>>(new Set())
  const [loading,      setLoading]      = useState(true)
  const [loadingSiswa, setLoadingSiswa] = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState('')
  const [success,      setSuccess]      = useState('')

  useEffect(() => { fetchSesiHariIni() }, [])

  async function fetchSesiHariIni() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: tutor } = await supabase
      .from('tutors').select('id').eq('profile_id', user.id).single()
    if (!tutor?.id) { setLoading(false); return }
    setTutorId(tutor.id)

    // FIX: pakai range UTC yang benar untuk WIT hari ini
    const { startUtc, endUtc } = getTodayWITRangeUTC()

    const { data: sesi } = await supabase
      .from('sessions')
      .select(`id, scheduled_at, status, zoom_link, class_groups!inner(id, label, tutor_id, courses(name))`)
      .eq('class_groups.tutor_id', tutor.id)
      .gte('scheduled_at', startUtc)
      .lte('scheduled_at', endUtc)
      .order('scheduled_at')

    setSesiHariIni(sesi ?? [])

    if (sesi && sesi.length > 0) {
      const sesiIds = sesi.map((s: any) => s.id)
      const { data: existing } = await supabase
        .from('attendances').select('session_id').in('session_id', sesiIds)
      setSavedSesiIds(new Set((existing ?? []).map((a: any) => a.session_id)) as Set<string>)
    }

    setLoading(false)
  }

  async function selectSesi(sesi: any) {
    setSelectedSesi(sesi)
    setAbsensiMap({})
    setNotesMap({})
    setReportMap({})
    setExpandReport({})
    setError('')
    setSuccess('')
    setLoadingSiswa(true)

    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('id, student_id, session_start_offset, sessions_total')
      .eq('class_group_id', sesi.class_groups.id)

    if (!enrollments || enrollments.length === 0) {
      setSiswaList([]); setLoadingSiswa(false); return
    }

    const studentIds = enrollments.map((e: any) => e.student_id)
    const { data: students } = await supabase
      .from('students').select('id, profile_id, relation_phone').in('id', studentIds)

    const profileIds = (students ?? []).map((s: any) => s.profile_id).filter(Boolean)
    const { data: profiles } = profileIds.length > 0
      ? await supabase.from('profiles').select('id, full_name').in('id', profileIds)
      : { data: [] }

    const profMap    = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p.full_name]))
    const studentMap = Object.fromEntries((students ?? []).map((s: any) => [s.id, {
      name:  profMap[s.profile_id] ?? 'Siswa',
      phone: s.relation_phone ?? '',
    }]))

    const { data: existAbsen } = await supabase
      .from('attendances').select('student_id, status, notes').eq('session_id', sesi.id)
    const { data: existReports } = await supabase
      .from('session_reports').select('student_id, materi, perkembangan, saran_siswa, saran_ortu')
      .eq('session_id', sesi.id)

    const preAbsen: Record<string, StatusAbsen> = {}
    const preNotes: Record<string, string>      = {}
    ;(existAbsen ?? []).forEach((a: any) => {
      preAbsen[a.student_id] = a.status
      preNotes[a.student_id] = a.notes ?? ''
    })

    const preReports: Record<string, ReportField> = {}
    ;(existReports ?? []).forEach((r: any) => {
      preReports[r.student_id] = {
        materi:       r.materi ?? '',
        perkembangan: r.perkembangan ?? '',
        saranSiswa:   r.saran_siswa ?? '',
        saranOrtu:    r.saran_ortu ?? '',
      }
    })

    setAbsensiMap(preAbsen)
    setNotesMap(preNotes)
    setReportMap(preReports)

    setSiswaList(enrollments.map((e: any) => ({
      studentId:     e.student_id,
      name:          studentMap[e.student_id]?.name ?? 'Siswa',
      phone:         studentMap[e.student_id]?.phone ?? '',
      sessionOffset: e.session_start_offset ?? 1,
      sessionTotal:  e.sessions_total ?? 8,
    })))

    setLoadingSiswa(false)
  }

  function setStatus(studentId: string, status: StatusAbsen) {
    setAbsensiMap(prev => ({ ...prev, [studentId]: status }))
  }
  function setNotes(studentId: string, val: string) {
    setNotesMap(prev => ({ ...prev, [studentId]: val }))
  }
  function setReport(studentId: string, field: keyof ReportField, val: string) {
    setReportMap(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] ?? { materi: '', perkembangan: '', saranSiswa: '', saranOrtu: '' }),
        [field]: val
      }
    }))
  }
  function toggleReport(studentId: string) {
    setExpandReport(prev => ({ ...prev, [studentId]: !prev[studentId] }))
  }

  async function handleSimpan() {
    if (!selectedSesi || !tutorId) return
    if (siswaList.some(s => !absensiMap[s.studentId])) {
      setError('Lengkapi status absensi semua siswa terlebih dahulu.')
      return
    }

    setSaving(true); setError(''); setSuccess('')

    const absenRecords = siswaList.map(s => ({
      session_id:  selectedSesi.id,
      student_id:  s.studentId,
      status:      absensiMap[s.studentId],
      notes:       notesMap[s.studentId] || null,
      recorded_by: tutorId,
    }))

    const { error: absenErr } = await supabase
      .from('attendances').upsert(absenRecords, { onConflict: 'session_id,student_id' })
    if (absenErr) { setError(absenErr.message); setSaving(false); return }

    const reportRecords = siswaList
      .filter(s => {
        const r = reportMap[s.studentId]
        return r && (r.materi || r.perkembangan || r.saranSiswa || r.saranOrtu)
      })
      .map(s => {
        const r = reportMap[s.studentId]
        return {
          session_id:   selectedSesi.id,
          student_id:   s.studentId,
          materi:       r.materi || null,
          perkembangan: r.perkembangan || null,
          saran_siswa:  r.saranSiswa || null,
          saran_ortu:   r.saranOrtu || null,
          recorded_by:  tutorId,
        }
      })

    if (reportRecords.length > 0) {
      const { error: repErr } = await supabase
        .from('session_reports').upsert(reportRecords, { onConflict: 'session_id,student_id' })
      if (repErr) { setError(repErr.message); setSaving(false); return }
    }

    setSavedSesiIds(prev => new Set([...prev, selectedSesi.id]))
    setSuccess('Absensi dan laporan berhasil disimpan!')
    setSaving(false)
  }

  function buildWAAdmin(siswaName: string) {
    const sesiLabel = selectedSesi?.class_groups?.label ?? 'kelas'
    const waktu     = fmtTime(selectedSesi?.scheduled_at ?? '')
    return encodeURIComponent(
      `Halo Admin, siswa ${siswaName} belum hadir di sesi ${sesiLabel} pukul ${waktu} WIT. Mohon ditindaklanjuti.`
    )
  }

  function buildWAOrtu(siswa: any) {
    const status     = absensiMap[siswa.studentId]
    const sesiLabel  = selectedSesi?.class_groups?.label ?? 'kelas'
    const waktu      = fmtTime(selectedSesi?.scheduled_at ?? '')
    const statusText = status === 'izin' ? 'izin' : status === 'sakit' ? 'sakit' : 'tidak hadir (tanpa keterangan)'
    const notes      = notesMap[siswa.studentId] ? ` Keterangan: ${notesMap[siswa.studentId]}.` : ''
    return encodeURIComponent(
      `Halo, kami dari EduKazia ingin menginformasikan bahwa ${siswa.name} ${statusText} pada sesi ${sesiLabel} hari ini pukul ${waktu} WIT.${notes} Terima kasih.`
    )
  }

  const statusColor: Record<string, string> = {
    scheduled:   'bg-blue-50 text-blue-700',
    completed:   'bg-green-50 text-green-700',
    cancelled:   'bg-red-50 text-red-700',
    rescheduled: 'bg-yellow-50 text-yellow-700',
  }
  const statusSesiLabel: Record<string, string> = {
    scheduled: 'Terjadwal', completed: 'Selesai',
    cancelled: 'Dibatalkan', rescheduled: 'Reschedule'
  }

  const textareaCls = "w-full px-3 py-2 border border-[#E5E3FF] rounded-xl text-xs bg-[#F7F6FF] text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] focus:bg-white transition resize-none"

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="text-sm text-[#7B78A8]">Memuat sesi hari ini...</div>
    </div>
  )

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-black text-[#1A1640] font-['Sora']">Absensi & Laporan</h1>
        <p className="text-sm text-[#7B78A8] mt-1">{fmtTanggal()}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Kolom kiri */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-[#E5E3FF] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#E5E3FF]">
              <h2 className="font-bold text-sm text-[#1A1640]">Sesi Hari Ini</h2>
            </div>
            {sesiHariIni.length === 0 ? (
              <div className="p-6 text-center">
                <CalendarDays size={28} strokeWidth={1.5} className="text-[#C4BFFF] mx-auto mb-2"/>
                <p className="text-xs text-[#7B78A8] font-semibold">Tidak ada sesi hari ini</p>
              </div>
            ) : (
              <div className="divide-y divide-[#F0EFFF]">
                {sesiHariIni.map((s: any) => {
                  const isSelected = selectedSesi?.id === s.id
                  const isDone     = savedSesiIds.has(s.id)
                  return (
                    <button key={s.id} onClick={() => selectSesi(s)}
                      className={[
                        'w-full text-left px-4 py-3 transition-colors',
                        isSelected ? 'bg-[#5C4FE5] text-white' : 'hover:bg-[#F7F6FF]'
                      ].join(' ')}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className={`text-sm font-bold truncate ${isSelected ? 'text-white' : 'text-[#1A1640]'}`}>
                            {s.class_groups?.label ?? '—'}
                          </div>
                          <div className={`text-xs mt-0.5 ${isSelected ? 'text-white/70' : 'text-[#7B78A8]'}`}>
                            {fmtTime(s.scheduled_at)} WIT · {s.class_groups?.courses?.name ?? '—'}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {isDone && (
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center ${isSelected ? 'bg-white/20' : 'bg-green-100'}`}>
                              <Check size={11} className={isSelected ? 'text-white' : 'text-green-600'}/>
                            </div>
                          )}
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${isSelected ? 'bg-white/20 text-white' : (statusColor[s.status] ?? 'bg-gray-50 text-gray-600')}`}>
                            {statusSesiLabel[s.status] ?? s.status}
                          </span>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Kolom kanan */}
        <div className="lg:col-span-2">
          {!selectedSesi ? (
            <div className="bg-white rounded-2xl border border-[#E5E3FF] p-12 text-center flex flex-col items-center justify-center min-h-[300px]">
              <CalendarDays size={36} strokeWidth={1.5} className="text-[#C4BFFF] mb-3"/>
              <p className="text-sm font-semibold text-[#7B78A8]">Pilih sesi di sebelah kiri</p>
              <p className="text-xs text-[#7B78A8] mt-1">untuk mulai mencatat absensi dan laporan</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#E5E3FF] overflow-hidden">
              {/* Header sesi */}
              <div className="px-5 py-4 border-b border-[#E5E3FF] bg-[#F7F6FF]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-bold text-[#1A1640]">{selectedSesi.class_groups?.label}</h2>
                    <p className="text-xs text-[#7B78A8] mt-0.5">
                      {fmtTime(selectedSesi.scheduled_at)} WIT · {selectedSesi.class_groups?.courses?.name}
                    </p>
                  </div>
                  {adminPhone && (
                    <a
                      href={`https://wa.me/${adminPhone}?text=${buildWAAdmin('(nama siswa)')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-2 bg-[#5C4FE5] hover:bg-green-500 text-white rounded-xl text-xs font-semibold transition flex-shrink-0"
                    >
                      <AlertTriangle size={13}/><MessageCircle size={13}/>
                      Laporkan ke Admin
                    </a>
                  )}
                </div>
                <p className="text-[10px] text-[#7B78A8] mt-2 italic">
                  Gunakan tombol "Laporkan ke Admin" jika ada siswa yang belum hadir setelah 3 menit sesi dimulai.
                </p>
              </div>

              {loadingSiswa ? (
                <div className="p-8 text-center text-sm text-[#7B78A8]">Memuat daftar siswa...</div>
              ) : siswaList.length === 0 ? (
                <div className="p-8 text-center text-sm text-[#7B78A8]">Belum ada siswa terdaftar di kelas ini</div>
              ) : (
                <>
                  <div className="divide-y divide-[#F0EFFF]">
                    {siswaList.map((s, idx) => {
                      const currentStatus = absensiMap[s.studentId]
                      const avatarColor   = AVATAR_COLORS[idx % AVATAR_COLORS.length]
                      const isAbsen       = currentStatus && currentStatus !== 'hadir'
                      const isReportOpen  = expandReport[s.studentId] ?? false
                      const report        = reportMap[s.studentId] ?? { materi: '', perkembangan: '', saranSiswa: '', saranOrtu: '' }

                      return (
                        <div key={s.studentId} className="px-5 py-4">
                          <div className="flex items-center gap-3 mb-3">
                            <div
                              className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                              style={{ background: avatarColor.bg, color: avatarColor.text }}
                            >
                              {getInitials(s.name)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-[#1A1640]">{s.name}</div>
                              <div className="text-xs text-[#7B78A8]">Sesi {s.sessionOffset}/{s.sessionTotal}</div>
                            </div>
                            {isAbsen && s.phone && (
                              <a
                                href={`https://wa.me/${s.phone.replace(/\D/g, '')}?text=${buildWAOrtu(s)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-green-50 text-green-700 rounded-xl text-xs font-semibold hover:bg-green-100 transition flex-shrink-0"
                              >
                                <MessageCircle size={12}/> WA Ortu
                              </a>
                            )}
                          </div>

                          <div className="flex gap-2 flex-wrap mb-3">
                            {STATUS_OPTIONS.map(opt => (
                              <button
                                key={opt.value}
                                onClick={() => setStatus(s.studentId, opt.value)}
                                className={[
                                  'px-3 py-1.5 rounded-xl text-xs border transition-all',
                                  currentStatus === opt.value ? opt.active : opt.color
                                ].join(' ')}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>

                          {isAbsen && (
                            <input
                              type="text"
                              placeholder="Catatan absensi (opsional)..."
                              value={notesMap[s.studentId] ?? ''}
                              onChange={e => setNotes(s.studentId, e.target.value)}
                              className="mb-3 w-full px-3 py-2 border border-[#E5E3FF] rounded-xl text-xs bg-[#F7F6FF] text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] transition"
                            />
                          )}

                          <button
                            onClick={() => toggleReport(s.studentId)}
                            className="flex items-center gap-2 text-xs font-semibold text-[#5C4FE5] hover:underline transition"
                          >
                            {isReportOpen ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
                            {isReportOpen ? 'Sembunyikan' : 'Isi'} Laporan Belajar
                          </button>

                          {isReportOpen && (
                            <div className="mt-3 space-y-3 bg-[#F7F6FF] rounded-xl p-4 border border-[#E5E3FF]">
                              <p className="text-[10px] font-bold text-[#7B78A8] uppercase tracking-widest">
                                Laporan Belajar Sesi Ini
                              </p>
                              {[
                                { field: 'materi' as keyof ReportField, label: 'Materi yang Diajarkan', placeholder: 'Contoh: Phonics level 3, blending CVC words...' },
                                { field: 'perkembangan' as keyof ReportField, label: 'Perkembangan & Pemahaman Siswa', placeholder: 'Contoh: Sudah bisa membaca 3 huruf...' },
                                { field: 'saranSiswa' as keyof ReportField, label: 'Saran untuk Siswa', placeholder: 'Contoh: Rajin membaca buku cerita bergambar...' },
                                { field: 'saranOrtu' as keyof ReportField, label: 'Saran untuk Orang Tua', placeholder: 'Contoh: Mohon dampingi latihan membaca 10 menit setiap hari...' },
                              ].map(({ field, label, placeholder }) => (
                                <div key={field}>
                                  <label className="block text-[10px] font-bold text-[#7B78A8] uppercase tracking-wide mb-1">
                                    {label}
                                  </label>
                                  <textarea
                                    rows={2}
                                    placeholder={placeholder}
                                    value={report[field]}
                                    onChange={e => setReport(s.studentId, field, e.target.value)}
                                    className={textareaCls}
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  <div className="px-5 py-4 border-t border-[#E5E3FF] bg-[#F7F6FF]">
                    {error   && <p className="text-xs text-red-600 font-semibold mb-3">{error}</p>}
                    {success && <p className="text-xs text-green-600 font-semibold mb-3">✅ {success}</p>}
                    <button
                      onClick={handleSimpan}
                      disabled={saving}
                      className="w-full py-3 bg-[#5C4FE5] hover:bg-[#3D34C4] text-white font-bold rounded-xl text-sm transition disabled:opacity-60"
                    >
                      {saving ? 'Menyimpan...' : 'Simpan Absensi & Laporan'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
