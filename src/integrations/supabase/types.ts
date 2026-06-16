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
      activities: {
        Row: {
          created_at: string
          emoji: string | null
          id: string
          is_archived: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji?: string | null
          id?: string
          is_archived?: boolean
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string | null
          id?: string
          is_archived?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_errors: {
        Row: {
          created_at: string
          error_message: string
          external_id: string | null
          id: string
          raw_response: Json | null
          source: string
          transcript: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message: string
          external_id?: string | null
          id?: string
          raw_response?: Json | null
          source: string
          transcript?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string
          external_id?: string | null
          id?: string
          raw_response?: Json | null
          source?: string
          transcript?: string | null
          user_id?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string
          after: Json | null
          before: Json | null
          created_at: string
          id: string
          transaction_id: string | null
        }
        Insert: {
          action: string
          actor_id: string
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: string
          transaction_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: string
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          changed_at: string | null
          changed_by: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          operation: string
          row_id: string
          table_name: string
        }
        Insert: {
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          operation: string
          row_id: string
          table_name: string
        }
        Update: {
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          operation?: string
          row_id?: string
          table_name?: string
        }
        Relationships: []
      }
      business_model_canvas: {
        Row: {
          activity_description: string | null
          channels: string | null
          cost_structure: string | null
          created_at: string
          created_by: string | null
          customer_relationships: string | null
          customer_segments: string | null
          id: string
          key_activities: string | null
          key_partners: string | null
          key_resources: string | null
          revenue_streams: string | null
          updated_at: string
          user_id: string
          value_propositions: string | null
        }
        Insert: {
          activity_description?: string | null
          channels?: string | null
          cost_structure?: string | null
          created_at?: string
          created_by?: string | null
          customer_relationships?: string | null
          customer_segments?: string | null
          id?: string
          key_activities?: string | null
          key_partners?: string | null
          key_resources?: string | null
          revenue_streams?: string | null
          updated_at?: string
          user_id: string
          value_propositions?: string | null
        }
        Update: {
          activity_description?: string | null
          channels?: string | null
          cost_structure?: string | null
          created_at?: string
          created_by?: string | null
          customer_relationships?: string | null
          customer_segments?: string | null
          id?: string
          key_activities?: string | null
          key_partners?: string | null
          key_resources?: string | null
          revenue_streams?: string | null
          updated_at?: string
          user_id?: string
          value_propositions?: string | null
        }
        Relationships: []
      }
      coach_assignments: {
        Row: {
          assigned_at: string
          coach_id: string
          entrepreneur_id: string
          id: string
        }
        Insert: {
          assigned_at?: string
          coach_id: string
          entrepreneur_id: string
          id?: string
        }
        Update: {
          assigned_at?: string
          coach_id?: string
          entrepreneur_id?: string
          id?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          activity_id: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          type: Database["public"]["Enums"]["contact_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          type: Database["public"]["Enums"]["contact_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          type?: Database["public"]["Enums"]["contact_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
        ]
      }
      points_of_sale: {
        Row: {
          code: string
          created_at: string
          id: string
          is_archived: boolean
          name: string
          owner_user_id: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_archived?: boolean
          name: string
          owner_user_id: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_archived?: boolean
          name?: string
          owner_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      profile_pins: {
        Row: {
          id: string
          pin_hash: string
          pin_salt: string | null
          updated_at: string | null
        }
        Insert: {
          id: string
          pin_hash: string
          pin_salt?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          pin_hash?: string
          pin_salt?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_pins_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active_activity_id: string | null
          active_pos_id: string | null
          activity_description: string | null
          annual_expenses: number | null
          annual_revenue: number | null
          avatar_url: string | null
          business_name: string | null
          created_at: string
          development_stage: string | null
          founding_year: number | null
          full_name: string | null
          id: string
          language: string
          legal_status: string | null
          ninea: string | null
          onboarding_completed_at: string | null
          owner_user_id: string | null
          phone: string | null
          pos_id: string | null
          priority_needs: string[] | null
          rccm: string | null
          region: string | null
          role_in_pos: string
          sales_channel: string | null
          sector: string | null
          status: string
          team_size: number | null
          updated_at: string
          whatsapp_link: string | null
        }
        Insert: {
          active_activity_id?: string | null
          active_pos_id?: string | null
          activity_description?: string | null
          annual_expenses?: number | null
          annual_revenue?: number | null
          avatar_url?: string | null
          business_name?: string | null
          created_at?: string
          development_stage?: string | null
          founding_year?: number | null
          full_name?: string | null
          id: string
          language?: string
          legal_status?: string | null
          ninea?: string | null
          onboarding_completed_at?: string | null
          owner_user_id?: string | null
          phone?: string | null
          pos_id?: string | null
          priority_needs?: string[] | null
          rccm?: string | null
          region?: string | null
          role_in_pos?: string
          sales_channel?: string | null
          sector?: string | null
          status?: string
          team_size?: number | null
          updated_at?: string
          whatsapp_link?: string | null
        }
        Update: {
          active_activity_id?: string | null
          active_pos_id?: string | null
          activity_description?: string | null
          annual_expenses?: number | null
          annual_revenue?: number | null
          avatar_url?: string | null
          business_name?: string | null
          created_at?: string
          development_stage?: string | null
          founding_year?: number | null
          full_name?: string | null
          id?: string
          language?: string
          legal_status?: string | null
          ninea?: string | null
          onboarding_completed_at?: string | null
          owner_user_id?: string | null
          phone?: string | null
          pos_id?: string | null
          priority_needs?: string[] | null
          rccm?: string | null
          region?: string | null
          role_in_pos?: string
          sales_channel?: string | null
          sector?: string | null
          status?: string
          team_size?: number | null
          updated_at?: string
          whatsapp_link?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_active_activity_id_fkey"
            columns: ["active_activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_active_pos_id_fkey"
            columns: ["active_pos_id"]
            isOneToOne: false
            referencedRelation: "points_of_sale"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_pos_id_fkey"
            columns: ["pos_id"]
            isOneToOne: false
            referencedRelation: "points_of_sale"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          activity_id: string | null
          amount: number
          category: string | null
          coach_note: string | null
          created_at: string
          external_id: string | null
          id: string
          is_credit: boolean
          is_personal: boolean
          label: string | null
          nature: string | null
          occurred_at: string
          paid_amount: number
          pos_id: string | null
          raw_extraction: Json | null
          source: Database["public"]["Enums"]["txn_source"]
          third_party: string | null
          transcript: string | null
          type: Database["public"]["Enums"]["txn_type"]
          updated_at: string
          user_id: string
          validation_status: Database["public"]["Enums"]["txn_validation"]
        }
        Insert: {
          activity_id?: string | null
          amount: number
          category?: string | null
          coach_note?: string | null
          created_at?: string
          external_id?: string | null
          id?: string
          is_credit?: boolean
          is_personal?: boolean
          label?: string | null
          nature?: string | null
          occurred_at?: string
          paid_amount?: number
          pos_id?: string | null
          raw_extraction?: Json | null
          source?: Database["public"]["Enums"]["txn_source"]
          third_party?: string | null
          transcript?: string | null
          type: Database["public"]["Enums"]["txn_type"]
          updated_at?: string
          user_id: string
          validation_status?: Database["public"]["Enums"]["txn_validation"]
        }
        Update: {
          activity_id?: string | null
          amount?: number
          category?: string | null
          coach_note?: string | null
          created_at?: string
          external_id?: string | null
          id?: string
          is_credit?: boolean
          is_personal?: boolean
          label?: string | null
          nature?: string | null
          occurred_at?: string
          paid_amount?: number
          pos_id?: string | null
          raw_extraction?: Json | null
          source?: Database["public"]["Enums"]["txn_source"]
          third_party?: string | null
          transcript?: string | null
          type?: Database["public"]["Enums"]["txn_type"]
          updated_at?: string
          user_id?: string
          validation_status?: Database["public"]["Enums"]["txn_validation"]
        }
        Relationships: [
          {
            foreignKeyName: "transactions_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_pos_id_fkey"
            columns: ["pos_id"]
            isOneToOne: false
            referencedRelation: "points_of_sale"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_my_pin_hash:
        | { Args: never; Returns: string }
        | { Args: { user_id_param: string }; Returns: string }
      get_my_pos_id: { Args: { _uid: string }; Returns: string }
      get_owner_active_activity_id: { Args: { _uid: string }; Returns: string }
      get_owner_id: { Args: { _uid: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_coach_of: {
        Args: { _coach_id: string; _entrepreneur_id: string }
        Returns: boolean
      }
      is_seller: { Args: { _uid: string }; Returns: boolean }
      upsert_my_pin: {
        Args: { p_pin_hash: string; p_pin_salt: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "entrepreneur" | "coach" | "admin"
      contact_type: "CLIENT" | "FOURNISSEUR"
      txn_source: "MANUEL" | "TEXT" | "VOICE"
      txn_type: "IN" | "OUT"
      txn_validation: "VALIDE" | "A_VALIDER"
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
      app_role: ["entrepreneur", "coach", "admin"],
      contact_type: ["CLIENT", "FOURNISSEUR"],
      txn_source: ["MANUEL", "TEXT", "VOICE"],
      txn_type: ["IN", "OUT"],
      txn_validation: ["VALIDE", "A_VALIDER"],
    },
  },
} as const
