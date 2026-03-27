'use client'

import { ExternalLink } from 'lucide-react'
import SessionCountdown from './SessionCountdown'
import SessionStatus from './SessionStatus'

type Props = {
  session: {
    id: string
    scheduled_at: string
    status: string
    zoom_link?: string | null
    class_groups?: {
      label?: string
      courses?: { name?: string; color?: string | null }
      tutors?: { profiles?: { full_name?: string } }
      profiles?: { full_name?: string } // Alternate tutor structure
    } | null
  }
  studentId?: string // Optional, for attendance status
  compact?: boolean
  showCountdown?: boolean
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Jayapura',
  })
}

export default function TodaySessionCard({ session, studentId, compact = false, showCountdown = true }: Props) {
  const cg = session.class_groups
  const course = cg?.courses
  const tutorName = cg?.tutors?.profiles?.full_name ?? cg?.profiles?.full_name ?? '—'
  const courseColor = course?.color ?? '#5C4FE5'
  const zoomLink = session.zoom_link ?? cg?.zoom_link

  if (compact) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-xl bg-[#F7F6FF] border border-[#F0EFFF]">
        <div className="w-14 flex-shrink-0 text-center">
          <div className="text-sm font-black text-[#5C4FE5]">{fmtTime(session.scheduled_at)}</div>
          <div className="text-[10px] text-[#7B78A8] font-semibold">WIT</div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-[#1A1640] truncate">{cg?.label ?? '—'}</div>
          <div className="text-xs text-[#7B78A8] mt-0.5">{course?.name ?? '—'}</div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {showCountdown && (
            <SessionCountdown scheduledAt={session.scheduled_at} showLabel={false} compact />
          )}
          {studentId && (
            <SessionStatus
              sessionId={session.id}
              studentId={studentId}
              sessionStatus={session.status}
              scheduledAt={session.scheduled_at}
              compact
            />
          )}
          {zoomLink && (
            <a
              href={zoomLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg font-semibold hover:bg-blue-100 transition"
            >
              Zoom
            </a>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-[#E5E3FF] rounded-2xl overflow-hidden">
      {/* Header dengan course color */}
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ backgroundColor: `${courseColor}15` }}
      >
        <div>
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: courseColor }}
            />
            <span className="text-sm font-bold text-[#1A1640]">{cg?.label ?? '—'}</span>
          </div>
          <p className="text-xs text-[#7B78A8] mt-0.5">
            {fmtTime(session.scheduled_at)} WIT · {course?.name ?? '—'}
          </p>
        </div>
        {zoomLink && (
          <a
            href={zoomLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-semibold hover:bg-blue-100 transition"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
            </svg>
            Buka Zoom
          </a>
        )}
      </div>

      {/* Content */}
      <div className="px-4 py-3 space-y-2">
        <div className="text-xs text-[#7B78A8]">
          <span className="font-semibold">Tutor:</span> {tutorName}
        </div>

        {/* Countdown or Status */}
        {showCountdown && (
          <SessionCountdown scheduledAt={session.scheduled_at} showLabel />
        )}

        {studentId && (
          <SessionStatus
            sessionId={session.id}
            studentId={studentId}
            sessionStatus={session.status}
            scheduledAt={session.scheduled_at}
          />
        )}
      </div>
    </div>
  )
}
