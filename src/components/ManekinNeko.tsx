export default function ManekinNeko() {
  return (
    <svg width="110" height="155" viewBox="0 0 180 260" xmlns="http://www.w3.org/2000/svg" style={{ overflow: 'visible' }}>
      <g style={{ animation: 'neko-sparkle 1.5s ease-in-out infinite 0s' }}>
        <line x1="130" y1="72" x2="142" y2="60" stroke="#E6B800" strokeWidth="2" strokeLinecap="round"/>
        <line x1="144" y1="78" x2="158" y2="72" stroke="#E6B800" strokeWidth="2" strokeLinecap="round"/>
        <line x1="136" y1="60" x2="136" y2="48" stroke="#E6B800" strokeWidth="2" strokeLinecap="round"/>
      </g>
      <g style={{ animation: 'neko-sparkle 1.5s ease-in-out infinite 0.5s' }}>
        <circle cx="152" cy="62" r="3" fill="#E6B800"/>
      </g>
      <g style={{ animation: 'neko-sparkle 1.5s ease-in-out infinite 1s' }}>
        <circle cx="125" cy="55" r="2" fill="#5C4FE5"/>
        <circle cx="160" cy="80" r="2" fill="#5C4FE5"/>
      </g>

      <g style={{ animation: 'neko-float 3s ease-in-out infinite' }}>
        {/* Shadow */}
        <ellipse cx="90" cy="248" rx="42" ry="7" fill="rgba(0,0,0,0.15)"/>

        {/* Ekor */}
        <path d="M 58 210 Q 28 230 36 200 Q 44 172 62 185" fill="none" stroke="#F5C4B3" strokeWidth="10" strokeLinecap="round"/>
        <path d="M 58 210 Q 28 230 36 200 Q 44 172 62 185" fill="none" stroke="white" strokeWidth="5" strokeLinecap="round"/>

        {/* Badan */}
        <ellipse cx="90" cy="195" rx="46" ry="50" fill="white" stroke="#F0C0B0" strokeWidth="1.5"/>
        <ellipse cx="90" cy="205" rx="28" ry="33" fill="#FFF9F7"/>

        {/* Dasi */}
        <ellipse cx="90" cy="163" rx="14" ry="5" fill="#E05050"/>
        <rect x="84" y="163" width="12" height="10" rx="3" fill="#E05050"/>
        <ellipse cx="90" cy="173" rx="5" ry="4" fill="#CC3030"/>

        {/* Kaki */}
        <ellipse cx="68" cy="240" rx="12" ry="8" fill="white" stroke="#F0C0B0" strokeWidth="1.2"/>
        <ellipse cx="112" cy="240" rx="12" ry="8" fill="white" stroke="#F0C0B0" strokeWidth="1.2"/>

        {/* Tangan kiri + koin */}
        <ellipse cx="48" cy="192" rx="9" ry="12" fill="white" stroke="#F0C0B0" strokeWidth="1.2"/>
        <ellipse cx="48" cy="196" rx="6" ry="7" fill="#FFF0ED"/>
        <g transform="translate(36 178)">
          <ellipse cx="12" cy="10" rx="11" ry="11" fill="#E6B800" stroke="#B8960A" strokeWidth="1.5"/>
          <text x="12" y="14" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#7A6000">福</text>
        </g>

        {/* Tangan kanan melambai */}
        <g style={{ transformOrigin: '72px 108px', animation: 'neko-wave 1.2s ease-in-out infinite' }}>
          <rect x="116" y="158" width="14" height="28" rx="7" fill="white" stroke="#F0C0B0" strokeWidth="1.2" transform="rotate(-15 123 162)"/>
          <ellipse cx="128" cy="142" rx="11" ry="13" fill="white" stroke="#F0C0B0" strokeWidth="1.5" transform="rotate(-15 128 142)"/>
          <ellipse cx="128" cy="144" rx="8" ry="9" fill="#FFF0ED" transform="rotate(-15 128 144)"/>
          <ellipse cx="120" cy="133" rx="3" ry="4" fill="white" stroke="#F0C0B0" strokeWidth="1" transform="rotate(-20 120 133)"/>
          <ellipse cx="127" cy="131" rx="3" ry="4.5" fill="white" stroke="#F0C0B0" strokeWidth="1"/>
          <ellipse cx="134" cy="133" rx="3" ry="4" fill="white" stroke="#F0C0B0" strokeWidth="1" transform="rotate(20 134 133)"/>
        </g>

        {/* Kepala */}
        <ellipse cx="90" cy="108" rx="42" ry="38" fill="white" stroke="#F0C0B0" strokeWidth="1.5"/>

        {/* Telinga */}
        <polygon points="54,82 48,58 72,74" fill="white" stroke="#F0C0B0" strokeWidth="1.5"/>
        <polygon points="57,80 52,63 69,73" fill="#FFD0D0"/>
        <polygon points="126,82 132,58 108,74" fill="white" stroke="#F0C0B0" strokeWidth="1.5"/>
        <polygon points="123,80 128,63 111,73" fill="#FFD0D0"/>

        {/* Bercak oren */}
        <ellipse cx="74" cy="96" rx="14" ry="10" fill="#F5A878" opacity="0.7"/>

        {/* Mata */}
        <g style={{ transformOrigin: '78px 118px', animation: 'neko-blink 4s ease-in-out infinite' }}>
          <ellipse cx="78" cy="110" rx="7" ry="7" fill="#1A1A2E"/>
          <ellipse cx="80" cy="108" rx="2.5" ry="2.5" fill="white"/>
        </g>
        <g style={{ transformOrigin: '102px 118px', animation: 'neko-blink 4s ease-in-out infinite' }}>
          <ellipse cx="102" cy="110" rx="7" ry="7" fill="#1A1A2E"/>
          <ellipse cx="104" cy="108" rx="2.5" ry="2.5" fill="white"/>
        </g>

        {/* Hidung + mulut */}
        <polygon points="90,118 87,122 93,122" fill="#FF8FAB"/>
        <path d="M 90 123 Q 85 130 80 127" fill="none" stroke="#FF8FAB" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M 90 123 Q 95 130 100 127" fill="none" stroke="#FF8FAB" strokeWidth="1.5" strokeLinecap="round"/>

        {/* Kumis */}
        <line x1="88" y1="122" x2="58" y2="116" stroke="#ccc" strokeWidth="1" strokeLinecap="round"/>
        <line x1="88" y1="124" x2="58" y2="124" stroke="#ccc" strokeWidth="1" strokeLinecap="round"/>
        <line x1="92" y1="122" x2="122" y2="116" stroke="#ccc" strokeWidth="1" strokeLinecap="round"/>
        <line x1="92" y1="124" x2="122" y2="124" stroke="#ccc" strokeWidth="1" strokeLinecap="round"/>

        {/* Badge EduKazia */}
        <rect x="74" y="200" width="32" height="14" rx="7" fill="#5C4FE5"/>
        <text x="90" y="210" textAnchor="middle" fontSize="7" fontWeight="bold" fill="white">EduKazia</text>
      </g>
    </svg>
  )
}
