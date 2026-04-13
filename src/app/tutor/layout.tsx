'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AutoActivityTracker from '@/components/AutoActivityTracker'
import { Logo } from '@/components/ui/Logo'
import {
  LayoutDashboard, CalendarDays, BookOpen,
  FolderOpen, Coins, LogOut, Menu,
  ClipboardList, BarChart2, Settings, Archive
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
    { href: '/tutor/arsip',     label: 'Arsip Kelas',     icon: Archive },
    { href: '/tutor/materi',    label: 'Materi Ajar',     icon: FolderOpen },
  ]},
  { group: 'Keuangan', items: [
    { href: '/tutor/honor',     label: 'Honor Saya',      icon: Coins },
  ]},
  { group: 'Akun', items: [
    { href: '/tutor/pengaturan', label: 'Pengaturan',     icon: Settings },
  ]},
]

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
}

// Komponen Avatar — fetch client-side, tampil inisial dulu
function TutorAvatar({ size = 32, className = '' }: { size?: number; className?: string }) {
  const supabase = createClient()
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [name,      setName]      = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', user.id)
        .single()
      if (data) {
        setName(data.full_name ?? '')
        setAvatarUrl(data.avatar_url ?? null)
      }
    }
    load()
  }, [])

  const initials = name ? getInitials(name) : 'T'

  return avatarUrl ? (
    <img src={avatarUrl} alt={name}
      className={className}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}/>
  ) : (
    <div className={className}
      style={{ width: size, height: size, borderRadius: '50%', background: '#5C4FE5', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.35, fontWeight: 700, flexShrink: 0 }}>
      {initials}
    </div>
  )
}

// Logo untuk mobile topbar
function LogoText() {
  return <Logo variant="default" size="sm" href="/tutor/dashboard"/>
}

export default function TutorLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [tutorName,   setTutorName]   = useState('')

  useEffect(() => {
    async function loadName() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
      if (data) setTutorName(data.full_name ?? '')
    }
    loadName()
  }, [])

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
                  <Link key={item.href} href={item.href} onClick={onClose}
                    className={[
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold mb-0.5 transition-all',
                      active ? 'bg-[#5C4FE5] text-white' : 'text-[#4A4580] hover:bg-[#F0EFFF] hover:text-[#5C4FE5]'
                    ].join(' ')}>
                    <Icon size={16} strokeWidth={active ? 2.5 : 2} className="flex-shrink-0"/>
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Profil + Keluar */}
        <div className="p-3 border-t border-[#E5E3FF] flex flex-col gap-1">
          {/* Card profil */}
          <Link href="/tutor/pengaturan" onClick={onClose}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#F0EFFF] transition-all group">
            <TutorAvatar size={32}/>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#1A1640] truncate group-hover:text-[#5C4FE5] transition-colors">
                {tutorName || 'Tutor'}
              </p>
              <p className="text-[10px] text-[#7B78A8]">Lihat profil</p>
            </div>
          </Link>
          {/* Keluar */}
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-[#4A4580] hover:bg-red-50 hover:text-red-600 transition-all">
            <LogOut size={16} className="flex-shrink-0"/>
            <span>Keluar</span>
          </button>
        </div>
      </>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#F7F6FF]">
      {/* Sidebar Desktop */}
      <div className="hidden lg:flex"
        style={{ width: '256px', minWidth: '256px', height: '100vh', backgroundColor: 'white', borderRight: '1.5px solid #E5E3FF', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ height: '64px', display: 'flex', alignItems: 'center', padding: '0 24px', borderBottom: '1px solid #E5E3FF', flexShrink: 0 }}>
          <Logo variant="default" size="sm" href="/tutor/dashboard" badge="Tutor"/>
        </div>
      </div>

      {/* Sidebar Mobile Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 lg:hidden" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setSidebarOpen(false)}/>
      )}
      <div className="fixed top-0 left-0 h-full z-30 flex flex-col lg:hidden transition-transform duration-300"
        style={{ width: '256px', backgroundColor: 'white', borderRight: '1.5px solid #E5E3FF', transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)' }}>
        <div style={{ height: '64px', display: 'flex', alignItems: 'center', padding: '0 24px', borderBottom: '1px solid #E5E3FF', flexShrink: 0 }}>
          <Logo variant="default" size="sm" href="/tutor/dashboard" badge="Tutor"/>
        </div>
        <NavContent onClose={() => setSidebarOpen(false)}/>
      </div>

      {/* Main Content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top bar mobile: [☰] [Logo Teks] ←→ [Avatar] */}
        <header className="flex items-center px-3 lg:hidden"
          style={{ height: '56px', background: 'white', borderBottom: '1px solid #E5E3FF', flexShrink: 0 }}>
          <button onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-[#F0EFFF] text-[#4A4580] transition-colors flex-shrink-0">
            <Menu size={20}/>
          </button>
          <div className="flex-1 flex justify-center">
            <LogoText/>
          </div>
          <Link href="/tutor/pengaturan" className="flex-shrink-0">
            <TutorAvatar size={32}/>
          </Link>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <AutoActivityTracker />
          {children}
        </main>
      </div>
    </div>
  )
}
