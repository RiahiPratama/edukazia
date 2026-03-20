'use client'

import { Suspense } from 'react'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Tab = 'email' | 'phone'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [tab, setTab] = useState<Tab>('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [step, setStep] = useState<'input' | 'otp'>('input')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ text: string; err: boolean } | null>(null)

  async function redirectByRole() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    const routes: Record<string, string> = {
      admin: '/admin', tutor: '/tutor', student: '/siswa', parent: '/siswa'
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

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault()
    const raw = phone.replace(/\D/g, '')
    if (raw.length < 9) { setMsg({ text: 'Nomor HP tidak valid.', err: true }); return }
    setLoading(true); setMsg(null)
    const { error } = await supabase.auth.signInWithOtp({ phone: '+62' + raw })
    setLoading(false)
    if (error) { setMsg({ text: 'Gagal kirim OTP: ' + error.message, err: true }); return }
    setStep('otp')
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault()
    const code = otp.join('')
    if (code.length < 6) { setMsg({ text: 'Masukkan 6 digit kode OTP.', err: true }); return }
    setLoading(true); setMsg(null)
    const { error } = await supabase.auth.verifyOtp({
      phone: '+62' + phone.replace(/\D/g, ''), token: code, type: 'sms'
    })
    if (error) { setMsg({ text: 'Kode salah atau kadaluwarsa.', err: true }); setLoading(false); return }
    setMsg({ text: 'Berhasil! Membuka portal...', err: false })
    await redirectByRole()
  }

  function handleOtpChange(val: string, i: number) {
    const d = val.replace(/\D/g, '').slice(-1)
    const next = [...otp]; next[i] = d; setOtp(next)
    if (d && i < 5) document.getElementById(`otp-${i + 1}`)?.focus()
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl w-full max-w-[400px] overflow-hidden border border-[#E5E3FF]">
      <div className="bg-gradient-to-br from-[#3D34C4] to-[#5C4FE5] px-7 py-6 text-center">
        <h1 className="font-bold text-2xl text-white">edu<span className="text-[#FFCC00]">kazia</span></h1>
        <p className="text-xs text-white/70 tracking-widest uppercase mt-1">Portal Pengguna</p>
      </div>
      <div className="p-7">
        <div className="flex bg-[#F0EFFF] rounded-full p-1 mb-5">
          {(['email', 'phone'] as Tab[]).map(t => (
            <button key={t} onClick={() => { setTab(t); setMsg(null); setStep('input') }}
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
              <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">Password</label>
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

        {tab === 'phone' && step === 'input' && (
          <form onSubmit={handleSendOtp} className="space-y-4">
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
              {loading ? 'Mengirim...' : 'Kirim Kode OTP'}
            </button>
          </form>
        )}

        {tab === 'phone' && step === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="text-center mb-2">
              <p className="text-sm text-[#4A4580]">Kode 6 digit dikirim ke</p>
              <p className="font-bold text-[#1A1640]">+62 {phone}</p>
            </div>
            <div className="flex gap-2 justify-center">
              {otp.map((d, i) => (
                <input key={i} id={`otp-${i}`} type="tel" maxLength={1} value={d}
                  onChange={e => handleOtpChange(e.target.value, i)}
                  onKeyDown={e => e.key === 'Backspace' && !d && i > 0 && document.getElementById(`otp-${i - 1}`)?.focus()}
                  className="w-11 h-12 text-center text-xl font-bold border-2 border-[#E5E3FF] rounded-xl bg-[#F7F6FF] text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] transition" />
              ))}
            </div>
            <p className="text-center text-xs text-[#7B78A8]">
              Berlaku 10 menit ·{' '}
              <button type="button" onClick={() => { setStep('input'); setOtp(['', '', '', '', '', '']) }}
                className="text-[#5C4FE5] font-semibold">Ganti nomor</button>
            </p>
            <button type="submit" disabled={loading}
              className="w-full py-3 bg-[#5C4FE5] hover:bg-[#3D34C4] text-white font-bold rounded-xl text-sm transition disabled:opacity-60">
              {loading ? 'Memverifikasi...' : 'Verifikasi & Masuk'}
            </button>
          </form>
        )}

        {msg && (
          <div className={`mt-4 px-4 py-3 rounded-xl text-sm font-semibold text-center ${msg.err ? 'bg-red-50 text-red-600 border border-red-200'
            : 'bg-purple-50 text-purple-700 border border-purple-200'}`}>
            {msg.text}
          </div>
        )}
      </div>
      <div className="px-7 pb-5 text-center text-xs text-[#7B78A8] border-t border-[#E5E3FF] pt-4">
        Belum punya akun?{' '}
        <a href={`https://wa.me/${process.env.NEXT_PUBLIC_WA_NUMBER}`}
          target="_blank" rel="noopener noreferrer" className="text-[#5C4FE5] font-bold">
          Daftar via WhatsApp
        </a>
      </div>
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
