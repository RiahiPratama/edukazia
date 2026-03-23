'use client'

import { useState, useEffect } from 'react'

type Announcement = {
  id: string
  title: string
  description: string | null
  start_date: string
  end_date: string
  priority: 'high' | 'medium' | 'low'
  is_active: boolean
}

type Props = {
  announcements: Announcement[]
  isAdmin?: boolean
  onDelete?: (id: string) => void
  onEdit?: (ann: Announcement) => void
}

const PRIORITY_STYLE: Record<string, { bg: string; border: string; iconBg: string; title: string; sub: string; badge: string; badgeText: string }> = {
  high: {
    bg: '#FCEBEB', border: '#F09595', iconBg: '#E24B4A',
    title: '#791F1F', sub: '#A32D2D', badge: '#F7C1C1', badgeText: '#791F1F',
  },
  medium: {
    bg: '#FAEEDA', border: '#EF9F27', iconBg: '#BA7517',
    title: '#633806', sub: '#854F0B', badge: '#FAC775', badgeText: '#633806',
  },
  low: {
    bg: '#E6F1FB', border: '#85B7EB', iconBg: '#378ADD',
    title: '#0C447C', sub: '#185FA5', badge: '#B5D4F4', badgeText: '#0C447C',
  },
}

const PRIORITY_LABEL: Record<string, string> = {
  high: 'Penting', medium: 'Liburan', low: 'Info',
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

function IconHigh() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  )
}
function IconMedium() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  )
}
function IconLow() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  )
}

export default function AnnouncementBanner({ announcements, isAdmin, onDelete, onEdit }: Props) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  const visible = announcements.filter(a => !dismissed.has(a.id))
  if (visible.length === 0) return null

  return (
    <div className="flex flex-col gap-2 mb-4">
      {visible.map(ann => {
        const s = PRIORITY_STYLE[ann.priority] ?? PRIORITY_STYLE.low
        const Icon = ann.priority === 'high' ? IconHigh : ann.priority === 'medium' ? IconMedium : IconLow
        return (
          <div key={ann.id} style={{ background: s.bg, border: `0.5px solid ${s.border}`, borderRadius: '12px', padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: s.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon/>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: s.title }}>{ann.title}</div>
              <div style={{ fontSize: '11px', color: s.sub, marginTop: '2px' }}>
                {fmtDate(ann.start_date)} – {fmtDate(ann.end_date)}
                {ann.description && ` · ${ann.description}`}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '999px', background: s.badge, color: s.badgeText }}>
                {PRIORITY_LABEL[ann.priority]}
              </span>
              {isAdmin && onEdit && (
                <button onClick={() => onEdit(ann)}
                  style={{ width: '24px', height: '24px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '0.5px solid rgba(0,0,0,0.1)', background: 'white', cursor: 'pointer' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
              )}
              {isAdmin && onDelete ? (
                <button onClick={() => onDelete(ann.id)}
                  style={{ width: '24px', height: '24px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '0.5px solid rgba(0,0,0,0.1)', background: 'white', cursor: 'pointer' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#E24B4A" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                  </svg>
                </button>
              ) : (
                <button onClick={() => setDismissed(prev => new Set([...prev, ann.id]))}
                  style={{ width: '24px', height: '24px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '0.5px solid rgba(0,0,0,0.1)', background: 'white', cursor: 'pointer' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
