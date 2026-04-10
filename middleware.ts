import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PROTECTED_PREFIXES = ['/admin', '/tutor', '/siswa', '/ortu']
const AUTH_ONLY_ROUTES   = ['/login']

// Bot User-Agent patterns — skip Supabase queries for these
const BOT_PATTERNS = /bot|crawler|spider|crawling|googlebot|bingbot|yandex|baidu|slurp|duckduck|facebookexternalhit|twitterbot|linkedinbot|semrush|ahref|mj12bot|dotbot|petalbot|bytespider/i

export async function middleware(request: NextRequest) {
  // ── Early return untuk bot/crawler — hemat CPU ──
  const userAgent = request.headers.get('user-agent') ?? ''
  if (BOT_PATTERNS.test(userAgent)) {
    return new NextResponse('Not allowed', { status: 403 })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options))
        },
      },
    }
  )

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

  // ── Helper: get role + cek apakah punya parent_profile_id ──
  async function getPortalInfo() {
    if (!user) return null

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: profile } = await supabaseAdmin
      .from('profiles').select('role').eq('id', user.id).single()

    const role = profile?.role ?? 'student'

    // Cek apakah user ini punya parent_profile_id di tabel students
    // (berlaku untuk student "Diri Sendiri" dan parent)
    const { data: asParent } = await supabaseAdmin
      .from('students').select('id')
      .eq('parent_profile_id', user.id)
      .limit(1)

    const isParentOrSelf = (asParent ?? []).length > 0

    return { role, isParentOrSelf }
  }

  // ── Sudah login + buka /login → redirect ke portal ──
  if (user && AUTH_ONLY_ROUTES.includes(pathname)) {
    const info = await getPortalInfo()
    if (!info) return supabaseResponse

    const u = request.nextUrl.clone()

    if (info.role === 'admin') {
      u.pathname = '/admin/dashboard'
    } else if (info.role === 'tutor') {
      u.pathname = '/tutor/dashboard'
    } else if (info.role === 'parent' || info.isParentOrSelf) {
      // parent role ATAU student yang punya parent_profile_id → /ortu
      u.pathname = '/ortu/dashboard'
    } else {
      u.pathname = '/siswa/dashboard'
    }

    return NextResponse.redirect(u)
  }

  // ── Cek akses role ke route yang dituju ──
  if (user && isProtected) {
    const info = await getPortalInfo()
    if (!info) return supabaseResponse

    const { role, isParentOrSelf } = info

    // Parent tidak boleh akses /siswa/*
    if (role === 'parent' && pathname.startsWith('/siswa')) {
      const u = request.nextUrl.clone()
      u.pathname = '/ortu/dashboard'
      return NextResponse.redirect(u)
    }

    // Student "Diri Sendiri" tidak boleh akses /siswa/* → ke /ortu
    if (role === 'student' && isParentOrSelf && pathname.startsWith('/siswa')) {
      const u = request.nextUrl.clone()
      u.pathname = '/ortu/dashboard'
      return NextResponse.redirect(u)
    }

    // Student/tutor/admin tidak boleh akses /ortu/*
    if (role !== 'parent' && !isParentOrSelf && pathname.startsWith('/ortu')) {
      const u = request.nextUrl.clone()
      if (role === 'admin') u.pathname = '/admin/dashboard'
      else if (role === 'tutor') u.pathname = '/tutor/dashboard'
      else u.pathname = '/siswa/dashboard'
      return NextResponse.redirect(u)
    }

    // Admin tidak boleh akses /tutor/* atau /siswa/* atau /ortu/*
    if (role === 'admin' && !pathname.startsWith('/admin')) {
      const u = request.nextUrl.clone()
      u.pathname = '/admin/dashboard'
      return NextResponse.redirect(u)
    }

    // Tutor tidak boleh akses /admin/* atau /siswa/* atau /ortu/*
    if (role === 'tutor' && !pathname.startsWith('/tutor')) {
      const u = request.nextUrl.clone()
      u.pathname = '/tutor/dashboard'
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
