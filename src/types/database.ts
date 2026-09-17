export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      categories: {
        Row: { created_at: string | null; household_id: string; id: string; is_default: boolean; name: string };
        Insert: { created_at?: string | null; household_id: string; id?: string; is_default?: boolean; name: string };
        Update: { is_default?: boolean; name?: string };
        Relationships: [];
      };
      household_invitations: {
        Row: { consumed_at: string | null; consumed_by: string | null; created_at: string; created_by: string; expires_at: string; household_id: string; id: string; revoked_at: string | null; token_hash: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      household_members: {
        Row: { household_id: string; joined_at: string | null; role: Database['public']['Enums']['household_role']; user_id: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      households: {
        Row: { created_at: string | null; id: string; name: string };
        Insert: never;
        Update: { name?: string };
        Relationships: [];
      };
      items: {
        Row: {
          already_notified: boolean;
          category_id: string | null;
          created_at: string | null;
          default_item_id: string | null;
          household_id: string;
          id: string;
          last_modified_at: string | null;
          last_modified_by: string | null;
          low_stock_threshold: number;
          name: string;
          quantity: number;
          unit: string;
          updated_at: string | null;
        };
        Insert: {
          already_notified?: boolean;
          category_id?: string | null;
          created_at?: string | null;
          default_item_id?: string | null;
          household_id: string;
          id?: string;
          last_modified_at?: string | null;
          last_modified_by?: string | null;
          low_stock_threshold?: number;
          name: string;
          quantity?: number;
          unit: string;
          updated_at?: string | null;
        };
        Update: { name?: string; category_id?: string | null; unit?: string; low_stock_threshold?: number };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          display_name: string | null;
          id: string;
          language: string;
          notification_type: string | null;
          reminder_time: string | null;
          updated_at: string;
        };
        Insert: never;
        Update: { display_name?: string | null; notification_type?: string | null; reminder_time?: string | null; language?: string; deleted_at?: string | null };
        Relationships: [];
      };
      push_subscriptions: {
        Row: { created_at: string | null; endpoint: string; id: string; subscription: Json; updated_at: string; user_id: string };
        Insert: { endpoint: string; id?: string; subscription: Json; user_id: string };
        Update: { endpoint?: string; subscription?: Json };
        Relationships: [];
      };
      default_categories: {
        Row: { id: string; name_fr: string; name_en: string; position: number };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      default_items: {
        Row: { id: string; name_fr: string; name_en: string; default_category_id: string; unit: string; threshold: number };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      category_positions: {
        Row: { household_id: string; category_id: string; position: number };
        Insert: { household_id: string; category_id: string; position: number };
        Update: { position?: number };
        Relationships: [];
      };
      history: {
        Row: { id: string; household_id: string; performed_by: string | null; action_type: Database['public']['Enums']['action_type_enum']; item_name: string; performed_at: string };
        Insert: { id?: string; household_id: string; performed_by?: string | null; action_type: Database['public']['Enums']['action_type_enum']; item_name: string; performed_at?: string };
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      adjust_item_quantity: { Args: { p_delta: number; p_item_id: string }; Returns: Database['public']['Tables']['items']['Row'] };
      consume_household_invitation: { Args: { p_token: string }; Returns: string };
      create_household: { Args: { p_name: string }; Returns: string };
      create_household_invitation: { Args: { p_expires_in?: string; p_household_id: string }; Returns: { expires_at: string; invitation_id: string; token: string }[] };
      revoke_household_invitation: { Args: { p_invitation_id: string }; Returns: boolean };
    };
    Enums: { action_type_enum: 'modification' | 'suppression'; household_role: 'owner' | 'member' };
    CompositeTypes: Record<string, never>;
  };
};
