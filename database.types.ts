// ═══════════════════════════════════════════════════════════
// EduKazia — Database Types
// File ini idealnya di-generate otomatis dengan perintah:
//   npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/database.types.ts
//
// Gunakan file ini sebagai referensi awal sampai CLI tersedia.
// ═══════════════════════════════════════════════════════════

export type UserRole      = 'admin' | 'tutor' | 'student'
export type SessionStatus = 'scheduled' | 'completed' | 'cancelled' | 'rescheduled'
export type AttendStatus  = 'present' | 'absent' | 'excused'
export type EnrollStatus  = 'active' | 'completed' | 'paused'
export type PaymentMethod = 'transfer' | 'cash'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id:         string
          full_name:  string
          phone:      string | null
          birth_date: string | null
          role:       UserRole
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      courses: {
        Row: {
          id:          string
          name:        string
          description: string | null
          color:       string
          is_active:   boolean
          sort_order:  number
          created_at:  string
        }
        Insert: Omit<Database['public']['Tables']['courses']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['courses']['Insert']>
      }
      class_types: {
        Row: {
          id:               string
          name:             string
          max_participants: number
          description:      string | null
          sort_order:       number
        }
        Insert: Omit<Database['public']['Tables']['class_types']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['class_types']['Insert']>
      }
      packages: {
        Row: {
          id:             string
          course_id:      string
          class_type_id:  string
          name:           string
          total_sessions: number
          price:          number
          is_active:      boolean
          created_at:     string
        }
        Insert: Omit<Database['public']['Tables']['packages']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['packages']['Insert']>
      }
      tutors: {
        Row: {
          id:               string
          profile_id:       string
          rate_per_session: number
          bank_name:        string | null
          bank_account:     string | null
          bank_holder:      string | null
          is_active:        boolean
          created_at:       string
        }
        Insert: Omit<Database['public']['Tables']['tutors']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['tutors']['Insert']>
      }
      tutor_courses: {
        Row: {
          id:        string
          tutor_id:  string
          course_id: string
        }
        Insert: Omit<Database['public']['Tables']['tutor_courses']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['tutor_courses']['Insert']>
      }
      students: {
        Row: {
          id:                string
          profile_id:        string
          parent_profile_id: string | null
          grade:             string | null
          school:            string | null
          notes:             string | null
          created_at:        string
        }
        Insert: Omit<Database['public']['Tables']['students']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['students']['Insert']>
      }
      class_groups: {
        Row: {
          id:                   string
          course_id:            string
          class_type_id:        string
          tutor_id:             string
          label:                string
          current_participants: number
          status:               string
          start_date:           string | null
          created_at:           string
        }
        Insert: Omit<Database['public']['Tables']['class_groups']['Row'], 'id' | 'current_participants' | 'created_at'>
        Update: Partial<Database['public']['Tables']['class_groups']['Insert']>
      }
      enrollments: {
        Row: {
          id:             string
          student_id:     string
          class_group_id: string
          package_id:     string
          sessions_used:  number
          sessions_total: number
          status:         EnrollStatus
          enrolled_at:    string
        }
        Insert: Omit<Database['public']['Tables']['enrollments']['Row'], 'id' | 'sessions_used' | 'enrolled_at'>
        Update: Partial<Database['public']['Tables']['enrollments']['Insert']>
      }
      sessions: {
        Row: {
          id:                     string
          class_group_id:         string
          scheduled_at:           string
          zoom_link:              string | null
          status:                 SessionStatus
          reschedule_reason:      string | null
          rescheduled_at:         string | null
          original_scheduled_at:  string | null
          created_at:             string
        }
        Insert: Omit<Database['public']['Tables']['sessions']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['sessions']['Insert']>
      }
      session_attendances: {
        Row: {
          id:         string
          session_id: string
          student_id: string
          status:     AttendStatus
        }
        Insert: Omit<Database['public']['Tables']['session_attendances']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['session_attendances']['Insert']>
      }
      session_logs: {
        Row: {
          id:             string
          session_id:     string
          tutor_id:       string
          confirmed_at:   string
          material_notes: string | null
          photo_urls:     string[]
          created_at:     string
        }
        Insert: Omit<Database['public']['Tables']['session_logs']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['session_logs']['Insert']>
      }
      payments: {
        Row: {
          id:             string
          student_id:     string
          enrollment_id:  string
          amount:         number
          method:         PaymentMethod
          reference_note: string | null
          paid_at:        string
          created_by:     string | null
          created_at:     string
        }
        Insert: Omit<Database['public']['Tables']['payments']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['payments']['Insert']>
      }
      landing_testimonials: {
        Row: {
          id:         string
          name:       string
          role_label: string | null
          course_tag: string | null
          quote:      string
          is_visible: boolean
          sort_order: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['landing_testimonials']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['landing_testimonials']['Insert']>
      }
      landing_faqs: {
        Row: {
          id:         string
          question:   string
          answer:     string
          is_visible: boolean
          sort_order: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['landing_faqs']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['landing_faqs']['Insert']>
      }
    }
    Functions: {
      get_my_role: {
        Args: Record<string, never>
        Returns: UserRole
      }
    }
  }
}
