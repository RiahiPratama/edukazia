-- ═══════════════════════════════════════════════════════════
-- EduKazia — Database Migration v1.0
-- Jalankan seluruh file ini di Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── ENUM TYPES ───────────────────────────────────────────
create type user_role       as enum ('admin', 'tutor', 'student');
create type session_status  as enum ('scheduled', 'completed', 'cancelled', 'rescheduled');
create type attend_status   as enum ('present', 'absent', 'excused');
create type enroll_status   as enum ('active', 'completed', 'paused');
create type payment_method  as enum ('transfer', 'cash');

-- ─── 1. PROFILES ──────────────────────────────────────────
-- Ekstensi dari auth.users Supabase
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text not null,
  phone         text,
  birth_date    date,
  role          user_role not null default 'student',
  avatar_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ─── 2. COURSES ───────────────────────────────────────────
create table courses (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  description   text,
  color         text default '#5C4FE5',
  is_active     boolean not null default true,
  sort_order    integer default 0,
  created_at    timestamptz not null default now()
);

-- Seed kursus awal
insert into courses (name, description, color, sort_order) values
  ('Bahasa Inggris', 'Pronunciation, grammar, dan speaking bersama pengajar bersertifikat.', '#5C4FE5', 1),
  ('Bahasa Arab',    'Membaca, menulis, percakapan dasar dan lanjutan.',                    '#16A34A', 2),
  ('Bahasa Mandarin','Pinyin, karakter, dan percakapan sehari-hari.',                       '#DC2626', 3),
  ('Matematika',     'Dari dasar SD hingga persiapan olimpiade nasional.',                  '#C8A000', 4);

-- ─── 3. CLASS TYPES ───────────────────────────────────────
create table class_types (
  id               uuid primary key default uuid_generate_v4(),
  name             text not null,
  max_participants integer not null,
  description      text,
  sort_order       integer default 0
);

-- Seed tipe kelas
insert into class_types (name, max_participants, description, sort_order) values
  ('Privat',      1, 'Sesi 1-on-1 eksklusif antara tutor dan siswa.',              1),
  ('Semi Privat', 4, 'Kelompok kecil maks. 4 siswa, perhatian lebih dari tutor.',  2),
  ('Reguler',     8, 'Kelas kelompok maks. 8 siswa, suasana belajar interaktif.',  3);

