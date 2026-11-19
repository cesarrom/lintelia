-- Live topics (docs/plans/17 §4): whatever else is shown on a case page — its timeline (audit entries), signals,
-- events, files, parties, records of connected systems — also says "case/{id} changed".
CREATE OR REPLACE FUNCTION fintivio_live_case_notify() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  rec record;
BEGIN
  IF TG_OP = 'DELETE' THEN rec := OLD; ELSE rec := NEW; END IF;
  IF rec.case_id IS NOT NULL THEN
    PERFORM pg_notify('fintivio_live', json_build_object('t', rec.tenant_id, 'topics', json_build_array('case/' || rec.case_id))::text);
  END IF;
  RETURN NULL;
END $$;
--> statement-breakpoint
CREATE TRIGGER audit_events_live AFTER INSERT ON "audit_events" FOR EACH ROW EXECUTE FUNCTION fintivio_live_case_notify();
--> statement-breakpoint
CREATE TRIGGER case_signals_live AFTER INSERT OR UPDATE ON "case_signals" FOR EACH ROW EXECUTE FUNCTION fintivio_live_case_notify();
--> statement-breakpoint
CREATE TRIGGER case_event_waits_live AFTER INSERT OR UPDATE ON "case_event_waits" FOR EACH ROW EXECUTE FUNCTION fintivio_live_case_notify();
--> statement-breakpoint
CREATE TRIGGER case_events_live AFTER INSERT OR UPDATE ON "case_events" FOR EACH ROW EXECUTE FUNCTION fintivio_live_case_notify();
--> statement-breakpoint
CREATE TRIGGER case_files_live AFTER INSERT OR UPDATE OR DELETE ON "case_files" FOR EACH ROW EXECUTE FUNCTION fintivio_live_case_notify();
--> statement-breakpoint
CREATE TRIGGER case_parties_live AFTER INSERT OR UPDATE OR DELETE ON "case_parties" FOR EACH ROW EXECUTE FUNCTION fintivio_live_case_notify();
--> statement-breakpoint
CREATE TRIGGER case_records_live AFTER INSERT OR UPDATE OR DELETE ON "case_records" FOR EACH ROW EXECUTE FUNCTION fintivio_live_case_notify();
--> statement-breakpoint
CREATE TRIGGER uploads_live AFTER INSERT OR UPDATE ON "uploads" FOR EACH ROW EXECUTE FUNCTION fintivio_live_case_notify();
