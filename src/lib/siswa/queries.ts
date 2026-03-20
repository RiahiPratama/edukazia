// ============================================================
// queries.ts — semua Supabase query untuk dashboard siswa
// ============================================================
import { SupabaseClient } from '@supabase/supabase-js'

// ------------------------------------------------------------------
// Dashboard — semua data yang dibutuhkan /siswa/dashboard
// ------------------------------------------------------------------
export async function getDashboardData(supabase: SupabaseClient, studentId: string) {
  const [sessions, laporan, enrollments] = await Promise.all([
    // Jadwal hari ini (WIT) — ambil sesi yang scheduled_at = hari ini
    supabase
      .from('sessions')
      .select(`
        id, scheduled_at, status, zoom_link,
        class_groups(
          id, label,
          courses(id, name),
          profiles!class_groups_tutor_id_fkey(full_name)
        )
      `)
      .gte('scheduled_at', getTodayStartWIT())
      .lte('scheduled_at', getTodayEndWIT())
      .in('class_groups.id', await getStudentClassGroupIds(supabase, studentId))
      .order('scheduled_at'),

    // Laporan terbaru dari tutor
    supabase
      .from('session_reports')
      .select(`
        id, materi, perkembangan, saran_siswa, saran_ortu, created_at,
        sessions(
          scheduled_at,
          class_groups(
            courses(name),
            profiles!class_groups_tutor_id_fkey(full_name)
          )
        )
      `)
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
      .limit(3),

    // Progress sesi per enrollment
    supabase
      .from('enrollments')
      .select(`
        id, sessions_total, session_start_offset, status, end_date, status_override,
        class_groups(
          id,
          courses(id, name),
          sessions(id, status)
        )
      `)
      .eq('student_id', studentId),
  ])

  return {
    sessions: sessions.data ?? [],
    laporan: laporan.data ?? [],
    enrollments: enrollments.data ?? [],
  }
}

// ------------------------------------------------------------------
// Jadwal — semua sesi siswa (per minggu)
// ------------------------------------------------------------------
export async function getJadwalData(
  supabase: SupabaseClient,
  studentId: string,
  weekStart: string,
  weekEnd: string
) {
  const classGroupIds = await getStudentClassGroupIds(supabase, studentId)

  const { data } = await supabase
    .from('sessions')
    .select(`
      id, scheduled_at, status, zoom_link,
      class_groups(
        id, label, class_type_id,
        courses(id, name),
        profiles!class_groups_tutor_id_fkey(full_name)
      ),
      attendances(id, status, notes)
    `)
    .in('class_group_id', classGroupIds)
    .gte('scheduled_at', weekStart)
    .lte('scheduled_at', weekEnd)
    .order('scheduled_at')

  return data ?? []
}

// ------------------------------------------------------------------
// Laporan — session_reports + attendances
// ------------------------------------------------------------------
export async function getLaporanData(
  supabase: SupabaseClient,
  studentId: string,
  courseId?: string
) {
  let query = supabase
    .from('session_reports')
    .select(`
      id, materi, perkembangan, saran_siswa, saran_ortu, created_at,
      sessions(
        id, scheduled_at,
        class_groups(
          courses(id, name),
          profiles!class_groups_tutor_id_fkey(full_name)
        )
      ),
      attendances(id, status, notes)
    `)
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })

  if (courseId) {
    // filter by course via sessions.class_groups.course_id
    query = query.eq('sessions.class_groups.course_id', courseId)
  }

  const { data } = await query
  return data ?? []
}

// ------------------------------------------------------------------
// Materi — daftar materi yang bisa diakses siswa
// ------------------------------------------------------------------
export async function getMateriData(
  supabase: SupabaseClient,
  studentId: string,
  courseId?: string
) {
  const classGroupIds = await getStudentClassGroupIds(supabase, studentId)

  let query = supabase
    .from('materials')
    .select(`
      id, title, type, order_number, content, url, is_published, created_at,
      courses(id, name),
      class_groups(id, label),
      sessions(id, scheduled_at),
      profiles!materials_created_by_fkey(full_name),
      material_progress(id, is_read, read_at)
    `)
    .eq('is_published', true)
    .or(
      `class_group_id.is.null,class_group_id.in.(${classGroupIds.join(',')})`
    )
    .order('order_number')

  if (courseId) query = query.eq('course_id', courseId)

  const { data } = await query
  return data ?? []
}

// ------------------------------------------------------------------
// Kehadiran — ringkasan absensi untuk halaman laporan
// ------------------------------------------------------------------
export async function getAttendanceSummary(
  supabase: SupabaseClient,
  studentId: string
) {
  const { data } = await supabase
    .from('attendances')
    .select('status')
    .eq('student_id', studentId)

  const summary = { hadir: 0, izin: 0, sakit: 0, alpha: 0 }
  data?.forEach(a => {
    if (a.status in summary) summary[a.status as keyof typeof summary]++
  })
  return summary
}

// ------------------------------------------------------------------
// Helper internal — ambil class_group_id milik siswa
// ------------------------------------------------------------------
async function getStudentClassGroupIds(
  supabase: SupabaseClient,
  studentId: string
): Promise<string[]> {
  const { data } = await supabase
    .from('enrollments')
    .select('class_group_id')
    .eq('student_id', studentId)
    .eq('status', 'active')

  return data?.map(e => e.class_group_id).filter(Boolean) ?? []
}

// ------------------------------------------------------------------
// Helper — awal & akhir hari ini dalam WIT (UTC+9) → UTC untuk query
// ------------------------------------------------------------------
function getTodayStartWIT(): string {
  const now = new Date()
  const wit = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jayapura' }))
  wit.setHours(0, 0, 0, 0)
  return new Date(wit.getTime() - 9 * 60 * 60 * 1000).toISOString()
}

function getTodayEndWIT(): string {
  const now = new Date()
  const wit = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jayapura' }))
  wit.setHours(23, 59, 59, 999)
  return new Date(wit.getTime() - 9 * 60 * 60 * 1000).toISOString()
}
