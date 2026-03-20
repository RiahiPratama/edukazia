'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, CalendarDays, BookOpen,
  FolderOpen, Coins, LogOut, Menu, Globe2,
  ClipboardList, BarChart2
} from 'lucide-react'

const navItems = [
  { group: 'Utama', items: [
    { href: '/tutor/dashboard', label: 'Dashboard',       icon: LayoutDashboard },
    { href: '/tutor/jadwal',    label: 'Jadwal Mengajar', icon: CalendarDays },
  ]},
  { group: 'Akademik', items: [
    { href: '/tutor/kelas',     label: 'Kelas & Siswa',   icon: BookOpen },
    { href: '/tutor/absensi',   label: 'Absensi',         icon: ClipboardList },
    { href: '/tutor/laporan',   label: 'Laporan Siswa',   icon: BarChart2 },
    { href: '/tutor/materi',    label: 'Materi Ajar',     icon: FolderOpen },
  ]},
  { group: 'Keuangan', items: [
    { href: '/tutor/honor',     label: 'Honor Saya',      icon: Coins },
  ]},
]

export default function TutorLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  function isActive(href: string) {
    if (href === '/tutor/dashboard') return pathname === '/tutor/dashboard'
    return pathname.startsWith(href)
  }

  function NavContent({ onClose }: { onClose?: () => void }) {
    return (
      <>
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          {navItems.map(group => (
            <div key={group.group} className="mb-4">
              <div className="px-3 mb-1 text-[10px] font-bold uppercase tracking-widest text-[#7B78A8]">
                {group.group}
              </div>
              {group.items.map(item => {
                const Icon   = item.icon
                const active = isActive(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={[
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold mb-0.5 transition-all',
                      active
                        ? 'bg-[#5C4FE5] text-white'
                        : 'text-[#4A4580] hover:bg-[#F0EFFF] hover:text-[#5C4FE5]'
                    ].join(' ')}
                  >
                    <Icon size={16} strokeWidth={active ? 2.5 : 2} className="flex-shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>
        <div className="p-4 border-t border-[#E5E3FF]">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-[#4A4580] hover:bg-red-50 hover:text-red-600 transition-all"
          >
            <LogOut size={16} className="flex-shrink-0" />
            <span>Keluar</span>
          </button>
        </div>
      </>
    )
  }

  function Logo() {
    return (
      <Link href="/tutor/dashboard" className="flex items-center gap-2.5 no-underline" style={{ textDecoration: 'none' }}>
        <img
          src="/edukazia-logo-warna.png"
          alt="EduKazia"
          style={{ height: '32px', width: 'auto', objectFit: 'contain' }}
        />
        <span style={{ fontSize: '11px', background: '#5C4FE5', color: 'white', padding: '2px 8px', borderRadius: '999px', fontWeight: 600, flexShrink: 0 }}>
          Tutor
        </span>
      </Link>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#F7F6FF]">

      {/* SIDEBAR DESKTOP */}
      <div
        className="hidden lg:flex"
        style={{ width: '256px', minWidth: '256px', height: '100vh', backgroundColor: 'white', borderRight: '1.5px solid #E5E3FF', flexDirection: 'column', flexShrink: 0 }}
      >
        <div style={{ height: '64px', display: 'flex', alignItems: 'center', padding: '0 24px', borderBottom: '1px solid #E5E3FF', flexShrink: 0 }}>
          <Logo />
        </div>
        <NavContent />
      </div>

      {/* OVERLAY MOBILE */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 lg:hidden"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR MOBILE */}
      <div
        className="fixed top-0 left-0 h-full z-30 flex flex-col lg:hidden transition-transform duration-300"
        style={{ width: '256px', backgroundColor: 'white', borderRight: '1.5px solid #E5E3FF', transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)' }}
      >
        <div style={{ height: '64px', display: 'flex', alignItems: 'center', padding: '0 24px', borderBottom: '1px solid #E5E3FF', flexShrink: 0 }}>
          <Logo />
        </div>
        <NavContent onClose={() => setSidebarOpen(false)} />
      </div>

      {/* MAIN CONTENT */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <header
          className="flex items-center gap-4 px-4 lg:px-6"
          style={{ height: '64px', background: 'white', borderBottom: '1px solid #E5E3FF', flexShrink: 0 }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-lg hover:bg-[#F0EFFF] text-[#4A4580] transition-colors"
          >
            <Menu size={20} />
          </button>
          <div className="flex-1" />
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-[#7B78A8] hover:text-[#5C4FE5] transition-colors"
          >
            <Globe2 size={15} />
            <span className="hidden sm:inline">Lihat Landing Page</span>
          </a>
          <div
            className="flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
            style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#5C4FE5' }}
          >
            T
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
