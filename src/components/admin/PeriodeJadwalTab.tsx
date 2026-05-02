'use client'

import { useState } from 'react'
import { AlertTriangle, Calendar, Check, ChevronDown, ChevronRight, ExternalLink, Pencil, Trash2 } from 'lucide-react'

type Session = { id: string; scheduled_at: string; status: string; zoom_link: string | null; enrollment_id: string | null }
type SessionAttendance = { student_id: string; student_name: string; status: string; notes: string | null }
type SessionReport = { student_id: string; student_name: string; materi: string|null; perkembangan: string|null; saran_siswa: string|null; saran_ortu: string|null; recording_url: string|null }
type SessionDetail = { attendances: SessionAttendance[]; reports: SessionReport[]; loading: boolean }
type Enrollment = { id: string; student_id: string; sessions_total: number; session_start_offset: number; sessions_used: number; status: string; student_name: string; attended_count: number; enrolled_at: string }

const STATUS_SESI: Record<string,{label:string;cls:string}> = {
  scheduled:{label:'Terjadwal',cls:'bg-[#EEEDFE] text-[#3C3489]'},
  completed:{label:'Selesai',cls:'bg-[#E6F4EC] text-[#1A5C36]'},
  cancelled:{label:'Dibatalkan',cls:'bg-[#FEE9E9] text-[#991B1B]'},
  rescheduled:{label:'Dijadwal Ulang',cls:'bg-[#FEF3E2] text-[#92400E]'},
}

