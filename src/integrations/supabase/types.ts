export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      attendance: {
        Row: {
          class_id: string | null
          created_at: string
          id: string
          join_time: string
          leave_time: string | null
          room_id: string
          student_id: string
          updated_at: string
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          id?: string
          join_time?: string
          leave_time?: string | null
          room_id: string
          student_id: string
          updated_at?: string
        }
        Update: {
          class_id?: string | null
          created_at?: string
          id?: string
          join_time?: string
          leave_time?: string | null
          room_id?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      certificates: {
        Row: {
          certificate_number: string
          course_id: string
          id: string
          issued_at: string
          user_id: string
        }
        Insert: {
          certificate_number?: string
          course_id: string
          id?: string
          issued_at?: string
          user_id: string
        }
        Update: {
          certificate_number?: string
          course_id?: string
          id?: string
          issued_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificates_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      chapters: {
        Row: {
          created_at: string
          id: string
          sort_order: number | null
          subject_id: string
          title: string
          title_hi: string
        }
        Insert: {
          created_at?: string
          id?: string
          sort_order?: number | null
          subject_id: string
          title: string
          title_hi?: string
        }
        Update: {
          created_at?: string
          id?: string
          sort_order?: number | null
          subject_id?: string
          title?: string
          title_hi?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapters_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          category: string
          class_level: string | null
          created_at: string
          created_by: string | null
          description: string | null
          description_hi: string | null
          id: string
          is_free: boolean | null
          is_published: boolean | null
          price: number | null
          thumbnail_url: string | null
          title: string
          title_hi: string
          updated_at: string
        }
        Insert: {
          category?: string
          class_level?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          description_hi?: string | null
          id?: string
          is_free?: boolean | null
          is_published?: boolean | null
          price?: number | null
          thumbnail_url?: string | null
          title: string
          title_hi?: string
          updated_at?: string
        }
        Update: {
          category?: string
          class_level?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          description_hi?: string | null
          id?: string
          is_free?: boolean | null
          is_published?: boolean | null
          price?: number | null
          thumbnail_url?: string | null
          title?: string
          title_hi?: string
          updated_at?: string
        }
        Relationships: []
      }
      doubt_replies: {
        Row: {
          content: string
          created_at: string
          doubt_id: string
          id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          doubt_id: string
          id?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          doubt_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doubt_replies_doubt_id_fkey"
            columns: ["doubt_id"]
            isOneToOne: false
            referencedRelation: "doubts"
            referencedColumns: ["id"]
          },
        ]
      }
      doubts: {
        Row: {
          chapter_id: string | null
          course_id: string | null
          created_at: string
          description: string
          id: string
          status: string | null
          subject_tag: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          chapter_id?: string | null
          course_id?: string | null
          created_at?: string
          description: string
          id?: string
          status?: string | null
          subject_tag?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          chapter_id?: string | null
          course_id?: string | null
          created_at?: string
          description?: string
          id?: string
          status?: string | null
          subject_tag?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doubts_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doubts_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          course_id: string
          enrolled_at: string
          id: string
          progress: number | null
          status: string | null
          user_id: string
        }
        Insert: {
          course_id: string
          enrolled_at?: string
          id?: string
          progress?: number | null
          status?: string | null
          user_id: string
        }
        Update: {
          course_id?: string
          enrolled_at?: string
          id?: string
          progress?: number | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_progress: {
        Row: {
          completed_at: string | null
          id: string
          is_completed: boolean | null
          last_position: number | null
          lesson_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          is_completed?: boolean | null
          last_position?: number | null
          lesson_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          is_completed?: boolean | null
          last_position?: number | null
          lesson_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          chapter_id: string
          content: string | null
          created_at: string
          duration_minutes: number | null
          id: string
          is_free_preview: boolean | null
          pdf_url: string | null
          sort_order: number | null
          title: string
          title_hi: string
          type: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          chapter_id: string
          content?: string | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          is_free_preview?: boolean | null
          pdf_url?: string | null
          sort_order?: number | null
          title: string
          title_hi?: string
          type?: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          chapter_id?: string
          content?: string | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          is_free_preview?: boolean | null
          pdf_url?: string | null
          sort_order?: number | null
          title?: string
          title_hi?: string
          type?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      live_chat_messages: {
        Row: {
          class_id: string
          created_at: string
          id: string
          is_resolved: boolean
          message: string
          message_type: string
          parent_id: string | null
          user_id: string
          user_name: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          is_resolved?: boolean
          message: string
          message_type?: string
          parent_id?: string | null
          user_id: string
          user_name?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          is_resolved?: boolean
          message?: string
          message_type?: string
          parent_id?: string | null
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_chat_messages_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "live_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_chat_messages_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "live_chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      live_classes: {
        Row: {
          course_id: string | null
          created_at: string
          current_students: number
          description: string | null
          duration_minutes: number | null
          ended_at: string | null
          id: string
          max_students: number
          room_id: string
          scheduled_at: string
          started_at: string | null
          status: string
          teacher_id: string
          thumbnail_url: string | null
          title: string
          title_hi: string
          updated_at: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          current_students?: number
          description?: string | null
          duration_minutes?: number | null
          ended_at?: string | null
          id?: string
          max_students?: number
          room_id?: string
          scheduled_at: string
          started_at?: string | null
          status?: string
          teacher_id: string
          thumbnail_url?: string | null
          title: string
          title_hi?: string
          updated_at?: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          current_students?: number
          description?: string | null
          duration_minutes?: number | null
          ended_at?: string | null
          id?: string
          max_students?: number
          room_id?: string
          scheduled_at?: string
          started_at?: string | null
          status?: string
          teacher_id?: string
          thumbnail_url?: string | null
          title?: string
          title_hi?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_classes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean | null
          message: string
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          message: string
          title: string
          type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          message?: string
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          paid_at: string | null
          plan: string
          razorpay_order_id: string
          razorpay_payment_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          paid_at?: string | null
          plan?: string
          razorpay_order_id: string
          razorpay_payment_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          paid_at?: string | null
          plan?: string
          razorpay_order_id?: string
          razorpay_payment_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          board: string | null
          class_level: string | null
          created_at: string
          district: string | null
          experience_years: number | null
          full_name: string
          id: string
          is_disabled: boolean | null
          is_free_student: boolean | null
          is_verified: boolean | null
          language: Database["public"]["Enums"]["app_language"]
          onboarding_completed: boolean
          parent_phone: string | null
          phone: string | null
          qualification: string | null
          school: string | null
          state: string | null
          subjects_taught: string | null
          subscription_plan: string | null
          trial_ends_at: string | null
          trial_starts_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          board?: string | null
          class_level?: string | null
          created_at?: string
          district?: string | null
          experience_years?: number | null
          full_name?: string
          id?: string
          is_disabled?: boolean | null
          is_free_student?: boolean | null
          is_verified?: boolean | null
          language?: Database["public"]["Enums"]["app_language"]
          onboarding_completed?: boolean
          parent_phone?: string | null
          phone?: string | null
          qualification?: string | null
          school?: string | null
          state?: string | null
          subjects_taught?: string | null
          subscription_plan?: string | null
          trial_ends_at?: string | null
          trial_starts_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          board?: string | null
          class_level?: string | null
          created_at?: string
          district?: string | null
          experience_years?: number | null
          full_name?: string
          id?: string
          is_disabled?: boolean | null
          is_free_student?: boolean | null
          is_verified?: boolean | null
          language?: Database["public"]["Enums"]["app_language"]
          onboarding_completed?: boolean
          parent_phone?: string | null
          phone?: string | null
          qualification?: string | null
          school?: string | null
          state?: string | null
          subjects_taught?: string | null
          subscription_plan?: string | null
          trial_ends_at?: string | null
          trial_starts_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subjects: {
        Row: {
          course_id: string
          created_at: string
          id: string
          sort_order: number | null
          title: string
          title_hi: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          sort_order?: number | null
          title: string
          title_hi?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          sort_order?: number | null
          title?: string
          title_hi?: string
        }
        Relationships: [
          {
            foreignKeyName: "subjects_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      test_attempts: {
        Row: {
          answers: Json | null
          created_at: string
          id: string
          percentage: number | null
          score: number | null
          submitted_at: string | null
          test_id: string
          time_taken_seconds: number | null
          total_marks: number | null
          user_id: string
        }
        Insert: {
          answers?: Json | null
          created_at?: string
          id?: string
          percentage?: number | null
          score?: number | null
          submitted_at?: string | null
          test_id: string
          time_taken_seconds?: number | null
          total_marks?: number | null
          user_id: string
        }
        Update: {
          answers?: Json | null
          created_at?: string
          id?: string
          percentage?: number | null
          score?: number | null
          submitted_at?: string | null
          test_id?: string
          time_taken_seconds?: number | null
          total_marks?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_attempts_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      test_questions: {
        Row: {
          answer_text: string | null
          correct_option: string
          id: string
          marks: number | null
          option_a: string
          option_b: string
          option_c: string
          option_d: string
          question: string
          question_hi: string | null
          question_type: string
          sort_order: number | null
          test_id: string
        }
        Insert: {
          answer_text?: string | null
          correct_option: string
          id?: string
          marks?: number | null
          option_a: string
          option_b: string
          option_c: string
          option_d: string
          question: string
          question_hi?: string | null
          question_type?: string
          sort_order?: number | null
          test_id: string
        }
        Update: {
          answer_text?: string | null
          correct_option?: string
          id?: string
          marks?: number | null
          option_a?: string
          option_b?: string
          option_c?: string
          option_d?: string
          question?: string
          question_hi?: string | null
          question_type?: string
          sort_order?: number | null
          test_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_questions_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      tests: {
        Row: {
          chapter_id: string | null
          course_id: string | null
          created_at: string
          created_by: string | null
          duration_minutes: number | null
          id: string
          is_published: boolean | null
          scheduled_at: string | null
          title: string
          title_hi: string
          total_marks: number | null
          type: string
        }
        Insert: {
          chapter_id?: string | null
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          duration_minutes?: number | null
          id?: string
          is_published?: boolean | null
          scheduled_at?: string | null
          title: string
          title_hi?: string
          total_marks?: number | null
          type?: string
        }
        Update: {
          chapter_id?: string | null
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          duration_minutes?: number | null
          id?: string
          is_published?: boolean | null
          scheduled_at?: string | null
          title?: string
          title_hi?: string
          total_marks?: number | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "tests_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tests_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      profiles_public: {
        Row: {
          avatar_url: string | null
          bio: string | null
          class_level: string | null
          created_at: string | null
          district: string | null
          experience_years: number | null
          full_name: string | null
          is_disabled: boolean | null
          is_free_student: boolean | null
          is_verified: boolean | null
          language: Database["public"]["Enums"]["app_language"] | null
          qualification: string | null
          school: string | null
          state: string | null
          subjects_taught: string | null
          subscription_plan: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          class_level?: string | null
          created_at?: string | null
          district?: string | null
          experience_years?: number | null
          full_name?: string | null
          is_disabled?: boolean | null
          is_free_student?: boolean | null
          is_verified?: boolean | null
          language?: Database["public"]["Enums"]["app_language"] | null
          qualification?: string | null
          school?: string | null
          state?: string | null
          subjects_taught?: string | null
          subscription_plan?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          class_level?: string | null
          created_at?: string | null
          district?: string | null
          experience_years?: number | null
          full_name?: string | null
          is_disabled?: boolean | null
          is_free_student?: boolean | null
          is_verified?: boolean | null
          language?: Database["public"]["Enums"]["app_language"] | null
          qualification?: string | null
          school?: string | null
          state?: string | null
          subjects_taught?: string | null
          subscription_plan?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      teacher_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          district: string | null
          experience_years: number | null
          full_name: string | null
          qualification: string | null
          school: string | null
          state: string | null
          subjects_taught: string | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      auto_end_live_classes: { Args: never; Returns: undefined }
      auto_update_live_classes: { Args: never; Returns: undefined }
      backfill_profile_from_auth_metadata: { Args: never; Returns: undefined }
      get_test_questions_safe: {
        Args: { _test_id: string }
        Returns: {
          id: string
          marks: number
          option_a: string
          option_b: string
          option_c: string
          option_d: string
          question: string
          question_type: string
          sort_order: number
        }[]
      }
      get_total_revenue: { Args: never; Returns: number }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      grade_and_submit_test: {
        Args: { _answers: Json; _test_id: string; _time_taken_seconds: number }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      promote_user_to_admin: { Args: { target_email: string }; Returns: string }
      run_profile_backfill: { Args: never; Returns: undefined }
    }
    Enums: {
      app_language: "hindi" | "english"
      app_role: "admin" | "teacher" | "student"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_language: ["hindi", "english"],
      app_role: ["admin", "teacher", "student"],
    },
  },
} as const
