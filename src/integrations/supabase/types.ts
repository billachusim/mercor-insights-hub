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
      chat_messages: {
        Row: {
          citations: Json | null
          content: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          citations?: Json | null
          content: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          citations?: Json | null
          content?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_briefs: {
        Row: {
          action_items: Json
          brief_date: string
          bucket_counts: Json
          confidence: string
          created_at: string
          highlights: Json
          item_count: number
          markdown: string
          posted_to_slack: boolean
        }
        Insert: {
          action_items?: Json
          brief_date: string
          bucket_counts?: Json
          confidence?: string
          created_at?: string
          highlights?: Json
          item_count?: number
          markdown: string
          posted_to_slack?: boolean
        }
        Update: {
          action_items?: Json
          brief_date?: string
          bucket_counts?: Json
          confidence?: string
          created_at?: string
          highlights?: Json
          item_count?: number
          markdown?: string
          posted_to_slack?: boolean
        }
        Relationships: []
      }
      item_analysis: {
        Row: {
          bucket: string
          countries: string[]
          created_at: string
          embedding: string | null
          item_id: string
          pay_amount: number | null
          project_names: string[]
          sentiment: string | null
          signal_score: number
          skills: string[]
          summary: string
        }
        Insert: {
          bucket: string
          countries?: string[]
          created_at?: string
          embedding?: string | null
          item_id: string
          pay_amount?: number | null
          project_names?: string[]
          sentiment?: string | null
          signal_score?: number
          skills?: string[]
          summary: string
        }
        Update: {
          bucket?: string
          countries?: string[]
          created_at?: string
          embedding?: string | null
          item_id?: string
          pay_amount?: number | null
          project_names?: string[]
          sentiment?: string | null
          signal_score?: number
          skills?: string[]
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_analysis_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: true
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          author: string | null
          body: string | null
          created_at: string
          external_id: string | null
          id: string
          published_at: string
          raw: Json | null
          source_id: string | null
          source_kind: string
          source_label: string
          title: string
          url: string
          url_hash: string
        }
        Insert: {
          author?: string | null
          body?: string | null
          created_at?: string
          external_id?: string | null
          id?: string
          published_at: string
          raw?: Json | null
          source_id?: string | null
          source_kind: string
          source_label: string
          title: string
          url: string
          url_hash: string
        }
        Update: {
          author?: string | null
          body?: string | null
          created_at?: string
          external_id?: string | null
          id?: string
          published_at?: string
          raw?: Json | null
          source_id?: string | null
          source_kind?: string
          source_label?: string
          title?: string
          url?: string
          url_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "items_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      sources: {
        Row: {
          active: boolean
          created_at: string
          id: string
          kind: string
          label: string
          last_polled_at: string | null
          url: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          kind: string
          label: string
          last_polled_at?: string | null
          url: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          kind?: string
          label?: string
          last_polled_at?: string | null
          url?: string
        }
        Relationships: []
      }
      weekly_reports: {
        Row: {
          created_at: string
          markdown: string
          posted_to_slack: boolean
          trends: Json
          week_start: string
        }
        Insert: {
          created_at?: string
          markdown: string
          posted_to_slack?: boolean
          trends?: Json
          week_start: string
        }
        Update: {
          created_at?: string
          markdown?: string
          posted_to_slack?: boolean
          trends?: Json
          week_start?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      search_items: {
        Args: { match_count?: number; query_embedding: string }
        Returns: {
          bucket: string
          item_id: string
          published_at: string
          similarity: number
          summary: string
          title: string
          url: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
