'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function ResetForm() {
  const router = useRouter()
  const supabase = createClient()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ text: string; err: boolean } | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Cek apakah session sudah ada (dari link reset)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true)
      else setMsg({ text: 'Link tidak valid atau sudah kadaluwarsa. Minta link reset baru.', err: true })
    })
  }, [])

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) { setMsg({ text: 'Password minimal 6 karakter.', err: true }); return }
    if (password !== confirm) { setMsg({ text: 'Konfirmasi password tidak cocok.', err: true }); return }
    setLoading(true); setMsg(null)

    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      setMsg({ text: 'Gagal update password: ' + error.message, err: true }); return
    }

    setMsg({ text: 'Password berhasil diubah! Mengalihkan ke login...', err: false })
    setTimeout(() => {
      supabase.auth.signOut().then(() => router.push('/login'))
    }, 2000)
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl w-full max-w-[400px] overflow-hidden border border-[#E5E3FF]">
      <div className="bg-gradient-to-br from-[#3D34C4] to-[#5C4FE5] px-7 py-6 text-center">
        <h1 className="font-bold text-2xl text-white">edu<span className="text-[#FFCC00]">kazia</span></h1>
        <p className="text-xs text-white/70 tracking-widest uppercase mt-1">Buat Password Baru</p>
      </div>

      <div className="p-7">
        {!ready && !msg && (
          <p className="text-sm text-center text-[#7B78A8]">Memverifikasi link...</p>
        )}

        {ready && (
          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">
                Password Baru
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                className="w-full px-3.5 py-2.5 border border-[#E5E3FF] rounded-xl text-sm bg-[#F7F6FF] text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] focus:bg-white transition"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5">
                Konfirmasi Password
              </label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Ulangi password baru"
                className="w-full px-3.5 py-2.5 border border-[#E5E3FF] rounded-xl text-sm bg-[#F7F6FF] text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] focus:bg-white transition"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#5C4FE5] hover:bg-[#3D34C4] text-white font-bold rounded-xl text-sm transition disabled:opacity-60 mt-2">
              {loading ? 'Menyimpan...' : 'Simpan Password Baru'}
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

        {!ready && msg?.err && (
          <div className="mt-4 text-center">
            <a href="/login" className="text-[#5C4FE5] text-sm font-semibold hover:underline">
              ← Kembali ke login
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen bg-[#F7F6FF] flex items-center justify-center p-4">
      <Suspense fallback={<div className="text-[#7B78A8] text-sm">Memuat...</div>}>
        <ResetForm />
      </Suspense>
    </main>
  )
}
