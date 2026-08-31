export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      categories: { Row: { created_at: string | null; household_id: string; icon: string | null; id: string; name: string; order: number | null }; Insert: { created_at?: string | null; household_id: string; icon?: string | null; id?: string; name: string; order?: number | null }; Update: { created_at?: string | null; household_id?: string; icon?: string | null; id?: string; name?: string; order?: number | null }; Relationships: [] };
      household_invitations: { Row: { consumed_at: string | null; consumed_by: string | null; created_at: string; created_by: string; expires_at: string; household_id: string; id: string; revoked_at: string | null; token_hash: string }; Insert: never; Update: never; Relationships: [] };
      household_members: { Row: { household_id: string; joined_at: string | null; role: Database['public']['Enums']['household_role']; user_id: string }; Insert: never; Update: never; Relationships: [] };
      households: { Row: { created_at: string | null; id: string; name: string }; Insert: never; Update: { name?: string }; Relationships: [] };
      items: { Row: { category_id: string | null; created_at: string | null; household_id: string; id: string; last_modified_at: string | null; last_modified_by: string | null; low_stock_threshold: number; name: string; quantity: number; unit_id: string }; Insert: { category_id?: string | null; created_at?: string | null; household_id: string; id?: string; last_modified_at?: string | null; last_modified_by?: string | null; low_stock_threshold?: number; name: string; quantity?: number; unit_id: string }; Update: { category_id?: string | null; low_stock_threshold?: number; name?: string; unit_id?: string }; Relationships: [] };
      profiles: { Row: { created_at: string; display_name: string | null; id: string; updated_at: string }; Insert: never; Update: { display_name?: string | null }; Relationships: [] };
      push_subscriptions: { Row: { created_at: string | null; endpoint: string; id: string; subscription: Json; updated_at: string; user_id: string }; Insert: { endpoint: string; id?: string; subscription: Json; user_id: string }; Update: { endpoint?: string; subscription?: Json }; Relationships: [] };
      units: { Row: { abbrev: string; id: string; name: string }; Insert: never; Update: never; Relationships: [] };
    };
    Views: Record<string, never>;
    Functions: {
      adjust_item_quantity: { Args: { p_delta: number; p_item_id: string }; Returns: Database['public']['Tables']['items']['Row'] };
      consume_household_invitation: { Args: { p_token: string }; Returns: string };
      create_household: { Args: { p_name: string }; Returns: string };
      create_household_invitation: { Args: { p_expires_in?: string; p_household_id: string }; Returns: { expires_at: string; invitation_id: string; token: string }[] };
      revoke_household_invitation: { Args: { p_invitation_id: string }; Returns: boolean };
    };
    Enums: { household_role: 'owner' | 'member' };
    CompositeTypes: Record<string, never>;
  };
};
