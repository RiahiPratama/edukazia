'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

const WA_SVG = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
)

const WA_SVG_LG = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="#1A1640">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
)

type Subject = {
  id: string; cls: string; flag: string; badge: string; name: string
  desc: string; tags: string[]; tagline: string; sub: string
  eyebrowTxt: string; eyebrowIcon: string; eyebrowBg: string
  eyebrowBorder: string; eyebrowColor: string
  blob1: string; blob2: string; blob3: string
}

const subjects: Subject[] = [
  {
    id:'english', cls:'e', flag:'🗣️', badge:'🌍 Bahasa', name:'Bahasa Inggris',
    desc:'Pronunciation, grammar, dan speaking bersama pengajar bersertifikat.',
    tags:['🗣️ Speaking','📝 Grammar','🎯 IELTS/TOEFL','👶 Kids'],
    tagline:'Bahasa Inggris', sub:'Belajar pronunciation, grammar, dan speaking bersama pengajar bersertifikat. Materi berbasis linguistik mendalam untuk pelajar Indonesia.',
    eyebrowTxt:'Kelas Live Bahasa Inggris — Mulai Hari Ini!', eyebrowIcon:'🗣️',
    eyebrowBg:'rgba(92,79,229,.1)', eyebrowBorder:'rgba(92,79,229,.3)', eyebrowColor:'var(--purple)',
    blob1:'rgba(92,79,229,.18)', blob2:'rgba(255,204,0,.1)', blob3:'rgba(92,79,229,.07)'
  },
  {
    id:'arabic', cls:'a', flag:'🌙', badge:'🕌 Bahasa', name:'Bahasa Arab',
    desc:'Membaca, menulis, percakapan dasar dan lanjutan untuk semua kalangan.',
    tags:['📖 Al-Quran','✍️ Khat','🗣️ Muhadatsah','🌙 Tajwid'],
    tagline:'Bahasa Arab', sub:'Belajar membaca Al-Quran dengan tajwid benar, menulis Arab, dan percakapan sehari-hari bersama pengajar bersertifikat.',
    eyebrowTxt:'Kelas Live Bahasa Arab — Tersedia Sekarang!', eyebrowIcon:'🌙',
    eyebrowBg:'rgba(22,163,74,.1)', eyebrowBorder:'rgba(22,163,74,.3)', eyebrowColor:'#16A34A',
    blob1:'rgba(22,163,74,.18)', blob2:'rgba(255,204,0,.1)', blob3:'rgba(22,163,74,.07)'
  },
  {
    id:'mandarin', cls:'m', flag:'🐼', badge:'🇨🇳 Bahasa', name:'Bahasa Mandarin',
    desc:'Pinyin, karakter, dan percakapan sehari-hari untuk semua level.',
    tags:['🔤 Pinyin','✍️ Karakter','🗣️ Percakapan','📚 HSK'],
    tagline:'Bahasa Mandarin', sub:'Kuasai Mandarin dari nol — pinyin, karakter, dan percakapan sehari-hari bersama pengajar berpengalaman.',
    eyebrowTxt:'Kelas Live Mandarin — Daftar Sekarang!', eyebrowIcon:'🐼',
    eyebrowBg:'rgba(220,38,38,.1)', eyebrowBorder:'rgba(220,38,38,.3)', eyebrowColor:'#DC2626',
    blob1:'rgba(220,38,38,.18)', blob2:'rgba(255,204,0,.1)', blob3:'rgba(220,38,38,.07)'
  },
  {
    id:'math', cls:'ma', flag:'🧮', badge:'📐 Eksakta', name:'Matematika',
    desc:'Metode Jepang & Singapura — membangun pemahaman konsep kuat dari dasar hingga olimpiade.',
    tags:['➕ Aritmatika','📊 Aljabar','📐 Geometri','🏆 Olimpiade'],
    tagline:'Matematika', sub:'Kuasai Matematika dari dasar hingga olimpiade — metode Singapura dan Jepang untuk pemahaman yang kuat.',
    eyebrowTxt:'Kelas Live Matematika — Bergabung Sekarang!', eyebrowIcon:'🧮',
    eyebrowBg:'rgba(200,160,0,.1)', eyebrowBorder:'rgba(200,160,0,.3)', eyebrowColor:'#C8A000',
    blob1:'rgba(200,160,0,.18)', blob2:'rgba(92,79,229,.1)', blob3:'rgba(200,160,0,.07)'
  }
]

