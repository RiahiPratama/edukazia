'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ClipboardList, FileText, MessageCircle, Send } from 'lucide-react'

interface BelumDiisiItem {
  sessionId: string
  studentId: string
  studentName: string
  kelasLabel: string
  tutorName: string
  tutorPhone: string
  scheduledAt: string
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Jayapura',
  })
}

export default function LaporanTutorSection({
  laporanBelumDiisi,
  laporanTerbaru,
}: {
  laporanBelumDiisi: BelumDiisiItem[]
  laporanTerbaru: any[]
}) {
  const [sendingWA, setSendingWA] = useState<Record<string, 'loading' | 'sent' | 'failed'>>({})

  async function sendReminder(item: BelumDiisiItem) {
    const key = `${item.sessionId}-${item.studentId}`
    setSendingWA(prev => ({ ...prev, [key]: 'loading' }))

    const firstName = item.tutorName.split(' ')[0]
    const tgl = new Date(item.scheduledAt).toLocaleDateString('id-ID', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jayapura',
    })
    const jam = new Date(item.scheduledAt).toLocaleTimeString('id-ID', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jayapura',
    })

    const message = `📝 *Reminder Laporan Belajar*\n\nHalo Kak ${firstName} 👋\n\nLaporan belajar untuk kelas\n*${item.kelasLabel}*\npada ${tgl}, pukul ${jam} WIT\nbelum diisi.\n\nMohon segera dilengkapi\ndi portal ya 🙏\n\n🔗 app.edukazia.com/tutor/laporan\n\n\nTerima kasih!`

    try {
      const res = await fetch('/api/wa/remind-tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: item.tutorPhone,
          message,
          type: 'wa_remind_tutor_laporan',
          context: { tutorName: item.tutorName, kelasLabel: item.kelasLabel, studentName: item.studentName },
        }),
      })
      const data = await res.json()
      setSendingWA(prev => ({ ...prev, [key]: data.sent ? 'sent' : 'failed' }))
    } catch {
      setSendingWA(prev => ({ ...prev, [key]: 'failed' }))
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-[#E5E3FF] p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-[#1A1640]">Laporan Tutor</h2>
        <Link href="/admin/laporan" className="text-xs text-[#5C4FE5] font-semibold hover:underline">
          Lihat semua →
        </Link>
      </div>

      {/* Summary */}
      <div className="flex gap-2 mb-4">
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-700">
          {laporanTerbaru.length > 0 ? `${laporanTerbaru.length}+ sudah diisi` : '0 diisi'}
        </span>
        {laporanBelumDiisi.length > 0 && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700 animate-pulse">
            {laporanBelumDiisi.length} belum diisi!
          </span>
        )}
      </div>

      {/* Belum diisi */}
      {laporanBelumDiisi.length > 0 && (
        <div className="mb-4">
          <p className="text-[10px] font-bold text-red-600 uppercase tracking-wider mb-2">Belum Diisi</p>
          <div className="space-y-2">
            {laporanBelumDiisi.slice(0, 5).map((item) => {
              const key = `${item.sessionId}-${item.studentId}`
              const waState = sendingWA[key]
              return (
                <div key={key} className="flex items-start gap-2.5 px-3 py-2 rounded-xl bg-red-50/50 border border-red-100">
                  <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center text-[9px] font-bold text-red-600 flex-shrink-0 mt-0.5">
                    {item.tutorName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-[#1A1640] truncate">
                      {item.kelasLabel} · {item.studentName}
                    </div>
                    <div className="text-[10px] text-[#7B78A8]">
                      Tutor: {item.tutorName} · {fmtDateTime(item.scheduledAt)}
                    </div>
                  </div>
                  {item.tutorPhone && (
                    waState === 'sent' ? (
                      <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded-lg flex-shrink-0">Terkirim ✓</span>
                    ) : waState === 'failed' ? (
                      <span className="text-[10px] font-bold text-red-600 bg-red-100 px-2 py-1 rounded-lg flex-shrink-0">Gagal</span>
                    ) : waState === 'loading' ? (
                      <span className="text-[10px] text-[#7B78A8] flex-shrink-0">Mengirim...</span>
                    ) : (
                      <button
                        onClick={() => sendReminder(item)}
                        className="flex items-center gap-1 text-[10px] px-2 py-1 bg-red-100 text-red-700 rounded-lg font-semibold hover:bg-red-200 transition-colors flex-shrink-0">
                        <Send size={10}/> WA
                      </button>
                    )
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Laporan terbaru */}
      {!laporanTerbaru || laporanTerbaru.length === 0 ? (
        laporanBelumDiisi.length === 0 && (
          <div className="text-center py-6 text-[#7B78A8] text-sm">
            <ClipboardList size={32} strokeWidth={1.5} className="text-[#C4BFFF] mx-auto mb-2"/>
            Belum ada laporan
          </div>
        )
      ) : (
        <div>
          <p className="text-[10px] font-bold text-green-600 uppercase tracking-wider mb-2">Terbaru</p>
          <div className="space-y-3">
            {laporanTerbaru.map((lap: any) => {
              const tutor = Array.isArray(lap.tutors) ? lap.tutors[0] : lap.tutors
              const sesi  = Array.isArray(lap.sessions) ? lap.sessions[0] : lap.sessions
              const cg    = Array.isArray(sesi?.class_groups) ? sesi?.class_groups[0] : sesi?.class_groups
              const tutorName = tutor?.profiles?.full_name ?? '—'
              const kelasLabel = cg?.label ?? '—'
              const courseName = cg?.courses?.name ?? ''
              return (
                <div key={lap.id} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#F0EFFF] flex items-center justify-center text-xs font-bold text-[#5C4FE5] flex-shrink-0 mt-0.5">
                    {tutorName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-[#1A1640] truncate">
                      {tutorName}
                    </div>
                    <div className="text-xs text-[#7B78A8] truncate">
                      {kelasLabel}{courseName ? ` · ${courseName}` : ''}
                    </div>
                    <div className="text-[10px] text-[#A09EC0] mt-0.5">
                      {fmtDateTime(lap.confirmed_at)}
                    </div>
                    {lap.material_notes && (
                      <div className="text-[10px] text-[#7B78A8] mt-1 line-clamp-2 leading-relaxed bg-[#F7F6FF] rounded-lg px-2 py-1">
                        {lap.material_notes}
                      </div>
                    )}
                  </div>
                  <Link
                    href="/admin/laporan"
                    className="flex-shrink-0 text-[#C4BFFF] hover:text-[#5C4FE5] transition-colors mt-0.5"
                  >
                    <FileText size={13}/>
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
      )}
      <Link href="/admin/laporan"
        className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-[#E5E3FF] text-sm text-[#7B78A8] hover:border-[#5C4FE5] hover:text-[#5C4FE5] transition-colors font-semibold">
        <ClipboardList size={14}/>
        Lihat Semua Laporan
      </Link>
    </div>
  )
}
