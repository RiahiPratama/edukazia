import { createClient } from '@/lib/supabase/server'
import LandingPage from '@/components/landing/LandingPage'
import './landing.css'

export const metadata = {
  title: 'EduKazia — Bimbingan Belajar Online Bahasa & Matematika',
  description: 'Kursus Bahasa Inggris, Arab, Mandarin, dan Matematika via Zoom. Kelas Reguler, Semi Privat, dan Privat 1-on-1. Laporan perkembangan tiap sesi untuk orang tua.',
}

export default async function Home() {
  const supabase = await createClient()

  // Cek apakah user sudah login
  const { data: { user } } = await supabase.auth.getUser()

  // Tentukan portal URL sesuai role (untuk tombol "Buka Portal")
  let portalUrl: string | null = null
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const routes: Record<string, string> = {
      admin:   '/admin',
      tutor:   '/tutor',
      student: '/siswa',
    }
    portalUrl = routes[profile?.role ?? 'student']
  }

  // Fetch testimonial dari database (kalau ada)
  const { data: testimonials } = await supabase
    .from('landing_testimonials')
    .select('id, name, role_label, course_tag, quote')
    .eq('is_visible', true)
    .order('sort_order')

  // Fetch FAQ dari database (kalau ada)
  const { data: faqs } = await supabase
    .from('landing_faqs')
    .select('id, question, answer')
    .eq('is_visible', true)
    .order('sort_order')

  return (
    <LandingPage
      isLoggedIn={!!user}
      portalUrl={portalUrl}
      testimonials={testimonials ?? []}
      faqs={faqs ?? []}
      waNumber={process.env.NEXT_PUBLIC_WA_NUMBER ?? '6281234567890'}
    />
  )
}