-- ─── 4. PACKAGES ──────────────────────────────────────────
create table packages (
  id              uuid primary key default uuid_generate_v4(),
  course_id       uuid not null references courses(id),
  class_type_id   uuid not null references class_types(id),
  name            text not null,
  total_sessions  integer not null default 8,
  price           integer not null,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

-- ─── 5. TUTORS ────────────────────────────────────────────
create table tutors (
  id               uuid primary key default uuid_generate_v4(),
  profile_id       uuid not null unique references profiles(id) on delete cascade,
  rate_per_session integer not null default 0,
  bank_name        text,
  bank_account     text,
  bank_holder      text,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);

-- ─── 6. TUTOR COURSES ─────────────────────────────────────
-- Junction: tutor mengajar kursus apa saja
create table tutor_courses (
  id         uuid primary key default uuid_generate_v4(),
  tutor_id   uuid not null references tutors(id) on delete cascade,
  course_id  uuid not null references courses(id) on delete cascade,
  unique(tutor_id, course_id)
);

-- ─── 7. STUDENTS ──────────────────────────────────────────
create table students (
  id                uuid primary key default uuid_generate_v4(),
  profile_id        uuid not null unique references profiles(id) on delete cascade,
  parent_profile_id uuid references profiles(id),
  grade             text,
  school            text,
  notes             text,
  created_at        timestamptz not null default now()
);

-- ─── 8. CLASS GROUPS ──────────────────────────────────────
-- Kelas yang sedang berjalan
create table class_groups (
  id                   uuid primary key default uuid_generate_v4(),
  course_id            uuid not null references courses(id),
  class_type_id        uuid not null references class_types(id),
  tutor_id             uuid not null references tutors(id),
  label                text not null,
  current_participants integer not null default 0,
  status               text not null default 'active',
  start_date           date,
  created_at           timestamptz not null default now()
);

-- ─── 9. ENROLLMENTS ───────────────────────────────────────
-- Pendaftaran siswa ke kelas
create table enrollments (
  id              uuid primary key default uuid_generate_v4(),
  student_id      uuid not null references students(id) on delete cascade,
  class_group_id  uuid not null references class_groups(id),
  package_id      uuid not null references packages(id),
  sessions_used   integer not null default 0,
  sessions_total  integer not null default 8,
  status          enroll_status not null default 'active',
  enrolled_at     timestamptz not null default now()
);

-- ─── 10. SESSIONS ─────────────────────────────────────────
-- Satu sesi Zoom yang terjadwal (milik class_group)
create table sessions (
  id                uuid primary key default uuid_generate_v4(),
  class_group_id    uuid not null references class_groups(id) on delete cascade,
  scheduled_at      timestamptz not null,
  zoom_link         text,
  status            session_status not null default 'scheduled',
  reschedule_reason text,
  rescheduled_at    timestamptz,
  original_scheduled_at timestamptz,
  created_at        timestamptz not null default now()
);

-- ─── 11. SESSION ATTENDANCES ──────────────────────────────
-- Kehadiran per siswa per sesi
create table session_attendances (
  id          uuid primary key default uuid_generate_v4(),
  session_id  uuid not null references sessions(id) on delete cascade,
  student_id  uuid not null references students(id) on delete cascade,
  status      attend_status not null default 'present',
  unique(session_id, student_id)
);

-- ─── 12. SESSION LOGS ─────────────────────────────────────
-- Laporan tutor setelah sesi selesai
create table session_logs (
  id             uuid primary key default uuid_generate_v4(),
  session_id     uuid not null unique references sessions(id) on delete cascade,
  tutor_id       uuid not null references tutors(id),
  confirmed_at   timestamptz not null default now(),
  material_notes text,
  photo_urls     text[] default '{}',
  created_at     timestamptz not null default now()
);

-- ─── 13. PAYMENTS ─────────────────────────────────────────
create table payments (
  id              uuid primary key default uuid_generate_v4(),
  student_id      uuid not null references students(id),
  enrollment_id   uuid not null references enrollments(id),
  amount          integer not null,
  method          payment_method not null default 'transfer',
  reference_note  text,
  paid_at         timestamptz not null default now(),
  created_by      uuid references profiles(id),
  created_at      timestamptz not null default now()
);

-- ─── 14. LANDING PAGE CONTENT (CMS ringan) ────────────────
create table landing_testimonials (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  role_label  text,
  course_tag  text,
  quote       text not null,
  is_visible  boolean not null default true,
  sort_order  integer default 0,
  created_at  timestamptz not null default now()
);

create table landing_faqs (
  id          uuid primary key default uuid_generate_v4(),
  question    text not null,
  answer      text not null,
  is_visible  boolean not null default true,
  sort_order  integer default 0,
  created_at  timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════════════
-- FUNCTIONS & TRIGGERS
-- ═══════════════════════════════════════════════════════════

-- Auto-create profile saat user baru daftar via Supabase Auth
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, full_name, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'Pengguna Baru'),
    coalesce(new.raw_user_meta_data->>'phone', new.phone),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'student')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Auto-update updated_at pada profiles
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on profiles
  for each row execute function update_updated_at();

-- Auto-update current_participants di class_groups saat enrollment berubah
create or replace function sync_class_participants()
returns trigger language plpgsql as $$
begin
  update class_groups
  set current_participants = (
    select count(*) from enrollments
    where class_group_id = coalesce(new.class_group_id, old.class_group_id)
    and status = 'active'
  )
  where id = coalesce(new.class_group_id, old.class_group_id);
  return coalesce(new, old);
end;
$$;

create trigger enrollment_participant_sync
  after insert or update or delete on enrollments
  for each row execute function sync_class_participants();

-- Auto-kurangi kuota sesi saat session_attendance ditambah (sesi selesai)
create or replace function deduct_session_quota()
returns trigger language plpgsql as $$
begin
  if new.status = 'present' then
    update enrollments
    set sessions_used = sessions_used + 1
    where student_id = new.student_id
      and class_group_id = (
        select class_group_id from sessions where id = new.session_id
      )
      and status = 'active';
  end if;
  return new;
end;
$$;

create trigger session_quota_deduct
  after insert on session_attendances
  for each row execute function deduct_session_quota();

-- ═══════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════════════════

-- Enable RLS semua tabel
alter table profiles              enable row level security;
alter table courses               enable row level security;
alter table class_types           enable row level security;
alter table packages              enable row level security;
alter table tutors                enable row level security;
alter table tutor_courses         enable row level security;
alter table students              enable row level security;
alter table class_groups          enable row level security;
alter table enrollments           enable row level security;
alter table sessions              enable row level security;
alter table session_attendances   enable row level security;
alter table session_logs          enable row level security;
alter table payments              enable row level security;
alter table landing_testimonials  enable row level security;
alter table landing_faqs          enable row level security;

-- Helper: ambil role user yang sedang login
create or replace function get_my_role()
returns user_role language sql security definer stable as $$
  select role from profiles where id = auth.uid();
$$;

-- ── PROFILES ──
create policy "Semua bisa lihat profil sendiri"
  on profiles for select using (auth.uid() = id);

