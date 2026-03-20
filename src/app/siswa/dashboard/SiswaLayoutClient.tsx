'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, CalendarDays, FileText, BookOpen,
  User, LogOut, Menu, MessageCircle, AlertCircle, Bell
} from 'lucide-react'
import { getInitials, isStudentFullyExpired } from '@/lib/siswa/helpers'

interface Profile {
  id: string
  full_name: string
  role: string
  phone: string | null
  email: string | null
  avatar_url: string | null
}

interface Props {
  profile: Profile
  childrenList: any[]
  activeChild: any
  isParent: boolean
  children: React.ReactNode
}

const navGroups = [
  { group: 'Menu', items: [
    { href: '/siswa/dashboard', label: 'Dashboard',      icon: LayoutDashboard },
    { href: '/siswa/jadwal',    label: 'Jadwal',          icon: CalendarDays },
    { href: '/siswa/laporan',   label: 'Laporan Belajar', icon: FileText },
    { href: '/siswa/materi',    label: 'Materi Belajar',  icon: BookOpen },
  ]},
  { group: 'Akun', items: [
    { href: '/siswa/profil',    label: 'Profil',          icon: User },
  ]},
]

const AVATAR_COLORS = ['#5C4FE5','#E6B800','#16A34A','#2563EB','#DC2626','#D97706']
function avatarColor(name: string) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]
}

