'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { ChevronLeft, ExternalLink } from 'lucide-react'

type Achievement = { name: string; category: string; issuer: string; year: string }

const CATEGORIES: Record<string, { label: string; bg: string; color: string; icon: string }> = {
  pelatihan:   { label: 'Pelatihan',   bg: '#EEEDFE', color: '#3C3489', icon: '📚' },
  sertifikasi: { label: 'Sertifikasi', bg: '#E6F4EC', color: '#1A5C36', icon: '🎓' },
  prestasi:    { label: 'Prestasi',    bg: '#FEF3E2', color: '#92400E', icon: '🏆' },
  komunitas:   { label: 'Komunitas',   bg: '#E6F1FB', color: '#185FA5', icon: '🤝' },
}

function fmtRp(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })
}
function getInitials(name: string) {
  return name.split(' ').slice(0,2).map(n=>n[0]).join('').toUpperCase()
}

function convertToWIT(jam: string, timezone: string): string {
  const [h, m] = jam.split(':').map(Number)
  const offsetDiff = timezone === 'WIB' ? 2 : timezone === 'WITA' ? 1 : 0
  const witHour = (h + offsetDiff) % 24
  return `${String(witHour).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export default function TutorDetailPage() {
  const params   = useParams()
  const tutorId  = params.id as string
  const supabase = createClient()

  const [tutor,    setTutor]    = useState<any>(null)
  const [kelas,    setKelas]    = useState<any[]>([])
  const [sessions, setSessions] = useState<any[]>([])
  const [honors,   setHonors]   = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)
  const [tab,      setTab]      = useState<'profil'|'kelas'|'jadwal'|'honor'|'ketersediaan'>('profil')

  useEffect(() => { fetchAll() }, [tutorId])

  async function fetchAll() {
    setLoading(true)

    const { data: t } = await supabase
      .from('tutors')
      .select(`id, rate_per_session, bank_name, bank_account, bank_holder, is_active,
        education_level, education_major, education_university, education_year,
        subjects, teaching_experience_years, previous_workplaces, bio, achievements,
        availability,
        timezone,
        profiles:profile_id(full_name, phone, email),
        tutor_courses(courses(name, color))`)
      .eq('id', tutorId).single()
    setTutor(t)

    const { data: cg } = await supabase
      .from('class_groups')
      .select('id, label, status, class_types(name), enrollments(id, status)')
      .eq('tutor_id', tutorId)
    setKelas(cg ?? [])

    const now   = new Date()
    const start = new Date(now); start.setDate(now.getDate() - now.getDay() + 1)
    const end   = new Date(start); end.setDate(start.getDate() + 6)
    const cgIds = (cg ?? []).map((c: any) => c.id)
    if (cgIds.length > 0) {
      const { data: sess } = await supabase
        .from('sessions')
        .select('id, class_group_id, scheduled_at, status, zoom_link')
        .in('class_group_id', cgIds)
        .gte('scheduled_at', start.toISOString())
        .lte('scheduled_at', end.toISOString())
        .order('scheduled_at')
      const cgMap = Object.fromEntries((cg ?? []).map((c: any) => [c.id, c.label]))
      setSessions((sess ?? []).map((s: any) => ({ ...s, class_label: cgMap[s.class_group_id] ?? '—' })))
    }

    const { data: hon } = await supabase
      .from('tutor_payments')
      .select('id, period_label, sessions_done, students_count, class_type, rate_per_session, subtotal, bonus, total, status, created_at, class_group_id')
      .eq('tutor_id', tutorId)
      .order('created_at', { ascending: false })
    const cgMap2 = Object.fromEntries((cg ?? []).map((c: any) => [c.id, c.label]))
    setHonors((hon ?? []).map((h: any) => ({ ...h, class_label: cgMap2[h.class_group_id] ?? '—' })))

    setLoading(false)
  }

  if (loading) return <div className="p-6 text-sm text-[#7B78A8]">Memuat data tutor...</div>
  if (!tutor)  return <div className="p-6 text-sm text-red-500">Tutor tidak ditemukan.</div>

  const profile      = tutor.profiles
  const achievements = (tutor.achievements ?? []) as Achievement[]
  const subjects     = (tutor.subjects ?? []) as string[]
  const activeKelas  = kelas.filter((c: any) => c.status === 'active')
  const totalHonorLunas  = honors.filter(h => h.status === 'paid').reduce((a, h) => a + h.total, 0)
  const totalHonorUnpaid = honors.filter(h => h.status === 'unpaid').reduce((a, h) => a + h.total, 0)

  const STATUS_SESI: Record<string, { label: string; cls: string }> = {
    scheduled:   { label: 'Terjadwal', cls: 'bg-[#EEEDFE] text-[#3C3489]' },
    completed:   { label: 'Selesai',   cls: 'bg-[#E6F4EC] text-[#1A5C36]' },
    cancelled:   { label: 'Batal',     cls: 'bg-[#FEE9E9] text-[#991B1B]' },
  }

  const labelCls = "text-xs text-[#7B78A8]"
  const inputCls = "text-sm text-[#1A1640] font-medium"

  function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
    return value ? (
      <div><p className={labelCls}>{label}</p><p className={inputCls}>{value}</p></div>
    ) : null
  }

  const HARI = ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu']

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/tutor" className="text-[#7B78A8] hover:text-[#5C4FE5] transition-colors">
          <ChevronLeft size={20}/>
        </Link>
        <div className="flex-1"/>
        <Link href={`/admin/tutor/${tutorId}/edit`}
          className="px-4 py-2 bg-[#5C4FE5] text-white text-sm font-bold rounded-xl hover:bg-[#3D34C4] transition">
          Edit
        </Link>
      </div>

      {/* Profile card */}
      <div className="bg-white rounded-2xl border border-[#E5E3FF] p-5 mb-4">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-full bg-[#5C4FE5] flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
            {getInitials(profile?.full_name ?? 'T')}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-lg font-bold text-[#1A1640]">{profile?.full_name ?? '—'}</h1>
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${tutor.is_active ? 'bg-[#E6F4EC] text-[#1A5C36]' : 'bg-gray-100 text-gray-500'}`}>
                {tutor.is_active ? '● Aktif' : '● Nonaktif'}
              </span>
            </div>
            {tutor.education_major && (
              <p className="text-sm text-[#7B78A8] mb-2">{tutor.education_major}{tutor.teaching_experience_years ? ` · ${tutor.teaching_experience_years} tahun pengalaman` : ''}</p>
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {profile?.phone && <span className="text-xs text-[#7B78A8]">📱 {profile.phone}</span>}
              {profile?.email && <span className="text-xs text-[#7B78A8]">✉️ {profile.email}</span>}
              {tutor.bank_name && tutor.bank_account && (
                <span className="text-xs text-[#7B78A8]">🏦 {tutor.bank_name} · {tutor.bank_account}{tutor.bank_holder ? ` a/n ${tutor.bank_holder}` : ''}</span>
              )}
            </div>
            {subjects.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {subjects.map(s => (
                  <span key={s} className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#EEEDFE] text-[#3C3489]">{s}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#F7F6FF] p-1 rounded-xl mb-4 border border-[#E5E3FF]">
        {([
          { key: 'profil',       label: 'Profil' },
          { key: 'kelas',        label: `Kelas (${activeKelas.length})` },
          { key: 'jadwal',       label: 'Jadwal' },
          { key: 'honor',        label: 'Honor' },
          { key: 'ketersediaan', label: 'Ketersediaan' },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${tab === t.key ? 'bg-white text-[#5C4FE5] shadow-sm border border-[#E5E3FF]' : 'text-[#7B78A8] hover:text-[#1A1640]'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Profil */}
      {tab === 'profil' && (
        <div className="space-y-4">
          {(tutor.education_level || tutor.education_major || tutor.education_university) && (
            <div className="bg-white rounded-2xl border border-[#E5E3FF] p-5">
              <p className="text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-4">Riwayat Akademik</p>
              <div className="grid grid-cols-2 gap-4">
                <InfoRow label="Jenjang" value={tutor.education_level}/>
                <InfoRow label="Jurusan" value={tutor.education_major}/>
                <InfoRow label="Universitas" value={tutor.education_university}/>
                <InfoRow label="Tahun Lulus" value={tutor.education_year}/>
              </div>
            </div>
          )}
          {achievements.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#E5E3FF] p-5">
              <p className="text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-4">Pelatihan, Sertifikasi & Prestasi</p>
              <div className="space-y-2">
                {achievements.map((a, i) => {
                  const cat = CATEGORIES[a.category] ?? CATEGORIES['pelatihan']
                  return (
                    <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{background: cat.bg + '55'}}>
                      <span style={{fontSize:16}}>{cat.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[#1A1640]">{a.name}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                            style={{background: cat.bg, color: cat.color}}>{cat.label}</span>
                        </div>
                        {(a.issuer || a.year) && (
                          <p className="text-xs text-[#7B78A8] mt-0.5">{[a.issuer, a.year].filter(Boolean).join(' · ')}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {(tutor.teaching_experience_years || tutor.previous_workplaces || tutor.bio) && (
            <div className="bg-white rounded-2xl border border-[#E5E3FF] p-5">
              <p className="text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-4">Pengalaman & Bio</p>
              <div className="grid grid-cols-2 gap-4 mb-3">
                <InfoRow label="Lama Mengajar" value={tutor.teaching_experience_years ? `${tutor.teaching_experience_years} tahun` : null}/>
                <InfoRow label="Tempat Sebelumnya" value={tutor.previous_workplaces}/>
              </div>
              {tutor.bio && (
                <div>
                  <p className="text-xs text-[#7B78A8] mb-1">Bio</p>
                  <p className="text-sm text-[#1A1640] leading-relaxed">{tutor.bio}</p>
                </div>
              )}
            </div>
          )}
          {!tutor.education_level && !achievements.length && !tutor.bio && (
            <div className="bg-white rounded-2xl border border-[#E5E3FF] p-8 text-center">
              <p className="text-sm text-[#7B78A8]">Belum ada data profil akademik.</p>
              <Link href={`/admin/tutor/${tutorId}/edit`} className="text-sm text-[#5C4FE5] font-semibold hover:underline mt-2 block">+ Lengkapi profil</Link>
            </div>
          )}
        </div>
      )}

      {/* Tab: Kelas */}
      {tab === 'kelas' && (
        <div className="bg-white rounded-2xl border border-[#E5E3FF] overflow-hidden">
          {kelas.length === 0 ? (
            <div className="p-8 text-center text-sm text-[#7B78A8]">Belum ada kelas yang dipegang.</div>
          ) : (
            kelas.map((c: any, i) => {
              const aktif = c.enrollments?.filter((e: any) => e.status === 'active').length ?? 0
              const stCls = c.status === 'active' ? 'bg-[#E6F4EC] text-[#1A5C36]' : 'bg-gray-100 text-gray-500'
              const stLbl = c.status === 'active' ? 'Aktif' : c.status === 'completed' ? 'Selesai' : 'Nonaktif'
              return (
                <div key={c.id} className={`flex items-center justify-between px-5 py-4 ${i < kelas.length-1 ? 'border-b border-[#E5E3FF]' : ''}`}>
                  <div>
                    <p className="text-sm font-bold text-[#1A1640]">{c.label}</p>
                    <p className="text-xs text-[#7B78A8] mt-0.5">{c.class_types?.name} · {aktif} siswa aktif</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${stCls}`}>{stLbl}</span>
                    <Link href={`/admin/kelas/${c.id}`} className="p-1.5 rounded-lg text-[#5C4FE5] hover:bg-[#F0EEFF] transition">
                      <ExternalLink size={13}/>
                    </Link>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Tab: Jadwal */}
      {tab === 'jadwal' && (
        <div className="bg-white rounded-2xl border border-[#E5E3FF] overflow-hidden">
          <div className="px-5 py-3 bg-[#F7F6FF] border-b border-[#E5E3FF]">
            <p className="text-xs font-bold text-[#7B78A8] uppercase tracking-wide">Jadwal Minggu Ini</p>
          </div>
          {sessions.length === 0 ? (
            <div className="p-8 text-center text-sm text-[#7B78A8]">Tidak ada sesi minggu ini.</div>
          ) : (
            sessions.map((s, i) => {
              const st = STATUS_SESI[s.status] ?? { label: s.status, cls: 'bg-gray-100 text-gray-600' }
              return (
                <div key={s.id} className={`flex items-center gap-4 px-5 py-3.5 ${i < sessions.length-1 ? 'border-b border-[#E5E3FF]' : ''}`}>
                  <div className="min-w-[44px] text-sm font-bold text-[#5C4FE5]">{fmtTime(s.scheduled_at)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#1A1640] truncate">{s.class_label}</p>
                    <p className="text-xs text-[#7B78A8]">{fmtDate(s.scheduled_at)}</p>
                  </div>
                  {s.zoom_link && (
                    <a href={s.zoom_link} target="_blank" rel="noopener noreferrer"
                      className="text-[#5C4FE5] hover:opacity-70 transition"><ExternalLink size={13}/></a>
                  )}
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${st.cls}`}>{st.label}</span>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Tab: Honor */}
      {tab === 'honor' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#E6F4EC] rounded-2xl p-4">
              <p className="text-xs font-bold text-[#1A5C36] mb-1">Sudah Dibayar</p>
              <p className="text-lg font-black text-[#1A5C36]">{fmtRp(totalHonorLunas)}</p>
            </div>
            <div className="bg-[#FEE9E9] rounded-2xl p-4">
              <p className="text-xs font-bold text-[#991B1B] mb-1">Belum Dibayar</p>
              <p className="text-lg font-black text-[#991B1B]">{fmtRp(totalHonorUnpaid)}</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-[#E5E3FF] overflow-hidden">
            <div className="px-5 py-3 bg-[#F7F6FF] border-b border-[#E5E3FF]">
              <p className="text-xs font-bold text-[#7B78A8] uppercase tracking-wide">Riwayat Honor</p>
            </div>
            {honors.length === 0 ? (
              <div className="p-8 text-center text-sm text-[#7B78A8]">Belum ada tagihan honor.</div>
            ) : (
              honors.map((h, i) => {
                const isPerSiswa = h.class_type === 'Semi Privat' || h.class_type === 'Reguler'
                return (
                  <div key={h.id} className={`flex items-start justify-between px-5 py-4 ${i < honors.length-1 ? 'border-b border-[#E5E3FF]' : ''}`}>
                    <div>
                      <p className="text-sm font-bold text-[#1A1640]">{h.period_label ?? '—'}</p>
                      <p className="text-xs text-[#7B78A8] mt-0.5">
                        {h.sessions_done} sesi · {h.class_label} · {h.class_type}
                        {isPerSiswa ? ` · ${h.students_count} siswa` : ''}
                      </p>
                      {h.bonus > 0 && <p className="text-xs text-[#5C4FE5] font-semibold mt-0.5">+ Bonus {fmtRp(h.bonus)}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-[#1A1640]">{fmtRp(h.total)}</p>
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full mt-1 inline-block ${h.status === 'paid' ? 'bg-[#E6F4EC] text-[#1A5C36]' : 'bg-[#FEE9E9] text-[#991B1B]'}`}>
                        {h.status === 'paid' ? 'Lunas' : 'Belum Dibayar'}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* Tab: Ketersediaan */}
      {tab === 'ketersediaan' && (
        <div className="space-y-3">
          {(() => {
            const availability = (tutor.availability ?? {}) as Record<string, string[]>
            const tz           = tutor.timezone ?? 'WIT'
            const isWIT        = tz === 'WIT'
            const adaData      = HARI.some(h => (availability[h] ?? []).length > 0)

            return (
              <>
                {/* Info zona waktu tutor */}
                <div className={`px-4 py-3 rounded-xl flex items-center gap-3 border ${
                  tz === 'WIT'  ? 'bg-[#EEEDFE] border-[#CECBF6]' :
                  tz === 'WITA' ? 'bg-[#E1F5EE] border-[#9FE1CB]' :
                  'bg-[#E6F1FB] border-[#85B7EB]'
                }`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${
                    tz === 'WIT' ? 'bg-[#5C4FE5]' : tz === 'WITA' ? 'bg-[#1D9E75]' : 'bg-[#185FA5]'
                  }`}>{tz}</div>
                  <div>
                    <p className="text-xs font-bold text-[#1A1640]">Zona waktu tutor: {tz} ({tz === 'WIB' ? 'UTC+7' : tz === 'WITA' ? 'UTC+8' : 'UTC+9'})</p>
                    {!isWIT && (
                      <p className="text-[11px] text-[#7B78A8] mt-0.5">
                        Jam dalam {tz} — kolom WIT menampilkan konversi otomatis
                      </p>
                    )}
                  </div>
                </div>

                {!adaData ? (
                  <div className="bg-white rounded-2xl border border-[#E5E3FF] p-8 text-center">
                    <p className="text-sm text-[#7B78A8]">Tutor belum mengisi ketersediaan mengajar.</p>
                  </div>
                ) : (
                  HARI.map(hari => {
                    const jam = availability[hari] ?? []
                    if (jam.length === 0) return null
                    return (
                      <div key={hari} className="bg-white rounded-2xl border border-[#E5E3FF] overflow-hidden">
                        <div className="px-4 py-3 border-b border-[#F0EFFF] bg-[#EEEDFE] flex items-center justify-between">
                          <p className="text-sm font-bold text-[#3C3489]">{hari}</p>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#5C4FE5] text-white">
                            {jam.length} jam
                          </span>
                        </div>
                        <div className="px-4 py-3">
                          {!isWIT && (
                            <div className="grid grid-cols-2 gap-1 text-[10px] font-bold text-[#7B78A8] uppercase tracking-wider mb-2 px-1">
                              <span>{tz}</span><span>WIT</span>
                            </div>
                          )}
                          <div className="flex flex-wrap gap-2">
                            {jam.map((j: string) => (
                              <div key={j} className="flex items-center gap-1.5">
                                <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#EEEDFE] text-[#3C3489] border border-[#CECBF6]">
                                  {j}
                                </span>
                                {!isWIT && (
                                  <>
                                    <span className="text-[10px] text-[#7B78A8]">→</span>
                                    <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#F0EFFF] text-[#5C4FE5] border border-[#E5E3FF]">
                                      {convertToWIT(j, tz)} WIT
                                    </span>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </>
            )
          })()}
        </div>
      )}
    </div>
  )
}
