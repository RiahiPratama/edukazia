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

  const anakMatch       = pathname.match(/^\/ortu\/anak\/([^/]+)/)
  const activeStudentId = anakMatch ? anakMatch[1] : null
  const isAnakMode      = !!activeStudentId

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
          .select(`id, slug, profile_id, relation_role, grade, school,
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
        slug:          row.slug ?? row.id,  // fallback ke id kalau slug belum ada
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
      <div className="min-h-screen flex items-center justify-center"
        style={{ background: '#FEFCF7', fontFamily: "'Sora', sans-serif" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-4 border-[#E6B800] border-t-transparent animate-spin" />
          <p className="text-sm text-amber-700 font-medium">Memuat portal orang tua…</p>
        </div>
      </div>
    )
  }
  if (!ctxData) return null

  const { profile, children: kids, isAlsoStudent } = ctxData
  const activeChild = activeStudentId ? kids.find(k => k.id === activeStudentId) : null
  const currentNav  = isAnakMode && activeStudentId ? navSiswa(activeStudentId) : NAV_ORTU
  // activeStudentId sekarang adalah slug (bukan UUID)

  // ── CSS Variables untuk dark/light mode ──────────────────────────────────
  const cssVars = isDark ? `
    --ortu-bg: #0F0F14;
    --ortu-sb-bg: #1A1A24;
    --ortu-sb-border: #2A2A38;
    --ortu-divider: #2A2A38;
    --ortu-card-bg: #1E1E2A;
    --ortu-card-border: #2A2A38;
    --ortu-text: #F0EDE8;
    --ortu-text-muted: #7A7890;
    --ortu-nav-active-bg: rgba(255,255,255,0.12);
    --ortu-nav-active-border: rgba(255,255,255,0.2);
    --ortu-nav-active-text: #F0EDE8;
    --ortu-nav-hover: rgba(255,255,255,0.06);
    --ortu-nav-norm: #8A8898;
    --ortu-sec-label: #5A5870;
    --ortu-tb-bg: rgba(15,15,20,0.95);
    --ortu-tb-border: #2A2A38;
  ` : `
    --ortu-bg: #FEFCF7;
    --ortu-sb-bg: #FFFFFF;
    --ortu-sb-border: #FEF3C7;
    --ortu-divider: #FEF3C7;
    --ortu-card-bg: #FFFFFF;
    --ortu-card-border: #F5F5F0;
    --ortu-text: #1C1917;
    --ortu-text-muted: #78716C;
    --ortu-nav-active-bg: #FAEEDA;
    --ortu-nav-active-border: #FAC775;
    --ortu-nav-active-text: #633806;
    --ortu-nav-hover: #FAF8F4;
    --ortu-nav-norm: #78716C;
    --ortu-sec-label: #A8A29E;
    --ortu-tb-bg: rgba(255,255,255,0.95);
    --ortu-tb-border: #FEF3C7;
  `

  // Sidebar anak mode tetap ungu, tidak ikut dark/light
  const sbBg     = isAnakMode ? '#5C4FE5' : 'var(--ortu-sb-bg)'
  const sbBorder = isAnakMode ? '#4338CA' : 'var(--ortu-sb-border)'
  const divider  = isAnakMode ? 'rgba(255,255,255,0.12)' : 'var(--ortu-divider)'
  const navNorm  = isAnakMode ? 'rgba(255,255,255,0.65)' : 'var(--ortu-nav-norm)'
  const navActiveText = isAnakMode ? '#fff' : 'var(--ortu-nav-active-text)'
  const navActiveBg   = isAnakMode ? 'rgba(255,255,255,0.18)' : 'var(--ortu-nav-active-bg)'
  const navActiveBord = isAnakMode ? 'rgba(255,255,255,0.25)' : 'var(--ortu-nav-active-border)'
  const secLabel = isAnakMode ? 'rgba(255,255,255,0.4)' : 'var(--ortu-sec-label)'

  return (
    <OrtuProvider value={ctxData}>
      {/* Inject CSS variables ke seluruh portal */}
      <style>{`:root { ${cssVars} }`}</style>
      {/* CSS override untuk dark mode di halaman konten */}
      {isDark && (
        <style>{`
          .ortu-content .bg-white,
          .ortu-content [class*="bg-white"] { background: var(--ortu-card-bg) !important; }
          .ortu-content [class*="bg-stone-50"],
          .ortu-content [class*="bg-stone-100"] { background: rgba(255,255,255,0.04) !important; }
          .ortu-content [class*="text-stone-800"],
          .ortu-content [class*="text-stone-700"] { color: #F0EDE8 !important; }
          .ortu-content [class*="text-stone-600"],
          .ortu-content [class*="text-stone-500"] { color: #B0ACBC !important; }
          .ortu-content [class*="text-stone-400"],
          .ortu-content [class*="text-stone-300"] { color: #7A7890 !important; }
          .ortu-content [class*="border-stone-100"],
          .ortu-content [class*="border-stone-50"] { border-color: #2A2A38 !important; }
          .ortu-content [class*="text-stone-700"][class*="font-bold"] { color: #D8D4E8 !important; }
        `}</style>
      )}

      <div
        className="min-h-screen flex"
        style={{
          background: isAnakMode ? (isDark ? '#0D0D18' : '#F7F6FF') : 'var(--ortu-bg)',
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          color: 'var(--ortu-text)',
        }}>

        {/* Overlay mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 lg:hidden"
            style={{ background: 'rgba(0,0,0,0.5)' }}
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ═══ SIDEBAR ═══ */}
        <aside
          className={`
            fixed top-0 left-0 h-full z-30 flex flex-col
            transition-transform duration-300 ease-in-out
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            lg:translate-x-0 lg:static lg:h-screen lg:sticky lg:top-0
          `}
          style={{
            width: '224px',
            minWidth: '224px',
            background: sbBg,
            borderRight: `1px solid ${sbBorder}`,
          }}>

          {/* Branding */}
          <div className="flex-shrink-0 px-4 pt-5 pb-3" style={{ borderBottom: `1px solid ${divider}` }}>
            <div className="flex items-center justify-between mb-2.5">
              <Link
                href={isAnakMode ? `/ortu/anak/${activeStudentId}` : '/ortu/dashboard'}
                className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
                  style={{
                    background: isAnakMode ? 'rgba(255,255,255,0.15)' : '#E6B800',
                    color: isAnakMode ? '#fff' : '#412402',
                  }}>E</div>
                <span
                  className="text-sm font-bold"
                  style={{ color: isAnakMode ? '#fff' : 'var(--ortu-text)', fontFamily: "'Sora', sans-serif" }}>
                  EduKazia
                </span>
              </Link>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden p-1 rounded-md"
                style={{ color: isAnakMode ? 'rgba(255,255,255,0.6)' : 'var(--ortu-text-muted)' }}>
                <X size={16} />
              </button>
            </div>

            {/* Badge */}
            <span
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-semibold tracking-wide uppercase"
              style={{
                background: isAnakMode ? 'rgba(255,255,255,0.12)' : (isDark ? '#2A2A38' : '#FAEEDA'),
                border: `0.5px solid ${isAnakMode ? 'rgba(255,255,255,0.2)' : (isDark ? '#3A3A50' : '#FAC775')}`,
                color: isAnakMode ? 'rgba(255,255,255,0.8)' : (isDark ? '#C4B89A' : '#854F0B'),
              }}>
              {isAnakMode ? <GraduationCap size={10} /> : <Users size={10} />}
              {isAnakMode ? 'Portal Siswa' : 'Portal Orang Tua'}
            </span>
          </div>

          {/* Mode anak: info siswa + switcher */}
          {isAnakMode && activeChild && (
            <div className="flex-shrink-0 px-4 py-3" style={{ borderBottom: `1px solid ${divider}` }}>
              <p className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: secLabel }}>
                Melihat sebagai
              </p>
              <div className="flex items-center gap-2.5 mb-2">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}>
                  {initials(activeChild.full_name)}
                </div>
                <div className="min-w-0 flex-1">
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
              {kids.filter(k => k.id !== activeStudentId).map(k => {
                const col = CHILD_COLORS[kids.indexOf(k) % CHILD_COLORS.length]
                return (
                  <Link
                    key={k.id}
                    href={`/ortu/anak/${k.slug}`}
                    onClick={() => setSidebarOpen(false)}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg mb-1"
                    style={{ background: 'rgba(255,255,255,0.08)' }}>
                    <div
                      className="w-5 h-5 rounded-md flex items-center justify-center text-[8px] font-bold flex-shrink-0"
                      style={{ background: col.bg, color: col.text }}>
                      {initials(k.full_name)}
                    </div>
                    <span className="text-[10px] flex-1 truncate" style={{ color: 'rgba(255,255,255,0.6)' }}>
                      {k.full_name.split(' ')[0]}
                    </span>
                    <ArrowLeftRight size={9} style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
                  </Link>
                )
              })}
            </div>
          )}

          {/* Mode ortu: daftar relasi */}
          {!isAnakMode && kids.length > 0 && (
            <div className="flex-shrink-0 px-4 py-3" style={{ borderBottom: `1px solid ${divider}` }}>
              <p className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: secLabel }}>
                Daftar Relasi
              </p>
              <div className="flex flex-col gap-1.5">
                {kids.map((kid, idx) => {
                  const col = CHILD_COLORS[idx % CHILD_COLORS.length]
                  return (
                    <Link
                      key={kid.id}
                      href={`/ortu/anak/${kid.slug}`}
                      onClick={() => setSidebarOpen(false)}
                      className="flex items-center gap-2 px-2.5 py-2 rounded-lg"
                      style={{ border: `0.5px solid ${col.border}`, background: col.bg + '50' }}>
                      <div
                        className="w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                        style={{ background: col.bg, color: col.text }}>
                        {initials(kid.full_name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold truncate" style={{ color: col.text }}>
                          {kid.full_name}
                        </p>
                        <p className="text-[9px] opacity-60 truncate" style={{ color: col.text }}>
                          {kid.relation_role === 'Diri Sendiri' ? 'Diri Sendiri (Siswa)' : (kid.grade ?? kid.relation_role ?? '')}
                        </p>
                      </div>
                      <ChevronRight size={11} style={{ color: col.text, opacity: 0.5, flexShrink: 0 }} />
                    </Link>
                  )
                })}
                {isAlsoStudent && (
                  <button
                    onClick={() => { router.push('/siswa/dashboard'); setSidebarOpen(false) }}
                    className="flex items-center gap-2 px-2.5 py-2 rounded-lg w-full text-left"
                    style={{ border: '0.5px dashed #CECBF6', background: isDark ? '#1E1E2E' : '#EEEDFE40' }}>
                    <div
                      className="w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                      style={{ background: '#EEEDFE', color: '#3C3489' }}>
                      {initials(profile.full_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-[#5C4FE5] truncate">Diri Sendiri</p>
                      <p className="text-[9px] text-[#7B78A8]">Sebagai siswa</p>
                    </div>
                    <ArrowLeftRight size={10} style={{ color: '#5C4FE5', opacity: 0.6, flexShrink: 0 }} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Nav */}
          <nav className="flex-1 px-3 py-3 overflow-y-auto">
            <p className="text-[9px] font-bold uppercase tracking-widest mb-2 px-2" style={{ color: secLabel }}>
              {isAnakMode ? 'Menu Siswa' : 'Menu'}
            </p>
            <ul className="flex flex-col gap-0.5 list-none m-0 p-0">
              {currentNav.map(({ href, label, icon: Icon }) => {
                const exact  = href === `/ortu/anak/${activeStudentId}` || href === '/ortu/dashboard'
                const active = exact ? pathname === href : pathname.startsWith(href)
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={() => setSidebarOpen(false)}
                      className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12px] font-medium transition-colors w-full"
                      style={{
                        background:  active ? navActiveBg   : 'transparent',
                        color:       active ? navActiveText : navNorm,
                        border:      `0.5px solid ${active ? navActiveBord : 'transparent'}`,
                        textDecoration: 'none',
                      }}>
                      <Icon size={14} style={{ opacity: active ? 1 : 0.55, flexShrink: 0 }} />
                      <span>{label}</span>
                      {active && (
                        <ChevronRight size={11} style={{ marginLeft: 'auto', opacity: 0.6, flexShrink: 0 }} />
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>

          {/* Footer */}
          <div className="flex-shrink-0 px-3 pb-4 pt-2" style={{ borderTop: `1px solid ${divider}` }}>
            {/* Dark/light toggle — hanya di mode ortu */}
            {!isAnakMode && (
              <button
                onClick={toggleDark}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12px] font-medium mb-2 transition-colors"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.06)' : '#F7F5F0',
                  color: isDark ? '#C4B89A' : '#78716C',
                  border: `0.5px solid ${isDark ? '#2A2A38' : '#E8E4DC'}`,
                }}>
                {isDark
                  ? <Sun size={14} style={{ color: '#E6B800', flexShrink: 0 }} />
                  : <Moon size={14} style={{ flexShrink: 0 }} />
                }
                <span>{isDark ? 'Mode Terang' : 'Mode Gelap'}</span>
                {/* Toggle pill */}
                <div
                  className="ml-auto flex items-center px-0.5 rounded-full transition-colors flex-shrink-0"
                  style={{
                    width: '28px', height: '16px',
                    background: isDark ? '#E6B800' : '#D1D5DB',
                  }}>
                  <div
                    className="rounded-full bg-white transition-transform"
                    style={{
                      width: '12px', height: '12px',
                      transform: isDark ? 'translateX(12px)' : 'translateX(0)',
                    }} />
                </div>
              </button>
            )}

            {isAnakMode ? (
              <>
                <Link
                  href="/ortu/dashboard"
                  onClick={() => setSidebarOpen(false)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-[12px] font-medium w-full mb-2"
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.8)',
                    border: '0.5px solid rgba(255,255,255,0.2)',
                    textDecoration: 'none',
                  }}>
                  <ArrowLeft size={13} style={{ flexShrink: 0 }} />
                  Kembali ke Akun Utama
                </Link>
                {/* Toggle dark/light di bawah kembali */}
                <button
                  onClick={toggleDark}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12px] font-medium transition-colors"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    color: 'rgba(255,255,255,0.65)',
                    border: '0.5px solid rgba(255,255,255,0.12)',
                  }}>
                  {isDark
                    ? <Sun size={13} style={{ color: '#E6B800', flexShrink: 0 }} />
                    : <Moon size={13} style={{ flexShrink: 0 }} />
                  }
                  <span>{isDark ? 'Mode Terang' : 'Mode Gelap'}</span>
                  <div
                    className="ml-auto flex items-center px-0.5 rounded-full transition-colors flex-shrink-0"
                    style={{ width: '26px', height: '14px', background: isDark ? '#E6B800' : 'rgba(255,255,255,0.2)' }}>
                    <div
                      className="rounded-full bg-white transition-transform"
                      style={{ width: '10px', height: '10px', transform: isDark ? 'translateX(12px)' : 'translateX(0)' }} />
                  </div>
                </button>
              </>
            ) : (
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12px] font-medium transition-colors disabled:opacity-50"
                style={{ color: isDark ? '#6B6880' : '#A8A29E' }}>
                <LogOut size={14} style={{ flexShrink: 0 }} />
                {signingOut ? 'Keluar…' : 'Keluar'}
              </button>
            )}
          </div>
        </aside>

        {/* ═══ MAIN ═══ */}
        <div className="flex-1 flex flex-col min-w-0 min-h-screen">

          {/* Mobile only — hamburger sederhana, tidak ada topbar di desktop */}
          <div
            className="lg:hidden flex items-center gap-3 px-4 py-3 sticky top-0 z-10"
            style={{
              background: isAnakMode
                ? (isDark ? 'rgba(13,13,24,0.95)' : 'rgba(247,246,255,0.95)')
                : (isDark ? 'rgba(15,15,20,0.95)' : 'rgba(255,255,255,0.95)'),
              backdropFilter: 'blur(8px)',
              borderBottom: `1px solid ${isAnakMode ? (isDark ? '#2A2A38' : '#E5E3FF') : (isDark ? '#2A2A38' : '#FEF3C7')}`,
            }}>
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-lg border flex-shrink-0"
              style={{
                background: isAnakMode ? '#EEEDFE' : (isDark ? '#1E1E2A' : '#FEF9EE'),
                borderColor: isAnakMode ? '#CECBF6' : (isDark ? '#2A2A38' : '#FAC775'),
                color: isAnakMode ? '#5C4FE5' : (isDark ? '#C4B89A' : '#B45309'),
              }}>
              <Menu size={16} />
            </button>
            <span className="text-sm font-bold"
              style={{ color: isAnakMode ? (isDark ? '#AFA9EC' : '#3C3489') : 'var(--ortu-text)', fontFamily: "'Sora', sans-serif" }}>
              {isAnakMode && activeChild ? activeChild.full_name.split(' ')[0] : 'EduKazia'}
            </span>
          </div>

          {/* Page content */}
          <main className="ortu-content flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </OrtuProvider>
  )
}
