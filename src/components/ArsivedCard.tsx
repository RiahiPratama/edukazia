'use client'

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

          {/* CTA perpanjang — Maneki Neko mengintip + tombol WA */}
          {waHref && (
            <div className="rounded-2xl overflow-hidden"
              style={{ background: 'linear-gradient(135deg, #E6B800 0%, #f5c93e 100%)', boxShadow: '0 4px 24px rgba(230,184,0,0.35)' }}>
              {/* Area kuning — fixed height supaya Neko tidak mengembang card */}
              <div className="relative overflow-hidden" style={{ height: 90 }}>
                <div className="absolute left-4 top-0 bottom-0 flex flex-col justify-center">
                  <p className="text-[16px] font-extrabold leading-tight" style={{ color: '#1A0A00' }}>
                    Yuk lanjut belajar lagi!
                  </p>
                  <p className="text-[11px] mt-1" style={{ color: 'rgba(26,10,0,0.6)' }}>
                    Kucing keberuntungan sudah memanggil
                  </p>
                </div>
                {/* Neko mengintip dari kanan — overflow dipotong */}
                <div className="absolute right-0 bottom-0" style={{ width: 130 }}>
                  <svg width="160" height="230" viewBox="0 0 180 260" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', marginBottom: -10 }}>
                    <g style={{ animation: 'neko-float 3s ease-in-out infinite' }}>
                      <path d="M 58 210 Q 28 230 36 200 Q 44 172 62 185" fill="none" stroke="#F5C4B3" strokeWidth="10" strokeLinecap="round"/>
                      <path d="M 58 210 Q 28 230 36 200 Q 44 172 62 185" fill="none" stroke="white" strokeWidth="5" strokeLinecap="round"/>
                      <ellipse cx="90" cy="195" rx="46" ry="50" fill="white" stroke="#F0C0B0" strokeWidth="1.5"/>
                      <ellipse cx="90" cy="205" rx="28" ry="33" fill="#FFF9F7"/>
                      <ellipse cx="90" cy="163" rx="14" ry="5" fill="#E05050"/>
                      <rect x="84" y="163" width="12" height="10" rx="3" fill="#E05050"/>
                      <ellipse cx="90" cy="173" rx="5" ry="4" fill="#CC3030"/>
                      <ellipse cx="68" cy="240" rx="12" ry="8" fill="white" stroke="#F0C0B0" strokeWidth="1.2"/>
                      <ellipse cx="112" cy="240" rx="12" ry="8" fill="white" stroke="#F0C0B0" strokeWidth="1.2"/>
                      <ellipse cx="48" cy="192" rx="9" ry="12" fill="white" stroke="#F0C0B0" strokeWidth="1.2"/>
                      <ellipse cx="48" cy="196" rx="6" ry="7" fill="#FFF0ED"/>
                      <g transform="translate(36 178)">
                        <ellipse cx="12" cy="10" rx="11" ry="11" fill="#E6B800" stroke="#B8960A" strokeWidth="1.5"/>
                        <text x="12" y="14" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#7A6000">福</text>
                      </g>
                      <g style={{ transformOrigin: '72px 108px', animation: 'neko-wave 1.2s ease-in-out infinite' }}>
                        <rect x="116" y="158" width="14" height="28" rx="7" fill="white" stroke="#F0C0B0" strokeWidth="1.2" transform="rotate(-15 123 162)"/>
                        <ellipse cx="128" cy="142" rx="11" ry="13" fill="white" stroke="#F0C0B0" strokeWidth="1.5" transform="rotate(-15 128 142)"/>
                        <ellipse cx="128" cy="144" rx="8" ry="9" fill="#FFF0ED" transform="rotate(-15 128 144)"/>
                        <ellipse cx="120" cy="133" rx="3" ry="4" fill="white" stroke="#F0C0B0" strokeWidth="1" transform="rotate(-20 120 133)"/>
                        <ellipse cx="127" cy="131" rx="3" ry="4.5" fill="white" stroke="#F0C0B0" strokeWidth="1"/>
                        <ellipse cx="134" cy="133" rx="3" ry="4" fill="white" stroke="#F0C0B0" strokeWidth="1" transform="rotate(20 134 133)"/>
                      </g>
                      <ellipse cx="90" cy="108" rx="42" ry="38" fill="white" stroke="#F0C0B0" strokeWidth="1.5"/>
                      <polygon points="54,82 48,58 72,74" fill="white" stroke="#F0C0B0" strokeWidth="1.5"/>
                      <polygon points="57,80 52,63 69,73" fill="#FFD0D0"/>
                      <polygon points="126,82 132,58 108,74" fill="white" stroke="#F0C0B0" strokeWidth="1.5"/>
                      <polygon points="123,80 128,63 111,73" fill="#FFD0D0"/>
                      <ellipse cx="74" cy="96" rx="14" ry="10" fill="#F5A878" opacity="0.7"/>
                      <g style={{ transformOrigin: '78px 118px', animation: 'neko-blink 4s ease-in-out infinite' }}>
                        <ellipse cx="78" cy="110" rx="7" ry="7" fill="#1A1A2E"/>
                        <ellipse cx="80" cy="108" rx="2.5" ry="2.5" fill="white"/>
                      </g>
                      <g style={{ transformOrigin: '102px 118px', animation: 'neko-blink 4s ease-in-out infinite' }}>
                        <ellipse cx="102" cy="110" rx="7" ry="7" fill="#1A1A2E"/>
                        <ellipse cx="104" cy="108" rx="2.5" ry="2.5" fill="white"/>
                      </g>
                      <polygon points="90,118 87,122 93,122" fill="#FF8FAB"/>
                      <path d="M 90 123 Q 85 130 80 127" fill="none" stroke="#FF8FAB" strokeWidth="1.5" strokeLinecap="round"/>
                      <path d="M 90 123 Q 95 130 100 127" fill="none" stroke="#FF8FAB" strokeWidth="1.5" strokeLinecap="round"/>
                      <line x1="88" y1="122" x2="58" y2="116" stroke="#ccc" strokeWidth="1" strokeLinecap="round"/>
                      <line x1="88" y1="124" x2="58" y2="124" stroke="#ccc" strokeWidth="1" strokeLinecap="round"/>
                      <line x1="92" y1="122" x2="122" y2="116" stroke="#ccc" strokeWidth="1" strokeLinecap="round"/>
                      <line x1="92" y1="124" x2="122" y2="124" stroke="#ccc" strokeWidth="1" strokeLinecap="round"/>
                      <rect x="74" y="200" width="32" height="14" rx="7" fill="#5C4FE5"/>
                      <text x="90" y="210" textAnchor="middle" fontSize="7" fontWeight="bold" fill="white">EduKazia</text>
                    </g>
                  </svg>
                </div>
              </div>
              {/* Tombol WA */}
              <a href={waHref} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3.5 font-extrabold text-[13px] active:scale-95 transition-transform"
                style={{ background: 'rgba(0,0,0,0.18)', color: '#1A0A00' }}>
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
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
