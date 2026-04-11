import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import SiswaLayoutClient from './SiswaLayoutClient'
import AutoActivityTracker from '@/components/AutoActivityTracker'
import { getActiveChild } from '@/lib/siswa/helpers'

export default async function SiswaLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options))
          } catch {}
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role, phone, email, avatar_url')
    .eq('id', session.user.id)
    .single()

  if (!profile || !['student', 'parent'].includes(profile.role)) redirect('/login')

  const isParent = profile.role === 'parent'

  const { data: childrenList } = await supabase
    .from('students')
    .select(`
      id, grade, school, status, relation_role,
      profile:profiles!students_profile_id_fkey(id, full_name, avatar_url),
      enrollments(id, status, end_date, expired_at, status_override)
    `)
    .eq(isParent ? 'parent_profile_id' : 'profile_id', session.user.id)

  const childrenListFlat = (childrenList ?? []).map((c: any) => ({
    ...c,
    profile: Array.isArray(c.profile) ? c.profile[0] ?? null : c.profile,
  }))

  // FIX: baca cookie active_child untuk menentukan anak yang aktif
  const activeChildCookie = cookieStore.get('active_child')?.value
  let activeChild = null

  if (activeChildCookie) {
    // Cari anak berdasarkan cookie
    activeChild = childrenListFlat.find((c: any) => c.id === activeChildCookie) ?? null
  }

  // Fallback ke getActiveChild jika cookie tidak ada atau tidak valid
  if (!activeChild) {
    activeChild = getActiveChild(childrenListFlat)
  }

  return (
    <SiswaLayoutClient
      profile={profile}
      childrenList={childrenListFlat}
      activeChild={activeChild}
      isParent={isParent}
    >
      <AutoActivityTracker />
      {children}
    </SiswaLayoutClient>
  )
}
