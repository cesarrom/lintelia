CREATE TABLE "case_event_waits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT nullif(current_setting('app.tenant_id', true), '')::uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"step_id" varchar(128) NOT NULL,
	"promise" varchar(160) NOT NULL,
	"event_type" varchar(160) NOT NULL,
	"match" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"filter" text,
	"consume" boolean DEFAULT false NOT NULL,
	"status" varchar(16) NOT NULL,
	"event_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivered_at" timestamp with time zone,
	CONSTRAINT "case_event_waits_tenant_id_id_key" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "case_event_waits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "case_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT nullif(current_setting('app.tenant_id', true), '')::uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"event_type" varchar(160) NOT NULL,
	"status" varchar(16) NOT NULL,
	"wait_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivered_at" timestamp with time zone,
	CONSTRAINT "case_events_tenant_id_id_key" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "case_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "case_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT nullif(current_setting('app.tenant_id', true), '')::uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"name" varchar(64) NOT NULL,
	"value" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "case_keys_tenant_id_id_key" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "case_keys" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "inbound_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT nullif(current_setting('app.tenant_id', true), '')::uuid NOT NULL,
	"type" varchar(160) NOT NULL,
	"source" varchar(255) NOT NULL,
	"dedupe_key" varchar(320),
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"applicant" jsonb,
	"delivered_to" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"started_cases" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"consumed_by" uuid,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inbound_events_tenant_id_id_key" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "inbound_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "live_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT nullif(current_setting('app.tenant_id', true), '')::uuid NOT NULL,
	"seq" bigserial NOT NULL,
	"topic" varchar(255) NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "live_messages_tenant_id_id_key" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "live_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "case_event_waits" ADD CONSTRAINT "case_event_waits_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_event_waits" ADD CONSTRAINT "case_event_waits_case_fk" FOREIGN KEY ("tenant_id","case_id") REFERENCES "public"."cases"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_events" ADD CONSTRAINT "case_events_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_events" ADD CONSTRAINT "case_events_case_fk" FOREIGN KEY ("tenant_id","case_id") REFERENCES "public"."cases"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_keys" ADD CONSTRAINT "case_keys_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_keys" ADD CONSTRAINT "case_keys_case_fk" FOREIGN KEY ("tenant_id","case_id") REFERENCES "public"."cases"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbound_events" ADD CONSTRAINT "inbound_events_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_messages" ADD CONSTRAINT "live_messages_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "case_event_waits_promise_idx" ON "case_event_waits" USING btree ("tenant_id","case_id","promise");--> statement-breakpoint
