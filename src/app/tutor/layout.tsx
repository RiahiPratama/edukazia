'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, CalendarDays, GraduationCap, Users, BookOpen,
  Layers, CreditCard, Coins, FolderOpen, Globe, LogOut, Menu, Globe2,
  ClipboardList, Archive
} from 'lucide-react'

const navItems = [
  { group: 'Utama', items: [
    { href: '/admin/dashboard', label: 'Dashboard',      icon: LayoutDashboard },
    { href: '/admin/jadwal',    label: 'Jadwal',          icon: CalendarDays },
  ]},
  { group: 'Akademik', items: [
    { href: '/admin/siswa',     label: 'Siswa',           icon: GraduationCap },
    { href: '/admin/tutor',     label: 'Tutor',           icon: Users },
    { href: '/admin/kelas',     label: 'Kelas',           icon: BookOpen },
    { href: '/admin/kursus',    label: 'Kursus & Paket',  icon: Layers },
    { href: '/admin/absensi',   label: 'Absensi',         icon: ClipboardList },
    { href: '/admin/arsip',     label: 'Arsip Kelas',     icon: Archive },
  ]},
  { group: 'Keuangan', items: [
    { href: '/admin/pembayaran', label: 'Pembayaran',     icon: CreditCard },
    { href: '/admin/honor',      label: 'Honor Tutor',    icon: Coins },
  ]},
  { group: 'Sistem', items: [
    { href: '/admin/materi',    label: 'Materi Tutor',    icon: FolderOpen },
    { href: '/admin/konten',    label: 'Konten Landing',  icon: Globe },
  ]},
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname()
  const router    = useRouter()
  const supabase  = createClient()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  function isActive(href: string) {
    if (href === '/admin/dashboard') return pathname === '/admin/dashboard'
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
                const Icon    = item.icon
                const active  = isActive(item.href)
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
                    <Icon size={16} strokeWidth={active ? 2.5 : 2} className="flex-shrink-0"/>
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
            <LogOut size={16} className="flex-shrink-0"/>
            <span>Keluar</span>
          </button>
        </div>
      </>
    )
  }

  function Logo() {
    return (
      <Link href="/admin/dashboard" className="flex items-center gap-2.5 no-underline" style={{textDecoration:'none'}}>
        <img src="/edukazia-logo-warna.png" alt="EduKazia"
          style={{ height: '32px', width: 'auto', objectFit: 'contain' }}/>
        <span style={{ fontSize: '11px', background: '#5C4FE5', color: 'white', padding: '2px 8px', borderRadius: '999px', fontWeight: 600, flexShrink: 0 }}>
          Admin
        </span>
      </Link>
    )
  }

  return (
    <div className="admin-root flex h-screen overflow-hidden bg-[#F7F6FF]">
      <div className="admin-sidebar-wrap hidden lg:flex"
        style={{ width: '256px', minWidth: '256px', height: '100vh', backgroundColor: 'white', borderRight: '1.5px solid #E5E3FF', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ height: '64px', display: 'flex', alignItems: 'center', padding: '0 24px', borderBottom: '1px solid #E5E3FF', flexShrink: 0 }}>
          <Logo/>
        </div>
        <NavContent/>
      </div>
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 lg:hidden" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setSidebarOpen(false)}/>
      )}
      <div className="fixed top-0 left-0 h-full z-30 flex flex-col lg:hidden transition-transform duration-300"
        style={{ width: '256px', backgroundColor: 'white', borderRight: '1.5px solid #E5E3FF', transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)' }}>
        <div style={{ height: '64px', display: 'flex', alignItems: 'center', padding: '0 24px', borderBottom: '1px solid #E5E3FF', flexShrink: 0 }}>
          <Logo/>
        </div>
        <NavContent onClose={() => setSidebarOpen(false)}/>
      </div>
      <div className="flex flex-col flex-1 overflow-hidden">
        <header className="flex items-center gap-4 px-4 lg:px-6"
          style={{ height: '64px', background: 'white', borderBottom: '1px solid #E5E3FF', flexShrink: 0 }}>
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-[#F0EFFF] text-[#4A4580] transition-colors">
            <Menu size={20}/>
          </button>
          <div className="flex-1"/>
          <a href="/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-[#7B78A8] hover:text-[#5C4FE5] transition-colors">
            <Globe2 size={15}/>
            <span className="hidden sm:inline">Lihat Landing Page</span>
          </a>
          <div className="flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
            style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#5C4FE5' }}>A</div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  )
}
