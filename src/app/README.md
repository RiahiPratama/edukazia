# Fase 3 — Setup Dashboard Admin

## Struktur File yang Perlu Disalin

```
fase3/src/app/(admin)/layout.tsx          → src/app/(admin)/layout.tsx
fase3/src/app/(admin)/dashboard/page.tsx  → src/app/(admin)/dashboard/page.tsx
fase3/src/app/(admin)/kursus/page.tsx     → src/app/(admin)/kursus/page.tsx
fase3/src/app/(admin)/siswa/page.tsx      → src/app/(admin)/siswa/page.tsx
fase3/src/app/(admin)/tutor/page.tsx      → src/app/(admin)/tutor/page.tsx
```

## Perintah Terminal

```bash
# Buat semua folder yang diperlukan
mkdir -p src/app/\(admin\)/dashboard
mkdir -p src/app/\(admin\)/kursus/paket
mkdir -p src/app/\(admin\)/siswa
mkdir -p src/app/\(admin\)/tutor
mkdir -p src/app/\(admin\)/kelas
mkdir -p src/app/\(admin\)/jadwal
mkdir -p src/app/\(admin\)/pembayaran
mkdir -p src/app/\(admin\)/honor
```

## Perubahan di middleware.ts

Pastikan route /admin diarahkan ke /admin/dashboard saat login.
Di ROLE_ROUTES, ubah:

```ts
const ROLE_ROUTES: Record<string, string> = {
  admin:   '/admin/dashboard',  // ← ubah dari /admin
  tutor:   '/tutor',
  student: '/siswa',
}
```

Dan di middleware, tambahkan redirect /admin → /admin/dashboard:

```ts
// Tambahkan setelah cek protected route
if (pathname === '/admin') {
  const redirectUrl = request.nextUrl.clone()
  redirectUrl.pathname = '/admin/dashboard'
  return NextResponse.redirect(redirectUrl)
}
```

## Commit

```bash
git add .
git commit -m "feat: admin layout and dashboard phase 3"
git push origin main
```

## Halaman yang Sudah Ada (Fase 3 Awal)

- ✅ Layout admin (sidebar + header)
- ✅ Dashboard utama (metrik, sesi hari ini, pembayaran terbaru)
- ✅ Halaman daftar kursus & paket
- ✅ Halaman daftar siswa
- ✅ Halaman daftar tutor

## Halaman Berikutnya (Fase 3 Lanjutan)

- Form tambah/edit siswa baru
- Form tambah/edit tutor baru
- Form tambah kursus & paket
- Halaman manajemen kelas (class_groups)
- Halaman enrollment siswa ke kelas