CREATE INDEX "case_event_waits_type_idx" ON "case_event_waits" USING btree ("tenant_id","event_type","status");--> statement-breakpoint
CREATE UNIQUE INDEX "case_events_once_idx" ON "case_events" USING btree ("tenant_id","case_id","event_id");--> statement-breakpoint
CREATE INDEX "case_events_pending_idx" ON "case_events" USING btree ("tenant_id","case_id","event_type","status");--> statement-breakpoint
CREATE UNIQUE INDEX "case_keys_case_name_idx" ON "case_keys" USING btree ("tenant_id","case_id","name");--> statement-breakpoint
CREATE INDEX "case_keys_value_idx" ON "case_keys" USING btree ("tenant_id","name","value");--> statement-breakpoint
CREATE UNIQUE INDEX "inbound_events_dedupe_idx" ON "inbound_events" USING btree ("tenant_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "inbound_events_type_idx" ON "inbound_events" USING btree ("tenant_id","type","received_at");--> statement-breakpoint
CREATE INDEX "live_messages_topic_idx" ON "live_messages" USING btree ("tenant_id","topic","seq");--> statement-breakpoint
CREATE POLICY "case_event_waits_tenant_isolation" ON "case_event_waits" AS PERMISSIVE FOR ALL TO "fintivio_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "case_events_tenant_isolation" ON "case_events" AS PERMISSIVE FOR ALL TO "fintivio_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "case_keys_tenant_isolation" ON "case_keys" AS PERMISSIVE FOR ALL TO "fintivio_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "inbound_events_tenant_isolation" ON "inbound_events" AS PERMISSIVE FOR ALL TO "fintivio_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "live_messages_tenant_isolation" ON "live_messages" AS PERMISSIVE FOR ALL TO "fintivio_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "inbound_events", "case_keys", "case_event_waits", "case_events", "live_messages" TO fintivio_app;
--> statement-breakpoint
GRANT USAGE, SELECT ON SEQUENCE "live_messages_seq_seq" TO fintivio_app;
--> statement-breakpoint
ALTER TABLE "inbound_events" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "case_keys" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "case_event_waits" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "case_events" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "live_messages" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
-- Live topics (docs/plans/17 §4): after commit, Postgres tells every API instance which topics changed ("thin" events:
-- the screens fetch the data again through the normal, authorised endpoints). Identical notifications of one
-- transaction are merged by Postgres.
CREATE OR REPLACE FUNCTION fintivio_live_notify() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  topics text[] := '{}';
  rec record;
BEGIN
  IF TG_OP = 'DELETE' THEN rec := OLD; ELSE rec := NEW; END IF;
  IF TG_TABLE_NAME = 'client_records' THEN
    topics := array['client/' || rec.client_id || '/records/' || rec.collection];
  ELSIF TG_TABLE_NAME = 'client_notifications' THEN
    topics := array['client/' || rec.client_id || '/notifications'];
  ELSIF TG_TABLE_NAME = 'client_profiles' THEN
    topics := array['client/' || rec.user_id || '/profile'];
  ELSIF TG_TABLE_NAME = 'cases' THEN
    topics := array['case/' || rec.id, 'cases'];
    IF rec.applicant_id IS NOT NULL THEN topics := topics || ('client/' || rec.applicant_id || '/cases'); END IF;
  ELSIF TG_TABLE_NAME = 'tasks' THEN
    topics := array['case/' || rec.case_id];
    IF rec.audience = 'client' THEN
      IF rec.assignee_id IS NOT NULL THEN topics := topics || ('client/' || rec.assignee_id || '/cases'); END IF;
    ELSE
      IF rec.assignee_id IS NOT NULL THEN topics := topics || ('member/' || rec.assignee_id); END IF;
      IF rec.queue_role IS NOT NULL THEN topics := topics || ('queue/' || rec.queue_role); END IF;
      IF TG_OP = 'UPDATE' THEN
        IF OLD.assignee_id IS NOT NULL AND OLD.assignee_id IS DISTINCT FROM NEW.assignee_id THEN topics := topics || ('member/' || OLD.assignee_id); END IF;
        IF OLD.queue_role IS NOT NULL AND OLD.queue_role IS DISTINCT FROM NEW.queue_role THEN topics := topics || ('queue/' || OLD.queue_role); END IF;
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'live_messages' THEN
    PERFORM pg_notify('fintivio_live', json_build_object('t', rec.tenant_id, 'topics', json_build_array(rec.topic), 'seq', rec.seq,
      'payload', CASE WHEN octet_length(rec.payload::text) < 6000 THEN rec.payload ELSE NULL END)::text);
    RETURN NULL;
  END IF;
  PERFORM pg_notify('fintivio_live', json_build_object('t', rec.tenant_id, 'topics', to_json(topics))::text);
  RETURN NULL;
END $$;
--> statement-breakpoint
CREATE TRIGGER client_records_live AFTER INSERT OR UPDATE OR DELETE ON "client_records" FOR EACH ROW EXECUTE FUNCTION fintivio_live_notify();
--> statement-breakpoint
CREATE TRIGGER client_notifications_live AFTER INSERT OR UPDATE OR DELETE ON "client_notifications" FOR EACH ROW EXECUTE FUNCTION fintivio_live_notify();
--> statement-breakpoint
CREATE TRIGGER client_profiles_live AFTER INSERT OR UPDATE ON "client_profiles" FOR EACH ROW EXECUTE FUNCTION fintivio_live_notify();
--> statement-breakpoint
CREATE TRIGGER cases_live AFTER INSERT OR UPDATE ON "cases" FOR EACH ROW EXECUTE FUNCTION fintivio_live_notify();
--> statement-breakpoint
CREATE TRIGGER tasks_live AFTER INSERT OR UPDATE OR DELETE ON "tasks" FOR EACH ROW EXECUTE FUNCTION fintivio_live_notify();
--> statement-breakpoint
CREATE TRIGGER live_messages_live AFTER INSERT ON "live_messages" FOR EACH ROW EXECUTE FUNCTION fintivio_live_notify();
