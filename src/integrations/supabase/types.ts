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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      booking_items: {
        Row: {
          booking_id: string
          created_at: string
          deposit_amount: number
          id: string
          product_id: string
          product_unit_id: string
          rental_price: number
        }
        Insert: {
          booking_id: string
          created_at?: string
          deposit_amount?: number
          id?: string
          product_id: string
          product_unit_id: string
          rental_price?: number
        }
        Update: {
          booking_id?: string
          created_at?: string
          deposit_amount?: number
          id?: string
          product_id?: string
          product_unit_id?: string
          rental_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "booking_items_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_items_product_unit_id_fkey"
            columns: ["product_unit_id"]
            isOneToOne: false
            referencedRelation: "product_units"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          created_at: string
          customer_id: string
          delivery_address: string | null
          delivery_fee: number
          delivery_method: string | null
          delivery_province: string | null
          delivery_tracking_updated_at: string | null
          delivery_tracking_url: string | null
          deposit_total: number
          discounted_rental_total: number | null
          grand_total: number
          id: string
          notes: string | null
          payment_confirmed_at: string | null
          payment_slip_url: string | null
          payment_submitted_at: string | null
          policy_acknowledged: boolean | null
          policy_acknowledged_at: string | null
          promo_code: string | null
          rental_end: string
          rental_start: string
          rental_total: number
          return_address_snapshot: string | null
          return_policy_acknowledged: boolean
          return_policy_acknowledged_at: string | null
          status: string
          store_policy_acknowledged: boolean
          store_policy_acknowledged_at: string | null
          store_policy_image_urls_snapshot: string[] | null
          store_policy_snapshot: string | null
          updated_at: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          delivery_address?: string | null
          delivery_fee?: number
          delivery_method?: string | null
          delivery_province?: string | null
          delivery_tracking_updated_at?: string | null
          delivery_tracking_url?: string | null
          deposit_total?: number
          discounted_rental_total?: number | null
          grand_total?: number
          id?: string
          notes?: string | null
          payment_confirmed_at?: string | null
          payment_slip_url?: string | null
          payment_submitted_at?: string | null
          policy_acknowledged?: boolean | null
          policy_acknowledged_at?: string | null
          promo_code?: string | null
          rental_end: string
          rental_start: string
          rental_total?: number
          return_address_snapshot?: string | null
          return_policy_acknowledged?: boolean
          return_policy_acknowledged_at?: string | null
          status?: string
          store_policy_acknowledged?: boolean
          store_policy_acknowledged_at?: string | null
          store_policy_image_urls_snapshot?: string[] | null
          store_policy_snapshot?: string | null
          updated_at?: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          delivery_address?: string | null
          delivery_fee?: number
          delivery_method?: string | null
          delivery_province?: string | null
          delivery_tracking_updated_at?: string | null
          delivery_tracking_url?: string | null
          deposit_total?: number
          discounted_rental_total?: number | null
          grand_total?: number
          id?: string
          notes?: string | null
          payment_confirmed_at?: string | null
          payment_slip_url?: string | null
          payment_submitted_at?: string | null
          policy_acknowledged?: boolean | null
          policy_acknowledged_at?: string | null
          promo_code?: string | null
          rental_end?: string
          rental_start?: string
          rental_total?: number
          return_address_snapshot?: string | null
          return_policy_acknowledged?: boolean
          return_policy_acknowledged_at?: string | null
          status?: string
          store_policy_acknowledged?: boolean
          store_policy_acknowledged_at?: string | null
          store_policy_image_urls_snapshot?: string[] | null
          store_policy_snapshot?: string | null
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_addresses: {
        Row: {
          address_line1: string
          address_line2: string | null
          city: string
          country: string
          created_at: string
          customer_id: string
          id: string
          is_default: boolean
          label: string | null
          postal_code: string | null
          state: string | null
        }
        Insert: {
          address_line1: string
          address_line2?: string | null
          city: string
          country?: string
          created_at?: string
          customer_id: string
          id?: string
          is_default?: boolean
          label?: string | null
          postal_code?: string | null
          state?: string | null
        }
        Update: {
          address_line1?: string
          address_line2?: string | null
          city?: string
          country?: string
          created_at?: string
          customer_id?: string
          id?: string
          is_default?: boolean
          label?: string | null
          postal_code?: string | null
          state?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_verifications: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          id_number: string | null
          id_type: string | null
          verified: boolean
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          id_number?: string | null
          id_type?: string | null
          verified?: boolean
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          id_number?: string | null
          id_type?: string | null
          verified?: boolean
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_verifications_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          created_at: string
          display_order: number
          id: string
          image_url: string
          product_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          image_url: string
          product_id: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_rental_rates: {
        Row: {
          created_at: string
          id: string
          price: number
          product_id: string
          rental_days: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          price?: number
          product_id: string
          rental_days: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          price?: number
          product_id?: string
          rental_days?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_rental_rates_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_units: {
        Row: {
          condition: string
          created_at: string
          current_booking_id: string | null
          deactivated_at: string | null
          id: string
          is_active: boolean
          notes: string | null
          product_id: string
          serial_id: string
          status: string
        }
        Insert: {
          condition?: string
          created_at?: string
          current_booking_id?: string | null
          deactivated_at?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          product_id: string
          serial_id: string
          status?: string
        }
        Update: {
          condition?: string
          created_at?: string
          current_booking_id?: string | null
          deactivated_at?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          product_id?: string
          serial_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_units_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brand: string | null
          category: string | null
          color: string | null
          created_at: string
          daily_rental_rate: number
          deposit_amount: number
          description: string | null
          dimensions: string | null
          id: string
          is_active: boolean
          max_rental_days: number
          min_rental_days: number
          name: string
          publish_status: string
          size: string | null
          sku: string | null
          specifications: string | null
          updated_at: string
          vendor_id: string
          weight_grams: number | null
        }
        Insert: {
          brand?: string | null
          category?: string | null
          color?: string | null
          created_at?: string
          daily_rental_rate?: number
          deposit_amount?: number
          description?: string | null
          dimensions?: string | null
          id?: string
          is_active?: boolean
          max_rental_days?: number
          min_rental_days?: number
          name: string
          publish_status?: string
          size?: string | null
          sku?: string | null
          specifications?: string | null
          updated_at?: string
          vendor_id: string
          weight_grams?: number | null
        }
        Update: {
          brand?: string | null
          category?: string | null
          color?: string | null
          created_at?: string
          daily_rental_rate?: number
          deposit_amount?: number
          description?: string | null
          dimensions?: string | null
          id?: string
          is_active?: boolean
          max_rental_days?: number
          min_rental_days?: number
          name?: string
          publish_status?: string
          size?: string | null
          sku?: string | null
          specifications?: string | null
          updated_at?: string
          vendor_id?: string
          weight_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          instagram_username: string | null
          line_id: string | null
          phone: string | null
          role: string
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          instagram_username?: string | null
          line_id?: string | null
          phone?: string | null
          role?: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          instagram_username?: string | null
          line_id?: string | null
          phone?: string | null
          role?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      vendors: {
        Row: {
          bank_account: string | null
          city: string | null
          created_at: string
          deposit_per_item: number
          description: string | null
          email: string | null
          id: string
          instagram: string | null
          is_active: boolean
          line_id: string | null
          logo_url: string | null
          owner_id: string
          phone: string | null
          postal_code: string | null
          rental_details_policy: string | null
          rental_policy_image_urls: string[] | null
          state: string | null
          store_address: string | null
          store_category: string | null
          store_name: string
          subdistrict: string | null
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          bank_account?: string | null
          city?: string | null
          created_at?: string
          deposit_per_item?: number
          description?: string | null
          email?: string | null
          id?: string
          instagram?: string | null
          is_active?: boolean
          line_id?: string | null
          logo_url?: string | null
          owner_id: string
          phone?: string | null
          postal_code?: string | null
          rental_details_policy?: string | null
          rental_policy_image_urls?: string[] | null
          state?: string | null
          store_address?: string | null
          store_category?: string | null
          store_name: string
          subdistrict?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          bank_account?: string | null
          city?: string | null
          created_at?: string
          deposit_per_item?: number
          description?: string | null
          email?: string | null
          id?: string
          instagram?: string | null
          is_active?: boolean
          line_id?: string | null
          logo_url?: string | null
          owner_id?: string
          phone?: string | null
          postal_code?: string | null
          rental_details_policy?: string | null
          rental_policy_image_urls?: string[] | null
          state?: string | null
          store_address?: string | null
          store_category?: string | null
          store_name?: string
          subdistrict?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendors_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      product_units_public: {
        Row: {
          id: string | null
          product_id: string | null
          status: string | null
        }
        Relationships: []
      }
      vendors_public: {
        Row: {
          city: string | null
          created_at: string | null
          deposit_per_item: number | null
          description: string | null
          id: string | null
          is_active: boolean | null
          logo_url: string | null
          postal_code: string | null
          rental_details_policy: string | null
          rental_policy_image_urls: string[] | null
          state: string | null
          store_address: string | null
          store_name: string | null
          subdistrict: string | null
          updated_at: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      delete_product_unit_safe: {
        Args: { _unit_id: string }
        Returns: undefined
      }
      get_product_unit_blocked_bookings: {
        Args: { _product_id: string }
        Returns: {
          booking_id: string
          delivery_method: string
          delivery_province: string
          product_unit_id: string
          rental_end: string
          rental_start: string
          status: string
        }[]
      }
      recompute_booking_totals: {
        Args: { _booking: string }
        Returns: undefined
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