const coursesBySubject: Record<string, {icon:string;level:string;cls:string;title:string;desc:string;tags:string[]}[]> = {
  english:[
    {icon:'🌱',level:'Pemula',cls:'e',title:'English for Beginners',desc:'Mulai dari nol — alfabet, kosakata dasar, dan percakapan sederhana.',tags:['Vocabulary','Pronunciation','Basic Grammar']},
    {icon:'🚀',level:'Menengah',cls:'e',title:'Intermediate Speaking',desc:'Bangun kepercayaan diri berbicara dalam situasi sehari-hari dan profesional.',tags:['Fluency','Idioms','Business English']},
    {icon:'🏆',level:'Lanjutan',cls:'e',title:'IELTS/TOEFL Preparation',desc:'Strategi dan latihan intensif untuk mencapai skor target kamu.',tags:['IELTS','TOEFL','Academic Writing']},
  ],
  arabic:[
    {icon:'📖',level:'Pemula',cls:'a',title:'Baca Al-Quran & Tajwid',desc:'Pelajari cara membaca Al-Quran dengan tajwid yang benar.',tags:['Tajwid','Makharijul Huruf','Tartil']},
    {icon:'✍️',level:'Menengah',cls:'a',title:'Khat & Imla',desc:'Menulis Arab yang indah dan benar sesuai kaidah.',tags:['Khat','Imla','Kaidah Penulisan']},
    {icon:'🗣️',level:'Percakapan',cls:'a',title:'Muhadatsah (Percakapan)',desc:'Percakapan Arab sehari-hari untuk berbagai situasi.',tags:['Percakapan','Kosakata','Ekspresi Sehari-hari']},
  ],
  mandarin:[
    {icon:'🔤',level:'Pemula',cls:'m',title:'Mandarin dari Nol',desc:'Pinyin, nada, dan kosakata dasar untuk pemula.',tags:['Pinyin','4 Nada','Kosakata Dasar']},
    {icon:'✍️',level:'Karakter',cls:'m',title:'Hanzi & Karakter',desc:'Menulis dan mengenali karakter Mandarin dengan benar.',tags:['Hanzi','Strokes','Radikal']},
    {icon:'📚',level:'Ujian',cls:'m',title:'Persiapan HSK',desc:'Persiapan ujian HSK 1 hingga HSK 4 secara terstruktur.',tags:['HSK 1-4','Reading','Listening']},
  ],
  math:[
    {icon:'🧮',level:'SD',cls:'ma',title:'Matematika SD',desc:'Aritmatika, pecahan, dan geometri dasar dengan metode Singapura.',tags:['Aritmatika','Pecahan','Geometri Dasar']},
    {icon:'📊',level:'SMP/SMA',cls:'ma',title:'Aljabar & Trigonometri',desc:'Persamaan, fungsi, dan trigonometri untuk pelajar SMP dan SMA.',tags:['Aljabar','Fungsi','Trigonometri']},
    {icon:'🏆',level:'Olimpiade',cls:'ma',title:'Persiapan Olimpiade',desc:'Latihan soal olimpiade tingkat kabupaten hingga nasional.',tags:['Logika','Kombinatorika','Number Theory']},
  ]
}

type Testimonial = {
  id: string; name: string; role_label: string | null
  course_tag: string | null; quote: string
}
type Faq = { id: string; question: string; answer: string }

interface Props {
  isLoggedIn: boolean
  portalUrl: string | null
  testimonials: Testimonial[]
  faqs: Faq[]
  waNumber: string
}

