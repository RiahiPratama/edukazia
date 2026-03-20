'use client'

import { useRouter } from 'next/navigation'
import { X, Check } from 'lucide-react'
import { getInitials, isStudentFullyExpired } from '@/lib/siswa/helpers'
import type { Student } from '@/lib/siswa/helpers'

interface ChildSwitcherProps {
  childrenList: Student[]
  activeChild: Student | null
  onClose: () => void
}

export default function ChildSwitcher({ childrenList, activeChild, onClose }: ChildSwitcherProps) {
  const router = useRouter()

  function handleSwitch(studentId: string) {
    // Simpan active child id ke cookie/searchParam lalu refresh
    document.cookie = `active_child=${studentId}; path=/`
    router.refresh()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-2xl w-full max-w-md p-5"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[14px] font-bold text-[#1A1530]">Pilih Siswa</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-[#F7F6FF] flex items-center justify-center">
            <X size={14} className="text-[#6B6580]" />
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {childrenList.map(child => {
            const isActive = child.id === activeChild?.id
            const expired = isStudentFullyExpired(child)

            return (
              <button
                key={child.id}
                onClick={() => handleSwitch(child.id)}
                className={`
                  flex items-center gap-3 p-3 rounded-xl border text-left transition-colors
                  ${isActive ? 'border-[#5C4FE5] bg-[#EAE8FD]' : 'border-[#E5E3FF] bg-[#F7F6FF]'}
                `}
              >
                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-bold flex-shrink-0
                  ${isActive ? 'bg-[#5C4FE5] text-white' : 'bg-[#E5E3FF] text-[#5C4FE5]'}
                `}>
                  {getInitials(child.profile.full_name)}
                </div>
                <div className="flex-1">
                  <p className="text-[13px] font-600 text-[#1A1530]">{child.profile.full_name}</p>
                  <p className="text-[11px] text-[#9B97B2]">Kelas {child.grade} · {child.school}</p>
                </div>
                {expired && (
                  <span className="text-[10px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                    Expired
                  </span>
                )}
                {isActive && <Check size={16} className="text-[#5C4FE5] flex-shrink-0" />}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