function fmtDate(iso:string){return new Date(iso).toLocaleDateString('id-ID',{weekday:'short',day:'numeric',month:'short',year:'numeric'})}
function fmtTime(iso:string){return new Date(iso).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',hour12:false})}

type Props = {
  sessions: Session[]
  enrollments: Enrollment[]
  sessionAbsensiMap: Record<string,number>
  expandedSessionId: string | null
  sessionDetails: Record<string,SessionDetail>
  missingAbsensiCount: number
  onToggleSession: (id: string) => void
  onEditAbsensi: (id: string) => void
  onMarkComplete: (id: string) => void
  onEditSession: (s: Session) => void
  onDeleteSession: (id: string) => void
}

export default function PeriodeJadwalTab({
  sessions, enrollments, sessionAbsensiMap,
  expandedSessionId, sessionDetails, missingAbsensiCount,
  onToggleSession, onEditAbsensi, onMarkComplete, onEditSession, onDeleteSession,
}: Props) {
  const selesai   = sessions.filter(s=>s.status==='completed').length
  const terjadwal = sessions.filter(s=>s.status==='scheduled').length

  // Sort enrollments by enrolled_at
  const sortedEnr = enrollments
    .slice()
    .sort((a,b)=>new Date(a.enrolled_at).getTime()-new Date(b.enrolled_at).getTime())

  const hasMultiplePeriods = sortedEnr.length > 1

  // Default: buka periode terakhir (aktif)
  const [openPeriods, setOpenPeriods] = useState<Set<number>>(
    () => new Set([sortedEnr.length - 1])
  )

  function togglePeriod(idx: number) {
    setOpenPeriods(prev => {
      const next = new Set(prev)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return next
    })
  }

  if (sessions.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-[#E5E3FF] px-5 py-12 text-center">
        <div className="w-12 h-12 rounded-2xl bg-[#F0EFFF] flex items-center justify-center mx-auto mb-3">
          <Calendar size={20} className="text-[#C4BFFF]"/>
        </div>
        <p className="text-sm text-[#7B78A8] font-semibold">Belum ada sesi dijadwalkan</p>
      </div>
    )
  }

  // Single periode — flat list
  if (!hasMultiplePeriods) {
    return (
      <div className="bg-white rounded-2xl border border-[#E5E3FF] overflow-hidden">
        <div className="px-5 py-3 bg-[#F7F6FF] border-b border-[#E5E3FF] flex items-center gap-4 text-xs flex-wrap">
          <span className="text-[#7B78A8]">Total: <strong className="text-[#1A1640]">{sessions.length} sesi</strong></span>
          <span className="text-[#7B78A8]">Selesai: <strong className="text-[#27A05A]">{selesai}</strong></span>
          <span className="text-[#7B78A8]">Terjadwal: <strong className="text-[#5C4FE5]">{terjadwal}</strong></span>
          {missingAbsensiCount>0&&<span className="flex items-center gap-1 text-amber-700 font-bold"><AlertTriangle size={11}/> {missingAbsensiCount} belum absensi</span>}
        </div>
        <SessionList sessions={sessions} sessionAbsensiMap={sessionAbsensiMap} expandedSessionId={expandedSessionId} sessionDetails={sessionDetails}
          onToggleSession={onToggleSession} onEditAbsensi={onEditAbsensi} onMarkComplete={onMarkComplete} onEditSession={onEditSession} onDeleteSession={onDeleteSession}/>
      </div>
    )
  }

  // Multi periode — dropdown per periode
  return (
    <div className="space-y-3">
      {sortedEnr.map((enr, idx) => {
        const startAt = new Date(enr.enrolled_at)
        const nextEnr = sortedEnr[idx + 1]
        const endAt   = nextEnr ? new Date(nextEnr.enrolled_at) : null
        const periSessions = sessions.filter(s => {
          // Pakai enrollment_id — paling akurat
          if (s.enrollment_id) return s.enrollment_id === enr.id
          // Fallback date boundary untuk sessions lama tanpa enrollment_id
          const t = new Date(s.scheduled_at)
          return t >= startAt && (endAt === null || t < endAt)
        }).sort((a,b)=>new Date(a.scheduled_at).getTime()-new Date(b.scheduled_at).getTime())
        const isActive  = enr.status === 'active'
        const isOpen    = openPeriods.has(idx)
        const periSelesai   = periSessions.filter(s=>s.status==='completed').length
        const periTerjadwal = periSessions.filter(s=>s.status==='scheduled'||s.status==='rescheduled').length
        const periMissing   = periSessions.filter(s=>s.status==='completed'&&!sessionAbsensiMap[s.id]).length

        // Sembunyikan periode lama hanya jika BENAR-BENAR selesai:
        // - Tidak ada sesi scheduled/rescheduled (masih akan dieksekusi)
        // - Tidak ada sesi completed yang belum diabsensi
        if (!isActive && periTerjadwal === 0 && periMissing === 0) return null

        // Sembunyikan periode lama yang sudah tidak ada sesi scheduled DAN tidak ada absensi pending
        if (!isActive && periTerjadwal === 0 && periMissing === 0) return null

        return (
          <div key={enr.id} className="bg-white rounded-2xl border border-[#E5E3FF] overflow-hidden">
            <button onClick={()=>togglePeriod(idx)}
              className="w-full flex items-center justify-between px-5 py-3.5 bg-[#F7F6FF] hover:bg-[#EEEDFE] transition-colors text-left">
              <div className="flex items-center gap-2.5">
                {isOpen?<ChevronDown size={15} className="text-[#5C4FE5]"/>:<ChevronRight size={15} className="text-[#7B78A8]"/>}
                <span className="text-sm font-bold text-[#1A1640]">Periode {idx+1}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isActive?'bg-[#E6F4EC] text-[#1A5C36]':'bg-[#EEEDFE] text-[#5C4FE5]'}`}>
                  {isActive?'Aktif':'Diperpanjang'}
                </span>
                {periMissing>0&&<span className="flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700"><AlertTriangle size={8}/> {periMissing}</span>}
              </div>
              <div className="flex items-center gap-3 text-xs text-[#7B78A8]">
                <span><strong className="text-[#27A05A]">{periSelesai}</strong> selesai</span>
                <span><strong className="text-[#5C4FE5]">{periTerjadwal}</strong> terjadwal</span>
                <span className="text-[#C4BFFF]">{periSessions.length} total</span>
              </div>
            </button>
            {isOpen && (
              <div className="divide-y divide-[#E5E3FF]">
                {periSessions.length === 0 ? (
                  <p className="px-5 py-4 text-xs text-[#7B78A8] italic">Tidak ada sesi di periode ini</p>
                ) : (
                  <SessionList sessions={periSessions} sessionAbsensiMap={sessionAbsensiMap} expandedSessionId={expandedSessionId} sessionDetails={sessionDetails}
                    onToggleSession={onToggleSession} onEditAbsensi={onEditAbsensi} onMarkComplete={onMarkComplete} onEditSession={onEditSession} onDeleteSession={onDeleteSession}/>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// Sub-component: list sesi — semua data via props, no closure
type SessionListProps = {
  sessions: Session[]
  sessionAbsensiMap: Record<string,number>
  expandedSessionId: string | null
  sessionDetails: Record<string,SessionDetail>
  onToggleSession: (id: string) => void
  onEditAbsensi: (id: string) => void
  onMarkComplete: (id: string) => void
  onEditSession: (s: Session) => void
  onDeleteSession: (id: string) => void
}

function SessionList({ sessions, sessionAbsensiMap, expandedSessionId, sessionDetails, onToggleSession, onEditAbsensi, onMarkComplete, onEditSession, onDeleteSession }: SessionListProps) {
  return (
    <>
      {sessions.map((s, idx) => (
        <SessionItem key={s.id} s={s} idx={idx}
          sessionAbsensiMap={sessionAbsensiMap}
          expandedSessionId={expandedSessionId}
          sessionDetails={sessionDetails}
          onToggleSession={onToggleSession}
          onEditAbsensi={onEditAbsensi}
          onMarkComplete={onMarkComplete}
          onEditSession={onEditSession}
          onDeleteSession={onDeleteSession}/>
      ))}
    </>
  )
}

// Sub-component: single sesi row
type SessionItemProps = {
  s: Session
  idx: number
  sessionAbsensiMap: Record<string,number>
  expandedSessionId: string | null
  sessionDetails: Record<string,SessionDetail>
  onToggleSession: (id: string) => void
  onEditAbsensi: (id: string) => void
  onMarkComplete: (id: string) => void
  onEditSession: (s: Session) => void
  onDeleteSession: (id: string) => void
}

function SessionItem({ s, idx, sessionAbsensiMap, expandedSessionId, sessionDetails, onToggleSession, onEditAbsensi, onMarkComplete, onEditSession, onDeleteSession }: SessionItemProps) {
  const st = STATUS_SESI[s.status] ?? {label:s.status, cls:'bg-gray-100 text-gray-600'}
  const isCompleted = s.status==='completed' || s.status==='cancelled'
  const isExpanded  = expandedSessionId === s.id
  const detail      = sessionDetails[s.id]
  const missingAbs  = s.status==='completed' && !sessionAbsensiMap[s.id]

  return (
    <div className="border-b border-[#E5E3FF] last:border-0">
      <div className={`flex items-center gap-4 px-5 py-3.5 transition-colors ${isCompleted?(isExpanded?'bg-[#F0EFFF]':'bg-[#FAFAFE] hover:bg-[#F0EFFF] cursor-pointer'):'hover:bg-[#F7F6FF]'}`}
        onClick={isCompleted?()=>onToggleSession(s.id):undefined}>
        <div className="min-w-[28px] text-center">
          <div className={`text-xs font-bold ${isCompleted?'text-[#C4BFFF]':'text-[#5C4FE5]'}`}>{idx+1}</div>
        </div>
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-semibold ${isCompleted?'text-[#7B78A8]':'text-[#1A1640]'}`}>{fmtDate(s.scheduled_at)}</div>
          <div className="text-xs text-[#7B78A8]">{fmtTime(s.scheduled_at)}</div>
        </div>
        {missingAbs&&<span className="flex items-center gap-0.5 text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex-shrink-0"><AlertTriangle size={8}/> Absensi</span>}
        {s.zoom_link&&!isCompleted&&<a href={s.zoom_link} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} className="text-[#5C4FE5] hover:opacity-70 transition"><ExternalLink size={13}/></a>}
        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${st.cls}`}>{st.label}</span>
        {isCompleted?(
          <div className="flex-shrink-0 text-[#7B78A8]">{isExpanded?<ChevronDown size={14}/>:<ChevronRight size={14}/>}</div>
        ):(
          <div className="flex items-center gap-1 flex-shrink-0">
            {s.status==='scheduled'&&<button onClick={e=>{e.stopPropagation();onMarkComplete(s.id)}} className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition" title="Tandai Selesai"><Check size={13}/></button>}
            <button onClick={e=>{e.stopPropagation();onEditSession(s)}} className="p-1.5 rounded-lg text-gray-400 hover:text-[#5C4FE5] hover:bg-[#F0EFFF] transition" title="Edit"><Pencil size={13}/></button>
            <button onClick={e=>{e.stopPropagation();onDeleteSession(s.id)}} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition" title="Hapus"><Trash2 size={13}/></button>
          </div>
        )}
      </div>
      {isCompleted&&isExpanded&&(
        <div className="px-5 pb-4 bg-[#F7F6FF] border-t border-[#E5E3FF]">
          {!detail||detail.loading?(
            <div className="flex items-center gap-2 py-4 text-xs text-[#7B78A8]"><div className="w-3 h-3 border-2 border-[#5C4FE5] border-t-transparent rounded-full animate-spin"/>Memuat data...</div>
          ):(
            <div className="pt-3 space-y-3">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold text-[#7B78A8] uppercase tracking-wide">Absensi</p>
                  <button onClick={()=>onEditAbsensi(s.id)} className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EEEDFE] text-[#5C4FE5] hover:bg-[#5C4FE5] hover:text-white transition-colors"><Pencil size={9}/> Edit</button>
                </div>
                {detail.attendances.length===0?(
                  <p className="text-xs text-amber-600 font-semibold italic">⚠️ Belum ada data absensi — klik Edit untuk mengisi</p>
                ):(
                  <div className="space-y-1.5">
                    {detail.attendances.map(a=>(
                      <div key={a.student_id} className="flex items-center gap-2.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${a.status==='hadir'?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>{a.status==='hadir'?'✓ Hadir':'✗ Tidak Hadir'}</span>
                        <span className="text-xs font-semibold text-[#1A1640]">{a.student_name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="border-t border-[#E5E3FF] pt-3 flex items-center gap-3">
                <p className="text-[10px] font-bold text-[#7B78A8] uppercase tracking-wide">Laporan Tutor</p>
                {detail.reports.length>0?<span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-green-100 text-green-700">✓ Sudah diinput</span>:<span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-red-50 text-red-600">✗ Belum diinput</span>}
              </div>
              <div className="border-t border-[#E5E3FF] pt-3 flex items-center gap-3">
                <p className="text-[10px] font-bold text-[#7B78A8] uppercase tracking-wide">Link Rekaman</p>
                {detail.reports[0]?.recording_url?
                  <a href={detail.reports[0].recording_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 transition"><ExternalLink size={10}/> Tersedia — Buka</a>:
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">Belum tersedia</span>
                }
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
