import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Tagihan · Portal Orang Tua · EduKazia' }

// ─── Alur bisnis EduKazia:
// Ortu bayar dulu → konfirmasi ke admin via WA → admin buat kelas + enrollment
// Jadi: enrollment yang ada = sudah lunas. Tidak ada konsep "belum bayar" di portal.
// Halaman ini hanya menampilkan riwayat kelas/periode yang sudah dibayar.

const CHILD_COLORS = ['#E6B800', '#1D9E75', '#5C4FE5', '#D85A30', '#639922']
const CHILD_BG     = ['#FAEEDA', '#E1F5EE', '#EEEDFE', '#FAECE7', '#EAF3DE']
const CHILD_TEXT   = ['#412402', '#085041', '#3C3489', '#4A1B0C', '#173404']

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
}
function fmtRp(amount: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
  }).format(amount)
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jayapura',
  })
}

export default async function OrtuTagihanPage() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cs) { try { cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {} },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const userId   = session.user.id
  const waNumber = process.env.NEXT_PUBLIC_WA_NUMBER ?? ''

  // ── Siswa ──────────────────────────────────────────────────────────────────
  const { data: studentRows } = await supabase
    .from('students')
    .select(`id, grade, profiles!students_profile_id_fkey(full_name)`)
    .eq('parent_profile_id', userId)

  if (!studentRows || studentRows.length === 0) redirect('/login')

  const students = (studentRows as any[]).map((s, idx) => ({
    id:        s.id,
    full_name: (Array.isArray(s.profiles) ? s.profiles[0] : s.profiles)?.full_name ?? '(Tanpa nama)',
    grade:     s.grade,
    color:     CHILD_COLORS[idx % CHILD_COLORS.length],
    bgColor:   CHILD_BG[idx % CHILD_BG.length],
    textColor: CHILD_TEXT[idx % CHILD_TEXT.length],
  }))

  const studentIds = students.map(s => s.id)

  // ── Enrollments ────────────────────────────────────────────────────────────
  // Semua enrollment = sudah dibayar (admin baru buat setelah konfirmasi)
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select(`id, student_id, class_group_id, status, end_date,
      expired_at, status_override, enrolled_at, sessions_total, package_id`)
    .in('student_id', studentIds)
    .order('enrolled_at', { ascending: false })

  // ── Class groups ───────────────────────────────────────────────────────────
  const cgIds = [...new Set((enrollments ?? []).map((e: any) => e.class_group_id).filter(Boolean))]
  const { data: classGroups } = cgIds.length > 0
    ? await supabase.from('class_groups').select('id, label, class_type_id, price').in('id', cgIds)
    : { data: [] }

  // ── Class types → base_price ───────────────────────────────────────────────
  const ctIds = [...new Set((classGroups ?? []).map((cg: any) => cg.class_type_id).filter(Boolean))]
  const { data: classTypes } = ctIds.length > 0
    ? await supabase.from('class_types').select('id, name, base_price').in('id', ctIds)
    : { data: [] }

  // ── Susun per siswa ────────────────────────────────────────────────────────
  const byStudent = students.map(student => {
    const rows = (enrollments ?? []).filter((e: any) => e.student_id === student.id)

    const items = rows.map((e: any) => {
      const cg     = (classGroups ?? []).find((c: any) => c.id === e.class_group_id)
      const ct     = (classTypes  ?? []).find((t: any) => t.id === cg?.class_type_id)
      const amount = (cg as any)?.price ?? ct?.base_price ?? 0

      const isExpired = (() => {
        const now = new Date()
        if (e.status_override === 'expired') return true
        if (e.status_override === 'active')  return false
        if (e.end_date    && new Date(e.end_date)    < now) return true
        if (e.expired_at  && new Date(e.expired_at)  < now) return true
        return e.status !== 'active'
      })()

      return {
        id:            e.id,
        classLabel:    cg?.label     ?? '—',
        classTypeName: ct?.name      ?? '—',
        amount,
        sessionsTotal: e.sessions_total ?? 8,
        enrolledAt:    e.enrolled_at,
        isExpired,
      }
    })

    const active  = items.filter(i => !i.isExpired)
    const expired = items.filter(i =>  i.isExpired)

    return { ...student, active, expired }
  })

  const totalActive = byStudent.reduce((sum, s) => sum + s.active.length, 0)

  return (
    <div className="px-4 lg:px-6 py-5 max-w-2xl">

      {/* Header */}
      <div className="mb-5">
        <h2 className="text-[16px] font-bold text-stone-800">Tagihan &amp; Pembayaran</h2>
        <p className="text-[11px] text-stone-400 mt-0.5">
          Riwayat kelas yang telah dibayar · {totalActive} kelas aktif
        </p>
      </div>

      {/* Info banner — lanjut periode berikutnya */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 mb-6">
        <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5 flex-shrink-0">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="6" stroke="#854F0B" strokeWidth="1.3"/>
            <path d="M7 4v3.5M7 9.5v.5" stroke="#854F0B" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-amber-800">
            Ingin melanjutkan ke periode berikutnya?
          </p>
          <p className="text-[10px] text-amber-700 mt-0.5">
            Hubungi admin via WhatsApp untuk konfirmasi pembayaran.
            Admin akan membuatkan kelas periode baru setelah pembayaran diterima.
          </p>
        </div>
        <a
          href={`https://wa.me/${waNumber}?text=Halo Admin EduKazia, saya ingin melanjutkan ke periode berikutnya`}
          target="_blank" rel="noopener noreferrer"
          className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-[11px] font-semibold hover:bg-amber-600 transition-colors whitespace-nowrap">
          Hubungi Admin
        </a>
      </div>

      {/* Per siswa */}
      {byStudent.map(student => (
        <div key={student.id} className="mb-7">

          {/* Student label */}
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[9px] font-bold flex-shrink-0"
              style={{ background: student.bgColor, color: student.textColor }}>
              {initials(student.full_name)}
            </div>
            <span className="text-[12px] font-bold text-stone-700">{student.full_name}</span>
            <div className="flex-1 h-px bg-stone-100" />
            {student.grade && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                style={{ background: student.bgColor, color: student.textColor }}>
                {student.grade}
              </span>
            )}
          </div>

          {/* Kelas aktif */}
          {student.active.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider mb-2">
                Kelas aktif
              </p>
              {student.active.map(item => (
                <div key={item.id}
                  className="rounded-xl border border-stone-100 overflow-hidden mb-2"
                  style={{ borderLeft: `3px solid ${student.color}` }}>
                  <div className="flex items-center justify-between px-3 py-2.5">
                    <div>
                      <p className="text-[12px] font-semibold text-stone-700">{item.classLabel}</p>
                      <p className="text-[10px] text-stone-400">
                        {item.classTypeName} · {item.sessionsTotal} sesi
                        {item.enrolledAt && ` · mulai ${fmtDate(item.enrolledAt)}`}
                      </p>
                    </div>
                    <div className="text-right">
                      {item.amount > 0 && (
                        <p className="text-[13px] font-bold text-green-700">{fmtRp(item.amount)}</p>
                      )}
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200 font-medium">
                        Lunas
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Kelas selesai/arsip */}
          {student.expired.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-stone-300 uppercase tracking-wider mb-2">
                Periode selesai
              </p>
              {student.expired.map(item => (
                <div key={item.id}
                  className="rounded-xl border border-stone-100 overflow-hidden mb-2 opacity-60"
                  style={{ borderLeft: `3px solid #ccc` }}>
                  <div className="flex items-center justify-between px-3 py-2.5">
                    <div>
                      <p className="text-[12px] font-semibold text-stone-500">{item.classLabel}</p>
                      <p className="text-[10px] text-stone-400">
                        {item.classTypeName} · {item.sessionsTotal} sesi
                      </p>
                    </div>
                    <div className="text-right">
                      {item.amount > 0 && (
                        <p className="text-[12px] font-semibold text-stone-400">{fmtRp(item.amount)}</p>
                      )}
                      <span className="text-[10px] text-stone-400">Selesai</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {student.active.length === 0 && student.expired.length === 0 && (
            <div className="bg-white border border-stone-100 rounded-xl py-5 text-center">
              <p className="text-[11px] text-stone-300">Belum ada riwayat kelas</p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
