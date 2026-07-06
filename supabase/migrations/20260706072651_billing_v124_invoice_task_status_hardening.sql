alter table "public"."ecpay_invoice_tasks" drop constraint "ecpay_invoice_tasks_status_check";

alter table "public"."invoice_events" drop constraint "invoice_events_event_type_check";

CREATE INDEX ecpay_invoice_tasks_order_action_status_idx ON public.ecpay_invoice_tasks USING btree (payment_order_id, action_type, status, created_at DESC);

CREATE INDEX idx_ecpay_invoice_tasks_invoice_event_action_status ON public.ecpay_invoice_tasks USING btree (invoice_event_id, action_type, status);

CREATE INDEX idx_invoice_events_payment_order_event_type_created_at ON public.invoice_events USING btree (payment_order_id, event_type, created_at DESC);

CREATE INDEX invoice_events_payment_order_event_type_idx ON public.invoice_events USING btree (payment_order_id, event_type, created_at DESC);

alter table "public"."ecpay_invoice_tasks" add constraint "ecpay_invoice_tasks_status_check" CHECK ((status = ANY (ARRAY['queued'::text, 'processing'::text, 'issued'::text, 'failed'::text, 'manual_required'::text, 'voided'::text, 'allowance_issued'::text, 'completed'::text, 'skipped'::text, 'cancelled'::text]))) not valid;

alter table "public"."ecpay_invoice_tasks" validate constraint "ecpay_invoice_tasks_status_check";

alter table "public"."invoice_events" add constraint "invoice_events_event_type_check" CHECK ((event_type = ANY (ARRAY['requested'::text, 'issued'::text, 'failed'::text, 'manual_note'::text, 'manual_required'::text, 'void_or_allowance_required'::text, 'voided'::text, 'allowance'::text, 'allowance_issued'::text, 'void_or_allowance_completed'::text, 'cancelled'::text]))) not valid;

alter table "public"."invoice_events" validate constraint "invoice_events_event_type_check";


