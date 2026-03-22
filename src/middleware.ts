import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ─── Mapping role → route yang diizinkan ──────────────────
const ROLE_ROUTES: Record<string, string> = {
  admin:   '/admin',
  tutor:   '/tutor',
  student: '/siswa',
  parent:  '/ortu/dashboard',  // ← ortu sekarang ke portal ortu
}

// Route yang butuh login
const PROTECTED_PREFIXES = ['/admin', '/tutor', '/siswa', '/ortu']

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

  // ── Redirects root portal ──
  if (pathname === '/admin') {
    const u = request.nextUrl.clone(); u.pathname = '/admin/dashboard'
    return NextResponse.redirect(u)
  }
  if (pathname === '/tutor' || pathname === '/tutor/') {
    const u = request.nextUrl.clone(); u.pathname = '/tutor/dashboard'
    return NextResponse.redirect(u)
  }
  if (pathname === '/siswa' || pathname === '/siswa/') {
    const u = request.nextUrl.clone(); u.pathname = '/siswa/dashboard'
    return NextResponse.redirect(u)
  }
  if (pathname === '/ortu' || pathname === '/ortu/') {
    const u = request.nextUrl.clone(); u.pathname = '/ortu/dashboard'
    return NextResponse.redirect(u)
  }

  // ── Belum login + protected → /login ──
  const isProtected = PROTECTED_PREFIXES.some(p => pathname.startsWith(p))
  if (!user && isProtected) {
    const u = request.nextUrl.clone()
    u.pathname = '/login'
    u.searchParams.set('redirect', pathname)
    return NextResponse.redirect(u)
  }

  // ── Sudah login + buka /login → redirect ke portal ──
  if (user && AUTH_ONLY_ROUTES.includes(pathname)) {
    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    const role = profile?.role ?? 'student'
    const u = request.nextUrl.clone()
    u.pathname = ROLE_ROUTES[role] ?? '/siswa/dashboard'
    return NextResponse.redirect(u)
  }

  // ── Cek akses role ke route yang dituju ──
  if (user && isProtected) {
    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    const role = profile?.role ?? 'student'

    // Parent tidak boleh akses /siswa/* — redirect ke /ortu/dashboard
    if (role === 'parent' && pathname.startsWith('/siswa')) {
      const u = request.nextUrl.clone()
      u.pathname = '/ortu/dashboard'
      return NextResponse.redirect(u)
    }

    // Student/tutor/admin tidak boleh akses /ortu/*
    if (role !== 'parent' && pathname.startsWith('/ortu')) {
      const u = request.nextUrl.clone()
      u.pathname = ROLE_ROUTES[role] ?? '/siswa/dashboard'
      return NextResponse.redirect(u)
    }

    // Cek akses route role lain secara umum
    const allowedPrefix = ROLE_ROUTES[role].replace('/dashboard', '')
    const mainPrefix = allowedPrefix.split('/').slice(0, 2).join('/')
    if (!pathname.startsWith(mainPrefix)) {
      const u = request.nextUrl.clone()
      u.pathname = ROLE_ROUTES[role]
      return NextResponse.redirect(u)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
