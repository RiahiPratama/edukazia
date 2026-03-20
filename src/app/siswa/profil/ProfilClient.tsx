'use client'

import { useState } from 'react'
import { getInitials, getEnrollmentStatus } from '@/lib/siswa/helpers'
import type { Student } from '@/lib/siswa/helpers'

interface Profile {
  id: string
  full_name: string
  role: string
  phone: string | null
  email: string | null
  avatar_url: string | null
}

interface Props {
  profile: Profile
  childrenList: any[]
  activeChild: any
  isParent: boolean
}

const AVATAR_COLORS = ['#5C4FE5', '#E6B800', '#16A34A', '#2563EB', '#DC2626']

function getAvatarColor(name: string) {
  const idx = name.charCodeAt(0) % AVATAR_COLORS.length
  return AVATAR_COLORS[idx]
}

export default function ProfilClient({ profile, childrenList, activeChild, isParent }: Props) {
  const [activeTab, setActiveTab] = useState<'siswa' | 'akun'>('siswa')
  const [selectedChild, setSelectedChild] = useState<any>(activeChild)

  const isSelf = selectedChild?.relation_role === 'Diri Sendiri'
  const enrollments = selectedChild?.enrollments ?? []

  return (
    <div className="px-4 pt-4 pb-2">
      <div className="mb-4">
        <h2 className="text-[16px] font-bold text-[#1A1530]">Profil</h2>
        <p className="text-[12px] text-[#9B97B2] mt-0.5">
          {isParent ? 'Data siswa & akun orang tua' : 'Data siswa & akun'}
        </p>
      </div>

      {/* ── TAB ── */}
      <div className="flex bg-[#F7F6FF] border border-[#E5E3FF] rounded-xl p-1 mb-4">
        {[
          { key: 'siswa', label: 'Data Siswa' },
          { key: 'akun',  label: isParent ? 'Akun Orang Tua' : 'Akun Saya' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as 'siswa' | 'akun')}
            className={`flex-1 text-[12px] font-bold py-2 rounded-lg transition-colors
              ${activeTab === key
                ? 'bg-white text-[#5C4FE5] shadow-sm'
                : 'text-[#9B97B2]'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════
          TAB: DATA SISWA
      ══════════════════════════════════════ */}
      {activeTab === 'siswa' && (
        <div className="space-y-4">

          {/* Pilih anak — hanya muncul jika ortu punya 2+ anak */}
          {isParent && childrenList.length > 1 && (
            <div className="bg-white border border-[#E5E3FF] rounded-2xl p-4">
              <p className="text-[11px] font-bold text-[#9B97B2] uppercase tracking-wide mb-3">
                Pilih Siswa
              </p>
              <div className="space-y-2">
                {childrenList.map((child: any) => {
                  const isSelected = child.id === selectedChild?.id
                  const color = getAvatarColor(child.profile.full_name)
                  return (
                    <button
                      key={child.id}
                      onClick={() => setSelectedChild(child)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors text-left
                        ${isSelected
                          ? 'border-[#5C4FE5] bg-[#EAE8FD]'
                          : 'border-[#E5E3FF] bg-[#F7F6FF]'}`}
                    >
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-bold text-white flex-shrink-0"
                        style={{ background: color }}
                      >
                        {getInitials(child.profile.full_name)}
                      </div>
                      <div className="flex-1">
                        <p className="text-[13px] font-bold text-[#1A1530]">{child.profile.full_name}</p>
                        <p className="text-[11px] text-[#9B97B2]">
                          Kelas {child.grade} · {child.school ?? '—'}
                        </p>
                      </div>
                      {isSelected && (
                        <span className="text-[#5C4FE5] text-[12px] font-bold">✓</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {selectedChild && (
            <>
              {/* Avatar + nama siswa */}
              <div className="bg-white border border-[#E5E3FF] rounded-2xl p-4">
                <div className="flex items-center gap-4 mb-4">
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center text-[20px] font-bold text-white flex-shrink-0"
                    style={{ background: getAvatarColor(selectedChild.profile.full_name) }}
                  >
                    {getInitials(selectedChild.profile.full_name)}
                  </div>
                  <div>
                    <p className="text-[15px] font-bold text-[#1A1530]">
                      {selectedChild.profile.full_name}
                    </p>
                    <p className="text-[12px] text-[#9B97B2]">
                      Kelas {selectedChild.grade} · {selectedChild.school ?? '—'}
                    </p>
                    <span className={`inline-block text-[10px] font-bold mt-1 px-2.5 py-0.5 rounded-full
                      ${selectedChild.status === 'active'
                        ? 'bg-green-50 text-green-700'
                        : 'bg-red-50 text-red-600'}`}
                    >
                      {selectedChild.status === 'active' ? 'Aktif' : 'Tidak Aktif'}
                    </span>
                  </div>
                </div>

                {/* Detail data siswa */}
                <div className="space-y-3">
                  <InfoRow label="Nama Lengkap"  value={selectedChild.profile.full_name} />
                  <InfoRow label="No. HP"         value={selectedChild.profile.phone} />
                  <InfoRow label="Email"          value={selectedChild.profile.email} />
                  <InfoRow label="Kelas/Tingkat"  value={selectedChild.grade} />
                  <InfoRow label="Sekolah"        value={selectedChild.school} />
                  {selectedChild.birth_date && (
                    <InfoRow label="Tanggal Lahir" value={
                      new Date(selectedChild.birth_date).toLocaleDateString('id-ID', {
                        day: 'numeric', month: 'long', year: 'numeric'
                      })
                    } />
                  )}
                  {selectedChild.province && (
                    <InfoRow label="Asal Daerah" value={
                      [selectedChild.city, selectedChild.province].filter(Boolean).join(', ')
                    } />
                  )}
                </div>
              </div>

              {/* Data pihak berelasi — sembunyikan jika Diri Sendiri */}
              {!isSelf && (
                <div className="bg-white border border-[#E5E3FF] rounded-2xl p-4">
                  <p className="text-[11px] font-bold text-[#9B97B2] uppercase tracking-wide mb-3">
                    {selectedChild.relation_role ?? 'Orang Tua / Wali'}
                  </p>
                  <div className="space-y-3">
                    <InfoRow label="Nama"  value={selectedChild.relation_name} />
                    <InfoRow label="No. HP" value={selectedChild.relation_phone} />
                    <InfoRow label="Email"  value={selectedChild.relation_email} />
                  </div>
                </div>
              )}

              {/* Enrollment aktif */}
              {enrollments.length > 0 && (
                <div className="bg-white border border-[#E5E3FF] rounded-2xl p-4">
                  <p className="text-[11px] font-bold text-[#9B97B2] uppercase tracking-wide mb-3">
                    Paket Kursus
                  </p>
                  <div className="space-y-2">
                    {enrollments.map((e: any) => {
                      const status = getEnrollmentStatus(e)
                      const course = e.class_groups?.courses
                      const color  = course?.color ?? '#5C4FE5'
                      return (
                        <div key={e.id} className="flex items-center gap-3 p-3 bg-[#F7F6FF] rounded-xl">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                          <div className="flex-1">
                            <p className="text-[12px] font-bold text-[#1A1530]">
                              {course?.name ?? e.class_groups?.label ?? '—'}
                            </p>
                            {e.end_date && (
                              <p className="text-[10px] text-[#9B97B2]">
                                Berakhir: {new Date(e.end_date).toLocaleDateString('id-ID', {
                                  day: 'numeric', month: 'short', year: 'numeric'
                                })}
                              </p>
                            )}
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full
                            ${status === 'active'
                              ? 'bg-green-50 text-green-700'
                              : 'bg-red-50 text-red-600'}`}
                          >
                            {status === 'active' ? 'Aktif' : 'Berakhir'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════
          TAB: AKUN
      ══════════════════════════════════════ */}
      {activeTab === 'akun' && (
        <div className="space-y-4">
          {/* Avatar akun */}
          <div className="bg-white border border-[#E5E3FF] rounded-2xl p-4">
            <div className="flex items-center gap-4 mb-4">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center text-[20px] font-bold text-white flex-shrink-0"
                style={{ background: getAvatarColor(profile.full_name) }}
              >
                {getInitials(profile.full_name)}
              </div>
              <div>
                <p className="text-[15px] font-bold text-[#1A1530]">{profile.full_name}</p>
                <p className="text-[12px] text-[#9B97B2] capitalize">
                  {isParent ? 'Orang Tua / Wali' : 'Siswa'}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <InfoRow label="Nama Lengkap" value={profile.full_name} />
              <InfoRow label="Email Login"  value={profile.email} />
              <InfoRow label="No. HP"       value={profile.phone} />
              <InfoRow label="Role"         value={isParent ? 'Orang Tua / Wali' : 'Siswa'} />
            </div>
          </div>

          {/* Hubungi admin untuk ubah data */}
          <div className="bg-[#EAE8FD] border border-[#C8C4F5] rounded-2xl p-4">
            <p className="text-[12px] font-bold text-[#3C3489] mb-1">
              Perlu mengubah data akun?
            </p>
            <p className="text-[11px] text-[#5C4FE5] mb-3">
              Hubungi admin EduKazia untuk memperbarui email, password, atau data lainnya.
            </p>
            <a
              href={`https://wa.me/${process.env.NEXT_PUBLIC_WA_NUMBER}?text=Halo Admin EduKazia, saya ingin mengubah data akun saya atas nama ${profile.full_name}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#5C4FE5] text-white text-[12px] font-bold px-4 py-2.5 rounded-xl"
            >
              <span>💬</span> Hubungi Admin via WhatsApp
            </a>
          </div>

          {/* Daftar anak — hanya untuk ortu */}
          {isParent && childrenList.length > 0 && (
            <div className="bg-white border border-[#E5E3FF] rounded-2xl p-4">
              <p className="text-[11px] font-bold text-[#9B97B2] uppercase tracking-wide mb-3">
                Siswa yang Terdaftar ({childrenList.length})
              </p>
              <div className="space-y-2">
                {childrenList.map((child: any) => {
                  const color = getAvatarColor(child.profile.full_name)
                  const activeCount = child.enrollments?.filter(
                    (e: any) => getEnrollmentStatus(e) === 'active'
                  ).length ?? 0
                  return (
                    <div key={child.id} className="flex items-center gap-3 p-3 bg-[#F7F6FF] rounded-xl">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
                        style={{ background: color }}
                      >
                        {getInitials(child.profile.full_name)}
                      </div>
                      <div className="flex-1">
                        <p className="text-[13px] font-bold text-[#1A1530]">{child.profile.full_name}</p>
                        <p className="text-[11px] text-[#9B97B2]">
                          Kelas {child.grade} · {activeCount} mapel aktif
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Komponen baris info ──
function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-[#F7F6FF] last:border-0">
      <span className="text-[11px] font-bold text-[#9B97B2] uppercase tracking-wide flex-shrink-0">
        {label}
      </span>
      <span className="text-[12px] text-[#1A1530] text-right">
        {value ?? <span className="text-[#C4C2D4]">—</span>}
      </span>
    </div>
  )
}
