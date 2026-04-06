import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PROTECTED_PREFIXES = ['/admin', '/tutor', '/siswa', '/ortu']
const AUTH_ONLY_ROUTES   = ['/login']

// ✅ OPTIMIZATION: Cookie-based role cache (1 hour TTL)
const ROLE_CACHE_KEY = 'edukazia_role_cache'
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

interface RoleCacheData {
  role: string
  isParentOrSelf: boolean
  timestamp: number
}

export async function middleware(request: NextRequest) {
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

  // ✅ OPTIMIZATION: getSession() baca cookie lokal — TIDAK ada network call ke Supabase
  // getUser() = network call setiap request → boros CPU 66%
  const { data: { session: authSession } } = await supabase.auth.getSession()
  const user = authSession?.user ?? null
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

  // ✅ OPTIMIZATION: Helper get role with cookie cache + Promise.all
  async function getPortalInfo() {
    if (!user) return null

    // Try cache first
    const cached = request.cookies.get(ROLE_CACHE_KEY)?.value
    if (cached) {
      try {
        const parsed: RoleCacheData = JSON.parse(cached)
        const age = Date.now() - parsed.timestamp
        if (age < CACHE_TTL_MS) {
          // Cache hit! Return immediately (no DB query)
          return { role: parsed.role, isParentOrSelf: parsed.isParentOrSelf }
        }
      } catch {
        // Invalid cache, continue to fetch
      }
    }

    // Cache miss - fetch from DB
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // ✅ OPTIMIZATION: Combine 2 queries into Promise.all (parallel execution)
    const [profileResult, studentResult] = await Promise.all([
      supabaseAdmin.from('profiles').select('role').eq('id', user.id).single(),
      supabaseAdmin.from('students').select('id').eq('parent_profile_id', user.id).limit(1)
    ])

    const role = profileResult.data?.role ?? 'student'
    const isParentOrSelf = (studentResult.data ?? []).length > 0

    // Store in cache
    const cacheData: RoleCacheData = {
      role,
      isParentOrSelf,
      timestamp: Date.now()
    }
    
    supabaseResponse.cookies.set(ROLE_CACHE_KEY, JSON.stringify(cacheData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: CACHE_TTL_MS / 1000 // seconds
    })

    return { role, isParentOrSelf }
  }

  // ✅ OPTIMIZATION: Call getPortalInfo only ONCE, reuse result
  let portalInfo: Awaited<ReturnType<typeof getPortalInfo>> | null = null

  // ── Sudah login + buka /login → redirect ke portal ──
  if (user && AUTH_ONLY_ROUTES.includes(pathname)) {
    portalInfo = await getPortalInfo()
    if (!portalInfo) return supabaseResponse

    const u = request.nextUrl.clone()

    if (portalInfo.role === 'admin') {
      u.pathname = '/admin/dashboard'
    } else if (portalInfo.role === 'tutor') {
      u.pathname = '/tutor/dashboard'
    } else if (portalInfo.role === 'parent' || portalInfo.isParentOrSelf) {
      u.pathname = '/ortu/dashboard'
    } else {
      u.pathname = '/siswa/dashboard'
    }

    return NextResponse.redirect(u)
  }

  // ── Cek akses role ke route yang dituju ──
  if (user && isProtected) {
    // Reuse portalInfo if already fetched, otherwise fetch now
    if (!portalInfo) {
      portalInfo = await getPortalInfo()
    }
    if (!portalInfo) return supabaseResponse

    const { role, isParentOrSelf } = portalInfo

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
    // ✅ Hanya jalankan middleware untuk route yang butuh auth check
    // Static files, images, fonts, api routes → SKIP middleware
    '/login',
    '/admin/:path*',
    '/tutor/:path*',
    '/siswa/:path*',
    '/ortu/:path*',
  ],
}
