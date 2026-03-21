'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, CalendarDays, FileText, BookOpen,
  CreditCard, Settings, LogOut, ChevronRight,
  Users, GraduationCap, Menu, X, ArrowLeftRight, ArrowLeft,
  Sun, Moon,
} from 'lucide-react'
import { OrtuProvider, type OrtuContextType, type ChildInfo, type OrtuProfile } from './context'

const NAV_ORTU = [
  { href: '/ortu/dashboard',  label: 'Beranda',    icon: LayoutDashboard },
  { href: '/ortu/jadwal',     label: 'Jadwal',     icon: CalendarDays },
  { href: '/ortu/laporan',    label: 'Laporan',    icon: FileText },
  { href: '/ortu/tagihan',    label: 'Tagihan',    icon: CreditCard },
  { href: '/ortu/pengaturan', label: 'Pengaturan', icon: Settings },
]

function navSiswa(studentId: string) {
  return [
    { href: `/ortu/anak/${studentId}`,         label: 'Dashboard', icon: LayoutDashboard },
    { href: `/ortu/anak/${studentId}/jadwal`,  label: 'Jadwal',    icon: CalendarDays },
    { href: `/ortu/anak/${studentId}/laporan`, label: 'Laporan',   icon: FileText },
    { href: `/ortu/anak/${studentId}/materi`,  label: 'Materi',    icon: BookOpen },
  ]
}

const CHILD_COLORS = [
  { bg: '#FAEEDA', text: '#412402', border: '#FAC775' },
  { bg: '#E1F5EE', text: '#085041', border: '#9FE1CB' },
  { bg: '#EEEDFE', text: '#3C3489', border: '#CECBF6' },
  { bg: '#FAECE7', text: '#4A1B0C', border: '#F5C4B3' },
  { bg: '#EAF3DE', text: '#173404', border: '#C0DD97' },
]

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
}

