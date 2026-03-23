'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import AnnouncementBanner from './AnnouncementBanner'

type Announcement = {
  id: string
  title: string
  description: string | null
  start_date: string
  end_date: string
  priority: 'high' | 'medium' | 'low'
  is_active: boolean
}

export default function AnnouncementFetcher() {
  const supabase = createClient()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])

  useEffect(() => {
    async function fetch() {
      const todayDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jayapura' })
      const { data } = await supabase
        .from('announcements')
        .select('*')
        .eq('is_active', true)
        .lte('start_date', todayDate)
        .gte('end_date', todayDate)
        .order('priority', { ascending: true })
      setAnnouncements(data ?? [])
    }
    fetch()
  }, [])

  if (announcements.length === 0) return null

  return (
    <div className="mb-4">
      <AnnouncementBanner announcements={announcements} isAdmin={false} />
    </div>
  )
}
