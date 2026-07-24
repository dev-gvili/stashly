-- =============================================================================
-- Notification change  →  pg_notify('notifications', payload)
-- =============================================================================
-- Bridges the DB to the live SSE feed. On every INSERT / UPDATE / DELETE of a
-- Notification row, emit a NOTIFY so the singleton LISTEN client in
-- app/.server/notification-events.ts can fan the change out to that user's open
-- EventSource connections.
--
-- Firing at the DB level (not in app code) means it works for EVERY writer:
-- createNotification(), the seed script's createMany, raw SQL, and other server
-- instances — all push live without a page refresh.
--
-- pg_notify payloads are capped at 8000 bytes. Notification messages are short,
-- so a single serialized row stays comfortably under the limit.

CREATE OR REPLACE FUNCTION notify_notification_change()
RETURNS TRIGGER AS $$
DECLARE
  payload text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    payload := json_build_object(
      'op', 'deleted',
      'userId', OLD."userId",
      'id', OLD.id
    )::text;
  ELSIF TG_OP = 'INSERT' THEN
    payload := json_build_object(
      'op', 'created',
      'userId', NEW."userId",
      'notification', row_to_json(NEW)
    )::text;
  ELSE
    payload := json_build_object(
      'op', 'updated',
      'userId', NEW."userId",
      'notification', row_to_json(NEW)
    )::text;
  END IF;

  PERFORM pg_notify('notifications', payload);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS notification_change_notify ON "Notification";
CREATE TRIGGER notification_change_notify
AFTER INSERT OR UPDATE OR DELETE ON "Notification"
FOR EACH ROW EXECUTE FUNCTION notify_notification_change();
