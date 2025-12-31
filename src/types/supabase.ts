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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      _backup_enrollments_consulting: {
        Row: {
          annual_fee: number | null
          billing_frequency:
            | Database["public"]["Enums"]["billing_frequency"]
            | null
          class_title: string | null
          created_at: string | null
          curriculum: string | null
          daily_rate: number | null
          end_date: string | null
          family_id: string | null
          hourly_rate_customer: number | null
          hours_per_week: number | null
          id: string | null
          monthly_rate: number | null
          notes: string | null
          program_type: string | null
          schedule_notes: string | null
          service_id: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["enrollment_status"] | null
          student_id: string | null
          updated_at: string | null
          weekly_tuition: number | null
        }
        Insert: {
          annual_fee?: number | null
          billing_frequency?:
            | Database["public"]["Enums"]["billing_frequency"]
            | null
          class_title?: string | null
          created_at?: string | null
          curriculum?: string | null
          daily_rate?: number | null
          end_date?: string | null
          family_id?: string | null
          hourly_rate_customer?: number | null
          hours_per_week?: number | null
          id?: string | null
          monthly_rate?: number | null
          notes?: string | null
          program_type?: string | null
          schedule_notes?: string | null
          service_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["enrollment_status"] | null
          student_id?: string | null
          updated_at?: string | null
          weekly_tuition?: number | null
        }
        Update: {
          annual_fee?: number | null
          billing_frequency?:
            | Database["public"]["Enums"]["billing_frequency"]
            | null
          class_title?: string | null
          created_at?: string | null
          curriculum?: string | null
          daily_rate?: number | null
          end_date?: string | null
          family_id?: string | null
          hourly_rate_customer?: number | null
          hours_per_week?: number | null
          id?: string | null
          monthly_rate?: number | null
          notes?: string | null
          program_type?: string | null
          schedule_notes?: string | null
          service_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["enrollment_status"] | null
          student_id?: string | null
          updated_at?: string | null
          weekly_tuition?: number | null
        }
        Relationships: []
      }
      _backup_services_consulting: {
        Row: {
          billing_frequency:
            | Database["public"]["Enums"]["billing_frequency"]
            | null
          code: string | null
          created_at: string | null
          default_customer_rate: number | null
          default_teacher_rate: number | null
          description: string | null
          id: string | null
          is_active: boolean | null
          name: string | null
          requires_teacher: boolean | null
        }
        Insert: {
          billing_frequency?:
            | Database["public"]["Enums"]["billing_frequency"]
            | null
          code?: string | null
          created_at?: string | null
          default_customer_rate?: number | null
          default_teacher_rate?: number | null
          description?: string | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          requires_teacher?: boolean | null
        }
        Update: {
          billing_frequency?:
            | Database["public"]["Enums"]["billing_frequency"]
            | null
          code?: string | null
          created_at?: string | null
          default_customer_rate?: number | null
          default_teacher_rate?: number | null
          description?: string | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          requires_teacher?: boolean | null
        }
        Relationships: []
      }
      _backup_tpli_consulting: {
        Row: {
          amount: number | null
          created_at: string | null
          description: string | null
          enrollment_id: string | null
          hourly_rate: number | null
          hours: number | null
          id: string | null
          service_id: string | null
          teacher_payment_id: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          description?: string | null
          enrollment_id?: string | null
          hourly_rate?: number | null
          hours?: number | null
          id?: string | null
          service_id?: string | null
          teacher_payment_id?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          description?: string | null
          enrollment_id?: string | null
          hourly_rate?: number | null
          hours?: number | null
          id?: string | null
          service_id?: string | null
          teacher_payment_id?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      calendly_bookings: {
        Row: {
          calendly_event_uri: string
          calendly_invitee_uri: string
          cancel_reason: string | null
          canceled_at: string | null
          created_at: string
          event_type: Database["public"]["Enums"]["calendly_booking_type"]
          family_id: string | null
          hub_session_id: string | null
          id: string
          invitee_email: string
          invitee_name: string | null
          invitee_phone: string | null
          lead_id: string | null
          notes: string | null
          payment_method: string | null
          raw_payload: Json | null
          scheduled_at: string
          status: Database["public"]["Enums"]["calendly_booking_status"]
          student_age_group: string | null
          student_id: string | null
          student_name: string | null
          updated_at: string
        }
        Insert: {
          calendly_event_uri: string
          calendly_invitee_uri: string
          cancel_reason?: string | null
          canceled_at?: string | null
          created_at?: string
          event_type: Database["public"]["Enums"]["calendly_booking_type"]
          family_id?: string | null
          hub_session_id?: string | null
          id?: string
          invitee_email: string
          invitee_name?: string | null
          invitee_phone?: string | null
          lead_id?: string | null
          notes?: string | null
          payment_method?: string | null
          raw_payload?: Json | null
          scheduled_at: string
          status?: Database["public"]["Enums"]["calendly_booking_status"]
          student_age_group?: string | null
          student_id?: string | null
          student_name?: string | null
          updated_at?: string
        }
        Update: {
          calendly_event_uri?: string
          calendly_invitee_uri?: string
          cancel_reason?: string | null
          canceled_at?: string | null
          created_at?: string
          event_type?: Database["public"]["Enums"]["calendly_booking_type"]
          family_id?: string | null
          hub_session_id?: string | null
          id?: string
          invitee_email?: string
          invitee_name?: string | null
          invitee_phone?: string | null
          lead_id?: string | null
          notes?: string | null
          payment_method?: string | null
          raw_payload?: Json | null
          scheduled_at?: string
          status?: Database["public"]["Enums"]["calendly_booking_status"]
          student_age_group?: string | null
          student_id?: string | null
          student_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendly_bookings_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "event_leads"
            referencedColumns: ["family_id"]
          },
          {
            foreignKeyName: "calendly_bookings_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendly_bookings_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "family_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendly_bookings_hub_session_id_fkey"
            columns: ["hub_session_id"]
            isOneToOne: false
            referencedRelation: "hub_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendly_bookings_hub_session_id_fkey"
            columns: ["hub_session_id"]
            isOneToOne: false
            referencedRelation: "unbilled_hub_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendly_bookings_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendly_bookings_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendly_bookings_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      communications: {
        Row: {
          channel: Database["public"]["Enums"]["comm_channel"]
          created_at: string
          direction: Database["public"]["Enums"]["comm_direction"]
          family_id: string
          id: string
          logged_at: string
          subject: string | null
          summary: string | null
          workflow_run_id: string | null
        }
        Insert: {
          channel: Database["public"]["Enums"]["comm_channel"]
          created_at?: string
          direction: Database["public"]["Enums"]["comm_direction"]
          family_id: string
          id?: string
          logged_at?: string
          subject?: string | null
          summary?: string | null
          workflow_run_id?: string | null
        }
        Update: {
          channel?: Database["public"]["Enums"]["comm_channel"]
          created_at?: string
          direction?: Database["public"]["Enums"]["comm_direction"]
          family_id?: string
          id?: string
          logged_at?: string
          subject?: string | null
          summary?: string | null
          workflow_run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communications_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "event_leads"
            referencedColumns: ["family_id"]
          },
          {
            foreignKeyName: "communications_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "family_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_workflow_run_id_fkey"
            columns: ["workflow_run_id"]
            isOneToOne: false
            referencedRelation: "workflow_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body_html: string
          body_text: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          subject: string
          template_key: string
          updated_at: string
        }
        Insert: {
          body_html: string
          body_text?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          subject: string
          template_key: string
          updated_at?: string
        }
        Update: {
          body_html?: string
          body_text?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          subject?: string
          template_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          annual_fee: number | null
          billing_frequency:
            | Database["public"]["Enums"]["billing_frequency"]
            | null
          class_title: string | null
          created_at: string
          curriculum: string | null
          daily_rate: number | null
          end_date: string | null
          enrollment_period: string | null
          event_order_id: string | null
          family_id: string
          hourly_rate_customer: number | null
          hours_per_week: number | null
          id: string
          monthly_rate: number | null
          notes: string | null
          program_type: string | null
          schedule_notes: string | null
          service_id: string
          start_date: string | null
          status: Database["public"]["Enums"]["enrollment_status"]
          student_id: string | null
          updated_at: string
          weekly_tuition: number | null
        }
        Insert: {
          annual_fee?: number | null
          billing_frequency?:
            | Database["public"]["Enums"]["billing_frequency"]
            | null
          class_title?: string | null
          created_at?: string
          curriculum?: string | null
          daily_rate?: number | null
          end_date?: string | null
          enrollment_period?: string | null
          event_order_id?: string | null
          family_id: string
          hourly_rate_customer?: number | null
          hours_per_week?: number | null
          id?: string
          monthly_rate?: number | null
          notes?: string | null
          program_type?: string | null
          schedule_notes?: string | null
          service_id: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["enrollment_status"]
          student_id?: string | null
          updated_at?: string
          weekly_tuition?: number | null
        }
        Update: {
          annual_fee?: number | null
          billing_frequency?:
            | Database["public"]["Enums"]["billing_frequency"]
            | null
          class_title?: string | null
          created_at?: string
          curriculum?: string | null
          daily_rate?: number | null
          end_date?: string | null
          enrollment_period?: string | null
          event_order_id?: string | null
          family_id?: string
          hourly_rate_customer?: number | null
          hours_per_week?: number | null
          id?: string
          monthly_rate?: number | null
          notes?: string | null
          program_type?: string | null
          schedule_notes?: string | null
          service_id?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["enrollment_status"]
          student_id?: string | null
          updated_at?: string
          weekly_tuition?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_event_order_id_fkey"
            columns: ["event_order_id"]
            isOneToOne: false
            referencedRelation: "event_attendee_list"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "enrollments_event_order_id_fkey"
            columns: ["event_order_id"]
            isOneToOne: false
            referencedRelation: "event_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_event_order_id_fkey"
            columns: ["event_order_id"]
            isOneToOne: false
            referencedRelation: "event_orders_pending_billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_event_order_id_fkey"
            columns: ["event_order_id"]
            isOneToOne: false
            referencedRelation: "event_stepup_pending"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "event_leads"
            referencedColumns: ["family_id"]
          },
          {
            foreignKeyName: "enrollments_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "family_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      event_attendees: {
        Row: {
          attendee_age: number | null
          attendee_name: string
          created_at: string | null
          event_id: string | null
          id: string
          is_adult: boolean | null
          order_id: string | null
          student_id: string | null
        }
        Insert: {
          attendee_age?: number | null
          attendee_name: string
          created_at?: string | null
          event_id?: string | null
          id?: string
          is_adult?: boolean | null
          order_id?: string | null
          student_id?: string | null
        }
        Update: {
          attendee_age?: number | null
          attendee_name?: string
          created_at?: string | null
          event_id?: string | null
          id?: string
          is_adult?: boolean | null
          order_id?: string | null
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_attendees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_attendee_list"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_attendees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_attendees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_stepup_pending"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_attendees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_attendees_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "event_attendee_list"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "event_attendees_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "event_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_attendees_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "event_orders_pending_billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_attendees_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "event_stepup_pending"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_attendees_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      event_events: {
        Row: {
          capacity: number | null
          created_at: string | null
          description: string | null
          end_at: string | null
          event_type: string | null
          featured_image_url: string | null
          id: string
          instructor_name: string | null
          monthly_tuition_cents: number | null
          registration_open: boolean | null
          schedule_day: string | null
          schedule_time: string | null
          semester: string | null
          start_at: string
          status: string | null
          synced_at: string | null
          ticket_price_cents: number
          ticket_price_label: string | null
          title: string
          updated_at: string | null
          venue_address: string | null
          venue_city: string | null
          venue_name: string | null
          venue_state: string | null
          wp_post_id: number
          wp_slug: string | null
        }
        Insert: {
          capacity?: number | null
          created_at?: string | null
          description?: string | null
          end_at?: string | null
          event_type?: string | null
          featured_image_url?: string | null
          id?: string
          instructor_name?: string | null
          monthly_tuition_cents?: number | null
          registration_open?: boolean | null
          schedule_day?: string | null
          schedule_time?: string | null
          semester?: string | null
          start_at: string
          status?: string | null
          synced_at?: string | null
          ticket_price_cents: number
          ticket_price_label?: string | null
          title: string
          updated_at?: string | null
          venue_address?: string | null
          venue_city?: string | null
          venue_name?: string | null
          venue_state?: string | null
          wp_post_id: number
          wp_slug?: string | null
        }
        Update: {
          capacity?: number | null
          created_at?: string | null
          description?: string | null
          end_at?: string | null
          event_type?: string | null
          featured_image_url?: string | null
          id?: string
          instructor_name?: string | null
          monthly_tuition_cents?: number | null
          registration_open?: boolean | null
          schedule_day?: string | null
          schedule_time?: string | null
          semester?: string | null
          start_at?: string
          status?: string | null
          synced_at?: string | null
          ticket_price_cents?: number
          ticket_price_label?: string | null
          title?: string
          updated_at?: string | null
          venue_address?: string | null
          venue_city?: string | null
          venue_name?: string | null
          venue_state?: string | null
          wp_post_id?: number
          wp_slug?: string | null
        }
        Relationships: []
      }
      event_orders: {
        Row: {
          created_at: string | null
          event_id: string | null
          family_id: string | null
          id: string
          invoice_id: string | null
          metadata: Json | null
          paid_at: string | null
          payment_method: string
          payment_status: string | null
          purchaser_email: string
          purchaser_name: string | null
          quantity: number
          stripe_checkout_session_id: string | null
          stripe_customer_id: string | null
          stripe_payment_intent_id: string | null
          total_cents: number
          unit_price_cents: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          event_id?: string | null
          family_id?: string | null
          id?: string
          invoice_id?: string | null
          metadata?: Json | null
          paid_at?: string | null
          payment_method?: string
          payment_status?: string | null
          purchaser_email: string
          purchaser_name?: string | null
          quantity?: number
          stripe_checkout_session_id?: string | null
          stripe_customer_id?: string | null
          stripe_payment_intent_id?: string | null
          total_cents: number
          unit_price_cents: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          event_id?: string | null
          family_id?: string | null
          id?: string
          invoice_id?: string | null
          metadata?: Json | null
          paid_at?: string | null
          payment_method?: string
          payment_status?: string | null
          purchaser_email?: string
          purchaser_name?: string | null
          quantity?: number
          stripe_checkout_session_id?: string | null
          stripe_customer_id?: string | null
          stripe_payment_intent_id?: string | null
          total_cents?: number
          unit_price_cents?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_orders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_attendee_list"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_orders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_orders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_stepup_pending"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_orders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_orders_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "event_leads"
            referencedColumns: ["family_id"]
          },
          {
            foreignKeyName: "event_orders_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_orders_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "family_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_orders_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_orders_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "overdue_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      event_stripe_webhooks: {
        Row: {
          error_message: string | null
          event_type: string
          id: string
          processed_at: string | null
          processing_status: string | null
          raw_payload: Json | null
          stripe_event_id: string
        }
        Insert: {
          error_message?: string | null
          event_type: string
          id?: string
          processed_at?: string | null
          processing_status?: string | null
          raw_payload?: Json | null
          stripe_event_id: string
        }
        Update: {
          error_message?: string | null
          event_type?: string
          id?: string
          processed_at?: string | null
          processing_status?: string | null
          raw_payload?: Json | null
          stripe_event_id?: string
        }
        Relationships: []
      }
      families: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          created_at: string
          display_name: string
          id: string
          last_contact_at: string | null
          legacy_lookup_key: string | null
          notes: string | null
          payment_gateway: string | null
          primary_contact_name: string | null
          primary_email: string | null
          primary_phone: string | null
          reengagement_flag: boolean
          state: string | null
          status: Database["public"]["Enums"]["customer_status"]
          updated_at: string
          zip: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          created_at?: string
          display_name: string
          id?: string
          last_contact_at?: string | null
          legacy_lookup_key?: string | null
          notes?: string | null
          payment_gateway?: string | null
          primary_contact_name?: string | null
          primary_email?: string | null
          primary_phone?: string | null
          reengagement_flag?: boolean
          state?: string | null
          status?: Database["public"]["Enums"]["customer_status"]
          updated_at?: string
          zip?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          created_at?: string
          display_name?: string
          id?: string
          last_contact_at?: string | null
          legacy_lookup_key?: string | null
          notes?: string | null
          payment_gateway?: string | null
          primary_contact_name?: string | null
          primary_email?: string | null
          primary_phone?: string | null
          reengagement_flag?: boolean
          state?: string | null
          status?: Database["public"]["Enums"]["customer_status"]
          updated_at?: string
          zip?: string | null
        }
        Relationships: []
      }
      family_contacts: {
        Row: {
          created_at: string
          email: string | null
          family_id: string
          id: string
          is_primary: boolean
          name: string
          phone: string | null
          role: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          family_id: string
          id?: string
          is_primary?: boolean
          name: string
          phone?: string | null
          role?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          family_id?: string
          id?: string
          is_primary?: boolean
          name?: string
          phone?: string | null
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "family_contacts_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "event_leads"
            referencedColumns: ["family_id"]
          },
          {
            foreignKeyName: "family_contacts_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_contacts_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "family_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      family_tags: {
        Row: {
          created_at: string
          family_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          family_id: string
          tag_id: string
        }
        Update: {
          created_at?: string
          family_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_tags_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "event_leads"
            referencedColumns: ["family_id"]
          },
          {
            foreignKeyName: "family_tags_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_tags_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "family_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_sessions: {
        Row: {
          created_at: string
          daily_rate: number
          id: string
          invoice_line_item_id: string | null
          notes: string | null
          session_date: string
          student_id: string
          teacher_id: string | null
        }
        Insert: {
          created_at?: string
          daily_rate?: number
          id?: string
          invoice_line_item_id?: string | null
          notes?: string | null
          session_date: string
          student_id: string
          teacher_id?: string | null
        }
        Update: {
          created_at?: string
          daily_rate?: number
          id?: string
          invoice_line_item_id?: string | null
          notes?: string | null
          session_date?: string
          student_id?: string
          teacher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hub_sessions_line_item_fk"
            columns: ["invoice_line_item_id"]
            isOneToOne: false
            referencedRelation: "invoice_line_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_sessions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_sessions_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher_earnings_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_sessions_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher_load"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_sessions_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_emails: {
        Row: {
          clicked_at: string | null
          created_at: string
          email_type: string
          id: string
          invoice_id: string
          opened_at: string | null
          sent_at: string
          sent_to: string
          subject: string | null
          workflow_run_id: string | null
        }
        Insert: {
          clicked_at?: string | null
          created_at?: string
          email_type: string
          id?: string
          invoice_id: string
          opened_at?: string | null
          sent_at?: string
          sent_to: string
          subject?: string | null
          workflow_run_id?: string | null
        }
        Update: {
          clicked_at?: string | null
          created_at?: string
          email_type?: string
          id?: string
          invoice_id?: string
          opened_at?: string | null
          sent_at?: string
          sent_to?: string
          subject?: string | null
          workflow_run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_emails_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_emails_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "overdue_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_line_items: {
        Row: {
          amount: number | null
          created_at: string
          description: string
          enrollment_id: string | null
          id: string
          invoice_id: string
          profit: number | null
          quantity: number
          sort_order: number | null
          teacher_cost: number | null
          unit_price: number | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          description: string
          enrollment_id?: string | null
          id?: string
          invoice_id: string
          profit?: number | null
          quantity?: number
          sort_order?: number | null
          teacher_cost?: number | null
          unit_price?: number | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          description?: string
          enrollment_id?: string | null
          id?: string
          invoice_id?: string
          profit?: number | null
          quantity?: number
          sort_order?: number | null
          teacher_cost?: number | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "overdue_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid: number
          balance_due: number | null
          created_at: string
          due_date: string | null
          family_id: string
          id: string
          invoice_date: string
          invoice_number: string | null
          notes: string | null
          pdf_storage_path: string | null
          period_end: string | null
          period_start: string | null
          public_id: string | null
          sent_at: string | null
          sent_to: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number | null
          total_amount: number | null
          updated_at: string
          viewed_at: string | null
        }
        Insert: {
          amount_paid?: number
          balance_due?: number | null
          created_at?: string
          due_date?: string | null
          family_id: string
          id?: string
          invoice_date: string
          invoice_number?: string | null
          notes?: string | null
          pdf_storage_path?: string | null
          period_end?: string | null
          period_start?: string | null
          public_id?: string | null
          sent_at?: string | null
          sent_to?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number | null
          total_amount?: number | null
          updated_at?: string
          viewed_at?: string | null
        }
        Update: {
          amount_paid?: number
          balance_due?: number | null
          created_at?: string
          due_date?: string | null
          family_id?: string
          id?: string
          invoice_date?: string
          invoice_number?: string | null
          notes?: string | null
          pdf_storage_path?: string | null
          period_end?: string | null
          period_start?: string | null
          public_id?: string | null
          sent_at?: string | null
          sent_to?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number | null
          total_amount?: number | null
          updated_at?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "event_leads"
            referencedColumns: ["family_id"]
          },
          {
            foreignKeyName: "invoices_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "family_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          calendly_event_uri: string | null
          calendly_invitee_uri: string | null
          children_ages: string | null
          converted_at: string | null
          created_at: string
          email: string
          family_id: string | null
          id: string
          lead_type: Database["public"]["Enums"]["lead_type"]
          name: string | null
          notes: string | null
          num_children: number | null
          phone: string | null
          preferred_days: string | null
          preferred_time: string | null
          scheduled_at: string | null
          service_interest: string | null
          source_url: string | null
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
        }
        Insert: {
          calendly_event_uri?: string | null
          calendly_invitee_uri?: string | null
          children_ages?: string | null
          converted_at?: string | null
          created_at?: string
          email: string
          family_id?: string | null
          id?: string
          lead_type: Database["public"]["Enums"]["lead_type"]
          name?: string | null
          notes?: string | null
          num_children?: number | null
          phone?: string | null
          preferred_days?: string | null
          preferred_time?: string | null
          scheduled_at?: string | null
          service_interest?: string | null
          source_url?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Update: {
          calendly_event_uri?: string | null
          calendly_invitee_uri?: string | null
          children_ages?: string | null
          converted_at?: string | null
          created_at?: string
          email?: string
          family_id?: string | null
          id?: string
          lead_type?: Database["public"]["Enums"]["lead_type"]
          name?: string | null
          notes?: string | null
          num_children?: number | null
          phone?: string | null
          preferred_days?: string | null
          preferred_time?: string | null
          scheduled_at?: string | null
          service_interest?: string | null
          source_url?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "event_leads"
            referencedColumns: ["family_id"]
          },
          {
            foreignKeyName: "leads_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "family_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_id: string
          notes: string | null
          payment_date: string
          payment_method: string | null
          reference: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          invoice_id: string
          notes?: string | null
          payment_date: string
          payment_method?: string | null
          reference?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string | null
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "overdue_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_adjustment: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          reason: string
          source_payroll_run_id: string | null
          target_payroll_run_id: string | null
          teacher_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          reason: string
          source_payroll_run_id?: string | null
          target_payroll_run_id?: string | null
          teacher_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          reason?: string
          source_payroll_run_id?: string | null
          target_payroll_run_id?: string | null
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_adjustment_source_payroll_run_id_fkey"
            columns: ["source_payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_run"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_adjustment_target_payroll_run_id_fkey"
            columns: ["target_payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_run"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_adjustment_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher_earnings_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_adjustment_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher_load"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_adjustment_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_line_item: {
        Row: {
          actual_hours: number
          adjustment_amount: number
          adjustment_note: string | null
          calculated_amount: number
          calculated_hours: number
          created_at: string
          description: string
          enrollment_id: string | null
          final_amount: number
          hourly_rate: number
          id: string
          payroll_run_id: string
          rate_source: string
          service_id: string | null
          teacher_assignment_id: string | null
          teacher_id: string
        }
        Insert: {
          actual_hours?: number
          adjustment_amount?: number
          adjustment_note?: string | null
          calculated_amount?: number
          calculated_hours?: number
          created_at?: string
          description: string
          enrollment_id?: string | null
          final_amount?: number
          hourly_rate?: number
          id?: string
          payroll_run_id: string
          rate_source?: string
          service_id?: string | null
          teacher_assignment_id?: string | null
          teacher_id: string
        }
        Update: {
          actual_hours?: number
          adjustment_amount?: number
          adjustment_note?: string | null
          calculated_amount?: number
          calculated_hours?: number
          created_at?: string
          description?: string
          enrollment_id?: string | null
          final_amount?: number
          hourly_rate?: number
          id?: string
          payroll_run_id?: string
          rate_source?: string
          service_id?: string | null
          teacher_assignment_id?: string | null
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_line_item_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_line_item_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_run"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_line_item_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_line_item_teacher_assignment_id_fkey"
            columns: ["teacher_assignment_id"]
            isOneToOne: false
            referencedRelation: "teacher_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_line_item_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher_earnings_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_line_item_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher_load"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_line_item_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_run: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          notes: string | null
          paid_at: string | null
          period_end: string
          period_start: string
          status: string
          teacher_count: number
          total_adjusted: number
          total_calculated: number
          total_hours: number
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          period_end: string
          period_start: string
          status?: string
          teacher_count?: number
          total_adjusted?: number
          total_calculated?: number
          total_hours?: number
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          period_end?: string
          period_start?: string
          status?: string
          teacher_count?: number
          total_adjusted?: number
          total_calculated?: number
          total_hours?: number
          updated_at?: string
        }
        Relationships: []
      }
      revenue_records: {
        Row: {
          class_title: string | null
          created_at: string
          family_id: string | null
          hourly_rate_customer: number | null
          hourly_rate_teacher: number | null
          hours: number | null
          id: string
          notes: string | null
          period_end: string
          period_start: string
          revenue: number
          service_id: string | null
          source: string
          source_invoice_id: string | null
          student_id: string | null
          teacher_id: string | null
        }
        Insert: {
          class_title?: string | null
          created_at?: string
          family_id?: string | null
          hourly_rate_customer?: number | null
          hourly_rate_teacher?: number | null
          hours?: number | null
          id?: string
          notes?: string | null
          period_end: string
          period_start: string
          revenue: number
          service_id?: string | null
          source?: string
          source_invoice_id?: string | null
          student_id?: string | null
          teacher_id?: string | null
        }
        Update: {
          class_title?: string | null
          created_at?: string
          family_id?: string | null
          hourly_rate_customer?: number | null
          hourly_rate_teacher?: number | null
          hours?: number | null
          id?: string
          notes?: string | null
          period_end?: string
          period_start?: string
          revenue?: number
          service_id?: string | null
          source?: string
          source_invoice_id?: string | null
          student_id?: string | null
          teacher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "revenue_records_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "event_leads"
            referencedColumns: ["family_id"]
          },
          {
            foreignKeyName: "revenue_records_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_records_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "family_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_records_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_records_source_invoice_id_fkey"
            columns: ["source_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_records_source_invoice_id_fkey"
            columns: ["source_invoice_id"]
            isOneToOne: false
            referencedRelation: "overdue_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_records_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher_earnings_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_records_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher_load"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_records_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_views: {
        Row: {
          column_config: Json | null
          created_at: string
          entity_type: string
          filter_config: Json
          id: string
          is_default: boolean
          name: string
          sort_config: Json | null
        }
        Insert: {
          column_config?: Json | null
          created_at?: string
          entity_type: string
          filter_config: Json
          id?: string
          is_default?: boolean
          name: string
          sort_config?: Json | null
        }
        Update: {
          column_config?: Json | null
          created_at?: string
          entity_type?: string
          filter_config?: Json
          id?: string
          is_default?: boolean
          name?: string
          sort_config?: Json | null
        }
        Relationships: []
      }
      services: {
        Row: {
          billing_frequency: Database["public"]["Enums"]["billing_frequency"]
          code: string
          created_at: string
          default_customer_rate: number | null
          default_teacher_rate: number | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          requires_teacher: boolean
        }
        Insert: {
          billing_frequency?: Database["public"]["Enums"]["billing_frequency"]
          code: string
          created_at?: string
          default_customer_rate?: number | null
          default_teacher_rate?: number | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          requires_teacher?: boolean
        }
        Update: {
          billing_frequency?: Database["public"]["Enums"]["billing_frequency"]
          code?: string
          created_at?: string
          default_customer_rate?: number | null
          default_teacher_rate?: number | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          requires_teacher?: boolean
        }
        Relationships: []
      }
      students: {
        Row: {
          active: boolean
          age_group: string | null
          created_at: string
          dob: string | null
          family_id: string
          full_name: string
          grade_level: string | null
          homeschool_status: string | null
          id: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          age_group?: string | null
          created_at?: string
          dob?: string | null
          family_id: string
          full_name: string
          grade_level?: string | null
          homeschool_status?: string | null
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          age_group?: string | null
          created_at?: string
          dob?: string | null
          family_id?: string
          full_name?: string
          grade_level?: string | null
          homeschool_status?: string | null
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "event_leads"
            referencedColumns: ["family_id"]
          },
          {
            foreignKeyName: "students_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "family_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      teacher_assignments: {
        Row: {
          created_at: string
          end_date: string | null
          enrollment_id: string | null
          hourly_rate_teacher: number | null
          hours_per_week: number | null
          id: string
          is_active: boolean
          notes: string | null
          service_id: string | null
          start_date: string | null
          teacher_id: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          enrollment_id?: string | null
          hourly_rate_teacher?: number | null
          hours_per_week?: number | null
          id?: string
          is_active?: boolean
          notes?: string | null
          service_id?: string | null
          start_date?: string | null
          teacher_id: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          enrollment_id?: string | null
          hourly_rate_teacher?: number | null
          hours_per_week?: number | null
          id?: string
          is_active?: boolean
          notes?: string | null
          service_id?: string | null
          start_date?: string | null
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_assignments_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_assignments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_assignments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher_earnings_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_assignments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher_load"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_assignments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_hours: {
        Row: {
          agreed_hours: number | null
          created_at: string
          hour_adjustments: number | null
          hours_worked: number | null
          id: string
          invoice_line_item_id: string | null
          notes: string | null
          teacher_assignment_id: string
          teacher_payment_line_item_id: string | null
          week_end: string
          week_start: string
        }
        Insert: {
          agreed_hours?: number | null
          created_at?: string
          hour_adjustments?: number | null
          hours_worked?: number | null
          id?: string
          invoice_line_item_id?: string | null
          notes?: string | null
          teacher_assignment_id: string
          teacher_payment_line_item_id?: string | null
          week_end: string
          week_start: string
        }
        Update: {
          agreed_hours?: number | null
          created_at?: string
          hour_adjustments?: number | null
          hours_worked?: number | null
          id?: string
          invoice_line_item_id?: string | null
          notes?: string | null
          teacher_assignment_id?: string
          teacher_payment_line_item_id?: string | null
          week_end?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_hours_line_item_fk"
            columns: ["invoice_line_item_id"]
            isOneToOne: false
            referencedRelation: "invoice_line_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_hours_payment_line_item_fk"
            columns: ["teacher_payment_line_item_id"]
            isOneToOne: false
            referencedRelation: "teacher_payment_line_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_hours_teacher_assignment_id_fkey"
            columns: ["teacher_assignment_id"]
            isOneToOne: false
            referencedRelation: "teacher_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_payment_line_items: {
        Row: {
          amount: number
          created_at: string
          description: string
          enrollment_id: string | null
          hourly_rate: number | null
          hours: number | null
          id: string
          service_id: string | null
          teacher_payment_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description: string
          enrollment_id?: string | null
          hourly_rate?: number | null
          hours?: number | null
          id?: string
          service_id?: string | null
          teacher_payment_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          enrollment_id?: string | null
          hourly_rate?: number | null
          hours?: number | null
          id?: string
          service_id?: string | null
          teacher_payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_payment_line_items_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_payment_line_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_payment_line_items_teacher_payment_id_fkey"
            columns: ["teacher_payment_id"]
            isOneToOne: false
            referencedRelation: "teacher_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_payments: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          pay_date: string
          pay_period_end: string
          pay_period_start: string
          payment_method: string | null
          reference: string | null
          teacher_id: string
          total_amount: number
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          pay_date: string
          pay_period_end: string
          pay_period_start: string
          payment_method?: string | null
          reference?: string | null
          teacher_id: string
          total_amount: number
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          pay_date?: string
          pay_period_end?: string
          pay_period_start?: string
          payment_method?: string | null
          reference?: string | null
          teacher_id?: string
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "teacher_payments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher_earnings_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_payments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher_load"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_payments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teachers: {
        Row: {
          created_at: string
          default_hourly_rate: number | null
          display_name: string
          email: string | null
          hire_date: string | null
          id: string
          max_hours_per_week: number | null
          notes: string | null
          payment_info_on_file: boolean
          phone: string | null
          preferred_comm_method: string | null
          role: string | null
          skillset: string | null
          status: Database["public"]["Enums"]["employee_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_hourly_rate?: number | null
          display_name: string
          email?: string | null
          hire_date?: string | null
          id?: string
          max_hours_per_week?: number | null
          notes?: string | null
          payment_info_on_file?: boolean
          phone?: string | null
          preferred_comm_method?: string | null
          role?: string | null
          skillset?: string | null
          status?: Database["public"]["Enums"]["employee_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_hourly_rate?: number | null
          display_name?: string
          email?: string | null
          hire_date?: string | null
          id?: string
          max_hours_per_week?: number | null
          notes?: string | null
          payment_info_on_file?: boolean
          phone?: string | null
          preferred_comm_method?: string | null
          role?: string | null
          skillset?: string | null
          status?: Database["public"]["Enums"]["employee_status"]
          updated_at?: string
        }
        Relationships: []
      }
      workflow_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          payload: Json | null
          response: Json | null
          started_at: string | null
          status: Database["public"]["Enums"]["workflow_status"]
          triggered_by: string | null
          workflow_key: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          payload?: Json | null
          response?: Json | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["workflow_status"]
          triggered_by?: string | null
          workflow_key: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          payload?: Json | null
          response?: Json | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["workflow_status"]
          triggered_by?: string | null
          workflow_key?: string
        }
        Relationships: []
      }
    }
    Views: {
      event_attendee_list: {
        Row: {
          attendee_age: number | null
          attendee_id: string | null
          attendee_name: string | null
          event_date: string | null
          event_id: string | null
          event_title: string | null
          event_type: string | null
          family_id: string | null
          instructor_name: string | null
          is_adult: boolean | null
          order_id: string | null
          order_total_cents: number | null
          paid_at: string | null
          payment_method: string | null
          payment_status: string | null
          purchaser_email: string | null
          purchaser_name: string | null
          schedule_day: string | null
          schedule_time: string | null
          semester: string | null
          student_id: string | null
          tickets_in_order: number | null
          venue_name: string | null
          wp_post_id: number | null
          wp_slug: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_attendees_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_orders_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "event_leads"
            referencedColumns: ["family_id"]
          },
          {
            foreignKeyName: "event_orders_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_orders_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "family_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      event_leads: {
        Row: {
          created_at: string | null
          event_order_count: number | null
          family_id: string | null
          family_name: string | null
          last_event_order_at: string | null
          primary_email: string | null
          primary_phone: string | null
          total_event_spend: number | null
        }
        Relationships: []
      }
      event_orders_pending_billing: {
        Row: {
          created_at: string | null
          event_date: string | null
          event_id: string | null
          event_title: string | null
          event_type: string | null
          family_id: string | null
          family_name: string | null
          id: string | null
          payment_method: string | null
          payment_status: string | null
          purchaser_email: string | null
          purchaser_name: string | null
          quantity: number | null
          total_cents: number | null
        }
        Relationships: [
          {
            foreignKeyName: "event_orders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_attendee_list"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_orders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_orders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_stepup_pending"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_orders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_orders_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "event_leads"
            referencedColumns: ["family_id"]
          },
          {
            foreignKeyName: "event_orders_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_orders_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "family_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      event_stepup_pending: {
        Row: {
          created_at: string | null
          event_date: string | null
          event_id: string | null
          event_title: string | null
          event_type: string | null
          family_id: string | null
          family_name: string | null
          id: string | null
          payment_status: string | null
          purchaser_email: string | null
          purchaser_name: string | null
          quantity: number | null
          total_cents: number | null
        }
        Relationships: [
          {
            foreignKeyName: "event_orders_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "event_leads"
            referencedColumns: ["family_id"]
          },
          {
            foreignKeyName: "event_orders_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_orders_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "family_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      event_summary: {
        Row: {
          capacity: number | null
          description: string | null
          end_at: string | null
          event_type: string | null
          featured_image_url: string | null
          id: string | null
          instructor_name: string | null
          monthly_tuition_cents: number | null
          orders_count: number | null
          registration_open: boolean | null
          revenue_cents: number | null
          schedule_day: string | null
          schedule_time: string | null
          semester: string | null
          start_at: string | null
          status: string | null
          ticket_price_cents: number | null
          ticket_price_label: string | null
          tickets_remaining: number | null
          tickets_sold: number | null
          title: string | null
          venue_address: string | null
          venue_city: string | null
          venue_name: string | null
          venue_state: string | null
          wp_post_id: number | null
          wp_slug: string | null
        }
        Relationships: []
      }
      family_overview: {
        Row: {
          active_enrollment_count: number | null
          display_name: string | null
          id: string | null
          last_contact_at: string | null
          payment_gateway: string | null
          primary_email: string | null
          primary_phone: string | null
          status: Database["public"]["Enums"]["customer_status"] | null
          student_count: number | null
          total_balance: number | null
        }
        Relationships: []
      }
      leads_pipeline: {
        Row: {
          created_at: string | null
          days_in_pipeline: number | null
          email: string | null
          family_id: string | null
          family_name: string | null
          id: string | null
          lead_type: Database["public"]["Enums"]["lead_type"] | null
          name: string | null
          notes: string | null
          num_children: number | null
          phone: string | null
          scheduled_at: string | null
          service_interest: string | null
          status: Database["public"]["Enums"]["lead_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "event_leads"
            referencedColumns: ["family_id"]
          },
          {
            foreignKeyName: "leads_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "family_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_revenue_by_service: {
        Row: {
          month: string | null
          record_count: number | null
          service_code: string | null
          service_name: string | null
          total_hours: number | null
          total_revenue: number | null
        }
        Relationships: []
      }
      monthly_teacher_revenue: {
        Row: {
          estimated_pay: number | null
          month: string | null
          teacher_name: string | null
          total_hours: number | null
        }
        Relationships: []
      }
      overdue_invoices: {
        Row: {
          amount_paid: number | null
          balance_due: number | null
          created_at: string | null
          days_overdue: number | null
          due_date: string | null
          family_id: string | null
          family_name: string | null
          id: string | null
          invoice_date: string | null
          invoice_number: string | null
          last_contact_at: string | null
          notes: string | null
          pdf_storage_path: string | null
          period_end: string | null
          period_start: string | null
          primary_email: string | null
          primary_phone: string | null
          public_id: string | null
          sent_at: string | null
          sent_to: string | null
          status: Database["public"]["Enums"]["invoice_status"] | null
          subtotal: number | null
          total_amount: number | null
          updated_at: string | null
          viewed_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "event_leads"
            referencedColumns: ["family_id"]
          },
          {
            foreignKeyName: "invoices_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "family_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_earnings_summary: {
        Row: {
          display_name: string | null
          id: string | null
          pay_month: string | null
          payment_count: number | null
          total_paid: number | null
        }
        Relationships: []
      }
      teacher_load: {
        Row: {
          active_assignments: number | null
          assigned_hours_per_week: number | null
          available_hours: number | null
          display_name: string | null
          id: string | null
          max_hours_per_week: number | null
          role: string | null
          status: Database["public"]["Enums"]["employee_status"] | null
        }
        Relationships: []
      }
      unbilled_hub_sessions: {
        Row: {
          created_at: string | null
          daily_rate: number | null
          family_name: string | null
          id: string | null
          invoice_line_item_id: string | null
          notes: string | null
          primary_email: string | null
          session_date: string | null
          student_id: string | null
          student_name: string | null
          teacher_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hub_sessions_line_item_fk"
            columns: ["invoice_line_item_id"]
            isOneToOne: false
            referencedRelation: "invoice_line_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_sessions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_sessions_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher_earnings_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_sessions_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher_load"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_sessions_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      upcoming_calendly_bookings: {
        Row: {
          event_type:
            | Database["public"]["Enums"]["calendly_booking_type"]
            | null
          family_id: string | null
          family_name: string | null
          hub_session_id: string | null
          id: string | null
          invitee_email: string | null
          invitee_name: string | null
          invitee_phone: string | null
          lead_id: string | null
          payment_method: string | null
          scheduled_at: string | null
          status: Database["public"]["Enums"]["calendly_booking_status"] | null
          student_age_group: string | null
          student_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendly_bookings_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "event_leads"
            referencedColumns: ["family_id"]
          },
          {
            foreignKeyName: "calendly_bookings_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendly_bookings_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "family_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendly_bookings_hub_session_id_fkey"
            columns: ["hub_session_id"]
            isOneToOne: false
            referencedRelation: "hub_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendly_bookings_hub_session_id_fkey"
            columns: ["hub_session_id"]
            isOneToOne: false
            referencedRelation: "unbilled_hub_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendly_bookings_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendly_bookings_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_pipeline"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      derive_age_group: { Args: { age: number }; Returns: string }
      generate_public_id: { Args: never; Returns: string }
      mark_overdue_invoices: { Args: never; Returns: undefined }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      billing_frequency:
        | "per_session"
        | "weekly"
        | "monthly"
        | "bi_monthly"
        | "annual"
        | "one_time"
      calendly_booking_status:
        | "scheduled"
        | "completed"
        | "canceled"
        | "no_show"
      calendly_booking_type: "15min_call" | "hub_dropoff"
      comm_channel: "email" | "sms" | "call" | "in_person" | "other"
      comm_direction: "inbound" | "outbound"
      customer_status: "lead" | "trial" | "active" | "paused" | "churned"
      employee_status: "active" | "reserve" | "inactive"
      enrollment_status: "trial" | "active" | "paused" | "ended"
      invoice_status: "draft" | "sent" | "paid" | "partial" | "overdue" | "void"
      lead_status: "new" | "contacted" | "converted" | "closed"
      lead_type: "exit_intent" | "waitlist" | "calendly_call" | "event"
      workflow_status: "queued" | "running" | "success" | "error"
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
      billing_frequency: [
        "per_session",
        "weekly",
        "monthly",
        "bi_monthly",
        "annual",
        "one_time",
      ],
      calendly_booking_status: [
        "scheduled",
        "completed",
        "canceled",
        "no_show",
      ],
      calendly_booking_type: ["15min_call", "hub_dropoff"],
      comm_channel: ["email", "sms", "call", "in_person", "other"],
      comm_direction: ["inbound", "outbound"],
      customer_status: ["lead", "trial", "active", "paused", "churned"],
      employee_status: ["active", "reserve", "inactive"],
      enrollment_status: ["trial", "active", "paused", "ended"],
      invoice_status: ["draft", "sent", "paid", "partial", "overdue", "void"],
      lead_status: ["new", "contacted", "converted", "closed"],
      lead_type: ["exit_intent", "waitlist", "calendly_call", "event"],
      workflow_status: ["queued", "running", "success", "error"],
    },
  },
} as const
