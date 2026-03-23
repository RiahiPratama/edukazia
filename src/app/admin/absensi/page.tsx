'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle, Clock, AlertCircle, MessageCircle, X } from 'lucide-react'

const STATUS_COLOR: Record<string, string> = {
  hadir:       'bg-green-50 text-green-700 border-green-200',
  tidak_hadir: 'bg-red-50 text-red-700 border-red-200',
  reschedule:  'bg-amber-50 text-amber-700 border-amber-200',
}
const STATUS_LABEL: Record<string, string> = {
  hadir:       'Hadir',
  tidak_hadir: 'Tidak Hadir',
  reschedule:  'Reschedule',
}

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

export default function AdminAbsensiPage() {
  const supabase = createClient()

  const [sessions,   setSessions]   = useState<any[]>([])
  const [attMap,     setAttMap]     = useState<Record<string, Record<string, any>>>({})
  const [enrollMap,  setEnrollMap]  = useState<Record<string, string[]>>({})
  const [studentMap, setStudentMap] = useState<Record<string, { name: string; phone: string }>>({})
  const [loading,    setLoading]    = useState(true)

  // Reschedule modal
  const [rescheduleSession, setRescheduleSession]   = useState<any | null>(null)
  const [rescheduleAlasan,  setRescheduleAlasan]    = useState('')
  const [savingReschedule,  setSavingReschedule]    = useState(false)
  const [rescheduleMsg,     setRescheduleMsg]       = useState('')

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const now = new Date()
    const todayWIT = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Jayapura' })
    const prevDateObj = new Date(todayWIT + 'T00:00:00+09:00')
    prevDateObj.setDate(prevDateObj.getDate() - 1)
    const prevDate = prevDateObj.toLocaleDateString('en-CA')
    const startUtc = `${prevDate}T15:00:00+00:00`
    const endUtc   = `${todayWIT}T14:59:59+00:00`

    const { data: sess } = await supabase
      .from('sessions')
      .select(`id, scheduled_at, status, zoom_link,
        class_groups(id, label, tutor_id, courses(name),
          tutors(profile_id, profiles(full_name)))`)
      .gte('scheduled_at', startUtc)
      .lte('scheduled_at', endUtc)
      .order('scheduled_at')

    setSessions(sess ?? [])

    const sessionIds = (sess ?? []).map((s: any) => s.id)
    const classIds   = [...new Set((sess ?? []).map((s: any) => s.class_groups?.id).filter(Boolean))]

    const { data: enrollments } = classIds.length > 0
      ? await supabase.from('enrollments').select('id, student_id, class_group_id').in('class_group_id', classIds)
      : { data: [] }

    const { data: attendances } = sessionIds.length > 0
      ? await supabase.from('attendances').select('session_id, student_id, status, notes').in('session_id', sessionIds)
      : { data: [] }

    const studentIds = [...new Set((enrollments ?? []).map((e: any) => e.student_id).filter(Boolean))]
    const { data: students } = studentIds.length > 0
      ? await supabase.from('students').select('id, profile_id, relation_phone').in('id', studentIds as string[])
      : { data: [] }

    const profileIds = [...new Set((students ?? []).map((s: any) => s.profile_id).filter(Boolean))]
    const { data: profiles } = profileIds.length > 0
      ? await supabase.from('profiles').select('id, full_name').in('id', profileIds as string[])
      : { data: [] }

    const profMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p.full_name]))
    const sMap: Record<string, { name: string; phone: string }> = {}
    ;(students ?? []).forEach((s: any) => {
      sMap[s.id] = { name: profMap[s.profile_id] ?? 'Siswa', phone: s.relation_phone ?? '' }
    })
    setStudentMap(sMap)

    const aMap: Record<string, Record<string, any>> = {}
    ;(attendances ?? []).forEach((a: any) => {
      if (!aMap[a.session_id]) aMap[a.session_id] = {}
      aMap[a.session_id][a.student_id] = { status: a.status, notes: a.notes ?? '' }
    })
    setAttMap(aMap)

    const eMap: Record<string, string[]> = {}
    ;(enrollments ?? []).forEach((e: any) => {
      if (!eMap[e.class_group_id]) eMap[e.class_group_id] = []
      eMap[e.class_group_id].push(e.student_id)
    })
    setEnrollMap(eMap)

    setLoading(false)
  }

  async function handleReschedule() {
    if (!rescheduleSession) return
    setSavingReschedule(true); setRescheduleMsg('')
    const { data: { user } } = await supabase.auth.getUser()
    const res = await fetch('/api/sessions/reschedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id:         rescheduleSession.id,
        alasan:             rescheduleAlasan,
        reschedued_by_role: 'admin',
        reschedued_by_id:   user?.id ?? null,
      }),
    })
    const data = await res.json()
    setSavingReschedule(false)
    if (!res.ok) { setRescheduleMsg('Gagal: ' + (data.error ?? 'Error')); return }
    setSessions(prev => prev.map(s => s.id === rescheduleSession.id ? { ...s, status: 'rescheduled' } : s))
    setRescheduleSession(null)
    setRescheduleAlasan('')
  }

  // Summary
  let totalHadir = 0, totalTidakHadir = 0, totalBelum = 0, totalReschedule = 0
  sessions.forEach(s => {
    if (s.status === 'rescheduled') { totalReschedule++; return }
    const siswaIds = enrollMap[s.class_groups?.id] ?? []
    const sesAtt   = attMap[s.id] ?? {}
    siswaIds.forEach((sid: string) => {
      const a = sesAtt[sid]
      if (!a) totalBelum++
      else if (a.status === 'hadir') totalHadir++
      else totalTidakHadir++
    })
  })

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="text-sm text-[#7B78A8]">Memuat data absensi...</div>
    </div>
  )

  return (
    <div>
      {/* Modal Reschedule */}
      {rescheduleSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-amber-200 bg-amber-50 rounded-t-2xl">
              <div>
                <h3 className="font-bold text-amber-900 text-sm">Reschedule Sesi</h3>
                <p className="text-xs text-amber-700 mt-0.5">
                  {rescheduleSession.class_groups?.label} · {fmtTime(rescheduleSession.scheduled_at)} WIT
                </p>
              </div>
              <button onClick={() => setRescheduleSession(null)} className="p-1.5 rounded-lg hover:bg-amber-100">
                <X size={16} className="text-amber-700"/>
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="flex items-start gap-2 px-3 py-2.5 bg-blue-50 rounded-xl border border-blue-100">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" className="flex-shrink-0 mt-0.5">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <p className="text-[11px] text-blue-700 leading-relaxed">
                  Sesi akan ditandai dijadwal ulang dan <strong>tidak terhitung</strong> dari paket siswa. Notifikasi dikirim ke orang tua.
                </p>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#7B78A8] uppercase tracking-wider mb-1">Alasan Reschedule</label>
                <textarea
                  value={rescheduleAlasan}
                  onChange={e => setRescheduleAlasan(e.target.value)}
                  placeholder="Contoh: Libur nasional, tutor berhalangan, kendala teknis..."
                  rows={3}
                  className="w-full px-3 py-2 border border-[#E5E3FF] rounded-xl text-xs bg-[#F7F6FF] text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] transition resize-none"
                />
              </div>
              {rescheduleMsg && (
                <p className="text-[11px] text-red-600 px-3 py-2 bg-red-50 rounded-xl border border-red-200">{rescheduleMsg}</p>
              )}
              <button onClick={handleReschedule} disabled={savingReschedule}
                className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-sm transition disabled:opacity-50 flex items-center justify-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <path d="M23 4v6h-6M1 20v-6h6"/>
                  <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
                </svg>
                {savingReschedule ? 'Memproses...' : 'Konfirmasi Reschedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-[#1A1640] font-['Sora']">Rekap Absensi</h1>
        <p className="text-sm text-[#7B78A8] mt-1">{fmtTanggal()}</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-2xl border border-green-100 p-4">
          <div className="text-2xl font-black text-green-600">{totalHadir}</div>
          <div className="text-xs text-[#7B78A8] font-semibold mt-1">Hadir</div>
        </div>
        <div className="bg-white rounded-2xl border border-red-100 p-4">
          <div className="text-2xl font-black text-red-600">{totalTidakHadir}</div>
          <div className="text-xs text-[#7B78A8] font-semibold mt-1">Tidak Hadir</div>
        </div>
        <div className="bg-white rounded-2xl border border-amber-100 p-4">
          <div className="text-2xl font-black text-amber-600">{totalReschedule}</div>
          <div className="text-xs text-[#7B78A8] font-semibold mt-1">Reschedule</div>
        </div>
        <div className="bg-white rounded-2xl border border-[#E5E3FF] p-4">
          <div className="text-2xl font-black text-[#7B78A8]">{totalBelum}</div>
          <div className="text-xs text-[#7B78A8] font-semibold mt-1">Belum Diabsen</div>
        </div>
      </div>

      {/* Daftar Sesi */}
      {sessions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E5E3FF] p-12 text-center">
          <Clock size={36} strokeWidth={1.5} className="text-[#C4BFFF] mx-auto mb-3"/>
          <p className="text-sm font-semibold text-[#7B78A8]">Tidak ada sesi hari ini</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sessions.map((s: any) => {
            const kelasId    = s.class_groups?.id
            const kelasLabel = s.class_groups?.label ?? '—'
            const tutorName  = s.class_groups?.tutors?.profiles?.full_name ?? '—'
            const courseName = s.class_groups?.courses?.name ?? '—'
            const siswaIds   = enrollMap[kelasId] ?? []
            const sesAtt     = attMap[s.id] ?? {}
            const sudahDiabsen = Object.keys(sesAtt).length > 0
            const waktu      = fmtTime(s.scheduled_at)
            const isRescheduled = s.status === 'rescheduled'

            return (
              <div key={s.id} className={`bg-white rounded-2xl border overflow-hidden ${isRescheduled ? 'border-amber-200' : 'border-[#E5E3FF]'}`}>
                {/* Header sesi */}
                <div className={`px-5 py-4 border-b ${isRescheduled ? 'bg-amber-50 border-amber-100' : 'border-[#F0EFFF]'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-black text-[#5C4FE5]">{waktu} WIT</span>
                        <span className="text-sm font-bold text-[#1A1640]">{kelasLabel}</span>
                        {isRescheduled ? (
                          <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                            🔄 Dijadwal Ulang
                          </span>
                        ) : sudahDiabsen ? (
                          <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-700">
                            <CheckCircle size={10}/> Sudah diabsen
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F0EFFF] text-[#7B78A8]">
                            <Clock size={10}/> Belum diabsen
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[#7B78A8] mt-1">
                        {courseName} · Tutor: {tutorName}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {s.zoom_link && !isRescheduled && (
                        <a href={s.zoom_link} target="_blank" rel="noopener noreferrer"
                          className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 rounded-xl font-semibold hover:bg-blue-100 transition">
                          Buka Zoom
                        </a>
                      )}
                      {!isRescheduled && (
                        <button
                          onClick={() => { setRescheduleSession(s); setRescheduleMsg(''); setRescheduleAlasan('') }}
                          className="text-xs px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl font-semibold hover:bg-amber-100 transition flex items-center gap-1">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M23 4v6h-6M1 20v-6h6"/>
                            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
                          </svg>
                          Reschedule
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Daftar siswa */}
                {!isRescheduled && (
                  <div className="divide-y divide-[#F0EFFF]">
                    {siswaIds.length === 0 ? (
                      <div className="px-5 py-3 text-xs text-[#7B78A8]">Belum ada siswa terdaftar</div>
                    ) : (
                      siswaIds.map((sid: string, idx: number) => {
                        const siswa  = studentMap[sid] ?? { name: 'Siswa', phone: '' }
                        const att    = sesAtt[sid]
                        const status = att?.status ?? null
                        const notes  = att?.notes ?? ''
                        const avatarColor = AVATAR_COLORS[idx % AVATAR_COLORS.length]

                        return (
                          <div key={sid} className="flex items-center gap-3 px-5 py-3 hover:bg-[#F7F6FF] transition-colors">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                              style={{ background: avatarColor.bg, color: avatarColor.text }}>
                              {getInitials(siswa.name)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-[#1A1640] truncate">{siswa.name}</div>
                              {notes && <div className="text-xs text-[#7B78A8] italic">"{notes}"</div>}
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {status ? (
                                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${STATUS_COLOR[status] ?? 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                                  {STATUS_LABEL[status] ?? status}
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full border border-gray-200 bg-gray-50 text-gray-400">
                                  Belum diabsen
                                </span>
                              )}
                              {status === 'tidak_hadir' && siswa.phone && (
                                <a href={`https://wa.me/${siswa.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Halo, kami dari EduKazia menginformasikan bahwa ${siswa.name} tidak hadir pada sesi ${kelasLabel} hari ini pukul ${waktu} WIT.${notes ? ` Keterangan: ${notes}.` : ''} Terima kasih.`)}`}
                                  target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded-lg text-[10px] font-semibold hover:bg-green-100 transition">
                                  <MessageCircle size={11}/> WA Ortu
                                </a>
                              )}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                )}

                {isRescheduled && (
                  <div className="px-5 py-3 text-xs text-amber-700 bg-amber-50/50">
                    Sesi ini telah dijadwal ulang. Jadwal pengganti akan ditentukan oleh admin.
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