create policy "Admin bisa lihat semua profil"
  on profiles for select using (get_my_role() = 'admin');

create policy "User bisa update profil sendiri"
  on profiles for update using (auth.uid() = id);

create policy "Admin bisa insert profil"
  on profiles for insert with check (get_my_role() = 'admin');

-- ── COURSES & CLASS TYPES (read semua, write admin) ──
create policy "Semua bisa lihat kursus aktif"
  on courses for select using (is_active = true or get_my_role() = 'admin');

create policy "Admin kelola kursus"
  on courses for all using (get_my_role() = 'admin');

create policy "Semua bisa lihat tipe kelas"
  on class_types for select using (true);

create policy "Admin kelola tipe kelas"
  on class_types for all using (get_my_role() = 'admin');

-- ── PACKAGES ──
create policy "Semua bisa lihat paket aktif"
  on packages for select using (is_active = true or get_my_role() = 'admin');

create policy "Admin kelola paket"
  on packages for all using (get_my_role() = 'admin');

-- ── TUTORS ──
create policy "Admin lihat semua tutor"
  on tutors for select using (get_my_role() = 'admin');

create policy "Tutor lihat profil sendiri"
  on tutors for select using (profile_id = auth.uid());

create policy "Admin kelola tutor"
  on tutors for all using (get_my_role() = 'admin');

-- ── TUTOR_COURSES ──
create policy "Admin & tutor lihat tutor_courses"
  on tutor_courses for select
  using (get_my_role() = 'admin' or
         tutor_id in (select id from tutors where profile_id = auth.uid()));

create policy "Admin kelola tutor_courses"
  on tutor_courses for all using (get_my_role() = 'admin');

-- ── STUDENTS ──
create policy "Admin lihat semua siswa"
  on students for select using (get_my_role() = 'admin');

create policy "Siswa lihat data sendiri"
  on students for select using (
    profile_id = auth.uid() or parent_profile_id = auth.uid()
  );

create policy "Tutor lihat siswa di kelasnya"
  on students for select using (
    get_my_role() = 'tutor' and
    id in (
      select e.student_id from enrollments e
      join class_groups cg on cg.id = e.class_group_id
      join tutors t on t.id = cg.tutor_id
      where t.profile_id = auth.uid()
    )
  );

create policy "Admin kelola siswa"
  on students for all using (get_my_role() = 'admin');

-- ── CLASS GROUPS ──
create policy "Admin lihat semua kelas"
  on class_groups for select using (get_my_role() = 'admin');

create policy "Tutor lihat kelas sendiri"
  on class_groups for select using (
    tutor_id in (select id from tutors where profile_id = auth.uid())
  );

create policy "Siswa lihat kelas yang diikuti"
  on class_groups for select using (
    id in (
      select class_group_id from enrollments e
      join students s on s.id = e.student_id
      where s.profile_id = auth.uid() or s.parent_profile_id = auth.uid()
    )
  );

create policy "Admin kelola kelas"
  on class_groups for all using (get_my_role() = 'admin');

-- ── ENROLLMENTS ──
create policy "Admin lihat semua enrollment"
  on enrollments for select using (get_my_role() = 'admin');

create policy "Siswa lihat enrollment sendiri"
  on enrollments for select using (
    student_id in (
      select id from students
      where profile_id = auth.uid() or parent_profile_id = auth.uid()
    )
  );

create policy "Tutor lihat enrollment di kelasnya"
  on enrollments for select using (
    class_group_id in (
      select cg.id from class_groups cg
      join tutors t on t.id = cg.tutor_id
      where t.profile_id = auth.uid()
    )
  );

create policy "Admin kelola enrollment"
  on enrollments for all using (get_my_role() = 'admin');

-- ── SESSIONS ──
create policy "Admin lihat semua sesi"
  on sessions for select using (get_my_role() = 'admin');

create policy "Tutor lihat sesi kelas sendiri"
  on sessions for select using (
    class_group_id in (
      select cg.id from class_groups cg
      join tutors t on t.id = cg.tutor_id
      where t.profile_id = auth.uid()
    )
  );

create policy "Siswa lihat sesi kelas yang diikuti"
  on sessions for select using (
    class_group_id in (
      select e.class_group_id from enrollments e
      join students s on s.id = e.student_id
      where s.profile_id = auth.uid() or s.parent_profile_id = auth.uid()
    )
  );

create policy "Admin kelola sesi"
  on sessions for all using (get_my_role() = 'admin');

-- ── SESSION LOGS ──
create policy "Admin lihat semua log"
  on session_logs for select using (get_my_role() = 'admin');

create policy "Tutor lihat & buat log sesi sendiri"
  on session_logs for select using (
    tutor_id in (select id from tutors where profile_id = auth.uid())
  );