export default function SiswaLayoutClient({ profile, childrenList, activeChild, isParent, children }: Props) {
  const pathname  = usePathname()
  const router    = useRouter()
  const supabase  = createClient()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const expired  = activeChild ? isStudentFullyExpired(activeChild) : false
  const waNumber = process.env.NEXT_PUBLIC_WA_NUMBER ?? ''

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  function isActive(href: string) {
    if (href === '/siswa/dashboard') return pathname === '/siswa/dashboard'
    return pathname.startsWith(href)
  }

  function switchChild(childId: string) {
    document.cookie = `active_child=${childId}; path=/`
    window.location.reload()
  }

  function NavContent({ onClose }: { onClose?: () => void }) {
    return (
      <>
        {/* Active child info */}
        <div className="px-3 pt-4 pb-2">
          <div className="px-3 py-2.5 rounded-xl bg-white/10">
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                style={{ background: activeChild ? avatarColor(activeChild.profile.full_name) : '#E6B800', color: '#fff' }}
              >
                {activeChild ? getInitials(activeChild.profile.full_name) : '??'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-white leading-none truncate">
                  {activeChild?.profile.full_name ?? 'Pilih Siswa'}
                </p>
                <p className="text-[10px] text-white/60 mt-0.5">
                  {activeChild?.grade ? `Kelas ${activeChild.grade}` : '—'} · {expired ? 'Expired' : 'Aktif'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2 px-3">
          {navGroups.map(group => (
            <div key={group.group} className="mb-3">
              <div className="px-3 mb-1 text-[10px] font-bold uppercase tracking-widest text-white/40">
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
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold mb-0.5 transition-all',
                      active ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
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

        {/* Footer */}
        <div className="p-3 border-t border-white/10 space-y-1">
          <a
            href={`https://wa.me/${waNumber}?text=Halo Admin EduKazia`}
            target="_blank" rel="noopener noreferrer"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold text-white/70 hover:bg-white/10 hover:text-white transition-all"
          >
            <MessageCircle size={16} className="flex-shrink-0" />
            <span>Hubungi Admin</span>
            <span className="w-2 h-2 rounded-full bg-green-400 ml-auto flex-shrink-0" />
          </a>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold text-white/70 hover:bg-red-500/20 hover:text-red-300 transition-all"
          >
            <LogOut size={16} className="flex-shrink-0" />
            <span>Keluar</span>
          </button>
        </div>
      </>
    )
  }

  const witTime = new Date().toLocaleTimeString('id-ID', {
    timeZone: 'Asia/Jayapura', hour: '2-digit', minute: '2-digit', hour12: false
  })

  return (
    <div className="flex h-screen overflow-hidden bg-[#F7F6FF]">

      {/* SIDEBAR DESKTOP */}
      <div className="hidden lg:flex flex-col flex-shrink-0"
        style={{ width: '232px', minWidth: '232px', height: '100vh', background: '#5C4FE5', borderRight: '1.5px solid #4338CA' }}>
        <div style={{ height: '64px', display: 'flex', alignItems: 'center', padding: '0 20px', borderBottom: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
          <div>
            <span className="text-[17px] font-black text-white tracking-tight">EduKazia</span>
            <p className="text-[9px] text-white/50 mt-0.5 leading-none">Portal Siswa & Orang Tua</p>
          </div>
        </div>
        <div className="flex flex-col flex-1 overflow-hidden"><NavContent /></div>
      </div>

      {/* OVERLAY MOBILE */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 lg:hidden bg-black/50" onClick={() => setSidebarOpen(false)} />
      )}

      {/* SIDEBAR MOBILE */}
      <div
        className="fixed top-0 left-0 h-full z-30 flex flex-col lg:hidden transition-transform duration-300"
        style={{ width: '232px', background: '#5C4FE5', borderRight: '1.5px solid #4338CA', transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)' }}
      >
        <div style={{ height: '64px', display: 'flex', alignItems: 'center', padding: '0 20px', borderBottom: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
          <div>
            <span className="text-[17px] font-black text-white tracking-tight">EduKazia</span>
            <p className="text-[9px] text-white/50 mt-0.5 leading-none">Portal Siswa & Orang Tua</p>
          </div>
        </div>
        <div className="flex flex-col flex-1 overflow-hidden">
          <NavContent onClose={() => setSidebarOpen(false)} />
        </div>
      </div>

      {/* MAIN */}
      <div className="flex flex-col flex-1 overflow-hidden">

        {/* Topbar */}
        <header className="flex items-center gap-3 px-4 lg:px-6 flex-shrink-0"
          style={{ height: '64px', background: 'white', borderBottom: '1px solid #E5E3FF' }}>
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-[#F0EFFF] text-[#4A4580]">
            <Menu size={20} />
          </button>
          <div className="flex-1" />

          {/* WIT */}
          <span className="text-[11px] text-[#9B97B2] bg-[#F7F6FF] border border-[#E5E3FF] rounded-full px-3 py-1 font-medium hidden sm:block">
            WIT {witTime}
          </span>

          {/* Notif */}
          <button className="relative w-8 h-8 rounded-full border border-[#E5E3FF] bg-white flex items-center justify-center flex-shrink-0">
            <Bell size={14} className="text-[#6B6580]" />
          </button>

          {/* Avatar switcher — tampilkan semua anak jika ortu */}
          {isParent && childrenList.length > 1 ? (
            <div className="flex items-center gap-1">
              {childrenList.map((child: any, idx: number) => {
                const isActive = child.id === activeChild?.id
                const color = avatarColor(child.profile.full_name)
                return (
                  <button
                    key={child.id}
                    onClick={() => switchChild(child.id)}
                    title={child.profile.full_name}
                    className="transition-all"
                    style={{ marginLeft: idx > 0 ? '-8px' : 0, zIndex: isActive ? 10 : 5 - idx, position: 'relative' }}
                  >
                    <div
                      className="flex items-center justify-center text-[10px] font-bold text-white transition-all"
                      style={{
                        width: isActive ? '34px' : '28px',
                        height: isActive ? '34px' : '28px',
                        borderRadius: '50%',
                        background: color,
                        border: isActive ? '2.5px solid #5C4FE5' : '2px solid white',
                        boxShadow: isActive ? '0 0 0 2px #EAE8FD' : 'none',
                        fontSize: isActive ? '11px' : '9px',
                      }}
                    >
                      {getInitials(child.profile.full_name)}
                    </div>
                  </button>
                )
              })}
              <div className="ml-2 flex flex-col">
                <span className="text-[12px] font-semibold text-[#5C4FE5] leading-none">
                  {profile.full_name.split(' ')[0]}
                </span>
                <span className="text-[10px] text-[#9B97B2]">Orang Tua</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-[#EAE8FD] rounded-full px-3 py-1.5">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                style={{ background: activeChild ? avatarColor(activeChild.profile.full_name) : '#5C4FE5' }}
              >
                {getInitials(profile.full_name)}
              </div>
              <span className="text-[12px] font-semibold text-[#5C4FE5]">
                {profile.full_name.split(' ')[0]}
              </span>
            </div>
          )}
        </header>

        {/* Expired banner */}
        {expired && activeChild && (
          <div className="mx-4 mt-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3 flex-shrink-0">
            <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-[12px] font-bold text-red-700">Paket Belajar Berakhir</p>
              <p className="text-[11px] text-red-500 mt-0.5">Akses materi & jadwal mendatang tidak tersedia.</p>
            </div>
            <a
              href={`https://wa.me/${waNumber}?text=Halo Admin EduKazia, saya ingin memperpanjang paket untuk ${activeChild.profile.full_name}`}
              target="_blank" rel="noopener noreferrer"
              className="text-[11px] font-bold bg-red-500 text-white px-3 py-1.5 rounded-lg whitespace-nowrap flex-shrink-0"
            >
              Perpanjang
            </a>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
