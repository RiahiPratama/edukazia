'use client'

import { useState } from 'react'
import { Bell, MoreVertical } from 'lucide-react'
import ChildSwitcher from './ChildSwitcher'
import { getInitials } from '@/lib/siswa/helpers'
import type { Student } from '@/lib/siswa/helpers'

interface TopBarProps {
  profile: { id: string; full_name: string; role: string; avatar_url: string | null }
  childrenList: Student[]
  activeChild: Student | null
  isParent: boolean
}

export default function TopBar({ profile, childrenList, activeChild, isParent }: TopBarProps) {
  const [showSwitcher, setShowSwitcher] = useState(false)

  // Ortu dengan lebih dari 1 anak → tampilkan child switcher
  const canSwitch = isParent && childrenList.length > 1

  const witTime = new Date().toLocaleTimeString('id-ID', {
    timeZone: 'Asia/Jayapura',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  // Label chip: ortu tampilkan nama + "(Ortu)", siswa tampilkan nama saja
  const chipLabel = isParent
    ? `${profile.full_name.split(' ')[0]} (Ortu)`
    : profile.full_name.split(' ')[0]

  return (
    <>
      <header className="bg-white border-b border-[#E5E3FF] px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <div>
          <h1 className="text-[15px] font-bold text-[#1A1530] leading-tight">
            EduKazia
          </h1>
          <p className="text-[11px] text-[#9B97B2] mt-0.5">
            {activeChild
              ? `${activeChild.profile.full_name} · WIT (UTC+9)`
              : 'WIT (UTC+9)'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* WIT badge */}
          <span className="text-[11px] text-[#6B6580] bg-[#F7F6FF] border border-[#E5E3FF] rounded-full px-3 py-1 font-medium">
            WIT {witTime}
          </span>

          {/* Notif */}
          <button className="relative w-9 h-9 rounded-full border border-[#E5E3FF] bg-white flex items-center justify-center">
            <Bell size={15} className="text-[#6B6580]" />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-red-500 border-[1.5px] border-white" />
          </button>

          {/* User chip */}
          <button
            onClick={() => canSwitch && setShowSwitcher(true)}
            className={`flex items-center gap-2 bg-[#5C4FE5] rounded-full px-3 py-1.5 ${canSwitch ? 'cursor-pointer' : 'cursor-default'}`}
          >
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-[9px] font-bold text-white">
              {getInitials(profile.full_name)}
            </div>
            <span className="text-[11px] font-semibold text-white leading-none">
              {chipLabel}
            </span>
            {/* Chevron hanya muncul jika bisa switch */}
            {canSwitch && (
              <span className="text-white/70 text-[10px]">▾</span>
            )}
          </button>

          {/* Menu */}
          <button className="w-8 h-8 rounded-lg bg-[#1A1530] flex items-center justify-center">
            <MoreVertical size={14} className="text-white" />
          </button>
        </div>
      </header>

      {/* Child Switcher — hanya untuk ortu dengan 2+ anak */}
      {showSwitcher && (
        <ChildSwitcher
          childrenList={childrenList}
          activeChild={activeChild}
          onClose={() => setShowSwitcher(false)}
        />
      )}
    </>
  )
}
