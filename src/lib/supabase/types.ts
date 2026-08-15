export type UserRole = 'parent' | 'teacher' | 'owner'
export type RecurrenceType = 'one_off' | 'weekly'
export type SessionSource = 'algorithm' | 'manual'
export type SessionStatus = 'pending' | 'accepted' | 'declined' | 'cancelled'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          role: UserRole
          name: string
          phone: string | null
          email: string | null
          priority_tier: number
          created_at: string
        }
        Insert: {
          id: string
          role: UserRole
          name: string
          phone?: string | null
          email?: string | null
          priority_tier?: number
          created_at?: string
        }
        Update: {
          id?: string
          role?: UserRole
          name?: string
          phone?: string | null
          email?: string | null
          priority_tier?: number
          created_at?: string
        }
        Relationships: []
      }
      subjects: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id?: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
        Relationships: []
      }
      students: {
        Row: {
          id: string
          parent_id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          parent_id: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          parent_id?: string
          name?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'students_parent_id_fkey'
            columns: ['parent_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      student_subjects: {
        Row: {
          student_id: string
          subject_id: string
        }
        Insert: {
          student_id: string
          subject_id: string
        }
        Update: {
          student_id?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'student_subjects_student_id_fkey'
            columns: ['student_id']
            isOneToOne: false
            referencedRelation: 'students'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'student_subjects_subject_id_fkey'
            columns: ['subject_id']
            isOneToOne: false
            referencedRelation: 'subjects'
            referencedColumns: ['id']
          },
        ]
      }
      student_availability: {
        Row: {
          id: string
          student_id: string
          day_of_week: number
          start_time: string
          end_time: string
        }
        Insert: {
          id?: string
          student_id: string
          day_of_week: number
          start_time: string
          end_time: string
        }
        Update: {
          id?: string
          student_id?: string
          day_of_week?: number
          start_time?: string
          end_time?: string
        }
        Relationships: [
          {
            foreignKeyName: 'student_availability_student_id_fkey'
            columns: ['student_id']
            isOneToOne: false
            referencedRelation: 'students'
            referencedColumns: ['id']
          },
        ]
      }
      teacher_capabilities: {
        Row: {
          teacher_id: string
          subject_id: string
          rating: number
          rated_by: string | null
          rated_at: string
        }
        Insert: {
          teacher_id: string
          subject_id: string
          rating: number
          rated_by?: string | null
          rated_at?: string
        }
        Update: {
          teacher_id?: string
          subject_id?: string
          rating?: number
          rated_by?: string | null
          rated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'teacher_capabilities_teacher_id_fkey'
            columns: ['teacher_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'teacher_capabilities_subject_id_fkey'
            columns: ['subject_id']
            isOneToOne: false
            referencedRelation: 'subjects'
            referencedColumns: ['id']
          },
        ]
      }
      teacher_availability: {
        Row: {
          id: string
          teacher_id: string
          day_of_week: number
          start_time: string
          end_time: string
        }
        Insert: {
          id?: string
          teacher_id: string
          day_of_week: number
          start_time: string
          end_time: string
        }
        Update: {
          id?: string
          teacher_id?: string
          day_of_week?: number
          start_time?: string
          end_time?: string
        }
        Relationships: [
          {
            foreignKeyName: 'teacher_availability_teacher_id_fkey'
            columns: ['teacher_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      session_plans: {
        Row: {
          id: string
          student_id: string
          teacher_id: string
          subject_id: string
          owner_id: string
          recurrence_type: RecurrenceType
          start_time: string | null
          end_time: string | null
          day_of_week: number | null
          time_of_day_start: string | null
          time_of_day_end: string | null
          source: SessionSource
          status: SessionStatus
          note: string | null
          match_score: number | null
          token: string
          created_at: string
          responded_at: string | null
        }
        Insert: {
          id?: string
          student_id: string
          teacher_id: string
          subject_id: string
          owner_id: string
          recurrence_type: RecurrenceType
          start_time?: string | null
          end_time?: string | null
          day_of_week?: number | null
          time_of_day_start?: string | null
          time_of_day_end?: string | null
          source?: SessionSource
          status?: SessionStatus
          note?: string | null
          match_score?: number | null
          token?: string
          created_at?: string
          responded_at?: string | null
        }
        Update: {
          id?: string
          student_id?: string
          teacher_id?: string
          subject_id?: string
          owner_id?: string
          recurrence_type?: RecurrenceType
          start_time?: string | null
          end_time?: string | null
          day_of_week?: number | null
          time_of_day_start?: string | null
          time_of_day_end?: string | null
          source?: SessionSource
          status?: SessionStatus
          note?: string | null
          match_score?: number | null
          token?: string
          created_at?: string
          responded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'session_plans_student_id_fkey'
            columns: ['student_id']
            isOneToOne: false
            referencedRelation: 'students'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'session_plans_teacher_id_fkey'
            columns: ['teacher_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'session_plans_subject_id_fkey'
            columns: ['subject_id']
            isOneToOne: false
            referencedRelation: 'subjects'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Subject = Database['public']['Tables']['subjects']['Row']
export type Student = Database['public']['Tables']['students']['Row']
export type StudentAvailability = Database['public']['Tables']['student_availability']['Row']
export type TeacherCapability = Database['public']['Tables']['teacher_capabilities']['Row']
export type TeacherAvailability = Database['public']['Tables']['teacher_availability']['Row']
export type SessionPlan = Database['public']['Tables']['session_plans']['Row']