create policy "Tutor insert log sesi sendiri"
  on session_logs for insert with check (
    tutor_id in (select id from tutors where profile_id = auth.uid())
  );

create policy "Siswa lihat log kelas yang diikuti"
  on session_logs for select using (
    session_id in (
      select s.id from sessions s
      join class_groups cg on cg.id = s.class_group_id
      join enrollments e on e.class_group_id = cg.id
      join students st on st.id = e.student_id
      where st.profile_id = auth.uid() or st.parent_profile_id = auth.uid()
    )
  );

-- ── PAYMENTS ──
create policy "Admin kelola semua pembayaran"
  on payments for all using (get_my_role() = 'admin');

create policy "Siswa lihat pembayaran sendiri"
  on payments for select using (
    student_id in (
      select id from students
      where profile_id = auth.uid() or parent_profile_id = auth.uid()
    )
  );

-- ── SESSION ATTENDANCES ──
create policy "Admin lihat semua absensi"
  on session_attendances for select using (get_my_role() = 'admin');

create policy "Tutor kelola absensi sesi sendiri"
  on session_attendances for all using (
    session_id in (
      select s.id from sessions s
      join class_groups cg on cg.id = s.class_group_id
      join tutors t on t.id = cg.tutor_id
      where t.profile_id = auth.uid()
    )
  );

create policy "Siswa lihat absensi sendiri"
  on session_attendances for select using (
    student_id in (
      select id from students
      where profile_id = auth.uid() or parent_profile_id = auth.uid()
    )
  );

-- ── LANDING CONTENT (public read) ──
create policy "Semua bisa baca testimoni yang visible"
  on landing_testimonials for select using (is_visible = true or get_my_role() = 'admin');

create policy "Admin kelola testimoni"
  on landing_testimonials for all using (get_my_role() = 'admin');

create policy "Semua bisa baca FAQ yang visible"
  on landing_faqs for select using (is_visible = true or get_my_role() = 'admin');

create policy "Admin kelola FAQ"
  on landing_faqs for all using (get_my_role() = 'admin');

-- ═══════════════════════════════════════════════════════════
-- SEED DATA: Testimoni & FAQ untuk Landing Page
-- ═══════════════════════════════════════════════════════════

insert into landing_testimonials (name, role_label, course_tag, quote, sort_order) values
  ('Ibu Sari Rahayu',  'Orang tua siswa kelas 5 SD', 'Bahasa Inggris',
   'Anak saya yang dulunya takut berbicara bahasa Inggris, sekarang sudah berani presentasi di sekolah.', 1),
  ('Bapak Rian Firdaus','Orang tua siswa SMP',        'Matematika',
   'Saya suka fitur foto belajarnya — bisa lihat langsung apa yang dipelajari anak setiap sesinya.', 2),
  ('Dewi Wulandari',   'Siswa SMA',                   'Bahasa Arab',
   'Pengajarnya sabar dan materi Bahasa Arabnya sangat terstruktur.', 3);

insert into landing_faqs (question, answer, sort_order) values
  ('Apakah ada kelas percobaan gratis sebelum daftar?',
   'Ya! Kami menyediakan sesi percobaan gratis (trial class). Hubungi admin via WhatsApp untuk menjadwalkan.', 1),
  ('Bagaimana model paket belajar EduKazia?',
   'Setiap paket terdiri dari 8 sesi per periode. Sesi dilaksanakan via Zoom Meeting sesuai jadwal yang disepakati.', 2),
  ('Apakah sesi bisa dijadwalkan ulang (reschedule)?',
   'Ya, sesi dapat dijadwalkan ulang atas kesepakatan bersama antara siswa dan tutor, disetujui admin.', 3),
  ('Apa perbedaan Kelas Reguler, Semi Privat, dan Privat?',
   'Reguler maks. 8 siswa, Semi Privat maks. 4 siswa, Privat 1-on-1 dengan tutor. Semakin kecil kelasnya, semakin personal perhatian dari tutor.', 4),
  ('Bagaimana cara mendaftar?',
   'Cukup hubungi admin EduKazia via WhatsApp atau isi form pendaftaran di halaman ini. Tim kami akan menghubungimu dalam 1x24 jam.', 5);

-- ═══════════════════════════════════════════════════════════
-- STORAGE BUCKET untuk foto sesi tutor
-- ═══════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public)
values ('session-photos', 'session-photos', false);

create policy "Tutor upload foto sesi sendiri"
  on storage.objects for insert
  with check (
    bucket_id = 'session-photos' and
    auth.role() = 'authenticated'
  );

create policy "Baca foto: admin, tutor, siswa terkait"
  on storage.objects for select
  using (bucket_id = 'session-photos' and auth.role() = 'authenticated');
