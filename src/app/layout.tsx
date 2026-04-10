import type { Metadata, Viewport } from 'next'
import { Sora, Plus_Jakarta_Sans } from 'next/font/google'
import NextTopLoader from 'nextjs-toploader'
import RegisterSW from '@/components/RegisterSW'
import './globals.css'

const sora = Sora({
  variable: '--font-sora',
  subsets: ['latin'],
})

const plusJakarta = Plus_Jakarta_Sans({
  variable: '--font-plus-jakarta',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'EduKazia',
  description: 'Bimbingan Belajar Online Bahasa & Matematika',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'EduKazia',
  },
  icons: {
    icon: [
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/favicon-16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#5C4FE5',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="id">
      <body
        className={`${sora.variable} ${plusJakarta.variable} antialiased`}
        suppressHydrationWarning
      >
        <NextTopLoader color="#5C4FE5" height={3} showSpinner={false} />
        <RegisterSW />
        {children}
      </body>
    </html>
  )
}
