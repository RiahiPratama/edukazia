'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const navItems = [
  { group: 'Utama', items: [
    { href: '/admin/dashboard', label: 'Dashboard', icon: '◉' },
    { href: '/admin/jadwal', label: 'Jadwal', icon: '📅' },
  ]},
  { group: 'Akademik', items: [
    { href: '/admin/siswa', label: 'Siswa', icon: '👨‍🎓' },
    { href: '/admin/tutor', label: 'Tutor', icon: '👨‍🏫' },
    { href: '/admin/kelas', label: 'Kelas', icon: '🏫' },
    { href: '/admin/kursus', label: 'Kursus & Paket', icon: '📚' },
  ]},
  { group: 'Keuangan', items: [
    { href: '/admin/pembayaran', label: 'Pembayaran', icon: '💳' },
    { href: '/admin/honor', label: 'Honor Tutor', icon: '💰' },
  ]},
  { group: 'Sistem', items: [
    { href: '/admin/materi', label: 'Materi Tutor', icon: '📂' },
    { href: '/admin/konten', label: 'Konten Landing', icon: '🌐' },
  ]},
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
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
              {group.items.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={[
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold mb-0.5 transition-all',
                    isActive(item.href)
                      ? 'bg-[#5C4FE5] text-white'
                      : 'text-[#4A4580] hover:bg-[#F0EFFF] hover:text-[#5C4FE5]'
                  ].join(' ')}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="p-4 border-t border-[#E5E3FF]">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-[#4A4580] hover:bg-red-50 hover:text-red-600 transition-all"
          >
            <span>🚪</span>
            <span>Keluar</span>
          </button>
        </div>
      </>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#F7F6FF]">

      {/* SIDEBAR DESKTOP */}
      <div
        className="hidden lg:flex"
        style={{
          width: '256px',
          minWidth: '256px',
          height: '100vh',
          backgroundColor: 'white',
          borderRight: '1.5px solid #E5E3FF',
          flexDirection: 'column',
          flexShrink: 0,
          borderRadius: 0,
        }}
      >
        <div style={{ height: '64px', display: 'flex', alignItems: 'center', padding: '0 24px', borderBottom: '1px solid #E5E3FF', flexShrink: 0 }}>
          <Link href="/admin/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
            <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 800, fontSize: '1.2rem' }}>
              <span style={{ color: '#5C4FE5' }}>edu</span>
              <span style={{ color: '#E6B800' }}>kazia</span>
            </span>
            <span style={{ fontSize: '11px', background: '#5C4FE5', color: 'white', padding: '2px 8px', borderRadius: '999px', fontWeight: 600 }}>
              Admin
            </span>
          </Link>
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
        style={{
          width: '256px',
          backgroundColor: 'white',
          borderRight: '1.5px solid #E5E3FF',
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
          borderRadius: 0,
        }}
      >
        <div style={{ height: '64px', display: 'flex', alignItems: 'center', padding: '0 24px', borderBottom: '1px solid #E5E3FF', flexShrink: 0 }}>
          <Link href="/admin/dashboard" onClick={() => setSidebarOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
            <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 800, fontSize: '1.2rem' }}>
              <span style={{ color: '#5C4FE5' }}>edu</span>
              <span style={{ color: '#E6B800' }}>kazia</span>
            </span>
          </Link>
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
            className="lg:hidden p-2 rounded-lg hover:bg-[#F0EFFF] text-[#4A4580]"
          >
            ☰
          </button>
          <div className="flex-1" />
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[#7B78A8] hover:text-[#5C4FE5] transition-colors"
          >
            🌐 Lihat Landing Page
          </a>
          <div
            className="flex items-center justify-center text-white text-sm font-bold"
            style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#5C4FE5', flexShrink: 0 }}
          >
            A
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>

    </div>
  )
}
