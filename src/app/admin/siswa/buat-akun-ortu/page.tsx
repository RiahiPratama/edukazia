'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { UserPlus, CheckCircle2, AlertCircle, RefreshCw, Eye, EyeOff, Mail } from 'lucide-react'

interface OrtuTanpaAkun {
  studentId:     string
  studentName:   string
  relationName:  string
  relationRole:  string
  relationEmail: string
  sudahDibuat:   boolean
  error?:        string
}

export default function BuatAkunOrtuPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [list,          setList]          = useState<OrtuTanpaAkun[]>([])
  const [loading,       setLoading]       = useState(true)
  const [processing,    setProcessing]    = useState(false)
  const [defaultPass,   setDefaultPass]   = useState('Edukazia2025!')
  const [showPass,      setShowPass]      = useState(false)
  const [doneIds,       setDoneIds]       = useState<Set<string>>(new Set())
  const [errorMap,      setErrorMap]      = useState<Record<string, string>>({})
  const [processingId,  setProcessingId]  = useState<string | null>(null)

  useEffect(() => { fetchOrtuTanpaAkun() }, [])

  async function fetchOrtuTanpaAkun() {
    setLoading(true)

    // Ambil semua siswa yang punya relation_email tapi TIDAK punya parent_profile_id
    // (berarti ortu belum punya akun)
    const { data: students } = await supabase
      .from('students')
      .select('id, profile_id, parent_profile_id, relation_name, relation_role, relation_email')
      .is('parent_profile_id', null)
      .not('relation_email', 'is', null)
      .neq('relation_email', '')
      .neq('relation_role', 'Diri Sendiri')

    if (!students || students.length === 0) {
      setList([]); setLoading(false); return
    }

    // Ambil nama siswa
    const profileIds = students.map((s: any) => s.profile_id).filter(Boolean)
    const { data: profiles } = await supabase
      .from('profiles').select('id, full_name').in('id', profileIds)
    const profMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p.full_name]))

    setList(students.map((s: any) => ({
      studentId:     s.id,
      studentName:   profMap[s.profile_id] ?? '—',
      relationName:  s.relation_name ?? '—',
      relationRole:  s.relation_role ?? 'Orang Tua',
      relationEmail: s.relation_email,
      sudahDibuat:   false,
    })))
    setLoading(false)
  }

  // Buat satu akun
  async function buatSatuAkun(ortu: OrtuTanpaAkun) {
    setProcessingId(ortu.studentId)
    setErrorMap(prev => { const n = { ...prev }; delete n[ortu.studentId]; return n })

    const res = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email:      ortu.relationEmail,
        password:   defaultPass,
        role:       'parent',
        full_name:  ortu.relationName,
        student_id: ortu.studentId,
      }),
    })
    const data = await res.json()
    setProcessingId(null)

    if (!res.ok) {
      setErrorMap(prev => ({ ...prev, [ortu.studentId]: data.error ?? 'Gagal membuat akun' }))
    } else {
      setDoneIds(prev => new Set([...prev, ortu.studentId]))
    }
  }

  // Buat semua sekaligus
  async function buatSemuaAkun() {
    setProcessing(true)
    const pending = list.filter(o => !doneIds.has(o.studentId))
    for (const ortu of pending) {
      await buatSatuAkun(ortu)
    }
    setProcessing(false)
  }

  const pending = list.filter(o => !doneIds.has(o.studentId))
  const done    = list.filter(o =>  doneIds.has(o.studentId))

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-[#1A1640] font-['Sora']">Buat Akun Orang Tua</h1>
        <p className="text-sm text-[#7B78A8] mt-1">
          Daftar orang tua yang sudah punya email tapi belum memiliki akun login EduKazia
        </p>
      </div>

      {/* Password default */}
      <div className="bg-white rounded-2xl border border-[#E5E3FF] p-5 mb-5">
        <h2 className="text-sm font-bold text-[#1A1640] mb-3">Password Default</h2>
        <div className="flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2 px-3 py-2.5 border border-[#E5E3FF] rounded-xl bg-[#F7F6FF]">
            <Mail size={14} className="text-[#7B78A8] flex-shrink-0"/>
            <input
              type={showPass ? 'text' : 'password'}
              value={defaultPass}
              onChange={e => setDefaultPass(e.target.value)}
              className="flex-1 bg-transparent text-sm text-[#1A1640] outline-none"
            />
            <button onClick={() => setShowPass(p => !p)} className="text-[#7B78A8] hover:text-[#5C4FE5]">
              {showPass ? <EyeOff size={14}/> : <Eye size={14}/>}
            </button>
          </div>
          <p className="text-xs text-[#7B78A8]">
            Password ini berlaku untuk semua akun yang dibuat. Minta ortu ganti setelah login pertama.
          </p>
        </div>
      </div>

      {/* Summary + aksi massal */}
      {!loading && list.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#E5E3FF] p-5 mb-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6 text-sm">
            <div>
              <span className="text-2xl font-black text-[#5C4FE5]">{pending.length}</span>
              <span className="text-[#7B78A8] ml-1.5 font-semibold">belum dibuat</span>
            </div>
            <div>
              <span className="text-2xl font-black text-green-600">{done.length}</span>
              <span className="text-[#7B78A8] ml-1.5 font-semibold">selesai</span>
            </div>
          </div>
          {pending.length > 0 && (
            <button
              onClick={buatSemuaAkun}
              disabled={processing || !defaultPass || defaultPass.length < 6}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#5C4FE5] hover:bg-[#4338CA] text-white text-sm font-bold rounded-xl transition disabled:opacity-50"
            >
              {processing
                ? <><RefreshCw size={14} className="animate-spin"/> Memproses...</>
                : <><UserPlus size={14}/> Buat Semua ({pending.length})</>
              }
            </button>
          )}
        </div>
      )}

      {/* Daftar */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-[#E5E3FF] p-12 text-center">
          <RefreshCw size={24} className="animate-spin text-[#5C4FE5] mx-auto mb-3"/>
          <p className="text-sm text-[#7B78A8]">Memuat data...</p>
        </div>
      ) : list.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E5E3FF] p-12 text-center">
          <CheckCircle2 size={36} className="text-green-500 mx-auto mb-3"/>
          <p className="text-sm font-bold text-[#1A1640]">Semua orang tua sudah punya akun</p>
          <p className="text-xs text-[#7B78A8] mt-1">Tidak ada email orang tua yang perlu dibuatkan akun.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map(ortu => {
            const isDone       = doneIds.has(ortu.studentId)
            const isProcessing = processingId === ortu.studentId
            const errMsg       = errorMap[ortu.studentId]

            return (
              <div key={ortu.studentId}
                className={`bg-white rounded-2xl border overflow-hidden transition ${
                  isDone       ? 'border-green-200' :
                  errMsg       ? 'border-red-200' :
                  'border-[#E5E3FF]'
                }`}>
                <div className="flex items-center gap-4 px-5 py-4">
                  {/* Avatar */}
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${
                    isDone ? 'bg-green-500' : 'bg-[#5C4FE5]'
                  }`}>
                    {isDone
                      ? <CheckCircle2 size={16}/>
                      : ortu.relationName.charAt(0).toUpperCase()
                    }
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[#1A1640]">{ortu.relationName}</span>
                      <span className="text-[10px] text-[#7B78A8] bg-[#F7F6FF] px-2 py-0.5 rounded-full">{ortu.relationRole}</span>
                    </div>
                    <div className="text-xs text-[#5C4FE5] font-medium">{ortu.relationEmail}</div>
                    <div className="text-[10px] text-[#7B78A8] mt-0.5">
                      Siswa: {ortu.studentName}
                    </div>
                  </div>

                  {/* Status / Aksi */}
                  <div className="flex-shrink-0">
                    {isDone ? (
                      <span className="text-xs font-bold text-green-600 flex items-center gap-1">
                        <CheckCircle2 size={13}/> Akun dibuat
                      </span>
                    ) : (
                      <button
                        onClick={() => buatSatuAkun(ortu)}
                        disabled={isProcessing || processing || !defaultPass || defaultPass.length < 6}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#5C4FE5] hover:bg-[#4338CA] text-white text-xs font-bold rounded-lg transition disabled:opacity-50"
                      >
                        {isProcessing
                          ? <><RefreshCw size={11} className="animate-spin"/> Memproses...</>
                          : <><UserPlus size={11}/> Buat Akun</>
                        }
                      </button>
                    )}
                  </div>
                </div>

                {/* Error */}
                {errMsg && (
                  <div className="px-5 pb-3 flex items-center gap-2 text-xs text-red-600">
                    <AlertCircle size={12}/>
                    {errMsg}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
