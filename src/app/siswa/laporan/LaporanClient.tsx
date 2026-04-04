'use client'

import { useState } from 'react'
import BilingualReport from '@/components/shared/BilingualReport'

interface Laporan {
  id: string
  materi: string | null
  perkembangan: string | null
  saran_siswa: string | null
  saran_ortu: string | null
  created_at: string
  sessions: {
    id: string
    scheduled_at: string
    class_groups: {
      id: string
      label: string
      courses: { id: string; name: string; color: string } | null
      profiles: { full_name: string } | null
    } | null
  } | null
  attendance: { id: string; status: string; notes: string | null } | null
}

interface Course {
  id: string
  name: string
  color: string
}

interface Summary {
  hadir: number
  izin: number
  sakit: number
  alpha: number
}

interface Child {
  id: string
  grade: string | null
  school: string | null
  profile: { id: string; full_name: string }
}

interface Props {
  laporan: Laporan[]
  courses: Course[]
  summary: Summary
  studentName: string
  childrenList?: Child[]
  activeChildId?: string
  isParent?: boolean
}

const attConfig: Record<string, { label: string; cls: string }> = {
  hadir: { label: 'Hadir',  cls: 'bg-green-50 text-green-700' },
  izin:  { label: 'Izin',   cls: 'bg-blue-50 text-blue-700' },
  sakit: { label: 'Sakit',  cls: 'bg-yellow-50 text-yellow-700' },
  alpha: { label: 'Alpha',  cls: 'bg-red-50 text-red-600' },
}

const AVATAR_COLORS = ['#5C4FE5','#E6B800','#16A34A','#2563EB','#DC2626']
function avatarColor(name: string) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]
}
function getInitials(name: string) {
  return name.split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase()
}

function getPerkembanganTag(teks: string | null) {
  if (!teks) return { label: '• Belum diisi', cls: 'bg-gray-100 text-gray-500' }
  const t = teks.toLowerCase()
  if (t.includes('baik') || t.includes('bagus') || t.includes('paham'))
    return { label: '✓ Perkembangan Baik', cls: 'bg-green-50 text-green-700' }
  if (t.includes('perlu') || t.includes('kurang') || t.includes('latihan'))
    return { label: '▶ Perlu Latihan', cls: 'bg-yellow-50 text-yellow-700' }
  return { label: '• Cukup', cls: 'bg-[#EAE8FD] text-[#5C4FE5]' }
}

