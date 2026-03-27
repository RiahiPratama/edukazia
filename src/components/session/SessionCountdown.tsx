'use client'

import { useState, useEffect } from 'react'

type Props = {
  scheduledAt: string
  showLabel?: boolean
  compact?: boolean
}

export default function SessionCountdown({ scheduledAt, showLabel = true, compact = false }: Props) {
  const [timeLeft, setTimeLeft] = useState<{
    hours: number
    minutes: number
    seconds: number
    totalMs: number
    isLive: boolean
    isFinished: boolean
  } | null>(null)

  useEffect(() => {
    function calculateTimeLeft() {
      const now = new Date()
      const sessionStart = new Date(scheduledAt)
      const sessionEnd = new Date(sessionStart.getTime() + 90 * 60 * 1000) // 90 menit = 1.5 jam

      const diffMs = sessionStart.getTime() - now.getTime()
      
      // Sudah selesai (>90 menit setelah mulai)
      if (now > sessionEnd) {
        return {
          hours: 0,
          minutes: 0,
          seconds: 0,
          totalMs: 0,
          isLive: false,
          isFinished: true,
        }
      }

      // Sedang berlangsung (antara start dan end)
      if (now >= sessionStart && now <= sessionEnd) {
        return {
          hours: 0,
          minutes: 0,
          seconds: 0,
          totalMs: 0,
          isLive: true,
          isFinished: false,
        }
      }

      // Belum mulai
      const hours = Math.floor(diffMs / (1000 * 60 * 60))
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diffMs % (1000 * 60)) / 1000)

      return {
        hours,
        minutes,
        seconds,
        totalMs: diffMs,
        isLive: false,
        isFinished: false,
      }
    }

    // Initial calculation
    setTimeLeft(calculateTimeLeft())

    // Update every second
    const interval = setInterval(() => {
      setTimeLeft(calculateTimeLeft())
    }, 1000)

    return () => clearInterval(interval)
  }, [scheduledAt])

  if (!timeLeft) return null

  // Sudah selesai - don't show countdown
  if (timeLeft.isFinished) return null

  // Sedang berlangsung
  if (timeLeft.isLive) {
    if (compact) {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-green-50 border border-green-200">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[11px] font-bold text-green-700">Berlangsung</span>
        </div>
      )
    }

    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-50 border border-green-200">
        <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
        <div className="flex-1">
          <p className="text-[12px] font-bold text-green-700">🟢 Sedang Berlangsung</p>
          {showLabel && (
            <p className="text-[10px] text-green-600 mt-0.5">Sesi sedang berjalan</p>
          )}
        </div>
      </div>
    )
  }

  // Hanya tampil kalau <3 jam sebelum mulai
  const threeHoursInMs = 180 * 60 * 1000
  if (timeLeft.totalMs > threeHoursInMs) return null

  const h = String(timeLeft.hours).padStart(2, '0')
  const m = String(timeLeft.minutes).padStart(2, '0')
  const s = String(timeLeft.seconds).padStart(2, '0')

  if (compact) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FEF3E2] border border-[#F5C800]">
        <span className="text-[11px]">🔔</span>
        <span className="text-[11px] font-bold text-[#92400E] tabular-nums">
          {h}:{m}:{s}
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#FEF3E2] border border-[#F5C800]">
      <span className="text-lg">🔔</span>
      <div className="flex-1">
        <p className="text-[12px] font-bold text-[#92400E] tabular-nums">
          {h}:{m}:{s}
        </p>
        {showLabel && (
          <p className="text-[10px] text-[#854F0B] mt-0.5">
            Dimulai dalam {timeLeft.hours > 0 && `${timeLeft.hours} jam `}
            {timeLeft.minutes} menit
          </p>
        )}
      </div>
    </div>
  )
}
