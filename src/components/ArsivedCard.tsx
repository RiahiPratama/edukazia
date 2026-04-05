'use client'

import ManekinNeko from '@/components/ManekinNeko'

interface ArchivedItem {
  studentId: string
  studentName: string
  archived: { classLabel: string; tutorName: string; total: number }[]
}

interface Props {
  archivedData: ArchivedItem[]
  adminPhone: string | null
}

function cleanPhone(phone: string) {
  return phone.split('').filter(c => c >= '0' && c <= '9').join('')
}

export default function ArsivedCard({ archivedData, adminPhone }: Props) {
  if (!archivedData || archivedData.length === 0) return null

  const waMsg = 'Halo Admin EduKazia, saya ingin mendaftarkan kembali paket belajar untuk periode berikutnya. Mohon informasi paket yang tersedia. Terima kasih'
  const waHref = adminPhone
    ? 'https://wa.me/' + cleanPhone(adminPhone) + '?text=' + encodeURIComponent(waMsg)
    : null

  return (
    <div>
      {/* Label section */}
      <div className="flex items-center gap-2 mb-2">
        <div className="flex items-center justify-center w-5 h-5 rounded-md flex-shrink-0"
          style={{ background: 'rgba(239,68,68,0.12)' }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>
        <p className="text-[12px] font-bold" style={{ color: '#ef4444' }}>
          Paket kelas perlu diperpanjang
        </p>
      </div>

      <div className="relative rounded-2xl overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #1A0A00 0%, #2D1200 100%)' }}>
        {/* Dekorasi */}
        <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full pointer-events-none animate-pulse"
          style={{ background: 'rgba(230,184,0,0.12)', filter: 'blur(20px)' }} />
        <div className="absolute -bottom-4 -left-4 w-20 h-20 rounded-full pointer-events-none"
          style={{ background: 'rgba(239,68,68,0.1)', filter: 'blur(16px)' }} />
        <div className="absolute top-0 left-0 right-0 h-0.5"
          style={{ background: 'linear-gradient(90deg, #ef4444, #E6B800, #ef4444)' }} />

        <div className="relative z-10 p-4">
          {/* Maneki Neko */}
          <div className="flex justify-center mb-3">
            <ManekinNeko />
          </div>

          {/* Header */}
          <div className="flex items-start gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center"
              style={{ background: 'rgba(230,184,0,0.15)', border: '1px solid rgba(230,184,0,0.2)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E6B800" strokeWidth="1.8" strokeLinecap="round">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <div>
              <p className="text-[13px] font-extrabold text-white leading-tight">
                Lanjutkan perjalanan belajar!
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Kelas berikut sudah selesai dan siap diperpanjang
              </p>
            </div>
          </div>

          {/* List kelas arsip */}
          <div className="space-y-2 mb-4">
            {archivedData.flatMap(s =>
              s.archived.map((kelas, ki) => (
                <div key={s.studentId + ki}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center"
                    style={{ background: 'rgba(230,184,0,0.1)', border: '1px solid rgba(230,184,0,0.15)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E6B800" strokeWidth="2" strokeLinecap="round">
                      <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/>
                      <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-bold text-white truncate">{kelas.classLabel}</p>
                    <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.45)' }}>
                      {s.studentName} · {kelas.tutorName} · {kelas.total} sesi
                    </p>
                  </div>
                  <div className="flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg"
                    style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    <span style={{ fontSize: 9, fontWeight: 700, color: '#22c55e' }}>Selesai</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* CTA perpanjang */}
          {waHref && (
            <a href={waHref} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-extrabold text-[13px] active:scale-95 transition-transform"
              style={{ background: 'linear-gradient(135deg, #E6B800 0%, #f5c93e 100%)', color: '#1A0A00', boxShadow: '0 4px 20px rgba(230,184,0,0.3)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#1A0A00">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.553 4.122 1.524 5.854L0 24l6.337-1.501A11.955 11.955 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.007-1.373l-.36-.213-3.761.891.946-3.657-.234-.376A9.818 9.818 0 012.182 12C2.182 6.58 6.58 2.182 12 2.182S21.818 6.58 21.818 12 17.42 21.818 12 21.818z"/>
              </svg>
              Perpanjang Paket Sekarang
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1A0A00" strokeWidth="2.5" strokeLinecap="round">
                <line x1="5" y1="12" x2="19" y2="12"/>
                <polyline points="12 5 19 12 12 19"/>
              </svg>
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