export default function LaporanClient({ laporan, courses, summary, studentName, childrenList, activeChildId, isParent }: Props) {
  const [activeCourse, setActiveCourse] = useState<string>('semua')
  const [expandedId, setExpandedId]     = useState<string | null>(null)

  const total = summary.hadir + summary.izin + summary.sakit + summary.alpha
  const hadirPct = total > 0 ? Math.round((summary.hadir / total) * 100) : 0

  const filtered = activeCourse === 'semua'
    ? laporan
    : laporan.filter(l => l.sessions?.class_groups?.courses?.id === activeCourse)

  const hasMultipleChildren = isParent && childrenList && childrenList.length > 1

  return (
    <div className="flex gap-6">

      {/* Panel kiri — daftar anak (hanya jika ortu + 2+ anak) */}
      {hasMultipleChildren && (
        <div className="w-48 flex-shrink-0">
          <p className="text-[11px] font-bold text-[#9B97B2] uppercase tracking-wide mb-3 px-1">Siswa</p>
          <div className="space-y-1">
            {childrenList!.map(child => {
              const isActive = child.id === activeChildId
              const color = avatarColor(child.profile.full_name)
              return (
                <button
                  key={child.id}
                  onClick={() => {
                    document.cookie = `active_child=${child.id}; path=/`
                    window.location.reload()
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-colors
                    ${isActive ? 'bg-white border border-[#5C4FE5] shadow-sm' : 'hover:bg-white border border-transparent'}`}
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                    style={{ background: color }}
                  >
                    {getInitials(child.profile.full_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[12px] font-semibold truncate ${isActive ? 'text-[#5C4FE5]' : 'text-[#1A1530]'}`}>
                      {child.profile.full_name.split(' ')[0]}
                    </p>
                    <p className="text-[10px] text-[#9B97B2] truncate">Kelas {child.grade ?? '—'}</p>
                  </div>
                  {isActive && <div className="w-1.5 h-1.5 rounded-full bg-[#5C4FE5] flex-shrink-0" />}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Konten utama */}
      <div className="flex-1 min-w-0">
        <div className="mb-4">
          <h2 className="text-[16px] font-bold text-[#1A1530]">Laporan Belajar</h2>
          <p className="text-[12px] text-[#9B97B2] mt-0.5">{studentName}</p>
        </div>

        {/* Ringkasan kehadiran */}
        <div className="bg-white border border-[#E5E3FF] rounded-2xl p-4 mb-4">
          <p className="text-[12px] font-bold text-[#1A1530] mb-3">Ringkasan Kehadiran</p>
          <div className="mb-3">
            <div className="flex justify-between mb-1.5">
              <span className="text-[11px] text-[#9B97B2]">Total kehadiran</span>
              <span className="text-[11px] font-bold text-green-600">{hadirPct}%</span>
            </div>
            <div className="h-2 bg-[#F7F6FF] rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${hadirPct}%` }} />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Hadir',  val: summary.hadir,  cls: 'text-green-600' },
              { label: 'Izin',   val: summary.izin,   cls: 'text-blue-600' },
              { label: 'Sakit',  val: summary.sakit,  cls: 'text-yellow-600' },
              { label: 'Alpha',  val: summary.alpha,  cls: 'text-red-500' },
            ].map(({ label, val, cls }) => (
              <div key={label} className="bg-[#F7F6FF] border border-[#E5E3FF] rounded-xl p-2.5 text-center">
                <p className={`text-[20px] font-bold leading-none ${cls}`}>{val}</p>
                <p className="text-[10px] text-[#9B97B2] mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Filter mapel */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
          <button
            onClick={() => setActiveCourse('semua')}
            className={`text-[11px] font-bold px-4 py-2 rounded-full border flex-shrink-0 transition-colors
              ${activeCourse === 'semua' ? 'bg-[#5C4FE5] text-white border-[#5C4FE5]' : 'bg-white text-[#6B6580] border-[#E5E3FF]'}`}
          >
            Semua
          </button>
          {courses.map(c => (
            <button
              key={c.id}
              onClick={() => setActiveCourse(c.id)}
              className={`text-[11px] font-bold px-4 py-2 rounded-full border flex-shrink-0 transition-colors
                ${activeCourse === c.id ? 'text-white border-transparent' : 'bg-white text-[#6B6580] border-[#E5E3FF]'}`}
              style={activeCourse === c.id ? { background: c.color } : {}}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Daftar laporan */}
        {filtered.length === 0 ? (
          <div className="bg-white border border-[#E5E3FF] rounded-2xl py-10 text-center">
            <p className="text-[13px] font-semibold text-[#9B97B2]">Belum ada laporan</p>
            <p className="text-[11px] text-[#9B97B2] mt-1">untuk mata pelajaran ini</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(l => {
              const cg     = l.sessions?.class_groups
              const course = cg?.courses
              const tutor  = cg?.profiles
              const color  = course?.color ?? '#5C4FE5'
              const pkTag  = getPerkembanganTag(l.perkembangan)
              const attCfg = l.attendance ? attConfig[l.attendance.status] : null
              const isOpen = expandedId === l.id
              const tanggal = new Date(l.created_at).toLocaleDateString('id-ID', {
                timeZone: 'Asia/Jayapura', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
              })

              return (
                <div key={l.id} className="bg-white border border-[#E5E3FF] rounded-2xl overflow-hidden">
                  <button onClick={() => setExpandedId(isOpen ? null : l.id)} className="w-full p-4 text-left">
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: color }} />
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-[13px] font-bold text-[#1A1530]">{course?.name ?? cg?.label ?? '—'}</p>
                            <p className="text-[11px] text-[#9B97B2]">{tutor?.full_name ?? '—'} · {tanggal}</p>
                          </div>
                          <span className="text-[#9B97B2] text-[12px] flex-shrink-0">{isOpen ? '▲' : '▼'}</span>
                        </div>
                        {l.materi && <p className="text-[12px] text-[#6B6580] mt-1.5">Materi: {l.materi}</p>}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg ${pkTag.cls}`}>{pkTag.label}</span>
                          {attCfg && <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg ${attCfg.cls}`}>{attCfg.label}</span>}
                        </div>
                      </div>
                    </div>
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 border-t border-[#E5E3FF]">
                      <div className="pt-3">
                        <BilingualReport
                          laporan={{
                            materi:       l.materi,
                            perkembangan: l.perkembangan,
                            saranSiswa:   l.saran_siswa,
                            saranOrtu:    l.saran_ortu,
                            recordingUrl: null,
                          }}
                          audience="siswa"
                          defaultOpen={true}
                        />
                      </div>
                      {l.attendance?.notes && (
                        <div className="mt-3">
                          <p className="text-[10px] font-bold text-[#9B97B2] uppercase tracking-wide mb-1">Catatan Kehadiran</p>
                          <p className="text-[12px] text-[#1A1530] leading-relaxed">{l.attendance.notes}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
