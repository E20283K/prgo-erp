CREATE TYPE "public"."audit_action" AS ENUM('create', 'update', 'delete', 'post', 'unpost', 'login', 'logout');--> statement-breakpoint
CREATE TYPE "public"."industry_type" AS ENUM('printing', 'textile');--> statement-breakpoint
CREATE TYPE "public"."item_type" AS ENUM('raw_material', 'semi_finished', 'finished_good', 'service', 'consumable');--> statement-breakpoint
CREATE TYPE "public"."die_shape" AS ENUM('rectangle', 'rounded_rect', 'circle', 'oval', 'custom');--> statement-breakpoint
CREATE TYPE "public"."die_type" AS ENUM('rotary_magnetic', 'solid_rotary', 'flatbed', 'hot_stamp', 'embossing');--> statement-breakpoint
CREATE TYPE "public"."machine_status" AS ENUM('active', 'maintenance', 'idle');--> statement-breakpoint
CREATE TYPE "public"."tooling_status" AS ENUM('available', 'in_use', 'sharpening', 'retired');--> statement-breakpoint
CREATE TYPE "public"."attendance_status" AS ENUM('present', 'late', 'absent', 'sick_leave', 'vacation', 'day_off');--> statement-breakpoint
CREATE TYPE "public"."employee_status" AS ENUM('active', 'on_leave', 'probation', 'terminated');--> statement-breakpoint
CREATE TYPE "public"."payroll_status" AS ENUM('draft', 'calculated', 'approved', 'paid');--> statement-breakpoint
CREATE TYPE "public"."piecework_status" AS ENUM('draft', 'verified', 'approved', 'paid');--> statement-breakpoint
CREATE TYPE "public"."wage_type" AS ENUM('salary', 'piecework', 'hourly', 'mixed');--> statement-breakpoint
CREATE TYPE "public"."client_status" AS ENUM('VIP', 'Active', 'New', 'Blocked');--> statement-breakpoint
CREATE TYPE "public"."client_type" AS ENUM('legal_entity', 'individual');--> statement-breakpoint
CREATE TYPE "public"."contract_status" AS ENUM('active', 'expired', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."contract_type" AS ENUM('annual', 'one_time', 'framework');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('New', 'Contacted', 'Sample Sent', 'Qualified', 'Converted', 'Lost');--> statement-breakpoint
CREATE TYPE "public"."supplier_category" AS ENUM('raw_materials', 'cmyk_inks', 'ctp_prepress', 'die_tooling', 'cliche_stamping', 'outsourcing', 'logistics', 'spare_parts', 'other');--> statement-breakpoint
CREATE TYPE "public"."supplier_order_status" AS ENUM('Draft', 'Ordered', 'In_Production', 'Ready', 'Delivered', 'Cancelled');--> statement-breakpoint
CREATE TYPE "public"."supplier_order_type" AS ENUM('die_tooling', 'ctp_plates', 'cliche', 'raw_materials', 'outsourcing', 'service');--> statement-breakpoint
CREATE TYPE "public"."supplier_status" AS ENUM('Active', 'Blocked', 'Archived');--> statement-breakpoint
CREATE TYPE "public"."attachment_category" AS ENUM('proofs', 'artwork', 'dieline', 'docs');--> statement-breakpoint
CREATE TYPE "public"."work_order_priority" AS ENUM('Normal', 'High', 'Urgent');--> statement-breakpoint
CREATE TYPE "public"."work_order_stage" AS ENUM('Queue', 'Ready to Print', 'In Production', 'Post-press', 'Packaging', 'Completed', 'On Hold');--> statement-breakpoint
CREATE TYPE "public"."work_order_status" AS ENUM('Draft', 'Active', 'Completed', 'Cancelled');--> statement-breakpoint
CREATE TYPE "public"."work_order_type" AS ENUM('Production', 'Sample', 'Reprint');--> statement-breakpoint
CREATE TYPE "public"."warehouse_finished_good_status" AS ENUM('In Stock', 'Reserved', 'Shipped', 'Scrapped');--> statement-breakpoint
CREATE TYPE "public"."warehouse_stock_status" AS ENUM('In Stock', 'Low Stock', 'Critical', 'Out of Stock');--> statement-breakpoint
CREATE TYPE "public"."warehouse_inventory_status" AS ENUM('Draft', 'Matched', 'Surplus', 'Shortage', 'Completed');--> statement-breakpoint
CREATE TYPE "public"."warehouse_movement_status" AS ENUM('Pending', 'In Transit', 'Completed', 'Cancelled');--> statement-breakpoint
CREATE TYPE "public"."warehouse_receipt_status" AS ENUM('Draft', 'Inspecting', 'Quarantine', 'Accepted');--> statement-breakpoint
CREATE TYPE "public"."warehouse_shipment_status" AS ENUM('Draft', 'Packed', 'Dispatched', 'In Transit', 'Delivered', 'Cancelled');--> statement-breakpoint
CREATE TYPE "public"."warehouse_type" AS ENUM('raw_materials', 'finished_goods', 'spare_parts', 'hazmat_chemicals', 'scrap_offcuts', 'general');--> statement-breakpoint
CREATE TYPE "public"."telegram_chat_status" AS ENUM('active', 'unlinked', 'archived');--> statement-breakpoint
CREATE TYPE "public"."telegram_chat_type" AS ENUM('group', 'supergroup', 'private', 'channel');--> statement-breakpoint
CREATE TYPE "public"."finance_delivery_act_status" AS ENUM('draft', 'pending_signature', 'signed', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."finance_payment_method" AS ENUM('bank_transfer', 'cash', 'corporate_card', 'offset');--> statement-breakpoint
CREATE TYPE "public"."finance_payment_status" AS ENUM('pending', 'confirmed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."finance_settlement_status" AS ENUM('debt', 'settled', 'advance');--> statement-breakpoint
CREATE TYPE "public"."trading_import_status" AS ENUM('in_transit', 'customs_clearance', 'arrived_calculated', 'allocated_to_stock');--> statement-breakpoint
CREATE TYPE "public"."trading_doc_status" AS ENUM('Draft', 'Posted', 'Cancelled');--> statement-breakpoint
CREATE TYPE "public"."trading_payment_method" AS ENUM('bank_wire', 'corporate_card', 'cash');--> statement-breakpoint
CREATE TYPE "public"."trading_product_category" AS ENUM('Tugmalar', 'Fermuarlar', 'Jakkard', 'Iplar', 'Yorliqlar', 'Furnitura');--> statement-breakpoint
CREATE TYPE "public"."trading_ytt_legal_type" AS ENUM('YTT', 'MChJ');--> statement-breakpoint
CREATE TYPE "public"."trading_ytt_status" AS ENUM('Safe', 'Warning', 'Critical', 'Unlimited');--> statement-breakpoint
CREATE TYPE "public"."notification_category" AS ENUM('production', 'warehouse', 'finance', 'crm', 'system');--> statement-breakpoint
CREATE TYPE "public"."notification_severity" AS ENUM('info', 'success', 'warning', 'error');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid,
	"user_id" varchar(128),
	"user_name" varchar(255),
	"entity_type" varchar(64) NOT NULL,
	"entity_id" varchar(128) NOT NULL,
	"action" "audit_action" NOT NULL,
	"old_data" jsonb,
	"new_data" jsonb,
	"ip_address" varchar(64),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "branches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"code" varchar(32) NOT NULL,
	"name" varchar(255) NOT NULL,
	"short_name" varchar(128),
	"legal_entity_name" varchar(255),
	"branch_type" varchar(128),
	"tin" varchar(32),
	"vat_number" varchar(32),
	"oked" varchar(32),
	"address" text,
	"legal_address" text,
	"landmark" text,
	"phone" varchar(64),
	"email" varchar(128),
	"director" varchar(128),
	"director_phone" varchar(64),
	"chief_accountant" varchar(128),
	"chief_accountant_phone" varchar(64),
	"production_head" varchar(128),
	"production_head_phone" varchar(64),
	"shift_regime" varchar(128),
	"working_hours" varchar(128),
	"days_of_week" varchar(128),
	"total_floor_area_m2" integer DEFAULT 0,
	"machines_count" integer DEFAULT 0,
	"status" varchar(32) DEFAULT 'Active' NOT NULL,
	"is_main" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"departments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"warehouses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"bank_accounts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"integration" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(32) NOT NULL,
	"name" varchar(255) NOT NULL,
	"legal_name" varchar(255),
	"industry_type" "industry_type" DEFAULT 'printing' NOT NULL,
	"inn" varchar(32),
	"base_currency" varchar(3) DEFAULT 'UZS' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"item_type" "item_type" DEFAULT 'raw_material' NOT NULL,
	"category" varchar(64) NOT NULL,
	"unit_id" uuid NOT NULL,
	"description" text,
	"min_stock" numeric(12, 3) DEFAULT '0' NOT NULL,
	"standard_cost" numeric(15, 2) DEFAULT '0' NOT NULL,
	"selling_price" numeric(15, 2) DEFAULT '0' NOT NULL,
	"currency" varchar(3) DEFAULT 'UZS' NOT NULL,
	"properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "units_of_measure" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(16) NOT NULL,
	"name" varchar(64) NOT NULL,
	"short_name" varchar(16) NOT NULL,
	"international_code" varchar(16),
	"precision" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dies_tooling" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"die_type" "die_type" DEFAULT 'rotary_magnetic' NOT NULL,
	"shape" "die_shape" DEFAULT 'rectangle' NOT NULL,
	"width_mm" numeric(8, 2) NOT NULL,
	"height_mm" numeric(8, 2) NOT NULL,
	"corner_radius_mm" numeric(6, 2) DEFAULT '0' NOT NULL,
	"across_count" integer DEFAULT 1 NOT NULL,
	"around_count" integer DEFAULT 1 NOT NULL,
	"gap_x_mm" numeric(6, 2) DEFAULT '3.0' NOT NULL,
	"gap_y_mm" numeric(6, 2) DEFAULT '3.0' NOT NULL,
	"repeat_length_mm" numeric(8, 3),
	"cylinder_teeth" integer,
	"location" varchar(64),
	"status" "tooling_status" DEFAULT 'available' NOT NULL,
	"total_impressions" integer DEFAULT 0 NOT NULL,
	"max_impressions" integer,
	"notes" text,
	"customer_id" uuid,
	"customer_name" varchar(255),
	"ownership" varchar(32) DEFAULT 'in_house' NOT NULL,
	"is_dedicated" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flexo_cylinders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"machine_id" uuid,
	"teeth" integer NOT NULL,
	"pitch_circle_diameter" numeric(8, 3) NOT NULL,
	"plate_thickness" numeric(6, 3) NOT NULL,
	"cylinder_diameter" numeric(8, 3) NOT NULL,
	"film_length" numeric(8, 3) NOT NULL,
	"printing_length" numeric(8, 3) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"location" varchar(64),
	"status" varchar(32) DEFAULT 'ready' NOT NULL,
	"needs_verification" boolean DEFAULT false NOT NULL,
	"verification_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flexo_machines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"branch_id" uuid,
	"code" varchar(32) NOT NULL,
	"name" varchar(255) NOT NULL,
	"model" varchar(128) NOT NULL,
	"gear_system" varchar(128) NOT NULL,
	"gear_pitch" numeric(8, 4),
	"min_web_width" numeric(8, 2) NOT NULL,
	"max_web_width" numeric(8, 2) NOT NULL,
	"max_print_width" numeric(8, 2) NOT NULL,
	"standard_plate_thickness" numeric(6, 3) DEFAULT '1.700' NOT NULL,
	"color_stations" integer DEFAULT 4 NOT NULL,
	"speed_mpm" numeric(8, 2) DEFAULT '80' NOT NULL,
	"status" "machine_status" DEFAULT 'active' NOT NULL,
	"hourly_rate" numeric(15, 2) DEFAULT '0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pantone_colors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(32) NOT NULL,
	"name" varchar(128) NOT NULL,
	"hex" varchar(16) NOT NULL,
	"category" varchar(64) NOT NULL,
	"cmyk_estimate" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"work_date" date NOT NULL,
	"shift_type" varchar(32) DEFAULT 'day' NOT NULL,
	"check_in" timestamp with time zone,
	"check_out" timestamp with time zone,
	"worked_hours" numeric(4, 2) DEFAULT '0' NOT NULL,
	"overtime_hours" numeric(4, 2) DEFAULT '0' NOT NULL,
	"delay_minutes" integer DEFAULT 0 NOT NULL,
	"status" "attendance_status" DEFAULT 'present' NOT NULL,
	"source_device" varchar(64) DEFAULT 'biometric_turnstile',
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "biometric_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"branch_id" uuid,
	"name" varchar(128) NOT NULL,
	"device_code" varchar(64) NOT NULL,
	"model" varchar(64) DEFAULT 'Hikvision MinMoe' NOT NULL,
	"ip_address" varchar(64) NOT NULL,
	"port" integer DEFAULT 80 NOT NULL,
	"username" varchar(64) DEFAULT 'admin' NOT NULL,
	"password" text NOT NULL,
	"direction" varchar(32) DEFAULT 'in' NOT NULL,
	"location" varchar(128) DEFAULT 'Asosiy kirish',
	"is_enabled" boolean DEFAULT true NOT NULL,
	"last_seen_at" timestamp with time zone,
	"status" varchar(32) DEFAULT 'unknown' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"branch_id" uuid,
	"code" varchar(32) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_advances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"advance_date" date NOT NULL,
	"period" varchar(7) NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"change_type" varchar(32) NOT NULL,
	"old_value" jsonb,
	"new_value" jsonb,
	"changed_by" varchar(128),
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_shift_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"shift_id" uuid NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"branch_id" uuid,
	"department_id" uuid,
	"position_id" uuid,
	"badge_number" varchar(32) NOT NULL,
	"first_name" varchar(128) NOT NULL,
	"last_name" varchar(128) NOT NULL,
	"middle_name" varchar(128),
	"full_name" varchar(255) NOT NULL,
	"phone" varchar(64) NOT NULL,
	"email" varchar(128),
	"status" "employee_status" DEFAULT 'active' NOT NULL,
	"wage_type" "wage_type" DEFAULT 'mixed' NOT NULL,
	"base_salary" numeric(15, 2) DEFAULT '0' NOT NULL,
	"piecework_multiplier" numeric(5, 2) DEFAULT '1.00' NOT NULL,
	"hourly_rate" numeric(15, 2) DEFAULT '0' NOT NULL,
	"currency" varchar(3) DEFAULT 'UZS' NOT NULL,
	"hire_date" date NOT NULL,
	"termination_date" date,
	"current_shift" varchar(32) DEFAULT 'day',
	"avatar_url" text,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"period" varchar(7) NOT NULL,
	"adjustment_type" varchar(32) NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"period" varchar(7) NOT NULL,
	"employee_id" uuid NOT NULL,
	"base_salary" numeric(15, 2) DEFAULT '0' NOT NULL,
	"piecework_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"overtime_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"bonus_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"gross_pay" numeric(15, 2) NOT NULL,
	"advance_deduction" numeric(15, 2) DEFAULT '0' NOT NULL,
	"tax_deduction" numeric(15, 2) DEFAULT '0' NOT NULL,
	"penalty_deduction" numeric(15, 2) DEFAULT '0' NOT NULL,
	"total_deductions" numeric(15, 2) NOT NULL,
	"net_pay" numeric(15, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'UZS' NOT NULL,
	"status" "payroll_status" DEFAULT 'calculated' NOT NULL,
	"payment_date" date,
	"payment_method" varchar(32) DEFAULT 'bank_card',
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "piecework_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"work_order_id" varchar(64) NOT NULL,
	"work_date" date NOT NULL,
	"machine_code" varchar(64),
	"operation_code" varchar(64) NOT NULL,
	"operation_name" varchar(255) NOT NULL,
	"completed_quantity" numeric(12, 2) NOT NULL,
	"unit" varchar(16) DEFAULT 'dona' NOT NULL,
	"piece_rate" numeric(12, 4) NOT NULL,
	"total_amount" numeric(15, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'UZS' NOT NULL,
	"status" "piecework_status" DEFAULT 'verified' NOT NULL,
	"approved_by" varchar(128),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"department_id" uuid,
	"code" varchar(32) NOT NULL,
	"title" varchar(255) NOT NULL,
	"default_wage_type" "wage_type" DEFAULT 'piecework' NOT NULL,
	"standard_rate" numeric(15, 2) DEFAULT '0' NOT NULL,
	"currency" varchar(3) DEFAULT 'UZS' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"branch_id" uuid,
	"code" varchar(32) NOT NULL,
	"name" varchar(255) NOT NULL,
	"start_time" varchar(8) NOT NULL,
	"end_time" varchar(8) NOT NULL,
	"duration_hours" numeric(4, 2) DEFAULT '12.00' NOT NULL,
	"shift_type" varchar(16) DEFAULT 'day' NOT NULL,
	"active_workers" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"name" varchar(128) NOT NULL,
	"role" varchar(64) NOT NULL,
	"role_label" varchar(128),
	"phone" varchar(64),
	"email" varchar(128),
	"telegram" varchar(128),
	"is_primary" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"contract_no" varchar(64) NOT NULL,
	"title" varchar(255) NOT NULL,
	"type" "contract_type" DEFAULT 'annual' NOT NULL,
	"start_date" varchar(32) NOT NULL,
	"end_date" varchar(32),
	"status" "contract_status" DEFAULT 'active' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"payment_terms" varchar(128),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"legal_name" varchar(255),
	"client_type" "client_type" DEFAULT 'legal_entity' NOT NULL,
	"tin" varchar(32),
	"vat_number" varchar(64),
	"vat_payer" boolean DEFAULT false NOT NULL,
	"industry" varchar(128),
	"phone" varchar(64),
	"email" varchar(128),
	"bank_name" varchar(255),
	"bank_account" varchar(64),
	"mfo" varchar(16),
	"oked" varchar(16),
	"legal_address" text,
	"delivery_address" text,
	"currency" varchar(3) DEFAULT 'UZS' NOT NULL,
	"status" "client_status" DEFAULT 'New' NOT NULL,
	"credit_limit_usd" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"payment_terms" varchar(128),
	"manager_name" varchar(128),
	"contact_person" varchar(128),
	"receiving_hours" text,
	"requires_power_of_attorney" boolean DEFAULT true NOT NULL,
	"delivery_transport_note" text,
	"special_requirements" text,
	"notes" text,
	"contract_no" varchar(64),
	"contract_date" varchar(32),
	"contract_expiry" varchar(32),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"lead_no" varchar(32) NOT NULL,
	"company" varchar(255) NOT NULL,
	"tin" varchar(32),
	"contact" varchar(128),
	"phone" varchar(64),
	"email" varchar(128),
	"product_interest" text,
	"estimated_order_usd" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"source" varchar(128),
	"manager_id" uuid,
	"manager_name" varchar(128),
	"notes" text,
	"status" "lead_status" DEFAULT 'New' NOT NULL,
	"converted_client_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"contract_no" varchar(64) NOT NULL,
	"title" varchar(255) NOT NULL,
	"type" "contract_type" DEFAULT 'annual' NOT NULL,
	"start_date" varchar(32) NOT NULL,
	"end_date" varchar(32),
	"status" "contract_status" DEFAULT 'active' NOT NULL,
	"payment_terms" varchar(128),
	"currency" varchar(8) DEFAULT 'UZS' NOT NULL,
	"attachment_name" varchar(255),
	"attachment_url" text,
	"attachment_size" varchar(64),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"order_no" varchar(64) NOT NULL,
	"order_date" varchar(32) NOT NULL,
	"delivery_deadline" varchar(32),
	"order_type" "supplier_order_type" DEFAULT 'raw_materials' NOT NULL,
	"title" varchar(255) NOT NULL,
	"work_order_id" uuid,
	"work_order_no" varchar(64),
	"quantity" numeric(12, 2) DEFAULT '1.00' NOT NULL,
	"unit" varchar(32) DEFAULT 'dona' NOT NULL,
	"amount" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"currency" varchar(8) DEFAULT 'UZS' NOT NULL,
	"status" "supplier_order_status" DEFAULT 'Ordered' NOT NULL,
	"spec_details" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"legal_name" varchar(255),
	"category" "supplier_category" DEFAULT 'raw_materials' NOT NULL,
	"tin" varchar(32),
	"contact_person" varchar(128),
	"phone" varchar(64),
	"email" varchar(128),
	"bank_name" varchar(255),
	"bank_account" varchar(64),
	"mfo" varchar(16),
	"opening_balance" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"current_balance" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"currency" varchar(8) DEFAULT 'UZS' NOT NULL,
	"payment_terms" varchar(128),
	"address" text,
	"notes" text,
	"status" "supplier_status" DEFAULT 'Active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "production_machines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"branch_id" uuid,
	"code" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"department" varchar(64) NOT NULL,
	"category" varchar(64),
	"speed" varchar(64),
	"format" varchar(64),
	"features" text,
	"manufacturer" varchar(255),
	"country" varchar(128),
	"year" integer,
	"serial_no" varchar(128),
	"location" varchar(255),
	"lead_operator" varchar(128),
	"assistant_operator" varchar(128),
	"shift_pattern" varchar(128),
	"hourly_rate" numeric(12, 2) DEFAULT '0',
	"power_kw" numeric(10, 2) DEFAULT '0',
	"overall_efficiency" integer DEFAULT 90,
	"total_lifetime_counter" numeric(16, 0) DEFAULT '0',
	"counter_unit" varchar(32) DEFAULT 'sheets',
	"specs" jsonb,
	"energy" jsonb,
	"costing" jsonb,
	"telemetry" jsonb,
	"maintenance_logs" jsonb DEFAULT '[]'::jsonb,
	"notes" text,
	"status" varchar(64) DEFAULT 'Available' NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "production_specifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"category" varchar(64) DEFAULT 'Commercial Print' NOT NULL,
	"department" varchar(64) NOT NULL,
	"status" varchar(32) DEFAULT 'Active' NOT NULL,
	"version" varchar(32) DEFAULT '1.0' NOT NULL,
	"base_price" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"currency" varchar(16) DEFAULT 'USD' NOT NULL,
	"unit" varchar(32) DEFAULT '1k pcs' NOT NULL,
	"description" text,
	"base_material" varchar(255),
	"dimensions" jsonb DEFAULT '{"width":210,"height":297,"depth":0,"dimensionUnit":"mm"}'::jsonb NOT NULL,
	"tech_specs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"materials_count" integer DEFAULT 0 NOT NULL,
	"estimated_cost" varchar(64) DEFAULT '$0',
	"materials" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"operations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tariffs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"code" varchar(64) NOT NULL,
	"category" varchar(128) NOT NULL,
	"operation_name" varchar(255) NOT NULL,
	"department" varchar(64) DEFAULT 'Offset' NOT NULL,
	"machine_or_dept" varchar(255),
	"unit" varchar(64) DEFAULT '1,000 impressions' NOT NULL,
	"unit_divisor" integer DEFAULT 1000 NOT NULL,
	"currency" varchar(8) DEFAULT 'USD' NOT NULL,
	"rate_usd" numeric(14, 4) DEFAULT '0.0000' NOT NULL,
	"setup_fee_usd" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"min_charge_usd" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"vat_rate" numeric(5, 2) DEFAULT '12.00' NOT NULL,
	"piecework_rate_usd" numeric(14, 4) DEFAULT '0.0000' NOT NULL,
	"helper_piecework_rate_usd" numeric(14, 4) DEFAULT '0.0000' NOT NULL,
	"norm_output_per_shift" integer DEFAULT 0 NOT NULL,
	"volume_tiers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pricing_rules" jsonb DEFAULT '{"vipDiscountPct":10,"wholesaleDiscountPct":15,"urgentSurchargePct":25}'::jsonb NOT NULL,
	"tech_norms" jsonb DEFAULT '{"makeReadyMinutes":20,"makeReadyWasteSheets":50,"runningWastePercent":1.5,"ratedSpeedPerHour":10000,"effectiveSpeedPerHour":7500}'::jsonb NOT NULL,
	"cost_breakdown" jsonb DEFAULT '{"depreciationHourlyUsd":5,"powerKwPerHour":15,"powerCostPerKwh":0.08,"auxiliaryMaterialsPerUnit":1,"overheadPercent":15,"targetMarginPercent":25}'::jsonb NOT NULL,
	"pricing_matrix" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"operator_grid" jsonb DEFAULT '{"baseGrade":3,"gradeMultipliers":{"3":1,"4":1.15,"5":1.3,"6":1.5},"nightShiftSurchargePct":15,"overtimeMultiplier":1.5,"helperSharePct":35}'::jsonb NOT NULL,
	"lifecycle" jsonb DEFAULT '{"version":"v1.0","effectiveFrom":"2026-01-01","effectiveTo":null,"approvedBy":"Bosh Texnolog","approvedAt":"2026-01-01T08:00:00Z","approvalStatus":"Approved","auditLog":[{"date":"2026-01-01T08:00:00Z","user":"Bosh Texnolog","action":"INITIAL_APPROVAL","details":"Dastlabki korxona tarifi tasdiqlandi."}]}'::jsonb NOT NULL,
	"status" varchar(32) DEFAULT 'Active' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_order_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_order_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"category" "attachment_category" DEFAULT 'docs' NOT NULL,
	"file_type" varchar(128) NOT NULL,
	"file_size" varchar(64),
	"storage_path" text NOT NULL,
	"url" text NOT NULL,
	"uploaded_by" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_order_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_order_id" uuid NOT NULL,
	"op_id" varchar(64),
	"time" varchar(32) NOT NULL,
	"type" varchar(32) DEFAULT 'Run' NOT NULL,
	"note" text NOT NULL,
	"operator" varchar(128),
	"waste_qty" integer DEFAULT 0,
	"waste_reason" varchar(128),
	"gross_input" integer,
	"good_output" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_order_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_order_id" uuid NOT NULL,
	"tariff_id" uuid,
	"tariff_code" varchar(64),
	"name" varchar(128) NOT NULL,
	"department" varchar(64),
	"machine_str" varchar(128),
	"operator" varchar(255),
	"duration_hours" numeric(10, 2) DEFAULT '1.00',
	"tooling_id" varchar(64),
	"tooling_name" varchar(255),
	"calc_unit" varchar(64),
	"unit_divisor" integer DEFAULT 1000,
	"rate_usd" numeric(14, 4) DEFAULT '0.0000',
	"setup_fee_usd" numeric(14, 2) DEFAULT '0.00',
	"piecework_rate_usd" numeric(14, 4) DEFAULT '0.0000',
	"planned_cost_usd" numeric(14, 2) DEFAULT '0.00',
	"piecework_total_usd" numeric(14, 2) DEFAULT '0.00',
	"sequence" integer DEFAULT 1 NOT NULL,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"planned_qty" numeric(14, 2) DEFAULT '0' NOT NULL,
	"completed_qty" numeric(14, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"client_id" uuid,
	"doc_no" varchar(64) NOT NULL,
	"client_order_id" varchar(64),
	"customer_name" varchar(255) NOT NULL,
	"product_name" varchar(255) NOT NULL,
	"department" varchar(64) DEFAULT 'Offset' NOT NULL,
	"site" varchar(128),
	"press_machine" varchar(128),
	"recipe_code" varchar(64),
	"quantity" numeric(14, 2) DEFAULT '0' NOT NULL,
	"unit" varchar(32) DEFAULT 'pcs' NOT NULL,
	"status" "work_order_status" DEFAULT 'Draft' NOT NULL,
	"priority" "work_order_priority" DEFAULT 'Normal' NOT NULL,
	"stage" "work_order_stage" DEFAULT 'Queue' NOT NULL,
	"order_type" "work_order_type" DEFAULT 'Production' NOT NULL,
	"start_date" varchar(32),
	"deadline" varchar(32),
	"paper_stock" varchar(255),
	"coating" varchar(255),
	"lamination" varchar(255),
	"embellishment" varchar(255),
	"price_total" numeric(16, 2) DEFAULT '0.00' NOT NULL,
	"currency" varchar(3) DEFAULT 'UZS' NOT NULL,
	"operator" varchar(128),
	"shift" varchar(64),
	"photo_url" text,
	"photo_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"dimensions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"colors_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"checks" jsonb DEFAULT '{"designReady":false,"paperReady":false,"platesReady":false,"toolingReady":false}'::jsonb NOT NULL,
	"sample_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"packaging_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warehouse_finished_goods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"warehouse_id" uuid,
	"location_name" varchar(255),
	"client_id" uuid,
	"customer_name" varchar(255) NOT NULL,
	"work_order_id" varchar(128),
	"order_no" varchar(64),
	"product_name" varchar(255) NOT NULL,
	"sku" varchar(64) NOT NULL,
	"quantity" numeric(15, 3) DEFAULT '0' NOT NULL,
	"reserved_quantity" numeric(15, 3) DEFAULT '0' NOT NULL,
	"unit" varchar(32) DEFAULT 'pcs' NOT NULL,
	"batch_no" varchar(64),
	"produced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "warehouse_finished_good_status" DEFAULT 'In Stock' NOT NULL,
	"location_shelf" varchar(128),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warehouse_inventory_counts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"warehouse_id" uuid,
	"location_name" varchar(255) NOT NULL,
	"count_number" varchar(64) NOT NULL,
	"count_date" timestamp with time zone DEFAULT now() NOT NULL,
	"item_id" uuid,
	"material_sku" varchar(64),
	"material_name" varchar(255) NOT NULL,
	"system_qty" numeric(15, 3) DEFAULT '0' NOT NULL,
	"actual_qty" numeric(15, 3) DEFAULT '0' NOT NULL,
	"variance" numeric(15, 3) DEFAULT '0' NOT NULL,
	"unit" varchar(32) DEFAULT 'sheets' NOT NULL,
	"status" "warehouse_inventory_status" DEFAULT 'Draft' NOT NULL,
	"counted_by" varchar(255),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warehouse_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"movement_number" varchar(64) NOT NULL,
	"movement_date" timestamp with time zone DEFAULT now() NOT NULL,
	"from_warehouse_id" uuid,
	"to_warehouse_id" uuid,
	"from_location_name" varchar(255) NOT NULL,
	"to_location_name" varchar(255) NOT NULL,
	"item_id" uuid,
	"material_sku" varchar(64),
	"material_name" varchar(255) NOT NULL,
	"sheet_format" varchar(64),
	"quantity" numeric(15, 3) NOT NULL,
	"received_qty" numeric(15, 3) DEFAULT '0' NOT NULL,
	"unit" varchar(32) DEFAULT 'sheets' NOT NULL,
	"reason" text,
	"status" "warehouse_movement_status" DEFAULT 'Pending' NOT NULL,
	"operator" varchar(255),
	"work_order_id" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warehouse_receipt_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"receipt_id" uuid NOT NULL,
	"item_id" uuid,
	"sku" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"category" varchar(64) DEFAULT 'Paper & Board' NOT NULL,
	"quantity" numeric(15, 3) NOT NULL,
	"unit" varchar(32) DEFAULT 'sheets' NOT NULL,
	"unit_price" numeric(15, 2) DEFAULT '0' NOT NULL,
	"total_price" numeric(15, 2) DEFAULT '0' NOT NULL,
	"sheet_format" varchar(64),
	"grammage" integer,
	"batch_number" varchar(64),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warehouse_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"warehouse_id" uuid,
	"receipt_number" varchar(64) NOT NULL,
	"receipt_date" timestamp with time zone DEFAULT now() NOT NULL,
	"supplier_name" varchar(255) NOT NULL,
	"po_number" varchar(64),
	"location_name" varchar(255),
	"status" "warehouse_receipt_status" DEFAULT 'Draft' NOT NULL,
	"received_by" varchar(255),
	"notes" text,
	"total_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"currency" varchar(3) DEFAULT 'UZS' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warehouse_shipment_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipment_id" uuid NOT NULL,
	"item_id" uuid,
	"sku" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"quantity" numeric(15, 3) NOT NULL,
	"unit" varchar(32) DEFAULT 'pcs' NOT NULL,
	"unit_price" numeric(15, 2) DEFAULT '0' NOT NULL,
	"total_price" numeric(15, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warehouse_shipments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"warehouse_id" uuid,
	"shipment_number" varchar(64) NOT NULL,
	"shipment_date" timestamp with time zone DEFAULT now() NOT NULL,
	"shipment_type" varchar(64) DEFAULT 'CustomerDelivery' NOT NULL,
	"client_id" uuid,
	"customer_name" varchar(255) NOT NULL,
	"work_order_id" varchar(128),
	"delivery_act_id" varchar(128),
	"from_location_name" varchar(255),
	"status" "warehouse_shipment_status" DEFAULT 'Draft' NOT NULL,
	"carrier" varchar(255),
	"driver_name" varchar(255),
	"tracking_no" varchar(128),
	"shipped_by" varchar(255),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warehouse_stock_balances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"warehouse_id" uuid,
	"location_name" varchar(255) NOT NULL,
	"item_id" uuid,
	"sku" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"category" varchar(64) DEFAULT 'Paper & Board' NOT NULL,
	"sheet_format" varchar(64),
	"grammage" integer,
	"stock_level" numeric(15, 3) DEFAULT '0' NOT NULL,
	"reserved" numeric(15, 3) DEFAULT '0' NOT NULL,
	"available" numeric(15, 3) DEFAULT '0' NOT NULL,
	"unit" varchar(32) DEFAULT 'sheets' NOT NULL,
	"reorder" numeric(15, 3) DEFAULT '1000' NOT NULL,
	"unit_price_usd" numeric(15, 2) DEFAULT '0' NOT NULL,
	"location_shelf" varchar(128),
	"image_url" text,
	"last_received" timestamp with time zone,
	"status" "warehouse_stock_status" DEFAULT 'In Stock' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warehouses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"branch_id" uuid,
	"code" varchar(32) NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" "warehouse_type" DEFAULT 'raw_materials' NOT NULL,
	"address" text,
	"zones" integer DEFAULT 1 NOT NULL,
	"capacity" varchar(64),
	"manager_name" varchar(255),
	"manager_phone" varchar(64),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quick_reply_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"code" varchar(64) NOT NULL,
	"title" varchar(128) NOT NULL,
	"content" text NOT NULL,
	"category" varchar(64) DEFAULT 'general' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telegram_chats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"chat_id" varchar(64) NOT NULL,
	"title" varchar(255) NOT NULL,
	"type" "telegram_chat_type" DEFAULT 'supergroup' NOT NULL,
	"username" varchar(128),
	"photo_url" text,
	"client_id" uuid,
	"assigned_user_id" varchar(128),
	"status" "telegram_chat_status" DEFAULT 'unlinked' NOT NULL,
	"unread_count" integer DEFAULT 0 NOT NULL,
	"settings" jsonb DEFAULT '{"notifyOrderCreated":true,"notifyProofReady":true,"notifyProductionDone":true,"notifyPaymentReminder":false}'::jsonb NOT NULL,
	"last_message_at" timestamp with time zone,
	"last_message_snippet" text,
	"unanswered_since" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telegram_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_id" uuid NOT NULL,
	"telegram_message_id" integer NOT NULL,
	"sender_id" varchar(64),
	"sender_name" varchar(255),
	"sender_username" varchar(128),
	"sender_avatar_url" text,
	"is_outgoing" boolean DEFAULT false NOT NULL,
	"text" text,
	"media_type" varchar(32),
	"media_url" text,
	"media_file_name" varchar(255),
	"media_file_size" integer,
	"telegram_file_id" varchar(255),
	"s3_key" varchar(255),
	"is_attached_to_order" boolean DEFAULT false NOT NULL,
	"work_order_id" uuid,
	"reply_to_telegram_message_id" integer,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" varchar(128) NOT NULL,
	"bank_name" varchar(255) NOT NULL,
	"account_no" varchar(64) NOT NULL,
	"mfo" varchar(16) NOT NULL,
	"currency" varchar(8) DEFAULT 'UZS' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"balance" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"doc_no" varchar(64) NOT NULL,
	"date" varchar(32) NOT NULL,
	"client_id" uuid NOT NULL,
	"settlement_id" uuid,
	"customer" varchar(255) NOT NULL,
	"contract_no" varchar(64),
	"amount_usd" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"amount_uzs" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"exchange_rate" numeric(12, 2) DEFAULT '12850.00' NOT NULL,
	"currency" varchar(8) DEFAULT 'UZS' NOT NULL,
	"method" "finance_payment_method" DEFAULT 'bank_transfer' NOT NULL,
	"bank_account_id" uuid,
	"delivery_act_id" uuid,
	"note" text,
	"status" "finance_payment_status" DEFAULT 'confirmed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"customer" varchar(255) NOT NULL,
	"customer_tin" varchar(32),
	"contract_no" varchar(64),
	"opening_balance_usd" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"opening_balance_uzs" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"total_debit_usd" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"total_debit_uzs" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"total_credit_usd" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"total_credit_uzs" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"closing_balance_usd" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"closing_balance_uzs" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"currency" varchar(8) DEFAULT 'UZS' NOT NULL,
	"last_activity_date" varchar(32),
	"status" "finance_settlement_status" DEFAULT 'settled' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_act_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"act_id" uuid NOT NULL,
	"sku" varchar(64),
	"name" varchar(255) NOT NULL,
	"size" varchar(128),
	"unit" varchar(32) DEFAULT 'dona' NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"unit_price_usd" numeric(14, 4) DEFAULT '0.0000' NOT NULL,
	"unit_price_uzs" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"total_usd" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"total_uzs" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"vat_rate" numeric(5, 2) DEFAULT '12.00' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_acts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"doc_no" varchar(64) NOT NULL,
	"date" varchar(32) NOT NULL,
	"client_id" uuid NOT NULL,
	"client_name" varchar(255),
	"client_tin" varchar(32),
	"contract_no" varchar(64),
	"work_order_id" uuid,
	"carrier" varchar(128),
	"driver_name" varchar(128),
	"driver_phone" varchar(64),
	"vehicle_no" varchar(32),
	"recipient_name" varchar(128),
	"power_of_attorney" varchar(64),
	"subtotal_usd" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"subtotal_uzs" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"exchange_rate" numeric(12, 2) DEFAULT '12850.00' NOT NULL,
	"vat_rate" numeric(5, 2) DEFAULT '12.00' NOT NULL,
	"vat_amount_usd" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"vat_amount_uzs" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"total_amount_usd" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"total_amount_uzs" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"currency" varchar(8) DEFAULT 'UZS' NOT NULL,
	"warehouse" varchar(128),
	"linked_shipment_id" uuid,
	"status" "finance_delivery_act_status" DEFAULT 'draft' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"doc_no" varchar(64) NOT NULL,
	"date" varchar(32) NOT NULL,
	"supplier_id" uuid NOT NULL,
	"supplier_name" varchar(255) NOT NULL,
	"amount" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"currency" varchar(8) DEFAULT 'UZS' NOT NULL,
	"method" "finance_payment_method" DEFAULT 'bank_transfer' NOT NULL,
	"bank_account_id" uuid,
	"supplier_order_id" uuid,
	"note" text,
	"status" "finance_payment_status" DEFAULT 'confirmed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trading_catalog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"sku" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"category" "trading_product_category" DEFAULT 'Tugmalar' NOT NULL,
	"unit" varchar(32) DEFAULT 'dona' NOT NULL,
	"price_uzs" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"price_usd" numeric(14, 4) DEFAULT '0.0000' NOT NULL,
	"wholesale_price_uzs" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"retail_price_uzs" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"stock_qty" numeric(14, 3) DEFAULT '0.000' NOT NULL,
	"min_stock_level" numeric(14, 3) DEFAULT '0.000' NOT NULL,
	"origin" varchar(128),
	"material" varchar(128),
	"color_code" varchar(64),
	"dimensions" varchar(128),
	"supplier" varchar(255),
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trading_import_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"batch_no" varchar(64) NOT NULL,
	"date" varchar(32) NOT NULL,
	"origin" varchar(128),
	"supplier" varchar(255) NOT NULL,
	"container_no" varchar(64),
	"fob_amount_usd" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"international_cargo_usd" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"gross_weight_kg" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"customs_duty_uzs" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"exchange_rate" numeric(12, 2) DEFAULT '12850.00' NOT NULL,
	"total_landed_cost_uzs" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"landed_cost_markup_percent" numeric(5, 2) DEFAULT '0.00' NOT NULL,
	"status" "trading_import_status" DEFAULT 'in_transit' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trading_import_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"sku" varchar(64),
	"name" varchar(255) NOT NULL,
	"category" varchar(128),
	"unit" varchar(32) DEFAULT 'dona' NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"fob_price_usd" numeric(14, 4) DEFAULT '0.0000' NOT NULL,
	"fob_total_usd" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"landed_cost_uzs" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"suggested_sale_price_uzs" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trading_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"sku" varchar(64),
	"name" varchar(255) NOT NULL,
	"spec" text,
	"category" varchar(128),
	"unit" varchar(32) DEFAULT 'dona' NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"unit_price_usd" numeric(14, 4) DEFAULT '0.0000' NOT NULL,
	"total_usd" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"china_factory_status" varchar(64) DEFAULT 'Navbatda' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trading_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"order_no" varchar(64) NOT NULL,
	"date" varchar(32) NOT NULL,
	"client_id" uuid,
	"customer" varchar(255) NOT NULL,
	"customer_tin" varchar(32),
	"contract_no" varchar(64),
	"category" varchar(128),
	"delivery_date" varchar(32),
	"china_status" varchar(128) DEFAULT 'Navbatda' NOT NULL,
	"advance_status" varchar(64) DEFAULT '0% Kutilmoqda' NOT NULL,
	"advance_percent" numeric(5, 2) DEFAULT '0.00' NOT NULL,
	"advance_amount_usd" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"total_usd" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"total_uzs" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"exchange_rate" numeric(12, 2) DEFAULT '12850.00' NOT NULL,
	"shipping_method" varchar(128) DEFAULT 'Avto Fura Kargo (12-16 kun)',
	"tracking_no" varchar(64),
	"status" "trading_doc_status" DEFAULT 'Draft' NOT NULL,
	"linked_sale_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trading_sale_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sale_id" uuid NOT NULL,
	"sku" varchar(64),
	"name" varchar(255) NOT NULL,
	"category" "trading_product_category" DEFAULT 'Tugmalar' NOT NULL,
	"unit" varchar(32) DEFAULT 'dona' NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"unit_price" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"unit_price_uzs" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"unit_price_usd" numeric(14, 4) DEFAULT '0.0000' NOT NULL,
	"total_amount" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"total_usd" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"is_self_produced" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trading_sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"doc_no" varchar(64) NOT NULL,
	"date" varchar(32) NOT NULL,
	"seller_entity_id" uuid,
	"seller_entity_name" varchar(255),
	"seller_entity_inn" varchar(32),
	"client_id" uuid,
	"customer" varchar(255) NOT NULL,
	"customer_tin" varchar(32),
	"contract_no" varchar(64),
	"currency" varchar(8) DEFAULT 'UZS' NOT NULL,
	"exchange_rate" numeric(12, 2) DEFAULT '12850.00' NOT NULL,
	"total_amount" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"total_usd" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"total_uzs" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"payment_method" "trading_payment_method" DEFAULT 'bank_wire' NOT NULL,
	"status" "trading_doc_status" DEFAULT 'Draft' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trading_settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"doc_no" varchar(64) NOT NULL,
	"date" varchar(32) NOT NULL,
	"doc_type" varchar(64) DEFAULT 'Sotuv Hujjati' NOT NULL,
	"seller_entity_id" uuid,
	"seller_entity_name" varchar(255),
	"client_id" uuid,
	"customer" varchar(255) NOT NULL,
	"debit" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"credit" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"currency" varchar(8) DEFAULT 'UZS' NOT NULL,
	"balance" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trading_ytt_entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"legal_type" "trading_ytt_legal_type" DEFAULT 'YTT' NOT NULL,
	"inn" varchar(32) NOT NULL,
	"bank_name" varchar(255),
	"bank_account" varchar(64),
	"annual_limit_uzs" numeric(18, 2) DEFAULT '1000000000.00' NOT NULL,
	"current_turnover_uzs" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"currency" varchar(8) DEFAULT 'UZS' NOT NULL,
	"status" "trading_ytt_status" DEFAULT 'Safe' NOT NULL,
	"is_recommended" boolean DEFAULT false NOT NULL,
	"active_contracts_count" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" varchar(255) NOT NULL,
	"ip_address" varchar(64),
	"user_agent" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid,
	"branch_id" uuid,
	"code" varchar(32) NOT NULL,
	"username" varchar(64) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"password_salt" text NOT NULL,
	"fullName" varchar(255) NOT NULL,
	"phone" varchar(32) DEFAULT '' NOT NULL,
	"role" varchar(64) NOT NULL,
	"department" varchar(128) DEFAULT '' NOT NULL,
	"plant" varchar(128) DEFAULT '' NOT NULL,
	"status" varchar(32) DEFAULT 'Active' NOT NULL,
	"avatar" text,
	"initials" varchar(8) DEFAULT '' NOT NULL,
	"language" varchar(8) DEFAULT 'uz' NOT NULL,
	"default_module" varchar(64) DEFAULT 'production' NOT NULL,
	"linked_employee_id" uuid,
	"permissions" jsonb NOT NULL,
	"scope" jsonb NOT NULL,
	"security" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"recipient_user_id" uuid,
	"recipient_role" varchar(64) DEFAULT 'all' NOT NULL,
	"dedup_key" varchar(128),
	"severity" "notification_severity" DEFAULT 'info' NOT NULL,
	"category" "notification_category" DEFAULT 'system' NOT NULL,
	"event_type" varchar(64) NOT NULL,
	"entity_code" varchar(64),
	"title" varchar(255) NOT NULL,
	"description" text,
	"i18n_key" varchar(64),
	"i18n_params" jsonb,
	"link" jsonb,
	"target_tab" jsonb,
	"is_read" boolean DEFAULT false NOT NULL,
	"is_dismissed" boolean DEFAULT false NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_unit_id_units_of_measure_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units_of_measure"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dies_tooling" ADD CONSTRAINT "dies_tooling_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dies_tooling" ADD CONSTRAINT "dies_tooling_customer_id_clients_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flexo_cylinders" ADD CONSTRAINT "flexo_cylinders_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flexo_cylinders" ADD CONSTRAINT "flexo_cylinders_machine_id_flexo_machines_id_fk" FOREIGN KEY ("machine_id") REFERENCES "public"."flexo_machines"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flexo_machines" ADD CONSTRAINT "flexo_machines_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flexo_machines" ADD CONSTRAINT "flexo_machines_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_logs" ADD CONSTRAINT "attendance_logs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_logs" ADD CONSTRAINT "attendance_logs_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "biometric_devices" ADD CONSTRAINT "biometric_devices_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "biometric_devices" ADD CONSTRAINT "biometric_devices_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_advances" ADD CONSTRAINT "employee_advances_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_advances" ADD CONSTRAINT "employee_advances_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_history" ADD CONSTRAINT "employee_history_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_shift_assignments" ADD CONSTRAINT "employee_shift_assignments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_shift_assignments" ADD CONSTRAINT "employee_shift_assignments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_shift_assignments" ADD CONSTRAINT "employee_shift_assignments_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_position_id_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_records" ADD CONSTRAINT "payroll_records_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_records" ADD CONSTRAINT "payroll_records_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piecework_logs" ADD CONSTRAINT "piecework_logs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piecework_logs" ADD CONSTRAINT "piecework_logs_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_contracts" ADD CONSTRAINT "client_contracts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_manager_id_employees_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_converted_client_id_clients_id_fk" FOREIGN KEY ("converted_client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_contracts" ADD CONSTRAINT "supplier_contracts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_contracts" ADD CONSTRAINT "supplier_contracts_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_orders" ADD CONSTRAINT "supplier_orders_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_orders" ADD CONSTRAINT "supplier_orders_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_orders" ADD CONSTRAINT "supplier_orders_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_machines" ADD CONSTRAINT "production_machines_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_machines" ADD CONSTRAINT "production_machines_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_specifications" ADD CONSTRAINT "production_specifications_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tariffs" ADD CONSTRAINT "tariffs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_attachments" ADD CONSTRAINT "work_order_attachments_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_events" ADD CONSTRAINT "work_order_events_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_operations" ADD CONSTRAINT "work_order_operations_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_operations" ADD CONSTRAINT "work_order_operations_tariff_id_tariffs_id_fk" FOREIGN KEY ("tariff_id") REFERENCES "public"."tariffs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_finished_goods" ADD CONSTRAINT "warehouse_finished_goods_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_finished_goods" ADD CONSTRAINT "warehouse_finished_goods_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_finished_goods" ADD CONSTRAINT "warehouse_finished_goods_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_inventory_counts" ADD CONSTRAINT "warehouse_inventory_counts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_inventory_counts" ADD CONSTRAINT "warehouse_inventory_counts_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_inventory_counts" ADD CONSTRAINT "warehouse_inventory_counts_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_movements" ADD CONSTRAINT "warehouse_movements_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_movements" ADD CONSTRAINT "warehouse_movements_from_warehouse_id_warehouses_id_fk" FOREIGN KEY ("from_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_movements" ADD CONSTRAINT "warehouse_movements_to_warehouse_id_warehouses_id_fk" FOREIGN KEY ("to_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_movements" ADD CONSTRAINT "warehouse_movements_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_receipt_items" ADD CONSTRAINT "warehouse_receipt_items_receipt_id_warehouse_receipts_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."warehouse_receipts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_receipt_items" ADD CONSTRAINT "warehouse_receipt_items_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_receipts" ADD CONSTRAINT "warehouse_receipts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_receipts" ADD CONSTRAINT "warehouse_receipts_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_shipment_items" ADD CONSTRAINT "warehouse_shipment_items_shipment_id_warehouse_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."warehouse_shipments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_shipment_items" ADD CONSTRAINT "warehouse_shipment_items_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_shipments" ADD CONSTRAINT "warehouse_shipments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_shipments" ADD CONSTRAINT "warehouse_shipments_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_shipments" ADD CONSTRAINT "warehouse_shipments_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_stock_balances" ADD CONSTRAINT "warehouse_stock_balances_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_stock_balances" ADD CONSTRAINT "warehouse_stock_balances_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_stock_balances" ADD CONSTRAINT "warehouse_stock_balances_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quick_reply_templates" ADD CONSTRAINT "quick_reply_templates_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_chats" ADD CONSTRAINT "telegram_chats_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_chats" ADD CONSTRAINT "telegram_chats_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_messages" ADD CONSTRAINT "telegram_messages_chat_id_telegram_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."telegram_chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_messages" ADD CONSTRAINT "telegram_messages_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_payments" ADD CONSTRAINT "client_payments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_payments" ADD CONSTRAINT "client_payments_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_payments" ADD CONSTRAINT "client_payments_settlement_id_client_settlements_id_fk" FOREIGN KEY ("settlement_id") REFERENCES "public"."client_settlements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_payments" ADD CONSTRAINT "client_payments_bank_account_id_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_payments" ADD CONSTRAINT "client_payments_delivery_act_id_delivery_acts_id_fk" FOREIGN KEY ("delivery_act_id") REFERENCES "public"."delivery_acts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_settlements" ADD CONSTRAINT "client_settlements_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_settlements" ADD CONSTRAINT "client_settlements_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_act_items" ADD CONSTRAINT "delivery_act_items_act_id_delivery_acts_id_fk" FOREIGN KEY ("act_id") REFERENCES "public"."delivery_acts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_acts" ADD CONSTRAINT "delivery_acts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_acts" ADD CONSTRAINT "delivery_acts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_acts" ADD CONSTRAINT "delivery_acts_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_acts" ADD CONSTRAINT "delivery_acts_linked_shipment_id_warehouse_shipments_id_fk" FOREIGN KEY ("linked_shipment_id") REFERENCES "public"."warehouse_shipments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_bank_account_id_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_supplier_order_id_supplier_orders_id_fk" FOREIGN KEY ("supplier_order_id") REFERENCES "public"."supplier_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_catalog" ADD CONSTRAINT "trading_catalog_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_import_batches" ADD CONSTRAINT "trading_import_batches_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_import_items" ADD CONSTRAINT "trading_import_items_batch_id_trading_import_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."trading_import_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_order_items" ADD CONSTRAINT "trading_order_items_order_id_trading_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."trading_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_orders" ADD CONSTRAINT "trading_orders_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_orders" ADD CONSTRAINT "trading_orders_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_orders" ADD CONSTRAINT "trading_orders_linked_sale_id_trading_sales_id_fk" FOREIGN KEY ("linked_sale_id") REFERENCES "public"."trading_sales"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_sale_items" ADD CONSTRAINT "trading_sale_items_sale_id_trading_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."trading_sales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_sales" ADD CONSTRAINT "trading_sales_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_sales" ADD CONSTRAINT "trading_sales_seller_entity_id_trading_ytt_entities_id_fk" FOREIGN KEY ("seller_entity_id") REFERENCES "public"."trading_ytt_entities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_sales" ADD CONSTRAINT "trading_sales_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_settlements" ADD CONSTRAINT "trading_settlements_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_settlements" ADD CONSTRAINT "trading_settlements_seller_entity_id_trading_ytt_entities_id_fk" FOREIGN KEY ("seller_entity_id") REFERENCES "public"."trading_ytt_entities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_settlements" ADD CONSTRAINT "trading_settlements_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_ytt_entities" ADD CONSTRAINT "trading_ytt_entities_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_linked_employee_id_employees_id_fk" FOREIGN KEY ("linked_employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_company_created_idx" ON "audit_logs" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "branches_company_code_uq" ON "branches" USING btree ("company_id","code");--> statement-breakpoint
CREATE INDEX "branches_company_idx" ON "branches" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "companies_code_uq" ON "companies" USING btree ("code");--> statement-breakpoint
CREATE INDEX "companies_industry_idx" ON "companies" USING btree ("industry_type");--> statement-breakpoint
CREATE UNIQUE INDEX "items_company_code_uq" ON "items" USING btree ("company_id","code");--> statement-breakpoint
CREATE INDEX "items_company_category_idx" ON "items" USING btree ("company_id","category");--> statement-breakpoint
CREATE INDEX "items_company_item_type_idx" ON "items" USING btree ("company_id","item_type");--> statement-breakpoint
CREATE UNIQUE INDEX "units_code_uq" ON "units_of_measure" USING btree ("code");--> statement-breakpoint
CREATE INDEX "units_is_active_idx" ON "units_of_measure" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "dies_tooling_company_code_uq" ON "dies_tooling" USING btree ("company_id","code");--> statement-breakpoint
CREATE INDEX "dies_tooling_company_shape_idx" ON "dies_tooling" USING btree ("company_id","shape");--> statement-breakpoint
CREATE INDEX "dies_tooling_status_idx" ON "dies_tooling" USING btree ("status");--> statement-breakpoint
CREATE INDEX "dies_tooling_customer_idx" ON "dies_tooling" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "flexo_cylinders_teeth_uq" ON "flexo_cylinders" USING btree ("company_id","machine_id","teeth","plate_thickness");--> statement-breakpoint
CREATE INDEX "flexo_cylinders_teeth_idx" ON "flexo_cylinders" USING btree ("teeth");--> statement-breakpoint
CREATE INDEX "flexo_cylinders_machine_idx" ON "flexo_cylinders" USING btree ("machine_id");--> statement-breakpoint
CREATE UNIQUE INDEX "flexo_machines_company_code_uq" ON "flexo_machines" USING btree ("company_id","code");--> statement-breakpoint
CREATE INDEX "flexo_machines_company_idx" ON "flexo_machines" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "flexo_machines_status_idx" ON "flexo_machines" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "pantone_code_uq" ON "pantone_colors" USING btree ("code");--> statement-breakpoint
CREATE INDEX "pantone_category_idx" ON "pantone_colors" USING btree ("category");--> statement-breakpoint
CREATE INDEX "pantone_name_idx" ON "pantone_colors" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_emp_date_shift_uq" ON "attendance_logs" USING btree ("employee_id","work_date","shift_type");--> statement-breakpoint
CREATE INDEX "attendance_work_date_idx" ON "attendance_logs" USING btree ("company_id","work_date");--> statement-breakpoint
CREATE UNIQUE INDEX "biometric_devices_company_code_uq" ON "biometric_devices" USING btree ("company_id","device_code");--> statement-breakpoint
CREATE UNIQUE INDEX "departments_company_code_uq" ON "departments" USING btree ("company_id","code");--> statement-breakpoint
CREATE INDEX "departments_company_idx" ON "departments" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "advances_emp_period_idx" ON "employee_advances" USING btree ("employee_id","period");--> statement-breakpoint
CREATE INDEX "advances_company_idx" ON "employee_advances" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "emp_history_emp_idx" ON "employee_history" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "emp_shift_employee_idx" ON "employee_shift_assignments" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "emp_shift_shift_idx" ON "employee_shift_assignments" USING btree ("shift_id");--> statement-breakpoint
CREATE UNIQUE INDEX "employees_company_badge_uq" ON "employees" USING btree ("company_id","badge_number");--> statement-breakpoint
CREATE INDEX "employees_company_department_idx" ON "employees" USING btree ("company_id","department_id");--> statement-breakpoint
CREATE INDEX "employees_company_status_idx" ON "employees" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "payroll_adj_emp_period_idx" ON "payroll_adjustments" USING btree ("employee_id","period");--> statement-breakpoint
CREATE INDEX "payroll_adj_company_idx" ON "payroll_adjustments" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payroll_emp_period_uq" ON "payroll_records" USING btree ("employee_id","period");--> statement-breakpoint
CREATE INDEX "payroll_period_idx" ON "payroll_records" USING btree ("company_id","period");--> statement-breakpoint
CREATE INDEX "payroll_status_idx" ON "payroll_records" USING btree ("status");--> statement-breakpoint
CREATE INDEX "piecework_employee_date_idx" ON "piecework_logs" USING btree ("employee_id","work_date");--> statement-breakpoint
CREATE INDEX "piecework_work_order_idx" ON "piecework_logs" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "piecework_status_idx" ON "piecework_logs" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "positions_company_code_uq" ON "positions" USING btree ("company_id","code");--> statement-breakpoint
CREATE INDEX "positions_department_idx" ON "positions" USING btree ("department_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shifts_company_code_uq" ON "shifts" USING btree ("company_id","code");--> statement-breakpoint
CREATE INDEX "shifts_company_idx" ON "shifts" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "client_contacts_client_idx" ON "client_contacts" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "client_contracts_no_uq" ON "client_contracts" USING btree ("client_id","contract_no");--> statement-breakpoint
CREATE INDEX "client_contracts_client_idx" ON "client_contracts" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "clients_company_code_uq" ON "clients" USING btree ("company_id","code");--> statement-breakpoint
CREATE INDEX "clients_company_idx" ON "clients" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "clients_tin_idx" ON "clients" USING btree ("tin");--> statement-breakpoint
CREATE INDEX "clients_status_idx" ON "clients" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "crm_leads_company_no_uq" ON "crm_leads" USING btree ("company_id","lead_no");--> statement-breakpoint
CREATE INDEX "crm_leads_company_idx" ON "crm_leads" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "crm_leads_status_idx" ON "crm_leads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "crm_leads_tin_idx" ON "crm_leads" USING btree ("tin");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_contracts_supplier_no_uq" ON "supplier_contracts" USING btree ("supplier_id","contract_no");--> statement-breakpoint
CREATE INDEX "supplier_contracts_supplier_idx" ON "supplier_contracts" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "supplier_contracts_company_idx" ON "supplier_contracts" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "supplier_contracts_status_idx" ON "supplier_contracts" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_orders_company_no_uq" ON "supplier_orders" USING btree ("company_id","order_no");--> statement-breakpoint
CREATE INDEX "supplier_orders_supplier_idx" ON "supplier_orders" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "supplier_orders_work_order_idx" ON "supplier_orders" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "supplier_orders_status_idx" ON "supplier_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "supplier_orders_date_idx" ON "supplier_orders" USING btree ("order_date");--> statement-breakpoint
CREATE UNIQUE INDEX "suppliers_company_code_uq" ON "suppliers" USING btree ("company_id","code");--> statement-breakpoint
CREATE INDEX "suppliers_company_idx" ON "suppliers" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "suppliers_category_idx" ON "suppliers" USING btree ("category");--> statement-breakpoint
CREATE INDEX "suppliers_status_idx" ON "suppliers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "suppliers_tin_idx" ON "suppliers" USING btree ("tin");--> statement-breakpoint
CREATE UNIQUE INDEX "production_machines_company_code_uq" ON "production_machines" USING btree ("company_id","code");--> statement-breakpoint
CREATE INDEX "production_machines_department_idx" ON "production_machines" USING btree ("department");--> statement-breakpoint
CREATE UNIQUE INDEX "production_specifications_code_uq" ON "production_specifications" USING btree ("company_id","code");--> statement-breakpoint
CREATE INDEX "production_specifications_dept_idx" ON "production_specifications" USING btree ("department");--> statement-breakpoint
CREATE INDEX "production_specifications_cat_idx" ON "production_specifications" USING btree ("category");--> statement-breakpoint
CREATE INDEX "production_specifications_status_idx" ON "production_specifications" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "tariffs_company_code_uq" ON "tariffs" USING btree ("company_id","code");--> statement-breakpoint
CREATE INDEX "tariffs_company_idx" ON "tariffs" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "tariffs_category_idx" ON "tariffs" USING btree ("category");--> statement-breakpoint
CREATE INDEX "tariffs_dept_idx" ON "tariffs" USING btree ("department");--> statement-breakpoint
CREATE INDEX "work_order_attachments_wo_idx" ON "work_order_attachments" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "work_order_attachments_cat_idx" ON "work_order_attachments" USING btree ("category");--> statement-breakpoint
CREATE INDEX "work_order_events_wo_idx" ON "work_order_events" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "work_order_operations_wo_idx" ON "work_order_operations" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "work_order_operations_tariff_idx" ON "work_order_operations" USING btree ("tariff_id");--> statement-breakpoint
CREATE UNIQUE INDEX "work_orders_company_doc_no_uq" ON "work_orders" USING btree ("company_id","doc_no");--> statement-breakpoint
CREATE INDEX "work_orders_company_idx" ON "work_orders" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "work_orders_client_idx" ON "work_orders" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "work_orders_stage_idx" ON "work_orders" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "work_orders_status_idx" ON "work_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "work_orders_priority_idx" ON "work_orders" USING btree ("priority");--> statement-breakpoint
CREATE UNIQUE INDEX "finished_goods_company_sku_batch_uq" ON "warehouse_finished_goods" USING btree ("company_id","sku","work_order_id");--> statement-breakpoint
CREATE INDEX "finished_goods_company_idx" ON "warehouse_finished_goods" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "finished_goods_customer_idx" ON "warehouse_finished_goods" USING btree ("company_id","customer_name");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_company_number_uq" ON "warehouse_inventory_counts" USING btree ("company_id","count_number");--> statement-breakpoint
CREATE INDEX "inventory_company_date_idx" ON "warehouse_inventory_counts" USING btree ("company_id","count_date");--> statement-breakpoint
CREATE UNIQUE INDEX "movements_company_number_uq" ON "warehouse_movements" USING btree ("company_id","movement_number");--> statement-breakpoint
CREATE INDEX "movements_company_date_idx" ON "warehouse_movements" USING btree ("company_id","movement_date");--> statement-breakpoint
CREATE INDEX "movements_status_idx" ON "warehouse_movements" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "receipt_items_receipt_idx" ON "warehouse_receipt_items" USING btree ("receipt_id");--> statement-breakpoint
CREATE INDEX "receipt_items_sku_idx" ON "warehouse_receipt_items" USING btree ("sku");--> statement-breakpoint
CREATE UNIQUE INDEX "receipts_company_number_uq" ON "warehouse_receipts" USING btree ("company_id","receipt_number");--> statement-breakpoint
CREATE INDEX "receipts_company_date_idx" ON "warehouse_receipts" USING btree ("company_id","receipt_date");--> statement-breakpoint
CREATE INDEX "receipts_warehouse_idx" ON "warehouse_receipts" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "shipment_items_shipment_idx" ON "warehouse_shipment_items" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX "shipment_items_sku_idx" ON "warehouse_shipment_items" USING btree ("sku");--> statement-breakpoint
CREATE UNIQUE INDEX "shipments_company_number_uq" ON "warehouse_shipments" USING btree ("company_id","shipment_number");--> statement-breakpoint
CREATE INDEX "shipments_company_date_idx" ON "warehouse_shipments" USING btree ("company_id","shipment_date");--> statement-breakpoint
CREATE INDEX "shipments_warehouse_idx" ON "warehouse_shipments" USING btree ("warehouse_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_balance_company_location_sku_uq" ON "warehouse_stock_balances" USING btree ("company_id","location_name","sku");--> statement-breakpoint
CREATE INDEX "stock_balance_company_idx" ON "warehouse_stock_balances" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "stock_balance_sku_idx" ON "warehouse_stock_balances" USING btree ("company_id","sku");--> statement-breakpoint
CREATE UNIQUE INDEX "warehouses_company_code_uq" ON "warehouses" USING btree ("company_id","code");--> statement-breakpoint
CREATE INDEX "warehouses_company_idx" ON "warehouses" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "warehouses_type_idx" ON "warehouses" USING btree ("company_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "quick_reply_templates_company_code_uq" ON "quick_reply_templates" USING btree ("company_id","code");--> statement-breakpoint
CREATE INDEX "quick_reply_templates_company_idx" ON "quick_reply_templates" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "telegram_chats_company_chat_id_uq" ON "telegram_chats" USING btree ("company_id","chat_id");--> statement-breakpoint
CREATE INDEX "telegram_chats_company_idx" ON "telegram_chats" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "telegram_chats_client_idx" ON "telegram_chats" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "telegram_chats_status_idx" ON "telegram_chats" USING btree ("status");--> statement-breakpoint
CREATE INDEX "telegram_chats_last_msg_idx" ON "telegram_chats" USING btree ("last_message_at");--> statement-breakpoint
CREATE INDEX "telegram_messages_chat_idx" ON "telegram_messages" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX "telegram_messages_tg_msg_idx" ON "telegram_messages" USING btree ("chat_id","telegram_message_id");--> statement-breakpoint
CREATE INDEX "telegram_messages_work_order_idx" ON "telegram_messages" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "telegram_messages_sent_at_idx" ON "telegram_messages" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "bank_accounts_company_idx" ON "bank_accounts" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "bank_accounts_acc_idx" ON "bank_accounts" USING btree ("account_no");--> statement-breakpoint
CREATE UNIQUE INDEX "client_payments_company_doc_uq" ON "client_payments" USING btree ("company_id","doc_no");--> statement-breakpoint
CREATE INDEX "client_payments_company_idx" ON "client_payments" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "client_payments_client_idx" ON "client_payments" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "client_payments_date_idx" ON "client_payments" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "client_settlements_client_contract_uq" ON "client_settlements" USING btree ("client_id","contract_no");--> statement-breakpoint
CREATE INDEX "client_settlements_company_idx" ON "client_settlements" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "client_settlements_client_idx" ON "client_settlements" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "client_settlements_status_idx" ON "client_settlements" USING btree ("status");--> statement-breakpoint
CREATE INDEX "delivery_act_items_act_idx" ON "delivery_act_items" USING btree ("act_id");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_acts_company_doc_uq" ON "delivery_acts" USING btree ("company_id","doc_no");--> statement-breakpoint
CREATE INDEX "delivery_acts_company_idx" ON "delivery_acts" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "delivery_acts_client_idx" ON "delivery_acts" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "delivery_acts_status_idx" ON "delivery_acts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "delivery_acts_date_idx" ON "delivery_acts" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_payments_company_doc_uq" ON "supplier_payments" USING btree ("company_id","doc_no");--> statement-breakpoint
CREATE INDEX "supplier_payments_company_idx" ON "supplier_payments" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "supplier_payments_supplier_idx" ON "supplier_payments" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "supplier_payments_date_idx" ON "supplier_payments" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "trading_catalog_company_sku_uq" ON "trading_catalog" USING btree ("company_id","sku");--> statement-breakpoint
CREATE INDEX "trading_catalog_company_idx" ON "trading_catalog" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "trading_catalog_category_idx" ON "trading_catalog" USING btree ("category");--> statement-breakpoint
CREATE UNIQUE INDEX "trading_import_company_batch_uq" ON "trading_import_batches" USING btree ("company_id","batch_no");--> statement-breakpoint
CREATE INDEX "trading_import_company_idx" ON "trading_import_batches" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "trading_import_status_idx" ON "trading_import_batches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "trading_import_items_batch_idx" ON "trading_import_items" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "trading_order_items_order_idx" ON "trading_order_items" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trading_orders_company_order_uq" ON "trading_orders" USING btree ("company_id","order_no");--> statement-breakpoint
CREATE INDEX "trading_orders_company_idx" ON "trading_orders" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "trading_orders_client_idx" ON "trading_orders" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "trading_orders_china_status_idx" ON "trading_orders" USING btree ("china_status");--> statement-breakpoint
CREATE INDEX "trading_sale_items_sale_idx" ON "trading_sale_items" USING btree ("sale_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trading_sales_company_doc_uq" ON "trading_sales" USING btree ("company_id","doc_no");--> statement-breakpoint
CREATE INDEX "trading_sales_company_idx" ON "trading_sales" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "trading_sales_seller_idx" ON "trading_sales" USING btree ("seller_entity_id");--> statement-breakpoint
CREATE INDEX "trading_sales_client_idx" ON "trading_sales" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "trading_settlements_company_idx" ON "trading_settlements" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "trading_settlements_seller_idx" ON "trading_settlements" USING btree ("seller_entity_id");--> statement-breakpoint
CREATE INDEX "trading_settlements_client_idx" ON "trading_settlements" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "trading_settlements_date_idx" ON "trading_settlements" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "trading_ytt_company_code_uq" ON "trading_ytt_entities" USING btree ("company_id","code");--> statement-breakpoint
CREATE INDEX "trading_ytt_company_idx" ON "trading_ytt_entities" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "trading_ytt_inn_idx" ON "trading_ytt_entities" USING btree ("inn");--> statement-breakpoint
CREATE UNIQUE INDEX "user_sessions_token_uq" ON "user_sessions" USING btree ("token");--> statement-breakpoint
CREATE INDEX "user_sessions_user_idx" ON "user_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_sessions_expires_idx" ON "user_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_uq" ON "users" USING btree ("username");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_code_uq" ON "users" USING btree ("code");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "users_status_idx" ON "users" USING btree ("status");--> statement-breakpoint
CREATE INDEX "users_company_idx" ON "users" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_company_dedup_uq" ON "notifications" USING btree ("company_id","dedup_key");--> statement-breakpoint
CREATE INDEX "notifications_company_created_idx" ON "notifications" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_company_read_idx" ON "notifications" USING btree ("company_id","is_read");--> statement-breakpoint
CREATE INDEX "notifications_company_dismissed_idx" ON "notifications" USING btree ("company_id","is_dismissed");--> statement-breakpoint
CREATE INDEX "notifications_category_idx" ON "notifications" USING btree ("category");--> statement-breakpoint
CREATE INDEX "notifications_severity_idx" ON "notifications" USING btree ("severity");