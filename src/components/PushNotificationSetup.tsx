'use client'

import { useEffect } from 'react'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export default function PushNotificationSetup() {
  useEffect(() => {
    async function setupPush() {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
      if (!VAPID_PUBLIC_KEY) return

      try {
        // Register service worker
        const reg = await navigator.serviceWorker.register('/sw.js')

        // Cek permission
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') return

        // Cek apakah sudah subscribe
        const existing = await reg.pushManager.getSubscription()
        if (existing) return // Sudah subscribe, tidak perlu subscribe lagi

        // Subscribe baru
        const subscription = await reg.pushManager.subscribe({
          userVisibleOnly:      true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        })

        // Kirim ke server
        await fetch('/api/push/subscribe', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ subscription }),
        })

      } catch (err) {
        console.error('Push setup error:', err)
      }
    }

    // Delay sedikit agar tidak ganggu UX saat pertama buka
    const timer = setTimeout(setupPush, 3000)
    return () => clearTimeout(timer)
  }, [])

  return null // Komponen invisible
}