export default function LandingPage({ isLoggedIn, portalUrl, testimonials, faqs, waNumber }: Props) {
  const router = useRouter()
  const [theme, setTheme] = useState<'light'|'dark'>('light')
  const [currentIdx, setCurrentIdx] = useState(0)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openAccordions, setOpenAccordions] = useState<Record<string,boolean>>({})
  const [openFaq, setOpenFaq] = useState<number|null>(null)
  const [activeCourse, setActiveCourse] = useState('english')
  const [progWidths, setProgWidths] = useState<number[]>([0,0,0,0])
  const autoRef = useRef<NodeJS.Timeout|null>(null)
  const DURATION = 8000

  const waBase = `https://wa.me/${waNumber}?text=`

  // Theme persistence
  useEffect(() => {
    const saved = localStorage.getItem('edukazia-theme') as 'light'|'dark'|null
    if (saved) setTheme(saved)
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    localStorage.setItem('edukazia-theme', next)
  }

  // Carousel
  const goTo = useCallback((idx: number) => {
    setCurrentIdx(idx)
    setProgWidths(prev => {
      const next = [...prev]
      next[idx] = 0
      return next
    })
    setTimeout(() => {
      setProgWidths(prev => {
        const next = [...prev]
        next[idx] = 100
        return next
      })
    }, 50)
  }, [])

  const startAuto = useCallback(() => {
    if (autoRef.current) clearInterval(autoRef.current)
    autoRef.current = setInterval(() => {
      setCurrentIdx(prev => {
        const next = (prev + 1) % subjects.length
        goTo(next)
        return next
      })
    }, DURATION)
  }, [goTo])

  useEffect(() => {
    goTo(0)
    startAuto()
    return () => { if (autoRef.current) clearInterval(autoRef.current) }
  }, [goTo, startAuto])

  // Scroll reveal
  useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e, i) => {
        if (e.isIntersecting) setTimeout(() => e.target.classList.add('visible'), (i % 4) * 80)
      })
    }, { threshold: 0.07 })
    document.querySelectorAll('.reveal').forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [])

  const handleLoginClick = () => {
    if (isLoggedIn && portalUrl) router.push(portalUrl)
    else router.push('/login')
  }

  const toggleAcc = (key: string) => {
    setOpenAccordions(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const s = subjects[currentIdx]
  const courses = coursesBySubject[activeCourse] || []

  const courseTagClass: Record<string,string> = {
    'Bahasa Inggris':'ts-e','Bahasa Arab':'ts-a','Bahasa Mandarin':'ts-m','Matematika':'ts-ma'
  }

  return (
    <div className="landing-root" data-theme={theme}>

      {/* NAVBAR */}
      <div className="nav-wrap">
        <nav>
          <a href="#" className="nav-logo">
            <span className="nav-logo-text"><span className="p">edu</span><span className="y">kazia</span></span>
          </a>
          <div className="nav-sep" />

          <div className="nav-dd">
            <button className="nav-link">Kursus <span className="arr">▾</span></button>
            <div className="dd-menu">
              <div className="dd-section-label">Bahasa</div>
              {['english','arabic','mandarin'].map(id => (
                <a key={id} className="dd-item" href="#courses" onClick={() => setActiveCourse(id)}>
                  <span className={`dot dot-${id === 'english' ? 'e' : id === 'arabic' ? 'a' : 'm'}`}/>
                  {id === 'english' ? 'Bahasa Inggris' : id === 'arabic' ? 'Bahasa Arab' : 'Mandarin'}
                </a>
              ))}
              <div className="dd-divider"/>
              <div className="dd-section-label">Eksakta</div>
              <a className="dd-item" href="#courses" onClick={() => setActiveCourse('math')}>
                <span className="dot dot-ma"/> Matematika
              </a>
            </div>
          </div>

          <div className="nav-dd">
            <button className="nav-link">Kursus untuk Anak <span className="arr">▾</span></button>
            <div className="dd-menu">
              <div className="dd-section-label">Usia 7–15 Tahun</div>
              <a className="dd-item" href="#courses" onClick={() => setActiveCourse('english')}>🎨 English for Kids</a>
              <a className="dd-item" href="#courses" onClick={() => setActiveCourse('arabic')}>🌙 Bahasa Arab untuk Anak</a>
              <a className="dd-item" href="#courses" onClick={() => setActiveCourse('mandarin')}>🐼 Mandarin untuk Anak</a>
              <div className="dd-divider"/>
              <a className="dd-item" href="#courses" onClick={() => setActiveCourse('math')}>🧮 Matematika SD</a>
            </div>
          </div>

          <div className="nav-dd">
            <button className="nav-link">Kursus Privat <span className="arr">▾</span></button>
            <div className="dd-menu">
              <div className="dd-section-label">Pilih Kategori</div>
              <a className="dd-item" href="#kelas">👧 Privat untuk Anak</a>
              <a className="dd-item" href="#kelas">🧑‍🎓 Privat untuk Remaja</a>
              <a className="dd-item" href="#kelas">👨‍💼 Privat untuk Dewasa</a>
            </div>
          </div>

          <div className="nav-spacer"/>
          <div className="nav-right">
            <button className="btn-theme" onClick={toggleTheme} aria-label="Ganti tema">
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <div className="nav-sep nav-sep-desktop"/>
            <a href={`${waBase}Halo+EduKazia%2C+saya+ingin+gabung+sekarang`} target="_blank" rel="noopener noreferrer" className="btn-wa">
              {WA_SVG}<span className="wa-label">Gabung Sekarang</span>
            </a>
            <button className="btn-ghost" onClick={handleLoginClick}>
              {isLoggedIn ? 'Buka Portal' : 'Masuk'}
            </button>
            <button className={`hamburger${mobileOpen ? ' open' : ''}`} onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu">
              <span/><span/><span/>
            </button>
          </div>
        </nav>
      </div>

      {/* MOBILE NAV */}
      <div className={`mobile-nav${mobileOpen ? ' open' : ''}`}>
        {[
          {key:'kursus', label:'📚 Kursus', items:[
            {label:'Bahasa Inggris', href:'#courses', tab:'english', dot:'dot-e'},
            {label:'Bahasa Arab', href:'#courses', tab:'arabic', dot:'dot-a'},
            {label:'Mandarin', href:'#courses', tab:'mandarin', dot:'dot-m'},
            {label:'Matematika', href:'#courses', tab:'math', dot:'dot-ma'},
          ]},
          {key:'anak', label:'👶 Kursus untuk Anak', items:[
            {label:'🎨 English for Kids', href:'#courses', tab:'english', dot:''},
            {label:'🌙 Bahasa Arab untuk Anak', href:'#courses', tab:'arabic', dot:''},
            {label:'🐼 Mandarin untuk Anak', href:'#courses', tab:'mandarin', dot:''},
            {label:'🧮 Matematika SD', href:'#courses', tab:'math', dot:''},
          ]},
          {key:'privat', label:'🧑‍💻 Kursus Privat', items:[
            {label:'👧 Privat untuk Anak', href:'#kelas', tab:'', dot:''},
            {label:'🧑‍🎓 Privat untuk Remaja', href:'#kelas', tab:'', dot:''},
            {label:'👨‍💼 Privat untuk Dewasa', href:'#kelas', tab:'', dot:''},
          ]},
        ].map(section => (
          <div key={section.key} className="mob-section">
            <button className={`mob-acc-header${openAccordions[section.key] ? ' open' : ''}`} onClick={() => toggleAcc(section.key)}>
              {section.label} <span className="acc-arr">▾</span>
            </button>
            <div className={`mob-acc-body${openAccordions[section.key] ? ' open' : ''}`}>
              {section.items.map(item => (
                <a key={item.label} className="mob-link" href={item.href} onClick={() => { if (item.tab) setActiveCourse(item.tab); setMobileOpen(false) }}>
                  {item.dot && <span className={`dot ${item.dot}`}/>} {item.label}
                </a>
              ))}
            </div>
          </div>
        ))}
        <div className="mob-actions">
          <a href={`${waBase}Halo+EduKazia%2C+saya+ingin+gabung`} target="_blank" rel="noopener noreferrer" className="mob-btn-join" onClick={() => setMobileOpen(false)}>
            {WA_SVG} Gabung Sekarang
          </a>
          <button className="mob-btn-ghost" onClick={() => { setMobileOpen(false); handleLoginClick() }}>
            {isLoggedIn ? 'Buka Portal' : 'Masuk'}
          </button>
        </div>
      </div>

      {/* HERO */}
      <section id="hero">
        <div className="blob blob1" style={{ background: s.blob1 }}/>
        <div className="blob blob2" style={{ background: s.blob2 }}/>
        <div className="blob blob3" style={{ background: s.blob3 }}/>
        <div className="hero-inner">
          <div className="hero-left">
            <div className="hero-eyebrow" style={{ background: s.eyebrowBg, borderColor: s.eyebrowBorder, color: s.eyebrowColor }}>
              <span>{s.eyebrowIcon}</span>
              <span>{s.eyebrowTxt}</span>
            </div>
            <h1 className="hero-title">
              Kuasai{' '}
              <span className="subject-slot">
                {subjects.map((sub, i) => (
                  <span key={sub.id} className={`sw ${sub.cls}${i === currentIdx ? ' active' : ''}`}>
                    <span className="udeco">{sub.tagline}</span>
                  </span>
                ))}
              </span>
              <span className="hero-line2">dengan Cara yang Benar & Lebih Cepat</span>
            </h1>
            <p className="hero-sub">{s.sub}</p>
            <div className="hero-actions">
              <a href={`${waBase}Halo+EduKazia%2C+saya+ingin+daftar`} target="_blank" rel="noopener noreferrer" className="btn-hero btn-hero-yellow">
                🚀 Mulai Belajar Gratis
              </a>
              <a href="#courses" className="btn-hero btn-hero-outline">📚 Lihat Semua Kursus</a>
            </div>
            <div className="hero-trust">
              <div className="trust-avs">
                {[{bg:'#5C4FE5',t:'RA'},{bg:'#16A34A',t:'SP'},{bg:'#DC2626',t:'DH'},{bg:'#C8A000',t:'AF'},{bg:'#1A1640',t:'MK'}].map(av => (
                  <div key={av.t} className="tav" style={{ background: av.bg }}>{av.t}</div>
                ))}
              </div>
              <div className="trust-txt">Bergabung dengan <strong>pelajar aktif</strong> di seluruh Indonesia</div>
            </div>
          </div>

          <div className="hero-right">
            <div className="sc-wrap">
              {subjects.map((sub, i) => (
                <div key={sub.id} className={`sc sc-${sub.id}${i === currentIdx ? ' active' : ''}`}>
                  <div className="sc-flag">{sub.flag}</div>
                  <div className="sc-badge">{sub.badge}</div>
                  <div className="sc-name">{sub.name}</div>
                  <div className="sc-desc">{sub.desc}</div>
                  <div className="sc-progress-bar">
                    <div className="sc-progress-fill" style={{ width: `${progWidths[i]}%`, transition: i === currentIdx ? `width ${DURATION}ms linear` : 'none' }}/>
                  </div>
                  <div className="sc-tags">{sub.tags.map(t => <span key={t} className="sc-tag">{t}</span>)}</div>
                  <a href={`${waBase}Halo%2C+saya+ingin+daftar+kursus+${encodeURIComponent(sub.name)}`} target="_blank" rel="noopener noreferrer" className="sc-btn-wa">
                    {WA_SVG} Daftar Sekarang
                  </a>
                </div>
              ))}
              <div className="sc-indicators">
                {subjects.map((sub, i) => (
                  <div key={sub.id} className={`ind${i === currentIdx ? ` active ${sub.cls}` : ''}`} onClick={() => { goTo(i); startAuto() }}/>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <div className="stats-wrap">
        <div className="stats-strip">
          <div className="stats-inner">
            {[
              {num:'4',lbl:'Kursus Unggulan'},
              {num:'100%',lbl:'Sesi via Zoom Live'},
              {num:'3',lbl:'Pilihan Tipe Kelas'},
              {num:'8',lbl:'Sesi per Paket'},
            ].map(s => (
              <div key={s.lbl} className="stat-item reveal">
                <span className="stat-num">{s.num}</span>
                <span className="stat-lbl">{s.lbl}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* COURSES */}
      <section id="courses">
        <div className="s-head reveal">
          <div className="s-eyebrow">📚 Semua Kursus</div>
          <h2 className="s-title">Pilih Mata Pelajaranmu</h2>
          <p className="s-sub">Materi terstruktur dari level pemula hingga mahir, diajarkan oleh pengajar terbaik.</p>
        </div>
        <div className="stabs reveal">
          {subjects.map(sub => (
            <button key={sub.id} className={`stab${activeCourse === sub.id ? ` active ${sub.cls}` : ''}`} onClick={() => setActiveCourse(sub.id)}>
              {sub.id === 'english' ? '🇬🇧' : sub.id === 'arabic' ? '🇸🇦' : sub.id === 'mandarin' ? '🇨🇳' : '🧮'} {sub.name}
            </button>
          ))}
        </div>
        <div className="courses-grid reveal">
          {courses.map(c => (
            <div key={c.title} className="course-card">
              <div className="cc-icon">{c.icon}</div>
              <div className={`cc-level ${c.cls}`}>{c.level}</div>
              <div className="cc-title">{c.title}</div>
              <div className="cc-desc">{c.desc}</div>
              <div className="cc-tags">{c.tags.map(t => <span key={t} className="cc-tag">{t}</span>)}</div>
              <a href={`${waBase}Halo%2C+saya+ingin+tahu+tentang+${encodeURIComponent(c.title)}`} target="_blank" rel="noopener noreferrer" className="cc-cta">
                Tanya & Daftar →
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* KELAS */}
      <section id="kelas">
        <div className="s-head-center reveal">
          <div className="s-eyebrow">🎓 Jenis Kelas</div>
          <h2 className="s-title">Pilih Format Belajar yang Tepat</h2>
          <p className="s-sub" style={{margin:'0 auto'}}>Tiga jenis kelas sesuai kebutuhan. Hubungi admin untuk informasi harga tiap program.</p>
        </div>
        <div className="kelas-grid">
          <div className="kelas-card reveal">
            <div className="kelas-icon">👥</div>
            <div className="kelas-name">Kelas Reguler</div>
            <div className="kelas-capacity">👤 Maks. 8 Orang</div>
            <div className="kelas-desc">Belajar bersama dalam suasana yang interaktif dan kolaboratif. Cocok untuk yang suka dinamika diskusi kelas.</div>
            <ul className="kelas-features">
              {['Paket 8 sesi per periode','Maks. 8 peserta per kelas','Link Zoom eksklusif tiap sesi','Laporan perkembangan rutin','Reschedule fleksibel'].map(f => <li key={f}>{f}</li>)}
            </ul>
            <a href={`${waBase}Halo%2C+saya+ingin+tahu+info+Kelas+Reguler+EduKazia`} target="_blank" rel="noopener noreferrer" className="btn-kelas-wa btn-kelas-outline">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--wa-green)"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Tanya via WhatsApp
            </a>
          </div>

          <div className="kelas-card featured reveal">
            <div className="kelas-badge">🔥 Paling Populer</div>
            <div className="kelas-icon" style={{marginTop:'14px'}}>👫</div>
            <div className="kelas-name">Semi Privat</div>
            <div className="kelas-capacity">👤 Maks. 4 Orang</div>
            <div className="kelas-desc">Perhatian lebih dari pengajar dengan suasana kelas yang intim. Keseimbangan terbaik antara harga dan kualitas.</div>
            <ul className="kelas-features">
              {['Paket 8 sesi per periode','Maks. 4 peserta per kelas','Perhatian lebih dari tutor','Foto bukti belajar tiap sesi','Reschedule fleksibel'].map(f => <li key={f}>{f}</li>)}
            </ul>
            <a href={`${waBase}Halo%2C+saya+ingin+tahu+info+Kelas+Semi+Privat+EduKazia`} target="_blank" rel="noopener noreferrer" className="btn-kelas-wa btn-kelas-solid">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#1A1640"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Tanya via WhatsApp
            </a>
          </div>

          <div className="kelas-card privat reveal">
            <div className="kelas-icon">🧑‍💻</div>
            <div className="kelas-name">Privat 1-on-1</div>
            <div className="kelas-capacity">👤 1 Orang</div>
            <div className="kelas-desc">Perhatian penuh dari pengajar, jadwal fleksibel, dan materi disesuaikan 100% dengan kebutuhanmu.</div>
            <ul className="kelas-features">
              {['Paket 8 sesi per periode','Sesi 1-on-1 eksklusif','Jadwal & materi disesuaikan','Perhatian penuh dari tutor','Foto bukti belajar tiap sesi'].map(f => <li key={f}>{f}</li>)}
            </ul>
            <a href={`${waBase}Halo%2C+saya+ingin+tahu+info+Kelas+Privat+EduKazia`} target="_blank" rel="noopener noreferrer" className="btn-kelas-wa" style={{background:'#1A1640',color:'#FFCC00',boxShadow:'0 5px 20px rgba(26,22,64,.3)'}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Tanya via WhatsApp
            </a>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features">
        <div className="s-head-center reveal">
          <div className="s-eyebrow">💡 Keunggulan</div>
          <h2 className="s-title">Kenapa Beda dari yang Lain?</h2>
          <p className="s-sub" style={{margin:'0 auto'}}>Kami menggabungkan pedagogi terbaik dengan pendekatan yang didesain khusus untuk pelajar Indonesia.</p>
        </div>
        <div className="feat-grid">
          {[
            {icon:'📊',cls:'fi-p',title:'Laporan Perkembangan Tiap Sesi',desc:'Setelah setiap sesi, tutor mengisi catatan materi dan mengunggah foto aktivitas belajar — orang tua bisa pantau langsung dari portal.'},
            {icon:'👨‍🏫',cls:'fi-g',title:'Tutor Berpengalaman & Terseleksi',desc:'Semua tutor EduKazia diseleksi ketat dan mendapat materi terstandarisasi, memastikan kualitas pengajaran yang konsisten.'},
            {icon:'🔄',cls:'fi-r',title:'Reschedule Fleksibel',desc:'Sesi dapat dijadwalkan ulang atas kesepakatan bersama tanpa biaya tambahan — hidup yang sibuk bukan halangan belajar.'},
            {icon:'💻',cls:'fi-y',title:'100% Online via Zoom',desc:'Belajar dari rumah dengan kualitas terjaga — link Zoom dikirim otomatis setiap sesi, tanpa perlu keluar rumah.'},
          ].map(f => (
            <div key={f.title} className="feat-card reveal">
              <div className={`feat-icon ${f.cls}`}>{f.icon}</div>
              <div className="feat-title">{f.title}</div>
              <div className="feat-desc">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section id="testi">
        <div className="s-head-center reveal">
          <div className="s-eyebrow">💬 Cerita Pelajar</div>
          <h2 className="s-title">Hasil Nyata dari Pelajar Kami</h2>
          <p className="s-sub" style={{margin:'0 auto'}}>Pelajar telah membuktikan perubahan yang terasa dari program EduKazia.</p>
        </div>
        <div className="testi-grid" style={{maxWidth:'1200px',margin:'0 auto'}}>
          {(testimonials.length > 0 ? testimonials : [
            {id:'1',name:'Rizky Aditya',role_label:'Marketing Manager · Jakarta',course_tag:'Bahasa Inggris',quote:'Setelah 3 bulan di EduKazia, saya bisa presentasi di depan klien asing tanpa gugup. Materi pronunciation-nya luar biasa mendalam!'},
            {id:'2',name:'Nur Fatimah',role_label:'Ibu Rumah Tangga · Surabaya',course_tag:'Bahasa Arab',quote:'Mimpi saya bisa baca Al-Quran dengan tajwid benar akhirnya kesampaian. Pengajar EduKazia sabar sekali dan metodenya sangat sistematis.'},
            {id:'3',name:'Dewi Wulandari',role_label:'Orang Tua Murid · Bandung',course_tag:'Matematika',quote:'Anak saya yang tadinya takut matematika sekarang malah minta tambah soal! Metode Singapura benar-benar membangun pemahaman dari akar.'},
          ]).map(t => (
            <div key={t.id} className="testi-card reveal">
              <div className="testi-top">
                <div className={`testi-stag ${courseTagClass[t.course_tag || ''] || 'ts-e'}`}>{t.course_tag}</div>
                <div className="testi-stars">⭐⭐⭐⭐⭐</div>
              </div>
              <p className="testi-txt">&quot;{t.quote}&quot;</p>
              <div className="testi-auth">
                <div className="testi-av" style={{background:'var(--purple)'}}>{t.name.split(' ').map(w=>w[0]).join('').slice(0,2)}</div>
                <div>
                  <div className="testi-name">{t.name}</div>
                  <div className="testi-role">{t.role_label}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* TENTANG */}
      <section id="tentang" style={{background:'var(--bg3)'}}>
        <div className="s-head-center reveal">
          <div className="s-eyebrow">🏫 Tentang Kami</div>
          <h2 className="s-title">Kenapa EduKazia?</h2>
          <p className="s-sub" style={{margin:'0 auto'}}>Kami percaya belajar yang baik dimulai dari hubungan yang baik antara pengajar, siswa, dan orang tua.</p>
        </div>
        <div style={{maxWidth:'900px',margin:'0 auto',display:'grid',gridTemplateColumns:'1fr 1fr',gap:'28px'}}>
          {[
            {icon:'🎯',cls:'fi-p',title:'Fokus & Terukur',desc:'Setiap paket terdiri dari 8 sesi yang terstruktur. Tidak ada kelas yang lewat tanpa dokumentasi — setiap sesi tercatat dan dilaporkan.'},
            {icon:'👨‍👩‍👧',cls:'fi-g',title:'Orang Tua Ikut Terlibat',desc:'Orang tua mendapat akses ke portal khusus — bisa lihat sisa kuota sesi, jadwal mendatang, dan foto aktivitas belajar anak setelah setiap pertemuan.'},
            {icon:'📍',cls:'fi-r',title:'Berbasis di Indonesia',desc:'EduKazia dirancang untuk pelajar Indonesia — dengan pendekatan yang memahami konteks budaya, kurikulum nasional, dan kebutuhan lokal.'},
            {icon:'✅',cls:'fi-y',title:'Transparan & Akuntabel',desc:'Tidak ada biaya tersembunyi. Jadwal jelas, kuota sesi tercatat, dan reschedule diproses secara transparan — semua bisa dipantau dari portal.'},
          ].map(f => (
            <div key={f.title} className="feat-card reveal" style={{textAlign:'left'}}>
              <div className={`feat-icon ${f.cls}`}>{f.icon}</div>
              <div className="feat-title">{f.title}</div>
              <div className="feat-desc">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq">
        <div className="s-head-center reveal">
          <div className="s-eyebrow">❓ FAQ</div>
          <h2 className="s-title">Pertanyaan yang Sering Ditanyakan</h2>
          <p className="s-sub" style={{margin:'0 auto'}}>Tidak menemukan jawaban? Langsung tanya via WhatsApp, kami siap membantu!</p>
        </div>
        <div className="faq-wrap">
          {(faqs.length > 0 ? faqs : [
            {id:'1',question:'Apakah ada kelas percobaan gratis sebelum daftar?',answer:'Ya! Kami menyediakan sesi percobaan gratis (trial class) untuk semua program. Hubungi admin kami via WhatsApp untuk jadwal trial class.'},
            {id:'2',question:'Bagaimana model paket belajar EduKazia?',answer:'Setiap paket terdiri dari 8 sesi per periode. Sesi dilaksanakan via Zoom Meeting sesuai jadwal yang disepakati.'},
            {id:'3',question:'Apakah sesi bisa dijadwalkan ulang (reschedule)?',answer:'Ya, sesi dapat dijadwalkan ulang atas kesepakatan bersama antara siswa dan tutor, disetujui admin.'},
            {id:'4',question:'Apa perbedaan Kelas Reguler, Semi Privat, dan Privat?',answer:'Reguler maks. 8 siswa, Semi Privat maks. 4 siswa, Privat 1-on-1. Semakin kecil kelasnya, semakin personal perhatian dari tutor.'},
            {id:'5',question:'Apakah ada program untuk anak-anak?',answer:'Tentu! Kami memiliki program untuk pelajar usia 7 tahun hingga dewasa dengan metode yang disesuaikan.'},
            {id:'6',question:'Bagaimana cara mendaftar?',answer:'Cukup klik tombol "Daftar Sekarang" atau hubungi admin via WhatsApp. Tim kami akan menghubungimu dalam 1x24 jam.'},
          ]).map((faq, i) => (
            <div key={faq.id} className={`faq-item reveal${openFaq === i ? ' open' : ''}`}>
              <div className="faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                <span className="faq-q-text">{faq.question}</span>
                <div className="faq-arrow">▾</div>
              </div>
              <div className="faq-body" style={{maxHeight: openFaq === i ? '300px' : '0'}}>
                <div className="faq-body-inner">{faq.answer}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section id="cta">
        <div className="cta-wrap reveal">
          <div className="s-eyebrow" style={{display:'inline-flex',margin:'0 auto 18px',borderColor:'rgba(255,255,255,.2)',color:'rgba(255,255,255,.8)',background:'rgba(255,255,255,.08)'}}>🚀 Mulai Sekarang</div>
          <h2 className="cta-title">Siap Mulai Perjalanan Belajarmu?</h2>
          <p className="cta-sub">Mulai perjalanan belajarmu bersama EduKazia. Sesi pertama dapat dijadwalkan setelah konsultasi singkat via WhatsApp — gratis, tanpa komitmen.</p>
          <div className="cta-btns">
            <a href={`${waBase}Halo+EduKazia%2C+saya+ingin+konsultasi+dan+daftar+kursus`} target="_blank" rel="noopener noreferrer" className="btn-cta-y">
              {WA_SVG_LG} Daftar via WhatsApp — Gratis!
            </a>
            <a href="#faq" className="btn-cta-w">❓ Lihat Pertanyaan Umum</a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <div className="footer-grid">
          <div className="fb">
            <p style={{fontFamily:"'Sora',sans-serif",fontWeight:800,fontSize:'1.4rem'}}>
              <span style={{color:'var(--purple)'}}>edu</span><span style={{color:'var(--yellow-dark)'}}>kazia</span>
            </p>
            <p>Platform belajar Bahasa Inggris, Arab, Mandarin & Matematika berbasis pedagogi mendalam untuk pelajar Indonesia.</p>
            <div className="fb-soc">
              <a href="#" className="soc-a">📸</a>
              <a href="#" className="soc-a">▶️</a>
              <a href="#" className="soc-a">💼</a>
              <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noopener noreferrer" className="soc-a">💬</a>
            </div>
          </div>
          <div>
            <div className="fc-h">Kursus</div>
            <ul className="fc-list">
              {[{flag:'🇬🇧',name:'Bahasa Inggris',id:'english'},{flag:'🇸🇦',name:'Bahasa Arab',id:'arabic'},{flag:'🇨🇳',name:'Mandarin',id:'mandarin'},{flag:'🧮',name:'Matematika',id:'math'}].map(c => (
                <li key={c.id}><a href="#courses" onClick={() => setActiveCourse(c.id)}>{c.flag} {c.name}</a></li>
              ))}
            </ul>
          </div>
          <div>
            <div className="fc-h">Kelas</div>
            <ul className="fc-list">
              <li><a href="#kelas">👥 Kelas Reguler</a></li>
              <li><a href="#kelas">👫 Semi Privat</a></li>
              <li><a href="#kelas">🧑‍💻 Privat 1-on-1</a></li>
              <li><a href="#faq">❓ FAQ</a></li>
            </ul>
          </div>
          <div>
            <div className="fc-h">Kontak</div>
            <ul className="fc-list">
              <li><a href={`https://wa.me/${waNumber}`} target="_blank" rel="noopener noreferrer">💬 WhatsApp Admin</a></li>
              <li><a href="#">📧 Email Kami</a></li>
              <li><a href="#">📝 Blog</a></li>
              <li><a href="#">🔒 Kebijakan Privasi</a></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 EduKazia. Hak cipta dilindungi.</span>
          <span>Dibuat dengan ❤️ untuk pelajar Indonesia · <a href="#">Privasi</a> · <a href="#">Syarat</a></span>
        </div>
      </footer>

    </div>
  )
}
