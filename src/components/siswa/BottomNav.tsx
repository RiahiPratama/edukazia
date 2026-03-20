'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, CalendarDays, FileText, BookOpen, User } from 'lucide-react'

const navItems = [
  { href: '/siswa/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/siswa/jadwal',    label: 'Jadwal',     icon: CalendarDays },
  { href: '/siswa/laporan',   label: 'Laporan',    icon: FileText },
  { href: '/siswa/materi',    label: 'Materi',     icon: BookOpen },
  { href: '/siswa/profil',    label: 'Profil',     icon: User },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E3FF] z-40 safe-area-pb">
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-colors"
            >
              <div className={`
                w-8 h-8 rounded-xl flex items-center justify-center transition-colors
                ${active ? 'bg-[#EAE8FD]' : ''}
              `}>
                <Icon
                  size={18}
                  className={active ? 'text-[#5C4FE5]' : 'text-[#9B97B2]'}
                  strokeWidth={active ? 2.5 : 1.8}
                />
              </div>
              <span className={`text-[10px] font-${active ? '700' : '500'} ${active ? 'text-[#5C4FE5]' : 'text-[#9B97B2]'}`}>
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
