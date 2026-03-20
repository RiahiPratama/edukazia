'use client'

import { AlertCircle } from 'lucide-react'
import { isStudentFullyExpired } from '@/lib/siswa/helpers'
import type { Student } from '@/lib/siswa/helpers'

interface ExpiredBannerProps {
  activeChild: Student | null
}

export default function ExpiredBanner({ activeChild }: ExpiredBannerProps) {
  if (!activeChild || !isStudentFullyExpired(activeChild)) return null

  const waNumber = process.env.NEXT_PUBLIC_WA_NUMBER ?? ''
  const waLink = `https://wa.me/${waNumber}?text=Halo Admin EduKazia, saya ingin memperpanjang paket belajar untuk ${activeChild.profile.full_name}`

  return (
    <div className="mx-4 mt-3 mb-1 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3">
      <AlertCircle size={18} className="text-red-500 flex-shrink-0" />
      <div className="flex-1">
        <p className="text-[12px] font-bold text-red-700">Paket Belajar Berakhir</p>
        <p className="text-[11px] text-red-500 mt-0.5">
          Akses materi & jadwal mendatang tidak tersedia.
          Histori laporan tetap bisa dibaca.
        </p>
      </div>
      <a
        href={waLink}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[11px] font-bold bg-red-500 text-white px-3 py-1.5 rounded-lg whitespace-nowrap flex-shrink-0"
      >
        Perpanjang
      </a>
    </div>
  )
}
