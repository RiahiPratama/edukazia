import { NextRequest, NextResponse } from 'next/server'

const FONNTE_API = 'https://api.fonnte.com/send'

// ── Helper kirim WA via Fonnte ──
export async function sendWhatsApp(phone: string, message: string) {
  const token = process.env.FONNTE_TOKEN
  if (!token) throw new Error('FONNTE_TOKEN tidak ditemukan di env vars')

  // Normalisasi nomor — pastikan format 628xxx
  const normalized = phone.replace(/\D/g, '').replace(/^0/, '62').replace(/^8/, '628')

  const res = await fetch(FONNTE_API, {
    method: 'POST',
    headers: {
      'Authorization': token,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      target:  normalized,
      message: message,
      countryCode: '62',
    }),
  })

  const data = await res.json()
  return data
}

// ── POST /api/notifications/whatsapp ──
// Body: { type, payload }
// type: 'laporan' | 'sisa_sesi' | 'reminder_kelas'
export async function POST(request: NextRequest) {
  try {
    const { type, payload } = await request.json()

    let phone   = ''
    let message = ''

    if (type === 'laporan') {
      // Notifikasi laporan tutor sudah diinput
      // payload: { parentPhone, studentName, classLabel, perkembangan }
      phone   = payload.parentPhone
      message = `📚 *Laporan Belajar EduKazia*\n\nHalo Bunda/Ayah! Tutor sudah mengisi laporan sesi *${payload.studentName}* (${payload.classLabel}).\n\n📝 *Perkembangan:*\n${payload.perkembangan}\n\nLihat laporan lengkap di portal EduKazia:\nhttps://app.edukazia.com/ortu/dashboard\n\n_EduKazia — Belajar Seru, Hasil Nyata_ 🎓`

    } else if (type === 'sisa_sesi') {
      // Notifikasi sisa sesi tinggal sedikit
      // payload: { parentPhone, studentName, classLabel, sisaSesi }
      phone   = payload.parentPhone
      const habis = payload.sisaSesi === 0
      message = habis
        ? `⚠️ *Paket Belajar Habis!*\n\nHalo Bunda/Ayah! Paket belajar *${payload.studentName}* (${payload.classLabel}) sudah selesai.\n\nSegera perpanjang agar belajar tidak terputus! 🙏\n\nHubungi admin untuk perpanjangan:\nhttps://wa.me/6281384253679?text=Halo+EduKazia,+saya+ingin+perpanjang+paket+${encodeURIComponent(payload.studentName)}\n\n_EduKazia — Belajar Seru, Hasil Nyata_ 🎓`
        : `⏰ *Pengingat Paket EduKazia*\n\nHalo Bunda/Ayah! Paket belajar *${payload.studentName}* (${payload.classLabel}) tinggal *${payload.sisaSesi} sesi* lagi.\n\nSegera perpanjang agar belajar tidak terputus! 🙏\n\nHubungi admin:\nhttps://wa.me/6281384253679?text=Halo+EduKazia,+saya+ingin+perpanjang+paket+${encodeURIComponent(payload.studentName)}\n\n_EduKazia — Belajar Seru, Hasil Nyata_ 🎓`

    } else if (type === 'reminder_kelas') {
      // Reminder 10 menit sebelum kelas
      // payload: { parentPhone, studentName, classLabel, jamMulai, zoomLink }
      phone   = payload.parentPhone
      message = `🔔 *Kelas Dimulai 10 Menit Lagi!*\n\nHalo Bunda/Ayah! *${payload.studentName}* ada kelas *${payload.classLabel}* yang dimulai pukul *${payload.jamMulai} WIT*.\n\nSiapkan diri dan buka Zoom sekarang! 🎓\n\n🔗 *Link Zoom:*\n${payload.zoomLink ?? 'Cek di portal EduKazia'}\n\n_EduKazia — Belajar Seru, Hasil Nyata_ 📚`

    } else {
      return NextResponse.json({ error: 'Type tidak valid' }, { status: 400 })
    }

    if (!phone) {
      return NextResponse.json({ error: 'Nomor HP tidak tersedia' }, { status: 400 })
    }

    const result = await sendWhatsApp(phone, message)

    return NextResponse.json({ success: true, result })

  } catch (error: any) {
    console.error('Fonnte error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
