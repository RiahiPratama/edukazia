import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ─── Mapping role → route yang diizinkan ──────────────────
const ROLE_ROUTES: Record<string, string> = {
  admin:   '/admin',
  tutor:   '/tutor',
  student: '/siswa',
  parent:  '/siswa',  // ortu akses portal yang sama dengan siswa
}

// Route yang butuh login
const PROTECTED_PREFIXES = ['/admin', '/tutor', '/siswa']

// Route yang tidak boleh diakses user yang sudah login
const AUTH_ONLY_ROUTES = ['/login']

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session
  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // ── Redirect /admin → /admin/dashboard ──
  if (pathname === '/admin') {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/admin/dashboard'
    return NextResponse.redirect(redirectUrl)
  }

  // ── Redirect /tutor → /tutor/dashboard ──
  if (pathname === '/tutor' || pathname === '/tutor/') {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/tutor/dashboard'
    return NextResponse.redirect(redirectUrl)
  }

  // ── Redirect /siswa → /siswa/dashboard ──
  if (pathname === '/siswa' || pathname === '/siswa/') {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/siswa/dashboard'
    return NextResponse.redirect(redirectUrl)
  }

  // ── Jika belum login dan akses protected route → ke /login ──
  const isProtected = PROTECTED_PREFIXES.some(p => pathname.startsWith(p))
  if (!user && isProtected) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // ── Jika sudah login dan buka /login → redirect ke portal sesuai role ──
  if (user && AUTH_ONLY_ROUTES.includes(pathname)) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = profile?.role ?? 'student'
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = ROLE_ROUTES[role] ?? '/siswa'
    return NextResponse.redirect(redirectUrl)
  }

  // ── Cek akses role ke route yang dituju ──
  if (user && isProtected) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = profile?.role ?? 'student'
    const allowedPrefix = ROLE_ROUTES[role]

    // Jika akses route role lain → redirect ke portal sendiri
    if (!pathname.startsWith(allowedPrefix)) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = allowedPrefix
      return NextResponse.redirect(redirectUrl)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
