'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const navItems = [
  {
    group: 'Utama', items: [
      { href: '/admin/dashboard', label: 'Dashboard', icon: '◉' },
      { href: '/admin/jadwal', label: 'Jadwal', icon: '📅' },
    ]
  },
  {
    group: 'Akademik', items: [
      { href: '/admin/siswa', label: 'Siswa', icon: '👨‍🎓' },
      { href: '/admin/tutor', label: 'Tutor', icon: '👨‍🏫' },
      { href: '/admin/kelas', label: 'Kelas', icon: '🏫' },
      { href: '/admin/kursus', label: 'Kursus & Paket', icon: '📚' },
    ]
  },
  {
    group: 'Keuangan', items: [
      { href: '/admin/pembayaran', label: 'Pembayaran', icon: '💳' },
      { href: '/admin/honor', label: 'Honor Tutor', icon: '💰' },
    ]
  },
  {
    group: 'Sistem', items: [
      { href: '/admin/materi', label: 'Materi Tutor', icon: '📂' },
      { href: '/admin/konten', label: 'Konten Landing', icon: '🌐' },
    ]
  },
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

  const SidebarContent = () => (
    <>
      <div className="h-16 flex items-center px-6 border-b border-[#E5E3FF] flex-shrink-0">
        <Link href="/admin/dashboard" className="flex items-center gap-2">
          <span className="font-black text-xl" style={{ fontFamily: 'Sora,sans-serif' }}>
            <span className="text-[#5C4FE5]">edu</span>
            <span className="text-[#E6B800]">kazia</span>
          </span>
          <span className="text-xs bg-[#5C4FE5] text-white px-2 py-0.5 rounded-full font-semibold">
            Admin
          </span>
        </Link>
      </div>
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
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold mb-0.5 transition-all ${isActive(item.href)
                    ? 'bg-[#5C4FE5] text-white shadow-sm'
                    : 'text-[#4A4580] hover:bg-[#F0EFFF] hover:text-[#5C4FE5]'
                  }`}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>
      <div className="p-4 border-t border-[#E5E3FF] flex-shrink-0">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-[#4A4580] hover:bg-red-50 hover:text-red-600 transition-all"
        >
          <span>🚪</span> Keluar
        </button>
      </div>
    </>
  )

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#F7F6FF' }}>

      {/* Sidebar Desktop */}
      <div style={{ width: '256px', flexShrink: 0, height: '100vh', background: 'white', borderRight: '1px solid #E5E3FF', display: 'flex', flexDirection: 'column', overflowY: 'auto' }} className="hidden lg:flex">
        <SidebarContent />
      </div>

      {/* Overlay Mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar Mobile */}
      <div className={`fixed top-0 left-0 h-full w-64 bg-white border-r border-[#E5E3FF] z-30 flex flex-col transition-transform duration-300 lg:hidden ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <SidebarContent />
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header className="h-16 bg-white border-b border-[#E5E3FF] flex items-center px-4 lg:px-6 gap-4 flex-shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-[#F0EFFF] text-[#4A4580]">
            ☰
          </button>
          <div className="flex-1" />
          <a href="/" target="_blank" rel="noopener noreferrer" className="text-sm text-[#7B78A8] hover:text-[#5C4FE5] transition-colors">
            🌐 Lihat Landing Page
          </a>
          <div className="w-8 h-8 rounded-full bg-[#5C4FE5] flex items-center justify-center text-white text-sm font-bold">A</div>
        </header>
        <main style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {children}
        </main>
      </div>
    </div>
  )
}