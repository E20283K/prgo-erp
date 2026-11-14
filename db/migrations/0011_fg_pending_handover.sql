ALTER TABLE "warehouse_finished_goods" ADD COLUMN "pending_quantity" numeric(15, 3) DEFAULT '0' NOT NULL;--> statement-breakpoint
-- Handed-over but unconfirmed goods were kept in "quantity" with receipt_status = PendingReceipt: move them to pending.
UPDATE "warehouse_finished_goods"
SET "pending_quantity" = "quantity", "quantity" = '0'
WHERE "receipt_status" = 'PendingReceipt';--> statement-breakpoint
-- Boxes of orders already received in the FG warehouse are in stock (old flow had only ready / dispatched).
UPDATE "work_orders" wo
SET "packaging_data" = jsonb_set(
  wo."packaging_data",
  '{boxes}',
  (
    SELECT COALESCE(jsonb_agg(
      CASE
        WHEN COALESCE(box->>'status', 'ready') = 'ready' THEN box || '{"status":"in_stock"}'::jsonb
        ELSE box
      END
    ), '[]'::jsonb)
    FROM jsonb_array_elements(wo."packaging_data"->'boxes') AS box
  )
)
WHERE jsonb_typeof(wo."packaging_data"->'boxes') = 'array'
  AND EXISTS (
    SELECT 1 FROM "warehouse_finished_goods" fg
    WHERE fg."company_id" = wo."company_id"
      AND fg."work_order_id" = wo."doc_no"
      AND fg."receipt_status" = 'Received'
  );
