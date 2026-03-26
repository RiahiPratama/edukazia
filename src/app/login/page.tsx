'use client'

import { Suspense } from 'react'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Tab = 'email' | 'phone'
type Mode = 'login' | 'forgot'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [tab, setTab] = useState<Tab>('email')
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [phonePassword, setPhonePassword] = useState('')
  const [phoneStep, setPhoneStep] = useState<'input' | 'password'>('input')
  const [foundEmail, setFoundEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ text: string; err: boolean } | null>(null)

  async function redirectByRole() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    const routes: Record<string, string> = {
      admin: '/admin', tutor: '/tutor', student: '/siswa', parent: '/ortu/dashboard'
    }
    const role = profile?.role ?? 'student'
    const redirect = searchParams.get('redirect')
    router.push(redirect?.startsWith(routes[role]) ? redirect : routes[role])
  }

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) { setMsg({ text: 'Email dan password wajib diisi.', err: true }); return }
    setLoading(true); setMsg(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setMsg({ text: error.message.includes('Invalid') ? 'Email atau password salah.' : error.message, err: true })
      setLoading(false); return
    }
    setMsg({ text: 'Login berhasil! Membuka portal...', err: false })
    await redirectByRole()
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!email) { setMsg({ text: 'Masukkan email kamu.', err: true }); return }
    setLoading(true); setMsg(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)
    if (error) {
      setMsg({ text: 'Gagal mengirim email: ' + error.message, err: true }); return
    }
    setMsg({ text: 'Link reset password sudah dikirim! Cek inbox email kamu.', err: false })
  }

  // Cari email dari nomor HP via API server (bypass RLS, normalisasi format)
  async function handleFindEmail(e: React.FormEvent) {
    e.preventDefault()
    const raw = phone.replace(/\D/g, '')
    if (raw.length < 8) { setMsg({ text: 'Nomor HP tidak valid.', err: true }); return }
    setLoading(true); setMsg(null)

    const res  = await fetch('/api/auth/phone-lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: raw }),
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok || !data.email) {
      setMsg({ text: data.error ?? 'Nomor HP tidak terdaftar di sistem EduKazia.', err: true })
      return
    }

    setFoundEmail(data.email)
    setPhoneStep('password')
    setMsg(null)
  }

  // Login dengan email yang ditemukan + password yang diinput
  async function handlePhoneLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!phonePassword) { setMsg({ text: 'Masukkan password akun Anda.', err: true }); return }
    setLoading(true); setMsg(null)

    const { error } = await supabase.auth.signInWithPassword({
      email: foundEmail,
      password: phonePassword,
    })

    if (error) {
      setMsg({ text: 'Password salah. Coba lagi atau gunakan tab Email.', err: true })
      setLoading(false); return
    }
    setMsg({ text: 'Login berhasil! Membuka portal...', err: false })
    await redirectByRole()
  }

  function switchMode(m: Mode) {
    setMode(m); setMsg(null); setEmail(''); setPassword('')
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl w-full max-w-[400px] overflow-hidden border border-[#E5E3FF]">
      <div className="bg-gradient-to-br from-[#3D34C4] to-[#5C4FE5] px-7 py-6 text-center">
        <h1 className="font-bold text-2xl text-white">edu<span className="text-[#FFCC00]">kazia</span></h1>
        <p className="text-xs text-white/70 tracking-widest uppercase mt-1">
          {mode === 'forgot' ? 'Reset Password' : 'Portal Pengguna'}
        </p>
      </div>

      <div className="p-7">

        {/* ── Mode: Lupa Password ── */}
        {mode === 'forgot' && (
          <>
            <div className="text-center mb-5">
              <p className="text-sm text-[#4A4580]">
                Masukkan email akun kamu. Kami akan kirimkan link untuk membuat password baru.
              </p>
            </div>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="nama@email.com"
                  className="w-full px-3.5 py-2.5 border border-[#E5E3FF] rounded-xl text-sm bg-[#F7F6FF] text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] focus:bg-white transition"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-[#5C4FE5] hover:bg-[#3D34C4] text-white font-bold rounded-xl text-sm transition disabled:opacity-60 mt-2">
                {loading ? 'Mengirim...' : 'Kirim Link Reset'}
              </button>
            </form>
            {msg && (
              <div className={`mt-4 px-4 py-3 rounded-xl text-sm font-semibold text-center ${msg.err
                ? 'bg-red-50 text-red-600 border border-red-200'
                : 'bg-purple-50 text-purple-700 border border-purple-200'}`}>
                {msg.text}
              </div>
            )}
            <div className="mt-5 text-center">
              <button
                onClick={() => switchMode('login')}
                className="text-[#5C4FE5] text-sm font-semibold hover:underline">
                ← Kembali ke login
              </button>
            </div>
          </>
        )}

        {/* ── Mode: Login ── */}
        {mode === 'login' && (
          <>
            <div className="flex bg-[#F0EFFF] rounded-full p-1 mb-5">
              {(['email', 'phone'] as Tab[]).map(t => (
                <button key={t} onClick={() => { setTab(t); setMsg(null); setPhoneStep('input'); setPhone(''); setPhonePassword(''); setFoundEmail('') }}
                  className={`flex-1 py-2 text-sm font-semibold rounded-full transition-all ${tab === t ? 'bg-[#5C4FE5] text-white shadow' : 'text-[#4A4580]'}`}>
                  {t === 'email' ? 'Email' : 'Nomor HP'}
                </button>
              ))}
            </div>

            {tab === 'email' && (
              <form onSubmit={handleEmailLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="nama@email.com"
                    className="w-full px-3.5 py-2.5 border border-[#E5E3FF] rounded-xl text-sm bg-[#F7F6FF] text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] focus:bg-white transition" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide">Password</label>
                    <button
                      type="button"
                      onClick={() => switchMode('forgot')}
                      className="text-xs text-[#5C4FE5] font-semibold hover:underline">
                      Lupa password?
                    </button>
                  </div>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 border border-[#E5E3FF] rounded-xl text-sm bg-[#F7F6FF] text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] focus:bg-white transition" />
                </div>
                <button type="submit" disabled={loading}
                  className="w-full py-3 bg-[#5C4FE5] hover:bg-[#3D34C4] text-white font-bold rounded-xl text-sm transition disabled:opacity-60 mt-2">
                  {loading ? 'Memverifikasi...' : 'Masuk ke Portal'}
                </button>
              </form>
            )}

            {/* Step 1: Input nomor HP */}
            {tab === 'phone' && phoneStep === 'input' && (
              <form onSubmit={handleFindEmail} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">Nomor HP terdaftar</label>
                  <div className="flex gap-2">
                    <span className="px-3 py-2.5 border border-[#E5E3FF] rounded-xl text-sm font-bold text-[#4A4580] bg-[#F0EFFF]">+62</span>
                    <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                      placeholder="812 3456 7890"
                      className="flex-1 px-3.5 py-2.5 border border-[#E5E3FF] rounded-xl text-sm bg-[#F7F6FF] text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] focus:bg-white transition" />
                  </div>
                  <p className="text-xs text-[#7B78A8] mt-1.5">Gunakan nomor yang didaftarkan admin EduKazia</p>
                </div>
                <button type="submit" disabled={loading}
                  className="w-full py-3 bg-[#5C4FE5] hover:bg-[#3D34C4] text-white font-bold rounded-xl text-sm transition disabled:opacity-60">
                  {loading ? 'Mencari akun...' : 'Lanjutkan'}
                </button>
              </form>
            )}

            {/* Step 2: Input password setelah nomor HP ditemukan */}
            {tab === 'phone' && phoneStep === 'password' && (
              <form onSubmit={handlePhoneLogin} className="space-y-4">
                <div className="px-4 py-3 bg-[#F0EFFF] rounded-xl border border-[#E5E3FF] text-center">
                  <p className="text-xs text-[#7B78A8]">Akun ditemukan</p>
                  <p className="text-sm font-bold text-[#5C4FE5] mt-0.5">
                    {foundEmail.replace(/(.{2}).*(@.*)/, '$1••••$2')}
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">Password</label>
                  <input
                    type="password"
                    value={phonePassword}
                    onChange={e => setPhonePassword(e.target.value)}
                    placeholder="••••••••"
                    autoFocus
                    className="w-full px-3.5 py-2.5 border border-[#E5E3FF] rounded-xl text-sm bg-[#F7F6FF] text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] focus:bg-white transition"
                  />
                </div>
                <button type="submit" disabled={loading}
                  className="w-full py-3 bg-[#5C4FE5] hover:bg-[#3D34C4] text-white font-bold rounded-xl text-sm transition disabled:opacity-60">
                  {loading ? 'Memverifikasi...' : 'Masuk ke Portal'}
                </button>
                <button type="button"
                  onClick={() => { setPhoneStep('input'); setPhonePassword(''); setFoundEmail(''); setMsg(null) }}
                  className="w-full text-xs text-[#7B78A8] hover:text-[#5C4FE5] transition">
                  ← Ganti nomor HP
                </button>
              </form>
            )}

            {msg && (
              <div className={`mt-4 px-4 py-3 rounded-xl text-sm font-semibold text-center ${msg.err
                ? 'bg-red-50 text-red-600 border border-red-200'
                : 'bg-purple-50 text-purple-700 border border-purple-200'}`}>
                {msg.text}
              </div>
            )}
          </>
        )}
      </div>

      {mode === 'login' && (
        <div className="px-7 pb-5 text-center text-xs text-[#7B78A8] border-t border-[#E5E3FF] pt-4">
          Belum punya akun?{' '}
          <a href={`https://wa.me/${process.env.NEXT_PUBLIC_WA_NUMBER}`}
            target="_blank" rel="noopener noreferrer" className="text-[#5C4FE5] font-bold">
            Daftar via WhatsApp
          </a>
        </div>
      )}
    </div>
  )
}

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[#F7F6FF] flex items-center justify-center p-4">
      <Suspense fallback={
        <div className="text-[#7B78A8] text-sm">Memuat...</div>
      }>
        <LoginForm />
      </Suspense>
    </main>
  )
}
