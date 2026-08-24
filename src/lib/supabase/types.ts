export type UserRole = 'parent' | 'teacher' | 'owner'
export type RecurrenceType = 'one_off' | 'weekly'
export type SessionSource = 'algorithm' | 'manual'
export type SessionStatus = 'pending' | 'accepted' | 'declined' | 'cancelled' | 'completed'
export type StudentStatus = 'student' | 'non_student' | 'inactive'
export type HolidayType = 'school' | 'public'
export type TeacherStatus = 'teacher' | 'therapist'
export type ServesScope = 'student_only' | 'non_student_only' | 'both'
export type RankFactor = 'priority' | 'rate' | 'protocol_needs' | 'match_quality' | 'teacher_rating'
export type SortDirection = 'asc' | 'desc'

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
          weekly_quota: number | null
          daily_quota: number | null
          status: TeacherStatus | null
          serves_scope: ServesScope | null
          created_at: string
        }
        Insert: {
          id: string
          role: UserRole
          name: string
          phone?: string | null
          email?: string | null
          priority_tier?: number
          weekly_quota?: number | null
          daily_quota?: number | null
          status?: TeacherStatus | null
          serves_scope?: ServesScope | null
          created_at?: string
        }
        Update: {
          id?: string
          role?: UserRole
          name?: string
          phone?: string | null
          email?: string | null
          priority_tier?: number
          weekly_quota?: number | null
          daily_quota?: number | null
          status?: TeacherStatus | null
          serves_scope?: ServesScope | null
          created_at?: string
        }
        Relationships: []
      }
      protocols: {
        Row: {
          id: string
          title: string
          instructions: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          instructions?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          title?: string
          instructions?: string | null
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      sub_protocols: {
        Row: {
          id: string
          protocol_id: string
          title: string
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          protocol_id: string
          title: string
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          protocol_id?: string
          title?: string
          is_active?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'sub_protocols_protocol_id_fkey'
            columns: ['protocol_id']
            isOneToOne: false
            referencedRelation: 'protocols'
            referencedColumns: ['id']
          },
        ]
      }
      students: {
        Row: {
          id: string
          parent_id: string
          name: string
          date_of_birth: string | null
          rate_per_session: number | null
          priority: number | null
          status: StudentStatus | null
          weekly_target_sessions: number
          created_at: string
        }
        Insert: {
          id?: string
          parent_id: string
          name: string
          date_of_birth?: string | null
          rate_per_session?: number | null
          priority?: number | null
          status?: StudentStatus | null
          weekly_target_sessions?: number
          created_at?: string
        }
        Update: {
          id?: string
          parent_id?: string
          name?: string
          date_of_birth?: string | null
          rate_per_session?: number | null
          priority?: number | null
          status?: StudentStatus | null
          weekly_target_sessions?: number
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
      student_protocols: {
        Row: {
          id: string
          student_id: string
          protocol_id: string
          sub_protocol_id: string | null
        }
        Insert: {
          id?: string
          student_id: string
          protocol_id: string
          sub_protocol_id?: string | null
        }
        Update: {
          id?: string
          student_id?: string
          protocol_id?: string
          sub_protocol_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'student_protocols_student_id_fkey'
            columns: ['student_id']
            isOneToOne: false
            referencedRelation: 'students'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'student_protocols_protocol_id_fkey'
            columns: ['protocol_id']
            isOneToOne: false
            referencedRelation: 'protocols'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'student_protocols_sub_protocol_id_fkey'
            columns: ['sub_protocol_id']
            isOneToOne: false
            referencedRelation: 'sub_protocols'
            referencedColumns: ['id']
          },
        ]
      }
      student_availability: {
        Row: {
          id: string
          student_id: string
          day_of_week: number | null
          specific_date: string | null
          start_time: string
          end_time: string
        }
        Insert: {
          id?: string
          student_id: string
          day_of_week?: number | null
          specific_date?: string | null
          start_time: string
          end_time: string
        }
        Update: {
          id?: string
          student_id?: string
          day_of_week?: number | null
          specific_date?: string | null
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
      teacher_availability: {
        Row: {
          id: string
          teacher_id: string
          week_start_date: string
          day_of_week: number
          start_time: string
          end_time: string
        }
        Insert: {
          id?: string
          teacher_id: string
          week_start_date: string
          day_of_week: number
          start_time: string
          end_time: string
        }
        Update: {
          id?: string
          teacher_id?: string
          week_start_date?: string
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
      teacher_protocols: {
        Row: {
          id: string
          teacher_id: string
          protocol_id: string
          sub_protocol_id: string | null
          rating: number
          assigned_by: string | null
          assigned_at: string
        }
        Insert: {
          id?: string
          teacher_id: string
          protocol_id: string
          sub_protocol_id?: string | null
          rating: number
          assigned_by?: string | null
          assigned_at?: string
        }
        Update: {
          id?: string
          teacher_id?: string
          protocol_id?: string
          sub_protocol_id?: string | null
          rating?: number
          assigned_by?: string | null
          assigned_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'teacher_protocols_teacher_id_fkey'
            columns: ['teacher_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'teacher_protocols_protocol_id_fkey'
            columns: ['protocol_id']
            isOneToOne: false
            referencedRelation: 'protocols'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'teacher_protocols_sub_protocol_id_fkey'
            columns: ['sub_protocol_id']
            isOneToOne: false
            referencedRelation: 'sub_protocols'
            referencedColumns: ['id']
          },
        ]
      }
      capacity_rules: {
        Row: {
          id: string
          start_time: string
          end_time: string
          max_concurrent: number
          created_at: string
        }
        Insert: {
          id?: string
          start_time: string
          end_time: string
          max_concurrent: number
          created_at?: string
        }
        Update: {
          id?: string
          start_time?: string
          end_time?: string
          max_concurrent?: number
          created_at?: string
        }
        Relationships: []
      }
      teacher_concurrency_rules: {
        Row: {
          id: string
          start_time: string
          end_time: string
          max_concurrent: number
          created_at: string
        }
        Insert: {
          id?: string
          start_time: string
          end_time: string
          max_concurrent: number
          created_at?: string
        }
        Update: {
          id?: string
          start_time?: string
          end_time?: string
          max_concurrent?: number
          created_at?: string
        }
        Relationships: []
      }
      schedule_versions: {
        Row: {
          id: string
          week_start_date: string
          label: string
          proposals: unknown
          unscheduled: unknown
          scheduled_count: number
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          week_start_date: string
          label: string
          proposals: unknown
          unscheduled: unknown
          scheduled_count?: number
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          week_start_date?: string
          label?: string
          proposals?: unknown
          unscheduled?: unknown
          scheduled_count?: number
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'schedule_versions_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      schedule_batches: {
        Row: {
          id: string
          week_start_date: string
          label: string
          created_by: string
          created_at: string
          whatsapp_pushed_at: string | null
        }
        Insert: {
          id?: string
          week_start_date: string
          label: string
          created_by: string
          created_at?: string
          whatsapp_pushed_at?: string | null
        }
        Update: {
          id?: string
          week_start_date?: string
          label?: string
          created_by?: string
          created_at?: string
          whatsapp_pushed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'schedule_batches_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      scheduling_rules: {
        Row: {
          id: boolean
          rank_order: RankFactor[]
          priority_direction: SortDirection
          rate_direction: SortDirection
          protocol_needs_direction: SortDirection
          match_quality_direction: SortDirection
          teacher_rating_direction: SortDirection
          match_quality_threshold: number
          priority_enabled: boolean
          rate_enabled: boolean
          protocol_needs_enabled: boolean
          match_quality_enabled: boolean
          teacher_rating_enabled: boolean
          weekly_minimum_sessions: number
          max_weekly_spread: number
          monthly_checkin_teacher_id: string | null
          prioritized_teacher_id: string | null
          prioritized_protocol_id: string | null
          no_back_to_back_enabled: boolean
          no_back_to_back_teacher_enabled: boolean
          updated_at: string
        }
        Insert: {
          id?: boolean
          rank_order?: RankFactor[]
          priority_direction?: SortDirection
          rate_direction?: SortDirection
          protocol_needs_direction?: SortDirection
          match_quality_direction?: SortDirection
          teacher_rating_direction?: SortDirection
          match_quality_threshold?: number
          priority_enabled?: boolean
          rate_enabled?: boolean
          protocol_needs_enabled?: boolean
          match_quality_enabled?: boolean
          teacher_rating_enabled?: boolean
          weekly_minimum_sessions?: number
          max_weekly_spread?: number
          monthly_checkin_teacher_id?: string | null
          prioritized_teacher_id?: string | null
          prioritized_protocol_id?: string | null
          no_back_to_back_enabled?: boolean
          no_back_to_back_teacher_enabled?: boolean
          updated_at?: string
        }
        Update: {
          id?: boolean
          rank_order?: RankFactor[]
          priority_direction?: SortDirection
          rate_direction?: SortDirection
          protocol_needs_direction?: SortDirection
          match_quality_direction?: SortDirection
          teacher_rating_direction?: SortDirection
          match_quality_threshold?: number
          priority_enabled?: boolean
          rate_enabled?: boolean
          protocol_needs_enabled?: boolean
          match_quality_enabled?: boolean
          teacher_rating_enabled?: boolean
          weekly_minimum_sessions?: number
          max_weekly_spread?: number
          monthly_checkin_teacher_id?: string | null
          prioritized_teacher_id?: string | null
          prioritized_protocol_id?: string | null
          no_back_to_back_enabled?: boolean
          no_back_to_back_teacher_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      prioritized_needs: {
        Row: {
          student_id: string
          protocol_id: string
          created_at: string
        }
        Insert: {
          student_id: string
          protocol_id: string
          created_at?: string
        }
        Update: {
          student_id?: string
          protocol_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'prioritized_needs_student_id_fkey'
            columns: ['student_id']
            isOneToOne: false
            referencedRelation: 'students'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'prioritized_needs_protocol_id_fkey'
            columns: ['protocol_id']
            isOneToOne: false
            referencedRelation: 'protocols'
            referencedColumns: ['id']
          },
        ]
      }
      holidays: {
        Row: {
          id: string
          date: string
          name: string
          type: HolidayType
          created_at: string
        }
        Insert: {
          id?: string
          date: string
          name: string
          type?: HolidayType
          created_at?: string
        }
        Update: {
          id?: string
          date?: string
          name?: string
          type?: HolidayType
          created_at?: string
        }
        Relationships: []
      }
      session_plans: {
        Row: {
          id: string
          student_id: string
          teacher_id: string
          protocol_id: string
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
          schedule_batch_id: string | null
        }
        Insert: {
          id?: string
          student_id: string
          teacher_id: string
          protocol_id: string
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
          schedule_batch_id?: string | null
        }
        Update: {
          id?: string
          student_id?: string
          teacher_id?: string
          protocol_id?: string
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
          schedule_batch_id?: string | null
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
            foreignKeyName: 'session_plans_protocol_id_fkey'
            columns: ['protocol_id']
            isOneToOne: false
            referencedRelation: 'protocols'
            referencedColumns: ['id']
          },
        ]
      }
      session_occurrences: {
        Row: {
          id: string
          session_plan_id: string
          week_start_date: string
          completed_at: string
        }
        Insert: {
          id?: string
          session_plan_id: string
          week_start_date: string
          completed_at?: string
        }
        Update: {
          id?: string
          session_plan_id?: string
          week_start_date?: string
          completed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'session_occurrences_session_plan_id_fkey'
            columns: ['session_plan_id']
            isOneToOne: false
            referencedRelation: 'session_plans'
            referencedColumns: ['id']
          },
        ]
      }
      billing_rates: {
        Row: {
          id: string
          student_id: string
          teacher_id: string | null
          billing_rate: number
          commission_rate: number
          created_at: string
        }
        Insert: {
          id?: string
          student_id: string
          teacher_id?: string | null
          billing_rate: number
          commission_rate: number
          created_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          teacher_id?: string | null
          billing_rate?: number
          commission_rate?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'billing_rates_student_id_fkey'
            columns: ['student_id']
            isOneToOne: false
            referencedRelation: 'students'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'billing_rates_teacher_id_fkey'
            columns: ['teacher_id']
            isOneToOne: false
            referencedRelation: 'profiles'
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
export type Protocol = Database['public']['Tables']['protocols']['Row']
export type SubProtocol = Database['public']['Tables']['sub_protocols']['Row']
export type Student = Database['public']['Tables']['students']['Row']
export type StudentAvailability = Database['public']['Tables']['student_availability']['Row']
export type TeacherAvailability = Database['public']['Tables']['teacher_availability']['Row']
export type TeacherProtocol = Database['public']['Tables']['teacher_protocols']['Row']
export type CapacityRule = Database['public']['Tables']['capacity_rules']['Row']
export type TeacherConcurrencyRule = Database['public']['Tables']['teacher_concurrency_rules']['Row']
export type ScheduleVersion = Database['public']['Tables']['schedule_versions']['Row']
export type ScheduleBatch = Database['public']['Tables']['schedule_batches']['Row']
export type Holiday = Database['public']['Tables']['holidays']['Row']
export type SchedulingRules = Database['public']['Tables']['scheduling_rules']['Row']
export type SessionPlan = Database['public']['Tables']['session_plans']['Row']
export type SessionOccurrence = Database['public']['Tables']['session_occurrences']['Row']
export type BillingRate = Database['public']['Tables']['billing_rates']['Row']
