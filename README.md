# EduKazia — Panduan Setup Project Next.js

## Prasyarat
- Node.js 18+ (cek: `node -v`)
- npm atau pnpm
- Akun Supabase (gratis di supabase.com)
- Akun Vercel (gratis di vercel.com) — untuk deploy

---

## Langkah 1 — Buat Project Next.js

```bash
npx create-next-app@latest edukazia \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"

cd edukazia

npm install @supabase/supabase-js @supabase/ssr
npm install lucide-react
npm install -D supabase
```

---

## Langkah 2 — Setup Supabase

1. Buka https://supabase.com → buat project baru "edukazia"
2. Tunggu project siap (~2 menit)
3. Buka **SQL Editor** di dashboard
4. Copy seluruh isi `supabase-migration.sql` → paste → **Run**
5. Buka **Settings > API** → copy:
   - `Project URL`
   - `anon public` key
   - `service_role` key (rahasia!)

---

## Langkah 3 — Konfigurasi Environment

```bash
# Di root folder project, buat file .env.local
cp .env.example .env.local
```

Isi `.env.local` dengan nilai dari Supabase:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_WA_NUMBER=628123456789
```

---

## Langkah 4 — Salin File Setup

Salin file-file dari folder `setup-files/` ke dalam project:

```
setup-files/src/lib/supabase/client.ts  → src/lib/supabase/client.ts
setup-files/src/lib/supabase/server.ts  → src/lib/supabase/server.ts
setup-files/src/middleware.ts           → src/middleware.ts
setup-files/src/types/database.types.ts → src/types/database.types.ts
setup-files/src/app/login/page.tsx      → src/app/login/page.tsx
```

---

## Langkah 5 — Buat Folder Struktur

```bash
mkdir -p src/app/\(admin\)/dashboard
mkdir -p src/app/\(admin\)/siswa
mkdir -p src/app/\(admin\)/tutor
mkdir -p src/app/\(admin\)/jadwal
mkdir -p src/app/\(admin\)/pembayaran
mkdir -p src/app/\(admin\)/honor
mkdir -p src/app/\(tutor\)/jadwal
mkdir -p src/app/\(tutor\)/presensi
mkdir -p src/app/\(siswa\)/kuota
mkdir -p src/app/\(siswa\)/laporan
mkdir -p src/app/api/sessions
mkdir -p src/app/api/payments
mkdir -p src/components/ui
mkdir -p src/components/calendar
```

---

## Langkah 6 — Buat Admin Pertama di Supabase

1. Buka **Authentication > Users** di Supabase
2. Klik **Invite user** → masukkan email kamu
3. Setelah user terbuat, buka **SQL Editor** dan jalankan:

```sql
-- Ganti 'email-kamu@gmail.com' dengan email yang baru dibuat
UPDATE profiles
SET role = 'admin', full_name = 'Admin EduKazia'
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'email-kamu@gmail.com'
);
```

---

## Langkah 7 — Jalankan Development Server

```bash
npm run dev
```

Buka http://localhost:3000 — kamu akan diarahkan ke `/login`.
Login dengan email admin yang baru dibuat → masuk ke `/admin`.

---

## Langkah 8 — Generate Types Otomatis (Opsional tapi Disarankan)

Setelah Supabase CLI terpasang:

```bash
npx supabase login
npx supabase gen types typescript \
  --project-id YOUR_PROJECT_ID \
  > src/types/database.types.ts
```

Ini menggantikan file `database.types.ts` manual dengan versi yang akurat.
Project ID ada di: Supabase Dashboard → Settings → General.

---

## Langkah 9 — Deploy ke Vercel

```bash
# Push ke GitHub dulu
git init
git add .
git commit -m "feat: initial EduKazia setup"
git remote add origin https://github.com/username/edukazia.git
git push -u origin main
```

Lalu di Vercel:
1. Import repository dari GitHub
2. Isi semua environment variables (sama seperti .env.local)
3. Ganti `NEXT_PUBLIC_SITE_URL` dengan URL Vercel yang diberikan
4. Deploy!

---

## Struktur Folder Final

```
edukazia/
├── .env.local                    ← JANGAN di-commit ke Git
├── .env.example                  ← Template (boleh di-commit)
├── src/
│   ├── app/
│   │   ├── (admin)/              ← Route group admin
│   │   │   ├── layout.tsx
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── siswa/page.tsx
│   │   │   ├── tutor/page.tsx
│   │   │   ├── jadwal/page.tsx
│   │   │   ├── pembayaran/page.tsx
│   │   │   └── honor/page.tsx
│   │   ├── (tutor)/              ← Route group tutor
│   │   │   ├── layout.tsx
│   │   │   ├── jadwal/page.tsx
│   │   │   └── presensi/[sessionId]/page.tsx
│   │   ├── (siswa)/              ← Route group siswa
│   │   │   ├── layout.tsx
│   │   │   ├── kuota/page.tsx
│   │   │   └── laporan/page.tsx
│   │   ├── api/                  ← API Routes
│   │   │   ├── sessions/route.ts
│   │   │   └── payments/route.ts
│   │   ├── login/page.tsx        ← Halaman login
│   │   ├── layout.tsx            ← Root layout
│   │   └── page.tsx              ← Landing page (konversi dari HTML)
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts         ← Browser client
│   │   │   └── server.ts         ← Server client
│   │   └── utils.ts
│   ├── types/
│   │   └── database.types.ts
│   ├── components/
│   │   ├── ui/                   ← Button, Input, Card, dll
│   │   └── calendar/             ← Komponen kalender jadwal
│   └── middleware.ts             ← RBAC routing
├── next.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

---

## Urutan Build Selanjutnya (sesuai PRD)

- [ ] Fase 1 ✅ — Setup project + auth + RBAC (ini)
- [ ] Fase 2 — Konversi landing page HTML → Next.js page.tsx
- [ ] Fase 3 — CRUD data master (kursus, paket, tutor, siswa)
- [ ] Fase 4 — Manajemen kelas (class_groups) + enrollment
- [ ] Fase 5 — Penjadwalan sesi + kalender + notifikasi email
- [ ] Fase 6 — Portal tutor: presensi + upload foto
- [ ] Fase 7 — Portal siswa: kuota + laporan perkembangan
- [ ] Fase 8 — Keuangan: pembayaran + honor tutor + dashboard
- [ ] Fase 9 — Testing & QA
