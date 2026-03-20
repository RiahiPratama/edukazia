// ============================================================
// helpers.ts — utility functions untuk dashboard siswa
// ============================================================

export type EnrollmentStatus = 'active' | 'expired'

export interface Enrollment {
  id: string
  status: string
  relation_role: string | null
  end_date: string | null
  expired_at: string | null
  status_override: 'active' | 'expired' | null
  course_id: string | null
}

export interface StudentProfile {
  id: string
  full_name: string
  avatar_url: string | null
}

export interface Student {
  id: string
  grade: string
  school: string
  status: string
  relation_role: string | null
  profile: StudentProfile
  enrollments: Enrollment[]
}

// ------------------------------------------------------------------
// Hitung status enrollment sebenarnya:
// priority → status_override > cek end_date > status di DB
// ------------------------------------------------------------------
export function getEnrollmentStatus(enrollment: Enrollment): EnrollmentStatus {
  if (enrollment.status_override) return enrollment.status_override
  if (enrollment.end_date && new Date() > new Date(enrollment.end_date)) return 'expired'
  return enrollment.status as EnrollmentStatus
}

// ------------------------------------------------------------------
// Cek apakah SEMUA enrollment siswa expired
// (dipakai untuk ExpiredBanner & kunci akses fitur)
// ------------------------------------------------------------------
export function isStudentFullyExpired(student: Student): boolean {
  if (!student.enrollments || student.enrollments.length === 0) return false
  return student.enrollments.every(e => getEnrollmentStatus(e) === 'expired')
}

// ------------------------------------------------------------------
// Cek apakah ada minimal 1 enrollment aktif
// ------------------------------------------------------------------
export function hasActiveEnrollment(student: Student): boolean {
  return student.enrollments.some(e => getEnrollmentStatus(e) === 'active')
}

// ------------------------------------------------------------------
// Ambil anak pertama yang aktif, fallback ke anak pertama
// (dipakai saat load layout — child yang sedang "aktif" ditampilkan)
// ------------------------------------------------------------------
export function getActiveChild(childrenList: Student[]): Student | null {
  if (!childrenList || childrenList.length === 0) return null
  return (
    childrenList.find(hasActiveEnrollment) ?? childrenList[0]
  )
}

// ------------------------------------------------------------------
// Format inisial nama untuk avatar (maks 2 huruf)
// ------------------------------------------------------------------
export function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase()
}

// ------------------------------------------------------------------
// Format tanggal ke WIT (UTC+9)
// ------------------------------------------------------------------
export function toWIT(date: string | Date): Date {
  const d = new Date(date)
  return new Date(d.getTime() + 9 * 60 * 60 * 1000)
}

export function formatWIT(date: string | Date): string {
  return new Date(date).toLocaleString('id-ID', {
    timeZone: 'Asia/Jayapura',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export function formatDateWIT(date: string | Date): string {
  return new Date(date).toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jayapura',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
