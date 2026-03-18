cat > src / app / admin / layout.tsx << 'EOF'
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

  return (
    <div className="flex h-screen overflow-hidden bg-[#F7F6FF]">

      {/* ── Sidebar Desktop ── */}
      <aside className="hidden lg:flex flex-col w-64 flex-shrink-0 h-screen bg-white border-r border-[#E5E3FF] overflow-y-auto">
        <div className="h-16 flex items-center px-6 border-b border-[#E5E3FF] flex-shrink-0">
          <Link href="/admin/dashboard" className="flex items-center gap-2">
            <span className="font-black text-xl" style={{ fontFamily: 'Sora