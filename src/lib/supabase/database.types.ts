export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      activities: {
        Row: {
          body: string
          contact_id: string | null
          created_at: string
          created_by: string | null
          id: string
          kind: Database['public']['Enums']['activity_kind']
          occurred_at: string
          org_id: string
          updated_at: string
        }
        Insert: {
          body: string
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: Database['public']['Enums']['activity_kind']
          occurred_at?: string
          org_id: string
          updated_at?: string
        }
        Update: {
          body?: string
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: Database['public']['Enums']['activity_kind']
          occurred_at?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'activities_contact_id_fkey'
            columns: ['contact_id']
            isOneToOne: false
            referencedRelation: 'contacts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'activities_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'activities_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organisations'
            referencedColumns: ['id']
          },
        ]
      }
      contacts: {
        Row: {
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          is_primary: boolean
          name: string
          org_id: string
          phone: string | null
          title: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_primary?: boolean
          name: string
          org_id: string
          phone?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_primary?: boolean
          name?: string
          org_id?: string
          phone?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'contacts_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'contacts_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organisations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'contacts_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      customers: {
        Row: {
          annual_value: number | null
          created_at: string
          details: NonNullable<Json>
          expected_close: string | null
          org_id: string
          outcome_reason: string | null
          owner_id: string | null
          plan: string | null
          renews_on: string | null
          source: string | null
          stage: Database['public']['Enums']['customer_stage']
          stage_changed_at: string
          updated_at: string
          won_at: string | null
        }
        Insert: {
          annual_value?: number | null
          created_at?: string
          details?: NonNullable<Json>
          expected_close?: string | null
          org_id: string
          outcome_reason?: string | null
          owner_id?: string | null
          plan?: string | null
          renews_on?: string | null
          source?: string | null
          stage: Database['public']['Enums']['customer_stage']
          stage_changed_at?: string
          updated_at?: string
          won_at?: string | null
        }
        Update: {
          annual_value?: number | null
          created_at?: string
          details?: NonNullable<Json>
          expected_close?: string | null
          org_id?: string
          outcome_reason?: string | null
          owner_id?: string | null
          plan?: string | null
          renews_on?: string | null
          source?: string | null
          stage?: Database['public']['Enums']['customer_stage']
          stage_changed_at?: string
          updated_at?: string
          won_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'customers_org_id_fkey'
            columns: ['org_id']
            isOneToOne: true
            referencedRelation: 'organisations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'customers_owner_id_fkey'
            columns: ['owner_id']
            isOneToOne: false
            referencedRelation: 'platform_members'
            referencedColumns: ['user_id']
          },
        ]
      }
      enquiry_attempts: {
        Row: {
          created_at: string
          email: string
          id: string
          ip_hash: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          ip_hash: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          ip_hash?: string
        }
        Relationships: []
      }
      invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          access_expires_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          org_id: string
          role: Database['public']['Enums']['org_role']
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          access_expires_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          org_id: string
          role?: Database['public']['Enums']['org_role']
          token?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          access_expires_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          org_id?: string
          role?: Database['public']['Enums']['org_role']
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'invitations_accepted_by_fkey'
            columns: ['accepted_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'invitations_invited_by_fkey'
            columns: ['invited_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'invitations_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organisations'
            referencedColumns: ['id']
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          expires_at: string | null
          org_id: string
          role: Database['public']['Enums']['org_role']
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          org_id: string
          role?: Database['public']['Enums']['org_role']
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          org_id?: string
          role?: Database['public']['Enums']['org_role']
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'memberships_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organisations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'memberships_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      organisations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'organisations_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      platform_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: Database['public']['Enums']['platform_role']
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database['public']['Enums']['platform_role']
          token?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database['public']['Enums']['platform_role']
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'platform_invitations_accepted_by_fkey'
            columns: ['accepted_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'platform_invitations_invited_by_fkey'
            columns: ['invited_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      platform_members: {
        Row: {
          created_at: string
          role: Database['public']['Enums']['platform_role']
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role?: Database['public']['Enums']['platform_role']
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: Database['public']['Enums']['platform_role']
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'platform_members_user_id_fkey'
            columns: ['user_id']
            isOneToOne: true
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      profiles: {
        Row: {
          active_org_id: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          last_sign_in_at: string | null
          phone: string | null
          provider: string | null
          providers: string[] | null
          updated_at: string
        }
        Insert: {
          active_org_id?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          last_sign_in_at?: string | null
          phone?: string | null
          provider?: string | null
          providers?: string[] | null
          updated_at?: string
        }
        Update: {
          active_org_id?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          last_sign_in_at?: string | null
          phone?: string | null
          provider?: string | null
          providers?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'profiles_active_org_id_fkey'
            columns: ['active_org_id']
            isOneToOne: false
            referencedRelation: 'organisations'
            referencedColumns: ['id']
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          due_on: string | null
          id: string
          org_id: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          due_on?: string | null
          id?: string
          org_id: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          due_on?: string | null
          id?: string
          org_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'tasks_assigned_to_fkey'
            columns: ['assigned_to']
            isOneToOne: false
            referencedRelation: 'platform_members'
            referencedColumns: ['user_id']
          },
          {
            foreignKeyName: 'tasks_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tasks_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organisations'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      customer_stage_summary: {
        Row: {
          count: number | null
          stage: Database['public']['Enums']['customer_stage'] | null
          value: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_invitation: {
        Args: { token: string }
        Returns: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          slug: string
          updated_at: string
        }
        SetofOptions: {
          from: '*'
          to: 'organisations'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      accept_platform_invitation: { Args: { token: string }; Returns: undefined }
      auth_providers_array: { Args: { app_metadata: Json }; Returns: string[] }
      backfill_profiles: { Args: Record<PropertyKey, never>; Returns: number }
      can_manage_org_member: {
        Args: { target_org: string; target_role: Database['public']['Enums']['org_role'] }
        Returns: boolean
      }
      can_manage_org_members: { Args: { target_org: string }; Returns: boolean }
      create_lead: {
        Args: { details?: Json; name: string; slug: string; source?: string }
        Returns: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          slug: string
          updated_at: string
        }
        SetofOptions: {
          from: '*'
          to: 'organisations'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_organisation: {
        Args: { name: string; slug: string }
        Returns: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          slug: string
          updated_at: string
        }
        SetofOptions: {
          from: '*'
          to: 'organisations'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_invitation: {
        Args: { token: string }
        Returns: {
          accepted_at: string
          access_expires_at: string
          email: string
          expires_at: string
          invited_by_name: string
          kind: string
          organisation_name: string
          role: string
        }[]
      }
      has_org_role: {
        Args: { roles: Database['public']['Enums']['org_role'][]; target_org: string }
        Returns: boolean
      }
      is_org_member: { Args: { target_org: string }; Returns: boolean }
      is_platform_member: { Args: Record<PropertyKey, never>; Returns: boolean }
      org_role: { Args: { target_org: string }; Returns: Database['public']['Enums']['org_role'] }
      platform_can_access_org: { Args: { target_org: string }; Returns: boolean }
      platform_can_manage_customers: { Args: Record<PropertyKey, never>; Returns: boolean }
      platform_can_manage_member: {
        Args: { target_role: Database['public']['Enums']['platform_role'] }
        Returns: boolean
      }
      platform_can_manage_org: { Args: { target_org: string }; Returns: boolean }
      platform_role: {
        Args: Record<PropertyKey, never>
        Returns: Database['public']['Enums']['platform_role']
      }
      shares_org_with: { Args: { target_user: string }; Returns: boolean }
      slug_from_name: { Args: { name: string }; Returns: string }
      submit_enquiry: {
        Args: {
          contact_name: string
          details?: Json
          email: string
          message?: string
          organisation: string
          phone?: string
          website_url?: string
        }
        Returns: undefined
      }
    }
    Enums: {
      activity_kind: 'note' | 'call' | 'email' | 'meeting' | 'stage_change' | 'joined' | 'enquiry'
      customer_stage: 'lead' | 'qualified' | 'trial' | 'active' | 'churned' | 'lost'
      org_role: 'owner' | 'admin' | 'member'
      platform_role: 'superadmin' | 'admin' | 'support'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      activity_kind: ['note', 'call', 'email', 'meeting', 'stage_change', 'joined', 'enquiry'],
      customer_stage: ['lead', 'qualified', 'trial', 'active', 'churned', 'lost'],
      org_role: ['owner', 'admin', 'member'],
      platform_role: ['superadmin', 'admin', 'support'],
    },
  },
} as const
