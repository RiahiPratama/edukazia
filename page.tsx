'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Tab = 'email' | 'phone'
type PhoneStep = 'input' | 'otp'

const ROLE_ROUTES: Record<string, string> = {
  admin:   '/admin',
  tutor:   '/tutor',
  student: '/siswa',
}

export default function LoginPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const supabase     = createClient()

  const [tab, setTab]         = useState<Tab>('email')
  const [phoneStep, setPhoneStep] = useState<PhoneStep>('input')

  // Email state
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')

  // Phone state
  const [phone, setPhone]     = useState('')
  const [otp, setOtp]         = useState(['', '', '', '', '', ''])

  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'error' | 'success' } | null>(null)

  // ── Redirect sesuai role setelah login berhasil ──
  async function redirectByRole() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = profile?.role ?? 'student'
    const redirect = searchParams.get('redirect')

    // Pastikan redirect URL sesuai role (keamanan)
    if (redirect && redirect.startsWith(ROLE_ROUTES[role])) {
      router.push(redirect)
    } else {
      router.push(ROLE_ROUTES[role])
    }
  }

  // ── Login Email ──
  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) {
      setMessage({ text: 'Email dan password wajib diisi.', type: 'error' })
      return
    }
    setLoading(true)
    setMessage(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setMessage({
        text: error.message.includes('Invalid login credentials')
          ? 'Email atau password salah.'
          : 'Gagal masuk: ' + error.message,
        type: 'error',
      })
      setLoading(false)
      return
    }

    setMessage({ text: 'Login berhasil! Membuka portal...', type: 'success' })
    await redirectByRole()
  }

  // ── Kirim OTP ──
  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault()
    const raw = phone.replace(/\D/g, '')
    if (!raw || raw.length < 9) {
      setMessage({ text: 'Masukkan nomor HP yang valid.', type: 'error' })
      return
    }
    setLoading(true)
    setMessage(null)

    const fullPhone = '+62' + raw
    const { error } = await supabase.auth.signInWithOtp({ phone: fullPhone })

    setLoading(false)
    if (error) {
      setMessage({ text: 'Gagal mengirim OTP: ' + error.message, type: 'error' })
      return
    }

    setPhoneStep('otp')
    setMessage(null)
  }

  // ── Verifikasi OTP ──
  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault()
    const code = otp.join('')
    if (code.length < 6) {
      setMessage({ text: 'Masukkan 6 digit kode OTP.', type: 'error' })
      return
    }
    setLoading(true)
    setMessage(null)

    const fullPhone = '+62' + phone.replace(/\D/g, '')
    const { error } = await supabase.auth.verifyOtp({
      phone: fullPhone,
      token: code,
      type: 'sms',
    })

    if (error) {
      setMessage({ text: 'Kode salah atau kadaluwarsa. Coba lagi.', type: 'error' })
      setLoading(false)
      return
    }

    setMessage({ text: 'Berhasil! Membuka portal...', type: 'success' })
    await redirectByRole()
  }

  // ── OTP input handler: auto-advance ──
  function handleOtpChange(value: string, index: number) {
    const digit = value.replace(/\D/g, '').slice(-1)
    const next  = [...otp]
    next[index] = digit
    setOtp(next)

    if (digit && index < 5) {
      document.getElementById(`otp-${index + 1}`)?.focus()
    }
    // Auto submit saat digit ke-6 diisi
    if (index === 5 && digit) {
      const code = next.join('')
      if (code.length === 6) {
        handleVerifyOtp(new Event('submit') as any)
      }
    }
  }

  function handleOtpKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      document.getElementById(`otp-${index - 1}`)?.focus()
    }
  }

  const maskedPhone = '+62 ' + phone.replace(/\D/g, '').replace(/(\d{3})(\d+)(\d{4})/, '$1 xxxx $3')

  return (
    <main className="min-h-screen bg-[#F7F6FF] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-[400px] overflow-hidden border border-[#E5E3FF]">

        {/* Header */}
        <div className="bg-gradient-to-br from-[#3D34C4] to-[#5C4FE5] px-7 py-6 text-center">
          <h1 className="font-bold text-2xl text-white tracking-tight">
            edu<span className="text-[#FFCC00]">kazia</span>
          </h1>
          <p className="text-xs text-white/70 tracking-widest uppercase mt-1">Portal Pengguna</p>
        </div>

        <div className="p-7">
          {/* Tab switcher */}
          <div className="flex bg-[#F0EFFF] rounded-full p-1 mb-5">
            {(['email', 'phone'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setMessage(null) }}
                className={`flex-1 py-2 text-sm font-semibold rounded-full transition-all ${
                  tab === t
                    ? 'bg-[#5C4FE5] text-white shadow'
                    : 'text-[#4A4580] hover:text-[#5C4FE5]'
                }`}
              >
                {t === 'email' ? 'Email' : 'Nomor HP'}
              </button>
            ))}
          </div>

          {/* ── Panel Email ── */}
          {tab === 'email' && (
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@email.com"
                  autoComplete="email"
                  className="w-full px-3.5 py-2.5 border border-[#E5E3FF] rounded-xl text-sm bg-[#F7F6FF] text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] focus:bg-white transition"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full px-3.5 py-2.5 border border-[#E5E3FF] rounded-xl text-sm bg-[#F7F6FF] text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] focus:bg-white transition"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-[#5C4FE5] hover:bg-[#3D34C4] text-white font-bold rounded-xl text-sm transition disabled:opacity-60 mt-2"
              >
                {loading ? 'Memverifikasi...' : 'Masuk ke Portal'}
              </button>
            </form>
          )}

          {/* ── Panel Nomor HP ── */}
          {tab === 'phone' && phoneStep === 'input' && (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">
                  Nomor HP terdaftar
                </label>
                <div className="flex gap-2">
                  <span className="px-3 py-2.5 border border-[#E5E3FF] rounded-xl text-sm font-bold text-[#4A4580] bg-[#F0EFFF] whitespace-nowrap">
                    +62
                  </span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="812 3456 7890"
                    className="flex-1 px-3.5 py-2.5 border border-[#E5E3FF] rounded-xl text-sm bg-[#F7F6FF] text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] focus:bg-white transition"
                  />
                </div>
                <p className="text-xs text-[#7B78A8] mt-1.5">
                  Gunakan nomor yang didaftarkan oleh admin EduKazia
                </p>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-[#5C4FE5] hover:bg-[#3D34C4] text-white font-bold rounded-xl text-sm transition disabled:opacity-60"
              >
                {loading ? 'Mengirim...' : 'Kirim Kode OTP'}
              </button>
            </form>
          )}

          {tab === 'phone' && phoneStep === 'otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="text-center mb-2">
                <p className="text-sm text-[#4A4580]">Kode 6 digit dikirim ke</p>
                <p className="font-bold text-[#1A1640]">{maskedPhone}</p>
              </div>
              <div className="flex gap-2 justify-center">
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    id={`otp-${i}`}
                    type="tel"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(e.target.value, i)}
                    onKeyDown={(e) => handleOtpKeyDown(e, i)}
                    className="w-11 h-12 text-center text-xl font-bold border-2 border-[#E5E3FF] rounded-xl bg-[#F7F6FF] text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] transition"
                  />
                ))}
              </div>
              <p className="text-center text-xs text-[#7B78A8]">
                Berlaku 10 menit ·{' '}
                <button
                  type="button"
                  onClick={() => { setPhoneStep('input'); setOtp(['','','','','','']) }}
                  className="text-[#5C4FE5] font-semibold"
                >
                  Ganti nomor
                </button>
                {' · '}
                <button
                  type="button"
                  onClick={handleSendOtp}
                  className="text-[#5C4FE5] font-semibold"
                >
                  Kirim ulang
                </button>
              </p>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-[#5C4FE5] hover:bg-[#3D34C4] text-white font-bold rounded-xl text-sm transition disabled:opacity-60"
              >
                {loading ? 'Memverifikasi...' : 'Verifikasi & Masuk'}
              </button>
            </form>
          )}

          {/* Pesan error / sukses */}
          {message && (
            <div className={`mt-4 px-4 py-3 rounded-xl text-sm font-semibold text-center ${
              message.type === 'error'
                ? 'bg-red-50 text-red-600 border border-red-200'
                : 'bg-purple-50 text-purple-700 border border-purple-200'
            }`}>
              {message.text}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-7 pb-5 text-center text-xs text-[#7B78A8] border-t border-[#E5E3FF] pt-4">
          Belum punya akun?{' '}
          <a
            href={`https://wa.me/${process.env.NEXT_PUBLIC_WA_NUMBER}?text=Halo+EduKazia,+saya+ingin+mendaftar`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#5C4FE5] font-bold"
          >
            Daftar via WhatsApp
          </a>
        </div>
      </div>
    </main>
  )
}
