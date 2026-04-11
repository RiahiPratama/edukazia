'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AutoActivityTracker() {
  const pathname = usePathname()
  const lastPath = useRef('')
  const supabase = createClient()
  const [userInfo, setUserInfo] = useState<{ id: string; role: string } | null>(null)

  // Fetch user info sekali saat mount
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('role').eq('id', user.id).single()
        .then(({ data }) => {
          setUserInfo({ id: user.id, role: data?.role ?? 'student' })
        })
    })
  }, [supabase])

  // Track setiap pathname berubah
  useEffect(() => {
    if (!userInfo) return
    if (pathname === lastPath.current) return
    lastPath.current = pathname

    supabase.from('user_activity').insert({
      user_id: userInfo.id,
      user_role: userInfo.role,
      page: pathname,
      action: 'page_view',
      metadata: {
        ua: navigator.userAgent,
        w: window.innerWidth,
      },
    }).then(() => {})
  }, [pathname, userInfo, supabase])

  return null
}
