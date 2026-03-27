'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Props = {
  sessionId: string
  studentId: string
  sessionStatus: string
  scheduledAt: string
  compact?: boolean
}

export default function SessionStatus({ 
  sessionId, 
  studentId, 
  sessionStatus, 
  scheduledAt,
  compact = false 
}: Props) {
  const [attendance, setAttendance] = useState<{
    status: string | null
    loading: boolean
  }>({ status: null, loading: true })

  useEffect(() => {
    async function fetchAttendance() {
      // Only fetch if session is completed
      if (sessionStatus !== 'completed') {
        setAttendance({ status: null, loading: false })
        return
      }

      const supabase = createClient()
      const { data } = await supabase
        .from('attendances')
        .select('status')
        .eq('session_id', sessionId)
        .eq('student_id', studentId)
        .single()

      setAttendance({
        status: data?.status ?? null,
        loading: false,
      })
    }

    fetchAttendance()
  }, [sessionId, studentId, sessionStatus])

  // Check if session is finished (>90 minutes after start)
  const now = new Date()
  const sessionStart = new Date(scheduledAt)
  const sessionEnd = new Date(sessionStart.getTime() + 90 * 60 * 1000)
  const isFinished = now > sessionEnd

  // Don't show if session not finished yet
  if (!isFinished || sessionStatus !== 'completed') return null

  if (attendance.loading) {
    return (
      <div className={`flex items-center gap-1.5 ${compact ? 'px-2 py-1' : 'px-3 py-2'} rounded-lg bg-gray-50 border border-gray-200`}>
        <div className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
        <span className={`${compact ? 'text-[10px]' : 'text-[11px]'} text-gray-500`}>Memuat...</span>
      </div>
    )
  }

  const statusConfig: Record<string, { label: string; icon: string; bg: string; border: string; text: string }> = {
    hadir: {
      label: 'Hadir',
      icon: '✓',
      bg: 'bg-green-50',
      border: 'border-green-200',
      text: 'text-green-700',
    },
    absen: {
      label: 'Absen',
      icon: '✗',
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-700',
    },
    izin: {
      label: 'Izin',
      icon: 'ℹ',
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-700',
    },
    sakit: {
      label: 'Sakit',
      icon: '+',
      bg: 'bg-orange-50',
      border: 'border-orange-200',
      text: 'text-orange-700',
    },
  }

  const config = attendance.status 
    ? statusConfig[attendance.status] 
    : {
        label: 'Belum Dicatat',
        icon: '—',
        bg: 'bg-gray-50',
        border: 'border-gray-200',
        text: 'text-gray-500',
      }

  if (compact) {
    return (
      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${config.bg} border ${config.border}`}>
        <span className={`text-[11px] font-bold ${config.text}`}>{config.icon}</span>
        <span className={`text-[10px] font-semibold ${config.text}`}>{config.label}</span>
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${config.bg} border ${config.border}`}>
      <span className={`text-[14px] font-bold ${config.text}`}>{config.icon}</span>
      <div className="flex-1">
        <p className={`text-[11px] font-bold ${config.text}`}>
          Status Kehadiran: {config.label}
        </p>
        <p className="text-[10px] text-gray-500 mt-0.5">Sesi telah selesai</p>
      </div>
    </div>
  )
}