export default function OrtuLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  const [ctxData,     setCtxData]     = useState<OrtuContextType | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [signingOut,  setSigningOut]  = useState(false)
  const [isDark,      setIsDark]      = useState(false)

  // Load dark mode preference
  useEffect(() => {
    const saved = localStorage.getItem('ortu-theme')
    if (saved === 'dark') setIsDark(true)
  }, [])

  function toggleDark() {
    setIsDark(prev => {
      const next = !prev
      localStorage.setItem('ortu-theme', next ? 'dark' : 'light')
      return next
    })
  }

  // Deteksi mode anak dari pathname
  const anakMatch       = pathname.match(/^\/ortu\/anak\/([^/]+)/)
  const activeStudentId = anakMatch ? anakMatch[1] : null
  const isAnakMode      = !!activeStudentId

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }
      const userId = session.user.id

      const { data: profile } = await supabase
        .from('profiles').select('id, full_name, email, phone, role')
        .eq('id', userId).single()
      if (!profile) { router.replace('/login'); return }

      const [{ data: asParent }, { data: asSelf }] = await Promise.all([
        supabase.from('students')
          .select(`id, profile_id, relation_role, grade, school,
            profiles!students_profile_id_fkey(full_name)`)
          .eq('parent_profile_id', userId),
        supabase.from('students').select('id')
          .eq('profile_id', userId).maybeSingle(),
      ])

      if (!asParent || asParent.length === 0) {
        router.replace(asSelf ? '/siswa/dashboard' : '/login')
        return
      }

      const childList: ChildInfo[] = (asParent as any[]).map(row => ({
        id:            row.id,
        profile_id:    row.profile_id,
        full_name:     (Array.isArray(row.profiles) ? row.profiles[0] : row.profiles)?.full_name ?? '(Tanpa nama)',
        grade:         row.grade,
        school:        row.school,
        relation_role: row.relation_role,
      }))

      setCtxData({
        profile:       profile as OrtuProfile,
        children:      childList,
        isAlsoStudent: !!asSelf,
      })
      setLoading(false)
    }
    load()
  }, [router, supabase])

  async function handleSignOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
    router.replace('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FEFCF7]"
        style={{ fontFamily: "'Sora', sans-serif" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-4 border-[#E6B800] border-t-transparent animate-spin" />
          <p className="text-sm text-amber-700 font-medium">Memuat portal orang tua…</p>
        </div>
      </div>
    )
  }
  if (!ctxData) return null

  const { profile, children: kids, isAlsoStudent } = ctxData
  const activeChild    = activeStudentId ? kids.find(k => k.id === activeStudentId) : null
  const activeChildIdx = activeChild ? kids.indexOf(activeChild) : 0
  const currentNav     = isAnakMode && activeStudentId ? navSiswa(activeStudentId) : NAV_ORTU

  // Tema berdasarkan mode anak + dark mode
  const D = isDark ? {
    bg:           '#0F0F14',
    sbBg:         '#1A1A24',
    sbBorder:     '#2A2A38',
    divider:      '#2A2A38',
    badgeBg:      '#2A2A38',
    badgeBorder:  '#3A3A50',
    badgeText:    '#C4B89A',
    navActive:    '#2A2A38',
    navActiveBord:'#3A3A50',
    navActiveText:'#F5E6C8',
    navHover:     '#1E1E2A',
    navNorm:      '#7A7890',
    secLabel:     '#5A5870',
    tbBg:         'rgba(15,15,20,0.95)',
    tbBorder:     '#2A2A38',
    topbarAccBg:  '#1E1E2A',
    topbarAccBord:'#2A2A38',
    topbarAccText:'#C4B89A',
    nameColor:    '#F5E6C8',
    metaColor:    '#7A7890',
    contentBg:    '#0F0F14',
    cardBg:       '#1A1A24',
    cardBorder:   '#2A2A38',
  } : {
    bg:           '#FEFCF7',
    sbBg:         'white',
    sbBorder:     '#fef3c7',
    divider:      '#fef3c7',
    badgeBg:      '#FAEEDA',
    badgeBorder:  '#FAC775',
    badgeText:    '#854F0B',
    navActive:    '#FAEEDA',
    navActiveBord:'#FAC775',
    navActiveText:'#633806',
    navHover:     '#fafaf8',
    navNorm:      '#78716c',
    secLabel:     '#a8a29e',
    tbBg:         'rgba(255,255,255,0.95)',
    tbBorder:     '#fef3c7',
    topbarAccBg:  '#fef9ee',
    topbarAccBord:'#FAC775',
    topbarAccText:'#854F0B',
    nameColor:    '#1c1917',
    metaColor:    '#a8a29e',
    contentBg:    '#FEFCF7',
    cardBg:       'white',
    cardBorder:   '#fef3c7',
  }

  const T = isAnakMode ? {
    bg:           isDark ? '#0D0D18' : '#F7F6FF',
    sbBg:         '#5C4FE5',
    sbBorder:     '#4338CA',
    divider:      'rgba(255,255,255,0.12)',
    badgeBg:      'rgba(255,255,255,0.12)',
    badgeBorder:  'rgba(255,255,255,0.2)',
    badgeText:    'rgba(255,255,255,0.8)',
    badgeDot:     'rgba(255,255,255,0.5)',
    navActive:    'rgba(255,255,255,0.18)',
    navActiveBord:'rgba(255,255,255,0.25)',
    navActiveText:'#fff',
    navHover:     'rgba(255,255,255,0.08)',
    navNorm:      'rgba(255,255,255,0.65)',
    secLabel:     'rgba(255,255,255,0.4)',
    tbBg:         'rgba(247,246,255,0.95)',
    tbBorder:     '#E5E3FF',
    topbarAccBg:  '#EEEDFE',
    topbarAccBord:'#CECBF6',
    topbarAccText:'#3C3489',
    nameColor:    '#fff',
    metaColor:    'rgba(255,255,255,0.5)',
  } : {
    bg:           D.bg,
    sbBg:         D.sbBg,
    sbBorder:     D.sbBorder,
    divider:      D.divider,
    badgeBg:      D.badgeBg,
    badgeBorder:  D.badgeBorder,
    badgeText:    D.badgeText,
    badgeDot:     isDark ? '#E6B800' : '#E6B800',
    navActive:    D.navActive,
    navActiveBord:D.navActiveBord,
    navActiveText:D.navActiveText,
    navHover:     D.navHover,
    navNorm:      D.navNorm,
    secLabel:     D.secLabel,
    tbBg:         D.tbBg,
    tbBorder:     D.tbBorder,
    topbarAccBg:  D.topbarAccBg,
    topbarAccBord:D.topbarAccBord,
    topbarAccText:D.topbarAccText,
    nameColor:    D.nameColor,
    metaColor:    D.metaColor,
  }

  return (
    <OrtuProvider value={ctxData}>
      <div className="min-h-screen flex" style={{ background: T.bg, fontFamily: "'Plus Jakarta Sans', sans-serif", colorScheme: isDark ? 'dark' : 'light' }}>

        {sidebarOpen && (
          <div className="fixed inset-0 z-20 bg-black/40 lg:hidden backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)} />
        )}

        {/* ═══ SIDEBAR ═══ */}
        <aside
          className={`fixed top-0 left-0 h-full z-30 w-[232px] flex flex-col
            transition-transform duration-300 ease-in-out
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            lg:translate-x-0 lg:static`}
          style={{ background: T.sbBg, borderRight: `1px solid ${T.sbBorder}` }}>

          {/* Branding */}
          <div className="px-5 pt-5 pb-4" style={{ borderBottom: `1px solid ${T.divider}` }}>
            <div className="flex items-center justify-between mb-2.5">
              <Link href={isAnakMode ? `/ortu/anak/${activeStudentId}` : '/ortu/dashboard'}
                className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
                  style={{ background: isAnakMode ? 'rgba(255,255,255,0.15)' : '#E6B800', color: isAnakMode ? '#fff' : '#412402' }}>
                  E
                </div>
                <span className="text-sm font-bold" style={{ color: T.nameColor, fontFamily: "'Sora', sans-serif" }}>
                  EduKazia
                </span>
              </Link>
              <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 rounded-md"
                style={{ color: T.metaColor }}>
                <X size={16} />
              </button>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full"
              style={{ background: T.badgeBg, border: `0.5px solid ${T.badgeBorder}` }}>
              {isAnakMode
                ? <GraduationCap size={10} style={{ color: T.badgeText }} />
                : <Users size={10} style={{ color: T.badgeText }} />
              }
              <span className="text-[10px] font-semibold tracking-wide uppercase" style={{ color: T.badgeText }}>
                {isAnakMode ? 'Portal Siswa' : 'Portal Orang Tua'}
              </span>
            </span>
          </div>

          {/* Mode anak: info siswa + switcher */}
          {isAnakMode && activeChild && (
            <div className="px-4 py-3" style={{ borderBottom: `1px solid ${T.divider}` }}>
              <p className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: T.secLabel }}>
                Melihat sebagai
              </p>
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}>
                  {initials(activeChild.full_name)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: '#fff' }}>
                    {activeChild.full_name}
                  </p>
                  {activeChild.grade && (
                    <p className="text-[9px] truncate mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      {activeChild.grade}{activeChild.school ? ` · ${activeChild.school}` : ''}
                    </p>
                  )}
                </div>
              </div>
              {/* Ganti ke anak lain */}
              {kids.filter(k => k.id !== activeStudentId).map(k => {
                const col = CHILD_COLORS[kids.indexOf(k) % CHILD_COLORS.length]
                return (
                  <Link key={k.id} href={`/ortu/anak/${k.id}`}
                    onClick={() => setSidebarOpen(false)}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg mb-1 transition-colors"
                    style={{ background: 'rgba(255,255,255,0.08)' }}>
                    <div className="w-5 h-5 rounded-md flex items-center justify-center text-[8px] font-bold"
                      style={{ background: col.bg, color: col.text }}>
                      {initials(k.full_name)}
                    </div>
                    <span className="text-[10px] flex-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
                      {k.full_name.split(' ')[0]}
                    </span>
                    <ArrowLeftRight size={9} style={{ color: 'rgba(255,255,255,0.3)' }} />
                  </Link>
                )
              })}
            </div>
          )}

          {/* Mode ortu: daftar relasi */}
          {!isAnakMode && kids.length > 0 && (
            <div className="px-4 py-3" style={{ borderBottom: `1px solid ${T.divider}` }}>
              <p className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: T.secLabel }}>
                Daftar Relasi
              </p>
              <div className="flex flex-col gap-1.5">
                {kids.map((kid, idx) => {
                  const col = CHILD_COLORS[idx % CHILD_COLORS.length]
                  return (
                    <Link key={kid.id} href={`/ortu/anak/${kid.id}`}
                      onClick={() => setSidebarOpen(false)}
                      className="flex items-center gap-2 px-2.5 py-2 rounded-lg transition-colors"
                      style={{ border: `0.5px solid ${col.border}`, background: col.bg + '60' }}>
                      <div className="w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                        style={{ background: col.bg, color: col.text }}>
                        {initials(kid.full_name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold truncate" style={{ color: col.text }}>
                          {kid.full_name}
                        </p>
                      </div>
                      <ChevronRight size={11} style={{ color: col.text, opacity: 0.5 }} />
                    </Link>
                  )
                })}
                {isAlsoStudent && (
                  <button onClick={() => { router.push('/siswa/dashboard'); setSidebarOpen(false) }}
                    className="flex items-center gap-2 px-2.5 py-2 rounded-lg w-full text-left"
                    style={{ border: '0.5px dashed #CECBF6', background: '#EEEDFE40' }}>
                    <div className="w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-bold"
                      style={{ background: '#EEEDFE', color: '#3C3489' }}>
                      {initials(profile.full_name)}
                    </div>
                    <div className="flex-1">
                      <p className="text-[11px] font-semibold text-[#3C3489]">Diri Sendiri</p>
                      <p className="text-[9px] text-[#7B78A8]">Sebagai siswa</p>
                    </div>
                    <ArrowLeftRight size={10} className="text-[#5C4FE5] opacity-50" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Nav */}
          <nav className="flex-1 px-3 py-3 overflow-y-auto">
            <p className="text-[9px] font-bold uppercase tracking-widest mb-2 px-2" style={{ color: T.secLabel }}>
              {isAnakMode ? 'Menu Siswa' : 'Menu'}
            </p>
            <ul className="flex flex-col gap-0.5">
              {currentNav.map(({ href, label, icon: Icon }) => {
                const exact  = href === `/ortu/anak/${activeStudentId}` || href === '/ortu/dashboard'
                const active = exact ? pathname === href : pathname.startsWith(href)
                return (
                  <li key={href}>
                    <Link href={href} onClick={() => setSidebarOpen(false)}
                      className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12px] font-medium transition-colors"
                      style={{
                        background: active ? T.navActive : 'transparent',
                        color:      active ? T.navActiveText : T.navNorm,
                        border:     active ? `0.5px solid ${T.navActiveBord}` : '0.5px solid transparent',
                      }}>
                      <Icon size={14} style={{ opacity: active ? 1 : 0.5 }} />
                      {label}
                      {active && (
                        <ChevronRight size={11} style={{ marginLeft: 'auto', opacity: 0.6 }} />
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>

          {/* Footer */}
          <div className="px-3 pb-4 pt-2" style={{ borderTop: `1px solid ${T.divider}` }}>
            {/* Dark/light toggle */}
            <button
              onClick={toggleDark}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12px] font-medium mb-1 transition-colors"
              style={{
                background: isDark ? 'rgba(255,255,255,0.06)' : '#fafaf8',
                color: isAnakMode ? 'rgba(255,255,255,0.65)' : T.navNorm,
                border: `0.5px solid ${T.divider}`,
              }}>
              {isDark
                ? <Sun size={14} style={{ color: '#E6B800' }} />
                : <Moon size={14} />
              }
              {isDark ? 'Mode Terang' : 'Mode Gelap'}
              <div className="ml-auto w-8 h-4 rounded-full flex items-center px-0.5 transition-colors"
                style={{ background: isDark ? '#E6B800' : '#d1d5db' }}>
                <div className="w-3 h-3 rounded-full bg-white transition-transform"
                  style={{ transform: isDark ? 'translateX(16px)' : 'translateX(0)' }} />
              </div>
            </button>

            {isAnakMode ? (
              <Link href="/ortu/dashboard" onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-[12px] font-medium w-full transition-colors"
                style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)', border: '0.5px solid rgba(255,255,255,0.2)' }}>
                <ArrowLeft size={13} />
                Kembali ke Akun Utama
              </Link>
            ) : (
              <button onClick={handleSignOut} disabled={signingOut}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12px] font-medium hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-50"
                style={{ color: T.navNorm }}>
                <LogOut size={14} />
                {signingOut ? 'Keluar…' : 'Keluar'}
              </button>
            )}
          </div>
        </aside>

        {/* ═══ MAIN ═══ */}
        <div className="flex-1 flex flex-col min-w-0">

          {/* Topbar */}
          <header className="sticky top-0 z-10 flex items-center gap-3 px-4 lg:px-5 py-3"
            style={{ background: T.tbBg, backdropFilter: 'blur(8px)', borderBottom: `1px solid ${T.tbBorder}` }}>

            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-lg border"
              style={{ background: T.topbarAccBg, borderColor: T.topbarAccBord, color: T.topbarAccText }}>
              <Menu size={16} />
            </button>

            {/* Badge mode anak di topbar */}
            {isAnakMode && activeChild && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border"
                style={{ background: '#EEEDFE', borderColor: '#CECBF6' }}>
                <div className="w-4 h-4 rounded-sm flex items-center justify-center text-[7px] font-bold"
                  style={{ background: '#5C4FE5', color: '#fff' }}>
                  {initials(activeChild.full_name)}
                </div>
                <span className="text-[10px] font-medium text-[#3C3489]">
                  {activeChild.full_name.split(' ')[0]}
                </span>
              </div>
            )}

            {/* Mobile: logo ortu */}
            {!isAnakMode && (
              <div className="lg:hidden">
                <p className="text-sm font-bold text-stone-800" style={{ fontFamily: "'Sora', sans-serif" }}>EduKazia</p>
                <p className="text-[10px] text-amber-600 font-medium">Portal Orang Tua</p>
              </div>
            )}

            <div className="flex-1" />
          </header>

          <main className="flex-1 overflow-y-auto" style={{ background: T.bg, color: D.nameColor }}>{children}</main>
        </div>
      </div>
    </OrtuProvider>
  )
}
